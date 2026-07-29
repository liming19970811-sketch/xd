<template>
  <view class="training-page">
    <view class="hero">
      <text class="title">AI制版训练数据</text>
      <text class="subtitle">沉淀AI初稿、人工修订和批准版型，建立可追溯的数据集。</text>
      <view class="notice">当前仅建设数据闭环与评测记录，不代表已经完成模型训练或上线。</view>
    </view>

    <view v-if="loading" class="state-card">正在读取训练数据...</view>
    <view v-else-if="errorMessage" class="state-card"><text>{{ errorMessage }}</text><button @click="loadSummary">重新加载</button></view>
    <template v-else>
      <view class="section-card consent-card">
        <view class="section-head"><view><text>训练数据授权</text><text>仅限本人拥有、已批准且来源明确的版型</text></view><text class="status" :class="{ granted: consentGranted }">{{ consentGranted ? '已授权' : '未授权' }}</text></view>
        <text class="body-copy">授权不是公开版型，也不会自动开始训练。撤回后，未冻结进入合规数据集的样本停止使用。</text>
        <button class="secondary" :disabled="operating" @click="changeConsent">{{ consentGranted ? '撤回训练授权' : '阅读说明并授权' }}</button>
      </view>

      <view class="stats-grid">
        <view><text>{{ stats.candidateCount || 0 }}</text><text>批准候选</text></view>
        <view><text>{{ stats.eligibleSampleCount || 0 }}</text><text>授权样本</text></view>
        <view><text>{{ stats.datasetCount || 0 }}</text><text>数据集</text></view>
        <view><text>{{ stats.evaluationCount || 0 }}</text><text>评测记录</text></view>
      </view>

      <view class="section-card">
        <view class="section-head"><view><text>批准版型候选</text><text>只有完成复核并获得所有者授权后才能建样本</text></view></view>
        <view v-if="!candidates.length" class="empty-line">暂无已批准版型候选。</view>
        <view v-for="item in candidates" :key="item.versionId" class="list-row">
          <view><text>{{ item.title || '未命名版型' }}</text><text>{{ item.versionNo }} · {{ item.consentStatus === 'granted' ? '已授权' : '未授权' }}</text></view>
          <button :disabled="operating || item.sampleStatus !== 'not_created' || item.consentStatus !== 'granted'" @click="createSample(item)">{{ item.sampleStatus === 'not_created' ? '生成样本' : '已生成' }}</button>
        </view>
      </view>

      <view v-if="canManage" class="section-card">
        <view class="section-head"><view><text>训练数据集快照</text><text>按版型血缘隔离，冻结后不再改动样本</text></view></view>
        <text v-if="!evaluationDatasets.length" class="body-copy">请先冻结固定评测集，避免同一版型血缘同时进入训练和评测。</text>
        <button class="primary" :disabled="operating || !evaluationDatasets.length || !trainingEligibleSampleIds.length" @click="createDataset">创建授权训练集快照</button>
        <view v-if="!trainingDatasets.length" class="empty-line">尚未创建训练数据集。</view>
        <view v-for="item in trainingDatasets" :key="item.datasetId" class="record-row"><text>{{ item.name }}</text><text>{{ item.sampleCount }} 个训练样本 · 未执行训练</text></view>
      </view>

      <view v-if="canConfigureEvaluation" class="section-card evaluation-dataset-card">
        <view class="section-head"><view><text>固定制版评测集</text><text>覆盖六类服装，与训练集及派生版型严格隔离</text></view><text class="status" :class="{ granted: !missingEvaluationCategories.length }">{{ missingEvaluationCategories.length ? `缺 ${missingEvaluationCategories.length} 类` : '覆盖完整' }}</text></view>
        <view class="coverage-list"><text v-for="item in evaluationCategoryCoverage" :key="item.value" :class="{ ready: item.ready }">{{ item.label }} {{ item.count }}</text></view>
        <view class="evaluation-sample-list">
          <view v-for="item in evaluationSelectableSamples" :key="item.sampleId" class="evaluation-sample-row" :class="{ active: selectedEvaluationSampleIds.includes(item.sampleId) }" @click="toggleEvaluationSample(item.sampleId)">
            <view><text>{{ getCategoryLabel(item.category) }} · {{ item.baseSize || '未标尺码' }}</text><text>{{ item.changeCount }} 项人工修订 · 已授权</text></view>
            <text class="sample-check">{{ selectedEvaluationSampleIds.includes(item.sampleId) ? '✓' : '' }}</text>
          </view>
        </view>
        <text v-if="missingEvaluationCategories.length" class="body-copy">尚缺：{{ missingEvaluationCategories.map((item) => item.label).join('、') }}。补齐已批准且已授权样本后才能冻结评测集。</text>
        <button class="primary" :disabled="operating || missingEvaluationCategories.length > 0" @click="createEvaluationDataset">冻结固定评测集</button>
        <view v-if="!evaluationDatasets.length" class="empty-line">尚未建立固定评测集。</view>
        <view v-for="item in evaluationDatasets" :key="item.datasetVersionId || item.datasetId" class="record-row"><text>{{ item.name }} {{ item.version }}</text><text>{{ item.sampleCount }} 个样本 · 已冻结</text></view>
      </view>

      <view v-if="canConfigureEvaluation" class="section-card">
        <view class="section-head"><view><text>模型版本登记</text><text>仅登记外部训练产物，不在小程序内执行训练</text></view></view>
        <input v-model="modelForm.name" maxlength="100" placeholder="模型名称" />
        <input v-model="modelForm.version" maxlength="80" placeholder="真实模型版本（必填）" />
        <input v-model="modelForm.provider" maxlength="80" placeholder="训练平台或来源（可选）" />
        <input v-model="modelForm.promptVersion" maxlength="80" placeholder="默认提示词版本（可选）" />
        <input v-model="modelForm.parserVersion" maxlength="80" placeholder="默认解析器版本（可选）" />
        <picker :range="trainingDatasets" range-key="name" :value="datasetIndex" @change="datasetIndex = Number($event.detail.value) || 0"><view class="picker">{{ trainingDatasets[datasetIndex] ? trainingDatasets[datasetIndex].name : '请先创建训练数据集' }} ></view></picker>
        <button class="secondary" :disabled="operating || !trainingDatasets.length || !modelForm.version.trim()" @click="registerModel">登记模型版本</button>
        <view v-for="item in models" :key="item.modelId" class="record-row"><text>{{ item.name }} {{ item.version }}</text><text>已登记，尚未训练或启用</text></view>
      </view>

      <view v-if="canConfigureEvaluation" class="section-card">
        <view class="section-head"><view><text>固定评测运行</text><text>锁定模型、提示词、解析器和评测集，不在小程序内执行模型</text></view></view>
        <picker :range="models" range-key="version" :value="modelIndex" @change="modelIndex = Number($event.detail.value) || 0"><view class="picker">{{ models[modelIndex] ? models[modelIndex].version : '请先登记模型' }} ></view></picker>
        <picker :range="evaluationDatasets" range-key="name" :value="evaluationDatasetIndex" @change="evaluationDatasetIndex = Number($event.detail.value) || 0"><view class="picker">{{ evaluationDatasets[evaluationDatasetIndex] ? evaluationDatasets[evaluationDatasetIndex].name : '请先冻结评测集' }} ></view></picker>
        <input v-model="evaluationRun.promptVersion" maxlength="80" placeholder="提示词版本（必填）" />
        <input v-model="evaluationRun.parserVersion" maxlength="80" placeholder="JSON解析器版本（必填）" />
        <input v-model="evaluationRun.externalRunReference" maxlength="160" placeholder="外部真实运行批次或报告编号（必填）" />
        <view class="notice compact">创建运行只登记固定评测配置。真实结果必须由外部执行后逐样本回写，系统不会生成假成绩。</view>
        <button class="secondary" :disabled="operating || !canCreateEvaluationRun" @click="createEvaluationRun">创建固定评测运行</button>
        <view v-for="item in evaluationRuns" :key="item.evaluationRunId" class="evaluation-run">
          <view class="record-row"><text>{{ getRunVersionText(item) }}</text><text>{{ getRunStatusText(item.status) }} · {{ item.sampleCount }} 个样本</text></view>
          <view v-if="item.metrics && item.metrics.automatic" class="metric-grid"><text>部件F1 {{ formatMetric(item.metrics.automatic.partF1) }}</text><text>尺寸容差 {{ formatPercent(item.metrics.automatic.sizeWithinToleranceRate) }}</text><text>结构盲评 {{ formatMetric(item.metrics.humanScores && item.metrics.humanScores.structureAccuracy) }}</text><text>工艺盲评 {{ formatMetric(item.metrics.humanScores && item.metrics.humanScores.constructionAccuracy) }}</text></view>
          <view class="run-actions"><button v-if="item.status === 'evaluating' || item.status === 'awaiting_external_results'" :disabled="operating" @click="completeEvaluation(item)">汇总真实结果</button><button v-if="item.status === 'completed' && item.candidateGate && item.candidateGate.passed" :disabled="operating" @click="selectCandidate(item)">标记候选版本</button></view>
        </view>
      </view>

      <view v-if="canReview" class="section-card">
        <view class="section-head"><view><text>打版师盲评</text><text>隐藏模型、提示词和解析器信息，只评结构、尺寸、部件和工艺</text></view><text class="status">待评 {{ blindReviewQueue.length }}</text></view>
        <view v-if="!blindReviewQueue.length" class="empty-line">暂无可盲评结果，等待外部真实结果回写。</view>
        <template v-else>
          <picker :range="blindReviewQueue" range-key="blindedCandidateCode" :value="blindReviewIndex" @change="blindReviewIndex = Number($event.detail.value) || 0"><view class="picker">{{ activeBlindReview ? `${activeBlindReview.blindedCandidateCode} · ${getCategoryLabel(activeBlindReview.category)}` : '选择盲评结果' }} ></view></picker>
          <view class="blind-score-row" v-for="field in blindScoreFields" :key="field.key"><text>{{ field.label }}</text><picker :range="scoreOptions" :value="getBlindScoreIndex(field.key)" @change="setBlindScore(field.key, $event.detail.value)"><view class="score-picker">{{ blindReview.scores[field.key] || '请选择' }} ></view></picker></view>
          <textarea v-model="blindReview.notes" maxlength="1000" placeholder="记录结构、尺寸或工艺问题，不填写模型猜测" />
          <button class="secondary" :disabled="operating || !canSubmitBlindReview" @click="submitBlindReview">提交独立盲评</button>
        </template>
      </view>
    </template>
    <view class="safe-space"></view>
  </view>
