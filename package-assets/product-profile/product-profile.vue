<template>
  <view class="page">
    <view class="summary-card">
      <view><text class="page-title">商品资料档案</text><text class="summary-text">已确认 {{ completeness.confirmed }}/{{ completeness.total }} 项</text></view>
      <view class="summary-tags"><text v-for="item in completeness.missing" :key="item">{{ item }}</text></view>
    </view>

    <view v-for="group in fieldGroups" :key="group.title" class="section-card">
      <text class="section-title">{{ group.title }}</text>
      <view v-for="field in group.fields" :key="field.key" class="field-row">
        <view class="field-head"><text>{{ field.label }}</text><text :class="['field-state', { confirmed: form[field.key].confirmed }]">{{ form[field.key].confirmed ? '已确认' : (form[field.key].value ? '待确认' : '待补充') }}</text></view>
        <textarea v-if="field.multiline" v-model.trim="form[field.key].value" class="textarea" :placeholder="field.placeholder || `填写${field.label}`" @input="markManual(field.key)" />
        <input v-else v-model.trim="form[field.key].value" class="input" :placeholder="field.placeholder || `填写${field.label}`" @input="markManual(field.key)" />
        <view class="field-meta"><text>来源：{{ sourceLabel(form[field.key].source) }}</text><button v-if="form[field.key].value" class="confirm-link" @click="toggleFieldConfirmation(field.key)">{{ form[field.key].confirmed ? '取消确认' : '确认信息' }}</button></view>
      </view>
    </view>

    <view class="section-card">
      <view class="section-head"><view><text class="section-title">尺码表</text><text class="section-desc">OCR结果必须逐项核对，系统不会补写任何尺码数值。</text></view><button class="minor-btn" @click="uploadSizeChartImage">上传尺码表</button></view>
      <view v-if="sizeChart.sourceImageAssetId" class="ocr-state">{{ sizeChart.ocrStatus === 'recognized_needs_confirmation' ? '已识别，请核对后确认' : '当前未配置OCR识别服务，请按原图手动录入' }}</view>
      <view class="size-toolbar">
        <picker :range="['cm', 'inch']" :value="sizeChart.unit === 'inch' ? 1 : 0" @change="changeUnit"><view class="picker-control">单位：{{ sizeChart.unit }}</view></picker>
        <button class="minor-btn" @click="addSizeColumn">增加列</button><button class="minor-btn" @click="addSizeRow">增加行</button>
      </view>
      <scroll-view scroll-x class="size-scroll">
        <view class="size-table" :style="{ gridTemplateColumns: `repeat(${sizeChart.columns.length}, 170rpx) 90rpx` }">
          <view v-for="column in sizeChart.columns" :key="column.key" class="size-head-cell"><input v-model.trim="column.label" @input="markSizeUnconfirmed" /><text v-if="column.key !== 'size'" @click="removeSizeColumn(column.key)">删除</text></view><view class="size-head-cell">操作</view>
          <template v-for="(row, rowIndex) in sizeChart.rows" :key="row.rowId || row.size || rowIndex">
            <input v-for="column in sizeChart.columns" :key="`${rowIndex}_${column.key}`" v-model.trim="row[column.key]" class="size-cell" :type="column.type === 'number' ? 'digit' : 'text'" @input="markSizeUnconfirmed" />
            <text class="remove-cell" @click="removeSizeRow(rowIndex)">删除</text>
          </template>
        </view>
      </scroll-view>
      <textarea v-model.trim="sizeChart.measurementNotes" class="textarea compact" placeholder="测量方式、误差范围等真实说明" @input="markSizeUnconfirmed" />
      <text v-if="sizeError" class="error-text">{{ sizeError }}</text>
      <view class="size-actions"><button class="minor-btn" @click="saveSizeTemplate">保存为常用模板</button><button :class="['confirm-btn', { confirmed: sizeChart.confirmed }]" @click="confirmCurrentSizeChart">{{ sizeChart.confirmed ? '尺码表已确认' : '确认尺码表' }}</button></view>
    </view>

    <view class="section-card">
      <view class="section-head"><view><text class="section-title">商品素材</text><text class="section-desc">同款不同色不会自动复制图片和色值。</text></view><button class="minor-btn" @click="uploadProductAssets">上传资料图片</button></view>
      <view class="asset-list"><text v-for="assetId in sourceAssetIds" :key="assetId">已保存素材 {{ shortId(assetId) }}</text><text v-if="!sourceAssetIds.length">暂未上传</text></view>
    </view>

    <view class="section-card">
      <text class="section-title">信息确认</text>
      <text class="section-desc">AI识别和OCR内容仅作为待确认建议；正式详情长图只读取已确认字段。</text>
      <view class="action-grid"><button class="minor-btn" @click="copyCurrent">复制商品档案</button><button class="minor-btn" @click="createColorVariant">创建同款异色</button><button class="minor-btn" @click="openSkuBatch">同款多色详情长图</button><button class="minor-btn" @click="copyFromHistory">从历史作品复制</button><button class="minor-btn" @click="showVersions">查看版本记录</button></view>
    </view>

    <view class="bottom-bar"><text v-if="saveError" class="error-text">{{ saveError }}</text><button class="save-btn" :disabled="saving" @click="saveProfile">{{ saving ? '保存中...' : '保存商品档案版本' }}</button></view>
  </view>
