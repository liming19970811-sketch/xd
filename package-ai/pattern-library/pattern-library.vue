<template>
  <view class="library-page">
    <view class="library-head">
      <text class="page-title">版型库</text>
      <text class="page-subtitle">管理、复用和派生服装版型</text>
      <view class="training-entry" @click="openTrainingCenter"><view><text>AI制版训练数据</text><text>批准版型、人工修订差异与真实评测记录</text></view><text>进入 ></text></view>
      <view class="sample-entry" @click="openSampleOrders"><view><text>样衣打样与修改</text><text>查看接单、打样、验收和修改轮次</text></view><text>进入 ></text></view>
      <view class="review-entry" @click="openReviewQueue"><view><text>打版师复核工作台</text><text>云端身份校验 · 待复核队列</text></view><text>进入 ></text></view>
      <view class="search-box"><text>搜</text><input v-model="searchInput" maxlength="40" confirm-type="search" placeholder="搜索名称、编号或标签" @input="scheduleSearch" @confirm="applySearch" /><text v-if="searchInput" class="clear-search" @click="clearSearch">清除</text></view>
    </view>

    <scroll-view v-if="scopes.length > 1" class="scope-scroll" scroll-x :show-scrollbar="false">
      <view class="scope-row"><text v-for="item in scopes" :key="item.value" class="scope-item" :class="{ active: scope === item.value }" @click="changeScope(item.value)">{{ item.label }}</text></view>
    </scroll-view>

    <view class="filter-row">
      <picker :range="categoryOptions" range-key="label" :value="categoryIndex" @change="changeCategory"><view class="filter-control">{{ categoryOptions[categoryIndex].label }}⌄</view></picker>
      <picker :range="statusOptions" range-key="label" :value="statusIndex" @change="changeStatus"><view class="filter-control">{{ statusOptions[statusIndex].label }}⌄</view></picker>
      <picker :range="sortOptions" range-key="label" :value="sortIndex" @change="changeSort"><view class="filter-control">{{ sortOptions[sortIndex].label }}⌄</view></picker>
    </view>

    <view class="smart-filter-card">
      <view class="smart-filter-head" @click="filterExpanded = !filterExpanded"><view><text>智能检索条件</text><text>按结构、尺码、面料和使用场景推荐相近基础版型</text></view><text>{{ filterExpanded ? '收起' : '展开' }} ></text></view>
      <view v-if="filterExpanded" class="smart-filter-grid">
        <picker v-for="field in filterFields" :key="field.key" :range="field.options" range-key="label" :value="filterIndex(field)" @change="changeSmartFilter(field.key, $event)"><view class="filter-control">{{ filterLabel(field) }}⌄</view></picker>
        <input v-model="tagInput" class="tag-input" maxlength="80" placeholder="标签，如：通勤 轻薄" @confirm="applySmartFilters" />
        <button class="apply-filter" @click="applySmartFilters">查找相近版型</button>
      </view>
    </view>

    <view class="result-summary"><text>{{ loading ? '正在读取版型…' : `共 ${total} 个版型` }}</text><text>仅显示当前身份可访问数据</text></view>

    <view v-if="loading && !items.length" class="state-card"><text>加载中...</text></view>
    <view v-else-if="errorMessage" class="state-card error"><text>{{ errorMessage }}</text><button @click="reload">重新加载</button></view>
    <view v-else-if="!items.length" class="state-card empty"><text class="state-title">暂无符合条件的版型</text><text>完成打版结构图后，可保存到这里继续复用。</text><button @click="goCreate">生成打版结构图</button></view>

    <view v-else class="pattern-list">
      <view v-for="item in items" :key="item.patternId" class="pattern-card" @click="openDetail(item)">
        <view class="cover-wrap"><image v-if="item.coverUrl && !coverErrors[item.patternId]" :src="item.coverUrl" mode="aspectFit" @error="markCoverError(item.patternId)" /><view v-else class="cover-placeholder"><text>版型</text><text>暂无结构图封面</text></view></view>
        <view class="card-body">
          <view class="card-title-row"><text class="card-title">{{ item.title }}</text><text class="status-pill" :class="`status-${item.status}`">{{ item.statusLabel }}</text></view>
          <text class="card-meta">{{ item.categoryLabel }} · {{ item.currentVersion }} · 基础尺码 {{ item.baseSize }}</text>
          <view v-if="item.tags.length" class="tag-row"><text v-for="tag in item.tags" :key="tag">{{ tag }}</text></view>
          <view v-if="item.matchReasons && item.matchReasons.length" class="match-box"><text class="match-score">匹配 {{ item.matchScore }} 分</text><text>{{ item.matchReasons.join(' · ') }}</text></view>
          <text v-if="item.differences && item.differences.length" class="difference-line">主要差异：{{ differenceText(item) }}</text>
          <text v-if="item.qualityNotice" class="quality-notice">{{ item.qualityNotice }}</text>
          <text class="updated-time">更新于 {{ formatDate(item.updatedAt) }}</text>
          <view class="card-actions"><text @click.stop="openDetail(item)">查看详情</text><text v-if="item.canDerive !== false" @click.stop="deriveItem(item)">派生新款</text><text @click.stop="openVersions(item)">查看版本</text></view>
        </view>
      </view>
    </view>

    <button v-if="hasMore" class="load-more" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? '加载中...' : '加载更多' }}</button>
    <text v-else-if="items.length" class="list-end">已显示全部版型</text>
    <view class="safe-space"></view>
  </view>
