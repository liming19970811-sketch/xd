<template>
  <view class="detail-page">
    <view class="detail-nav">
      <text class="back-link" @click="$emit('back')">← 返回我的作品</text>
      <text class="detail-nav-title">作品详情</text>
      <text class="favorite-link" :class="{ active: work.isFavorite }" @click="$emit('toggle-favorite', work)">
        {{ work.isFavorite ? '已收藏' : '收藏' }}
      </text>
    </view>

    <view v-if="work && work.id" class="detail-content">
      <view class="section-card result-section">
        <view class="section-head">
          <view>
            <text class="section-title">生成结果</text>
            <text class="section-subtitle">每张结果均为独立文件</text>
          </view>
          <text class="result-index">{{ resultPositionLabel }}</text>
        </view>
        <view class="detail-visual" :class="{ placeholder: !activeResultUrl || previewFailed }">
        <video
          v-if="currentMediaType === 'video' && activeResultUrl && !previewFailed"
          class="detail-image"
          :src="activeResultUrl"
          controls
          object-fit="contain"
          @error="handlePreviewError"
        ></video>
        <image
          v-else-if="activeResultUrl && !previewFailed"
          class="detail-image"
          :src="activeResultUrl"
          mode="aspectFit"
          @error="handlePreviewError"
          @click="previewMedia(activeResultUrl)"
        ></image>
        <view v-else class="detail-placeholder">
          <text class="placeholder-mark">AI</text>
          <text>{{ work.statusText || '生成结果暂时不可用' }}</text>
        </view>
        <text class="detail-type">{{ work.typeLabel }}</text>
        </view>

        <scroll-view v-if="resultItems.length > 1" class="result-strip" scroll-x :show-scrollbar="false">
          <view class="result-strip-inner">
            <view
              v-for="(item, index) in resultItems"
              :key="item.assetId || item.url || index"
              class="result-thumb"
              :class="{ active: activeResultIndex === index }"
              @click="selectResult(index)"
            >
              <image :src="item.url" mode="aspectFill" />
              <text>{{ index + 1 }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="result-quick-actions">
          <button class="detail-action" :disabled="!activeResultUrl" @click="previewMedia(activeResultUrl)">预览当前</button>
          <button class="detail-action emphasis" :disabled="downloadingMedia || !activeResultUrl" @click="downloadCurrentMedia">{{ downloadButtonLabel }}</button>
        </view>
      </view>

      <view class="section-card compare-section">
        <view class="section-head">
          <view>
            <text class="section-title">前后图对比</text>
            <text class="section-subtitle">当前对比方案 {{ activeResultIndex + 1 }}</text>
          </view>
          <view class="compare-modes">
            <text :class="{ active: compareMode === 'side' }" @click="compareMode = 'side'">并排</text>
            <text :class="{ active: compareMode === 'slider' }" @click="compareMode = 'slider'">滑杆</text>
          </view>
        </view>
        <view v-if="canCompareImages && compareMode === 'side'" class="compare-side">
          <view class="compare-item">
            <image :src="sourceImageUrl" mode="aspectFit" @click="previewMedia(sourceImageUrl)"></image>
            <text>原图</text>
          </view>
          <view class="compare-item generated">
            <image :src="activeResultUrl" mode="aspectFit" @click="previewMedia(activeResultUrl)"></image>
            <text>AI生成图</text>
          </view>
        </view>
        <view v-else-if="canCompareImages" class="compare-slider-wrap">
          <view class="compare-slider-stage">
            <image class="compare-slider-image" :src="activeResultUrl" mode="aspectFit"></image>
            <view class="compare-original-layer" :style="{ width: `${comparePosition}%` }">
              <image :src="sourceImageUrl" mode="aspectFit"></image>
            </view>
            <view class="compare-divider" :style="{ left: `${comparePosition}%` }"></view>
            <text class="compare-label original">原图</text>
            <text class="compare-label generated">AI生成图</text>
          </view>
          <slider :value="comparePosition" min="5" max="95" activeColor="#1677ff" backgroundColor="#dbe3ef" @changing="changeComparePosition" @change="changeComparePosition" />
        </view>
        <view v-else class="compare-unavailable">
          <text>{{ sourceImageUrl ? '当前素材暂不支持静态图片对比' : '历史作品未记录原图，暂时无法对比' }}</text>
        </view>
      </view>

      <view class="section-card change-section">
        <view class="section-head">
          <view>
            <text class="section-title">本次更改要求</text>
            <text class="section-subtitle">来自任务提交时保存的设置</text>
          </view>
        </view>
        <view class="requirement-list">
          <view v-for="field in visibleChangeFields" :key="`${field.label}_${field.value}`" class="requirement-row">
            <text>{{ field.label }}</text><text>{{ field.value }}</text>
          </view>
        </view>
        <view v-if="schemeFields.length" class="scheme-features">
          <text class="scheme-title">方案特点</text>
          <view v-for="field in schemeFields" :key="`${field.label}_${field.value}`" class="requirement-row">
            <text>{{ field.label }}</text><text>{{ field.value }}</text>
          </view>
        </view>
        <button v-if="changeFields.length > 6" class="expand-button" @click="changesExpanded = !changesExpanded">
          {{ changesExpanded ? '收起设置' : '展开全部设置' }}
        </button>
      </view>

      <view class="section-card generation-section">
        <view class="generation-toggle" @click="infoExpanded = !infoExpanded">
          <view><text class="section-title">生成信息</text><text class="section-subtitle">状态、方案和技术信息</text></view>
          <text class="toggle-arrow">{{ infoExpanded ? '收起' : '展开' }} ›</text>
        </view>
        <view v-if="infoExpanded" class="meta-list">
          <view v-for="field in generationInfo" :key="field.label" class="meta-row"><text>{{ field.label }}</text><text>{{ field.value }}</text></view>
          <view class="meta-row"><text>剩余额度</text><text>{{ quotaLabel }}</text></view>
        </view>
      </view>

      <view class="section-card detail-actions">
        <text class="actions-title">作品操作</text>
        <view class="primary-actions">
          <button class="detail-action primary" :disabled="savingWork" @click="saveCurrentWork">{{ saveButtonLabel }}</button>
          <button class="detail-action" @click="$emit('regenerate', work)">再次生成</button>
        </view>
        <view class="secondary-actions">
          <button
            class="detail-action"
            open-type="share"
            :data-work-id="work.id"
            @click="$emit('share', work)"
          >分享</button>
          <button class="detail-action" @click="$emit('open-production', work)">查看生产记录</button>
          <button class="detail-action danger" @click="$emit('remove', work)">移出作品中心</button>
        </view>
      </view>

      <view class="section-card continue-actions">
        <text class="actions-title">继续制作</text>
        <view class="continue-grid">
          <button class="continue-action" @click="$emit('continue', { work, action: 'scene_replace', toolType: 'scene' })">换场景</button>
          <button class="continue-action" @click="$emit('continue', { work, action: 'model', toolType: 'model' })">换模特</button>
          <button class="continue-action" @click="$emit('continue', { work, action: 'color', toolType: 'color' })">换颜色</button>
          <button class="continue-action" @click="$emit('continue', { work, action: 'detail_page', toolType: 'marketing' })">生成详情页</button>
        </view>
      </view>
      <button v-if="quota.exhausted" class="quota-action full" @click="$emit('upgrade')">查看会员套餐</button>
    </view>

    <view v-else class="detail-empty">
      <text>作品不存在或已不可用</text>
      <button class="detail-action primary full" @click="$emit('back')">返回作品中心</button>
    </view>
  </view>
</template>

<script>
import { isDownloadableWorkImageUrl } from '../../utils/work/workRepository'
import { buildGenerationInfo, buildSchemeFields, buildWorkChangeFields } from '../../utils/work/workDetailDisplay'

export default {
  name: 'GalleryDetail',
  props: {
    work: { type: Object, default: () => ({}) },
    quota: { type: Object, default: () => ({}) }
  },
  data() {
    return {
      savingWork: false,
      saveFailed: false,
      downloadingMedia: false,
      previewFailed: false,
      activeResultIndex: 0,
      compareMode: 'side',
      comparePosition: 50,
      changesExpanded: false,
      infoExpanded: false
    }
  },
  computed: {
    saveButtonLabel() {
      if (this.savingWork) return '保存中...'
      if (this.saveFailed) return '重新保存'
      return this.work && this.work.isFavorite ? '已收藏' : '收藏作品'
    },
    downloadButtonLabel() {
      if (this.downloadingMedia) return '保存中...'
      return this.currentMediaType === 'video' ? '保存视频到相册' : '保存图片到相册'
    },
    quotaLabel() {
      const value = Number(this.quota && this.quota.remaining)
      return Number.isFinite(value) ? `${Math.max(0, value)} 点` : '暂时无法获取'
    },
    resultItems() {
      return (Array.isArray(this.work && this.work.resultItems) ? this.work.resultItems : [])
        .map((item) => typeof item === 'string' ? { url: item } : (item || {}))
        .filter((item) => item.url)
    },
    activeResultItem() {
      return this.resultItems[this.activeResultIndex] || {}
    },
    activeResultUrl() {
      return this.activeResultItem.url || ''
    },
    currentMediaType() {
      return this.activeResultItem.mediaType || this.work.mediaType || 'image'
    },
    resultPositionLabel() {
      const total = this.resultItems.length || Math.max(1, Number(this.work.expectedOutputCount) || 1)
      return this.resultItems.length ? `${this.activeResultIndex + 1}/${total}` : `0/${total}`
    },
    sourceImageUrl() {
      return this.work.sourceImage || this.work.sourceUrl || ''
    },
    canCompareImages() {
      return Boolean(this.sourceImageUrl && this.activeResultUrl && this.currentMediaType !== 'video')
    },
    changeFields() {
      return buildWorkChangeFields(this.work)
    },
    visibleChangeFields() {
      return this.changesExpanded ? this.changeFields : this.changeFields.slice(0, 6)
    },
    schemeFields() {
      if (!this.activeResultUrl) return []
      return buildSchemeFields(this.activeResultItem, this.activeResultIndex).filter((field) => field.value && field.value !== '未记录')
    },
    generationInfo() {
      return buildGenerationInfo(this.work)
    }
  },
  watch: {
    'work.id'() {
      this.previewFailed = false
      this.saveFailed = false
      this.activeResultIndex = 0
      this.comparePosition = 50
      this.changesExpanded = false
      this.infoExpanded = false
    }
  },
  methods: {
    handlePreviewError() {
      this.previewFailed = true
    },
    selectResult(index = 0) {
      const normalized = Math.max(0, Math.min(this.resultItems.length - 1, Number(index) || 0))
      this.activeResultIndex = normalized
      this.previewFailed = false
      this.comparePosition = 50
    },
    changeComparePosition(event = {}) {
      this.comparePosition = Math.max(5, Math.min(95, Number(event.detail && event.detail.value) || 50))
    },
    previewMedia(current = '') {
      const urls = this.resultItems.map((item) => item.url).filter(Boolean)
      if (this.sourceImageUrl && !urls.includes(this.sourceImageUrl)) urls.unshift(this.sourceImageUrl)
      if (!urls.length) return
      this.$emit('preview', { current: current || urls[0], urls })
    },
    saveCurrentWork() {
      if (this.savingWork || !this.work || !this.work.id) return
      if (this.work.isFavorite) {
        uni.showToast({ title: '已收藏', icon: 'none' })
        return
      }
      this.saveFailed = false
      this.savingWork = true
      this.$emit('toggle-favorite', this.work)
      this.savingWork = false
    },
    downloadCurrentMedia() {
      if (this.downloadingMedia) return
      const mediaUrl = this.activeResultUrl
      if (!isDownloadableWorkImageUrl(mediaUrl)) {
        uni.showToast({ title: '素材地址无效，暂时无法保存', icon: 'none' })
        return
      }
      this.downloadingMedia = true
      const onFailure = () => {
        this.downloadingMedia = false
        uni.showToast({ title: '素材下载失败，请稍后重试', icon: 'none' })
      }
      if (/^cloud:\/\//.test(mediaUrl) && typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.downloadFile === 'function') {
        wx.cloud.downloadFile({
          fileID: mediaUrl,
          success: (result = {}) => result.tempFilePath ? this.ensureAlbumPermission(result.tempFilePath) : onFailure(),
          fail: onFailure
        })
        return
      }
      if (/^https?:\/\//.test(mediaUrl)) {
        const api = typeof wx !== 'undefined' ? wx : uni
        api.downloadFile({
          url: mediaUrl,
          success: (result = {}) => Number(result.statusCode) === 200 && result.tempFilePath
            ? this.ensureAlbumPermission(result.tempFilePath)
            : onFailure(),
          fail: onFailure
        })
        return
      }
      this.ensureAlbumPermission(mediaUrl)
    },
    ensureAlbumPermission(filePath = '') {
      const api = typeof wx !== 'undefined' ? wx : uni
      if (!api || typeof api.getSetting !== 'function') {
        this.saveDownloadedMedia(filePath)
        return
      }
      api.getSetting({
        success: (setting = {}) => {
          const permission = setting.authSetting && setting.authSetting['scope.writePhotosAlbum']
          if (permission === true) {
            this.saveDownloadedMedia(filePath)
            return
          }
          if (permission === false) {
            this.downloadingMedia = false
            this.showAlbumPermissionSettings()
            return
          }
          if (typeof api.authorize !== 'function') {
            this.saveDownloadedMedia(filePath)
            return
          }
          api.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => this.saveDownloadedMedia(filePath),
            fail: () => {
              this.downloadingMedia = false
              this.showAlbumPermissionSettings()
            }
          })
        },
        fail: () => {
          this.downloadingMedia = false
          uni.showToast({ title: '暂时无法检查相册权限', icon: 'none' })
        }
      })
    },
    saveDownloadedMedia(filePath = '') {
      const api = typeof wx !== 'undefined' ? wx : uni
      const methodName = this.currentMediaType === 'video'
        ? 'saveVideoToPhotosAlbum'
        : 'saveImageToPhotosAlbum'
      if (!filePath || !api || typeof api[methodName] !== 'function') {
        this.downloadingMedia = false
        uni.showToast({ title: '当前环境无法保存该素材', icon: 'none' })
        return
      }
      api[methodName]({
        filePath,
        success: () => {
          this.downloadingMedia = false
          uni.showToast({ title: '已保存到系统相册', icon: 'success' })
        },
        fail: (error = {}) => {
          this.downloadingMedia = false
          const message = String(error.errMsg || error.message || '')
          if (/auth|authorize|permission|deny/i.test(message)) {
            this.showAlbumPermissionSettings()
            return
          }
          uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
        }
      })
    },
    showAlbumPermissionSettings() {
      const api = typeof wx !== 'undefined' ? wx : uni
      uni.showModal({
        title: '需要相册权限',
        content: '请在设置中开启相册权限，开启后可再次保存。',
        confirmText: '打开设置',
        success: (result) => {
          if (result.confirm && api && typeof api.openSetting === 'function') api.openSetting()
        }
      })
    }
  }
}
</script>

