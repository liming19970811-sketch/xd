<template>
  <view class="works-page">
    <view class="works-hero">
      <text class="works-kicker">蝶变作品资产</text>
      <text class="works-title">我的作品中心</text>
      <text class="works-desc">管理 AI 生成作品、服装设计方案和营销素材，继续优化时会自动带入原图与参数。</text>
    </view>

    <view class="filter-row">
      <view
        v-for="tab in categoryTabs"
        :key="tab.value"
        class="filter-pill"
        :class="{ active: activeCategory === tab.value }"
        @click="activeCategory = tab.value"
      >
        {{ tab.label }}
      </view>
    </view>

    <view v-if="!filteredWorks.length" class="empty-card">
      <text class="empty-title">还没有作品</text>
      <text class="empty-desc">去首页选择一个出图功能，上传服装图后即可生成作品或保存设计方案。</text>
      <button class="primary-btn" @click="goHome">去首页生成</button>
    </view>

    <view v-else class="works-list">
      <view v-for="work in filteredWorks" :key="work.workId" class="work-card">
        <view class="cover-wrap" @click="openWork(work)">
          <image v-if="work.coverUrl" class="cover-image" :src="work.coverUrl" mode="aspectFill"></image>
          <view v-else class="cover-empty">
            <text>{{ work.isDesignPlan ? '设计方案' : '暂无预览' }}</text>
          </view>
          <text class="type-badge" :class="{ design: work.isDesignPlan, package: work.isProductPackage }">{{ work.generationType }}</text>
        </view>

        <view class="work-info">
          <text class="work-title">{{ work.title }}</text>

          <view v-if="work.isDesignPlan" class="design-meta">
            <view class="design-meta-item">
              <text class="meta-label">设计方向</text>
              <text class="meta-value">{{ work.designDirection }}</text>
            </view>
            <view class="design-meta-item">
              <text class="meta-label">生成数量</text>
              <text class="meta-value">{{ work.outputCount }} 款</text>
            </view>
            <view class="design-meta-item">
              <text class="meta-label">设计版本</text>
              <text class="meta-value">V{{ work.version }} · {{ work.branchName }}</text>
            </view>
            <view class="design-meta-item">
              <text class="meta-label">方案状态</text>
              <text class="meta-value status-value" :class="`status-${work.status}`">{{ work.statusLabel }}</text>
            </view>
          </view>

          <view v-if="work.isProductPackage" class="package-meta">
            <view class="package-summary-row">
              <text>来源方案 V{{ work.sourceVersion }}</text>
              <text class="package-status" :class="`package-status-${work.status}`">{{ work.statusLabel }}</text>
            </view>
            <view class="product-status-row">
              <text class="product-status-title">商品状态</text>
              <text class="product-status-current" :class="`product-status-${work.productStatus}`">{{ work.productStatusLabel }}</text>
            </view>
            <scroll-view class="product-status-scroll" scroll-x :show-scrollbar="false">
              <view class="product-status-options">
                <button
                  v-for="statusOption in productStatusOptions"
                  :key="statusOption.value"
                  class="product-status-option"
                  :class="{ active: work.productStatus === statusOption.value }"
                  @click.stop="setProductStatus(work, statusOption.value)"
                >{{ statusOption.label }}</button>
              </view>
            </scroll-view>
            <view class="product-operations-dashboard">
              <view class="product-dashboard-head">
                <view>
                  <text class="product-dashboard-kicker">商品生产看板</text>
                  <text class="product-dashboard-name">{{ work.productName }}</text>
                </view>
                <text class="product-risk-level" :class="`risk-${work.riskCode}`">{{ work.riskLevel }}风险</text>
              </view>
              <view class="product-completion-grid">
                <view v-for="item in work.productionCompletion" :key="item.key" class="product-completion-item">
                  <view class="product-completion-row">
                    <text>{{ item.label }}</text>
                    <text>{{ item.value }}%</text>
                  </view>
                  <view class="product-completion-track">
                    <view :style="{ width: item.value + '%' }"></view>
                  </view>
                </view>
              </view>
              <view class="publish-check-row">
                <text class="publish-check-label">发布检查</text>
                <view class="publish-check-tags">
                  <block v-if="!work.publishIssues.length">
                    <text class="publish-check-tag passed">资料齐全</text>
                  </block>
                  <block v-else>
                    <text v-for="issue in work.publishIssues" :key="issue" class="publish-check-tag">{{ issue }}</text>
                  </block>
                </view>
              </view>
              <view class="product-operator-grid">
                <view>
                  <text>负责人</text>
                  <text>{{ work.owner || '未分配' }}</text>
                </view>
                <view>
                  <text>设计师</text>
                  <text>{{ work.designer || '未分配' }}</text>
                </view>
                <view>
                  <text>运营</text>
                  <text>{{ work.operator || '未分配' }}</text>
                </view>
              </view>
              <view class="product-risk-row">
                <text>风险提醒</text>
                <text>{{ work.riskIssues.length ? work.riskIssues.join('、') : '暂无风险' }}</text>
              </view>
              <view class="product-channel-row">
                <text class="product-channel-label">销售渠道</text>
                <view class="product-channel-tags">
                  <text v-if="!work.salesChannelLabels.length" class="product-channel-empty">未设置</text>
                  <text v-for="channel in work.salesChannelLabels" :key="channel" class="product-channel-tag">{{ channel }}</text>
                </view>
              </view>
              <view v-if="work.channelTemplateSuggestions.length" class="channel-template-suggestions">
                <text class="product-channel-label">模板建议</text>
                <text v-for="suggestion in work.channelTemplateSuggestions" :key="suggestion">{{ suggestion }}</text>
              </view>
              <button class="product-operation-edit-btn" @click.stop="toggleProductOperationEditor(work)">
                {{ activeOperationPackageId === work.productPackageId ? '收起运营信息' : '编辑运营信息' }}
              </button>
              <view v-if="activeOperationPackageId === work.productPackageId" class="product-operation-editor">
                <view class="product-operation-fields">
                  <input v-model="productOperationForm.owner" maxlength="20" placeholder="商品负责人" />
                  <input v-model="productOperationForm.designer" maxlength="20" placeholder="设计师" />
                  <input v-model="productOperationForm.operator" maxlength="20" placeholder="运营负责人" />
                </view>
                <text class="product-operation-editor-label">选择销售渠道</text>
                <view class="product-operation-channel-grid">
                  <text
                    v-for="channel in salesChannelOptions"
                    :key="channel.value"
                    :class="{ active: productOperationForm.salesChannels.includes(channel.value) }"
                    @click.stop="toggleProductSalesChannel(channel.value)"
                  >{{ channel.label }}</text>
                </view>
                <button class="product-operation-save-btn" @click.stop="saveProductOperation(work)">保存运营信息</button>
              </view>
            </view>
            <text class="package-asset-count">{{ work.assets.length }} 项商品素材</text>
            <view class="source-chain">
              <text class="chain-node">原始图片</text>
              <text class="chain-arrow">↓</text>
              <text class="chain-node">设计方案</text>
              <text class="chain-arrow">↓</text>
              <text class="chain-node active">商品资料包</text>
              <text class="chain-arrow">↓</text>
              <text class="chain-node">生成作品</text>
            </view>
            <view v-if="work.assets.length" class="package-assets">
              <button
                v-for="asset in work.assets"
                :key="asset.assetId || asset.taskId"
                class="package-asset-btn"
                @click.stop="openPackageAsset(asset)"
              >
                <text>{{ asset.title }}</text>
                <text class="asset-status">{{ asset.statusLabel }}</text>
              </button>
            </view>
            <text v-else class="package-empty">资料包已建立，选择商品资料类型后开始生成。</text>

            <view class="package-marketing-actions">
              <button class="mini-btn marketing-btn" @click.stop="togglePackageMarketingVersions(work)">生成宣传详情页</button>
              <button class="mini-btn copy-product-btn" @click.stop="copyProductPackage(work)">复制商品</button>
              <text class="package-marketing-tip">自动带入资料包图片、商品信息和设计参数</text>
            </view>

            <view v-if="activeMarketingPackageId === work.productPackageId" class="package-marketing-panel">
              <text class="package-marketing-title">选择详情页版本</text>
              <view class="package-marketing-version-grid">
                <button
                  v-for="version in packageMarketingVersions"
                  :key="version.value"
                  class="package-marketing-version"
                  @click.stop="launchPackageMarketing(work, version)"
                >{{ version.label }}</button>
              </view>
            </view>

            <view class="package-delivery-actions">
              <button
                v-if="work.status === 'product_ready'"
                class="mini-btn primary"
                @click.stop="toggleDeliveryProjectSelector(work)"
              >创建交付包</button>
              <button
                v-else-if="work.deliveryId"
                class="mini-btn product-btn"
                @click.stop="openPackageDelivery(work)"
              >{{ work.status === 'delivered' ? '查看已交付资料' : '查看交付中心' }}</button>
              <text v-else class="package-delivery-tip">商品素材完成后可创建企业交付包</text>
            </view>

            <view v-if="activeDeliveryPackageId === work.productPackageId" class="delivery-project-panel">
              <text class="delivery-project-title">选择企业项目</text>
              <button
                v-for="project in workspaceProjects"
                :key="project.workspaceProjectId"
                class="delivery-project-option"
                @click.stop="createEnterpriseDeliveryPackage(work, project)"
              >
                <text>{{ project.title }}</text>
                <text>{{ project.brandId || '未绑定品牌' }}</text>
              </button>
            </view>
          </view>

          <view class="meta-row">
            <text>{{ work.toolTypeLabel }}</text>
            <text>{{ work.createdAtLabel }}</text>
          </view>

          <view v-if="work.isDesignPlan" class="action-row design-actions">
            <button class="mini-btn primary" @click.stop="continueDesign(work)">继续设计</button>
            <button class="mini-btn product-btn" @click.stop="startProductProduction(work)">生成商品资料</button>
          </view>

          <view v-if="work.isDesignPlan && activeProductionWorkId === work.workId" class="production-panel">
            <view v-for="group in productProductionGroups" :key="group.id" class="production-group">
              <text class="production-group-title">{{ group.title }}</text>
              <view class="production-option-grid">
                <button
                  v-for="action in group.actions"
                  :key="action.id"
                  class="production-option"
                  @click.stop="launchProductProduction(work, action)"
                >
                  {{ action.label }}
                </button>
              </view>
            </view>
          </view>

          <view v-if="!work.isDesignPlan && !work.isProductPackage" class="action-row">
            <button class="mini-btn primary" @click.stop="openWork(work)">查看作品</button>
            <button class="mini-btn" @click.stop="continueOptimize(work)">继续优化</button>
            <button class="mini-btn ghost" @click.stop="regenerate(work)">再次生成</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { listTasks } from '../../utils/task/taskLayer'