</template>

<script>
import {
  PATTERN_CATEGORY_OPTIONS,
  PATTERN_QUALITY_STATUS_OPTIONS,
  PATTERN_SEARCH_FILTERS,
  PATTERN_SEARCH_SORT_OPTIONS,
  PATTERN_SORT_OPTIONS,
  PATTERN_STATUS_OPTIONS,
  deriveApprovedPatternLibraryItem,
  derivePatternLibraryItem,
  getPatternLibraryScopes,
  queryPatternLibrary,
  searchApprovedPatternLibrary,
  shouldUseCloudPatternLibrary
} from '../../utils/pattern/patternLibraryRepository.js'

export default {
  data() {
    return {
      scopes: [], scope: 'personal', categoryOptions: PATTERN_CATEGORY_OPTIONS, statusOptions: PATTERN_STATUS_OPTIONS, sortOptions: PATTERN_SORT_OPTIONS,
      category: 'all', status: 'all', sort: 'updated_desc', searchInput: '', keyword: '', page: 1, items: [], total: 0, hasMore: false,
      loading: false, loadingMore: false, errorMessage: '', navigationLocked: false, coverErrors: {}, filterExpanded: false, tagInput: '', cloudMode: false,
      smartFilters: { audience: '', season: '', style: '', fitType: '', neckType: '', sleeveType: '', lengthType: '', baseSize: '', materialType: '', elasticity: '', thickness: '', usageScene: '' },
      filterFields: [
        { key: 'audience', options: PATTERN_SEARCH_FILTERS.audience }, { key: 'season', options: PATTERN_SEARCH_FILTERS.season },
        { key: 'style', options: PATTERN_SEARCH_FILTERS.style }, { key: 'fitType', options: PATTERN_SEARCH_FILTERS.fitType },
        { key: 'neckType', options: PATTERN_SEARCH_FILTERS.neckType }, { key: 'sleeveType', options: PATTERN_SEARCH_FILTERS.sleeveType },
        { key: 'lengthType', options: PATTERN_SEARCH_FILTERS.lengthType }, { key: 'baseSize', options: PATTERN_SEARCH_FILTERS.baseSize },
        { key: 'materialType', options: PATTERN_SEARCH_FILTERS.materialType }, { key: 'elasticity', options: PATTERN_SEARCH_FILTERS.elasticity },
        { key: 'thickness', options: PATTERN_SEARCH_FILTERS.thickness }, { key: 'usageScene', options: PATTERN_SEARCH_FILTERS.usageScene }
      ]
    }
  },
  computed: {
    categoryIndex() { return Math.max(0, this.categoryOptions.findIndex((item) => item.value === this.category)) },
    statusIndex() { return Math.max(0, this.statusOptions.findIndex((item) => item.value === this.status)) },
    sortIndex() { return Math.max(0, this.sortOptions.findIndex((item) => item.value === this.sort)) }
  },
  onLoad(options = {}) {
    this.source = String(options.source || '')
    this.cloudMode = shouldUseCloudPatternLibrary()
    if (this.cloudMode) { this.statusOptions = PATTERN_QUALITY_STATUS_OPTIONS; this.sortOptions = PATTERN_SEARCH_SORT_OPTIONS; this.sort = 'match_desc' }
    this.scopes = this.cloudMode ? [{ value: 'personal', label: '我的已批准版型' }, { value: 'enterprise', label: '企业已批准版型' }] : getPatternLibraryScopes()
    if (this.scopes.length && !this.scopes.some((item) => item.value === this.scope)) this.scope = this.scopes[0].value
    this.reload()
  },
  onShow() {
    if (this._loadedOnce) this.reload()
    this._loadedOnce = true
  },
  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    if (this._navTimer) clearTimeout(this._navTimer)
  },
  methods: {
    query(page = 1) {
      const options = { scope: this.scope, keyword: this.keyword, category: this.category, garmentCategory: this.category === 'all' ? '' : this.category, status: this.status, sort: this.sort, page, tags: this.tagInput, ...this.smartFilters }
      return this.cloudMode ? searchApprovedPatternLibrary(options) : queryPatternLibrary(options)
    },
    async reload() {
      if (this.loading) return
      this.loading = true; this.errorMessage = ''; this.page = 1
      try {
        if (!this.cloudMode) this.scopes = getPatternLibraryScopes()
        const result = await this.query(1)
        if (!result.ok) throw new Error(result.message || '版型库加载失败')
        this.items = result.items; this.total = result.total; this.hasMore = result.hasMore
        if (Array.isArray(result.scopes) && result.scopes.length) this.scopes = result.scopes
      } catch (error) {
        this.items = []; this.total = 0; this.hasMore = false; this.errorMessage = error.message || '版型库暂时无法加载'
      } finally { this.loading = false }
    },
    async loadMore() {
      if (!this.hasMore || this.loadingMore) return
      this.loadingMore = true
      try {
        const nextPage = this.page + 1; const result = await this.query(nextPage)
        if (!result.ok) throw new Error(result.message || '加载失败')
        const known = new Set(this.items.map((item) => item.patternId))
        this.items = [...this.items, ...result.items.filter((item) => !known.has(item.patternId))]
        this.page = nextPage; this.total = result.total; this.hasMore = result.hasMore
      } catch (error) { uni.showToast({ title: error.message || '加载失败，请重试', icon: 'none' }) } finally { this.loadingMore = false }
    },
    scheduleSearch() { if (this._searchTimer) clearTimeout(this._searchTimer); this._searchTimer = setTimeout(() => this.applySearch(), 350) },
    applySearch() { const next = String(this.searchInput || '').trim(); if (next === this.keyword) return; this.keyword = next; this.reload() },
    clearSearch() { this.searchInput = ''; if (this.keyword) { this.keyword = ''; this.reload() } },
    changeScope(value) { if (value === this.scope) return; this.scope = value; this.reload() },
    changeCategory(event) { this.category = this.categoryOptions[Number(event.detail.value) || 0].value; this.reload() },
    changeStatus(event) { this.status = this.statusOptions[Number(event.detail.value) || 0].value; this.reload() },
    changeSort(event) { this.sort = this.sortOptions[Number(event.detail.value) || 0].value; this.reload() },
    filterIndex(field) { return Math.max(0, field.options.findIndex((item) => item.value === this.smartFilters[field.key])) },
    filterLabel(field) { const item = field.options[this.filterIndex(field)]; return item ? item.label : '全部' },
    changeSmartFilter(key, event) { const field = this.filterFields.find((item) => item.key === key); if (!field) return; const option = field.options[Number(event.detail.value) || 0]; this.smartFilters = { ...this.smartFilters, [key]: option ? option.value : '' } },
    applySmartFilters() { this.reload() },
    navigate(url = '') { if (!url || this.navigationLocked) return; this.navigationLocked = true; uni.navigateTo({ url, fail: () => uni.showToast({ title: '页面暂时无法打开', icon: 'none' }), complete: () => { this._navTimer = setTimeout(() => { this.navigationLocked = false }, 600) } }) },
    openDetail(item) { this.navigate(`/package-ai/pattern-detail/pattern-detail?patternId=${encodeURIComponent(item.patternId)}${item.sourceMode === 'cloud' ? '&cloud=1' : ''}`) },
    openVersions(item) { this.navigate(`/package-ai/pattern-detail/pattern-detail?patternId=${encodeURIComponent(item.patternId)}&section=versions${item.sourceMode === 'cloud' ? '&cloud=1' : ''}`) },
    openReviewQueue() { this.navigate('/package-ai/pattern-review-queue/pattern-review-queue') },
    openTrainingCenter() { this.navigate('/package-ai/pattern-training-center/pattern-training-center') },
    openSampleOrders() { this.navigate('/package-ai/sample-order-list/sample-order-list') },
    deriveItem(item) { uni.showModal({ title: '派生新款', content: `将基于“${item.title}”的批准版本创建独立草稿，基础版型不会改变。`, confirmText: '创建派生', success: async ({ confirm }) => { if (!confirm) return; const changes = { garmentCategory: this.category === 'all' ? '' : this.category, audience: this.smartFilters.audience, season: this.smartFilters.season, style: this.smartFilters.style, fitType: this.smartFilters.fitType, neckType: this.smartFilters.neckType, sleeveType: this.smartFilters.sleeveType, lengthType: this.smartFilters.lengthType, materialCompatibility: this.smartFilters.materialType ? [this.smartFilters.materialType] : [], usageScene: this.smartFilters.usageScene ? [this.smartFilters.usageScene] : [] }; const input = { changes, tags: String(this.tagInput || '').split(/[\s,，]+/).filter(Boolean), note: '从版型智能检索结果创建派生草稿。', idempotencyKey: `derive_${Date.now()}_${Math.random().toString(16).slice(2)}` }; const result = item.sourceMode === 'cloud' ? await deriveApprovedPatternLibraryItem(item.patternId, input) : derivePatternLibraryItem(item.patternId, input); if (!result.ok) return uni.showToast({ title: result.message || '派生失败', icon: 'none' }); uni.showToast({ title: result.status === 'existing_derivation' ? '派生草稿已存在' : '已创建派生版型', icon: 'success' }); this.reload() } }) },
    goCreate() { this.navigate('/package-ai/pattern-structure/pattern-structure') },
    markCoverError(patternId) { this.coverErrors = { ...this.coverErrors, [patternId]: true } },
    differenceText(item = {}) { return (item.differences || []).slice(0, 3).map((value) => `${value.label} ${value.candidate}`).join('；') },
    formatDate(value = '') { const date = value ? new Date(value) : null; if (!date || !Number.isFinite(date.getTime())) return '时间待同步'; const pad = (number) => String(number).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
  }
}
</script>

