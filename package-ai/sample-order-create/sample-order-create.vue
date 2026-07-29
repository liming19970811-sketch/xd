<template>
  <view class="create-page">
    <view class="hero-card">
      <text class="page-title">创建样衣单</text>
      <text class="page-subtitle">基于已批准版型安排实物打样。样衣确认后仍不会自动创建生产订单。</text>
      <view class="pattern-summary"><text>{{ patternTitle }}</text><text>{{ patternVersionLabel }} · 已批准</text></view>
    </view>

    <view class="section-card">
      <view class="section-head"><text>面料信息</text><text>必填</text></view>
      <input v-model="form.material.name" maxlength="80" placeholder="主要面料，如 260g 棉针织" />
      <view class="two-col"><input v-model="form.material.composition" maxlength="120" placeholder="成分，如 95%棉 5%氨纶" /><input v-model="form.material.color" maxlength="60" placeholder="颜色" /></view>
      <view class="two-col"><input v-model="form.material.weight" maxlength="60" placeholder="克重/规格（可选）" /><input v-model="form.material.lotNo" maxlength="80" placeholder="批次号（可选）" /></view>
    </view>

    <view class="section-card">
      <view class="section-head"><text>打样工厂</text><text>必填</text></view>
      <picker v-if="factories.length" :range="factories" range-key="label" :value="factoryIndex" @change="selectFactory"><view class="picker-control">{{ selectedFactoryLabel || '选择已认证工厂' }} ></view></picker>
      <input v-else v-model="form.factoryName" maxlength="120" placeholder="填写实际打样工厂名称" />
      <text class="field-note">工厂档案用于记录协作对象，不会自动发送订单或公开联系方式。</text>
    </view>

    <view class="section-card">
      <view class="section-head"><text>交期与要求</text><text>按实际填写</text></view>
      <picker mode="date" :value="form.expectedAt" @change="form.expectedAt = $event.detail.value"><view class="picker-control">{{ form.expectedAt || '选择预计样衣完成日期' }} ></view></picker>
      <textarea v-model="form.requirements" maxlength="800" placeholder="填写重点工艺、版型保持要求和需要工厂注意的细节。" />
    </view>

    <view class="bottom-bar">
      <text>{{ disabledReason || '可保存草稿或提交工厂接单' }}</text>
      <view><button class="secondary" :disabled="submitting" @click="saveDraft">保存草稿</button><button class="primary" :disabled="Boolean(disabledReason)" @click="createAndSubmit">提交打样</button></view>
    </view>
    <view class="safe-space"></view>
  </view>
</template>

<script>
import { getPatternLibraryDetail } from '../../utils/pattern/patternLibraryRepository.js'
import { createSampleDraft, getSampleFactoryOptions, submitSampleOrder, updateSampleDraft } from '../../utils/sample/sampleRepository.js'