<style scoped>
.detail-page { min-height: 100vh; padding: 24rpx 24rpx calc(64rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #f6f7fb; color: #111827; }
.detail-nav { position: sticky; top: 0; z-index: 20; display: grid; grid-template-columns: minmax(0, 1.3fr) auto minmax(0, 1fr); align-items: center; min-height: 88rpx; margin: -24rpx -24rpx 22rpx; padding: 0 24rpx; border-bottom: 1rpx solid #e5e7eb; background: rgba(255, 255, 255, 0.97); box-sizing: border-box; }
.back-link, .favorite-link { min-height: 88rpx; color: #1677ff; font-size: 24rpx; font-weight: 700; line-height: 88rpx; }
.favorite-link { text-align: right; }.favorite-link.active { color: #ea580c; }.detail-nav-title { font-size: 30rpx; font-weight: 800; }
.detail-visual { position: relative; overflow: hidden; width: 100%; height: 720rpx; border-radius: 24rpx; background: #ffffff; }
.detail-image, .detail-placeholder { width: 100%; height: 100%; }.detail-placeholder { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14rpx; background: #eef1f7; color: #6b7280; }
.result-strip { width: 100%; margin-top: 16rpx; white-space: nowrap; }
.result-strip-inner { display: inline-flex; gap: 12rpx; padding-right: 24rpx; }
.result-strip image { width: 150rpx; height: 150rpx; border-radius: 16rpx; background: #eef1f7; }
.placeholder-mark { display: flex; align-items: center; justify-content: center; width: 84rpx; height: 84rpx; border-radius: 22rpx; background: #ffffff; color: #4f46e5; font-weight: 800; }
.detail-type { position: absolute; left: 18rpx; top: 18rpx; padding: 8rpx 14rpx; border-radius: 999rpx; background: rgba(17, 24, 39, 0.74); color: #ffffff; font-size: 20rpx; }
.detail-summary, .detail-actions, .continue-actions, .quota-hint, .detail-empty { margin-top: 20rpx; padding: 24rpx; border-radius: 22rpx; background: #ffffff; }
.summary-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }.summary-copy { min-width: 0; }
.summary-title, .summary-plan, .actions-title, .quota-warning { display: block; }.summary-title { font-size: 31rpx; font-weight: 800; }.summary-plan { margin-top: 8rpx; color: #6b7280; font-size: 22rpx; }
.saved-badge { flex-shrink: 0; padding: 7rpx 12rpx; border-radius: 999rpx; background: #ecfdf3; color: #16803c; font-size: 20rpx; font-weight: 700; }.saved-badge.pending { background: #f3f4f6; color: #6b7280; }
.meta-list { margin-top: 20rpx; border-top: 1rpx solid #eef0f4; }.meta-row { display: flex; justify-content: space-between; gap: 24rpx; padding-top: 16rpx; color: #6b7280; font-size: 22rpx; }.meta-row text:last-child { color: #111827; text-align: right; }
.actions-title { font-size: 27rpx; font-weight: 800; }.primary-actions, .secondary-actions, .continue-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 18rpx; }
.secondary-actions { margin-top: 12rpx; }.detail-action, .continue-action { width: 100%; height: 70rpx; margin: 0; padding: 0 10rpx; border: 1rpx solid #e5e7eb; border-radius: 16rpx; background: #ffffff; color: #4f46e5; font-size: 22rpx; font-weight: 700; line-height: 68rpx; }
.detail-action::after, .continue-action::after, .quota-action::after { border: 0; }.detail-action.primary { border-color: #4f46e5; background: #4f46e5; color: #ffffff; }.detail-action.emphasis { border-color: rgba(79, 70, 229, 0.3); background: #eef2ff; }.detail-action.danger { color: #dc2626; }.detail-action.full { margin-top: 18rpx; }
.continue-action { background: #f8f9fc; color: #374151; }.quota-hint { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; color: #4b5563; font-size: 22rpx; }.quota-hint.exhausted { flex-wrap: wrap; background: #fff7ed; }.quota-warning { width: 100%; color: #c2410c; }.quota-action { width: 190rpx; height: 60rpx; margin: 0; border-radius: 14rpx; background: #4f46e5; color: #ffffff; font-size: 21rpx; line-height: 60rpx; }.detail-empty { margin-top: 120rpx; color: #6b7280; text-align: center; }
.section-card { margin-top: 20rpx; padding: 24rpx; border-radius: 22rpx; background: #ffffff; box-sizing: border-box; }
.result-section { margin-top: 0; }
.section-head, .generation-toggle { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.section-title, .section-subtitle { display: block; }
.section-title { font-size: 28rpx; font-weight: 800; color: #111827; }
.section-subtitle { margin-top: 6rpx; color: #6b7280; font-size: 21rpx; line-height: 1.45; }
.result-index { flex-shrink: 0; padding: 8rpx 14rpx; border-radius: 999rpx; background: #eef4ff; color: #1677ff; font-size: 22rpx; font-weight: 800; }
.result-section .detail-visual { margin-top: 20rpx; height: 680rpx; }
.result-thumb { position: relative; width: 142rpx; height: 142rpx; overflow: hidden; border: 3rpx solid transparent; border-radius: 16rpx; box-sizing: border-box; background: #eef1f7; }
.result-thumb.active { border-color: #1677ff; }
.result-thumb image { width: 100%; height: 100%; }
.result-thumb text { position: absolute; right: 7rpx; bottom: 7rpx; min-width: 30rpx; height: 30rpx; border-radius: 15rpx; background: rgba(17, 24, 39, 0.72); color: #fff; font-size: 18rpx; line-height: 30rpx; text-align: center; }
.result-quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.compare-modes { display: flex; padding: 4rpx; border-radius: 14rpx; background: #f1f5f9; }
.compare-modes text { min-width: 72rpx; padding: 9rpx 12rpx; border-radius: 11rpx; color: #64748b; font-size: 20rpx; text-align: center; }
.compare-modes text.active { background: #fff; color: #1677ff; font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.08); }
.compare-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 20rpx; }
.compare-item { position: relative; height: 330rpx; overflow: hidden; border: 1rpx solid #e5e7eb; border-radius: 16rpx; background: #f8fafc; }
.compare-item image { width: 100%; height: 100%; }
.compare-item text, .compare-label { position: absolute; left: 10rpx; bottom: 10rpx; padding: 7rpx 11rpx; border-radius: 999rpx; background: rgba(17, 24, 39, 0.76); color: #fff; font-size: 19rpx; }
.compare-item.generated text { background: rgba(22, 119, 255, 0.88); }
.compare-slider-wrap { margin-top: 20rpx; }
.compare-slider-stage { position: relative; height: 500rpx; overflow: hidden; border-radius: 16rpx; background: #eef1f7; }
.compare-slider-image { width: 100%; height: 100%; }
.compare-original-layer { position: absolute; z-index: 2; top: 0; bottom: 0; left: 0; overflow: hidden; border-right: 3rpx solid #fff; }
.compare-original-layer image { width: calc(100vw - 96rpx); height: 500rpx; max-width: 654rpx; }
.compare-divider { position: absolute; z-index: 3; top: 0; bottom: 0; width: 3rpx; margin-left: -2rpx; background: #fff; box-shadow: 0 0 8rpx rgba(15, 23, 42, 0.32); }
.compare-label { z-index: 4; }.compare-label.generated { right: 10rpx; left: auto; background: rgba(22, 119, 255, 0.88); }
.compare-unavailable { display: flex; align-items: center; justify-content: center; min-height: 180rpx; margin-top: 20rpx; border-radius: 16rpx; background: #f8fafc; color: #64748b; font-size: 22rpx; text-align: center; }
.requirement-list, .scheme-features { margin-top: 18rpx; border-top: 1rpx solid #eef0f4; }
.requirement-row { display: grid; grid-template-columns: 180rpx minmax(0, 1fr); gap: 18rpx; padding-top: 16rpx; font-size: 22rpx; line-height: 1.5; }
.requirement-row text:first-child { color: #6b7280; }.requirement-row text:last-child { color: #111827; word-break: break-all; }
.scheme-features { padding-top: 16rpx; }.scheme-title { color: #1677ff; font-size: 23rpx; font-weight: 800; }
.expand-button { height: 64rpx; margin: 18rpx 0 0; padding: 0; border: 0; background: #f5f8ff; color: #1677ff; font-size: 21rpx; line-height: 64rpx; }
.expand-button::after { border: 0; }
.generation-toggle { min-height: 54rpx; }.toggle-arrow { color: #1677ff; font-size: 21rpx; font-weight: 700; }
.generation-section .meta-list { margin-top: 18rpx; }
.quota-action.full { width: 100%; height: 72rpx; margin-top: 20rpx; line-height: 72rpx; }
</style>
