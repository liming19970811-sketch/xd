<template>
  <view class="picker-shell">
    <canvas
      :id="canvasId"
      :canvas-id="canvasId"
      class="picker-canvas"
      @touchstart="handleTouch"
      @touchmove.stop.prevent="handleTouch"
    ></canvas>
    <view v-if="point" class="picker-crosshair" :style="pointStyle">
      <view class="picker-crosshair-horizontal"></view>
      <view class="picker-crosshair-vertical"></view>
    </view>
    <view v-if="sampledColor" class="picker-magnifier" :style="magnifierStyle">
      <view class="picker-pixel-grid">
        <view v-for="(pixel, index) in sampledPixels" :key="index" class="picker-pixel" :style="{ background: pixel }"></view>
      </view>
      <text>{{ sampledColor.hex }}</text>
    </view>
    <view v-if="loading" class="picker-state">正在读取图片颜色...</view>
    <view v-else-if="errorMessage" class="picker-state error">{{ errorMessage }}</view>
  </view>
</template>

<script>
import { averageImageColor, extractDominantColors, normalizeStandardColor, rgbToHex } from '../../utils/color/colorPicker'

export default {
  name: 'ColorPickerCanvas',
  props: {
    canvasId: { type: String, required: true },
    imageSrc: { type: String, default: '' },
    extractPalette: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      errorMessage: '',
      canvasRect: null,
      drawMetrics: null,
      point: null,
      sampledColor: null,
      sampledPixels: []
    }
  },
  computed: {
    pointStyle() {
      return this.point ? { left: `${this.point.x}px`, top: `${this.point.y}px` } : {}
    },
    magnifierStyle() {
      if (!this.point || !this.canvasRect) return {}
      const placeLeft = this.point.x > this.canvasRect.width * 0.62
      return { left: placeLeft ? '16px' : 'auto', right: placeLeft ? 'auto' : '16px', top: '16px' }
    }
  },
  watch: {
    imageSrc: {
      immediate: true,
      handler() {
        this.$nextTick(() => this.drawImage())
      }
    }
  },
  methods: {
    queryCanvasRect() {
      return new Promise((resolve, reject) => {
        uni.createSelectorQuery().in(this).select('.picker-canvas').boundingClientRect((rect) => {
          if (!rect || !rect.width || !rect.height) reject(new Error('CANVAS_SIZE_UNAVAILABLE'))
          else resolve(rect)
        }).exec()
      })
    },
    getImageInfo(src) {
      return new Promise((resolve, reject) => {
        uni.getImageInfo({ src, success: resolve, fail: reject })
      })
    },
    async drawImage() {
      if (!this.imageSrc) return
      this.loading = true
      this.errorMessage = ''
      this.point = null
      try {
        const [rect, image] = await Promise.all([this.queryCanvasRect(), this.getImageInfo(this.imageSrc)])
        const scale = Math.min(rect.width / image.width, rect.height / image.height)
        const drawWidth = image.width * scale
        const drawHeight = image.height * scale
        const drawX = (rect.width - drawWidth) / 2
        const drawY = (rect.height - drawHeight) / 2
        const context = uni.createCanvasContext(this.canvasId, this)
        context.setFillStyle('#f3f4f6')
        context.fillRect(0, 0, rect.width, rect.height)
        context.drawImage(image.path || this.imageSrc, drawX, drawY, drawWidth, drawHeight)
        await new Promise((resolve) => context.draw(false, resolve))
        this.canvasRect = rect
        this.drawMetrics = { drawX, drawY, drawWidth, drawHeight }
        this.loading = false
        this.$emit('ready', { width: image.width, height: image.height })
        if (this.extractPalette) await this.extractDominantPalette()
      } catch (error) {
        this.loading = false
        this.errorMessage = '图片颜色读取失败，请重新选择图片。'
        this.$emit('error', { errorCode: error && error.message ? error.message : 'CANVAS_DRAW_FAILED' })
      }
    },
    readPixels(x, y, width, height) {
      return new Promise((resolve, reject) => {
        uni.canvasGetImageData({
          canvasId: this.canvasId,
          x,
          y,
          width,
          height,
          success: (result) => resolve(result.data || []),
          fail: reject
        }, this)
      })
    },
    normalizeTouch(event = {}) {
      const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]) || {}
      const rect = this.canvasRect || {}
      const rawX = touch.x !== undefined ? touch.x : Number(touch.clientX || 0) - Number(rect.left || 0)
      const rawY = touch.y !== undefined ? touch.y : Number(touch.clientY || 0) - Number(rect.top || 0)
      return { x: Number(rawX), y: Number(rawY) }
    },
    async handleTouch(event) {
      if (this.loading || !this.drawMetrics) return
      const point = this.normalizeTouch(event)
      const metrics = this.drawMetrics
      if (point.x < metrics.drawX || point.x > metrics.drawX + metrics.drawWidth || point.y < metrics.drawY || point.y > metrics.drawY + metrics.drawHeight) return
      const radius = 2
      const x = Math.max(0, Math.round(point.x) - radius)
      const y = Math.max(0, Math.round(point.y) - radius)
      try {
        const data = await this.readPixels(x, y, 5, 5)
        const average = averageImageColor(data)
        if (!average) throw new Error('EMPTY_PIXEL_DATA')
        const color = normalizeStandardColor({ name: '吸管取色', rgb: [average.r, average.g, average.b] }, 'eyedropper')
        this.point = point
        this.sampledColor = color
        this.sampledPixels = []
        for (let index = 0; index + 3 < data.length; index += 4) {
          this.sampledPixels.push(rgbToHex(data[index], data[index + 1], data[index + 2]))
        }
        this.$emit('sample', color)
      } catch (error) {
        this.errorMessage = '取色失败，请在图片主体区域重新尝试。'
        this.$emit('error', { errorCode: 'PIXEL_READ_FAILED' })
      }
    },
    async extractDominantPalette() {
      if (!this.canvasRect || !this.drawMetrics) return
      try {
        const x = Math.max(0, Math.floor(this.drawMetrics.drawX))
        const y = Math.max(0, Math.floor(this.drawMetrics.drawY))
        const width = Math.max(1, Math.floor(this.drawMetrics.drawWidth))
        const height = Math.max(1, Math.floor(this.drawMetrics.drawHeight))
        const data = await this.readPixels(x, y, width, height)
        this.$emit('palette', extractDominantColors(data, { limit: 6, pixelStep: 4 }))
      } catch (error) {
        this.errorMessage = '主色提取失败，仍可在图片上手动取色。'
        this.$emit('error', { errorCode: 'PALETTE_EXTRACTION_FAILED' })
      }
    }
  }
}
</script>

