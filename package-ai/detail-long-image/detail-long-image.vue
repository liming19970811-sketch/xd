<template>
  <view class="page">
    <view class="step-bar">
      <view v-for="(step, index) in steps" :key="step" class="step" :class="{ active: currentStep === index, done: currentStep > index }">
        <text class="step-index">{{ currentStep > index ? '✓' : index + 1 }}</text>
        <text class="step-name">{{ step }}</text>
      </view>
    </view>

    <view class="content">
      <view v-if="currentStep === 0" class="section">
        <view class="section-head">
          <view>
            <text class="section-title">上传商品素材</text>
            <text class="section-desc">最多 12 张真实商品图片，每张图片都可以标记用途。</text>
          </view>
          <text class="count-text">{{ totalAssetCount }}/12</text>
        </view>

        <view class="product-profile-card">
          <view>
            <text class="subsection-title">商品资料档案</text>
            <text v-if="selectedProductProfile" class="helper">{{ selectedProductProfile.productName.value }} · V{{ productProfileVersion }} · {{ selectedProductProfile.confirmationStatus === 'confirmed' ? '已确认' : '仍有待确认信息' }}</text>
            <text v-else class="helper">正式详情长图必须关联真实商品档案</text>
          </view>
          <view class="profile-actions"><button class="minor-btn" @click="chooseProductProfile">{{ selectedProductProfile ? '更换档案' : '选择档案' }}</button><button class="minor-btn" @click="editProductProfile">{{ selectedProductProfile ? '编辑档案' : '新建档案' }}</button></view>
        </view>

        <view v-if="!primaryAsset.fileId" class="upload-card main-upload" @click="choosePrimaryImage">
          <text class="upload-icon">+</text>
          <text class="upload-title">上传商品正面图</text>
          <text class="upload-tip">必填，建议商品主体完整且清晰</text>
        </view>
        <view v-else class="source-card primary-source">
          <image :src="assetPreview(primaryAsset)" mode="aspectFit" @click="previewAsset(primaryAsset)" />
          <view class="source-info">
            <text class="source-purpose">商品正面图</text>
            <text class="source-note">原始上传，不重新绘制服装</text>
          </view>
          <view class="source-actions"><text @click="choosePrimaryImage">更换</text><text class="danger" @click="removePrimaryImage">删除</text></view>
        </view>

        <view class="subsection-head"><text>补充商品图片</text><text class="helper-inline">建议上传背面、平铺、面料和细节图</text></view>
        <view class="asset-grid">
          <view v-for="(asset, index) in assets" :key="asset.assetId || asset.fileId" class="source-card asset-card">
            <image :src="assetPreview(asset)" mode="aspectFit" @click="previewAsset(asset)" />
            <view class="source-info" @click="changeAssetUsage(asset)">
              <text class="source-purpose">{{ assetUsageLabel(asset.usage) }}</text>
              <text class="source-note">点击修改图片用途</text>
            </view>
            <view class="asset-order"><text :class="{ muted: index === 0 }" @click="moveAsset(index, -1)">上移</text><text :class="{ muted: index === assets.length - 1 }" @click="moveAsset(index, 1)">下移</text><text class="danger" @click="removeAsset(index)">删除</text></view>
          </view>
          <view v-if="canAddAsset" class="source-card add-card" @click="chooseSupplementImages"><text class="upload-icon">+</text><text>添加补充图片</text></view>
        </view>
        <view v-if="!selectedProductProfile" class="basic-info-card">
          <text class="subsection-title">补充少量商品信息</text>
          <text class="helper">只填写已经确认的内容，未填写的信息不会由系统虚构。</text>
          <input v-model.trim="productFactInputs.productName" placeholder="商品名称（建议填写）" />
          <view class="basic-info-grid">
            <input v-model.trim="productFactInputs.category" placeholder="商品大类，如连衣裙" />
            <input v-model.trim="productFactInputs.color" placeholder="确认颜色" />
            <input v-model.trim="productFactInputs.materialComposition" placeholder="确认面料成分（可选）" />
            <input v-model.trim="productFactInputs.usageScene" placeholder="适用场景（可选）" />
          </view>
          <textarea v-model.trim="productFactInputs.sellingPoints" placeholder="已确认的真实卖点，用逗号分隔" maxlength="240" />
        </view>
        <view v-else class="basic-info-card"><text class="subsection-title">商品信息来自档案</text><text class="helper">名称、面料、版型、卖点、尺码和洗护信息均锁定为档案 V{{ productProfileVersion }} 的已确认数据。</text></view>
        <view class="truth-note">图片仅用于裁切、缩放、清晰度增强和模板排版，不会改动服装版型、颜色、图案或五金细节。</view>
      </view>

      <view v-if="currentStep === 1" class="section">
        <view class="section-head">
          <view><text class="section-title">AI整理结果</text><text class="section-desc">系统只整理已有素材和已确认信息，不重绘商品，也不补写未知参数。</text></view>
          <button class="minor-btn" :disabled="organizing" @click="runAutoOrganize">{{ organizing ? '整理中...' : '重新整理' }}</button>
        </view>
        <view class="organize-summary"><text>内容版本 V{{ contentVersion || 1 }}</text><text>{{ pendingClassifications.length ? `${pendingClassifications.length} 张素材待确认` : '素材用途已确认' }}</text><text>{{ unresolvedFields.length }} 项待补充</text></view>

        <view class="review-block">
          <view class="review-title"><text>模块与图片匹配</text><text>{{ confirmedClassifications.length }}/{{ assetClassifications.length }} 已确认</text></view>
          <view v-for="item in assetClassifications" :key="item.assetId" class="classification-row">
            <image :src="classificationPreview(item)" mode="aspectFill" />
            <view><text>{{ assetTypeLabel(item.assetType) }}</text><text>{{ item.userConfirmed ? '已确认' : `待确认 · 置信度 ${Math.round(item.confidence * 100)}%` }}</text><text v-if="item.detectedDetails.length">{{ item.detectedDetails.join('、') }}</text></view>
            <text class="review-action" @click="confirmClassification(item)">{{ item.userConfirmed ? '修改' : '确认用途' }}</text>
          </view>
        </view>

        <view class="review-block">
          <view class="review-title"><text>已确认内容</text><text>{{ confirmedFacts.length }} 项</text></view>
          <view v-if="confirmedFacts.length" class="fact-list"><text v-for="item in confirmedFacts" :key="item.fieldId">{{ item.label }}：{{ item.value }}</text></view>
          <text v-else class="empty-review">暂未填写已确认商品信息</text>
        </view>

        <view class="review-block">
          <view class="review-title"><text>待确认与缺失信息</text><text>不会进入正式文案</text></view>
          <view class="unresolved-list"><text v-for="item in unresolvedFields" :key="item.fieldId" :class="{ risk: item.risk === 'high' }">{{ item.label }} · {{ item.reason }}</text></view>
        </view>

        <view class="review-block">
          <view class="review-title"><text>文案预览</text><text>仅来自已确认字段</text></view>
          <view v-if="generatedCopy.length" class="copy-list">
            <view v-for="item in generatedCopy" :key="item.copyId"><text>{{ item.title }}</text><textarea v-model="item.content" maxlength="300" @input="markCopyEdited(item)" /><text>来源：{{ copySourceLabels(item) }}</text></view>
          </view>
          <text v-else class="empty-review">请先补充商品名称或真实卖点</text>
        </view>

        <view class="selection-summary">AI推荐 {{ recommendedModuleIds.length }} 个模块；当前已选择 {{ enabledModules.length }} 个，预计生成 {{ estimatedSegments }} 张详情长图。</view>
        <view class="module-grid">
          <view v-for="module in modules" :key="module.id" class="module-card" :class="{ selected: module.enabled }" @click="toggleModule(module)">
            <view class="module-card-head"><text class="module-title">{{ module.title }}</text><text class="module-check">{{ module.enabled ? '✓' : '' }}</text></view>
            <text class="module-desc">{{ module.description }}</text>
            <view class="module-card-foot"><text v-if="module.required" class="required">必选</text><text :class="['module-status', moduleStatus(module).key]">{{ moduleStatus(module).label }}</text></view>
          </view>
        </view>
        <view class="organize-actions"><button class="secondary-btn compact" @click="applyOrganization">采用AI整理</button><button class="secondary-btn compact" @click="currentStep = 2">修改内容</button><button class="primary-btn compact" @click="acceptOrganization">进入长图预览</button></view>
      </view>

      <view v-if="currentStep === 2" class="section">
        <view class="section-head"><view><text class="section-title">编辑真实内容</text><text class="section-desc">图片、文字和尺码都以你确认的内容为准。</text></view></view>

        <view class="choice-block">
          <text class="choice-title">详情页模板</text>
          <view class="choice-row"><text v-for="item in templates" :key="item.id" :class="['choice-chip', { active: templateId === item.id }]" @click="selectTemplate(item.id)">{{ item.name }}</text></view>
        </view>
        <view class="choice-block">
          <text class="choice-title">发布平台</text>
          <view class="choice-row"><text v-for="item in platforms" :key="item.id" :class="['choice-chip', { active: platformId === item.id }]" @click="platformId = item.id">{{ item.name }}</text></view>
          <text class="helper">平台只调整推荐宽度和排版密度，不修改商品图片。</text>
        </view>

        <view v-for="module in enabledModules" :key="module.id" class="editor-card">
          <view class="editor-head">
            <view><text class="editor-title">{{ module.title }}</text><text :class="['module-status', moduleStatus(module).key]">{{ moduleStatus(module).label }}</text></view>
            <view class="editor-order"><text @click="moveEnabledModule(module.id, -1)">上移</text><text @click="moveEnabledModule(module.id, 1)">下移</text><text v-if="!module.required" @click="module.enabled = false">隐藏</text></view>
          </view>

          <template v-if="module.kind !== 'size'">
            <view v-if="module.needsImage || module.kind === 'image' || module.kind === 'mixed'" class="module-image-picker" @click="selectModuleAsset(module)">
              <image v-if="module.fileId" :src="modulePreview(module)" mode="aspectFit" />
              <view v-else><text class="upload-icon">+</text><text>选择真实图片</text></view>
            </view>
            <view v-if="module.fileId" class="image-layout-row">
              <text>图片显示</text>
              <text :class="{ active: module.layout.imageFit === 'contain' }" @click="setModuleImageFit(module, 'contain')">完整显示</text>
              <text :class="{ active: module.layout.imageFit === 'cover' }" @click="setModuleImageFit(module, 'cover')">填满裁切</text>
              <text v-if="module.layout.imageFit === 'cover'" @click="cycleFocalPosition(module)">裁切位置：{{ focalPositionLabel(module.layout.focalPosition) }}</text>
            </view>
            <textarea v-if="module.needsText || module.kind === 'text' || module.id === 'custom'" v-model="module.text" :placeholder="modulePlaceholder(module)" maxlength="500" @input="markModuleEdited(module)" />
            <text class="field-warning">不得填写未经确认的成分、功效、认证或商品参数</text>
          </template>

          <view v-else class="size-editor">
            <view class="size-toolbar"><text>尺码数据必须逐项确认</text><button class="minor-btn" @click="chooseSizeAttachment">上传尺码表</button></view>
            <view class="size-unit-row"><text>单位</text><text :class="{ active: sizeUnit === 'cm' }" @click="setSizeUnit('cm')">厘米 cm</text><text :class="{ active: sizeUnit === 'inch' }" @click="setSizeUnit('inch')">英寸 inch</text></view>
            <view v-if="sizeAttachment.fileId" class="attachment">原始尺码附件已保存，请核对录入结果后确认。</view>
            <scroll-view scroll-x class="size-table-scroll">
              <view class="size-table">
                <view class="size-row size-head"><text v-for="field in sizeFields" :key="field.key">{{ field.label }}</text><text>操作</text></view>
                <view v-for="(row, rowIndex) in sizeRows" :key="rowIndex" class="size-row">
                  <input v-for="field in sizeFields" :key="field.key" v-model="row[field.key]" :placeholder="field.label" @input="row.confirmedByUser = false" />
                  <text class="danger" @click="removeSizeRow(rowIndex)">删除</text>
                </view>
              </view>
            </scroll-view>
            <view class="size-actions"><button class="minor-btn" @click="addSizeRow">添加尺码</button><button class="confirm-btn" :class="{ confirmed: sizeConfirmed }" @click="confirmSizeRows">{{ sizeConfirmed ? '尺码数据已确认' : '确认尺码数据' }}</button></view>
            <textarea v-model="measurementNote" class="note-input" placeholder="测量说明，例如：手工测量存在 1-2cm 误差" maxlength="120" />
          </view>
        </view>
      </view>

      <view v-if="currentStep === 3" class="section preview-section">
        <view class="section-head"><view><text class="section-title">预览并生成</text><text class="section-desc">预览图就是正式保存的排版结果，不调用通用生图模型。</text></view><button class="minor-btn" :disabled="previewing" @click="preparePreview">刷新预览</button></view>
        <view class="preview-meta"><text>{{ activeTemplate.name }}</text><text>{{ activePlatform.name }}</text><text>宽度 {{ renderWidth }}px</text><text>预计高度 {{ estimatedHeight }}px</text></view>
        <view v-if="previewing" class="preview-loading">正在生成本地预览...</view>
        <view v-else-if="previewPaths.length" class="preview-list">
          <view v-for="(path, index) in previewPaths" :key="path" class="preview-image-wrap">
            <text v-if="previewPaths.length > 1">详情长图 {{ index + 1 }}/{{ previewPaths.length }}</text>
            <image :src="path" mode="widthFix" @click="previewRendered(index)" />
          </view>
        </view>
        <view class="preview-actions"><text @click="currentStep = 1">修改模块</text><text @click="currentStep = 2">修改内容</text></view>
        <view class="risk-note">仅使用原始上传、用户选择或已确认图片；未确认的 AI 参考图和尺码不会进入正式长图。</view>
        <text v-if="renderError" class="error-message">{{ renderError }}</text>
      </view>
    </view>

    <view v-if="assetTypePickerId" class="picker-mask" @click="assetTypePickerId = ''">
      <view class="picker-sheet" @click.stop>
        <view class="picker-head"><text>选择素材用途</text><text @click="assetTypePickerId = ''">取消</text></view>
        <scroll-view scroll-y class="picker-options"><text v-for="item in assetTypes" :key="item.value" @click="selectAssetType(item)">{{ item.label }}</text></scroll-view>
      </view>
    </view>

    <canvas :id="canvasId" :canvas-id="canvasId" class="render-canvas" :style="canvasStyle" />

    <view class="bottom-bar">
      <view class="bottom-summary"><text>已选 {{ enabledModules.length }} 个模块</text><text>{{ completionText }} · 预计消耗 0 次 AI 生成额度</text></view>
      <view class="bottom-actions">
        <button v-if="currentStep > 0" class="secondary-btn" :disabled="rendering || previewing" @click="previousStep">上一步</button>
        <button v-if="notFinalStep" class="primary-btn" @click="nextStep">{{ currentStep === 2 ? '预览详情长图' : '下一步' }}</button>
        <button v-else class="primary-btn" :disabled="rendering || previewing || Boolean(finalDisabledReason)" @click="renderDetailPage">{{ rendering ? '正在保存长图...' : '生成详情长图' }}</button>
      </view>
      <text v-if="currentStep === 3 && finalDisabledReason" class="bottom-error">{{ finalDisabledReason }}</text>
    </view>
  </view>
