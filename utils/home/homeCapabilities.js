const SIMPLE_WORKBENCH_ROUTE = '/package-ai/simple-ai-workbench/simple-ai-workbench'
const UPLOAD_ROUTE = '/package-ai/upload/upload'
const DETAIL_LONG_IMAGE_ROUTE = '/package-ai/detail-long-image/detail-long-image'

function freezeCapability(capability = {}) {
  return Object.freeze({
    requiresLogin: false,
    enabled: true,
    featured: false,
    tone: 'blue',
    ...capability
  })
}

export const HOME_CORE_CAPABILITIES = Object.freeze([
  freezeCapability({
    id: 'model_replace',
    name: '换模特',
    description: '保留服装主体，快速更换展示模特',
    icon: '模特',
    route: SIMPLE_WORKBENCH_ROUTE,
    query: { toolType: 'model' },
    taskType: 'model_replace',
    featured: true,
    tone: 'purple'
  }),
  freezeCapability({
    id: 'color_replace',
    name: '换颜色',
    description: '选择目标颜色，生成服装换色效果',
    icon: '配色',
    route: SIMPLE_WORKBENCH_ROUTE,
    query: { toolType: 'color' },
    taskType: 'color_replace',
    featured: true,
    tone: 'green'
  }),
  freezeCapability({
    id: 'scene_replace',
    name: '换场景',
    description: '更换商品背景和展示环境',
    icon: '场景',
    route: SIMPLE_WORKBENCH_ROUTE,
    query: { toolType: 'scene' },
    taskType: 'scene_replace',
    featured: true,
    tone: 'blue'
  }),
  freezeCapability({
    id: 'style_redesign',
    name: '微改款',
    description: '调整领口、袖型、版型和设计细节',
    icon: '改款',
    route: SIMPLE_WORKBENCH_ROUTE,
    query: { toolType: 'refine' },
    taskType: 'style_redesign',
    featured: true,
    tone: 'red'
  }),
  freezeCapability({
    id: 'garment_replace',
    name: '换衣服',
    description: '上下装可分开替换',
    icon: '换装',
    route: SIMPLE_WORKBENCH_ROUTE,
    query: { toolType: 'clothing' },
    taskType: 'clothes_replace',
    featured: true,
    tone: 'cyan'
  }),
  freezeCapability({
    id: 'pose_replace',
    name: 'AI换姿势',
    description: '只改变人物动作，保留服装和场景',
    icon: '姿势',
    route: '/package-ai/change-pose/change-pose',
    taskType: 'pose_replace',
    featured: true,
    tone: 'pink'
  })
])

export const HOME_BUSINESS_GOALS = Object.freeze([
  Object.freeze({ intent: 'product_launch', guideId: 'product-images', name: '商品上新' }),
  Object.freeze({ intent: 'new_design', guideId: 'new-design', name: '新品设计' }),
  Object.freeze({ intent: 'marketing', guideId: 'brand-marketing', name: '营销推广' })
])

