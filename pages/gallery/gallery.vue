<template>
  <view class="works-page">
    <view class="works-header">
      <view>
        <text class="works-title">我的作品</text>
        <text class="works-subtitle">查看和管理已生成的图片、视频与设计素材</text>
      </view>
      <view class="works-count">
        <text class="count-value">{{ generatedCount }}</text>
        <text class="count-label">作品记录 / 件</text>
      </view>
    </view>

    <view class="quota-strip" :class="{ exhausted: membershipUsage.exhausted }">
      <text>剩余额度：{{ membershipRemainingLabel }}</text>
      <text v-if="membershipUsage.exhausted">升级会员获得更多生成次数</text>
      <button v-if="membershipUsage.exhausted" @click="goToPackageCenter">升级会员</button>
    </view>

    <view class="works-search">
      <input :value="keyword" placeholder="搜索作品名称或功能" confirm-type="search" @input="handleSearchInput" @confirm="refreshWorks" />
      <text v-if="keyword" @click="clearSearch">清除</text>
    </view>

    <text class="filter-label">任务状态</text>
    <scroll-view class="filter-scroll status-filter-scroll" scroll-x :show-scrollbar="false">
      <view class="filter-tabs">
        <view
          v-for="tab in statusTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeStatus === tab.value }"
          @click="changeStatus(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>
    </scroll-view>

    <template v-if="categoryTabs.length > 1">
      <text class="filter-label">作品类型</text>
      <scroll-view class="filter-scroll category-filter-scroll" scroll-x :show-scrollbar="false">
        <view class="filter-tabs">
          <view
            v-for="tab in categoryTabs"
            :key="tab.value"
            class="filter-tab category"
            :class="{ active: activeCategory === tab.value }"
            @click="changeCategory(tab.value)"
          >
            <text>{{ tab.label }}</text>
          </view>
        </view>
      </scroll-view>
    </template>

    <view v-if="identityLoading || (loading && !works.length)" class="loading-card">
      <text>正在加载作品...</text>
    </view>

    <view v-else-if="loadError" class="empty-card">
      <view class="empty-visual"><text>重试</text></view>
      <text class="empty-title">作品暂时无法获取</text>
      <text class="empty-desc">请检查当前状态后重新加载。</text>
      <button class="empty-btn" @click="refreshAccountWorks">重新加载</button>
    </view>

    <view v-else-if="!identityAvailable" class="empty-card">
      <view class="empty-visual"><text>身份</text></view>
      <text class="empty-title">登录后查看作品</text>
      <text class="empty-desc">当前未获取到有效微信身份，请重新同步后再试。</text>
      <button class="empty-btn" @click="refreshAccountWorks">重新同步</button>
    </view>

    <view v-else-if="!works.length" class="empty-card">
      <view class="empty-visual"><text>作品</text></view>
      <text class="empty-title">还没有服装素材</text>
      <text class="empty-desc">上传一件衣服，AI生成商品视觉资产。</text>
      <button class="empty-btn" @click="goToProductionGuide">立即生成</button>
    </view>

    <view v-else class="works-grid">
      <view v-for="work in works" :key="work.id" class="work-card" @click="openWork(work)">
        <view class="work-cover" :class="{ placeholder: !work.previewUrl || previewFailures[work.id] }">
          <video v-if="work.mediaType === 'video' && work.previewUrl && !previewFailures[work.id]" class="cover-image" :src="work.previewUrl" :controls="false" :show-center-play-btn="true" object-fit="cover" @error="handlePreviewError(work.id)"></video>
          <image v-else-if="work.previewUrl && !previewFailures[work.id]" class="cover-image" :src="work.previewUrl" mode="aspectFill" @error="handlePreviewError(work.id)"></image>
          <view v-else class="cover-placeholder">
            <text class="placeholder-mark">AI</text>
            <text>{{ work.status === 'result_missing' ? '结果缺失' : (work.status === 'generating' ? '生成中' : '暂无预览') }}</text>
          </view>
          <text v-if="work.hasValidResult" class="source-badge result-badge">生成结果</text>
          <text v-else-if="work.usesSourcePreview" class="source-badge">输入图</text>
          <text class="test-badge" :class="{ formal: work.resultBadge === '正式结果' }">{{ work.resultBadge }}</text>
          <text v-if="work.isFavorite" class="favorite-badge">已收藏</text>
          <text class="type-badge">{{ work.typeLabel }}</text>
          <button class="more-trigger" @click.stop="openWorkMenu(work)">•••</button>
        </view>

        <view class="work-content">
          <view class="work-heading">
            <text class="work-name">{{ work.title }}</text>
            <text class="status-badge" :class="`status-${work.status}`">{{ work.statusLabel }}</text>
          </view>
          <view v-if="['pending', 'uploading', 'generating', 'partial_success'].includes(work.status)" class="work-progress">
            <view><view :style="{ width: `${work.progress}%` }"></view></view>
            <text>{{ work.progress }}%</text>
          </view>
          <text v-if="work.status === 'result_missing'" class="plan-name result-missing-text">生成结果未保存，请检查或重试</text>
          <text v-else class="plan-name">已完成 {{ work.completedOutputCount }}/{{ work.expectedOutputCount }}<template v-if="work.failedOutputCount"> · 失败 {{ work.failedOutputCount }}</template></text>
          <text v-if="work.workType === 'detail_long_image' && work.templateName" class="plan-name">模板：{{ work.templateName }}</text>
          <text v-if="work.projectId" class="project-name">所属项目：{{ work.projectId }}</text>
          <view class="work-footer">
            <text class="work-time">{{ work.timeLabel }}</text>
            <text class="work-action">{{ getWorkActionLabel(work) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="works.length" class="load-state">
      <button v-if="hasMore" class="load-more" :loading="loadingMore" @click="loadMore">加载更多</button>
      <text v-else>已展示全部作品</text>
    </view>
  </view>
</template>

<script>
import {
  getMyWorks,
  getWorkDetail,
  markWorkUsed,
  regenerateWork,
  setWorkFavorite,
  markWorkRead,
  removeWorkLocalReference,
  restoreWorkLocalReference,
  markWorkResultUnavailable,
  WORK_PAGE_SIZE
} from '../../utils/work/workRepository'
import { getMembershipUsage } from '../../utils/member/membershipRepository'
import { getCurrentUser } from '../../utils/user/userRepository'

const STATUS_TABS = Object.freeze([
  { label: '全部', value: 'all' },
  { label: '生成中', value: 'generating' },
  { label: '待检查', value: 'needs_review' },
  { label: '结果缺失', value: 'result_missing' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '回收站', value: 'trash' }
])

const CONTINUE_CONTEXT_STORAGE_PREFIX = 'diebiandesign_continue_context_'
const GALLERY_FOCUS_STORAGE_KEY = 'diebiandesign_gallery_focus_v1'
const WORKS_LIST_STATE_KEY = 'diebiandesign_gallery_list_state_v1'

export default {
  data() {
    return {
      activeStatus: 'all',
      activeCategory: 'all',
      keyword: '',
      availableCategories: [],
      works: [],
      page: 1,
      pageSize: WORK_PAGE_SIZE,
      total: 0,
      generatedCount: 0,
      hasMore: false,
      loading: false,
      loadingMore: false,
      shareWork: null,
      previewFailures: {},
      previewRetryCounts: {},
      identityLoading: true,
      identityAvailable: false,
      accountWorksRefreshing: false,
      loadError: false,
      membershipUsage: {
        remaining: 0,
        exhausted: false
      },
      searchTimer: null,
      scrollTop: 0,
      restorePage: 1,
      restoreScrollTop: 0,
      restoringListState: false,
      workPollingTimer: null,
      workPollingInFlight: false,
      pageVisible: false
    }
  },
  computed: {
    statusTabs() {
      return STATUS_TABS
    },
    categoryTabs() {
      return [
        { label: '全部类型', value: 'all' },
        ...this.availableCategories.map((item) => ({ label: item.label, value: item.id }))
      ]
    },
    membershipRemainingLabel() {
      const value = Number(this.membershipUsage.remaining)
      return Number.isFinite(value) ? `${Math.max(0, value)} 次` : '暂时无法获取'
    }
  },
  onLoad() {
    this.restoreListState()
  },
  async onShow() {
    this.pageVisible = true
    await this.refreshAccountWorks()
    this.restoreListPosition()
    this.consumeGalleryFocus()
    this.scheduleWorkPolling()
  },
  onHide() {
    this.pageVisible = false
    this.stopWorkPolling()
  },
  onPullDownRefresh() {
    this.refreshAccountWorks().finally(() => uni.stopPullDownRefresh())
  },
  onReachBottom() {
    if (this.hasMore) this.loadMore()
  },
  onPageScroll(event = {}) {
    this.scrollTop = Math.max(0, Number(event.scrollTop) || 0)
  },
  onUnload() {
    this.pageVisible = false
    this.saveListState()
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.stopWorkPolling()
  },
  onShareAppMessage(event = {}) {
    const targetWorkId = event.target && event.target.dataset ? event.target.dataset.workId : ''
    const work = this.works.find((item) => item.id === targetWorkId) || this.shareWork
    const workId = work && work.id ? work.id : ''
    const taskId = work && work.taskId ? work.taskId : ''
    return {
      title: work ? `${work.typeLabel} · ${work.planName}` : '蝶变 AI 作品',
      path: workId || taskId
        ? `/pages/work-detail/work-detail?workId=${encodeURIComponent(workId)}&taskId=${encodeURIComponent(taskId)}`
        : '/pages/gallery/gallery',
      imageUrl: work && work.coverUrl ? work.coverUrl : ''
    }
  },
  methods: {
    consumeGalleryFocus() {
      let focus = null
      try {
        focus = uni.getStorageSync(GALLERY_FOCUS_STORAGE_KEY)
        uni.removeStorageSync(GALLERY_FOCUS_STORAGE_KEY)
      } catch (error) {
        focus = null
      }
      if (!focus || !focus.workId) return
      const detail = getWorkDetail(focus.workId)
      if (!detail || !detail.id) {
        uni.showToast({ title: '关联作品暂时不可预览', icon: 'none' })
        return
      }
      this.openWork(detail)
    },
    restoreListState() {
      let state = null
      try {
        state = uni.getStorageSync(WORKS_LIST_STATE_KEY)
      } catch (error) {
        state = null
      }
      if (!state || typeof state !== 'object') return
      this.activeStatus = String(state.activeStatus || 'all')
      this.activeCategory = String(state.activeCategory || 'all')
      this.keyword = String(state.keyword || '')
      this.restorePage = Math.max(1, Number(state.page) || 1)
      this.restoreScrollTop = Math.max(0, Number(state.scrollTop) || 0)
    },
    saveListState() {
      this.restorePage = Math.max(1, Number(this.page) || 1)
      this.restoreScrollTop = Math.max(0, Number(this.scrollTop) || 0)
      try {
        uni.setStorageSync(WORKS_LIST_STATE_KEY, {
          activeStatus: this.activeStatus,
          activeCategory: this.activeCategory,
          keyword: this.keyword,
          sort: 'updated_desc',
          page: this.page,
          scrollTop: this.scrollTop,
          updatedAt: Date.now()
        })
      } catch (error) {}
    },
    restoreListPosition() {
      if (this.restoringListState) return
      this.restoringListState = true
      while (this.page < this.restorePage && this.hasMore) this.loadMore()
      const target = this.restoreScrollTop
      this.$nextTick(() => {
        if (target > 0 && typeof uni.pageScrollTo === 'function') {
          uni.pageScrollTo({ scrollTop: target, duration: 0 })
        }
        this.restoringListState = false
      })
    },
    async refreshAccountWorks() {
      if (this.accountWorksRefreshing) return
      this.accountWorksRefreshing = true
      this.identityLoading = true
      this.loadError = false
      try {
        const user = getCurrentUser()
        const openId = String(user && user.openId || '').trim()
        this.identityAvailable = Boolean(openId && !openId.startsWith('mock_'))
        if (!this.identityAvailable) {
          this.works = []
          this.total = 0
          this.generatedCount = 0
          this.membershipUsage = { remaining: NaN, exhausted: false }
          return
        }
        this.loadMembershipUsage()
        await this.refreshWorks()
      } catch (error) {
        this.loadError = true
      } finally {
        this.identityLoading = false
        this.accountWorksRefreshing = false
      }
    },
    loadMembershipUsage() {
      const result = getMembershipUsage()
      this.membershipUsage = result && result.ok && result.data
        ? result.data
        : { remaining: NaN, exhausted: false }
    },
    async refreshWorks(options = {}) {
      const silent = options && options.silent === true
      if (!silent) this.loading = true
      this.loadError = false
      try {
        this.page = 1
        const result = getMyWorks({
          page: 1,
          pageSize: this.pageSize,
          type: 'all',
          status: this.activeStatus,
          category: this.activeCategory,
          keyword: this.keyword
        })
        this.applyPage(result, false)
        await this.resolveCloudPreviewUrls()
      } catch (error) {
        this.loadError = true
      } finally {
        if (!silent) this.loading = false
      }
    },
    hasRunningWorks() {
      return this.works.some((work) => ['pending', 'uploading', 'generating', 'partial_success'].includes(work.status))
    },
    scheduleWorkPolling() {
      this.stopWorkPolling()
      if (!this.pageVisible || !this.hasRunningWorks()) return
      this.workPollingTimer = setTimeout(async () => {
        if (this.workPollingInFlight) return
        this.workPollingInFlight = true
        try {
          await this.refreshWorks({ silent: true })
        } finally {
          this.workPollingInFlight = false
          this.scheduleWorkPolling()
        }
      }, 3000)
    },
    stopWorkPolling() {
      if (this.workPollingTimer) clearTimeout(this.workPollingTimer)
      this.workPollingTimer = null
    },
    async resolveCloudPreviewUrls() {
      if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return
      const fileIds = Array.from(new Set(this.works
        .map((work) => work.coverFileId || (/^cloud:\/\//.test(work.previewUrl || '') ? work.previewUrl : ''))
        .filter((value) => /^cloud:\/\//.test(value))))
      if (!fileIds.length) return
      const response = await new Promise((resolve) => {
        wx.cloud.getTempFileURL({ fileList: fileIds, success: resolve, fail: () => resolve({ fileList: [] }) })
      })
      const urlByFileId = Object.fromEntries((response.fileList || [])
        .filter((item) => item && Number(item.status) === 0 && item.tempFileURL)
        .map((item) => [item.fileID || item.fileId, item.tempFileURL]))
      this.works = this.works.map((work) => {
        const fileId = work.coverFileId || (/^cloud:\/\//.test(work.previewUrl || '') ? work.previewUrl : '')
        if (!fileId || !urlByFileId[fileId]) return work
        return { ...work, previewUrl: urlByFileId[fileId], coverUrl: fileId }
      })
    },
    applyPage(result = {}, append = false) {
      const nextItems = Array.isArray(result.items) ? result.items : []
      const merged = append ? [...this.works, ...nextItems] : nextItems
      const seen = new Set()
      this.works = merged.filter((work) => {
        if (!work || !work.id || seen.has(work.id)) return false
        seen.add(work.id)
        return true
      })
      this.page = Number(result.page) || 1
      this.total = Number(result.total) || 0
      this.generatedCount = Number(result.generatedCount) || 0
      this.availableCategories = Array.isArray(result.availableCategories) ? result.availableCategories : []
      this.hasMore = result.hasMore === true
      if (!append) this.notifyUnreadWorks()
    },
    notifyUnreadWorks() {
      const unread = this.works.filter((work) => work.isUnread)
      if (!unread.length) return
      const failedCount = unread.filter((work) => work.status === 'failed').length
      const title = failedCount > 0
        ? `${failedCount} 个任务需要处理`
        : unread.length > 1 ? `${unread.length} 个作品已生成` : '作品已生成'
      uni.showToast({ title, icon: 'none' })
      unread.forEach((work) => markWorkRead(work.id))
      this.works = this.works.map((work) => unread.some((item) => item.id === work.id) ? { ...work, isUnread: false } : work)
    },
    changeStatus(status = 'all') {
      if (this.activeStatus === status) return
      this.activeStatus = status
      this.page = 1
      this.restorePage = 1
      this.scrollTop = 0
      this.restoreScrollTop = 0
      this.saveListState()
      this.refreshWorks()
    },
    changeCategory(category = 'all') {
      if (this.activeCategory === category) return
      this.activeCategory = category
      this.page = 1
      this.restorePage = 1
      this.scrollTop = 0
      this.restoreScrollTop = 0
      this.saveListState()
      this.refreshWorks()
    },
    handleSearchInput(event = {}) {
      this.keyword = String(event.detail && event.detail.value || '')
      this.page = 1
      this.restorePage = 1
      this.scrollTop = 0
      this.restoreScrollTop = 0
      this.saveListState()
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.refreshWorks(), 280)
    },
    clearSearch() {
      this.keyword = ''
      this.page = 1
      this.restorePage = 1
      this.scrollTop = 0
      this.restoreScrollTop = 0
      this.saveListState()
      this.refreshWorks()
    },
    loadMore() {
      if (!this.hasMore || this.loadingMore) return
      this.loadingMore = true
      try {
        const nextPage = this.page + 1
        const result = getMyWorks({
          page: nextPage,
          pageSize: this.pageSize,
          type: 'all',
          status: this.activeStatus,
          category: this.activeCategory,
          keyword: this.keyword
        })
        this.applyPage(result, true)
      } finally {
        this.loadingMore = false
      }
    },
    openWork(work = {}) {
      if (!work.id) return
      if (work.deletedAt) {
        uni.showToast({ title: '请先恢复该作品', icon: 'none' })
        return
      }
      if (work.status === 'result_missing' || !work.hasValidResult && ['completed', 'needs_review'].includes(work.status)) {
        this.openProductionRecord(work)
        return
      }
      const detail = markWorkUsed(work.id) || getWorkDetail(work.id)
      if (!detail) {
        uni.showToast({ title: '作品详情暂时不可用', icon: 'none' })
        return
      }
      this.shareWork = detail
      this.saveListState()
      uni.navigateTo({
        url: `/pages/work-detail/work-detail?workId=${encodeURIComponent(detail.id)}&taskId=${encodeURIComponent(detail.taskId || '')}`,
        fail: () => uni.showToast({ title: '作品详情暂时无法打开', icon: 'none' })
      })
    },
    regenerate(work = {}) {
      if (!work.id || this.loading) return
      this.loading = true
      try {
        const task = regenerateWork(work.id)
        if (!task || !task.taskId) {
          uni.showToast({ title: '暂时无法重新生成', icon: 'none' })
          return
        }
        uni.showToast({ title: '已创建新的生成任务', icon: 'success' })
        this.refreshWorks()
      } finally {
        this.loading = false
      }
    },
    toggleFavorite(work = {}) {
      if (!work.id) return
      const next = setWorkFavorite(work.id, !work.isFavorite)
      if (!next) {
        uni.showToast({ title: '收藏状态保存失败', icon: 'none' })
        return
      }
      this.shareWork = next
      this.works = this.works.map((item) => item.id === next.id ? next : item)
      uni.showToast({ title: next.isFavorite ? '已收藏' : '已取消收藏', icon: 'success' })
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
      this.shareWork = work
    },
    openWorkMenu(work = {}) {
      if (!work.id) return
      if (work.deletedAt) {
        uni.showActionSheet({
          itemList: ['恢复作品'],
          success: () => this.restoreWorkReference(work)
        })
        return
      }
      const actions = [{ label: work.isFavorite ? '取消收藏' : '收藏', action: 'favorite' }]
      if (work.previewUrl && ['completed', 'needs_review', 'partial_success'].includes(work.status)) {
        actions.push({ label: work.mediaType === 'video' ? '保存视频到相册' : '保存图片到相册', action: 'download' })
      }
      actions.push({ label: '查看生产记录', action: 'production' })
      if (work.status === 'failed' && work.canRetry && !(work.childTaskIds || []).length) {
        actions.push({ label: '重新生成', action: 'retry' })
      }
      if (!['pending', 'uploading', 'generating'].includes(work.status)) actions.push({ label: '移入回收站', action: 'remove' })
      uni.showActionSheet({
        itemList: actions.map((item) => item.label),
        success: ({ tapIndex }) => {
          const selected = actions[tapIndex]
          if (!selected) return
          if (selected.action === 'favorite') this.toggleFavorite(work)
          if (selected.action === 'download') this.downloadWork(work)
          if (selected.action === 'production') this.openProductionRecord(work)
          if (selected.action === 'retry') this.regenerate(work)
          if (selected.action === 'remove') this.removeWorkReference(work)
        }
      })
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
          this.refreshWorks()
          uni.showToast({ title: '已移入回收站', icon: 'success' })
        }
      })
    },
    restoreWorkReference(work = {}) {
      if (!work.id || !restoreWorkLocalReference(work.id)) {
        uni.showToast({ title: '作品恢复失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '作品已恢复', icon: 'success' })
      this.refreshWorks()
    },
    getWorkActionLabel(work = {}) {
      if (work.deletedAt) return '恢复'
      if (work.status === 'failed') return work.canRetry ? '查看并重试 ›' : '查看原因 ›'
      if (work.status === 'result_missing' || !work.hasValidResult && ['completed', 'needs_review'].includes(work.status)) return '查看任务 ›'
      if (['completed', 'needs_review'].includes(work.status)) return '查看作品 ›'
      if (work.status === 'partial_success') return '查看结果 ›'
      return '查看进度 ›'
    },
    async handlePreviewError(workId = '') {
      if (!workId) return
      const work = this.works.find((item) => item.id === workId)
      const fileId = work && work.coverFileId
      const retryCount = Number(this.previewRetryCounts[workId]) || 0
      if (fileId && /^cloud:\/\//.test(fileId) && retryCount < 1 && typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.getTempFileURL === 'function') {
        this.previewRetryCounts = { ...this.previewRetryCounts, [workId]: retryCount + 1 }
        const response = await new Promise((resolve) => {
          wx.cloud.getTempFileURL({ fileList: [fileId], success: resolve, fail: () => resolve({ fileList: [] }) })
        })
        const item = (response.fileList || [])[0]
        if (item && Number(item.status) === 0 && item.tempFileURL) {
          this.works = this.works.map((entry) => entry.id === workId ? { ...entry, previewUrl: `${item.tempFileURL}${item.tempFileURL.includes('?') ? '&' : '?'}refresh=${Date.now()}` } : entry)
          this.previewFailures = { ...this.previewFailures, [workId]: false }
          return
        }
      }
      if (work && /^https:\/\//.test(work.previewUrl || '') && retryCount < 1) {
        this.previewRetryCounts = { ...this.previewRetryCounts, [workId]: retryCount + 1 }
        const separator = work.previewUrl.includes('?') ? '&' : '?'
        this.works = this.works.map((entry) => entry.id === workId ? { ...entry, previewUrl: `${work.previewUrl}${separator}refresh=${Date.now()}` } : entry)
        return
      }
      this.previewFailures = { ...this.previewFailures, [workId]: true }
      if (work && work.taskId && ['completed', 'needs_review'].includes(work.status)) {
        markWorkResultUnavailable(work.taskId, '生成结果文件暂时无法访问')
        this.works = this.works.map((entry) => entry.id === workId
          ? { ...entry, status: 'result_missing', statusLabel: '结果缺失', statusText: '生成结果未保存，请检查或重试', hasValidResult: false }
          : entry)
      }
    },
    downloadWork(work = {}) {
      const url = work.coverUrl || ''
      if (!url) {
        uni.showToast({ title: '暂无可下载图片', icon: 'none' })
        return
      }
      if (/^cloud:\/\//.test(url) && typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.downloadFile === 'function') {
        wx.cloud.downloadFile({
          fileID: url,
          success: (result) => this.saveToAlbum(result.tempFilePath, work.mediaType),
          fail: () => uni.showToast({ title: '下载失败', icon: 'none' })
        })
        return
      }
      if (/^https?:\/\//.test(url)) {
        uni.downloadFile({
          url,
          success: (result) => {
            if (result.statusCode === 200) this.saveToAlbum(result.tempFilePath, work.mediaType)
            else uni.showToast({ title: '下载失败', icon: 'none' })
          },
          fail: () => uni.showToast({ title: '下载失败', icon: 'none' })
        })
        return
      }
      this.saveToAlbum(url, work.mediaType)
    },
    saveToAlbum(filePath = '', mediaType = 'image') {
      if (!filePath) return
      const saver = mediaType === 'video' ? uni.saveVideoToPhotosAlbum : uni.saveImageToPhotosAlbum
      if (typeof saver !== 'function') {
        uni.showToast({ title: '当前环境暂不支持保存该素材', icon: 'none' })
        return
      }
      saver.call(uni, {
        filePath,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: (error = {}) => this.handleAlbumSaveFailure(error)
      })
    },
    handleAlbumSaveFailure(error = {}) {
      const message = String(error.errMsg || error.message || '')
      if (/auth|authorize|permission|deny/i.test(message) && typeof uni.openSetting === 'function') {
        uni.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片，开启后可再次点击下载。',
          confirmText: '去设置',
          success: (result) => {
            if (result.confirm) uni.openSetting()
          }
        })
        return
      }
      uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    },
    goToProductionGuide() {
      uni.navigateTo({ url: '/package-ai/production-guide/production-guide' })
    },
    goToPackageCenter() {
      uni.navigateTo({ url: '/pages/package-center/package-center' })
    }
  }
}
</script>

<style scoped>
.works-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 64rpx;
  box-sizing: border-box;
  background: #f6f7fb;
  color: #111827;
}

.works-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx;
  border-radius: 32rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f4f5ff 100%);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.07);
}

.works-title,
.works-subtitle,
.count-value,
.count-label,
.work-name,
.plan-name,
.work-time,
.empty-title,
.empty-desc {
  display: block;
}

.works-title { font-size: 38rpx; font-weight: 800; }
.works-subtitle { margin-top: 8rpx; color: #6b7280; font-size: 23rpx; line-height: 1.5; }
.works-count { flex: 0 0 auto; min-width: 142rpx; padding: 16rpx; border-radius: 22rpx; background: rgba(79, 70, 229, 0.08); text-align: center; }
.count-value { color: #4f46e5; font-size: 40rpx; font-weight: 800; }
.count-label { margin-top: 2rpx; color: #6b7280; font-size: 19rpx; }

.works-search { display: flex; align-items: center; gap: 14rpx; margin-top: 20rpx; padding: 0 18rpx; min-height: 76rpx; border: 1rpx solid #e5e7eb; border-radius: 18rpx; background: #ffffff; box-sizing: border-box; }
.works-search input { min-width: 0; flex: 1; height: 72rpx; color: #111827; font-size: 24rpx; }
.works-search text { flex-shrink: 0; color: #4f46e5; font-size: 22rpx; font-weight: 700; }
.filter-label { display: block; margin-top: 20rpx; color: #374151; font-size: 23rpx; font-weight: 700; }
.filter-scroll { width: 100%; margin: 10rpx 0 0; white-space: nowrap; }
.category-filter-scroll { margin-bottom: 22rpx; }
.filter-tabs { display: inline-flex; gap: 12rpx; padding-right: 24rpx; }
.filter-tab { padding: 13rpx 22rpx; border: 1rpx solid #e5e7eb; border-radius: 999rpx; background: #ffffff; color: #6b7280; font-size: 23rpx; }
.filter-tab.active { border-color: #4f46e5; background: #4f46e5; color: #ffffff; font-weight: 700; }
.filter-tab.category.active { border-color: #c7d2fe; background: #eef2ff; color: #4338ca; }

.quota-strip { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 18rpx; padding: 16rpx 18rpx; border: 1rpx solid rgba(79, 70, 229, 0.12); border-radius: 18rpx; background: #ffffff; color: #4b5563; font-size: 21rpx; }
.quota-strip.exhausted { flex-wrap: wrap; border-color: rgba(234, 88, 12, 0.2); background: #fff7ed; color: #c2410c; }
.quota-strip button { width: 138rpx; height: 56rpx; line-height: 56rpx; margin: 0; padding: 0; border-radius: 14rpx; background: #4f46e5; color: #ffffff; font-size: 20rpx; }
.quota-strip button::after { border: 0; }
.works-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20rpx; }
.work-card { overflow: hidden; border-radius: 28rpx; background: #ffffff; box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.07); transition: transform 0.16s ease, box-shadow 0.16s ease; }
.work-card:active { transform: scale(0.985); box-shadow: 0 16rpx 36rpx rgba(15, 23, 42, 0.11); }
.work-cover { position: relative; width: 100%; height: 290rpx; background: #eef1f7; }
.cover-image { width: 100%; height: 100%; }
.cover-placeholder { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; flex-direction: column; gap: 12rpx; color: #7c8494; font-size: 23rpx; background: linear-gradient(145deg, #f5f7ff, #edf1f8); }
.placeholder-mark { display: flex; align-items: center; justify-content: center; width: 70rpx; height: 70rpx; border-radius: 22rpx; background: #ffffff; color: #4f46e5; font-weight: 800; box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.1); }
.type-badge,
.source-badge,
.favorite-badge,
.test-badge { position: absolute; top: 14rpx; padding: 7rpx 12rpx; border-radius: 999rpx; font-size: 19rpx; line-height: 1; }
.type-badge { left: 14rpx; background: rgba(17, 24, 39, 0.72); color: #ffffff; }
.source-badge { left: 14rpx; bottom: 14rpx; top: auto; background: rgba(255, 255, 255, 0.9); color: #4f46e5; }
.source-badge.result-badge { background: rgba(236, 253, 245, 0.94); color: #047857; }
.test-badge { right: 14rpx; bottom: 14rpx; top: auto; background: #fff7ed; color: #c2410c; }
.test-badge.formal { background: rgba(236, 253, 245, 0.94); color: #047857; }
.favorite-badge { right: 14rpx; bottom: 48rpx; top: auto; background: rgba(255, 247, 237, 0.94); color: #c2410c; }
.more-trigger { position: absolute; top: 10rpx; right: 10rpx; z-index: 2; width: 58rpx; height: 48rpx; margin: 0; padding: 0; border-radius: 16rpx; background: rgba(255, 255, 255, 0.92); color: #374151; font-size: 24rpx; line-height: 42rpx; }
.more-trigger::after { border: 0; }

.work-content { padding: 18rpx 16rpx 16rpx; }
.work-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8rpx; }
.work-name { display: -webkit-box; min-width: 0; color: #111827; font-size: 27rpx; font-weight: 800; overflow: hidden; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.status-badge { display: inline-flex; align-items: center; gap: 5rpx; flex: 0 0 auto; padding: 6rpx 9rpx; border-radius: 999rpx; font-size: 18rpx; white-space: nowrap; }
.status-completed { background: #eaf8ef; color: #198754; }
.status-pending, .status-uploading, .status-generating { background: #eaf2ff; color: #2563eb; }
.status-partial_success, .status-needs_review { background: #fff7ed; color: #c2410c; }
.status-result_missing { background: #fff1f2; color: #be123c; }
.status-failed { background: #fff0f0; color: #dc2626; }
.status-cancelled, .status-archived { background: #f3f4f6; color: #6b7280; }
.status-dot { width: 8rpx; height: 8rpx; border-radius: 50%; background: currentColor; animation: pulse 1.15s ease-in-out infinite; }
.work-progress { display: flex; align-items: center; gap: 10rpx; margin-top: 12rpx; color: #64748b; font-size: 19rpx; }
.work-progress > view { flex: 1; height: 8rpx; overflow: hidden; border-radius: 999rpx; background: #e5e7eb; }
.work-progress > view > view { height: 100%; border-radius: inherit; background: #4f46e5; }
.plan-name { margin-top: 11rpx; color: #4b5563; font-size: 22rpx; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-missing-text { color: #be123c; white-space: normal; }
.project-name { display: block; margin-top: 7rpx; overflow: hidden; color: #6b7280; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.work-footer { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; margin-top: 10rpx; }
.work-time { color: #9ca3af; font-size: 20rpx; }
.work-action { color: #4f46e5; font-size: 20rpx; font-weight: 700; }
.empty-card,
.loading-card { margin-top: 70rpx; padding: 54rpx 34rpx; border-radius: 28rpx; background: #ffffff; text-align: center; box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06); }
.empty-visual { display: flex; align-items: center; justify-content: center; width: 112rpx; height: 112rpx; margin: 0 auto 24rpx; border-radius: 34rpx; background: linear-gradient(145deg, #eef0ff, #f7f8fc); color: #4f46e5; font-size: 25rpx; font-weight: 800; }
.empty-title { font-size: 32rpx; font-weight: 800; }
.empty-desc { margin: 12rpx auto 0; max-width: 510rpx; color: #6b7280; font-size: 24rpx; line-height: 1.6; }
.empty-btn { width: 330rpx; height: 76rpx; margin-top: 28rpx; border-radius: 18rpx; background: #4f46e5; color: #ffffff; font-size: 25rpx; line-height: 76rpx; }
.empty-btn::after { border: 0; }
.loading-card { color: #6b7280; font-size: 24rpx; }
.load-state { padding: 28rpx 0 0; color: #9ca3af; font-size: 22rpx; text-align: center; }
.load-more { width: 240rpx; height: 64rpx; border: 1rpx solid #e5e7eb; border-radius: 16rpx; background: #ffffff; color: #4f46e5; font-size: 23rpx; line-height: 62rpx; }
.load-more::after { border: 0; }

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}
</style>