</template>

<script>
import { uploadImage } from '../../utils/api/upload'
import {
  buildDetailPageSnapshot,
  createDetailPageModules,
  DETAIL_ASSET_USAGES,
  DETAIL_PAGE_MAX_ASSETS,
  DETAIL_PAGE_MAX_SEGMENT_HEIGHT,
  DETAIL_PAGE_PLATFORMS,
  DETAIL_PAGE_RENDER_WIDTH,
  DETAIL_PAGE_TEMPLATES,
  getDetailModuleStatus,
  SIZE_FIELDS,
  validateDetailPageDraft
} from '../../utils/detail-page/detailPageContract'
import { buildVerticalSegments, drawDetailPageSegment } from '../../utils/detail-page/detailPageRenderer'
import { createDetailPageRenderTask, failDetailPageRenderTask, repairLocalInvalidDetailPageTasks, startDetailPageRenderJob } from '../../utils/detail-page/detailPageTask'
import { createDetailPageVersion, getDetailPage, repairDetailPageRecords, saveDetailPageDraft } from '../../utils/detail-page/detailPageRepository'
import {
  DETAIL_ASSET_TYPES,
  organizeDetailContent,
  validateDetailContentTruthfulness,
  validateOrganizationForRender
} from '../../utils/detail-page/detailContentOrganizer'
import { getTask } from '../../utils/task/taskLayer'
import {
  PRODUCT_PROFILE_SELECTION_KEY,
  buildProductProfileSnapshot,
  getProductProfile,
  listProductProfiles,
  validateProductProfileForDetail
} from '../../utils/product/productProfileRepository'

const DRAFT_KEY = 'detail_page_long_image_draft_v4'
const PREVIOUS_V3_DRAFT_KEY = 'detail_page_long_image_draft_v3'
const PREVIOUS_DRAFT_KEY = 'detail_page_long_image_draft_v2'
const LEGACY_DRAFT_KEY = 'detail_page_long_image_draft_v1'

function emptyAsset(usage = 'other') {
  return { assetId: '', fileId: '', fileUrl: '', localPath: '', fileName: '', source: 'original_upload', usage, usageConfirmed: false }
}

function restoreAsset(asset = {}, fallbackUsage = 'other') {
  const stableUrl = asset.fileUrl || asset.fileId || ''
  return { ...emptyAsset(asset.usage || fallbackUsage), ...asset, localPath: '', fileUrl: stableUrl }
}

function emptySizeRow(source = 'manual') {
  return { size: '', shoulder: '', bust: '', waist: '', hip: '', sleeveLength: '', garmentLength: '', pantsLength: '', unit: 'cm', source, confirmedByUser: false }
}

function chooseImages(count = 1) {
  return new Promise((resolve, reject) => uni.chooseImage({ count, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject }))
}

function chooseSizeFile() {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['jpg', 'jpeg', 'png', 'csv', 'xls', 'xlsx'], success: resolve, fail: reject })
    // #endif
    // #ifdef H5
    uni.chooseFile({ count: 1, extension: ['.jpg', '.jpeg', '.png', '.csv', '.xls', '.xlsx'], success: resolve, fail: reject })
    // #endif
  })
}

function getImageInfo(src = '') {
  return new Promise((resolve, reject) => uni.getImageInfo({ src, success: resolve, fail: reject }))
}

