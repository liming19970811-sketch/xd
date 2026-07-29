<template>
  <view class="pattern-page">
    <ai-feature-header title="打版结构图" description="生成结构参考图、纸样部件示意和可复核的打版资料。" />

    <view class="review-warning">
      <text class="review-warning-title">AI 结构参考，不可直接生产</text>
      <text class="review-warning-copy">当前完成等级 A。尺寸、缝份、刀口、丝缕线和放码规则必须由打版师复核。</text>
    </view>

    <view class="form-section">
      <view class="section-heading"><view><text class="step-index">1</text><text class="section-title">上传款式参考</text></view><text class="section-note">最多 5 张，独立保存用途</text></view>
      <view class="upload-grid">
        <view v-for="field in uploadFields" :key="field.key" class="upload-card" :class="{ required: field.required }" @click="chooseReferenceImage(field.key)">
          <image v-if="images[field.key].previewUrl" class="upload-preview" :src="images[field.key].previewUrl" mode="aspectFit" />
          <view v-else class="upload-empty"><text class="upload-symbol">+</text><text class="upload-label">{{ field.label }}</text><text class="upload-hint">{{ field.required ? '必填' : '可选' }}</text></view>
          <view v-if="images[field.key].status === 'uploading'" class="upload-mask">正在上传…</view>
          <view v-if="images[field.key].previewUrl" class="upload-actions"><text @click.stop="chooseReferenceImage(field.key)">更换</text><text @click.stop="removeReferenceImage(field.key)">删除</text></view>
          <text v-if="images[field.key].error" class="field-error">{{ images[field.key].error }}</text>
        </view>
      </view>
    </view>

    <view class="form-section">
      <view class="section-heading"><view><text class="step-index">2</text><text class="section-title">选择输入模式</text></view></view>
      <view class="option-stack">
        <view v-for="item in inputModes" :key="item.value" class="mode-option" :class="{ active: inputMode === item.value }" @click="inputMode = item.value">
          <view><text class="option-title">{{ item.label }}</text><text class="option-desc">{{ item.description }}</text></view><text class="option-check">{{ inputMode === item.value ? '✓' : '' }}</text>
        </view>
      </view>
    </view>

    <view class="form-section">
      <view class="section-heading"><view><text class="step-index">3</text><text class="section-title">服装品类</text></view><text class="required-text">必填</text></view>
      <view class="chip-grid"><view v-for="item in categories" :key="item.value" class="choice-chip" :class="{ active: category === item.value }" @click="category = item.value"><text>{{ item.label }}</text><text v-if="category === item.value" class="chip-check">✓</text></view></view>
    </view>

    <view class="form-section">
      <view class="section-heading"><view><text class="step-index">4</text><text class="section-title">基础尺码</text></view><text class="section-note">允许无精确尺寸</text></view>
      <view class="segmented-control"><view :class="{ active: measurementBasis === 'body' }" @click="measurementBasis = 'body'">人体净尺寸</view><view :class="{ active: measurementBasis === 'garment' }" @click="measurementBasis = 'garment'">成衣尺寸</view></view>
      <view class="size-row"><text class="field-label">基础尺码</text><view class="size-options"><text v-for="size in baseSizes" :key="size" :class="{ active: baseSize === size }" @click="baseSize = size">{{ size }}</text></view></view>
      <view class="measurement-grid">
        <label v-for="field in visibleMeasurementFields" :key="field.key" class="measurement-field"><text>{{ field.label }}</text><view><input v-model="measurements[field.key]" type="digit" :placeholder="field.placeholder" @blur="validateMeasurement(field)" /><text>cm</text></view><text v-if="measurementErrors[field.key]" class="field-error">{{ measurementErrors[field.key] }}</text></label>
      </view>
      <text class="measurement-tip">未填写的数值不会由系统推测；资料包会标记“无精确尺寸”或“用户部分提供”。</text>
    </view>

    <view class="form-section">
      <view class="section-heading"><view><text class="step-index">5</text><text class="section-title">结构要求</text></view></view>
      <view v-for="field in visibleStructureFields" :key="field.key" class="structure-field"><text class="field-label">{{ field.label }}</text><view class="chip-grid compact"><view v-for="option in field.options" :key="option.value" class="choice-chip" :class="{ active: structureRequirements[field.key] === option.value }" @click="selectStructure(field.key, option.value)"><text>{{ option.label }}</text><text v-if="structureRequirements[field.key] === option.value" class="chip-check">✓</text></view></view></view>
      <textarea v-model="notes" class="notes-input" maxlength="300" placeholder="补充结构要求（可选），不要用说明代替关键尺寸。" />
      <text class="char-count">{{ notes.length }}/300</text>
    </view>

    <view class="form-section">
      <view class="section-heading"><view><text class="step-index">6</text><text class="section-title">选择输出内容</text></view></view>
      <view class="output-list">
        <view v-for="item in outputOptions" :key="item.value" class="output-option" :class="{ active: selectedOutputs.includes(item.value) }" @click="toggleOutput(item)">
          <view class="output-check">{{ selectedOutputs.includes(item.value) ? '✓' : '' }}</view><view class="output-copy"><text>{{ item.label }}</text><text>{{ item.description }}</text></view><text class="output-state" :class="{ manual: item.manual }">{{ item.manual ? '待人工完善' : (item.visual ? '生成图片' : '结构化资料') }}</text>
        </view>
      </view>
      <view class="save-plan-row" @click="saveAsPattern = !saveAsPattern"><view><text class="save-plan-title">保存为版型方案</text><text class="save-plan-desc">保存主档、V1版本、部件、尺码和复核状态</text></view><switch :checked="saveAsPattern" color="#1677ff" @click.stop @change="saveAsPattern = $event.detail.value" /></view>
    </view>

    <view class="page-bottom-space"></view>
    <generation-action-bar :summary="generationSummary" :button-text="submitButtonText" loading-text="正在创建打版任务…" :reason="disabledReason" :disabled="Boolean(disabledReason)" :loading="submitting" @generate="submitPatternStructure" />
  </view>
