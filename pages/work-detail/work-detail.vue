<template>
  <view
    class="work-detail-page"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="resetEdgeGesture"
  >
    <gallery-detail
      :work="work"
      :quota="membershipUsage"
      @back="backToWorks"
      @toggle-favorite="toggleFavorite"
      @regenerate="regenerate"
      @continue="continueWork"
      @share="prepareShare"
      @remove="removeWorkReference"
      @open-production="openProductionRecord"
      @upgrade="goToPackageCenter"
      @preview="previewWorkImages"
    ></gallery-detail>
  </view>
</template>

<script>
import GalleryDetail from '../gallery-detail/gallery-detail.vue'
import {
  getWorkDetail,
  markWorkUsed,
  regenerateWork,
  removeWorkLocalReference,
  setWorkFavorite
} from '../../utils/work/workRepository'
import { getMembershipUsage } from '../../utils/member/membershipRepository'

const CONTINUE_CONTEXT_STORAGE_PREFIX = 'diebiandesign_continue_context_'
const EDGE_START_PX = 28
const SWIPE_DISTANCE_PX = 82
const SWIPE_VELOCITY_PX_MS = 0.5

export default {
  components: { GalleryDetail },
  data() {
    return {
      workId: '',
      taskId: '',
      work: {},
      membershipUsage: { remaining: NaN, exhausted: false },
      returning: false,
      previewing: false,
      edgeGesture: null,
      submitting: false
    }
  },
  onLoad(options = {}) {
    this.workId = decodeURIComponent(String(options.workId || ''))
    this.taskId = decodeURIComponent(String(options.taskId || ''))
    this.loadWork()
  },
  onShow() {
    this.previewing = false
    this.loadWork()
  },
  onBackPress() {
    if (this.returning) return true
    this.backToWorks()
    return true
  },
  onShareAppMessage() {
    const work = this.work || {}
    const query = work.id
      ? `workId=${encodeURIComponent(work.id)}&taskId=${encodeURIComponent(work.taskId || '')}`
      : `taskId=${encodeURIComponent(this.taskId)}`
    return {
      title: work.id ? `${work.typeLabel || 'AI作品'} · ${work.title || '作品详情'}` : '蝶变 AI 作品',
      path: `/pages/work-detail/work-detail?${query}`,
      imageUrl: work.coverUrl || ''
    }
  },
  methods: {
    loadWork() {
      const detail = getWorkDetail(this.workId || this.taskId)
      this.work = detail || {}
      if (detail && detail.id) {
        this.workId = detail.id
        this.taskId = detail.taskId || this.taskId
      }
      const usage = getMembershipUsage()
      this.membershipUsage = usage && usage.ok && usage.data
        ? usage.data
        : { remaining: NaN, exhausted: false }
    },
    backToWorks() {
      if (this.returning) return
      this.returning = true
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (pages.length > 1) {
        uni.navigateBack({
          delta: 1,
          fail: () => this.switchToWorks()
        })
        return
      }
      this.switchToWorks()
    },
    switchToWorks() {
      uni.switchTab({
        url: '/pages/gallery/gallery',
        fail: () => { this.returning = false }
      })
    },
    getTouch(event = {}) {
      const touches = event.changedTouches || event.touches || []
      return touches[0] || null
    },
    handleTouchStart(event = {}) {
      if (this.previewing || this.returning) return
      const touch = this.getTouch(event)
      if (!touch || Number(touch.clientX) > EDGE_START_PX) return
      this.edgeGesture = {
        startX: Number(touch.clientX) || 0,
        startY: Number(touch.clientY) || 0,
        currentX: Number(touch.clientX) || 0,
        currentY: Number(touch.clientY) || 0,
        startedAt: Date.now()
      }
    },
    handleTouchMove(event = {}) {
      if (!this.edgeGesture || this.previewing) return
      const touch = this.getTouch(event)
      if (!touch) return
      this.edgeGesture.currentX = Number(touch.clientX) || this.edgeGesture.currentX
      this.edgeGesture.currentY = Number(touch.clientY) || this.edgeGesture.currentY
    },
    handleTouchEnd(event = {}) {
      if (!this.edgeGesture || this.previewing) return this.resetEdgeGesture()
      const touch = this.getTouch(event)
      if (touch) {
        this.edgeGesture.currentX = Number(touch.clientX) || this.edgeGesture.currentX
        this.edgeGesture.currentY = Number(touch.clientY) || this.edgeGesture.currentY
      }
      const gesture = this.edgeGesture
      this.edgeGesture = null
      const distanceX = gesture.currentX - gesture.startX
      const distanceY = Math.abs(gesture.currentY - gesture.startY)
      const duration = Math.max(1, Date.now() - gesture.startedAt)
      const velocity = distanceX / duration
      const horizontal = distanceX > 0 && distanceX > distanceY * 1.35
      if (horizontal && distanceX >= 48 && (distanceX >= SWIPE_DISTANCE_PX || velocity >= SWIPE_VELOCITY_PX_MS)) {
        this.backToWorks()
      }
    },
    resetEdgeGesture() {
      this.edgeGesture = null
    },
    previewWorkImages(payload = {}) {
      const urls = Array.isArray(payload.urls) ? payload.urls.filter(Boolean) : []
      if (!urls.length) return
      this.previewing = true
      uni.previewImage({
        current: payload.current || urls[0],
        urls,
        fail: () => { this.previewing = false }
      })
    },
    toggleFavorite(work = {}) {
      const next = setWorkFavorite(work.id, !work.isFavorite)
      if (!next) {
        uni.showToast({ title: '收藏状态保存失败', icon: 'none' })
        return
      }
      this.work = next
      uni.showToast({ title: next.isFavorite ? '已收藏' : '已取消收藏', icon: 'success' })
    },
    regenerate(work = {}) {
      if (!work.id || this.submitting) return
      this.submitting = true
      try {
        const task = regenerateWork(work.id)
        if (!task || !task.taskId) {
          uni.showToast({ title: '暂时无法重新生成', icon: 'none' })
          return
        }
        uni.showToast({ title: '已创建新的生成任务', icon: 'success' })
        uni.navigateTo({ url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}` })
      } finally {
        this.submitting = false
      }
    },
    continueWork(payload = {}) {
      const work = payload.work || {}
      if (!work.id || !work.taskId || !work.previewUrl) {
        uni.showToast({ title: '作品素材暂时不可用', icon: 'none' })
        return
      }
      markWorkUsed(work.id)
      const contextId = `${work.taskId}_${payload.action || 'continue'}_${Date.now()}`
      uni.setStorageSync(`${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`, {
        contextId,
        taskId: work.taskId,
        resultImage: work.coverUrl || work.previewUrl,
        sourceImage: work.coverUrl || work.previewUrl,
        toolType: payload.toolType || 'model',
        params: {
          ...(work.params || {}),
          continueFromTaskId: work.taskId,
          continueAction: payload.action || ''
        }
      })
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench?toolType=${encodeURIComponent(payload.toolType || 'model')}&continueContextId=${encodeURIComponent(contextId)}&continueAction=${encodeURIComponent(payload.action || '')}`
      })
    },
    prepareShare(work = {}) {
      this.work = work.id ? work : this.work
    },
    openProductionRecord(work = {}) {
      if (!work.taskId) {
        uni.showToast({ title: '关联生产记录暂不可查看', icon: 'none' })
        return
      }
      const query = [`taskId=${encodeURIComponent(work.taskId)}`]
      if (work.historyId) query.push(`historyId=${encodeURIComponent(work.historyId)}`)
      uni.navigateTo({
        url: `/package-assets/task-list/task-list?${query.join('&')}`,
        fail: () => uni.showToast({ title: '生产记录暂时无法打开', icon: 'none' })
      })
    },
    removeWorkReference(work = {}) {
      if (!work.id) return
      uni.showModal({
        title: '移出作品中心',
        content: work.projectId ? '该作品仍被项目引用，暂时不能删除。' : '作品将进入回收站，不会删除生成任务、生产记录或云端素材。',
        confirmText: work.projectId ? '知道了' : '移入回收站',
        confirmColor: '#dc2626',
        success: ({ confirm }) => {
          if (!confirm || work.projectId) return
          if (!removeWorkLocalReference(work.id)) {
            uni.showToast({ title: '暂时无法移出作品', icon: 'none' })
            return
          }
          uni.showToast({ title: '已移入回收站', icon: 'success' })
          this.backToWorks()
        }
      })
    },
    goToPackageCenter() {
      uni.navigateTo({ url: '/pages/package-center/package-center' })
    }
  }
}
</script>

<style scoped>
.work-detail-page {
  min-height: 100vh;
  background: #f6f7fb;
}
</style>