<style scoped>
.library-page{min-height:100vh;padding:24rpx 24rpx 0;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.library-head{padding:28rpx;border:1rpx solid #e6eaf0;border-radius:20rpx;background:#fff}.page-title,.page-subtitle{display:block}.page-title{font-size:38rpx;font-weight:700}.page-subtitle{margin-top:8rpx;color:#667085;font-size:23rpx}.review-entry{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:20rpx;padding:18rpx;border-radius:12rpx;background:#edf6ff;color:#1677ff}.review-entry view text{display:block}.review-entry view text:first-child{font-size:24rpx;font-weight:700}.review-entry view text:last-child{margin-top:5rpx;color:#667085;font-size:20rpx}.review-entry>text{font-size:21rpx;font-weight:700}.search-box{display:flex;align-items:center;gap:14rpx;min-height:84rpx;margin-top:20rpx;padding:0 20rpx;border-radius:14rpx;background:#f3f5f8}.search-box input{min-width:0;flex:1;font-size:25rpx}.search-box>text:first-child{color:#667085;font-size:22rpx;font-weight:700}.clear-search{color:#1677ff;font-size:22rpx}.scope-scroll{margin-top:20rpx;white-space:nowrap}.scope-row{display:inline-flex;gap:12rpx}.scope-item{padding:15rpx 24rpx;border:1rpx solid #dfe4eb;border-radius:12rpx;background:#fff;color:#667085;font-size:23rpx}.scope-item.active{border-color:#1677ff;background:#eaf4ff;color:#1167d8;font-weight:700}.filter-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12rpx;margin-top:20rpx}.filter-control{overflow:hidden;padding:18rpx 10rpx;border:1rpx solid #e1e5eb;border-radius:12rpx;background:#fff;font-size:22rpx;text-align:center;text-overflow:ellipsis;white-space:nowrap}.result-summary{display:flex;justify-content:space-between;gap:20rpx;padding:22rpx 4rpx 14rpx;color:#667085;font-size:21rpx}.state-card{display:flex;align-items:center;flex-direction:column;padding:70rpx 30rpx;border-radius:18rpx;background:#fff;color:#667085;font-size:24rpx;text-align:center}.state-card text{line-height:1.6}.state-title{color:#1f2937;font-size:28rpx;font-weight:700}.state-card button{height:70rpx;margin-top:24rpx;padding:0 28rpx;border:0;border-radius:12rpx;background:#1677ff;color:#fff;font-size:23rpx;line-height:70rpx}.state-card button::after{border:0}.pattern-list{display:flex;flex-direction:column;gap:18rpx}.pattern-card{display:grid;grid-template-columns:210rpx minmax(0,1fr);overflow:hidden;border:1rpx solid #e5e9ef;border-radius:18rpx;background:#fff}.cover-wrap{min-height:250rpx;background:#f3f5f8}.cover-wrap image{width:100%;height:100%}.cover-placeholder{display:flex;align-items:center;justify-content:center;height:100%;min-height:250rpx;flex-direction:column;color:#98a2b3}.cover-placeholder text:first-child{font-size:30rpx;font-weight:700}.cover-placeholder text:last-child{margin-top:8rpx;font-size:20rpx}.card-body{min-width:0;padding:22rpx}.card-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12rpx}.card-title{display:-webkit-box;overflow:hidden;font-size:27rpx;font-weight:700;line-height:1.4;-webkit-box-orient:vertical;-webkit-line-clamp:2}.status-pill{flex:0 0 auto;padding:6rpx 10rpx;border-radius:8rpx;background:#f2f4f7;color:#475467;font-size:19rpx}.status-ai_pending,.status-review,.status-changes_requested{background:#fff4e5;color:#9a5700}.status-approved,.status-reviewed{background:#e9f8ef;color:#177245}.card-meta,.updated-time{display:block;color:#667085;font-size:21rpx}.card-meta{margin-top:12rpx}.updated-time{margin-top:12rpx}.tag-row{display:flex;flex-wrap:wrap;gap:8rpx;margin-top:12rpx}.tag-row text{padding:5rpx 9rpx;border-radius:7rpx;background:#f1f5f9;color:#5f6b7a;font-size:18rpx}.card-actions{display:flex;gap:22rpx;margin-top:18rpx;color:#1677ff;font-size:21rpx;font-weight:600}.load-more{height:76rpx;margin:24rpx 0 0;border:1rpx solid #dce3ec;border-radius:12rpx;background:#fff;color:#1677ff;font-size:23rpx;line-height:76rpx}.load-more::after{border:0}.list-end{display:block;padding:28rpx;color:#98a2b3;font-size:21rpx;text-align:center}.safe-space{height:calc(40rpx + env(safe-area-inset-bottom))}@media screen and (max-width:350px){.library-page{padding-right:18rpx;padding-left:18rpx}.pattern-card{grid-template-columns:170rpx minmax(0,1fr)}.card-actions{gap:14rpx;font-size:19rpx}}
.sample-entry{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:20rpx;padding:18rpx;border-radius:12rpx;background:#eef9f2;color:#177245}.sample-entry view text{display:block}.sample-entry view text:first-child{font-size:24rpx;font-weight:700}.sample-entry view text:last-child{margin-top:5rpx;color:#667085;font-size:20rpx}.sample-entry>text{font-size:21rpx;font-weight:700}
.training-entry{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:20rpx;padding:18rpx;border-radius:12rpx;background:#eef5ff;color:#1677ff}.training-entry view text{display:block}.training-entry view text:first-child{font-size:24rpx;font-weight:700}.training-entry view text:last-child{margin-top:5rpx;color:#667085;font-size:20rpx}.training-entry>text{font-size:21rpx;font-weight:700}
.smart-filter-card{margin-top:18rpx;border:1rpx solid #e1e7ef;border-radius:16rpx;background:#fff}.smart-filter-head{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:22rpx}.smart-filter-head view text{display:block}.smart-filter-head view text:first-child{font-size:26rpx;font-weight:700}.smart-filter-head view text:last-child{margin-top:6rpx;color:#667085;font-size:21rpx;line-height:1.4}.smart-filter-head>text{flex:0 0 auto;color:#1677ff;font-size:21rpx}.smart-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;padding:0 22rpx 22rpx;border-top:1rpx solid #eef1f5}.smart-filter-grid .filter-control{margin-top:16rpx}.tag-input{grid-column:1/-1;box-sizing:border-box;height:76rpx;margin-top:4rpx;padding:0 18rpx;border:1rpx solid #e1e5eb;border-radius:12rpx;background:#f8fafc;font-size:22rpx}.apply-filter{grid-column:1/-1;height:76rpx;margin:0;border:0;border-radius:12rpx;background:#1677ff;color:#fff;font-size:24rpx;font-weight:700;line-height:76rpx}.apply-filter::after{border:0}.match-box{margin-top:13rpx;padding:12rpx;border-radius:10rpx;background:#eef6ff;color:#31577d;font-size:20rpx;line-height:1.45}.match-box text{display:block}.match-score{color:#1265bc;font-size:22rpx;font-weight:700}.difference-line,.quality-notice{display:block;margin-top:10rpx;font-size:20rpx;line-height:1.45}.difference-line{color:#667085}.quality-notice{color:#9a5700}.status-reviewed{background:#eef2f7;color:#475467}
</style>
