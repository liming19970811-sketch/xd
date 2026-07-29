export const ENTERPRISE_WEB_ROUTES = Object.freeze({
  login: '/pages/enterprise-web/login',
  miniappLogin: '/pages/enterprise-web/miniapp-login',
  accountLogin: '/pages/enterprise-web/account-login',
  authCallback: '/pages/enterprise-web/auth-callback',
  register: '/pages/enterprise-web/register',
  selectEnterprise: '/pages/enterprise-web/select-enterprise',
  layout: '/pages/enterprise-web/layout',
  dashboard: '/pages/enterprise-web/dashboard',
  projects: '/pages/enterprise-web/projects',
  projectDetail: '/pages/enterprise-web/project-detail',
  products: '/pages/enterprise-web/products',
  quotes: '/pages/enterprise-web/quotes',
  quoteDetail: '/pages/enterprise-web/quote-detail',
  orders: '/pages/enterprise-web/orders',
  orderDetail: '/pages/enterprise-web/order-detail',
  deliveries: '/pages/enterprise-web/deliveries',
  deliveryDetail: '/pages/enterprise-web/delivery-detail',
  factories: '/pages/enterprise-web/factories',
  factoryDetail: '/pages/enterprise-web/factory-detail',
  members: '/pages/enterprise-web/members',
  roles: '/pages/enterprise-web/roles',
  audit: '/pages/enterprise-web/audit',
  analytics: '/pages/enterprise-web/analytics',
  patternCenter: '/pages/enterprise-web/pattern-center'
})

export function getEnterpriseWebRoute(name = 'dashboard') {
  return ENTERPRISE_WEB_ROUTES[name] || ENTERPRISE_WEB_ROUTES.dashboard
}

export function hasEnterpriseWebRoute(name = '') {
  return Boolean(ENTERPRISE_WEB_ROUTES[name])
}

export function buildEnterpriseWebUrl(name = 'dashboard', query = {}) {
  const route = getEnterpriseWebRoute(name)
  const queryString = Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')
  return queryString ? `${route}?${queryString}` : route
}

export function navigateEnterpriseWeb(name = 'dashboard', query = {}) {
  const url = buildEnterpriseWebUrl(name, query)
  if (typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({ url })
  }
  return url
}
