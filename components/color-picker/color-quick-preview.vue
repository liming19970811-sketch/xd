<template>
  <view class="quick-preview">
    <view class="quick-preview-head">
      <view><text class="quick-preview-title">快速预览（不扣额度）</text><text class="quick-preview-tip">预览仅供参考，最终效果以AI生成为准</text></view>
      <button v-if="!enabled" class="quick-preview-button" :disabled="!canPreview" @click="enablePreview">生成预览</button>
      <button v-else class="quick-preview-button secondary" :disabled="status === 'loading'" @click="runPreview()">刷新</button>
    </view>

    <view v-if="enabled" class="quick-preview-content">
      <view class="quick-preview-image-wrap">
        <image class="quick-preview-image" :src="imageSrc" mode="aspectFit" />
        <text>原图</text>
      </view>
      <view id="quickPreviewResult" class="quick-preview-image-wrap" @touchend="handlePreviewTap">
        <image v-if="previewUrl" class="quick-preview-image" :src="previewUrl" mode="aspectFit" />
        <view v-else class="quick-preview-placeholder">{{ status === 'loading' ? '正在生成预览...' : '等待预览' }}</view>
        <text>预览效果</text>
      </view>
    </view>
    <text v-if="enabled && previewUrl" class="quick-preview-adjust">服装区域不准确？点击预览图中的服装位置重新取样。</text>
    <text v-if="errorMessage" class="quick-preview-error">{{ errorMessage }}，仍可继续正式生成。</text>

    <canvas :id="canvasId" :canvas-id="canvasId" class="quick-preview-canvas" />
  </view>
</template>

<script>
import { applyMaskedColorMap, buildConnectedColorMask } from '../../utils/color/colorPreview.js'

export default {
  name: 'ColorQuickPreview',
  props: {
    imageSrc: { type: String, default: '' },
    targetColor: { type: Object, default: null },
    enabled: { type: Boolean, default: false },
    canvasId: { type: String, default: 'colorQuickPreviewCanvas' }
  },
  data() {
    return {
      status: 'idle',
      errorMessage: '',
      previewUrl: '',
      canvasRect: null,
      drawMetrics: null,
      revision: 0,
      refreshQueued: false,
      pendingSeed: null
    }
  },
  computed: {
    canPreview() {
      return Boolean(this.imageSrc && this.targetColor && this.targetColor.hex)
    }
  },
  watch: {
    imageSrc() {
      this.previewUrl = ''
      if (this.enabled && this.canPreview) this.$nextTick(() => this.runPreview())
    },
    'targetColor.hex'() {
      if (this.enabled && this.canPreview) this.$nextTick(() => this.runPreview())
    },
    enabled(value) {
      if (value && this.canPreview) this.$nextTick(() => this.runPreview())
    }
  },
  methods: {
    enablePreview() {
      if (!this.canPreview) {
        uni.showToast({ title: this.imageSrc ? '请先选择目标颜色' : '请先上传服装图', icon: 'none' })
        return
      }
      this.$emit('enable')
    },
    queryCanvasRect() {
      return new Promise((resolve, reject) => {
        uni.createSelectorQuery().in(this).select(`#${this.canvasId}`).boundingClientRect((rect) => {
          if (!rect || !rect.width || !rect.height) reject(new Error('PREVIEW_CANVAS_UNAVAILABLE'))
          else resolve(rect)
        }).exec()
      })
    },
    getImageInfo() {
      return new Promise((resolve, reject) => uni.getImageInfo({ src: this.imageSrc, success: resolve, fail: reject }))
    },
    readPixels(width, height) {
      return new Promise((resolve, reject) => uni.canvasGetImageData({
        canvasId: this.canvasId,
        x: 0,
        y: 0,
        width,
        height,
        success: (result) => resolve(result.data || []),
        fail: reject
      }, this))
    },
    writePixels(data, width, height) {
      return new Promise((resolve, reject) => uni.canvasPutImageData({
        canvasId: this.canvasId,
        x: 0,
        y: 0,
        width,
        height,
        data,
        success: resolve,
        fail: reject
      }, this))
    },
    exportPreview(width, height) {
      return new Promise((resolve, reject) => uni.canvasToTempFilePath({
        canvasId: this.canvasId,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width,
        destHeight: height,
        success: (result) => resolve(result.tempFilePath || ''),
        fail: reject
      }, this))
    },
    async runPreview(seed = null) {
      if (!this.canPreview) return
      if (this.status === 'loading') {
        this.refreshQueued = true
        this.pendingSeed = seed
        return
      }
      const revision = ++this.revision
      this.status = 'loading'
      this.errorMessage = ''
      this.previewUrl = ''
      this.$emit('status', { status: 'loading', previewOnly: true })
      try {
        const [rect, image] = await Promise.all([this.queryCanvasRect(), this.getImageInfo()])
        const width = Math.max(1, Math.floor(rect.width))
        const height = Math.max(1, Math.floor(rect.height))
        const scale = Math.min(width / image.width, height / image.height)
        const drawWidth = image.width * scale
        const drawHeight = image.height * scale
        const drawX = (width - drawWidth) / 2
        const drawY = (height - drawHeight) / 2
        const context = uni.createCanvasContext(this.canvasId, this)
        context.setFillStyle('#F5F6FA')
        context.fillRect(0, 0, width, height)
        context.drawImage(image.path || this.imageSrc, drawX, drawY, drawWidth, drawHeight)
        await new Promise((resolve) => context.draw(false, resolve))
        const pixels = await this.readPixels(width, height)
        const seedX = seed ? seed.x : drawX + (drawWidth * 0.5)
        const seedY = seed ? seed.y : drawY + (drawHeight * 0.58)
        const mask = buildConnectedColorMask(pixels, width, height, { seedX, seedY })
        const selectedPixels = Array.from(mask).filter((value) => value > 20).length
        const imagePixels = Math.max(1, Math.round(drawWidth * drawHeight))
        if (selectedPixels < imagePixels * 0.008 || selectedPixels > imagePixels * 0.72) throw new Error('GARMENT_MASK_UNCERTAIN')
        const output = applyMaskedColorMap(pixels, mask, this.targetColor)
        if (!output.length) throw new Error('PREVIEW_COLOR_MAP_FAILED')
        await this.writePixels(output, width, height)
        const previewUrl = await this.exportPreview(width, height)
        if (revision !== this.revision) return
        this.canvasRect = rect
        this.drawMetrics = { drawX, drawY, drawWidth, drawHeight, width, height }
        this.previewUrl = previewUrl
        this.status = 'ready'
        this.$emit('preview', {
          previewOnly: true,
          previewUrl,
          maskSource: 'local_connected_color_region',
          selectedPixelCount: selectedPixels
        })
        this.flushQueuedPreview()
      } catch (error) {
        if (revision !== this.revision) return
        this.status = 'error'
        this.errorMessage = error && error.message === 'GARMENT_MASK_UNCERTAIN'
          ? '未能可靠定位服装区域，请点击服装主体重新取样'
          : '快速预览生成失败'
        this.$emit('error', { previewOnly: true, errorCode: error && error.message ? error.message : 'COLOR_PREVIEW_FAILED' })
        this.flushQueuedPreview()
      }
    },
    flushQueuedPreview() {
      if (!this.refreshQueued) return
      const seed = this.pendingSeed
      this.refreshQueued = false
      this.pendingSeed = null
      this.$nextTick(() => this.runPreview(seed))
    },
    handlePreviewTap(event = {}) {
      if (!this.drawMetrics) return
      const touch = (event.touches || event.changedTouches || [])[0] || event.detail || {}
      const clientX = Number(touch.clientX !== undefined ? touch.clientX : touch.pageX)
      const clientY = Number(touch.clientY !== undefined ? touch.clientY : touch.pageY)
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return
      uni.createSelectorQuery().in(this).select('#quickPreviewResult').boundingClientRect((rect) => {
        if (!rect || !rect.width || !rect.height) return
        const x = ((clientX - rect.left) / rect.width) * this.drawMetrics.width
        const y = ((clientY - rect.top) / rect.height) * this.drawMetrics.height
        this.runPreview({ x, y })
      }).exec()
    }
  }
}
</script>

