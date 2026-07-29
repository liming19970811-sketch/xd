function getNow() {
  return new Date().toISOString()
}

function getProjectName(project = {}, demo = {}) {
  return project.title || project.projectName || (demo.project && demo.project.projectName) || '企业 Demo 项目'
}

function getBrandName(demo = {}, project = {}) {
  return (demo.brand && (demo.brand.name || demo.brand.brandName)) || project.brandId || 'Demo Brand'
}

function getCustomerName(demo = {}, project = {}) {
  return (demo.customer && (demo.customer.companyName || demo.customer.customerName)) || project.customerId || 'Demo Customer'
}

function getLatestTime(values = []) {
  return values
    .filter(Boolean)
    .map((value) => String(value))
    .sort((a, b) => b.localeCompare(a))[0] || getNow()
}

function normalizeDeliveryStatus(delivery = {}, deliveries = []) {
  const latest = deliveries[0] || delivery || {}
  return latest.status || 'pending'
}

export const DEMO_PROJECT_OVERVIEW_ACTIONS = [
  {
    actionId: 'ai_workspace',
    label: '进入 AI 工作台'
  },
  {
    actionId: 'project_assets',
    label: '查看项目资产'
  },
  {
    actionId: 'delivery_center',
    label: '查看交付中心'
  },
  {
    actionId: 'business_analysis',
    label: '查看经营分析'
  }
]

export function buildDemoProjectOverview({
  demo = {},
  project = {},
  dashboard = {},
  assets = [],
  deliveries = []
} = {}) {
  const safeAssets = Array.isArray(assets) ? assets : []
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : []
  const demoAssets = Array.isArray(demo.assets) ? demo.assets : []
  const production = demo.production || {}
  const delivery = demo.delivery || {}
  const updatedAt = getLatestTime([
    dashboard.updatedAt,
    project.updatedAt,
    production.updatedAt,
    delivery.updatedAt,
    ...safeAssets.map((asset) => asset.createdAt),
    ...safeDeliveries.map((item) => item.createdAt || item.completedAt)
  ])

  return {
    overviewId: `demo_overview_${demo.demoId || project.projectId || 'project'}`,
    demoId: demo.demoId || '',
    customer: {
      customerId: (demo.customer && demo.customer.customerId) || project.customerId || '',
      name: getCustomerName(demo, project)
    },
    brand: {
      brandId: (demo.brand && demo.brand.brandId) || project.brandId || '',
      name: getBrandName(demo, project)
    },
    project: {
      projectId: (demo.project && demo.project.projectId) || project.projectId || '',
      name: getProjectName(project, demo)
    },
    productionSummary: {
      total: Number(dashboard.totalContexts || 0) || (production.taskId ? 1 : 0),
      completed: Number(dashboard.completedCount || 0) || (production.status === 'success' ? 1 : 0),
      generating: Number(dashboard.generatingCount || 0),
      failed: Number(dashboard.failedCount || 0)
    },
    assetSummary: {
      total: Number(dashboard.totalAssets || 0) || safeAssets.length || demoAssets.length
    },
    deliverySummary: {
      total: safeDeliveries.length || (delivery.deliveryId ? 1 : 0),
      status: normalizeDeliveryStatus(delivery, safeDeliveries)
    },
    actions: DEMO_PROJECT_OVERVIEW_ACTIONS,
    updatedAt
  }
}
