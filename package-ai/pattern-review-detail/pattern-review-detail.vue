<template>
  <view class="review-page">
    <view v-if="loading" class="state-card">正在读取复核资料...</view>
    <view v-else-if="errorMessage" class="state-card error"><text>{{ errorMessage }}</text><button @click="loadDetail">重新加载</button></view>
    <template v-else-if="detail">
      <view class="summary-card">
        <view><text class="title">{{ detail.master.title }}</text><text class="pill">{{ statusLabel }}</text></view>
        <text class="meta">{{ detail.version.versionNo }} · {{ detail.master.category || '品类待确认' }}</text>
        <text class="warning">当前仅为结构与打版资料复核，不代表样衣验证或生产级纸样完成。</text>
        <button v-if="detail.access.canClaim" class="claim-button" :disabled="operating" @click="claim">认领复核</button>
      </view>

      <view class="section-card">
        <view class="section-head"><text>尺寸复核</text><text>单位 cm</text></view>
        <view v-if="sizeRows.length" class="field-list">
          <view v-for="item in sizeRows" :key="item.key" class="field-row"><text>{{ item.label }}</text><input v-model="sizeDraft[item.key]" type="digit" :disabled="!canEdit" placeholder="未填写" /></view>
        </view>
        <text v-else class="empty-line">未提交精确尺寸。复核人员不得用猜测数值代替实测数据。</text>
        <label class="check-row"><checkbox :checked="dimensionsChecked" :disabled="!canOperate" @click="dimensionsChecked = !dimensionsChecked" /><text>尺寸字段、单位和测量口径已复核</text></label>
      </view>

      <view class="section-card">
        <view class="section-head"><text>纸样部件复核</text><text>{{ partDrafts.length }} 个部件</text></view>
        <view v-if="partDrafts.length" class="part-list">
          <view v-for="part in partDrafts" :key="part.patternPartId" class="part-row">
            <view><input v-model="part.name" :disabled="!canEdit" maxlength="40" /><text>数量 {{ part.quantity }} · 裁片 {{ part.cutQuantity }}</text></view>
            <text class="part-status">待人工确认</text>
          </view>
        </view>
        <text v-else class="empty-line">暂无纸样部件清单，不能标记为已复核。</text>
        <label class="check-row"><checkbox :checked="partsChecked" :disabled="!canOperate" @click="partsChecked = !partsChecked" /><text>部件名称、数量和裁片关系已复核</text></label>
      </view>

      <view class="section-card">
        <view class="section-head"><text>审核意见</text><text>{{ notes.length }}/500</text></view>
        <textarea v-model="notes" :disabled="!canOperate" maxlength="500" placeholder="记录尺寸疑问、部件修订或批准依据。退回修改时必填。" />
      </view>

      <view v-if="detail.reviews.length" class="section-card">
        <view class="section-head"><text>复核记录</text><text>不可删除</text></view>
        <view class="timeline"><view v-for="item in detail.reviews" :key="item.reviewId"><text>{{ actionLabel(item.action) }}</text><text>{{ item.notes || '未填写补充说明' }}</text><text>{{ formatDate(item.createdAt) }}</text></view></view>
      </view>

      <view class="action-card">
        <button v-if="detail.access.canRevise" class="secondary" :disabled="operating" @click="saveRevision">保存为新修订版本</button>
        <button v-if="detail.access.canRequestChanges" class="danger" :disabled="operating" @click="requestChanges">退回修改</button>
        <button v-if="detail.access.canMarkReviewed" class="secondary" :disabled="operating || !reviewChecklistComplete" @click="markReviewed">标记已复核</button>
        <button v-if="detail.access.canApprove" class="primary" :disabled="operating" @click="approve">批准当前版本</button>
        <text v-if="!canOperate" class="readonly-tip">当前身份仅可查看，或该版本已分配给其他复核人员。</text>
      </view>
      <view class="safe-space"></view>
    </template>
  </view>
</template>

<script>
import { approvePatternVersion, claimPatternReview, getPatternReviewDetail, markPatternReviewed, requestPatternChanges, savePatternReviewRevision } from '../../utils/pattern/patternReviewRepository.js'
import { getPatternReviewLabel } from '../../utils/pattern/patternReviewState.js'