export default {
  data() {
    return {
      steps: ['上传商品素材', 'AI整理结果', '编辑真实内容', '预览并生成'],
      currentStep: 0,
      detailPageId: '',
      projectId: '',
      productId: '',
      productProfileVersion: 0,
      sizeChartId: '',
      contentSnapshotId: '',
      selectedProductProfile: null,
      productProfileSnapshot: null,
      primaryAsset: emptyAsset('product_main'),
      assets: [],
      modules: createDetailPageModules(),
      templateId: DETAIL_PAGE_TEMPLATES[0].id,
      platformId: DETAIL_PAGE_PLATFORMS[0].id,
      sizeRows: [emptySizeRow()],
      sizeAttachment: emptyAsset('size_chart'),
      sizeSource: 'manual',
      sizeUnit: 'cm',
      measurementNote: '',
      sizeConfirmed: false,
      previewing: false,
      previewPaths: [],
      previewSegments: [],
      rendering: false,
      renderError: '',
      canvasId: 'detailPageRenderCanvas',
      canvasHeight: 1200,
      historyRepairSummary: null,
      productFactInputs: { productName: '', category: '', color: '', materialComposition: '', sellingPoints: '', usageScene: '' },
      assetClassifications: [],
      productFacts: [],
      generatedCopy: [],
      recommendedModuleIds: [],
      unresolvedFields: [],
      confirmationStatus: 'not_organized',
      contentVersion: 0,
      contentVersions: [],
      organizing: false,
      organizationApplied: false,
      assetTypePickerId: '',
      restoring: false
    }
  },
  computed: {
    templates() { return DETAIL_PAGE_TEMPLATES },
    platforms() { return DETAIL_PAGE_PLATFORMS },
    assetTypes() { return DETAIL_ASSET_TYPES },
    sizeFields() { return SIZE_FIELDS },
    totalAssetCount() { return (this.primaryAsset.fileId ? 1 : 0) + this.assets.length },
    canAddAsset() { return this.totalAssetCount < DETAIL_PAGE_MAX_ASSETS },
    enabledModules() { return this.modules.filter((item) => item.enabled).sort((a, b) => a.order - b.order) },
    sizeModuleEnabled() { return this.enabledModules.some((item) => item.id === 'size_chart') },
    activeTemplate() { return DETAIL_PAGE_TEMPLATES.find((item) => item.id === this.templateId) || DETAIL_PAGE_TEMPLATES[0] },
    activePlatform() { return DETAIL_PAGE_PLATFORMS.find((item) => item.id === this.platformId) || DETAIL_PAGE_PLATFORMS[0] },
    estimatedSegments() { return Math.max(1, buildVerticalSegments(this.enabledModules, this.sizeRows, DETAIL_PAGE_MAX_SEGMENT_HEIGHT, this.activeTemplate, this.renderWidth).length) },
    estimatedHeight() { return this.previewSegments.reduce((sum, item) => sum + Number(item.height || 0), 0) || buildVerticalSegments(this.enabledModules, this.sizeRows, DETAIL_PAGE_MAX_SEGMENT_HEIGHT, this.activeTemplate, this.renderWidth).reduce((sum, item) => sum + item.height, 0) },
    renderWidth() { return this.activePlatform.width || DETAIL_PAGE_RENDER_WIDTH },
    notFinalStep() { return this.currentStep !== 3 },
    canvasStyle() { return `width:${this.renderWidth}px;height:${this.canvasHeight}px;` },
    draftValidation() { return validateDetailPageDraft(this.buildDraft()) },
    organizationValidation() { return validateOrganizationForRender({ contentVersion: this.contentVersion, assetClassifications: this.assetClassifications, generatedCopy: this.generatedCopy }) },
    truthValidation() { return validateDetailContentTruthfulness(this.buildDraft()) },
    productProfileValidation() { return this.validateSelectedProductProfile() },
    completionText() { return this.organizationValidation.ok && this.draftValidation.ok ? '素材完整' : (this.organizationValidation.errors[0] || this.draftValidation.errors[0]) },
    finalDisabledReason() { return this.productProfileValidation.errors[0] || this.organizationValidation.errors[0] || this.truthValidation.errors[0] || (this.draftValidation.ok ? '' : this.draftValidation.errors[0]) },
    confirmedClassifications() { return this.assetClassifications.filter((item) => item.userConfirmed) },
    pendingClassifications() { return this.assetClassifications.filter((item) => !item.userConfirmed) },
    confirmedFacts() { return this.productFacts.filter((item) => item.confirmedByUser && item.value) }
  },
  watch: {
    primaryAsset: { deep: true, handler() { this.saveDraft() } },
    assets: { deep: true, handler() { this.saveDraft() } },
    modules: { deep: true, handler() { this.previewPaths = []; this.saveDraft() } },
    sizeRows: { deep: true, handler() { this.sizeConfirmed = this.sizeRows.length > 0 && this.sizeRows.every((row) => row.confirmedByUser); this.previewPaths = []; this.saveDraft() } },
    sizeUnit() {
      if (this.sizeRows.every((row) => row.unit === this.sizeUnit)) return
      this.sizeRows = this.sizeRows.map((row) => ({ ...row, unit: this.sizeUnit, confirmedByUser: false }))
      this.previewPaths = []
      this.saveDraft()
    },
    templateId() { this.previewPaths = []; this.saveDraft() },
    platformId() { this.previewPaths = []; this.saveDraft() },
    productFactInputs: { deep: true, handler() { this.organizationApplied = false; this.saveDraft() } },
    measurementNote() { this.previewPaths = []; this.saveDraft() },
    currentStep() { this.saveDraft() }
  },
  onLoad(options = {}) {
    uni.setNavigationBarTitle({ title: '自动排版详情长图' })
    this.projectId = options.projectId ? decodeURIComponent(options.projectId) : ''
    const detailPageId = options.detailPageId ? decodeURIComponent(options.detailPageId) : ''
    const sourceTaskId = options.sourceTaskId ? decodeURIComponent(options.sourceTaskId) : ''
    this.restoring = true
    if (detailPageId) this.restoreFromDetailPage(detailPageId)
    else if (sourceTaskId) this.restoreFromTask(sourceTaskId)
    else this.restoreDraft()
    this.$nextTick(() => { this.restoring = false })
    this.historyRepairSummary = {
      tasks: repairLocalInvalidDetailPageTasks(),
      detailPages: repairDetailPageRecords()
    }
  },
  onShow() { this.consumeSelectedProductProfile() },
  methods: {
    assetPreview(asset = {}) { return asset.localPath || asset.fileUrl || asset.fileId || '' },
    modulePreview(module = {}) { return module.localPath || module.fileUrl || module.fileId || '' },
    assetUsageLabel(value = '') { return (DETAIL_ASSET_USAGES.find((item) => item.value === value) || DETAIL_ASSET_USAGES[DETAIL_ASSET_USAGES.length - 1]).label },
    moduleStatus(module) { return getDetailModuleStatus(module, this.sizeRows) },
    validateSelectedProductProfile() {
      if (!this.productId || !this.productProfileVersion) return { ok: false, errors: ['请选择并保存商品资料档案'], snapshot: null }
      return validateProductProfileForDetail(this.productId, this.productProfileVersion, { requireSizeChart: this.sizeModuleEnabled })
    },
    chooseProductProfile() {
      const profiles = listProductProfiles()
      if (!profiles.length) { this.editProductProfile(); return }
      uni.showActionSheet({ itemList: profiles.slice(0, 12).map((item) => `${item.productName.value || '未命名商品'} · V${item.version}`), success: ({ tapIndex }) => this.applyProductProfile(profiles[tapIndex]) })
    },
    editProductProfile() {
      const query = ['select=1']
      if (this.productId) query.push(`productId=${encodeURIComponent(this.productId)}`)
      uni.navigateTo({ url: `/package-assets/product-profile/product-profile?${query.join('&')}`, fail: () => uni.showToast({ title: '商品档案页面打开失败', icon: 'none' }) })
    },
    consumeSelectedProductProfile() {
      let selected = null
      try { selected = uni.getStorageSync(PRODUCT_PROFILE_SELECTION_KEY) } catch (error) {}
      if (!selected || !selected.productId) return
      try { uni.removeStorageSync(PRODUCT_PROFILE_SELECTION_KEY) } catch (error) {}
      const profile = getProductProfile(selected.productId)
      if (profile) this.applyProductProfile(profile, selected.version)
    },
    applyProductProfile(profile, version = 0) {
      if (!profile) return
      this.productId = profile.productId
      this.productProfileVersion = Number(version || profile.version) || 1
      this.sizeChartId = profile.sizeChartId || ''
      this.selectedProductProfile = profile
      const confirmed = (key) => profile[key] && profile[key].confirmed ? profile[key].value : ''
      this.productFactInputs = {
        ...this.productFactInputs,
        productName: confirmed('productName'),
        category: confirmed('category'),
        color: confirmed('colorName'),
        materialComposition: confirmed('fabricComposition'),
        sellingPoints: confirmed('sellingPoints'),
        usageScene: '',
        fit: { value: confirmed('fitType'), confirmedByUser: Boolean(confirmed('fitType')) },
        neckType: { value: confirmed('neckType'), confirmedByUser: Boolean(confirmed('neckType')) },
        sleeveType: { value: confirmed('sleeveType'), confirmedByUser: Boolean(confirmed('sleeveType')) },
        lengthType: { value: confirmed('garmentLength'), confirmedByUser: Boolean(confirmed('garmentLength')) },
        pattern: { value: confirmed('pattern'), confirmedByUser: Boolean(confirmed('pattern')) },
        decoration: { value: confirmed('decoration'), confirmedByUser: Boolean(confirmed('decoration')) },
        care: { value: confirmed('careInstruction'), confirmedByUser: Boolean(confirmed('careInstruction')) }
      }
      this.productFacts = this.productFacts.map((fact) => {
        const map = { fit: 'fitType', neckType: 'neckType', sleeveType: 'sleeveType', lengthType: 'garmentLength', pattern: 'pattern', decoration: 'decoration', care: 'careInstruction' }
        const source = map[fact.fieldId] && profile[map[fact.fieldId]]
        return source && source.confirmed ? { ...fact, value: source.value, status: 'confirmed', sourceType: 'product_profile', confidence: 1, needsConfirmation: false, confirmedByUser: true } : fact
      })
      const moduleContent = {
        product_info: [confirmed('productCode') && `款号：${confirmed('productCode')}`, confirmed('category') && `品类：${confirmed('category')}`, confirmed('colorName') && `颜色：${confirmed('colorName')}`, confirmed('fabricComposition') && `面料成分：${confirmed('fabricComposition')}`, confirmed('season') && `季节：${confirmed('season')}`].filter(Boolean).join('\n'),
        fit: [confirmed('fitType'), confirmed('neckType'), confirmed('sleeveType'), confirmed('sleeveLength'), confirmed('garmentLength')].filter(Boolean).join('、'),
        fabric: [confirmed('fabricComposition'), confirmed('fabricDescription')].filter(Boolean).join('；'),
        selling_points: confirmed('sellingPoints'),
        care: confirmed('careInstruction'),
        craft: [confirmed('craftsmanship'), confirmed('decoration')].filter(Boolean).join('；')
      }
      this.modules.forEach((module) => {
        if (moduleContent[module.id] && !module.userEdited) {
          module.text = moduleContent[module.id]
          module.contentSource = 'product_profile'
        }
      })
      this.modules = [...this.modules]
      const check = validateProductProfileForDetail(this.productId, this.productProfileVersion, { requireSizeChart: false })
      this.productProfileSnapshot = check.snapshot
      if (check.snapshot && check.snapshot.sizeChart && check.snapshot.sizeChart.confirmed) {
        const chart = check.snapshot.sizeChart
        this.sizeRows = chart.rows.map((row) => ({ ...row, unit: chart.unit, source: 'product_profile', confirmedByUser: true }))
        this.sizeUnit = chart.unit
        this.measurementNote = chart.measurementNotes || ''
        this.sizeSource = 'product_profile'
      }
      this.organizationApplied = false
      this.runAutoOrganize(true)
      this.saveDraft()
    },
    async uploadLocalImage(localPath, relation, usage = 'other', assetType = 'garment_image') {
      const result = await uploadImage({ filePath: localPath, assetType, targetType: 'detail_page_draft', targetId: DRAFT_KEY, relation, scene: 'detail_page_long_image' })
      return { assetId: (result.assetRecord && result.assetRecord.fileId) || result.fileId, fileId: result.fileId, fileUrl: result.fileUrl || '', localPath, fileName: String(localPath || '').split(/[\\/]/).pop(), source: relation === 'primary' ? 'original_upload' : 'manual_upload', usage, usageConfirmed: relation === 'primary' }
    },
    async choosePrimaryImage() {
      try {
        const result = await chooseImages(1)
        const path = (result.tempFilePaths || [])[0]
        if (!path) return
        uni.showLoading({ title: '上传中' })
        this.primaryAsset = await this.uploadLocalImage(path, 'primary', 'product_main')
        const hero = this.modules.find((item) => item.id === 'hero')
        if (hero) Object.assign(hero, this.primaryAsset, { imageSource: 'original_upload', sourceConfirmed: true })
        await this.runAutoOrganize(true)
      } catch (error) {
        if (!/cancel/i.test(String((error && error.errMsg) || ''))) uni.showToast({ title: '商品正面图上传失败', icon: 'none' })
      } finally { uni.hideLoading() }
    },
    removePrimaryImage() {
      const oldFileId = this.primaryAsset.fileId
      const oldAssetId = this.primaryAsset.assetId || oldFileId
      this.primaryAsset = emptyAsset('product_main')
      this.modules.forEach((module) => { if (module.fileId === oldFileId) Object.assign(module, emptyAsset(module.preferredUsage || 'other')) })
      this.assetClassifications = this.assetClassifications.filter((item) => item.assetId !== oldAssetId)
    },
    async chooseSupplementImages() {
      try {
        const count = Math.min(9, DETAIL_PAGE_MAX_ASSETS - this.totalAssetCount)
        const result = await chooseImages(count)
        const paths = result.tempFilePaths || []
        uni.showLoading({ title: '上传中' })
        for (const path of paths) this.assets.push(await this.uploadLocalImage(path, `supplement_${this.assets.length + 1}`, 'other'))
        await this.runAutoOrganize(true)
      } catch (error) {
        if (!/cancel/i.test(String((error && error.errMsg) || ''))) uni.showToast({ title: '补充图片上传失败', icon: 'none' })
      } finally { uni.hideLoading() }
    },
    removeAsset(index) {
      const removed = this.assets[index]
      this.assets.splice(index, 1)
      this.modules.forEach((module) => { if (removed && module.fileId === removed.fileId) Object.assign(module, emptyAsset(module.preferredUsage || 'other')) })
      if (removed) this.assetClassifications = this.assetClassifications.filter((item) => item.assetId !== (removed.assetId || removed.fileId))
      this.runAutoOrganize(true)
    },
    moveAsset(index, offset) {
      const target = index + offset
      if (target < 0 || target >= this.assets.length) return
      const list = [...this.assets]
      const current = list.splice(index, 1)[0]
      list.splice(target, 0, current)
      this.assets = list
    },
    changeAssetUsage(asset) {
      this.assetTypePickerId = asset.assetId || asset.fileId
    },
    applyUsageToModules(asset) {
      this.modules.filter((module) => module.enabled && module.preferredUsage === asset.usage && !module.fileId).forEach((module) => Object.assign(module, asset, { imageSource: asset.source, sourceConfirmed: asset.source !== 'ai_reference' }))
    },
    previewAsset(asset) { const url = this.assetPreview(asset); if (url) uni.previewImage({ urls: [url], current: url }) },
    assetTypeLabel(value = '') { return (DETAIL_ASSET_TYPES.find((item) => item.value === value) || DETAIL_ASSET_TYPES[DETAIL_ASSET_TYPES.length - 1]).label },
    classificationAsset(item = {}) { return [this.primaryAsset, ...this.assets].find((asset) => (asset.assetId || asset.fileId) === item.assetId) || {} },
    classificationPreview(item = {}) { return this.assetPreview(this.classificationAsset(item)) },
    copySourceLabels(item = {}) {
      const labels = Object.fromEntries(this.productFacts.map((fact) => [fact.fieldId, fact.label]))
      return (item.sourceFieldIds || []).map((id) => labels[id] || id).join('、') || '用户手工内容'
    },
    markCopyEdited(item) { item.userEdited = true; item.sourceType = 'user_edited'; item.needsConfirmation = false; this.organizationApplied = false; this.saveDraft() },
    markModuleEdited(module) { module.userEdited = true; module.contentSource = 'user_edited'; this.saveDraft() },
    confirmClassification(item) {
      this.assetTypePickerId = item.assetId
    },
    selectAssetType(selected) {
      const id = this.assetTypePickerId
      const asset = [this.primaryAsset, ...this.assets].find((item) => (item.assetId || item.fileId) === id)
      if (asset) { asset.usage = selected.value; asset.usageConfirmed = true; this.applyUsageToModules(asset) }
      const classification = this.assetClassifications.find((item) => item.assetId === id)
      if (classification) Object.assign(classification, { assetType: selected.value, recommendedModule: selected.moduleId, confidence: 1, userConfirmed: true, sourceType: 'user_confirmed', detectedDetails: [`用户确认为${selected.label}`] })
      this.assetTypePickerId = ''
      this.assetClassifications = [...this.assetClassifications]
      this.runAutoOrganize(true)
    },
    buildOrganization() {
      return organizeDetailContent({
        assets: [this.primaryAsset, ...this.assets],
        productFacts: this.productFactInputs,
        sizeRows: this.sizeRows
      }, {
        contentVersion: this.contentVersion,
        assetClassifications: this.assetClassifications,
        productFacts: this.productFacts,
        generatedCopy: this.generatedCopy
      })
    },
    async runAutoOrganize(silent = false) {
      if (this.organizing || (!this.primaryAsset.fileId && !this.assets.length)) return
      this.organizing = true
      try {
        if (this.contentVersion) {
          this.contentVersions = [{ contentVersion: this.contentVersion, assetClassifications: this.assetClassifications.map((item) => ({ ...item })), productFacts: this.productFacts.map((item) => ({ ...item })), generatedCopy: this.generatedCopy.map((item) => ({ ...item })), createdAt: new Date().toISOString() }, ...this.contentVersions].slice(0, 20)
        }
        const organized = this.buildOrganization()
        this.contentVersion = organized.contentVersion
        this.assetClassifications = organized.assetClassifications
        this.productFacts = organized.productFacts
        this.generatedCopy = organized.generatedCopy
        this.recommendedModuleIds = organized.recommendedModuleIds
        this.unresolvedFields = organized.unresolvedFields
        this.confirmationStatus = organized.confirmationStatus
        this.organizationApplied = false
        this.saveDraft()
        if (!silent) uni.showToast({ title: '整理结果已更新', icon: 'success' })
      } catch (error) {
        if (!silent) uni.showToast({ title: '自动整理失败，可继续手动编辑', icon: 'none' })
      } finally { this.organizing = false }
    },
    applyOrganization() {
      const recommended = new Set(this.recommendedModuleIds)
      const recommendedOrder = new Map(this.recommendedModuleIds.map((id, index) => [id, index]))
      this.modules.forEach((module) => {
        module.enabled = module.required || recommended.has(module.id)
        module.order = recommendedOrder.has(module.id) ? recommendedOrder.get(module.id) : this.recommendedModuleIds.length + module.order
        module.matchedAssetIds = []
      })
      this.assetClassifications.filter((item) => item.userConfirmed).forEach((classification) => {
        const module = this.modules.find((item) => item.id === classification.recommendedModule)
        const asset = this.classificationAsset(classification)
        if (module && asset.fileId) {
          module.matchedAssetIds = Array.from(new Set([...(module.matchedAssetIds || []), asset.assetId || asset.fileId]))
          if (!module.fileId || module.contentSource === 'organized_asset') Object.assign(module, asset, { imageSource: asset.source, sourceConfirmed: true, contentSource: 'organized_asset' })
        }
      })
      const copyToModule = { product_title: 'hero', selling_points: 'selling_points', fit_description: 'fit', fabric_description: 'fabric', craft_description: 'craft', usage_scene: 'selling_points' }
      this.generatedCopy.forEach((copy) => {
        const module = this.modules.find((item) => item.id === copyToModule[copy.copyId])
        if (!module || module.userEdited || !copy.content) return
        module.text = module.text && copy.copyId === 'usage_scene' ? `${module.text}\n${copy.content}` : copy.content
        module.contentSource = 'organized_copy'
      })
      this.modules = [...this.modules]
      this.organizationApplied = true
      this.confirmationStatus = this.pendingClassifications.filter((item) => item.recommendedModule !== 'custom').length ? 'needs_confirmation' : (this.unresolvedFields.length ? 'confirmed_with_missing' : 'confirmed')
      this.saveDraft()
      uni.showToast({ title: '已采用整理结果', icon: 'success' })
    },
    async acceptOrganization() {
      const check = validateOrganizationForRender({ contentVersion: this.contentVersion, assetClassifications: this.assetClassifications, generatedCopy: this.generatedCopy })
      if (!check.ok) { uni.showToast({ title: check.errors[0], icon: 'none' }); return }
      this.applyOrganization()
      this.currentStep = 2
      if (!this.draftValidation.ok) { uni.showToast({ title: this.draftValidation.errors[0], icon: 'none' }); return }
      this.currentStep = 3
      await this.$nextTick()
      await this.preparePreview()
    },
    toggleModule(module) {
      if (module.required && module.enabled) { uni.showToast({ title: '商品首屏为必选模块', icon: 'none' }); return }
      module.enabled = !module.enabled
      if (module.enabled && module.preferredUsage && !module.fileId) {
        const matched = [this.primaryAsset, ...this.assets].find((asset) => asset.fileId && asset.usage === module.preferredUsage)
        if (matched) Object.assign(module, matched, { imageSource: matched.source, sourceConfirmed: matched.source !== 'ai_reference' })
      }
    },
    moveEnabledModule(moduleId, offset) {
      const list = this.enabledModules
      const index = list.findIndex((item) => item.id === moduleId)
      const target = index + offset
      if (index < 0 || target < 0 || target >= list.length) return
      const currentOrder = list[index].order
      list[index].order = list[target].order
      list[target].order = currentOrder
      this.modules = [...this.modules]
    },
    selectModuleAsset(module) {
      const available = [this.primaryAsset, ...this.assets].filter((item) => item.fileId)
      if (!available.length) { uni.showToast({ title: '请先上传真实商品图片', icon: 'none' }); return }
      uni.showActionSheet({
        itemList: available.map((item) => this.assetUsageLabel(item.usage)),
        success: ({ tapIndex }) => {
          const selected = available[tapIndex]
          Object.assign(module, selected, { imageSource: selected.source, sourceConfirmed: selected.source !== 'ai_reference' })
        }
      })
    },
    modulePlaceholder(module) {
      const map = { hero: '填写真实商品名称和一句核心卖点', fabric: '填写真实面料成分和质感说明', fit: '填写真实领型、袖型、衣长和廓形', craft: '填写原图中真实存在的车线、纽扣、拉链或金属装饰', selling_points: '填写已经确认的商品卖点', product_info: '填写款号、颜色、真实面料成分、季节和适用场景', care: '填写已确认的洗护方式', brand: '填写品牌名称和服务说明', custom: '填写自定义模块的真实内容' }
      return map[module.id] || '填写已确认的商品内容'
    },
    selectTemplate(id) { this.templateId = id },
    setModuleImageFit(module, imageFit) {
      module.layout = { ...(module.layout || {}), imageFit, focalPosition: (module.layout || {}).focalPosition || 'center' }
      this.modules = [...this.modules]
    },
    cycleFocalPosition(module) {
      const positions = ['top', 'center', 'bottom']
      const current = positions.indexOf((module.layout || {}).focalPosition)
      module.layout = { ...(module.layout || {}), focalPosition: positions[(current + 1) % positions.length] }
      this.modules = [...this.modules]
    },
    focalPositionLabel(value) { return ({ top: '顶部', center: '居中', bottom: '底部' })[value] || '居中' },
    setSizeUnit(unit) { if (['cm', 'inch'].includes(unit)) this.sizeUnit = unit },
    async chooseSizeAttachment() {
      try {
        const result = await chooseSizeFile()
        const selected = (result.tempFiles || [])[0] || {}
        const path = selected.path || selected.tempFilePath || (result.tempFilePaths || [])[0]
        if (!path) return
        uni.showLoading({ title: '上传中' })
        const extension = String(selected.name || path).split('.').pop().toLowerCase()
        const assetType = ['csv', 'xls', 'xlsx'].includes(extension) ? 'document' : 'sample_image'
        this.sizeAttachment = await this.uploadLocalImage(path, 'size_chart_attachment', 'size_chart', assetType)
        this.sizeSource = 'manual_transcription_from_attachment'
        this.sizeRows = [emptySizeRow(this.sizeSource)]
        this.sizeConfirmed = false
        uni.showToast({ title: '请核对录入结果后确认', icon: 'none' })
      } catch (error) {
        if (!/cancel/i.test(String((error && error.errMsg) || ''))) uni.showToast({ title: '尺码表上传失败', icon: 'none' })
      } finally { uni.hideLoading() }
    },
    addSizeRow() { this.sizeRows.push(emptySizeRow(this.sizeSource)) },
    removeSizeRow(index) { this.sizeRows.splice(index, 1); if (!this.sizeRows.length) this.addSizeRow() },
    confirmSizeRows() {
      const valid = this.sizeRows.filter((row) => row.size || ['shoulder', 'bust', 'waist', 'hip', 'sleeveLength', 'garmentLength', 'pantsLength'].some((key) => row[key]))
      if (!valid.length || valid.some((row) => !row.size)) { uni.showToast({ title: '请填写尺码名称和至少一项真实尺寸', icon: 'none' }); return }
      this.sizeRows = valid.map((row) => ({ ...row, unit: this.sizeUnit, measurementNote: this.measurementNote, source: row.source || this.sizeSource, confirmedByUser: true }))
      this.sizeConfirmed = true
      uni.showToast({ title: '尺码数据已确认', icon: 'success' })
    },
    validateStep(step = this.currentStep) {
      if (step === 0 && !this.primaryAsset.fileId) return '请上传商品正面图'
      if (step === 1) {
        if (!this.enabledModules.length) return '请至少选择一个详情模块'
        const organizationCheck = validateOrganizationForRender({ contentVersion: this.contentVersion, assetClassifications: this.assetClassifications, generatedCopy: this.generatedCopy })
        if (!organizationCheck.ok) return organizationCheck.errors[0]
      }
      if (step === 2) {
        const organizationCheck = validateOrganizationForRender({ contentVersion: this.contentVersion, assetClassifications: this.assetClassifications, generatedCopy: this.generatedCopy })
        if (!organizationCheck.ok) return organizationCheck.errors[0]
        if (!this.draftValidation.ok) return this.draftValidation.errors[0]
      }
      return ''
    },
    async nextStep() {
      const error = this.validateStep()
      if (error) { uni.showToast({ title: error, icon: 'none', duration: 2800 }); return }
      if (this.currentStep === 2) {
        this.currentStep = 3
        await this.$nextTick()
        await this.preparePreview()
        return
      }
      if (this.currentStep === 0) await this.runAutoOrganize(true)
      this.currentStep += 1
    },
    previousStep() { if (!this.rendering && !this.previewing && this.currentStep > 0) this.currentStep -= 1 },
    buildDraft() { return { detailPageId: this.detailPageId, projectId: this.projectId, productId: this.productId, productProfileVersion: this.productProfileVersion, sizeChartId: this.sizeChartId, contentSnapshotId: this.contentSnapshotId, productProfileSnapshot: this.productProfileSnapshot, primaryAsset: this.primaryAsset, assets: this.assets, modules: this.modules, sizeRows: this.sizeRows, sizeAttachment: this.sizeAttachment, sizeSource: this.sizeSource, sizeUnit: this.sizeUnit, measurementNote: this.measurementNote, templateId: this.templateId, platformId: this.platformId, productFactInputs: this.productFactInputs, contentVersion: this.contentVersion, assetClassifications: this.assetClassifications, productFacts: this.productFacts, generatedCopy: this.generatedCopy, recommendedModuleIds: this.recommendedModuleIds, confirmationStatus: this.confirmationStatus, unresolvedFields: this.unresolvedFields, contentVersions: this.contentVersions } },
    saveDraft() {
      if (this.restoring || (!this.primaryAsset.fileId && !this.assets.length)) return
      try {
        const localDraft = { ...this.buildDraft(), currentStep: this.currentStep, updatedAt: new Date().toISOString() }
        uni.setStorageSync(DRAFT_KEY, localDraft)
        const record = saveDetailPageDraft(buildDetailPageSnapshot(localDraft))
        if (record && record.detailPageId) this.detailPageId = record.detailPageId
      } catch (error) {}
    },
    restoreFromDetailPage(detailPageId) {
      const record = getDetailPage(detailPageId)
      if (!record) { uni.showToast({ title: '详情页草稿不存在或无权访问', icon: 'none' }); return }
      const draft = { ...(record.editorSnapshot || {}), ...record, detailPageId: record.detailPageId }
      this.primaryAsset = restoreAsset(draft.primaryAsset, 'product_main')
      this.assets = Array.isArray(draft.assets) ? draft.assets.slice(0, DETAIL_PAGE_MAX_ASSETS - 1).map((item) => restoreAsset(item)) : []
      const sourceModules = Array.isArray((record.editorSnapshot || {}).modules) && record.editorSnapshot.modules.length ? record.editorSnapshot.modules : record.modules
      const saved = (sourceModules || []).reduce((map, item) => ({ ...map, [item.id || item.moduleId]: item }), {})
      this.modules = createDetailPageModules().map((module) => ({ ...module, ...restoreAsset(saved[module.id] || {}, module.preferredUsage), enabled: Boolean((saved[module.id] || {}).visible !== false && saved[module.id]) }))
      this.sizeRows = Array.isArray(draft.sizeRows) && draft.sizeRows.length ? draft.sizeRows : (((record.sizeChartSnapshot || {}).rows || this.sizeRows))
      this.sizeAttachment = restoreAsset(draft.sizeAttachment, 'size_chart')
      this.sizeSource = draft.sizeSource || (record.sizeChartSnapshot || {}).source || 'manual'
      this.sizeUnit = draft.sizeUnit || (record.sizeChartSnapshot || {}).unit || 'cm'
      this.measurementNote = draft.measurementNote || (record.sizeChartSnapshot || {}).measurementNote || ''
      this.templateId = DETAIL_PAGE_TEMPLATES.some((item) => item.id === record.templateId) ? record.templateId : DETAIL_PAGE_TEMPLATES[0].id
      this.platformId = record.platform || draft.platformId || DETAIL_PAGE_PLATFORMS[0].id
      this.detailPageId = record.detailPageId
      this.projectId = record.projectId || this.projectId
      this.productId = record.productId || ''
      this.productProfileVersion = Number(record.productProfileVersion) || 0
      this.sizeChartId = record.sizeChartId || ''
      this.contentSnapshotId = record.contentSnapshotId || ''
      this.productProfileSnapshot = record.productProfileSnapshot || null
      this.selectedProductProfile = this.productId ? getProductProfile(this.productId) : null
      this.productFactInputs = { ...this.productFactInputs, ...(draft.productFactInputs || {}), ...Object.fromEntries((record.productFacts || []).filter((item) => item.confirmedByUser).map((item) => [item.fieldId, item.value])) }
      this.assetClassifications = record.assetClassifications || []
      this.productFacts = record.productFacts || []
      this.generatedCopy = record.generatedCopy || []
      this.recommendedModuleIds = draft.recommendedModuleIds || []
      this.unresolvedFields = record.unresolvedFields || []
      this.confirmationStatus = record.confirmationStatus || 'not_organized'
      this.contentVersion = Math.max(0, Number(record.contentVersion) || 0)
      this.contentVersions = record.contentVersions || []
      this.currentStep = Math.min(3, Math.max(0, Number(draft.currentStep) || 0))
    },
    restoreDraft() {
      try {
        const draft = uni.getStorageSync(DRAFT_KEY) || uni.getStorageSync(PREVIOUS_V3_DRAFT_KEY) || uni.getStorageSync(PREVIOUS_DRAFT_KEY) || uni.getStorageSync(LEGACY_DRAFT_KEY)
        if (!draft || typeof draft !== 'object') return
        this.primaryAsset = restoreAsset(draft.primaryAsset, 'product_main')
        this.assets = Array.isArray(draft.assets) ? draft.assets.slice(0, DETAIL_PAGE_MAX_ASSETS - 1).map((item) => restoreAsset(item)) : []
        const saved = Array.isArray(draft.modules) ? draft.modules.reduce((map, item) => ({ ...map, [item.id]: item }), {}) : {}
        this.modules = createDetailPageModules().map((module) => ({ ...module, ...restoreAsset(saved[module.id] || {}, module.preferredUsage) }))
        this.sizeRows = Array.isArray(draft.sizeRows) && draft.sizeRows.length ? draft.sizeRows : this.sizeRows
        this.sizeAttachment = restoreAsset(draft.sizeAttachment, 'size_chart')
        this.sizeSource = draft.sizeSource || 'manual'
        this.sizeUnit = draft.sizeUnit || ((draft.sizeRows || [])[0] || {}).unit || 'cm'
        this.measurementNote = draft.measurementNote || ''
        this.templateId = DETAIL_PAGE_TEMPLATES.some((item) => item.id === draft.templateId) ? draft.templateId : DETAIL_PAGE_TEMPLATES[0].id
        this.platformId = draft.platformId || DETAIL_PAGE_PLATFORMS[0].id
        this.detailPageId = draft.detailPageId || ''
        this.projectId = draft.projectId || this.projectId
        this.productId = draft.productId || ''
        this.productProfileVersion = Number(draft.productProfileVersion) || 0
        this.sizeChartId = draft.sizeChartId || ''
        this.contentSnapshotId = draft.contentSnapshotId || ''
        this.productProfileSnapshot = draft.productProfileSnapshot || null
        this.selectedProductProfile = this.productId ? getProductProfile(this.productId) : null
        this.productFactInputs = { ...this.productFactInputs, ...(draft.productFactInputs || {}), ...Object.fromEntries((draft.productFacts || []).filter((item) => item.confirmedByUser).map((item) => [item.fieldId, item.value])) }
        this.assetClassifications = Array.isArray(draft.assetClassifications) ? draft.assetClassifications : []
        this.productFacts = Array.isArray(draft.productFacts) ? draft.productFacts : []
        this.generatedCopy = Array.isArray(draft.generatedCopy) ? draft.generatedCopy : []
        this.recommendedModuleIds = Array.isArray(draft.recommendedModuleIds) ? draft.recommendedModuleIds : []
        this.unresolvedFields = Array.isArray(draft.unresolvedFields) ? draft.unresolvedFields : []
        this.confirmationStatus = draft.confirmationStatus || 'not_organized'
        this.contentVersion = Math.max(0, Number(draft.contentVersion) || 0)
        this.contentVersions = Array.isArray(draft.contentVersions) ? draft.contentVersions : []
        this.currentStep = Math.min(3, Math.max(0, Number(draft.currentStep) || 0))
      } catch (error) {}
    },
    restoreFromTask(taskId) {
      const task = getTask(taskId) || {}
      const input = task.input || {}
      const params = input.params || {}
      const sourceModules = Array.isArray(params.contentSnapshot) ? params.contentSnapshot : []
      const saved = sourceModules.reduce((map, item) => ({ ...map, [item.id]: item }), {})
      this.modules = createDetailPageModules().map((module) => ({ ...module, ...(saved[module.id] || {}), enabled: Boolean(saved[module.id]), localPath: '', fileUrl: (saved[module.id] || {}).fileId || '' }))
      const sourceAssets = input.assets || {}
      this.primaryAsset = restoreAsset(sourceAssets.baseImage, 'product_main')
      this.assets = Array.isArray(sourceAssets.sourceImages) ? sourceAssets.sourceImages.filter((item) => item && item.fileId && item.fileId !== this.primaryAsset.fileId).slice(0, DETAIL_PAGE_MAX_ASSETS - 1).map((item) => restoreAsset(item)) : []
      this.sizeRows = Array.isArray((params.sizeChartSnapshot || {}).rows) && params.sizeChartSnapshot.rows.length ? params.sizeChartSnapshot.rows : this.sizeRows
      this.sizeAttachment = restoreAsset({ fileId: (params.sizeChartSnapshot || {}).attachmentFileId || '' }, 'size_chart')
      this.sizeSource = (params.sizeChartSnapshot || {}).source || 'manual'
      this.sizeUnit = (params.sizeChartSnapshot || {}).unit || ((this.sizeRows || [])[0] || {}).unit || 'cm'
      this.measurementNote = (params.sizeChartSnapshot || {}).measurementNote || ''
      this.templateId = DETAIL_PAGE_TEMPLATES.some((item) => item.id === params.templateId) ? params.templateId : DETAIL_PAGE_TEMPLATES[0].id
      this.platformId = params.platformId || DETAIL_PAGE_PLATFORMS[0].id
      this.detailPageId = params.detailPageId || ''
      this.productId = params.productId || ''
      this.productProfileVersion = Number(params.productProfileVersion) || 0
      this.sizeChartId = params.sizeChartId || ''
      this.contentSnapshotId = params.contentSnapshotId || ''
      this.productProfileSnapshot = params.productProfileSnapshot || null
      this.selectedProductProfile = this.productId ? getProductProfile(this.productId) : null
      this.assetClassifications = Array.isArray(params.assetClassifications) ? params.assetClassifications : []
      this.productFacts = Array.isArray(params.productFacts) ? params.productFacts : []
      this.generatedCopy = Array.isArray(params.generatedCopy) ? params.generatedCopy : []
      this.unresolvedFields = Array.isArray(params.unresolvedFields) ? params.unresolvedFields : []
      this.confirmationStatus = params.confirmationStatus || 'not_organized'
      this.contentVersion = Math.max(0, Number(params.contentVersion) || 0)
      this.productFactInputs = { ...this.productFactInputs, ...Object.fromEntries(this.productFacts.filter((item) => item.confirmedByUser).map((item) => [item.fieldId, item.value])) }
      this.currentStep = 1
      this.saveDraft()
    },
    async getModuleImageInfoMap(modules) {
      const map = {}
      for (const module of modules) {
        const source = module.localPath || module.fileUrl || module.fileId
        if (source) map[module.id] = await getImageInfo(source)
      }
      return map
    },
    drawCanvas(segment, imageInfoMap) {
      return new Promise((resolve, reject) => {
        try {
          const context = uni.createCanvasContext(this.canvasId, this)
          drawDetailPageSegment(context, segment, { sizeRows: this.sizeRows, imageInfoMap, template: this.activeTemplate, platform: this.activePlatform })
          context.draw(false, resolve)
        } catch (error) { reject(error) }
      })
    },
    exportCanvas(segment) {
      return new Promise((resolve, reject) => uni.canvasToTempFilePath({ canvasId: this.canvasId, x: 0, y: 0, width: segment.width, height: segment.height, destWidth: segment.width, destHeight: segment.height, fileType: 'jpg', quality: 0.94, success: (result) => resolve(result.tempFilePath), fail: reject }, this))
    },
    async preparePreview() {
      if (this.previewing) return
      const validation = validateDetailPageDraft(this.buildDraft())
      if (!validation.ok) { this.renderError = validation.errors[0]; return }
      this.previewing = true
      this.renderError = ''
      try {
        const modules = this.enabledModules.map((item) => ({ ...item }))
        const segments = buildVerticalSegments(modules, this.sizeRows, DETAIL_PAGE_MAX_SEGMENT_HEIGHT, this.activeTemplate, this.renderWidth)
        const imageInfoMap = await this.getModuleImageInfoMap(modules)
        const paths = []
        for (const segment of segments) {
          this.canvasHeight = segment.height
          await this.$nextTick()
          await this.drawCanvas(segment, imageInfoMap)
          paths.push(await this.exportCanvas(segment))
        }
        this.previewSegments = segments
        this.previewPaths = paths
      } catch (error) {
        this.previewPaths = []
        this.renderError = (error && error.message) || '详情长图预览失败，请检查图片后重试'
      } finally { this.previewing = false }
    },
    previewRendered(index) { if (this.previewPaths.length) uni.previewImage({ urls: this.previewPaths, current: this.previewPaths[index] }) },
    async renderDetailPage() {
      if (this.rendering || this.previewing) return
      const organizationCheck = validateOrganizationForRender({ contentVersion: this.contentVersion, assetClassifications: this.assetClassifications, generatedCopy: this.generatedCopy })
      if (!organizationCheck.ok) { this.renderError = organizationCheck.errors[0]; return }
      const profileCheck = this.validateSelectedProductProfile()
      if (!profileCheck.ok) { this.renderError = profileCheck.errors[0]; return }
      const truthCheck = validateDetailContentTruthfulness(this.buildDraft())
      if (!truthCheck.ok) { this.renderError = truthCheck.errors[0]; return }
      const validation = validateDetailPageDraft(this.buildDraft())
      if (!validation.ok) { this.renderError = validation.errors[0]; return }
      this.rendering = true
      this.renderError = ''
      let task = null
      try {
        await this.preparePreview()
        if (!this.previewPaths.length) throw new Error(this.renderError || '未生成可保存的详情长图预览')
        const snapshot = buildDetailPageSnapshot(this.buildDraft())
        const productSnapshot = buildProductProfileSnapshot(this.productId, this.productProfileVersion)
        snapshot.productProfileSnapshot = productSnapshot
        snapshot.contentSnapshotId = productSnapshot.snapshotId
        snapshot.productId = productSnapshot.productId
        snapshot.productProfileVersion = productSnapshot.productProfileVersion
        snapshot.sizeChartId = productSnapshot.sizeChartId
        this.contentSnapshotId = productSnapshot.snapshotId
        const version = createDetailPageVersion(snapshot)
        this.detailPageId = version.detailPageId
        snapshot.detailPageId = version.detailPageId
        task = createDetailPageRenderTask(snapshot, { expectedOutputCount: this.previewPaths.length, idempotencyKey: `detail_page_${version.detailPageVersionId}`, detailPageVersionId: version.detailPageVersionId, primaryAsset: this.primaryAsset, sourceAssets: [this.primaryAsset, ...this.assets] })
        startDetailPageRenderJob(task.taskId, [...this.previewPaths], {
          detailPageId: version.detailPageId,
          detailPageVersionId: version.detailPageVersionId
        }).then(() => {
          uni.removeStorageSync(DRAFT_KEY)
          uni.removeStorageSync(PREVIOUS_V3_DRAFT_KEY)
          uni.removeStorageSync(PREVIOUS_DRAFT_KEY)
          uni.removeStorageSync(LEGACY_DRAFT_KEY)
        }).catch(() => {})
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}&workId=${encodeURIComponent(task.workId || '')}&detailPageId=${encodeURIComponent(version.detailPageId)}`,
          fail: () => uni.showToast({ title: '任务已创建，可在我的作品查看进度', icon: 'none' })
        })
      } catch (error) {
        if (task && task.taskId) failDetailPageRenderTask(task.taskId, error)
        this.renderError = (error && error.message) || '详情长图生成失败，请重试'
        uni.showToast({ title: this.renderError, icon: 'none', duration: 3000 })
      } finally { this.rendering = false }
    }
  }
}
</script>

<style scoped>
.page{min-height:100vh;padding-bottom:calc(190rpx + env(safe-area-inset-bottom));background:#f5f6fa;color:#101828;box-sizing:border-box}.step-bar{position:sticky;top:0;z-index:8;display:flex;padding:18rpx 20rpx;border-bottom:1rpx solid #eaecf0;background:#fff}.step{display:flex;min-width:0;flex:1;align-items:center;gap:6rpx;color:#98a2b3}.step-index{display:flex;width:34rpx;height:34rpx;border-radius:50%;background:#eaecf0;align-items:center;justify-content:center;font-size:20rpx}.step-name{font-size:19rpx;line-height:1.2}.step.active{color:#1677ff;font-weight:700}.step.active .step-index,.step.done .step-index{background:#1677ff;color:#fff}.step.done{color:#475467}.content{padding:24rpx}.section{padding:26rpx;border-radius:22rpx;background:#fff}.section-head,.editor-head,.size-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.section-title,.section-desc,.helper{display:block}.section-title{font-size:32rpx;font-weight:700}.section-desc{margin-top:7rpx;color:#667085;font-size:23rpx;line-height:1.5}.count-text{flex:none;color:#1677ff;font-size:25rpx;font-weight:700}.upload-card{display:flex;align-items:center;justify-content:center;flex-direction:column;margin-top:22rpx;border:2rpx dashed #b9c8dc;border-radius:18rpx;background:#f8fbff}.main-upload{height:270rpx}.upload-icon{color:#1677ff;font-size:50rpx}.upload-title{margin-top:8rpx;font-size:27rpx;font-weight:700}.upload-tip,.source-note,.helper,.helper-inline{color:#667085;font-size:21rpx}.source-card{position:relative;border:1rpx solid #e4e7ec;border-radius:16rpx;background:#fff;overflow:hidden}.primary-source{margin-top:22rpx}.primary-source image{width:100%;height:390rpx;background:#f7f8fa}.source-info{padding:14rpx}.source-purpose{display:block;font-size:24rpx;font-weight:700}.source-note{display:block;margin-top:5rpx}.source-actions{position:absolute;top:12rpx;right:12rpx;display:flex;gap:10rpx}.source-actions text{padding:9rpx 14rpx;border-radius:10rpx;background:rgba(255,255,255,.95);color:#1677ff;font-size:21rpx}.subsection-head{display:flex;align-items:center;justify-content:space-between;margin-top:28rpx;font-size:27rpx;font-weight:700}.asset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14rpx;margin-top:16rpx}.asset-card image{width:100%;height:190rpx;background:#f7f8fa}.asset-order{display:flex;justify-content:space-between;padding:0 14rpx 14rpx;color:#1677ff;font-size:20rpx}.muted{color:#c7cdd5!important}.add-card{display:flex;min-height:286rpx;align-items:center;justify-content:center;flex-direction:column;color:#1677ff;font-size:23rpx}.truth-note,.risk-note,.selection-summary{margin-top:20rpx;padding:17rpx;border-radius:14rpx;background:#eef6ff;color:#175cd3;font-size:22rpx;line-height:1.5}.selection-summary text{display:block;margin-top:4rpx}.module-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14rpx;margin-top:18rpx}.module-card{min-height:190rpx;padding:20rpx;border:2rpx solid #e4e7ec;border-radius:18rpx;background:#f9fafb;box-sizing:border-box}.module-card.selected{border-color:#1677ff;background:#eef6ff}.module-card-head,.module-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10rpx}.module-title{font-size:26rpx;font-weight:700}.module-check{display:flex;width:34rpx;height:34rpx;border-radius:50%;background:#1677ff;align-items:center;justify-content:center;color:#fff;font-size:20rpx}.module-desc{display:block;min-height:65rpx;margin-top:10rpx;color:#667085;font-size:21rpx;line-height:1.45}.module-card-foot{margin-top:10rpx}.required{color:#d92d20;font-size:20rpx}.module-status{font-size:20rpx}.module-status.complete{color:#067647}.module-status.missing_image,.module-status.missing_info{color:#b54708}.module-status.unselected{color:#98a2b3}.choice-block{margin-top:20rpx}.choice-title{display:block;font-size:26rpx;font-weight:700}.choice-row{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:12rpx}.choice-chip{min-height:64rpx;padding:0 20rpx;border:1rpx solid #d0d5dd;border-radius:12rpx;background:#fff;color:#475467;font-size:22rpx;line-height:64rpx}.choice-chip.active{border-color:#1677ff;background:#eef6ff;color:#1677ff;font-weight:700}.editor-card{margin-top:18rpx;padding:22rpx;border:1rpx solid #e4e7ec;border-radius:18rpx;background:#fff}.editor-title{display:block;font-size:27rpx;font-weight:700}.editor-order{display:flex;gap:18rpx;color:#1677ff;font-size:21rpx}.module-image-picker{display:flex;min-height:220rpx;align-items:center;justify-content:center;margin-top:16rpx;border:1rpx dashed #b9c8dc;border-radius:14rpx;background:#f8fbff;color:#1677ff;font-size:22rpx}.module-image-picker image{width:100%;height:300rpx}.module-image-picker view{display:flex;align-items:center;flex-direction:column}.editor-card textarea{width:100%;height:150rpx;margin-top:14rpx;padding:16rpx;border-radius:14rpx;background:#f7f8fa;font-size:24rpx;line-height:1.5;box-sizing:border-box}.field-warning{display:block;margin-top:8rpx;color:#b54708;font-size:20rpx}.minor-btn,.confirm-btn{height:66rpx;margin:0;padding:0 18rpx;border:1rpx solid #b9c8dc;border-radius:12rpx;background:#fff;color:#1677ff;font-size:21rpx;line-height:64rpx}.minor-btn::after,.confirm-btn::after,.primary-btn::after,.secondary-btn::after{border:0}.size-editor{margin-top:14rpx}.attachment{margin-top:14rpx;padding:14rpx;border-radius:12rpx;background:#fff7e8;color:#b54708;font-size:20rpx}.size-table-scroll{margin-top:16rpx}.size-table{min-width:1260rpx}.size-row{display:grid;grid-template-columns:repeat(8,140rpx) 110rpx;align-items:center;border-bottom:1rpx solid #eaecf0}.size-row text,.size-row input{min-height:66rpx;padding:0 10rpx;font-size:21rpx;line-height:66rpx;box-sizing:border-box}.size-head{background:#f7f8fa;font-weight:700}.size-actions{display:flex;justify-content:space-between;margin-top:16rpx}.confirm-btn{background:#1677ff;color:#fff}.confirm-btn.confirmed{background:#12b76a}.note-input{height:100rpx!important}.preview-meta{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:18rpx}.preview-meta text{padding:8rpx 12rpx;border-radius:10rpx;background:#f2f4f7;color:#475467;font-size:20rpx}.preview-loading{padding:80rpx 0;text-align:center;color:#667085;font-size:24rpx}.preview-list{margin-top:20rpx}.preview-image-wrap{margin-bottom:18rpx;border:1rpx solid #d0d5dd;border-radius:16rpx;background:#f7f8fa;overflow:hidden}.preview-image-wrap text{display:block;padding:12rpx;color:#475467;font-size:21rpx}.preview-image-wrap image{display:block;width:100%}.preview-actions{display:flex;justify-content:flex-end;gap:24rpx;color:#1677ff;font-size:22rpx}.error-message,.bottom-error{display:block;color:#d92d20;font-size:21rpx}.render-canvas{position:fixed;left:-10000px;top:-10000px;pointer-events:none}.bottom-bar{position:fixed;z-index:12;right:0;bottom:0;left:0;padding:14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));border-top:1rpx solid #eaecf0;background:rgba(255,255,255,.98)}.bottom-summary{display:flex;justify-content:space-between;gap:16rpx;margin-bottom:10rpx;color:#475467;font-size:20rpx}.bottom-summary text:last-child{min-width:0;text-align:right}.bottom-actions{display:flex;gap:14rpx}.primary-btn,.secondary-btn{height:82rpx;margin:0;border-radius:14rpx;font-size:26rpx;font-weight:700;line-height:82rpx}.primary-btn{flex:1;background:#1677ff;color:#fff}.secondary-btn{width:170rpx;background:#eef4ff;color:#1677ff}.primary-btn[disabled]{background:#9fc8ff;color:#fff}.bottom-error{margin-top:8rpx;text-align:right}
.image-layout-row,.size-unit-row{display:flex;align-items:center;flex-wrap:wrap;gap:12rpx;margin-top:12rpx;color:#667085;font-size:21rpx}.image-layout-row text:not(:first-child),.size-unit-row text:not(:first-child){padding:9rpx 14rpx;border:1rpx solid #d0d5dd;border-radius:10rpx;background:#fff;color:#475467}.image-layout-row text.active,.size-unit-row text.active{border-color:#1677ff;background:#eef6ff;color:#1677ff;font-weight:700}
.product-profile-card{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:18rpx;margin-top:20rpx;padding:18rpx;border:1rpx solid #c9dcff;border-radius:16rpx;background:#f5f9ff}.product-profile-card>view:first-child{min-width:260rpx;flex:1}.profile-actions{display:flex;flex:none;gap:10rpx}.profile-actions .minor-btn{padding:0 12rpx}
.basic-info-card,.review-block{margin-top:22rpx;padding:20rpx;border:1rpx solid #e4e7ec;border-radius:16rpx;background:#fff}.subsection-title{display:block;font-size:27rpx;font-weight:700}.basic-info-card input,.basic-info-card textarea{width:100%;margin-top:14rpx;padding:0 16rpx;border:1rpx solid #d0d5dd;border-radius:12rpx;background:#f9fafb;font-size:23rpx;box-sizing:border-box}.basic-info-card input{height:76rpx}.basic-info-card textarea{height:120rpx;padding-top:14rpx;line-height:1.5}.basic-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.organize-summary{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:18rpx}.organize-summary text{padding:9rpx 13rpx;border-radius:10rpx;background:#eef6ff;color:#175cd3;font-size:20rpx}.review-title{display:flex;align-items:center;justify-content:space-between;gap:12rpx;font-size:25rpx;font-weight:700}.review-title text:last-child{color:#667085;font-size:20rpx;font-weight:400}.classification-row{display:flex;align-items:center;gap:14rpx;padding:14rpx 0;border-bottom:1rpx solid #eaecf0}.classification-row:last-child{border-bottom:0}.classification-row image{width:92rpx;height:92rpx;flex:none;border-radius:10rpx;background:#f2f4f7}.classification-row view{min-width:0;flex:1}.classification-row view text{display:block;font-size:22rpx}.classification-row view text+text{margin-top:5rpx;color:#667085;font-size:19rpx}.review-action{flex:none;color:#1677ff;font-size:21rpx}.fact-list,.unresolved-list{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:14rpx}.fact-list text,.unresolved-list text{padding:10rpx 13rpx;border-radius:10rpx;background:#f2f4f7;color:#475467;font-size:20rpx}.unresolved-list text.risk{background:#fff4ed;color:#b54708}.empty-review{display:block;margin-top:14rpx;color:#98a2b3;font-size:21rpx}.copy-list>view{margin-top:15rpx}.copy-list>view>text{display:block;font-size:22rpx;font-weight:700}.copy-list>view>text:last-child{margin-top:5rpx;color:#667085;font-size:18rpx;font-weight:400}.copy-list textarea{width:100%;height:104rpx;margin-top:8rpx;padding:13rpx;border-radius:12rpx;background:#f7f8fa;font-size:22rpx;line-height:1.45;box-sizing:border-box}.organize-actions{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:20rpx}.compact{width:auto!important;min-width:190rpx;height:72rpx!important;line-height:72rpx!important;font-size:23rpx!important}.picker-mask{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;background:rgba(16,24,40,.45)}.picker-sheet{width:100%;padding:24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));border-radius:24rpx 24rpx 0 0;background:#fff;box-sizing:border-box}.picker-head{display:flex;align-items:center;justify-content:space-between;font-size:27rpx;font-weight:700}.picker-head text:last-child{color:#1677ff;font-size:22rpx;font-weight:400}.picker-options{max-height:620rpx;margin-top:18rpx}.picker-options text{display:block;min-height:82rpx;border-bottom:1rpx solid #eaecf0;color:#344054;font-size:24rpx;line-height:82rpx}
</style>
