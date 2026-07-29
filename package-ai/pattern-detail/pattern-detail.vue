<template>
  <view class="detail-page">
    <view v-if="loading" class="state-card">正在读取版型...</view>
    <view v-else-if="errorMessage" class="state-card error"><text>{{ errorMessage }}</text><button @click="loadDetail">重新加载</button></view>
    <template v-else-if="detail">
      <view class="hero-card">
        <image v-if="card.coverUrl && !coverFailed" class="hero-cover" :src="card.coverUrl" mode="aspectFit" @error="coverFailed = true" />
        <view v-else class="hero-placeholder"><text>版型结构参考</text><text>暂未保存结构图封面</text></view>
        <view class="hero-copy"><view><text class="hero-title">{{ card.title }}</text><text class="status-pill">{{ card.statusLabel }}</text></view><text>{{ card.categoryLabel }} · {{ card.currentVersion }} · 基础尺码 {{ card.baseSize }}</text></view>
      </view>

      <view class="warning-card"><text>当前为 AI 结构参考资料</text><text>未经打版师复核，不可直接裁剪、放码或用于生产。</text></view>

      <view class="action-row"><button v-if="canDerive" @click="derivePattern">派生新款</button><button v-if="detail.canEdit && !cloudMode" class="secondary" @click="createRevision">创建新版本</button><button v-if="canCreateSample" class="sample" :disabled="operating" @click="createSampleOrder">创建样衣单</button><button v-if="detail.canEdit && !canCreateSample && !cloudMode" class="review" :disabled="operating" @click="submitReview">{{ operating ? '提交中...' : '提交打版师复核' }}</button></view>

      <view class="section-card">
        <view class="section-head"><text>版型资料</text><text>{{ detail.parts.length }} 个部件</text></view>
        <view class="info-grid"><view><text>版型编号</text><text>{{ detail.master.patternCode || '未设置' }}</text></view><view><text>资料等级</text><text>等级 {{ detail.master.patternLevel || 'A' }}</text></view><view><text>尺码状态</text><text>{{ precisionLabel }}</text></view><view><text>人工复核</text><text>{{ detail.master.humanReviewRequired ? '必须' : '未要求' }}</text></view></view>
        <view v-if="card.tags.length" class="tag-row"><text v-for="tag in card.tags" :key="tag">{{ tag }}</text></view>
      </view>

      <view class="section-card">
        <view class="section-head"><text>分类信息</text><text>结构化字段</text></view>
        <view class="taxonomy-list"><view v-for="item in taxonomyRows" :key="item.label"><text>{{ item.label }}</text><text>{{ item.value || '未设置' }}</text></view></view>
      </view>

      <view class="section-card">
        <view class="section-head"><text>纸样部件</text><text>仅为部件示意</text></view>
        <view v-if="selectedParts.length" class="part-list"><view v-for="part in selectedParts" :key="part.patternPartId"><text>{{ part.name }}</text><text>{{ part.quantity }} 件 · 裁片 {{ part.cutQuantity }}</text></view></view><text v-else class="empty-line">暂无部件清单</text>
      </view>

      <view class="section-card">
        <view class="section-head"><text>尺寸资料</text><text>单位 cm</text></view>
        <view v-if="measurementRows.length" class="measurement-list"><view v-for="item in measurementRows" :key="item.key"><text>{{ item.label }}</text><text>{{ item.value }}</text></view></view><text v-else class="empty-line">未提供精确尺寸，系统未推测缺失数值。</text>
      </view>

      <view id="versions" class="section-card">
        <view class="section-head"><text>版本记录</text><text>{{ detail.versions.length }} 个版本</text></view>
        <view class="version-list"><view v-for="version in detail.versions" :key="version.versionId" class="version-item" :class="{ active: selectedVersionId === version.versionId }" @click="selectVersion(version)"><view><text>{{ version.versionNo }}</text><text>{{ versionLabel(version) }}</text></view><view><text>{{ formatDate(version.createdAt) }}</text><text>{{ version.versionId === detail.master.currentVersionId ? '当前版本' : (selectedVersionId === version.versionId ? '正在查看' : '查看资料') }}</text></view></view></view>
      </view>
      <view class="safe-space"></view>
    </template>
  </view>