const MEASUREMENT_LABELS = Object.freeze({ height: '身高', bust: '胸围', waist: '腰围', hip: '臀围', shoulder: '肩宽', garmentLength: '衣长', pantsLength: '裤长', skirtLength: '裙长', sleeveLength: '袖长' })
const EMPTY_MEASUREMENTS = Object.freeze(Object.keys(MEASUREMENT_LABELS).reduce((result, key) => ({ ...result, [key]: '' }), {}))

export default {
  data() { return { patternId: '', versionId: '', loading: true, operating: false, errorMessage: '', detail: null, notes: '', sizeDraft: {}, partDrafts: [], dimensionsChecked: false, partsChecked: false } },
  computed: {
    statusLabel() { return getPatternReviewLabel(this.detail && this.detail.version.reviewStatus) },
    canOperate() { const access = this.detail && this.detail.access; return Boolean(access && (access.canRevise || access.canRequestChanges || access.canMarkReviewed || access.canApprove)) },
    canEdit() { return Boolean(this.detail && this.detail.access.canRevise) },
    sizeRows() { return Object.keys(this.sizeDraft).map((key) => ({ key, label: MEASUREMENT_LABELS[key] || key })) },
    hasMeasuredValue() { return Object.values(this.sizeDraft).some((value) => Number.isFinite(Number(value)) && Number(value) > 0) },
    reviewChecklistComplete() { return this.dimensionsChecked && this.partsChecked && this.partDrafts.length > 0 && this.hasMeasuredValue }
  },
  onLoad(options = {}) { this.patternId = String(options.patternId || ''); this.versionId = String(options.versionId || ''); this.loadDetail() },
  methods: {
    async loadDetail() {
      if (this.loading && this.detail) return
      this.loading = true; this.errorMessage = ''
      const result = await getPatternReviewDetail(this.patternId, this.versionId)
      if (!result.ok) { this.detail = null; this.errorMessage = result.message || '复核资料暂时无法读取。' }
      else {
        this.detail = result.data; this.versionId = result.data.version.versionId; this.notes = result.data.version.reviewNotes || ''
        const size = (result.data.sizes || [])[0] || {}; this.sizeDraft = { ...EMPTY_MEASUREMENTS, ...(size.values || {}) }
        this.partDrafts = (result.data.parts || []).map((item) => ({ ...item }))
      }
      this.loading = false
    },
    async run(action, successText) {
      if (this.operating) return null
      this.operating = true
      const result = await action()
      this.operating = false
      if (!result.ok) { uni.showToast({ title: result.message || '操作失败，请重试', icon: 'none' }); return null }
      uni.showToast({ title: successText, icon: 'success' }); await this.loadDetail(); return result
    },
    claim() { return this.run(() => claimPatternReview(this.patternId, this.versionId), '已认领') },
    saveRevision() {
      const currentSizes = this.detail.sizes || []
      const sizes = currentSizes.length
        ? currentSizes.map((item, index) => index ? item : { ...item, values: { ...this.sizeDraft } })
        : [{ baseSize: (this.detail.version.sizeParams || {}).baseSize || '', measurementBasis: 'garment', precisionStatus: 'reviewer_provided', values: { ...this.sizeDraft } }]
      return this.run(() => savePatternReviewRevision({ patternId: this.patternId, versionId: this.versionId, parts: this.partDrafts, sizes, notes: this.notes }), '已创建新版本')
    },
    requestChanges() {
      if (!String(this.notes || '').trim()) return uni.showToast({ title: '请填写具体审核意见', icon: 'none' })
      return this.run(() => requestPatternChanges({ patternId: this.patternId, versionId: this.versionId, notes: this.notes }), '已退回修改')
    },
    markReviewed() {
      if (!this.reviewChecklistComplete) return uni.showToast({ title: '请完成尺寸和部件复核', icon: 'none' })
      return this.run(() => markPatternReviewed({ patternId: this.patternId, versionId: this.versionId, notes: this.notes, dimensionsChecked: true, partsChecked: true }), '已标记复核')
    },
    approve() {
      uni.showModal({ title: '批准当前版本', content: '批准只代表结构资料复核通过，不代表样衣验证或可直接生产。', confirmText: '确认批准', success: ({ confirm }) => { if (confirm) this.run(() => approvePatternVersion({ patternId: this.patternId, versionId: this.versionId, notes: this.notes }), '版本已批准') } })
    },
    actionLabel(action) { return ({ submit: '提交复核', claim: '认领复核', save_revision: '创建修订版本', request_changes: '退回修改', mark_reviewed: '标记已复核', approve: '批准版本' })[action] || '复核记录' },
    formatDate(value) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '时间待同步' }
  }
}
</script>