</template>

<script>
import { uploadImage } from '../../utils/api/upload'
import { listTasks } from '../../utils/task/taskLayer'
import {
  DEFAULT_SIZE_COLUMNS,
  PRODUCT_PROFILE_FIELD_DEFINITIONS,
  PRODUCT_PROFILE_SELECTION_KEY,
  confirmSizeChart,
  convertSizeChartUnit,
  copyProductProfile,
  createProductProfileVersion,
  createProfileField,
  createSizeChartOcrDraft,
  getProductProfile,
  getSizeChart,
  listProductProfileVersions,
  restoreProductProfileVersion,
  saveProductProfile,
  saveSizeChart,
  saveSizeChartTemplate,
  validateSizeChart
} from '../../utils/product/productProfileRepository'

const GROUPS = [
  { title: '商品基本信息', keys: ['productName', 'productCode', 'category', 'gender', 'season'] },
  { title: '款式与版型', keys: ['fitType', 'neckType', 'sleeveType', 'sleeveLength', 'garmentLength', 'pattern'] },
  { title: '面料与工艺', keys: ['fabricComposition', 'fabricDescription', 'craftsmanship', 'decoration'] },
  { title: '颜色信息', keys: ['colorName', 'colorHex'] },
  { title: '商品卖点', keys: ['sellingPoints'] },
  { title: '洗护说明', keys: ['careInstruction'] }
]

function emptySizeChart(productId = '') {
  return { sizeChartId: '', productId, sizeSystem: 'CN', unit: 'cm', columns: DEFAULT_SIZE_COLUMNS.map((item) => ({ ...item })), rows: [{ size: '', garmentLength: '', bust: '', shoulder: '', sleeveLength: '' }], measurementNotes: '', sourceImageAssetId: '', ocrRawData: null, ocrStatus: 'not_requested', confirmed: false, version: 1 }
}

