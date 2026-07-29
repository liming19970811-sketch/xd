const DEMO_ENTERPRISE_STORAGE_KEY = 'diebiandesign_demo_enterprise_seed'

function createId(prefix = 'demo') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function getNow() {
  return new Date().toISOString()
}

function safeSetDemoData(data = null) {
  if (typeof uni === 'undefined' || !uni || typeof uni.setStorageSync !== 'function') {
    return
  }
  try {
    uni.setStorageSync(DEMO_ENTERPRISE_STORAGE_KEY, data)
  } catch (error) {
    // Demo seed should never block the real app when local storage is unavailable.
  }
}

function safeClearDemoData() {
  if (typeof uni === 'undefined' || !uni) {
    return
  }
  try {
    if (typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(DEMO_ENTERPRISE_STORAGE_KEY)
      return
    }
    if (typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(DEMO_ENTERPRISE_STORAGE_KEY, null)
    }
  } catch (error) {
    // Clearing demo data should be best effort only.
  }
}

function buildDemoEnterprise() {
  const createdAt = getNow()
  const demoId = createId('demo_enterprise')
  const leadId = createId('lead_demo')
  const followId = createId('follow_demo')
  const pipelineId = createId('pipeline_demo')
  const forecastId = createId('forecast_demo')
  const brandId = createId('brand_demo')
  const projectId = createId('project_demo')
  const workspaceContextId = createId('workspace_demo')
  const taskId = createId('task_demo')
  const assetId = createId('asset_demo')
  const deliveryId = createId('delivery_demo')

  const customer = {
    customerId: createId('customer_demo'),
    companyName: '蝶变演示服饰有限公司',
    contactName: '演示客户',
    contactPhone: '13800000000',
    category: '女装品牌',
    source: 'enterprise_demo',
    createdAt
  }

  const lead = {
    leadId,
    customerId: customer.customerId,
    companyName: customer.companyName,
    contactName: customer.contactName,
    contactPhone: customer.contactPhone,
    demandType: 'batch_ecommerce_visual',
    leadSource: 'enterprise_demo',
    sourceType: 'demo',
    sourceId: demoId,
    interestType: 'AI视觉基础版',
    interestSnapshot: {
      title: '企业客户 AI 服装出图演示',
      abilities: ['换模特', '换颜色', '换场景', '批量上新图'],
      platforms: ['电商主图', '小红书种草图', '跨境白底图']
    },
    createdAt
  }

  const salesFollow = {
    followId,
    leadId,
    projectId,
    actionType: '需求确认',
    content: '已确认客户需要一批女装上新图、种草图和白底图。',
    operator: 'Demo Sales',
    nextFollowAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt
  }

  const salesPipeline = {
    pipelineId,
    leadId,
    projectId,
    stage: 'requirement_confirmed',
    probability: 40,
    amount: 30000,
    updatedAt: createdAt
  }

  const salesForecast = {
    forecastId,
    leadId,
    projectId,
    stage: salesPipeline.stage,
    probability: salesPipeline.probability,
    expectedAmount: 12000,
    expectedDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: 'low',
    updatedAt: createdAt
  }

  const brand = {
    brandId,
    customerId: customer.customerId,
    name: 'Diebian Demo Brand',
    colors: ['#111827', '#f8fafc', '#7c3aed'],
    models: ['clean_fashion_model', 'urban_female_model'],
    scenes: ['studio_light', 'street_style', 'white_background'],
    templates: ['ecommerce_main_image', 'social_seed_image'],
    createdAt
  }

  const project = {
    projectId,
    leadId,
    brandId,
    customerId: customer.customerId,
    projectName: '企业客户服装上新视觉演示项目',
    status: 'processing',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt,
    updatedAt: createdAt
  }

  const brandAssets = [
    {
      assetId: createId('brand_asset_demo'),
      brandId,
      type: 'brand_color',
      name: '品牌主色',
      value: '#7c3aed',
      createdAt
    },
    {
      assetId: createId('brand_asset_demo'),
      brandId,
      type: 'brand_scene',
      name: '干净棚拍场景',
      value: 'studio_light',
      createdAt
    }
  ]

  const workspaceContext = {
    workspaceContextId,
    projectId,
    brandId,
    type: 'ecommerce',
    params: {
      ratio: '1:1',
      style: 'clean_commercial',
      scene: 'white_background',
      quantity: 6
    },
    createdAt
  }

  const production = {
    taskId,
    projectId,
    brandId,
    workspaceContextId,
    type: 'ecommerce',
    input: {
      imageUrl: 'demo://local-reference-image',
      prompt: '生成女装电商主图，干净棚拍光线，保留衣服版型和面料质感。',
      params: workspaceContext.params
    },
    status: 'success',
    provider: 'demo_mock',
    resultImageUrl: 'demo://generated-fashion-image',
    result: {
      image: 'demo://generated-fashion-image',
      items: ['demo://generated-fashion-image']
    },
    createdAt,
    updatedAt: createdAt
  }

  const assets = [
    ...brandAssets,
    {
      assetId,
      projectId,
      brandId,
      taskId,
      type: 'generated_image',
      title: '女装电商主图演示资产',
      imageUrl: production.resultImageUrl,
      usage: ['商品主图', '批量上新图'],
      createdAt
    }
  ]

  const delivery = {
    deliveryId,
    projectId,
    assetId,
    status: 'pending_review',
    title: '企业客户首批 AI 出图交付',
    createdAt,
    updatedAt: createdAt
  }

  const businessStats = {
    dashboard: {
      period: '7d',
      leadCount: 1,
      pipelineAmount: salesPipeline.amount,
      forecastAmount: salesForecast.expectedAmount,
      projectCount: 1,
      deliveryCount: 1,
      apiUsage: {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        successRate: 0
      }
    },
    report: {
      period: '7d',
      summary: '演示客户已完成线索、销售、项目、生产和交付闭环。',
      riskSummary: {
        total: 0,
        resolved: 0
      }
    },
    insight: {
      type: 'growth',
      title: '演示客户可继续推进企业方案转化'
    },
    advisor: {
      adviceType: 'sales_action',
      title: '跟进演示客户下一步需求确认'
    }
  }

  return {
    demoId,
    customer,
    brand,
    project,
    lead,
    sales: {
      follow: salesFollow,
      pipeline: salesPipeline,
      forecast: salesForecast
    },
    assets,
    workspaceContext,
    production,
    delivery,
    businessStats,
    createdAt
  }
}

export function createDemoEnterprise(options = {}) {
  const demo = buildDemoEnterprise()
  if (options.persist !== false) {
    safeSetDemoData(demo)
  }
  console.log('[demo:enterprise]', {
    demoId: demo.demoId
  })
  return demo
}

export function clearDemoEnterprise() {
  safeClearDemoData()
  return {
    cleared: true,
    storageKey: DEMO_ENTERPRISE_STORAGE_KEY
  }
}

export { DEMO_ENTERPRISE_STORAGE_KEY }