import { getWorkspaceContexts } from '../../utils/workspace/workspaceContext'
import { getWorkspaceProjects } from '../../utils/workspace/workspaceProject'
import { createWorkspaceDelivery, updateWorkspaceDeliveryStatus } from '../../utils/workspace/workspaceDelivery'
import { createDeliveryPackage, updateDeliveryPackageStatus } from '../../utils/workspace/deliveryPackage'

const CONTINUE_CONTEXT_STORAGE_PREFIX = 'diebiandesign_continue_context_'
const STYLE_DESIGN_PLAN_STORAGE_KEY = 'diebiandesign_style_design_plans'
const PRODUCT_PACKAGE_STORAGE_KEY = 'diebiandesign_product_packages'

const CATEGORY_TABS = [
  { label: '全部', value: 'all' },
  { label: '设计方案', value: 'design_plan' },
  { label: '商品资料包', value: 'product_package' },
  { label: '单个作品', value: 'single_work' }
]

const DESIGN_STATUS_LABELS = {
  draft: '草稿',
  designing: '设计中',
  confirmed: '已确认',
  product_ready: '商品资料已建立'
}

const PRODUCT_PACKAGE_STATUS_LABELS = {
  building: '素材生成中',
  product_ready: '可交付',
  delivery_preparing: '交付准备中',
  delivered: '已交付'
}

const PRODUCT_STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '设计中', value: 'designing' },
  { label: '待上架', value: 'ready_for_sale' },
  { label: '已发布', value: 'published' },
  { label: '已交付', value: 'delivered' }
]

const PRODUCT_STATUS_LABELS = PRODUCT_STATUS_OPTIONS.reduce((result, item) => {
  result[item.value] = item.label
  return result
}, {})

const SALES_CHANNEL_OPTIONS = [
  { label: '淘宝', value: 'taobao' },
  { label: '天猫', value: 'tmall' },
  { label: '抖音', value: 'douyin' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: '官网', value: 'website' }
]

const SALES_CHANNEL_TEMPLATE_SUGGESTIONS = {
  taobao: '淘宝：建议使用方形主图、卖点图、细节图和规格信息。',
  tmall: '天猫：建议强化品牌主图、材质说明、尺寸表和售后信息。',
  douyin: '抖音：建议使用竖版场景图、强卖点首屏和内容封面。',
  xiaohongshu: '小红书：建议使用生活方式场景、穿搭说明和种草文案。',
  website: '官网：建议使用品牌视觉、系列故事、面料工艺和搭配建议。'
}

const PRODUCT_ASSET_LABELS = {
  model_image: 'AI模特图',
  flat_detail: '平铺细节图',
  detail_page: '详情页素材',
  poster: '海报',
  series: '系列图'
}

const PACKAGE_MARKETING_VERSIONS = [
  {
    label: '电商版',
    value: 'ecommerce',
    detailTemplate: 'ecommerce_launch',
    detailModules: ['main_image', 'selling_point', 'outfit_scene', 'detail_image', 'flat_display', 'basic_info'],
    standardDetailModules: ['product_main', 'selling_intro', 'model_display', 'scene_display', 'detail_display', 'fabric_info', 'size_table', 'care_instructions']
  },
  {
    label: '小红书版',
    value: 'xiaohongshu',
    detailTemplate: 'social_seed',
    detailModules: ['main_image', 'outfit_scene', 'detail_image', 'selling_point'],
    standardDetailModules: ['product_main', 'selling_intro', 'model_display', 'scene_display', 'detail_display', 'styling_advice']
  },
  {
    label: '品牌版',
    value: 'brand',
    detailTemplate: 'brand_website',
    detailModules: ['main_image', 'outfit_scene', 'detail_image', 'flat_display', 'basic_info'],
    standardDetailModules: ['product_main', 'model_display', 'scene_display', 'detail_display', 'fabric_info', 'brand_intro', 'styling_advice']
  }
]

const PRODUCT_PRODUCTION_GROUPS = [
  {
    id: 'product_display',
    title: '商品展示',
    actions: [
      { id: 'model_image', label: 'AI模特图', toolType: 'model', continueAction: 'model_display' },
      { id: 'flat_detail', label: '平铺细节图', toolType: 'flat_lay', continueAction: 'flat_lay' }
    ]
  },
  {
    id: 'promotion',
    title: '宣传',
    actions: [
      { id: 'detail_page', label: '详情页', toolType: 'marketing', continueAction: 'detail_page' },
      { id: 'poster', label: '海报', toolType: 'marketing', continueAction: 'poster' },
      { id: 'series', label: '系列图', toolType: 'marketing', continueAction: 'series' }
    ]
  }
]

const TOOL_LABELS = {
  model: 'AI模特图',
  color: '服装改款式',
  fabric: '服装改款式',
  pattern: '服装改款式',
  refine: '服装改款式',
  style: '服装改款式',
  flat_lay: '平铺细节图',
  '3d_display': '平铺细节图',
  hanging_photo: '平铺细节图',
  mannequin: '平铺细节图',
  detail_photo: '平铺细节图',
  marketing: '宣传详情页'
}

function pickUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.imageUrl || value.image_url || value.fileUrl || value.file_url || value.url || value.localPath || ''
}