export default {
  data() {
    const form = {}
    PRODUCT_PROFILE_FIELD_DEFINITIONS.forEach(({ key }) => { form[key] = createProfileField('', { source: 'manual', confirmed: false }) })
    return { productId: '', profileVersion: 0, form, sizeChart: emptySizeChart(), sourceAssetIds: [], saving: false, saveError: '', sizeError: '', selectMode: false }
  },
  computed: {
    fieldGroups() {
      const definitions = Object.fromEntries(PRODUCT_PROFILE_FIELD_DEFINITIONS.map((item) => [item.key, item]))
      return GROUPS.map((group) => ({ ...group, fields: group.keys.map((key) => ({ ...definitions[key], multiline: ['fabricDescription', 'craftsmanship', 'decoration', 'sellingPoints', 'careInstruction'].includes(key) })) }))
    },
    completeness() {
      const values = PRODUCT_PROFILE_FIELD_DEFINITIONS.map(({ key, label }) => ({ key, label, ...this.form[key] })).filter((item) => item.value)
      const confirmed = values.filter((item) => item.confirmed).length
      const missing = []
      if (!this.sizeChart.confirmed) missing.push(this.sizeChart.rows.some((row) => Object.values(row).some(Boolean)) ? '尺码表待确认' : '缺少尺码表')
      if (this.form.fabricComposition.value && !this.form.fabricComposition.confirmed) missing.push('面料成分待确认')
      return { confirmed, total: PRODUCT_PROFILE_FIELD_DEFINITIONS.length, missing }
    }
  },
  onLoad(query = {}) {
    this.selectMode = String(query.select || '') === '1'
    const productId = query.productId ? decodeURIComponent(query.productId) : ''
    if (productId) this.loadProfile(productId)
  },
  methods: {
    sourceLabel(source) { return ({ manual: '手动填写', image_ocr: '图片OCR', ai_detected: 'AI建议', imported: '历史导入' })[source] || '手动填写' },
    shortId(value) { const text = String(value || ''); return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text },
    markManual(key) { this.form[key] = { ...this.form[key], source: 'manual', confidence: 1, confirmed: false, confirmedAt: '' } },
    toggleFieldConfirmation(key) { const field = this.form[key]; field.confirmed = !field.confirmed; field.confirmedAt = field.confirmed ? new Date().toISOString() : ''; field.confidence = field.confirmed ? 1 : field.confidence; this.form = { ...this.form } },
    loadProfile(productId) {
      const profile = getProductProfile(productId)
      if (!profile) return uni.showToast({ title: '商品档案不存在或无权访问', icon: 'none' })
      this.productId = profile.productId; this.profileVersion = profile.version; this.sourceAssetIds = profile.sourceAssetIds || []
      PRODUCT_PROFILE_FIELD_DEFINITIONS.forEach(({ key }) => { this.form[key] = { ...createProfileField('', {}), ...(profile[key] || {}) } })
      this.sizeChart = profile.sizeChartId ? (getSizeChart(profile.sizeChartId) || emptySizeChart(profile.productId)) : emptySizeChart(profile.productId)
    },
    chooseImage(count = 1) { return new Promise((resolve, reject) => uni.chooseImage({ count, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject })) },
    async uploadProductAssets() {
      try {
        const result = await this.chooseImage(6)
        uni.showLoading({ title: '上传中' })
        for (const path of result.tempFilePaths || []) {
          const uploaded = await uploadImage({ filePath: path, assetType: 'product_profile_source', targetType: 'product_profile', targetId: this.productId || 'draft', relation: 'source_material', scene: 'product_profile' })
          if (uploaded.fileId) this.sourceAssetIds.push(uploaded.fileId)
        }
        this.sourceAssetIds = Array.from(new Set(this.sourceAssetIds))
      } catch (error) { if (!/cancel/i.test(String(error.errMsg || ''))) uni.showToast({ title: '商品资料上传失败', icon: 'none' }) } finally { uni.hideLoading() }
    },
    async uploadSizeChartImage() {
      try {
        const result = await this.chooseImage(1); const path = (result.tempFilePaths || [])[0]; if (!path) return
        uni.showLoading({ title: '上传中' })
        const uploaded = await uploadImage({ filePath: path, assetType: 'size_chart_image', targetType: 'product_profile', targetId: this.productId || 'draft', relation: 'size_chart_source', scene: 'product_profile' })
        const raw = uploaded.raw && (uploaded.raw.ocrData || uploaded.raw.ocr_data)
        this.sizeChart = createSizeChartOcrDraft({ ...this.sizeChart, productId: this.productId, sourceImageAssetId: (uploaded.assetRecord && uploaded.assetRecord.fileId) || uploaded.fileId, ocrRawData: raw || null })
        this.sizeError = this.sizeChart.ocrStatus === 'recognized_needs_confirmation' ? '' : '当前未取得OCR结果，请参照原图手动录入。'
      } catch (error) { if (!/cancel/i.test(String(error.errMsg || ''))) uni.showToast({ title: '尺码表上传失败', icon: 'none' }) } finally { uni.hideLoading() }
    },
    markSizeUnconfirmed() { this.sizeChart.confirmed = false; this.sizeChart.confirmedAt = ''; this.sizeError = '' },
    addSizeRow() { const row = {}; this.sizeChart.columns.forEach((column) => { row[column.key] = '' }); this.sizeChart.rows.push(row); this.markSizeUnconfirmed() },
    removeSizeRow(index) { this.sizeChart.rows.splice(index, 1); if (!this.sizeChart.rows.length) this.addSizeRow(); this.markSizeUnconfirmed() },
    addSizeColumn() { const key = `custom_${Date.now()}`; this.sizeChart.columns.push({ key, label: '自定义字段', type: 'number' }); this.sizeChart.rows.forEach((row) => { this.$set ? this.$set(row, key, '') : (row[key] = '') }); this.markSizeUnconfirmed() },
    removeSizeColumn(key) { this.sizeChart.columns = this.sizeChart.columns.filter((item) => item.key !== key); this.sizeChart.rows.forEach((row) => { delete row[key] }); this.markSizeUnconfirmed() },
    changeUnit(event) { const next = Number(event.detail.value) === 1 ? 'inch' : 'cm'; this.sizeChart = convertSizeChartUnit(this.sizeChart, next) },
    confirmCurrentSizeChart() {
      try {
        this.sizeChart = saveSizeChart({ ...this.sizeChart, productId: this.productId, confirmed: false })
        const check = validateSizeChart({ ...this.sizeChart, confirmed: true }, this.productId)
        if (!check.ok) throw new Error(check.errors[0])
        this.sizeChart = confirmSizeChart(this.sizeChart.sizeChartId, this.productId); this.sizeError = ''; uni.showToast({ title: '尺码表已确认', icon: 'success' })
      } catch (error) { this.sizeError = error.message || '尺码表确认失败' }
    },
    saveSizeTemplate() { try { saveSizeChartTemplate(this.sizeChart, `${this.form.productName.value || '商品'}尺码模板`); uni.showToast({ title: '尺码模板已保存', icon: 'success' }) } catch (error) { this.sizeError = error.message } },
    profilePayload() { return { productId: this.productId, version: this.profileVersion || 1, sizeChartId: this.sizeChart.sizeChartId, sourceAssetIds: this.sourceAssetIds, ...Object.fromEntries(PRODUCT_PROFILE_FIELD_DEFINITIONS.map(({ key }) => [key, this.form[key]])) } },
    async saveProfile() {
      if (this.saving) return
      if (!this.form.productName.value || !this.form.productName.confirmed) { this.saveError = '请填写并确认商品名称'; return }
      this.saving = true; this.saveError = ''
      try {
        let profile = saveProductProfile(this.profilePayload())
        if (this.sizeChart.sizeChartId) { this.sizeChart = saveSizeChart({ ...this.sizeChart, productId: profile.productId }); profile = saveProductProfile({ ...profile, sizeChartId: this.sizeChart.sizeChartId }) }
        const versioned = createProductProfileVersion(profile.productId)
        this.productId = versioned.profile.productId; this.profileVersion = versioned.profile.version
        if (this.selectMode) { uni.setStorageSync(PRODUCT_PROFILE_SELECTION_KEY, { productId: this.productId, version: this.profileVersion }); uni.navigateBack(); return }
        uni.showToast({ title: '商品档案版本已保存', icon: 'success' })
      } catch (error) { this.saveError = error.message || '商品档案保存失败' } finally { this.saving = false }
    },
    copyCurrent() { if (!this.productId) return uni.showToast({ title: '请先保存商品档案', icon: 'none' }); const copied = copyProductProfile(this.productId); this.loadProfile(copied.productId); uni.showToast({ title: '已创建档案副本', icon: 'success' }) },
    createColorVariant() { if (!this.productId) return uni.showToast({ title: '请先保存商品档案', icon: 'none' }); const copied = copyProductProfile(this.productId, { colorVariant: true }); this.loadProfile(copied.productId); uni.showToast({ title: '已创建同款异色档案', icon: 'success' }) },
    openSkuBatch() { if (!this.productId) return uni.showToast({ title: '请先保存商品档案', icon: 'none' }); uni.navigateTo({ url: `/package-ai/detail-sku-batch/detail-sku-batch?productId=${encodeURIComponent(this.productId)}` }) },
    copyFromHistory() {
      const snapshots = listTasks().map((task) => (((task.input || {}).params || {}).productProfileSnapshot)).filter((item) => item && item.profile)
      if (!snapshots.length) return uni.showToast({ title: '暂无可复用的历史商品档案', icon: 'none' })
      uni.showActionSheet({ itemList: snapshots.slice(0, 10).map((item) => (item.profile.productName || {}).value || '历史商品'), success: ({ tapIndex }) => { const source = snapshots[tapIndex].profile; const copied = saveProductProfile({ ...source, productId: '', profileVersionId: '', version: 1, ...Object.fromEntries(PRODUCT_PROFILE_FIELD_DEFINITIONS.map(({ key }) => [key, { ...source[key], source: 'imported' }])) }); this.loadProfile(copied.productId) } })
    },
    showVersions() {
      if (!this.productId) return uni.showToast({ title: '请先保存商品档案', icon: 'none' })
      const versions = listProductProfileVersions(this.productId)
      if (!versions.length) return uni.showToast({ title: '暂无历史版本', icon: 'none' })
      uni.showActionSheet({ itemList: versions.slice(0, 12).map((item) => `V${item.version} · ${String(item.snapshotAt || item.updatedAt).slice(0, 10)}`), success: ({ tapIndex }) => {
        const restored = restoreProductProfileVersion(this.productId, versions[tapIndex].version)
        this.loadProfile(restored.profile.productId)
        uni.showToast({ title: '已恢复并创建新版本', icon: 'success' })
      } })
    }
  }
}
</script>