export const HOME_MORE_CAPABILITIES = Object.freeze([
  freezeCapability({ id: 'fabric_replace', name: '换面料', description: '预览不同材质质感', icon: '面料', route: SIMPLE_WORKBENCH_ROUTE, query: { toolType: 'fabric' }, taskType: 'fabric_replace', tone: 'cyan' }),
  freezeCapability({ id: 'pattern_replace', name: '换图案', description: '替换印花与纹样', icon: '图案', route: SIMPLE_WORKBENCH_ROUTE, query: { toolType: 'pattern' }, taskType: 'pattern_replace', tone: 'yellow' }),
  freezeCapability({ id: 'display_image', name: '服装展示图', description: '生成平铺与展示素材', icon: '展示', route: SIMPLE_WORKBENCH_ROUTE, query: { toolType: 'flat_lay' }, taskType: 'flat_lay', tone: 'orange' }),
  freezeCapability({ id: 'detail_image', name: '服装细节图', description: '生成局部细节素材', icon: '细节', route: SIMPLE_WORKBENCH_ROUTE, query: { toolType: 'detail_photo' }, taskType: 'detail_photo', tone: 'pink' }),
  freezeCapability({ id: 'detail_long_image', name: '自动排版详情长图', description: '自动编排商品详情长图', icon: '详情', route: DETAIL_LONG_IMAGE_ROUTE, taskType: 'detail_page_long_image', tone: 'orange' }),
  freezeCapability({ id: 'pattern_structure', name: '打版结构图', description: '生成结构图、纸样部件和打版资料', icon: '打版', route: '/package-ai/pattern-structure/pattern-structure', taskType: 'pattern_structure_generate', tone: 'blue' }),
  freezeCapability({ id: 'pattern_library', name: '版型库', description: '在网页版管理、复用和派生版型', icon: '版型', websiteFeature: 'pattern_library', tone: 'slate' }),
  freezeCapability({ id: 'image_to_sketch', name: '图片转结构线稿', description: '提取服装结构参考', icon: '结构', route: UPLOAD_ROUTE, query: { entryScene: 'image_to_sketch', autoPromptPlan: '1' }, taskType: 'image_to_sketch', tone: 'slate' }),
  freezeCapability({ id: 'text_to_sketch', name: 'AI款式起稿', description: '描述生成款式方向', icon: '起稿', route: UPLOAD_ROUTE, query: { entryScene: 'text_to_sketch', autoPromptPlan: '1' }, taskType: 'text_to_sketch', tone: 'purple' }),
  freezeCapability({ id: 'sketch_remix', name: '线稿改款效果图', description: '线稿生成效果参考', icon: '线稿', route: UPLOAD_ROUTE, query: { entryScene: 'sketch_remix', autoPromptPlan: '1' }, taskType: 'sketch_remix', tone: 'blue' }),
  freezeCapability({ id: 'batch_model', name: '批量模特图', description: '一次处理多款素材', icon: '批量', route: UPLOAD_ROUTE, query: { entryScene: 'batch_model', autoPromptPlan: '1' }, taskType: 'batch_model', tone: 'green' })
])

export const PRODUCTION_ADVANCED_CAPABILITIES = Object.freeze([
  freezeCapability({ id: 'ai_production_center', name: 'AI服装生产中心', description: '按生产方案创建独立交付任务', icon: '生产', route: '/package-ai/production-guide/production-guide', taskType: 'ai_production_plan', tone: 'purple' }),
  freezeCapability({ id: 'ecommerce_main', name: '商品主图', description: '电商商品主图调试', icon: '主图', route: UPLOAD_ROUTE, query: { entryScene: 'ecommerce_main', autoPromptPlan: '1' }, taskType: 'ecommerce_main', tone: 'blue' }),
  freezeCapability({ id: 'cross_border_white', name: '跨境白底图', description: '跨境渠道白底素材调试', icon: '白底', route: UPLOAD_ROUTE, query: { entryScene: 'cross_border_white', autoPromptPlan: '1' }, taskType: 'cross_border_white', tone: 'slate' }),
  freezeCapability({ id: 'xiaohongshu_seed', name: '小红书种草图', description: '社媒场景素材调试', icon: '种草', route: UPLOAD_ROUTE, query: { entryScene: 'xiaohongshu_seed', autoPromptPlan: '1' }, taskType: 'xiaohongshu_seed', tone: 'pink' }),
  freezeCapability({ id: 'detail_image_debug', name: '服装细节图', description: '独立细节结果调试', icon: '细节', route: SIMPLE_WORKBENCH_ROUTE, query: { toolType: 'detail_photo' }, taskType: 'detail_photo', tone: 'orange' })
])

export function buildCapabilityUrl(capability = {}) {
  const route = String(capability.route || '').trim()
  if (!route) return ''
  const query = capability.query && typeof capability.query === 'object' ? capability.query : {}
  const parts = Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && String(query[key]) !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
  return parts.length ? `${route}?${parts.join('&')}` : route
}
