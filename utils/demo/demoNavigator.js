import {
  getDemoEnterpriseData,
  getDemoMode
} from './demoMode'

export const DEMO_NAVIGATOR_SCENES = [
  { scene: 'enterprise_overview', label: '企业总览', target: 'admin' },
  { scene: 'brand_space', label: '品牌空间', target: 'workspace' },
  { scene: 'project_space', label: '项目空间', target: 'workspace' },
  { scene: 'workspace', label: 'AI 工作台', target: 'workspace' },
  { scene: 'production', label: '生产记录', target: 'workspace' },
  { scene: 'delivery', label: '交付中心', target: 'admin' },
  { scene: 'business', label: '经营驾驶舱', target: 'admin' }
]

function getSceneConfig(scene = '') {
  return DEMO_NAVIGATOR_SCENES.find((item) => item.scene === scene) || DEMO_NAVIGATOR_SCENES[0]
}

function getAssetCount(demo = {}) {
  return Array.isArray(demo.assets) ? demo.assets.length : 0
}

function getProductionCount(demo = {}) {
  if (!demo.production) return 0
  if (Array.isArray(demo.production)) return demo.production.length
  return demo.production.taskId ? 1 : 0
}

function getDeliveryStatus(demo = {}) {
  return demo.delivery && demo.delivery.status ? demo.delivery.status : 'pending'
}

function buildScene(sceneConfig = {}, demo = {}) {
  return {
    scene: sceneConfig.scene,
    label: sceneConfig.label,
    target: sceneConfig.target,
    demoId: demo.demoId || '',
    brandId: demo.brand && demo.brand.brandId ? demo.brand.brandId : '',
    projectId: demo.project && demo.project.projectId ? demo.project.projectId : '',
    enabled: Boolean(demo.demoId)
  }
}

export function buildDemoNavigator(input = {}) {
  const mode = input.mode || getDemoMode()
  const demo = input.demo || getDemoEnterpriseData() || {}
  const demoId = input.demoId || demo.demoId || mode.demoId || ''
  const currentScene = getSceneConfig(input.currentScene || 'enterprise_overview').scene
  const navigator = {
    demoId,
    currentScene,
    scenes: DEMO_NAVIGATOR_SCENES.map((scene) => buildScene(scene, {
      ...demo,
      demoId
    })),
    createdAt: input.createdAt || mode.createdAt || demo.createdAt || new Date().toISOString()
  }
  console.log('[demo:navigator]', {
    demoId: navigator.demoId
  })
  return navigator
}

export function buildDemoNavigatorSummary(demo = getDemoEnterpriseData() || {}) {
  return {
    companyName: demo.customer && demo.customer.companyName ? demo.customer.companyName : 'Demo 企业客户',
    brandName: demo.brand && (demo.brand.name || demo.brand.brandName) ? (demo.brand.name || demo.brand.brandName) : 'Demo Brand',
    projectName: demo.project && demo.project.projectName ? demo.project.projectName : 'Demo 企业项目',
    assetCount: getAssetCount(demo),
    productionCount: getProductionCount(demo),
    deliveryStatus: getDeliveryStatus(demo)
  }
}

export function getDemoNavigatorScene(scene = '') {
  return getSceneConfig(scene)
}