<style scoped>
.page{min-height:100vh;padding:24rpx 24rpx calc(150rpx + env(safe-area-inset-bottom));background:#f5f6fa;color:#1d2939;box-sizing:border-box}.summary-card,.section-card{margin-bottom:20rpx;padding:26rpx;border:1rpx solid #e4e7ec;border-radius:16px;background:#fff}.summary-card,.section-head,.field-head,.field-meta,.size-toolbar,.size-actions{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.page-title,.section-title{display:block;font-size:31rpx;font-weight:700}.summary-text,.section-desc{display:block;margin-top:7rpx;color:#667085;font-size:22rpx;line-height:1.5}.summary-tags{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8rpx}.summary-tags text,.ocr-state{padding:8rpx 12rpx;border-radius:10rpx;background:#fff4e8;color:#b54708;font-size:20rpx}.field-row{padding:18rpx 0;border-bottom:1rpx solid #eaecf0}.field-row:last-child{border-bottom:0}.field-head{align-items:center;font-size:24rpx;font-weight:600}.field-state{color:#b54708;font-size:20rpx;font-weight:400}.field-state.confirmed{color:#067647}.input,.textarea{width:100%;margin-top:10rpx;border-radius:12rpx;background:#f7f8fa;font-size:24rpx;box-sizing:border-box}.input{height:76rpx;padding:0 16rpx}.textarea{height:120rpx;padding:16rpx;line-height:1.45}.textarea.compact{height:90rpx}.field-meta{align-items:center;margin-top:8rpx;color:#667085;font-size:19rpx}.confirm-link,.minor-btn,.confirm-btn{min-height:60rpx;margin:0;padding:0 16rpx;border:1rpx solid #b9c8dc;border-radius:10rpx;background:#fff;color:#1677ff;font-size:20rpx;line-height:58rpx}.confirm-link{border:0}.ocr-state{margin:16rpx 0}.size-toolbar{align-items:center;justify-content:flex-start;flex-wrap:wrap;margin:18rpx 0}.picker-control{min-height:60rpx;padding:0 18rpx;border:1rpx solid #d0d5dd;border-radius:10rpx;line-height:60rpx}.size-scroll{width:100%}.size-table{display:grid;min-width:900rpx}.size-head-cell,.size-cell,.remove-cell{min-height:70rpx;padding:0 10rpx;border-right:1rpx solid #eaecf0;border-bottom:1rpx solid #eaecf0;font-size:21rpx;line-height:70rpx;box-sizing:border-box}.size-head-cell{background:#f7f8fa;font-weight:600}.size-head-cell input{height:44rpx;font-size:20rpx}.size-head-cell text,.remove-cell{color:#d92d20;font-size:18rpx}.confirm-btn{background:#1677ff;color:#fff}.confirm-btn.confirmed{background:#12b76a}.error-text{display:block;margin-top:10rpx;color:#d92d20;font-size:21rpx}.asset-list{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:16rpx}.asset-list text{padding:9rpx 12rpx;border-radius:10rpx;background:#f2f4f7;color:#475467;font-size:20rpx}.action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx;margin-top:18rpx}.bottom-bar{position:fixed;z-index:10;right:0;bottom:0;left:0;padding:14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));border-top:1rpx solid #eaecf0;background:rgba(255,255,255,.98)}.save-btn{height:82rpx;margin:0;border-radius:14rpx;background:#1677ff;color:#fff;font-size:26rpx;font-weight:700;line-height:82rpx}.save-btn[disabled]{opacity:.55}
</style>