function getTaskParams(task = {}) {
  const input = task.input || {}
  return {
    ...(input.options || {}),
    ...(input.params || {}),
    ...(task.params || {})
  }
}

function getCoverUrl(task = {}) {
  const result = task.result || {}
  const items = Array.isArray(result.items) ? result.items : []
  const firstItem = items[0] || {}
  const input = task.input || {}
  const assets = input.assets || {}
  return task.coverUrl ||
    task.resultImageUrl ||
    task.result_image_url ||
    result.coverUrl ||
    result.imageUrl ||
    result.image_url ||
    pickUrl(firstItem) ||
    pickUrl(assets.clothImage) ||
    pickUrl(assets.styleImage) ||
    pickUrl(input.imageUrl) ||
    ''
}

function getSourceImage(task = {}, coverUrl = '') {
  const input = task.input || {}
  const assets = input.assets || {}
  return pickUrl(assets.clothImage) || pickUrl(assets.styleImage) || input.imageUrl || input.image_url || coverUrl
}

function getToolType(task = {}) {
  const params = getTaskParams(task)
  const type = String(params.toolType || task.toolType || task.type || task.taskType || '').toLowerCase()
  if (type.includes('model')) return 'model'
  if (type.includes('color')) return 'color'
  if (type.includes('fabric')) return 'fabric'
  if (type.includes('pattern')) return 'pattern'
  if (type.includes('refine') || type.includes('style')) return 'refine'
  if (type.includes('scene')) return 'model'
  if (type.includes('detail') || type.includes('flat') || type.includes('display')) return 'flat_lay'
  if (type.includes('marketing') || type.includes('poster') || type.includes('series')) return 'marketing'
  return params.outputUsage && /详情|海报|系列|营销/.test(params.outputUsage) ? 'marketing' : 'model'
}