</template>

<script>
import {
  completePatternEvaluationRun,
  createPatternEvaluationDataset,
  createPatternEvaluationRun,
  createPatternTrainingDataset,
  createPatternTrainingSample,
  getPatternTrainingSummary,
  recordPatternBlindReview,
  registerPatternModel,
  selectPatternCandidateModel,
  setPatternTrainingConsent
} from '../../utils/pattern/patternTrainingRepository.js'

const EVALUATION_CATEGORIES = [
  { value: 'tshirt', label: 'T恤' },
  { value: 'shirt', label: '衬衫' },
  { value: 'dress', label: '连衣裙' },
  { value: 'skirt', label: '半身裙' },
  { value: 'pants', label: '裤装' },
  { value: 'coat', label: '外套' }
]

const BLIND_SCORE_FIELDS = [
  { key: 'structureAccuracy', label: '结构准确性' },
  { key: 'sizeAccuracy', label: '尺寸准确性' },
  { key: 'partAccuracy', label: '部件准确性' },
  { key: 'constructionAccuracy', label: '工艺准确性' }
]

export default {
  data() {
    return {
      loading: true, operating: false, errorMessage: '', summary: {}, datasetIndex: 0, modelIndex: 0, evaluationDatasetIndex: 0, blindReviewIndex: 0, selectedEvaluationSampleIds: [],
      modelForm: { name: 'AI制版模型', version: '', provider: '', promptVersion: '', parserVersion: '' },
      evaluationRun: { promptVersion: '', parserVersion: '', externalRunReference: '' },
      blindReview: { scores: {}, notes: '', recommendCandidate: false },
      scoreOptions: [1, 2, 3, 4, 5],
      blindScoreFields: BLIND_SCORE_FIELDS
    }
  },
  computed: {
    consentGranted() { return this.summary.consent && this.summary.consent.status === 'granted' },
    canManage() { return Boolean(this.summary.capabilities && this.summary.capabilities.canManage) },
    canConfigureEvaluation() { return Boolean(this.summary.capabilities && this.summary.capabilities.canConfigureEvaluation) },
    canReview() { return Boolean(this.summary.capabilities && this.summary.capabilities.canReview) },
    stats() { return this.summary.stats || {} },
    candidates() { return this.summary.candidates || [] },
    samples() { return this.summary.samples || [] },
    datasets() { return this.summary.datasets || [] },
    trainingDatasets() { return this.datasets.filter((item) => item.datasetType !== 'evaluation' && item.split !== 'evaluation') },
    evaluationDatasets() { return this.datasets.filter((item) => item.datasetType === 'evaluation' || item.split === 'evaluation') },
    models() { return this.summary.models || [] },
    evaluationRuns() { return (this.summary.evaluations || []).filter((item) => item.evaluationRunId) },
    blindReviewQueue() { return this.summary.blindReviewQueue || [] },
    activeBlindReview() { return this.blindReviewQueue[this.blindReviewIndex] || null },
    eligibleSampleIds() { return this.samples.filter((item) => item.status === 'eligible' && item.authorizationStatus === 'granted').map((item) => item.sampleId) },
    evaluationSelectableSamples() { return this.samples.filter((item) => item.status === 'eligible' && item.authorizationStatus === 'granted' && !(item.datasetMemberships || []).some((membership) => membership.datasetType === 'training')) },
    trainingEligibleSampleIds() { return this.samples.filter((item) => item.status === 'eligible' && item.authorizationStatus === 'granted' && !(item.datasetMemberships || []).some((membership) => membership.datasetType === 'evaluation')).map((item) => item.sampleId) },
    evaluationCategoryCoverage() {
      return EVALUATION_CATEGORIES.map((category) => {
        const count = this.evaluationSelectableSamples.filter((item) => this.selectedEvaluationSampleIds.includes(item.sampleId) && item.category === category.value).length
        return { ...category, count, ready: count > 0 }
      })
    },
    missingEvaluationCategories() { return this.evaluationCategoryCoverage.filter((item) => !item.ready) },
    canCreateEvaluationRun() { return Boolean(this.models.length && this.evaluationDatasets.length && this.evaluationRun.promptVersion.trim() && this.evaluationRun.parserVersion.trim() && this.evaluationRun.externalRunReference.trim()) },
    canSubmitBlindReview() { return Boolean(this.activeBlindReview && BLIND_SCORE_FIELDS.every((field) => Number(this.blindReview.scores[field.key]) >= 1)) }
  },
  onLoad() { this.loadSummary() },
  methods: {
    async loadSummary() {
      if (this.loading && this._loaded) return
      this.loading = true; this.errorMessage = ''
      const result = await getPatternTrainingSummary()
      if (result.ok) {
        this.summary = result.data || {}; this._loaded = true
        const selectableIds = new Set(this.evaluationSelectableSamples.map((item) => item.sampleId))
        this.selectedEvaluationSampleIds = this.selectedEvaluationSampleIds.filter((item) => selectableIds.has(item))
        if (!this.selectedEvaluationSampleIds.length && !this.evaluationDatasets.length) this.selectedEvaluationSampleIds = [...selectableIds]
      } else this.errorMessage = result.message || '训练数据暂时无法读取。'
      this.loading = false
    },
    async run(action, successText) {
      if (this.operating) return null
      this.operating = true
      const result = await action()
      this.operating = false
      if (!result || !result.ok) { uni.showToast({ title: result && result.message || '操作失败，请重试', icon: 'none' }); return null }
      uni.showToast({ title: successText, icon: 'success' }); await this.loadSummary(); return result
    },
    changeConsent() {
      const granting = !this.consentGranted
      uni.showModal({ title: granting ? '授权训练数据使用' : '撤回训练授权', content: granting ? '仅允许本人拥有、已批准且来源明确的版型进入训练候选。授权不会自动训练或公开数据。' : '撤回后，新样本不可创建，未进入合规冻结数据集的样本停止使用。', confirmText: granting ? '同意授权' : '确认撤回', confirmColor: granting ? '#1677ff' : '#d92d20', success: ({ confirm }) => { if (confirm) this.run(() => setPatternTrainingConsent(granting), granting ? '已授权' : '已撤回') } })
    },
    createSample(item) { this.run(() => createPatternTrainingSample(item.patternId, item.versionId), '训练样本已生成') },
    createDataset() { this.run(() => createPatternTrainingDataset({ sampleIds: this.trainingEligibleSampleIds, version: `V${this.trainingDatasets.length + 1}` }), '数据集快照已创建') },
    createEvaluationDataset() { this.run(() => createPatternEvaluationDataset({ sampleIds: this.selectedEvaluationSampleIds, version: `E${this.evaluationDatasets.length + 1}` }), '固定评测集已冻结') },
    toggleEvaluationSample(sampleId) { this.selectedEvaluationSampleIds = this.selectedEvaluationSampleIds.includes(sampleId) ? this.selectedEvaluationSampleIds.filter((item) => item !== sampleId) : [...this.selectedEvaluationSampleIds, sampleId] },
    registerModel() { const dataset = this.trainingDatasets[this.datasetIndex]; if (!dataset) return; this.run(() => registerPatternModel({ ...this.modelForm, datasetId: dataset.datasetId }), '模型版本已登记') },
    createEvaluationRun() {
      const model = this.models[this.modelIndex]; const dataset = this.evaluationDatasets[this.evaluationDatasetIndex]
      if (!model || !dataset) return
      this.run(() => createPatternEvaluationRun({ modelVersionId: model.modelVersionId || model.modelId, datasetVersionId: dataset.datasetVersionId || dataset.datasetId, ...this.evaluationRun }), '固定评测运行已创建')
    },
    completeEvaluation(item) { this.run(() => completePatternEvaluationRun(item.evaluationRunId), '评测结果已汇总') },
    selectCandidate(item) { this.run(() => selectPatternCandidateModel(item.evaluationRunId), '已标记候选版本，未部署') },
    getBlindScoreIndex(key) { const value = Number(this.blindReview.scores[key] || 1); return Math.max(0, this.scoreOptions.indexOf(value)) },
    setBlindScore(key, index) { this.blindReview = { ...this.blindReview, scores: { ...this.blindReview.scores, [key]: this.scoreOptions[Number(index) || 0] } } },
    submitBlindReview() {
      const item = this.activeBlindReview
      if (!item) return
      this.run(() => recordPatternBlindReview({ evaluationRunId: item.evaluationRunId, evaluationResultId: item.evaluationResultId, scores: this.blindReview.scores, notes: this.blindReview.notes, recommendCandidate: this.blindReview.recommendCandidate }), '盲评已保存').then((result) => {
        if (result) this.blindReview = { scores: {}, notes: '', recommendCandidate: false }
      })
    },
    getRunVersionText(item = {}) { const model = this.models.find((entry) => (entry.modelVersionId || entry.modelId) === item.modelVersionId); return `${model ? model.version : '候选模型'} · ${item.promptVersion} · ${item.parserVersion}` },
    getRunStatusText(status = '') { return ({ awaiting_external_results: '等待外部结果', evaluating: '评测中', completed: '评测完成', candidate_selected: '候选未部署' })[status] || '状态确认中' },
    getCategoryLabel(value = '') { const category = EVALUATION_CATEGORIES.find((item) => item.value === value); return category ? category.label : '未分类' },
    formatMetric(value) { return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—' },
    formatPercent(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : '—' }
  }
}
</script>

<style scoped>
.training-page{min-height:100vh;padding:24rpx;background:#f5f6fa;color:#1f2937;box-sizing:border-box}.hero,.section-card,.state-card{padding:28rpx;border:1rpx solid #e5e9ef;border-radius:18rpx;background:#fff}.title,.subtitle{display:block}.title{font-size:36rpx;font-weight:700}.subtitle{margin-top:8rpx;color:#667085;font-size:23rpx;line-height:1.5}.notice{margin-top:18rpx;padding:14rpx;border-radius:10rpx;background:#fff8e8;color:#765f39;font-size:21rpx;line-height:1.5}.notice.compact{margin-top:14rpx}.state-card{display:flex;align-items:center;flex-direction:column;margin-top:18rpx;color:#667085}.state-card button{margin-top:18rpx}.section-card{margin-top:18rpx}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.section-head view text{display:block}.section-head view text:first-child{font-size:28rpx;font-weight:700}.section-head view text:last-child{margin-top:6rpx;color:#667085;font-size:21rpx}.status{flex-shrink:0;padding:7rpx 12rpx;border-radius:8rpx;background:#f2f4f7;color:#667085;font-size:20rpx}.status.granted{background:#e9f8ef;color:#177245}.body-copy,.empty-line{display:block;margin-top:16rpx;color:#667085;font-size:22rpx;line-height:1.5}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10rpx;margin-top:18rpx}.stats-grid view{padding:20rpx 8rpx;border-radius:14rpx;background:#fff;text-align:center}.stats-grid text{display:block}.stats-grid text:first-child{color:#1677ff;font-size:31rpx;font-weight:700}.stats-grid text:last-child{margin-top:6rpx;color:#667085;font-size:19rpx}.list-row,.record-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:18rpx 0;border-bottom:1rpx solid #edf0f4}.list-row view{min-width:0;flex:1}.list-row view text,.record-row text{display:block}.list-row view text:first-child,.record-row text:first-child{font-size:24rpx;font-weight:600}.list-row view text:last-child,.record-row text:last-child{margin-top:6rpx;color:#667085;font-size:20rpx}.list-row button{height:62rpx;margin:0;padding:0 18rpx;border:1rpx solid #b9d9ff;border-radius:10rpx;background:#fff;color:#1677ff;font-size:20rpx;line-height:62rpx}.primary,.secondary{height:76rpx;margin:20rpx 0 0;border-radius:12rpx;font-size:23rpx;font-weight:700;line-height:76rpx}.primary{border:0;background:#1677ff;color:#fff}.secondary{border:1rpx solid #b9d9ff;background:#fff;color:#1677ff}.section-card input,.picker,.section-card textarea{width:100%;margin-top:14rpx;padding:0 18rpx;border-radius:12rpx;background:#f6f8fa;font-size:22rpx;box-sizing:border-box}.section-card input,.picker{height:76rpx;line-height:76rpx}.section-card textarea{height:150rpx;padding-top:16rpx}.coverage-list{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:18rpx}.coverage-list text{padding:9rpx 12rpx;border-radius:10rpx;background:#fff1f0;color:#b42318;font-size:20rpx}.coverage-list text.ready{background:#e9f8ef;color:#177245}.evaluation-sample-list{margin-top:16rpx;border-top:1rpx solid #edf0f4}.evaluation-sample-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:16rpx;border-bottom:1rpx solid #edf0f4;background:#fafbfc}.evaluation-sample-row.active{background:#eef6ff}.evaluation-sample-row view text{display:block}.evaluation-sample-row view text:first-child{font-size:23rpx;font-weight:600}.evaluation-sample-row view text:last-child{margin-top:5rpx;color:#667085;font-size:20rpx}.sample-check{display:flex;align-items:center;justify-content:center;width:38rpx;height:38rpx;border:2rpx solid #b9c1cd;border-radius:10rpx;color:#fff;background:#fff}.evaluation-sample-row.active .sample-check{border-color:#1677ff;background:#1677ff}.evaluation-run{margin-top:16rpx;padding:0 16rpx 16rpx;border:1rpx solid #e7eaf0;border-radius:14rpx;background:#fafbfc}.metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx;padding-top:14rpx}.metric-grid text{padding:12rpx;border-radius:10rpx;background:#f2f4f7;color:#475467;font-size:20rpx}.run-actions{display:flex;gap:12rpx;margin-top:14rpx}.run-actions button{height:64rpx;margin:0;padding:0 16rpx;border:1rpx solid #b9d9ff;border-radius:10rpx;background:#fff;color:#1677ff;font-size:20rpx;line-height:64rpx}.blind-score-row{display:flex;align-items:center;justify-content:space-between;gap:20rpx;min-height:78rpx;border-bottom:1rpx solid #edf0f4;font-size:23rpx}.score-picker{min-width:150rpx;padding:14rpx;border-radius:10rpx;background:#f6f8fa;color:#1677ff;text-align:center}.safe-space{height:calc(46rpx + env(safe-area-inset-bottom))}@media screen and (max-width:350px){.training-page{padding:18rpx}.stats-grid{grid-template-columns:repeat(2,1fr)}.section-head{align-items:flex-start}.metric-grid{grid-template-columns:1fr}.record-row{align-items:flex-start;flex-direction:column}}
</style>