<style scoped>
.quick-preview { position: relative; margin-bottom: 20rpx; padding: 24rpx; border: 1rpx solid #e4e7ec; border-radius: 24rpx; background: #fff; }
.quick-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.quick-preview-title,.quick-preview-tip { display: block; }
.quick-preview-title { color: #101828; font-size: 27rpx; font-weight: 700; }
.quick-preview-tip { margin-top: 5rpx; color: #667085; font-size: 20rpx; line-height: 1.4; }
.quick-preview-button { flex-shrink: 0; min-width: 148rpx; height: 68rpx; margin: 0; padding: 0 16rpx; border-radius: 14rpx; background: #6657d9; color: #fff; font-size: 22rpx; font-weight: 600; line-height: 68rpx; }
.quick-preview-button.secondary { border: 1rpx solid #c7c1ef; background: #f5f3ff; color: #594bc5; }
.quick-preview-button::after { border: 0; }
.quick-preview-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 18rpx; }
.quick-preview-image-wrap { min-width: 0; }
.quick-preview-image,.quick-preview-placeholder { display: flex; width: 100%; height: 260rpx; border: 1rpx solid #e4e7ec; border-radius: 16rpx; background: #f5f6fa; align-items: center; justify-content: center; box-sizing: border-box; }
.quick-preview-placeholder { color: #667085; font-size: 21rpx; }
.quick-preview-image-wrap > text { display: block; margin-top: 7rpx; color: #475467; font-size: 21rpx; text-align: center; }
.quick-preview-adjust { display: block; margin-top: 12rpx; color: #6657d9; font-size: 20rpx; line-height: 1.4; }
.quick-preview-error { display: block; margin-top: 12rpx; color: #b54708; font-size: 20rpx; line-height: 1.45; }
.quick-preview-canvas { position: fixed; left: -10000px; top: -10000px; width: 320px; height: 360px; pointer-events: none; }
</style>