function formatTime(value = '') {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '刚刚'
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function getTaskStatusLabel(task = {}) {
  const status = String(task.status || task.stage || '').toLowerCase()
  if (status === 'completed' || status === 'success') return '已完成'
  if (status === 'failed' || status === 'error') return '失败'
  return '生成中'
}

function normalizePackageAsset(asset = {}) {
  return {
    assetId: asset.assetId || asset.taskId || `package_asset_${asset.createdAt || Date.now()}`,
    taskId: asset.taskId || '',
    assetType: asset.assetType || asset.selectedAction || '',
    title: asset.title || PRODUCT_ASSET_LABELS[asset.assetType] || '商品素材',
    coverUrl: asset.coverUrl || '',
    status: asset.status || 'generating',
    statusLabel: asset.statusLabel || (asset.status === 'completed' ? '已完成' : (asset.status === 'failed' ? '失败' : '生成中')),
    createdAt: asset.createdAt || ''
  }
}

function buildProductOperationsDashboard(productPackage = {}) {
  const assets = Array.isArray(productPackage.assets) ? productPackage.assets : []
  const detailModules = Array.isArray(productPackage.detailModules) ? productPackage.detailModules : []
  const completedAssets = assets.filter((asset) => {
    const status = String(asset.status || '').toLowerCase()
    return status === 'completed' || status === 'success' || asset.statusLabel === '已完成'
  })
  const hasAssetType = (types = []) => completedAssets.some((asset) => {
    return types.includes(asset.assetType) || types.some((type) => String(asset.title || '').includes(type))
  })
  const hasDetailPage = hasAssetType(['detail_page', '详情页'])
  const hasMainImage = hasAssetType(['main_image', 'model_image', '商品主图', 'AI模特图']) ||
    (hasDetailPage && detailModules.includes('main_image'))
  const hasDetailImage = hasAssetType(['flat_detail', 'detail_image', 'detail_photo', '细节图', '平铺细节图']) ||
    (hasDetailPage && detailModules.includes('detail_image'))
  const hasProductImage = hasMainImage || hasAssetType(['flat_detail', 'poster', 'series'])
  const productInfo = productPackage.productInfo || {}
  const hasCopy = Boolean(
    String(productInfo.productTitle || '').trim() &&
    (String(productInfo.sellingPoints || '').trim() || String(productInfo.detailDescription || '').trim())
  )
  const hasDesign = Boolean(productPackage.sourceDesignId || Object.keys(productPackage.designParams || {}).length)
  const hasDelivery = Boolean(
    productPackage.deliveryPackageId ||
    productPackage.deliveryId ||
    ['delivery_preparing', 'delivered'].includes(productPackage.status)
  )
  const publishIssues = [
    !hasMainImage ? '缺少主图' : '',
    !hasDetailPage ? '缺少详情页' : '',
    !hasDetailImage ? '缺少细节图' : '',
    !hasCopy ? '缺少文案' : ''
  ].filter(Boolean)
  const riskIssues = [
    ...publishIssues,
    !hasDelivery ? '缺交付' : ''
  ].filter(Boolean)
  const riskCode = riskIssues.length >= 3 ? 'high' : (riskIssues.length ? 'medium' : 'low')
  const riskLevelMap = { high: '高', medium: '中', low: '低' }
  const salesChannels = Array.isArray(productPackage.salesChannels) ? productPackage.salesChannels : []
  const completionValues = [hasDesign, hasProductImage, hasDetailPage, hasDelivery]
  return {
    productName: productInfo.productTitle || productInfo.name || productPackage.title || '未命名商品',
    owner: productPackage.owner || '',
    designer: productPackage.designer || '',
    operator: productPackage.operator || '',
    salesChannels,
    salesChannelLabels: SALES_CHANNEL_OPTIONS.filter((item) => salesChannels.includes(item.value)).map((item) => item.label),
    channelTemplateSuggestions: salesChannels.map((channel) => SALES_CHANNEL_TEMPLATE_SUGGESTIONS[channel]).filter(Boolean),
    overallCompletion: completionValues.filter(Boolean).length * 25,
    productionCompletion: [
      { key: 'design', label: '设计完成度', value: hasDesign ? 100 : 0 },
      { key: 'material', label: '素材完成度', value: hasProductImage ? 100 : 0 },
      { key: 'detail', label: '详情页完成度', value: hasDetailPage ? 100 : 0 },
      { key: 'delivery', label: '交付完成度', value: hasDelivery ? 100 : 0 }
    ],
    publishIssues,
    riskIssues,
    riskCode,
    riskLevel: riskLevelMap[riskCode]
  }
}

function normalizeProductPackage(productPackage = {}, designPlanMap = {}) {
  const sourceDesign = designPlanMap[productPackage.sourceDesignId] || {}
  const designParams = {
    ...((sourceDesign && sourceDesign.params) || {}),
    ...((productPackage && productPackage.designParams) || {})
  }
  const assets = ((Array.isArray(productPackage.assets) && productPackage.assets) || []).map(normalizePackageAsset)
  const firstAsset = assets.find((asset) => asset.coverUrl) || assets[0] || {}
  const createdAt = productPackage.createdAt || ''
  const hasCompletedAsset = assets.some((asset) => asset.status === 'completed')
  const status = productPackage.status || (hasCompletedAsset ? 'product_ready' : 'building')
  const productStatus = status === 'delivered'
    ? 'delivered'
    : (productPackage.productStatus || (hasCompletedAsset ? 'ready_for_sale' : (assets.length ? 'designing' : 'draft')))
  const productInfo = productPackage.productInfo || designParams.productInfo || {}
  const operationsDashboard = buildProductOperationsDashboard({
    ...productPackage,
    assets,
    designParams,
    productInfo,
    status
  })
  return {
    isProductPackage: true,
    workId: productPackage.productPackageId || `product_package_${createdAt || Date.now()}`,
    productPackageId: productPackage.productPackageId || '',
    sourceDesignId: productPackage.sourceDesignId || '',
    sourceVersion: Number(productPackage.sourceVersion || sourceDesign.version || 1),
    assetIds: Array.isArray(productPackage.assetIds) ? productPackage.assetIds : assets.map((asset) => asset.assetId).filter(Boolean),
    deliveryId: productPackage.deliveryId || '',
    deliveryPackageId: productPackage.deliveryPackageId || '',
    projectId: productPackage.projectId || '',
    status,
    statusLabel: PRODUCT_PACKAGE_STATUS_LABELS[status] || '素材生成中',
    productStatus,
    productStatusLabel: PRODUCT_STATUS_LABELS[productStatus] || '草稿',
    parentProductPackageId: productPackage.parentProductPackageId || '',
    rootProductPackageId: productPackage.rootProductPackageId || productPackage.productPackageId || '',
    packageVersion: Number(productPackage.packageVersion || 1),
    title: productPackage.title || `${sourceDesign.planName || sourceDesign.title || '设计方案'} 商品资料包`,
    generationType: '商品资料包',
    toolTypeLabel: '商品生产资产',
    category: 'product_package',
    coverUrl: firstAsset.coverUrl || sourceDesign.sourceImage || '',
    sourceImage: productPackage.sourceImage || sourceDesign.sourceImage || firstAsset.coverUrl || '',
    designParams,
    productInfo,
    detailModules: Array.isArray(productPackage.detailModules) ? productPackage.detailModules : [],
    standardDetailModules: Array.isArray(productPackage.standardDetailModules) ? productPackage.standardDetailModules : [],
    detailTemplate: productPackage.detailTemplate || '',
    marketingVersion: productPackage.marketingVersion || '',
    marketingPrompt: productPackage.marketingPrompt || designParams.marketingPrompt || '',
    ...operationsDashboard,
    assets,
    createdAt,
    createdAtLabel: formatTime(createdAt)
  }
}

function normalizeDesignPlan(plan = {}) {
  const params = {
    ...(plan.params || {}),
    sourceImage: plan.sourceImage || (plan.params && plan.params.sourceImage) || '',
    referenceImages: Array.isArray(plan.referenceImages) ? plan.referenceImages : [],
    designImages: Array.isArray(plan.designImages)
      ? plan.designImages
      : ((plan.params && Array.isArray(plan.params.designImages)) ? plan.params.designImages : []),
    selectedModifyTypes: Array.isArray(plan.selectedModifyTypes) ? plan.selectedModifyTypes : [],
    selectedStyles: Array.isArray(plan.selectedStyles) ? plan.selectedStyles : [],
    aiGeneratedPrompt: plan.aiGeneratedPrompt || '',
    modificationPrompt: plan.modificationPrompt || plan.aiPrompt || '',
    referencePrompt: plan.referencePrompt || '',
    outputCount: Number(plan.outputCount || plan.count || 1),
    parentDesignId: plan.parentDesignId || (plan.params && plan.params.parentDesignId) || '',
    version: Number(plan.version || (plan.params && plan.params.version) || 1),
    branchName: plan.branchName || (plan.params && plan.params.branchName) || '主方案',
    sourceDesignPlanId: plan.planId || '',
    designPlanName: plan.planName || plan.title || '设计方案',
    toolType: 'refine'
  }
  const direction = [
    ...((Array.isArray(plan.selectedModifyTypeNames) && plan.selectedModifyTypeNames) || []),
    ...((Array.isArray(plan.selectedStyleNames) && plan.selectedStyleNames) || [])
  ].filter(Boolean).join(' / ')
  return {
    isDesignPlan: true,
    workId: plan.planId || plan.assetId || `design_plan_${plan.createdAt || Date.now()}`,
    taskId: plan.planId || '',
    planId: plan.planId || '',
    assetId: plan.assetId || plan.planId || '',
    coverUrl: plan.sourceImage || params.sourceImage || params.referenceImages[0] || '',
    sourceImage: plan.sourceImage || params.sourceImage || '',
    referenceImages: params.referenceImages,
    designImages: params.designImages,
    title: plan.planName || plan.title || '设计方案',
    toolType: 'refine',
    toolTypeLabel: '设计方案',
    generationType: '设计方案',
    category: 'design_plan',
    createdAt: plan.createdAt || '',
    createdAtLabel: formatTime(plan.createdAt),
    designDirection: direction || plan.referenceStyleName || '改款设计',
    outputCount: params.outputCount,
    parentDesignId: params.parentDesignId,
    version: params.version,
    branchName: params.branchName,
    status: plan.status || (plan.params && plan.params.status) || 'draft',
    statusLabel: DESIGN_STATUS_LABELS[plan.status || (plan.params && plan.params.status) || 'draft'] || '草稿',
    params
  }
}

export default {
  data() {
    return {
      activeCategory: 'all',
      tasks: [],
      designPlans: [],
      productPackages: [],
      workspaceProjects: [],
      activeProductionWorkId: '',
      activeProductionContextId: '',
      activeDeliveryPackageId: '',
      activeMarketingPackageId: '',
      activeOperationPackageId: '',
      productOperationForm: {
        owner: '',
        designer: '',
        operator: '',
        salesChannels: []
      }
    }
  },
  computed: {
    categoryTabs() {
      return CATEGORY_TABS
    },
    productProductionGroups() {
      return PRODUCT_PRODUCTION_GROUPS
    },
    packageMarketingVersions() {
      return PACKAGE_MARKETING_VERSIONS
    },
    productStatusOptions() {
      return PRODUCT_STATUS_OPTIONS
    },
    salesChannelOptions() {
      return SALES_CHANNEL_OPTIONS
    },
    aiWorks() {
      return this.tasks.map((task) => {
        const params = getTaskParams(task)
        const coverUrl = getCoverUrl(task)
        const toolType = getToolType(task)
        const createdAt = task.completedAt || task.updatedAt || task.createdAt || task.submittedAt || ''
        const taskId = task.taskId || task.id || task.clientTaskId || ''
        return {
          task,
          workId: taskId,
          taskId,
          assetId: task.assetId || params.assetId || '',
          coverUrl,
          sourceImage: getSourceImage(task, coverUrl),
          title: params.promptPlan && params.promptPlan.outputUsage ? params.promptPlan.outputUsage : TOOL_LABELS[toolType] || 'AI 出图作品',
          toolType,
          toolTypeLabel: TOOL_LABELS[toolType] || 'AI 出图',
          createdAt,
          createdAtLabel: formatTime(createdAt),
          generationType: TOOL_LABELS[toolType] || 'AI 出图',
          category: 'single_work',
          params
        }
      }).filter((work) => work.taskId)
    },
    designPlanWorks() {
      return this.designPlans.map((plan) => normalizeDesignPlan(plan))
    },
    productPackageWorks() {
      const designPlanMap = this.designPlans.reduce((result, plan) => {
        result[plan.planId] = plan
        return result
      }, {})
      return this.productPackages.map((productPackage) => normalizeProductPackage(productPackage, designPlanMap))
    },
    works() {
      return [...this.productPackageWorks, ...this.designPlanWorks, ...this.aiWorks].sort((a, b) => {
        const left = new Date(a.createdAt || 0).getTime() || 0
        const right = new Date(b.createdAt || 0).getTime() || 0
        return right - left
      })
    },
    filteredWorks() {
      if (this.activeCategory === 'all') return this.works
      return this.works.filter((work) => work.category === this.activeCategory)
    }
  },
  onShow() {
    this.refreshWorks()
  },
  onPullDownRefresh() {
    this.refreshWorks()
    uni.stopPullDownRefresh()
  },
  methods: {
    refreshWorks() {
      const tasks = listTasks()
      const plans = uni.getStorageSync(STYLE_DESIGN_PLAN_STORAGE_KEY)
      const packages = uni.getStorageSync(PRODUCT_PACKAGE_STORAGE_KEY)
      this.workspaceProjects = getWorkspaceProjects(getWorkspaceContexts())
      const synced = this.syncProductPackages(
        tasks,
        Array.isArray(packages) ? packages : [],
        Array.isArray(plans) ? plans : []
      )
      this.tasks = tasks
      this.designPlans = synced.designPlans
      this.productPackages = synced.productPackages
    },
    syncProductPackages(tasks = [], packages = [], designPlans = []) {
      const packageMap = packages.reduce((result, productPackage) => {
        if (productPackage && productPackage.productPackageId) {
          result[productPackage.productPackageId] = {
            ...productPackage,
            assets: Array.isArray(productPackage.assets) ? [...productPackage.assets] : []
          }
        }
        return result
      }, {})

      tasks.forEach((task) => {
        const params = getTaskParams(task)
        const productPackageId = params.productPackageId || ''
        if (!productPackageId) return
        const taskId = task.taskId || task.id || task.clientTaskId || ''
        if (!taskId) return
        const selectedAction = params.selectedAction || params.continueAction || ''
        const rawStatus = String(task.status || task.stage || '').toLowerCase()
        const status = rawStatus === 'completed' || rawStatus === 'success'
          ? 'completed'
          : (rawStatus === 'failed' || rawStatus === 'error' ? 'failed' : 'generating')
        const productPackage = packageMap[productPackageId] || {
          productPackageId,
          sourceDesignId: params.sourceDesignPlanId || params.sourceDesignId || '',
          sourceVersion: Number(params.sourceVersion || params.version || 1),
          assets: [],
          createdAt: task.createdAt || Date.now()
        }
        const nextAsset = {
          assetId: task.assetId || params.assetId || taskId,
          taskId,
          assetType: selectedAction,
          title: PRODUCT_ASSET_LABELS[selectedAction] || TOOL_LABELS[getToolType(task)] || '商品素材',
          coverUrl: getCoverUrl(task),
          status,
          statusLabel: getTaskStatusLabel(task),
          createdAt: task.completedAt || task.updatedAt || task.createdAt || Date.now()
        }
        const assets = Array.isArray(productPackage.assets) ? [...productPackage.assets] : []
        const assetIndex = assets.findIndex((asset) => asset.taskId === taskId || asset.assetId === nextAsset.assetId)
        if (assetIndex >= 0) {
          assets.splice(assetIndex, 1, { ...assets[assetIndex], ...nextAsset })
        } else {
          assets.push(nextAsset)
        }
        packageMap[productPackageId] = {
          ...productPackage,
          assets,
          updatedAt: task.updatedAt || Date.now()
        }
      })

      const productPackages = Object.values(packageMap).sort((left, right) => {
        return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime()
      })
      const readyDesignIds = new Set(
        productPackages
          .filter((item) => item.assets && item.assets.some((asset) => asset.status === 'completed'))
          .map((item) => item.sourceDesignId)
      )
      productPackages.forEach((productPackage) => {
        const hasCompletedAsset = productPackage.assets && productPackage.assets.some((asset) => asset.status === 'completed')
        if (productPackage.status !== 'delivery_preparing' && productPackage.status !== 'delivered') {
          productPackage.status = hasCompletedAsset ? 'product_ready' : 'building'
        }
        if (productPackage.status === 'delivered') {
          productPackage.productStatus = 'delivered'
        } else if (!productPackage.productStatus) {
          productPackage.productStatus = productPackage.status === 'delivered'
            ? 'delivered'
            : (hasCompletedAsset ? 'ready_for_sale' : ((productPackage.assets || []).length ? 'designing' : 'draft'))
        }
      })
      const nextDesignPlans = designPlans.map((plan) => {
        if (!readyDesignIds.has(plan.planId)) return plan
        return {
          ...plan,
          status: 'product_ready',
          params: {
            ...(plan.params || {}),
            status: 'product_ready'
          }
        }
      })
      uni.setStorageSync(PRODUCT_PACKAGE_STORAGE_KEY, productPackages)
      uni.setStorageSync(STYLE_DESIGN_PLAN_STORAGE_KEY, nextDesignPlans)
      return { productPackages, designPlans: nextDesignPlans }
    },
    updateDesignStatus(planId = '', status = 'draft') {
      if (!planId) return
      this.designPlans = this.designPlans.map((plan) => {
        if (plan.planId !== planId) return plan
        return {
          ...plan,
          status,
          params: {
            ...(plan.params || {}),
            status
          }
        }
      })
      uni.setStorageSync(STYLE_DESIGN_PLAN_STORAGE_KEY, this.designPlans)
    },
    updateProductPackage(productPackageId = '', patch = {}) {
      if (!productPackageId) return null
      let updatedPackage = null
      this.productPackages = this.productPackages.map((productPackage) => {
        if (productPackage.productPackageId !== productPackageId) return productPackage
        updatedPackage = {
          ...productPackage,
          ...patch,
          updatedAt: Date.now()
        }
        return updatedPackage
      })
      if (updatedPackage) {
        uni.setStorageSync(PRODUCT_PACKAGE_STORAGE_KEY, this.productPackages)
      }
      return updatedPackage
    },
    ensureProductPackage(work = {}) {
      const existing = this.productPackages.find((item) => {
        return item.sourceDesignId === work.planId && Number(item.sourceVersion || 1) === Number(work.version || 1)
      })
      if (existing) {
        const hasCompletedAsset = existing.assets && existing.assets.some((asset) => asset.status === 'completed')
        this.updateDesignStatus(work.planId, hasCompletedAsset ? 'product_ready' : 'confirmed')
        return existing
      }
      const productPackage = {
        productPackageId: `product_package_${work.planId || work.workId}_${Date.now()}`,
        sourceDesignId: work.planId || '',
        sourceVersion: Number(work.version || 1),
        assets: [],
        status: 'building',
        productStatus: 'draft',
        packageVersion: 1,
        createdAt: Date.now()
      }
      this.productPackages = [productPackage, ...this.productPackages]
      uni.setStorageSync(PRODUCT_PACKAGE_STORAGE_KEY, this.productPackages)
      this.updateDesignStatus(work.planId, 'confirmed')
      return productPackage
    },
    toggleDeliveryProjectSelector(work = {}) {
      const completedAssets = (work.assets || []).filter((asset) => asset.status === 'completed' && asset.assetId)
      if (!completedAssets.length) {
        uni.showToast({ title: '暂无已完成商品素材', icon: 'none' })
        return
      }
      if (!this.workspaceProjects.length) {
        uni.showToast({ title: '请先创建企业项目', icon: 'none' })
        return
      }
      this.activeDeliveryPackageId = this.activeDeliveryPackageId === work.productPackageId
        ? ''
        : work.productPackageId
    },
    createEnterpriseDeliveryPackage(work = {}, project = {}) {
      if (!work.productPackageId || !project.projectId) return
      const assetIds = Array.from(new Set(
        (work.assets || [])
          .filter((asset) => asset.status === 'completed')
          .map((asset) => asset.assetId || asset.taskId)
          .filter(Boolean)
      ))
      if (!assetIds.length) {
        uni.showToast({ title: '暂无可交付素材', icon: 'none' })
        return
      }
      const delivery = createWorkspaceDelivery({
        projectId: project.projectId,
        customerId: project.customerId || '',
        assetVersionIds: assetIds
      })
      if (!delivery) {
        uni.showToast({ title: '交付记录创建失败', icon: 'none' })
        return
      }
      const deliveryPackage = createDeliveryPackage({
        deliveryId: delivery.deliveryId,
        projectId: project.projectId,
        assetVersionIds: assetIds,
        title: `${work.title || '商品资料'}企业交付包`,
        status: 'draft'
      })
      if (!deliveryPackage) {
        uni.showToast({ title: '交付包创建失败', icon: 'none' })
        return
      }
      updateWorkspaceDeliveryStatus(delivery.deliveryId, 'preparing')
      updateDeliveryPackageStatus(deliveryPackage.deliveryPackageId, 'preparing')
      this.updateProductPackage(work.productPackageId, {
        productPackageId: work.productPackageId,
        sourceDesignId: work.sourceDesignId,
        sourceVersion: Number(work.sourceVersion || 1),
        assetIds,
        deliveryId: delivery.deliveryId,
        deliveryPackageId: deliveryPackage.deliveryPackageId,
        projectId: project.projectId,
        status: 'delivery_preparing'
      })
      this.activeDeliveryPackageId = ''
      console.log('[workspace:delivery]', { deliveryId: delivery.deliveryId })
      console.log('[workspace:delivery-package]', { deliveryPackageId: deliveryPackage.deliveryPackageId })
      uni.showToast({ title: '交付包已创建', icon: 'success' })
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(project.projectId)}&mode=delivery-review`
      })
    },
    openPackageDelivery(work = {}) {
      if (!work.projectId) return
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(work.projectId)}&mode=delivery-review`
      })
    },
    openWork(work) {
      if (!work) return
      if (work.isProductPackage) {
        const firstAsset = work.assets && work.assets.find((asset) => asset.taskId)
        if (firstAsset) this.openPackageAsset(firstAsset)
        return
      }
      if (work.isDesignPlan) {
        this.continueDesign(work)
        return
      }
      if (!work.taskId) return
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(work.taskId)}`
      })
    },
    openPackageAsset(asset = {}) {
      if (!asset.taskId) return
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(asset.taskId)}`
      })
    },
    togglePackageMarketingVersions(work = {}) {
      if (!work.productPackageId) return
      this.activeMarketingPackageId = this.activeMarketingPackageId === work.productPackageId
        ? ''
        : work.productPackageId
    },
    setProductStatus(work = {}, productStatus = '') {
      if (!work.productPackageId || !PRODUCT_STATUS_LABELS[productStatus]) return
      this.updateProductPackage(work.productPackageId, { productStatus })
    },
    toggleProductOperationEditor(work = {}) {
      if (!work.productPackageId) return
      if (this.activeOperationPackageId === work.productPackageId) {
        this.activeOperationPackageId = ''
        return
      }
      this.activeOperationPackageId = work.productPackageId
      this.productOperationForm = {
        owner: work.owner || '',
        designer: work.designer || '',
        operator: work.operator || '',
        salesChannels: [...(work.salesChannels || [])]
      }
    },
    toggleProductSalesChannel(channel = '') {
      if (!channel) return
      const channels = this.productOperationForm.salesChannels || []
      this.productOperationForm.salesChannels = channels.includes(channel)
        ? channels.filter((item) => item !== channel)
        : [...channels, channel]
    },
    saveProductOperation(work = {}) {
      if (!work.productPackageId) return
      this.updateProductPackage(work.productPackageId, {
        owner: String(this.productOperationForm.owner || '').trim(),
        designer: String(this.productOperationForm.designer || '').trim(),
        operator: String(this.productOperationForm.operator || '').trim(),
        salesChannels: [...(this.productOperationForm.salesChannels || [])]
      })
      this.activeOperationPackageId = ''
      uni.showToast({ title: '运营信息已保存', icon: 'success' })
    },
    copyProductPackage(work = {}) {
      if (!work.productPackageId) return
      const createdAt = Date.now()
      const rootProductPackageId = work.rootProductPackageId || work.productPackageId
      const packageVersion = this.productPackages.reduce((maxVersion, productPackage) => {
        const sameRoot = productPackage.productPackageId === rootProductPackageId ||
          productPackage.rootProductPackageId === rootProductPackageId
        return sameRoot ? Math.max(maxVersion, Number(productPackage.packageVersion || 1)) : maxVersion
      }, Number(work.packageVersion || 1)) + 1
      const copiedPackage = {
        productPackageId: `product_package_copy_${createdAt}`,
        parentProductPackageId: work.productPackageId,
        rootProductPackageId,
        packageVersion,
        sourceDesignId: work.sourceDesignId || '',
        sourceVersion: Number(work.sourceVersion || 1),
        title: `${work.title || '商品资料包'} 副本 V${packageVersion}`,
        sourceImage: work.sourceImage || work.coverUrl || '',
        designParams: { ...(work.designParams || {}) },
        productInfo: { ...(work.productInfo || {}) },
        detailTemplate: work.detailTemplate || '',
        detailModules: [...(work.detailModules || [])],
        standardDetailModules: [...(work.standardDetailModules || [])],
        marketingPrompt: work.marketingPrompt || '',
        owner: work.owner || '',
        designer: work.designer || '',
        operator: work.operator || '',
        salesChannels: [...(work.salesChannels || [])],
        assets: [],
        status: 'building',
        productStatus: 'draft',
        createdAt,
        updatedAt: createdAt
      }
      this.productPackages = [copiedPackage, ...this.productPackages]
      uni.setStorageSync(PRODUCT_PACKAGE_STORAGE_KEY, this.productPackages)
      this.activeCategory = 'product_package'
      uni.showToast({ title: '商品已复制', icon: 'success' })
    },
    buildPackageMarketingContext(work = {}, version = {}) {
      const sourceImage = work.sourceImage || work.coverUrl || ''
      const designParams = { ...(work.designParams || {}) }
      const productInfo = {
        ...((designParams && designParams.productInfo) || {}),
        ...(work.productInfo || {})
      }
      const detailModules = Array.isArray(version.detailModules) ? [...version.detailModules] : []
      const standardDetailModules = Array.isArray(version.standardDetailModules) ? [...version.standardDetailModules] : []
      const contextId = `package_marketing_${work.productPackageId}_${Date.now()}`
      const params = {
        ...designParams,
        toolType: 'marketing',
        continueAction: 'detail_page',
        selectedAction: 'detail_page',
        sourceImage,
        productInfo,
        productTitle: productInfo.productTitle || productInfo.name || '',
        sellingPoints: productInfo.sellingPoints || '',
        detailDescription: productInfo.detailDescription || '',
        designParams,
        detailModules,
        standardDetailModules,
        marketingPrompt: work.marketingPrompt || designParams.marketingPrompt || '',
        marketingVersion: version.value || 'ecommerce',
        sourcePackageId: work.productPackageId,
        productPackageId: work.productPackageId,
        detailTemplate: version.detailTemplate || 'ecommerce_launch'
      }
      const context = {
        contextId,
        taskId: '',
        planId: work.sourceDesignId || '',
        assetId: '',
        resultImage: sourceImage,
        sourceImage,
        toolType: 'marketing',
        params
      }
      uni.setStorageSync(`${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`, context)
      this.updateProductPackage(work.productPackageId, {
        sourceImage,
        designParams,
        marketingVersion: params.marketingVersion,
        detailTemplate: params.detailTemplate,
        detailModules,
        standardDetailModules,
        productInfo,
        marketingPrompt: params.marketingPrompt
      })
      return context
    },
    launchPackageMarketing(work = {}, version = {}) {
      const context = this.buildPackageMarketingContext(work, version)
      if (!context || !context.contextId) return
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench?toolType=marketing&continueAction=detail_page&continueContextId=${encodeURIComponent(context.contextId)}`
      })
    },
    buildContinueContext(work = {}, overrideToolType = '', extraParams = {}) {
      const toolType = overrideToolType || work.toolType || 'model'
      const contextId = `${work.taskId || work.planId || 'work'}_${toolType}_${Date.now()}`
      const params = {
        ...(work.params || {}),
        ...extraParams,
        sourceImage: work.sourceImage || work.coverUrl || (work.params && work.params.sourceImage) || '',
        referenceImages: work.referenceImages || (work.params && work.params.referenceImages) || [],
        toolType
      }
      const context = {
        contextId,
        taskId: work.isDesignPlan ? '' : (work.taskId || ''),
        planId: work.planId || '',
        assetId: work.assetId || '',
        resultImage: work.coverUrl || work.sourceImage || '',
        sourceImage: work.sourceImage || work.coverUrl || '',
        toolType,
        params
      }
      uni.setStorageSync(`${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`, context)
      return context
    },
    buildProductProductionContext(work = {}) {
      const productPackage = this.ensureProductPackage(work)
      const sourceImage = work.sourceImage || work.coverUrl || (work.params && work.params.sourceImage) || ''
      const designParams = {
        ...(work.params || {}),
        sourceDesignPlanId: work.planId || '',
        parentDesignId: work.parentDesignId || '',
        version: Number(work.version || 1),
        branchName: work.branchName || '主方案'
      }
      const designImages = Array.from(new Set([
        sourceImage,
        ...((Array.isArray(work.designImages) && work.designImages) || []),
        ...((Array.isArray(work.referenceImages) && work.referenceImages) || []),
        ...((Array.isArray(designParams.referenceImages) && designParams.referenceImages) || [])
      ].filter(Boolean)))
      const contextId = `design_production_${work.planId || work.workId}_${Date.now()}`
      const context = {
        contextId,
        productPackageId: productPackage.productPackageId,
        taskId: '',
        planId: work.planId || '',
        assetId: work.assetId || '',
        resultImage: sourceImage,
        sourceImage,
        designParams,
        designImages,
        toolType: 'product_production',
        params: {
          ...designParams,
          productPackageId: productPackage.productPackageId,
          sourceDesignId: work.planId || '',
          sourceVersion: Number(work.version || 1),
          sourceImage,
          designParams,
          designImages,
          toolType: 'product_production',
          productionSource: 'design_plan'
        }
      }
      uni.setStorageSync(`${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`, context)
      return context
    },
    startProductProduction(work) {
      if (this.activeProductionWorkId === work.workId) {
        this.activeProductionWorkId = ''
        this.activeProductionContextId = ''
        return
      }
      const context = this.buildProductProductionContext(work)
      this.activeProductionWorkId = work.workId
      this.activeProductionContextId = context.contextId
    },
    launchProductProduction(work, action = {}) {
      let contextId = this.activeProductionWorkId === work.workId
        ? this.activeProductionContextId
        : this.buildProductProductionContext(work).contextId
      let storageKey = `${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`
      let context = uni.getStorageSync(storageKey)
      if (!context) {
        context = this.buildProductProductionContext(work)
        contextId = context.contextId
        storageKey = `${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`
      }
      const toolType = action.toolType || 'model'
      const continueAction = action.continueAction || ''
      const nextContext = {
        ...context,
        toolType,
        selectedAction: action.id || '',
        params: {
          ...(context.params || {}),
          toolType,
          continueAction,
          selectedAction: action.id || ''
        }
      }
      uni.setStorageSync(storageKey, nextContext)
      const query = [
        `toolType=${encodeURIComponent(toolType)}`,
        `continueContextId=${encodeURIComponent(contextId)}`
      ]
      if (continueAction) {
        query.push(`continueAction=${encodeURIComponent(continueAction)}`)
      }
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench?${query.join('&')}`
      })
    },
    goWorkbenchWithContext(work, toolType, extraParams = {}) {
      const context = this.buildContinueContext(work, toolType, extraParams)
      const query = [
        `toolType=${encodeURIComponent(context.toolType)}`,
        `continueContextId=${encodeURIComponent(context.contextId)}`
      ]
      if (extraParams.continueAction) {
        query.push(`continueAction=${encodeURIComponent(extraParams.continueAction)}`)
      }
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench?${query.join('&')}`
      })
    },
    continueDesign(work) {
      this.updateDesignStatus(work.planId, 'designing')
      this.goWorkbenchWithContext(work, 'refine', {
        continueAsNewVersion: true,
        sourceDesignPlanId: work.planId || '',
        parentDesignId: work.parentDesignId || '',
        sourceDesignVersion: Number(work.version || 1),
        branchName: work.branchName || '主方案',
        designParams: { ...(work.params || {}) },
        designImages: Array.from(new Set([
          work.sourceImage,
          ...((Array.isArray(work.referenceImages) && work.referenceImages) || [])
        ].filter(Boolean)))
      })
    },
    generateFlatLay(work) {
      this.goWorkbenchWithContext(work, 'flat_lay', { continueAction: 'flat_lay' })
    },
    generateDetailPage(work) {
      this.goWorkbenchWithContext(work, 'marketing', { continueAction: 'detail_page' })
    },
    generateMarketing(work) {
      this.goWorkbenchWithContext(work, 'marketing', { continueAction: 'poster' })
    },
    continueOptimize(work) {
      const targetTool = work.category === 'marketing' ? 'marketing' : (work.toolType || 'model')
      this.goWorkbenchWithContext(work, targetTool)
    },
    regenerate(work) {
      const context = this.buildContinueContext(work, work.toolType)
      uni.navigateTo({
        url: `/package-ai/simple-ai-workbench/simple-ai-workbench?toolType=${encodeURIComponent(context.toolType)}&continueContextId=${encodeURIComponent(context.contextId)}&regenerate=1`
      })
    },
    goHome() {
      uni.switchTab({ url: '/pages/index/index' })
    }
  }
}
</script>

<style scoped>
.works-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f6f7fb;
  box-sizing: border-box;
}

.works-hero,
.empty-card,
.work-card {
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.works-hero {
  padding: 28rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f7f8ff 100%);
}

.works-kicker,
.works-title,
.works-desc,
.work-title,
.empty-title,
.empty-desc {
  display: block;
}

.works-kicker {
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 800;
}

.works-title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 40rpx;
  font-weight: 900;
}

.works-desc {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.5;
}

.filter-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.filter-pill {
  flex-shrink: 0;
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: #eef2f7;
  color: #6b7280;
  font-size: 23rpx;
}

.filter-pill.active {
  background: #4f46e5;
  color: #ffffff;
  font-weight: 800;
}

.works-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.work-card {
  overflow: hidden;
}

.cover-wrap {
  position: relative;
  height: 360rpx;
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
}

.cover-image {
  width: 100%;
  height: 100%;
}

.cover-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 24rpx;
}

.type-badge {
  position: absolute;
  left: 18rpx;
  top: 18rpx;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(17, 24, 39, 0.72);
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 800;
}

.type-badge.design {
  background: rgba(79, 70, 229, 0.82);
}

.type-badge.package {
  background: rgba(14, 116, 144, 0.84);
}

.work-info {
  padding: 20rpx;
}

.work-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.design-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.design-meta-item {
  min-width: 0;
  padding: 14rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.meta-label,
.meta-value {
  display: block;
}

.meta-label {
  color: #94a3b8;
  font-size: 20rpx;
}

.meta-value {
  margin-top: 4rpx;
  color: #111827;
  font-size: 22rpx;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-value {
  font-size: 21rpx;
}

.status-draft {
  color: #64748b;
}

.status-designing {
  color: #2563eb;
}

.status-confirmed {
  color: #7c3aed;
}

.status-product_ready {
  color: #059669;
}

.package-meta {
  margin-top: 14rpx;
}

.package-summary-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  color: #475569;
  font-size: 22rpx;
  font-weight: 700;
}

.package-status {
  font-weight: 800;
}

.package-status-building {
  color: #2563eb;
}

.package-status-product_ready {
  color: #059669;
}

.package-status-delivery_preparing {
  color: #7c3aed;
}

.package-status-delivered {
  color: #0f766e;
}

.package-asset-count {
  display: block;
  margin-top: 6rpx;
  color: #94a3b8;
  font-size: 20rpx;
}

.source-chain {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4rpx;
  margin-top: 16rpx;
  padding: 14rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.chain-node {
  flex-shrink: 0;
  color: #64748b;
  font-size: 20rpx;
  font-weight: 700;
}

.chain-node.active {
  color: #4338ca;
}

.chain-arrow {
  margin-left: 22rpx;
  color: #cbd5e1;
  font-size: 20rpx;
  line-height: 0.8;
}

.package-assets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.product-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.product-status-title {
  color: #64748b;
  font-size: 21rpx;
}

.product-status-current {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  color: #475569;
  background: #f1f5f9;
  font-size: 19rpx;
  font-weight: 800;
}

.product-status-ready_for_sale,
.product-status-published {
  color: #047857;
  background: #ecfdf5;
}

.product-status-designing {
  color: #4338ca;
  background: #eef2ff;
}

.product-status-delivered {
  color: #9a3412;
  background: #fff7ed;
}

.product-status-scroll {
  width: 100%;
  margin-top: 10rpx;
  white-space: nowrap;
}

.product-status-options {
  display: inline-flex;
  gap: 8rpx;
  padding-right: 8rpx;
}

.product-status-option {
  height: 52rpx;
  padding: 0 18rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 999rpx;
  color: #64748b;
  background: #ffffff;
  font-size: 20rpx;
  line-height: 52rpx;
}

.product-status-option.active {
  border-color: #6366f1;
  color: #4338ca;
  background: #eef2ff;
}

.product-status-option::after {
  border: 0;
}

.product-operations-dashboard {
  margin-top: 14rpx;
  padding: 18rpx;
  border: 1rpx solid #e8eaf2;
  border-radius: 20rpx;
  background: #fbfcff;
}

.product-dashboard-head,
.product-completion-row,
.publish-check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.product-dashboard-kicker,
.product-dashboard-name {
  display: block;
}

.product-dashboard-kicker {
  color: #6366f1;
  font-size: 18rpx;
  font-weight: 800;
}

.product-dashboard-name {
  margin-top: 4rpx;
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
}

.product-dashboard-ready {
  flex-shrink: 0;
  color: #64748b;
  font-size: 19rpx;
}

.product-risk-level {
  flex-shrink: 0;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  font-size: 19rpx;
  font-weight: 900;
}

.product-risk-level.risk-high {
  color: #b91c1c;
  background: #fef2f2;
}

.product-risk-level.risk-medium {
  color: #b45309;
  background: #fffbeb;
}

.product-risk-level.risk-low {
  color: #047857;
  background: #ecfdf5;
}

.product-completion-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx 18rpx;
  margin-top: 18rpx;
}

.product-completion-row {
  color: #64748b;
  font-size: 19rpx;
}

.product-completion-track {
  height: 8rpx;
  margin-top: 8rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e8eaf2;
}

.product-completion-track view {
  height: 100%;
  border-radius: inherit;
  background: #6366f1;
}

.publish-check-row {
  align-items: flex-start;
  margin-top: 18rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #eef0f5;
}

.publish-check-label {
  flex-shrink: 0;
  color: #374151;
  font-size: 20rpx;
  font-weight: 800;
}

.publish-check-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
}

.publish-check-tag {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  color: #b45309;
  background: #fffbeb;
  font-size: 18rpx;
}

.publish-check-tag.passed {
  color: #047857;
  background: #ecfdf5;
}

.product-operator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.product-operator-grid view {
  min-width: 0;
  padding: 12rpx;
  border-radius: 14rpx;
  background: #f4f5f9;
}

.product-operator-grid text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-operator-grid text:first-child,
.product-channel-label,
.product-operation-editor-label {
  color: #94a3b8;
  font-size: 18rpx;
}

.product-operator-grid text:last-child {
  margin-top: 5rpx;
  color: #374151;
  font-size: 20rpx;
  font-weight: 800;
}

.product-risk-row,
.product-channel-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 14rpx;
  color: #64748b;
  font-size: 19rpx;
}

.product-risk-row text:first-child {
  flex-shrink: 0;
  color: #374151;
  font-weight: 800;
}

.product-risk-row text:last-child {
  text-align: right;
}

.product-channel-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
}

.product-channel-tag,
.product-channel-empty {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  color: #4338ca;
  background: #eef2ff;
  font-size: 18rpx;
}

.product-channel-empty {
  color: #94a3b8;
  background: #f1f5f9;
}

.channel-template-suggestions {
  margin-top: 14rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.channel-template-suggestions text {
  display: block;
  color: #64748b;
  font-size: 18rpx;
  line-height: 1.55;
}

.channel-template-suggestions .product-channel-label {
  margin-bottom: 6rpx;
  color: #374151;
  font-weight: 800;
}

.product-operation-edit-btn,
.product-operation-save-btn {
  width: 100%;
  height: 56rpx;
  margin-top: 14rpx;
  border: 0;
  border-radius: 14rpx;
  font-size: 20rpx;
  line-height: 56rpx;
}

.product-operation-edit-btn {
  color: #4338ca;
  background: #eef2ff;
}

.product-operation-save-btn {
  color: #ffffff;
  background: #4f46e5;
}

.product-operation-edit-btn::after,
.product-operation-save-btn::after {
  border: 0;
}

.product-operation-editor {
  margin-top: 12rpx;
  padding: 14rpx;
  border: 1rpx solid #e0e7ff;
  border-radius: 16rpx;
  background: #ffffff;
}

.product-operation-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8rpx;
}

.product-operation-fields input {
  min-width: 0;
  height: 58rpx;
  padding: 0 10rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  color: #111827;
  background: #ffffff;
  font-size: 19rpx;
  box-sizing: border-box;
}

.product-operation-editor-label {
  display: block;
  margin-top: 14rpx;
}

.product-operation-channel-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
}

.product-operation-channel-grid text {
  padding: 8rpx 13rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  color: #64748b;
  background: #ffffff;
  font-size: 19rpx;
}

.product-operation-channel-grid text.active {
  border-color: #6366f1;
  color: #4338ca;
  background: #eef2ff;
}

.package-asset-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  height: 64rpx;
  padding: 0 14rpx;
  border: 0;
  border-radius: 16rpx;
  background: #eef2ff;
  color: #312e81;
  font-size: 21rpx;
  line-height: 1;
}

.asset-status {
  color: #6366f1;
  font-size: 18rpx;
}

.package-empty {
  display: block;
  margin-top: 14rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 21rpx;
  line-height: 1.5;
}

.package-marketing-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.package-marketing-actions .mini-btn {
  width: 100%;
}

.marketing-btn {
  color: #ffffff;
  background: #4f46e5;
}

.package-marketing-tip {
  grid-column: 1 / -1;
  display: block;
  margin-top: 8rpx;
  color: #94a3b8;
  font-size: 19rpx;
  text-align: center;
}

.copy-product-btn {
  color: #4338ca;
  background: #eef2ff;
}

.package-marketing-panel {
  margin-top: 12rpx;
  padding: 16rpx;
  border: 1rpx solid #e0e7ff;
  border-radius: 18rpx;
  background: #f8faff;
}

.package-marketing-title {
  display: block;
  margin-bottom: 12rpx;
  color: #374151;
  font-size: 21rpx;
  font-weight: 900;
}

.package-marketing-version-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.package-marketing-version {
  height: 62rpx;
  padding: 0 8rpx;
  border: 1rpx solid #c7d2fe;
  border-radius: 14rpx;
  color: #4338ca;
  background: #ffffff;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 62rpx;
}

.package-marketing-version::after {
  border: 0;
}

.package-delivery-actions {
  margin-top: 16rpx;
}

.package-delivery-actions .mini-btn {
  width: 100%;
}

.package-delivery-tip {
  display: block;
  color: #94a3b8;
  font-size: 21rpx;
  text-align: center;
}

.delivery-project-panel {
  margin-top: 14rpx;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.delivery-project-title {
  display: block;
  margin-bottom: 10rpx;
  color: #475569;
  font-size: 21rpx;
  font-weight: 800;
}

.delivery-project-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 64rpx;
  margin-top: 8rpx;
  padding: 0 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #ffffff;
  color: #334155;
  font-size: 21rpx;
  line-height: 1;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.action-row.design-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.product-btn {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 800;
}

.production-panel {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: #f8fafc;
}

.production-group + .production-group {
  margin-top: 16rpx;
}

.production-group-title {
  display: block;
  margin-bottom: 10rpx;
  color: #6b7280;
  font-size: 21rpx;
  font-weight: 800;
}

.production-option-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.production-option {
  height: 58rpx;
  padding: 0 10rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #ffffff;
  color: #374151;
  font-size: 21rpx;
  line-height: 58rpx;
}

.mini-btn,
.primary-btn {
  border: 0;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.mini-btn {
  height: 58rpx;
  line-height: 58rpx;
  background: #eef2f7;
  color: #374151;
}

.mini-btn.primary,
.primary-btn {
  background: #4f46e5;
  color: #ffffff;
}

.mini-btn.ghost {
  background: #f8fafc;
  color: #4f46e5;
}

.empty-card {
  padding: 60rpx 32rpx;
  text-align: center;
}

.empty-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.empty-desc {
  margin: 12rpx 0 24rpx;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.5;
}
</style>