<style scoped>
.picker-shell { position: relative; width: 100%; height: 360rpx; overflow: hidden; border-radius: 16rpx; background: #f3f4f6; }
.picker-canvas { width: 100%; height: 360rpx; }
.picker-state { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; padding: 24rpx; color: #6b7280; background: rgba(255,255,255,.82); font-size: 24rpx; text-align: center; }
.picker-state.error { color: #b42318; }
.picker-crosshair { position: absolute; width: 34rpx; height: 34rpx; margin: -17rpx 0 0 -17rpx; border: 4rpx solid #fff; border-radius: 50%; box-shadow: 0 0 0 2rpx #2563eb; pointer-events: none; }
.picker-crosshair-horizontal,.picker-crosshair-vertical { position: absolute; left: 50%; top: 50%; background: #2563eb; transform: translate(-50%,-50%); }
.picker-crosshair-horizontal { width: 48rpx; height: 2rpx; }
.picker-crosshair-vertical { width: 2rpx; height: 48rpx; }
.picker-magnifier { position: absolute; width: 112rpx; min-height: 132rpx; padding: 8rpx; border: 4rpx solid #fff; border-radius: 16rpx; background: #fff; box-shadow: 0 8rpx 24rpx rgba(15,23,42,.2); pointer-events: none; }
.picker-magnifier text { display: block; margin-top: 6rpx; color: #111827; font-size: 18rpx; text-align: center; }
.picker-pixel-grid { display: grid; grid-template-columns: repeat(5,1fr); width: 96rpx; height: 96rpx; overflow: hidden; border-radius: 8rpx; }
.picker-pixel { min-width: 0; min-height: 0; }
</style>