</template>

<script>
import { createPatternLibraryRevision, deriveApprovedPatternLibraryItem, derivePatternLibraryItem, getCloudPatternLibraryDetail, getPatternLibraryDetail, getPatternLibraryVersionDetail } from '../../utils/pattern/patternLibraryRepository.js'
import { submitPatternForReview } from '../../utils/pattern/patternReviewRepository.js'

const MEASUREMENT_LABELS = Object.freeze({ height: '身高', bust: '胸围', waist: '腰围', hip: '臀围', shoulder: '肩宽', garmentLength: '衣长', pantsLength: '裤长', skirtLength: '裙长', sleeveLength: '袖长' })

export default {
  data() { return { patternId: '', section: '', cloudMode: false, loading: true, errorMessage: '', detail: null, versionDetail: null, selectedVersionId: '', coverFailed: false, operating: false } },
  computed: {
    card() { return (this.detail && this.detail.card) || {} },
    taxonomyRows() { const value = (this.detail.master && this.detail.master.taxonomy) || {}; return [{ label: '适用人群', value: value.audience }, { label: '季节', value: value.season }, { label: '风格', value: value.style }, { label: '版型', value: value.fitType }, { label: '领型', value: value.neckType }, { label: '袖型', value: value.sleeveType }, { label: '长度', value: value.lengthType }, { label: '面料兼容', value: (value.materialCompatibility || []).join('、') }, { label: '使用场景', value: (value.usageScene || []).join('、') }] },
    selectedParts() { return this.versionDetail ? this.versionDetail.parts : (this.detail.parts || []) },
    selectedSizeSpecs() { return this.versionDetail ? this.versionDetail.sizeSpecs : (this.detail.sizeSpecs || []) },
    selectedVersion() { return (this.detail.versions || []).find((item) => item.versionId === this.selectedVersionId) || {} },
    canDerive() { return this.selectedVersion.reviewStatus === 'approved' && this.detail.master.approvedVersionId === this.selectedVersionId && this.detail.canCreate !== false },
    canCreateSample() { return this.selectedVersion.reviewStatus === 'approved' && this.detail.master.approvedVersionId === this.selectedVersionId },
    measurementRows() { const spec = (this.selectedSizeSpecs || [])[0] || {}; const values = spec.values || {}; return Object.keys(values).filter((key) => values[key] !== '' && values[key] !== null && values[key] !== undefined).map((key) => ({ key, label: MEASUREMENT_LABELS[key] || key, value: `${values[key]} cm` })) },
    precisionLabel() { const spec = (this.selectedSizeSpecs || [])[0] || {}; return spec.precisionStatus === 'user_provided_partial' ? '用户部分提供，待复核' : '无精确尺寸' }
  },
  onLoad(options = {}) { this.patternId = String(options.patternId || ''); this.section = String(options.section || ''); this.cloudMode = String(options.cloud || '') === '1'; this.loadDetail() },
  onShow() { if (this._loadedOnce) this.loadDetail(); this._loadedOnce = true },
  methods: {
    async loadDetail() { if (!this.patternId || this.loading && this.detail) return; this.loading = true; this.errorMessage = ''; const result = this.cloudMode ? await getCloudPatternLibraryDetail(this.patternId) : getPatternLibraryDetail(this.patternId); if (!result.ok) { this.detail = null; this.errorMessage = result.message || '版型不存在或无权访问。' } else { this.detail = result.data; this.coverFailed = false; this.selectedVersionId = result.data.currentVersion.versionId; this.versionDetail = { version: result.data.currentVersion, parts: result.data.parts || [], sizeSpecs: result.data.sizeSpecs || [] }; if (this.section === 'versions') this.$nextTick(() => uni.pageScrollTo({ selector: '#versions', duration: 250 })) } this.loading = false },
    async selectVersion(version = {}, notify = true) { if (!version || !version.versionId) return; const result = this.cloudMode ? await getCloudPatternLibraryDetail(this.patternId, version.versionId) : getPatternLibraryVersionDetail(this.patternId, version.versionId); if (!result.ok) { if (notify) uni.showToast({ title: result.message || '版本暂时无法查看', icon: 'none' }); return } this.selectedVersionId = version.versionId; this.versionDetail = this.cloudMode ? { version: result.data.currentVersion, parts: result.data.parts || [], sizeSpecs: result.data.sizeSpecs || [] } : result.data; if (notify) uni.showToast({ title: `正在查看 ${version.versionNo}`, icon: 'none' }) },
    derivePattern() { if (this.operating || !this.canDerive) return; uni.showModal({ title: '派生新款', editable: true, placeholderText: `${this.card.title || '版型'} 派生版`, content: '新款会建立独立主档和 V1 草稿，批准基础版型和历史版本不会改变。', confirmText: '创建', success: async ({ confirm, content }) => { if (!confirm) return; this.operating = true; const input = { title: String(content || '').trim(), idempotencyKey: `derive_${Date.now()}_${Math.random().toString(16).slice(2)}` }; const result = this.cloudMode ? await deriveApprovedPatternLibraryItem(this.patternId, input) : derivePatternLibraryItem(this.patternId, input); this.operating = false; if (!result.ok) return uni.showToast({ title: result.message || '派生失败', icon: 'none' }); const id = result.data.master.patternMasterId; uni.redirectTo({ url: `/package-ai/pattern-detail/pattern-detail?patternId=${encodeURIComponent(id)}${this.cloudMode ? '&cloud=1' : ''}` }) } }) },
    createRevision() { if (this.operating) return; uni.showModal({ title: '创建新版本', content: '将复制当前部件和尺寸资料，建立新的草稿版本。已批准和历史版本不会被覆盖。', confirmText: '创建版本', success: ({ confirm }) => { if (!confirm) return; this.operating = true; const result = createPatternLibraryRevision(this.patternId); this.operating = false; if (!result.ok) return uni.showToast({ title: result.message || '创建失败', icon: 'none' }); uni.showToast({ title: '已创建新版本', icon: 'success' }); this.loadDetail() } }) },
    async submitReview() { if (this.operating || !this.selectedVersionId) return; this.operating = true; const result = await submitPatternForReview(this.patternId, this.selectedVersionId); this.operating = false; if (!result.ok) return uni.showToast({ title: result.message || '提交复核失败', icon: 'none' }); uni.showToast({ title: '已提交复核', icon: 'success' }) },
    createSampleOrder() { if (!this.canCreateSample || this.operating) return; uni.navigateTo({ url: `/package-ai/sample-order-create/sample-order-create?patternId=${encodeURIComponent(this.patternId)}&versionId=${encodeURIComponent(this.selectedVersionId)}`, fail: () => uni.showToast({ title: '样衣单页面暂时无法打开', icon: 'none' }) }) },
    versionLabel(version = {}) { if (version.reviewStatus === 'approved') return '已批准'; if (version.reviewStatus === 'reviewed') return '已复核'; if (version.reviewStatus === 'changes_requested') return '需修改'; if (version.reviewStatus === 'ai_generated') return 'AI 生成待复核'; if (['pending', 'under_review'].includes(version.reviewStatus)) return '复核中'; if (version.status === 'generating') return '生成中'; return '草稿' },
    formatDate(value = '') { const date = value ? new Date(value) : null; if (!date || !Number.isFinite(date.getTime())) return '时间待同步'; const pad = (number) => String(number).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` }
  }
}
</script>

<style scoped>
.detail-page{min-height:100vh;padding:24rpx;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.state-card{padding:80rpx 30rpx;border-radius:18rpx;background:#fff;color:#667085;text-align:center}.state-card button{height:70rpx;margin-top:22rpx;border:0;border-radius:12rpx;background:#1677ff;color:#fff;font-size:23rpx;line-height:70rpx}.state-card button::after{border:0}.hero-card,.section-card{overflow:hidden;border:1rpx solid #e5e9ef;border-radius:20rpx;background:#fff}.hero-cover,.hero-placeholder{width:100%;height:470rpx;background:#f3f5f8}.hero-placeholder{display:flex;align-items:center;justify-content:center;flex-direction:column;color:#98a2b3}.hero-placeholder text:first-child{font-size:30rpx;font-weight:700}.hero-placeholder text:last-child{margin-top:10rpx;font-size:22rpx}.hero-copy{padding:24rpx}.hero-copy>view{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.hero-copy>text{display:block;margin-top:10rpx;color:#667085;font-size:22rpx}.hero-title{font-size:32rpx;font-weight:700}.status-pill{flex:0 0 auto;padding:7rpx 12rpx;border-radius:8rpx;background:#fff4e5;color:#9a5700;font-size:20rpx}.warning-card{margin-top:18rpx;padding:22rpx;border-left:6rpx solid #b76e00;border-radius:14rpx;background:#fff8e8}.warning-card text{display:block;color:#765f39;font-size:22rpx;line-height:1.5}.warning-card text:first-child{color:#8a5200;font-size:25rpx;font-weight:700}.action-row{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin-top:18rpx}.action-row button{height:82rpx;border:0;border-radius:14rpx;background:#1677ff;color:#fff;font-size:24rpx;font-weight:700;line-height:82rpx}.action-row button::after{border:0}.action-row button.secondary{border:1rpx solid #b9d9ff;background:#fff;color:#1677ff}.section-card{margin-top:18rpx;padding:26rpx}.section-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.section-head text:first-child{font-size:29rpx;font-weight:700}.section-head text:last-child{color:#7b8495;font-size:20rpx}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16rpx;margin-top:22rpx}.info-grid view{padding:18rpx;border-radius:12rpx;background:#f7f9fb}.info-grid text{display:block}.info-grid text:first-child{color:#667085;font-size:20rpx}.info-grid text:last-child{margin-top:7rpx;font-size:23rpx;font-weight:600}.tag-row{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:20rpx}.tag-row text{padding:7rpx 11rpx;border-radius:8rpx;background:#edf5ff;color:#1767b5;font-size:20rpx}.taxonomy-list,.part-list,.measurement-list,.version-list{margin-top:18rpx}.taxonomy-list view,.part-list view,.measurement-list view{display:flex;justify-content:space-between;gap:20rpx;padding:17rpx 0;border-bottom:1rpx solid #edf0f4;font-size:22rpx}.taxonomy-list text:first-child,.measurement-list text:first-child{color:#667085}.taxonomy-list text:last-child,.measurement-list text:last-child{text-align:right}.part-list view text:first-child{font-weight:600}.part-list view text:last-child{color:#667085}.version-item{display:flex;justify-content:space-between;gap:20rpx;padding:19rpx 0;border-bottom:1rpx solid #edf0f4}.version-item>view text{display:block}.version-item>view text:first-child{font-size:24rpx;font-weight:700}.version-item>view text:last-child{margin-top:6rpx;color:#667085;font-size:20rpx}.version-item>view:last-child{text-align:right}.version-item>view:last-child text:last-child{color:#1677ff}.empty-line{display:block;margin-top:20rpx;color:#667085;font-size:22rpx;line-height:1.5}.safe-space{height:calc(36rpx + env(safe-area-inset-bottom))}@media screen and (max-width:350px){.detail-page{padding:18rpx}.hero-cover,.hero-placeholder{height:390rpx}.info-grid{grid-template-columns:1fr}.action-row{grid-template-columns:1fr}}
.version-item.active{margin:0 -12rpx;padding-right:12rpx;padding-left:12rpx;border-radius:10rpx;background:#f2f7ff}.action-row button.review,.action-row button.sample{grid-column:1/-1;border:1rpx solid #b9d9ff;background:#edf6ff;color:#1677ff}
</style>
