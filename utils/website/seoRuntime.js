const SITE_ORIGIN = 'https://www.diebiandesign.com'

const PUBLIC_SEO = [
  {
    match: (hash) => !hash || hash === '#' || hash === '#/' || hash.includes('/pages/website-demand/website-demand'),
    title: '蝶变 Diebian｜AI 服装出图与企业视觉生产服务',
    description: '蝶变为服装商家、品牌、电商团队、工厂和设计工作室提供 AI 商品图、种草图、上新图、跨境白底图与企业视觉生产方案。',
    canonicalPath: '/'
  },
  {
    match: (hash) => hash.includes('/enterprise-solution') || hash.includes('/pages/enterprise-solution/enterprise-solution'),
    title: 'AI 服装视觉生产解决方案｜蝶变 Diebian',
    description: '面向服装品牌、电商团队、服装工厂和设计工作室的 AI 服装视觉生产解决方案。',
    canonicalPath: '/#/enterprise-solution'
  },
  {
    match: (hash) => hash.includes('/case-center') || hash.includes('/pages/case-center/case-center'),
    title: 'AI 服装视觉案例中心｜蝶变 Diebian',
    description: '查看 AI 服装出图在女装、男装、童装、跨境电商、服装工厂和设计工作室中的示例应用场景。',
    canonicalPath: '/#/case-center'
  },
  {
    match: (hash) => hash.includes('/help'),
    title: '蝶变帮助中心｜AI 出图、AI 制版与企业协作指南',
    description: '蝶变帮助中心提供 AI 出图、AI 制版、版型库、项目与批量任务、审核交付和企业协作的操作指南。',
    canonicalPath: '/#/help'
  }
]

const PRIVATE_ROUTE_MARKERS = [
  '/workspace',
  '/pages/workspace/',
  '/enterprise-web',
  '/pages/enterprise-web/',
  '/developer',
  '/pages/developer/',
  '/admin',
  '/pages/admin/',
  'projectId=',
  'taskId=',
  'assetId=',
  'batchId=',
  'deliveryId='
]

function ensureMeta(selector, createAttrs = {}) {
  if (typeof document === 'undefined') return null
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    Object.keys(createAttrs).forEach((key) => node.setAttribute(key, createAttrs[key]))
    document.head.appendChild(node)
  }
  return node
}

function ensureLink(rel) {
  if (typeof document === 'undefined') return null
  let node = document.head.querySelector(`link[rel="${rel}"]`)
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    document.head.appendChild(node)
  }
  return node
}

function setMetaName(name, content) {
  const node = ensureMeta(`meta[name="${name}"]`, { name })
  if (node) node.setAttribute('content', content)
}

function setMetaProperty(property, content) {
  const node = ensureMeta(`meta[property="${property}"]`, { property })
  if (node) node.setAttribute('content', content)
}

function setCanonical(path = '/') {
  const node = ensureLink('canonical')
  if (node) node.setAttribute('href', `${SITE_ORIGIN}${path}`)
}

function isPrivateRoute(hash = '') {
  return PRIVATE_ROUTE_MARKERS.some((marker) => hash.includes(marker))
}

function resolvePublicSeo(hash = '') {
  return PUBLIC_SEO.find((item) => item.match(hash)) || PUBLIC_SEO[0]
}

export function applyH5SeoPolicy() {
  // #ifdef H5
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const hash = window.location.hash || ''
  if (isPrivateRoute(hash)) {
    document.title = '蝶变专业工作台'
    setMetaName('robots', 'noindex,nofollow,noarchive')
    setMetaName('description', '蝶变专业工作台为登录用户使用，包含项目、任务、版型、团队和企业数据。')
    setCanonical('/')
    return
  }

  const seo = resolvePublicSeo(hash)
  document.title = seo.title
  setMetaName('robots', 'index,follow')
  setMetaName('description', seo.description)
  setCanonical(seo.canonicalPath)
  setMetaProperty('og:title', seo.title)
  setMetaProperty('og:description', seo.description)
  setMetaProperty('og:type', 'website')
  setMetaProperty('og:url', `${SITE_ORIGIN}${seo.canonicalPath}`)
  setMetaProperty('og:site_name', '蝶变 Diebian')
  // #endif
}