<style scoped>
.review-page{min-height:100vh;padding:24rpx;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.state-card{display:flex;align-items:center;flex-direction:column;padding:80rpx 28rpx;border-radius:18rpx;background:#fff;color:#667085;text-align:center}.state-card button{height:72rpx;margin-top:20rpx;border:0;border-radius:12rpx;background:#1677ff;color:#fff;line-height:72rpx}.state-card button::after{border:0}.summary-card,.section-card,.action-card{padding:26rpx;border:1rpx solid #e4e9f0;border-radius:18rpx;background:#fff}.summary-card>view,.section-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.title{font-size:32rpx;font-weight:700}.pill{padding:7rpx 12rpx;border-radius:8rpx;background:#fff4e5;color:#9a5700;font-size:20rpx}.meta,.warning{display:block;margin-top:10rpx;color:#667085;font-size:22rpx}.warning{padding:16rpx;border-radius:10rpx;background:#fff8e8;color:#765f39;line-height:1.5}.claim-button{height:74rpx;margin-top:20rpx;border:0;border-radius:12rpx;background:#1677ff;color:#fff;font-size:23rpx;line-height:74rpx}.claim-button::after{border:0}.section-card{margin-top:18rpx}.section-head text:first-child{font-size:28rpx;font-weight:700}.section-head text:last-child{color:#7b8495;font-size:20rpx}.field-list,.part-list,.timeline{margin-top:16rpx}.field-row{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:15rpx 0;border-bottom:1rpx solid #edf0f4;font-size:23rpx}.field-row input{width:180rpx;height:64rpx;padding:0 16rpx;border-radius:10rpx;background:#f6f8fa;text-align:right}.part-row{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding:16rpx 0;border-bottom:1rpx solid #edf0f4}.part-row>view{min-width:0;flex:1}.part-row input{height:58rpx;font-size:23rpx;font-weight:600}.part-row view text{display:block;color:#667085;font-size:20rpx}.part-status{color:#9a5700;font-size:20rpx}.check-row{display:flex;align-items:center;gap:12rpx;margin-top:20rpx;color:#475467;font-size:22rpx}.empty-line{display:block;margin-top:18rpx;color:#667085;font-size:22rpx;line-height:1.5}.section-card textarea{width:100%;height:190rpx;margin-top:16rpx;padding:18rpx;border-radius:12rpx;background:#f6f8fa;font-size:23rpx;line-height:1.5;box-sizing:border-box}.timeline>view{padding:16rpx 0;border-bottom:1rpx solid #edf0f4}.timeline text{display:block;font-size:21rpx}.timeline text:first-child{font-size:23rpx;font-weight:700}.timeline text:nth-child(2){margin-top:6rpx;color:#475467}.timeline text:last-child{margin-top:6rpx;color:#98a2b3}.action-card{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:18rpx}.action-card button{height:78rpx;margin:0;border-radius:12rpx;font-size:22rpx;font-weight:700;line-height:78rpx}.action-card button::after{border:0}.primary{border:0;background:#1677ff;color:#fff}.secondary{border:1rpx solid #b9d9ff;background:#fff;color:#1677ff}.danger{border:1rpx solid #f2b8b5;background:#fff5f5;color:#b42318}.readonly-tip{grid-column:1/-1;color:#667085;font-size:21rpx;line-height:1.5}.safe-space{height:calc(40rpx + env(safe-area-inset-bottom))}@media screen and (max-width:350px){.review-page{padding:18rpx}.action-card{grid-template-columns:1fr}}
</style>