export default {
  data() { return { patternId: '', versionId: '', patternTitle: '版型资料', patternVersionLabel: '当前版本', factories: [], factoryIndex: 0, sampleOrderId: '', idempotencyKey: '', submitting: false, form: { factoryId: '', factoryName: '', expectedAt: '', requirements: '', material: { name: '', composition: '', color: '', weight: '', lotNo: '' } } } },
  computed: {
    selectedFactoryLabel() { const item = this.factories[this.factoryIndex]; return this.form.factoryId && item ? item.label : '' },
    disabledReason() { if (this.submitting) return '正在创建样衣单，请勿重复点击。'; if (!this.patternId || !this.versionId) return '缺少已批准版型版本。'; if (!String(this.form.material.name || '').trim()) return '请填写主要面料。'; if (!String(this.form.factoryName || '').trim() && !String(this.form.factoryId || '').trim()) return '请选择或填写打样工厂。'; return '' }
  },
  onLoad(options = {}) {
    this.patternId = String(options.patternId || ''); this.versionId = String(options.versionId || '')
    this.idempotencyKey = `sample_create_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.loadPattern(); this.factories = getSampleFactoryOptions().map((item) => ({ ...item, label: `${item.shortName}${item.region ? ` · ${item.region}` : ''}` }))
  },
  methods: {
    loadPattern() { const result = getPatternLibraryDetail(this.patternId); if (!result.ok) return; const version = result.data.versions.find((item) => item.versionId === this.versionId); this.patternTitle = result.data.master.title || '版型资料'; this.patternVersionLabel = version ? version.versionNo : '当前版本' },
    applyFactory(item = {}) { this.form.factoryId = item.factoryId || ''; this.form.factoryName = item.name || '' },
    selectFactory(event) { this.factoryIndex = Number(event.detail.value) || 0; this.applyFactory(this.factories[this.factoryIndex]) },
    payload() { return { patternMasterId: this.patternId, patternVersionId: this.versionId, factoryId: this.form.factoryId, factoryName: this.form.factoryName, expectedAt: this.form.expectedAt, requirements: this.form.requirements, material: { ...this.form.material }, idempotencyKey: this.idempotencyKey } },
    async ensureDraft() {
      if (this.sampleOrderId) { const updated = await updateSampleDraft({ sampleOrderId: this.sampleOrderId, ...this.payload() }); return updated }
      const result = await createSampleDraft(this.payload()); if (result.ok) this.sampleOrderId = result.data.order.sampleOrderId; return result
    },
    async saveDraft() { if (this.submitting || !this.patternId || !this.versionId) return; this.submitting = true; const result = await this.ensureDraft(); this.submitting = false; uni.showToast({ title: result.ok ? '草稿已保存' : (result.message || '保存失败'), icon: result.ok ? 'success' : 'none' }) },
    async createAndSubmit() {
      if (this.disabledReason) return
      this.submitting = true; const draft = await this.ensureDraft()
      if (!draft.ok) { this.submitting = false; return uni.showToast({ title: draft.message || '样衣单创建失败', icon: 'none' }) }
      const submitted = await submitSampleOrder(this.sampleOrderId); this.submitting = false
      if (!submitted.ok) return uni.showToast({ title: submitted.message || '提交失败', icon: 'none' })
      uni.redirectTo({ url: `/package-ai/sample-order-detail/sample-order-detail?sampleOrderId=${encodeURIComponent(this.sampleOrderId)}`, fail: () => uni.showToast({ title: '样衣单已创建，请从样衣中心查看', icon: 'none' }) })
    }
  }
}
</script>

<style scoped>
.create-page{min-height:100vh;padding:24rpx;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.hero-card,.section-card{padding:26rpx;border:1rpx solid #e4e9f0;border-radius:18rpx;background:#fff}.page-title,.page-subtitle{display:block}.page-title{font-size:36rpx;font-weight:700}.page-subtitle{margin-top:8rpx;color:#667085;font-size:23rpx;line-height:1.5}.pattern-summary{display:flex;justify-content:space-between;gap:16rpx;margin-top:20rpx;padding:18rpx;border-radius:12rpx;background:#edf6ff;color:#1677ff;font-size:23rpx;font-weight:700}.section-card{margin-top:18rpx}.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16rpx}.section-head text:first-child{font-size:28rpx;font-weight:700}.section-head text:last-child{color:#d92d20;font-size:20rpx}.section-card input,.picker-control{height:78rpx;margin-top:12rpx;padding:0 18rpx;border-radius:12rpx;background:#f6f8fa;font-size:23rpx;line-height:78rpx;box-sizing:border-box}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.section-card textarea{width:100%;height:180rpx;margin-top:12rpx;padding:18rpx;border-radius:12rpx;background:#f6f8fa;font-size:23rpx;box-sizing:border-box}.field-note{display:block;margin-top:12rpx;color:#667085;font-size:20rpx;line-height:1.5}.bottom-bar{position:fixed;right:0;bottom:0;left:0;z-index:10;padding:16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));border-top:1rpx solid #e4e9f0;background:rgba(255,255,255,.96)}.bottom-bar>text{display:block;margin-bottom:10rpx;color:#667085;font-size:20rpx}.bottom-bar>view{display:grid;grid-template-columns:200rpx 1fr;gap:12rpx}.bottom-bar button{height:78rpx;margin:0;border-radius:12rpx;font-size:23rpx;font-weight:700;line-height:78rpx}.bottom-bar button::after{border:0}.secondary{border:1rpx solid #b9d9ff;background:#fff;color:#1677ff}.primary{border:0;background:#1677ff;color:#fff}.safe-space{height:230rpx}@media screen and (max-width:350px){.create-page{padding:18rpx}.two-col{grid-template-columns:1fr}.bottom-bar>view{grid-template-columns:170rpx 1fr}}
</style>