</template>

<script>
import AiFeatureHeader from '../../components/ai-generation/ai-feature-header.vue'
import GenerationActionBar from '../../components/ai-generation/generation-action-bar.vue'
import { uploadImage } from '../../utils/api/upload.js'
import { createBatchTasks } from '../../utils/task/batchTask.js'
import { PATTERN_STRUCTURE_ACTION, PATTERN_VISUAL_OUTPUTS, validatePatternStructureInput } from '../../utils/task/patternStructureContract.js'
import { createWorkspacePlanHistory, failWorkspacePlanHistory, linkWorkspacePlanTasks } from '../../utils/workspace/workspacePlanHistory.js'
import { createPatternStructurePlan, linkPatternStructureGeneration } from '../../utils/workspace/patternMakingRepository.js'

const INPUT_MODES = Object.freeze([
  { value: 'garment_photo', label: '服装照片', description: '从成衣图片分析版型和结构。' },
  { value: 'design_render', label: '设计效果图', description: '从设计图提取结构和款式细节。' },
  { value: 'structure_sketch', label: '结构线稿', description: '基于已有线稿补充部件和工艺资料。' }
])
const CATEGORIES = Object.freeze([
  { value: 'tshirt', label: 'T恤' }, { value: 'shirt', label: '衬衫' }, { value: 'dress', label: '连衣裙' },
  { value: 'skirt', label: '半身裙' }, { value: 'pants', label: '裤装' }, { value: 'coat', label: '外套' }
])
const MEASUREMENT_FIELDS = Object.freeze([
  { key: 'height', label: '身高', placeholder: '例如 165', min: 120, max: 220, categories: ['all'] },
  { key: 'bust', label: '胸围', placeholder: '例如 84', min: 50, max: 180, categories: ['all'] },
  { key: 'waist', label: '腰围', placeholder: '例如 68', min: 45, max: 180, categories: ['all'] },
  { key: 'hip', label: '臀围', placeholder: '例如 90', min: 55, max: 200, categories: ['dress', 'skirt', 'pants', 'coat'] },
  { key: 'shoulder', label: '肩宽', placeholder: '例如 38', min: 25, max: 70, categories: ['tshirt', 'shirt', 'dress', 'coat'] },
  { key: 'garmentLength', label: '衣长', placeholder: '例如 62', min: 20, max: 180, categories: ['tshirt', 'shirt', 'dress', 'coat'] },
  { key: 'pantsLength', label: '裤长', placeholder: '例如 100', min: 25, max: 160, categories: ['pants'] },
  { key: 'skirtLength', label: '裙长', placeholder: '例如 76', min: 20, max: 160, categories: ['skirt'] },
  { key: 'sleeveLength', label: '袖长', placeholder: '例如 58', min: 0, max: 100, categories: ['tshirt', 'shirt', 'dress', 'coat'] }
])
const STRUCTURE_FIELDS = Object.freeze([
  { key: 'fit', label: '版型', categories: ['all'], options: [{ label: '常规', value: 'regular' }, { label: '修身', value: 'slim' }, { label: '宽松', value: 'loose' }] },
  { key: 'collar', label: '领型', categories: ['tshirt', 'shirt', 'dress', 'coat'], options: [{ label: '圆领', value: 'round' }, { label: 'V领', value: 'v_neck' }, { label: '翻领', value: 'turn_down' }, { label: '无领', value: 'collarless' }] },
  { key: 'sleeve', label: '袖型', categories: ['tshirt', 'shirt', 'dress', 'coat'], options: [{ label: '短袖', value: 'short' }, { label: '长袖', value: 'long' }, { label: '无袖', value: 'sleeveless' }, { label: '插肩袖', value: 'raglan' }] },
  { key: 'closure', label: '门襟', categories: ['shirt', 'dress', 'coat'], options: [{ label: '无门襟', value: 'none' }, { label: '单排扣', value: 'single_button' }, { label: '拉链', value: 'zipper' }] },
  { key: 'waistband', label: '腰头', categories: ['skirt', 'pants'], options: [{ label: '常规腰头', value: 'regular' }, { label: '松紧腰', value: 'elastic' }, { label: '高腰', value: 'high' }] }
])
const OUTPUT_OPTIONS = Object.freeze([
  { value: 'front_technical', label: '正面技术结构图', description: '生成正面技术平面参考图', visual: true },
  { value: 'back_technical', label: '背面技术结构图', description: '生成背面技术平面参考图', visual: true },
  { value: 'pattern_pieces', label: '纸样部件示意', description: '生成非比例部件关系示意', visual: true },
  { value: 'detail_annotations', label: '关键细节标注', description: '合并到技术结构参考图', structured: true },
  { value: 'parts_list', label: '部件清单', description: '按品类模板建立结构化清单', structured: true },
  { value: 'size_spec', label: '尺寸建议表', description: '仅记录用户提供的尺寸', structured: true },
  { value: 'craft_notes', label: '工艺说明', description: '预留版师补充与复核', manual: true }
])
function emptyImage() { return { previewUrl: '', stableUrl: '', assetId: '', status: 'empty', error: '', meta: {} } }
function imageAsset(value = '') { return { fileId: value, fileID: value, fileUrl: /^https:\/\//i.test(value) ? value : '', localPath: '' } }

export default {
  components: { AiFeatureHeader, GenerationActionBar },
  data() {
    return {
      uploadFields: [{ key: 'frontImage', label: '服装正面图', required: true }, { key: 'backImage', label: '背面图' }, { key: 'sideImage', label: '侧面或细节图' }, { key: 'structureSketch', label: '结构线稿' }, { key: 'designSketch', label: '设计草图' }],
      images: { frontImage: emptyImage(), backImage: emptyImage(), sideImage: emptyImage(), structureSketch: emptyImage(), designSketch: emptyImage() },
      inputModes: INPUT_MODES, inputMode: 'garment_photo', categories: CATEGORIES, category: '', baseSizes: ['S', 'M', 'L', 'XL'], baseSize: 'M', measurementBasis: 'body',
      measurements: { height: '', bust: '', waist: '', hip: '', shoulder: '', garmentLength: '', pantsLength: '', skirtLength: '', sleeveLength: '' }, measurementErrors: {},
      structureRequirements: { fit: 'regular', collar: '', sleeve: '', closure: '', waistband: '' }, notes: '', outputOptions: OUTPUT_OPTIONS,
      selectedOutputs: ['front_technical', 'back_technical', 'pattern_pieces', 'parts_list', 'size_spec'], saveAsPattern: true, submitting: false, submissionStatus: 'idle',
      createdTaskIds: [], createdBatchId: '', createdHistoryId: '', createdPatternMasterId: ''
    }
  },
  computed: {
    visibleMeasurementFields() { return MEASUREMENT_FIELDS.filter((field) => field.categories.includes('all') || field.categories.includes(this.category)) },
    visibleStructureFields() { return STRUCTURE_FIELDS.filter((field) => field.categories.includes('all') || field.categories.includes(this.category)) },
    selectedVisualOutputs() { return this.selectedOutputs.filter((value) => PATTERN_VISUAL_OUTPUTS.includes(value)) },
    sanitizedMeasurements() { const next = {}; this.visibleMeasurementFields.forEach((field) => { if (this.measurements[field.key] !== '') next[field.key] = Number(this.measurements[field.key]) }); return next },
    contractSource() {
      const assets = {}; Object.keys(this.images).forEach((key) => { if (this.images[key].stableUrl) assets[key] = this.images[key].stableUrl })
      return { type: PATTERN_STRUCTURE_ACTION, input: { imageUrl: this.images.frontImage.stableUrl, assets, params: { actionType: PATTERN_STRUCTURE_ACTION, inputMode: this.inputMode, category: this.category, outputTarget: this.selectedVisualOutputs[0] || 'front_technical', baseSize: this.baseSize, measurementBasis: this.measurementBasis, measurements: this.sanitizedMeasurements, structureRequirements: this.structureRequirements, notes: this.notes } } }
    },
    disabledReason() {
      if (this.submitting) return '正在创建任务，请勿重复点击。'
      if (Object.values(this.images).some((item) => item.status === 'uploading')) return '图片上传中，请稍候。'
      if (Object.values(this.measurementErrors).some(Boolean)) return '请修正不合理的尺寸。'
      const validation = validatePatternStructureInput(this.contractSource)
      if (!validation.ok) return validation.message
      return this.selectedVisualOutputs.length ? '' : '请至少选择一项可生成的结构参考图。'
    },
    generationSummary() { return `${this.selectedVisualOutputs.length} 项图片 · ${Object.keys(this.sanitizedMeasurements).length ? '已填部分尺寸' : '无精确尺寸'} · 待版师复核` },
    submitButtonText() { return this.submissionStatus === 'navigation_failed' && this.createdTaskIds.length ? '查看已创建任务' : `生成 ${this.selectedVisualOutputs.length} 项打版资料` }
  },
  methods: {
    chooseReferenceImage(key) {
      if (!key || this.images[key].status === 'uploading') return
      uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: (result) => this.uploadReferenceImage(key, result) })
    },
    getImageInfo(path = '') { return new Promise((resolve, reject) => uni.getImageInfo({ src: path, success: resolve, fail: reject })) },
    async uploadReferenceImage(key, result = {}) {
      const path = (result.tempFilePaths || [])[0] || ''; const file = (result.tempFiles || [])[0] || { path }; if (!path) return
      const previous = { ...this.images[key] }; this.images = { ...this.images, [key]: { ...previous, status: 'uploading', error: '', previewUrl: path } }
      try {
        const match = path.split('?')[0].split('#')[0].match(/\.([a-zA-Z0-9]+)$/); const extension = match ? match[1].toLowerCase() : ''
        if (extension && !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw Object.assign(new Error(), { code: 'invalid_format' })
        if (Number(file.size || 0) > 10 * 1024 * 1024) throw Object.assign(new Error(), { code: 'too_large' })
        const info = await this.getImageInfo(path); if (Number(info.width || 0) < 300 || Number(info.height || 0) < 300) throw Object.assign(new Error(), { code: 'too_small' })
        const uploaded = await uploadImage({ filePath: path, scene: `pattern_structure_${key}`, assetType: 'garment_image' })
        const stableUrl = String(uploaded.fileId || uploaded.fileID || uploaded.fileUrl || uploaded.imageUrl || '').trim()
        if (!/^(cloud:\/\/|https:\/\/)/i.test(stableUrl)) throw Object.assign(new Error(), { code: 'unstable_url' })
        const assetId = String((uploaded.assetRecord && uploaded.assetRecord.assetId) || uploaded.fileId || uploaded.fileID || '').trim()
        this.images = { ...this.images, [key]: { previewUrl: stableUrl, stableUrl, assetId, status: 'ready', error: '', meta: { width: info.width, height: info.height, size: Number(file.size || 0) } } }
        uni.showToast({ title: '参考图已添加', icon: 'success' })
      } catch (error) {
        const messages = { invalid_format: '仅支持 JPG、PNG 或 WEBP 图片。', too_large: '图片不能超过 10MB。', too_small: '图片宽高至少需要 300px。', unstable_url: '图片地址暂不可用，请重试。' }
        const message = messages[error.code] || '图片上传失败，请检查网络后重试。'
        this.images = { ...this.images, [key]: { ...previous, status: previous.stableUrl ? 'ready' : 'error', error: message } }; uni.showToast({ title: message, icon: 'none' })
      }
    },
    removeReferenceImage(key) { this.images = { ...this.images, [key]: emptyImage() } },
    validateMeasurement(field) {
      const raw = this.measurements[field.key]; const errors = { ...this.measurementErrors }
      if (raw === '') delete errors[field.key]
      else { const value = Number(raw); errors[field.key] = Number.isFinite(value) && value >= field.min && value <= field.max ? '' : `${field.label}建议填写 ${field.min}-${field.max}cm` }
      this.measurementErrors = errors
    },
    selectStructure(key, value) { this.structureRequirements = { ...this.structureRequirements, [key]: value } },
    toggleOutput(item) {
      if (item.manual) uni.showToast({ title: '该项需打版师人工完善', icon: 'none' })
      this.selectedOutputs = this.selectedOutputs.includes(item.value) ? this.selectedOutputs.filter((value) => value !== item.value) : [...this.selectedOutputs, item.value]
    },
    buildTaskOptions(outputTarget, context = {}) {
      const sourceImages = {}; Object.keys(this.images).forEach((key) => { if (this.images[key].stableUrl) sourceImages[key] = this.images[key].stableUrl })
      const output = OUTPUT_OPTIONS.find((item) => item.value === outputTarget) || {}
      const params = { actionType: PATTERN_STRUCTURE_ACTION, taskType: PATTERN_STRUCTURE_ACTION, inputMode: this.inputMode, category: this.category, categoryLabel: (CATEGORIES.find((item) => item.value === this.category) || {}).label || '', outputTarget, itemType: `pattern_structure_${outputTarget}`, itemDisplayName: output.label || '打版结构参考图', outputUsage: output.label || '打版结构参考图', planId: 'pattern_structure_v1', planName: '服装打版结构资料', historyId: context.historyId, patternMasterId: context.patternMasterId || '', patternVersionId: context.patternVersionId || '', ...sourceImages, baseSize: this.baseSize, measurementBasis: this.measurementBasis, measurements: this.sanitizedMeasurements, structureRequirements: this.structureRequirements, notes: this.notes, requestedOutputs: this.selectedOutputs, outputLevel: 'reference_a', humanReviewRequired: true, productionReady: false, costActionType: 'image_to_sketch', promptDraft: '生成服装打版结构参考图，未经打版师复核不可直接生产。' }
      const assets = { clothImage: imageAsset(sourceImages.frontImage), frontImage: imageAsset(sourceImages.frontImage) }; Object.keys(sourceImages).forEach((key) => { assets[key] = imageAsset(sourceImages[key]) })
      return { type: PATTERN_STRUCTURE_ACTION, taskType: PATTERN_STRUCTURE_ACTION, channel: 'pattern_structure_center', run: { fallbackToMock: false }, input: { imageUrl: sourceImages.frontImage, image_url: sourceImages.frontImage, assets, params, options: { outputType: `pattern_structure_${outputTarget}` } }, params }
    },
    openCreatedResult() {
      if (!this.createdTaskIds.length) return
      const query = [`taskId=${encodeURIComponent(this.createdTaskIds[0])}`]; if (this.createdBatchId) query.push(`batchId=${encodeURIComponent(this.createdBatchId)}`); if (this.createdHistoryId) query.push(`historyId=${encodeURIComponent(this.createdHistoryId)}`)
      uni.navigateTo({ url: `/package-ai/result/result?${query.join('&')}`, success: () => { this.submissionStatus = 'navigated' }, fail: () => { this.submissionStatus = 'navigation_failed'; uni.showToast({ title: '任务已创建，可再次点击查看', icon: 'none' }) } })
    },
    submitPatternStructure() {
      if (this.submissionStatus === 'navigation_failed' && this.createdTaskIds.length) return this.openCreatedResult()
      if (this.submitting || this.disabledReason) return
      this.submitting = true; this.submissionStatus = 'submitting'; let history = null; let plan = null
      try {
        const categoryLabel = (CATEGORIES.find((item) => item.value === this.category) || {}).label || ''
        history = createWorkspacePlanHistory({ planId: 'pattern_structure_v1', cost: 0 })
        if (this.saveAsPattern) plan = createPatternStructurePlan({
          category: this.category, categoryLabel, inputMode: this.inputMode,
          sourceImages: Object.keys(this.images).reduce((result, key) => ({ ...result, ...(this.images[key].stableUrl ? { [key]: this.images[key].stableUrl } : {}) }), {}),
          frontImageAssetId: this.images.frontImage.assetId, backImageAssetId: this.images.backImage.assetId,
          sideImageAssetIds: [this.images.sideImage.assetId].filter(Boolean), detailImageAssetIds: [],
          sketchAssetId: this.images.structureSketch.assetId || this.images.designSketch.assetId,
          baseSize: this.baseSize, measurementBasis: this.measurementBasis, measurements: this.sanitizedMeasurements,
          structureRequirements: this.structureRequirements, notes: this.notes, requestedOutputs: this.selectedOutputs, historyId: history.historyId
        })
        const context = { historyId: history.historyId, patternMasterId: plan && plan.master ? plan.master.patternMasterId : '', patternVersionId: plan && plan.version ? plan.version.versionId : '' }
        const batch = createBatchTasks({ children: this.selectedVisualOutputs.map((output) => this.buildTaskOptions(output, context)) })
        this.createdTaskIds = batch.taskIds || []; this.createdBatchId = batch.batchId || ''; this.createdHistoryId = history.historyId; this.createdPatternMasterId = context.patternMasterId
        linkWorkspacePlanTasks(history.historyId, this.createdTaskIds)
        if (context.patternMasterId) linkPatternStructureGeneration(context.patternMasterId, { historyId: history.historyId, batchId: batch.batchId, taskIds: this.createdTaskIds, status: 'generating' })
        this.submissionStatus = 'created'
        console.info('[pattern-structure:create]', { inputMode: this.inputMode, category: this.category, referenceCount: Object.values(this.images).filter((item) => item.stableUrl).length, taskCount: this.createdTaskIds.length, hasMeasurements: Object.keys(this.sanitizedMeasurements).length > 0, savedAsPattern: Boolean(context.patternMasterId), productionReady: false })
        this.openCreatedResult()
      } catch (error) {
        if (history && history.historyId) failWorkspacePlanHistory(history.historyId)
        if (plan && plan.master) linkPatternStructureGeneration(plan.master.patternMasterId, { status: 'failed' })
        this.submissionStatus = 'failed'; uni.showToast({ title: '打版任务创建失败，请保留当前资料后重试。', icon: 'none' })
      } finally { this.submitting = false }
    }
  }
}
</script>

<style scoped>
.pattern-page{min-height:100vh;padding:24rpx 24rpx 0;background:#f5f6fa;box-sizing:border-box;color:#1f2937}.review-warning{margin-bottom:24rpx;padding:22rpx 24rpx;border-left:6rpx solid #b76e00;border-radius:12rpx;background:#fff8e8}.review-warning-title,.review-warning-copy{display:block}.review-warning-title{color:#8a5200;font-size:27rpx;font-weight:700}.review-warning-copy{margin-top:8rpx;color:#765f39;font-size:23rpx;line-height:1.55}.form-section{margin-bottom:24rpx;padding:28rpx;border:1rpx solid #e7eaf0;border-radius:24rpx;background:#fff}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-bottom:24rpx}.section-heading>view{display:flex;align-items:center;gap:12rpx;min-width:0}.step-index{display:flex;align-items:center;justify-content:center;width:40rpx;height:40rpx;border-radius:10rpx;background:#eaf4ff;color:#1677ff;font-size:22rpx;font-weight:700}.section-title{font-size:30rpx;font-weight:700}.section-note,.required-text{color:#7b8495;font-size:21rpx}.required-text{color:#c2410c;font-weight:600}.upload-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18rpx}.upload-card{position:relative;min-height:248rpx;overflow:hidden;border:2rpx dashed #c8d0dc;border-radius:18rpx;background:#f8fafc;box-sizing:border-box}.upload-card:first-child{grid-column:1/-1;min-height:330rpx}.upload-card.required{border-color:#8fc7ff}.upload-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:inherit;padding:24rpx}.upload-symbol{color:#1677ff;font-size:52rpx}.upload-label{margin-top:12rpx;font-size:25rpx;font-weight:650}.upload-hint{margin-top:8rpx;color:#7b8495;font-size:21rpx}.upload-preview{width:100%;height:280rpx;background:#eef2f7}.upload-card:first-child .upload-preview{height:360rpx}.upload-actions{display:flex;justify-content:flex-end;gap:28rpx;padding:16rpx 18rpx;color:#1677ff;font-size:23rpx;font-weight:600}.upload-actions text:last-child{color:#b42318}.upload-mask{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.84);color:#1677ff;font-size:24rpx;font-weight:600}.field-error{display:block;padding:8rpx 12rpx;color:#b42318;font-size:20rpx}.option-stack,.output-list{display:flex;flex-direction:column;gap:14rpx}.mode-option,.output-option{display:flex;align-items:center;justify-content:space-between;gap:16rpx;min-height:94rpx;padding:17rpx 21rpx;border:1rpx solid #dce1e8;border-radius:16rpx}.mode-option.active,.output-option.active{border-color:#1677ff;background:#edf6ff}.option-title,.option-desc,.output-copy text{display:block}.option-title,.output-copy text:first-child{font-size:25rpx;font-weight:650}.option-desc,.output-copy text:last-child{margin-top:6rpx;color:#6b7280;font-size:22rpx}.option-check,.chip-check{color:#1677ff;font-weight:800}.chip-grid{display:flex;flex-wrap:wrap;gap:14rpx}.choice-chip{display:flex;align-items:center;justify-content:center;gap:8rpx;min-width:142rpx;min-height:76rpx;padding:0 22rpx;border:1rpx solid #dce1e8;border-radius:14rpx;background:#fff;font-size:24rpx;box-sizing:border-box}.choice-chip.active{border-color:#1677ff;background:#edf6ff;color:#1167d8;font-weight:650}.compact .choice-chip{min-width:126rpx;min-height:68rpx}.segmented-control{display:grid;grid-template-columns:1fr 1fr;margin-bottom:22rpx;padding:6rpx;border-radius:14rpx;background:#eef2f7}.segmented-control view{padding:16rpx;border-radius:10rpx;text-align:center;color:#667085;font-size:23rpx}.segmented-control view.active{background:#fff;color:#1677ff;font-weight:650}.size-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-bottom:22rpx}.field-label{display:block;margin-bottom:12rpx;font-size:25rpx;font-weight:650}.size-row .field-label{margin:0}.size-options{display:flex;gap:10rpx}.size-options text{min-width:62rpx;padding:12rpx 10rpx;border:1rpx solid #dce1e8;border-radius:10rpx;text-align:center;font-size:22rpx}.size-options text.active{border-color:#1677ff;background:#1677ff;color:#fff}.measurement-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18rpx}.measurement-field>text:first-child{display:block;margin-bottom:8rpx;color:#4b5563;font-size:22rpx}.measurement-field>view{display:flex;align-items:center;min-height:76rpx;padding:0 16rpx;border:1rpx solid #dce1e8;border-radius:12rpx}.measurement-field input{min-width:0;flex:1;font-size:24rpx}.measurement-field>view text{color:#7b8495;font-size:21rpx}.measurement-tip{display:block;margin-top:18rpx;color:#7b8495;font-size:21rpx;line-height:1.5}.structure-field+.structure-field{margin-top:24rpx}.notes-input{width:100%;height:180rpx;margin-top:24rpx;padding:18rpx;border:1rpx solid #dce1e8;border-radius:14rpx;background:#fafbfc;font-size:24rpx;line-height:1.5;box-sizing:border-box}.char-count{display:block;margin-top:8rpx;color:#98a2b3;font-size:20rpx;text-align:right}.output-check{display:flex;align-items:center;justify-content:center;width:38rpx;height:38rpx;border:1rpx solid #b8c1ce;border-radius:8rpx;color:#1677ff}.output-copy{min-width:0;flex:1}.output-state{flex-shrink:0;color:#1677ff;font-size:20rpx}.output-state.manual{color:#a15c00}.save-plan-row{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-top:24rpx;padding-top:22rpx;border-top:1rpx solid #edf0f4}.save-plan-title,.save-plan-desc{display:block}.save-plan-title{font-size:25rpx;font-weight:650}.save-plan-desc{margin-top:6rpx;color:#7b8495;font-size:21rpx;line-height:1.45}.page-bottom-space{height:calc(150rpx + env(safe-area-inset-bottom))}@media screen and (max-width:350px){.pattern-page{padding-right:18rpx;padding-left:18rpx}.form-section{padding:22rpx}.measurement-grid{grid-template-columns:1fr}.choice-chip{min-width:126rpx;padding:0 16rpx}.output-state{display:none}}
</style>
