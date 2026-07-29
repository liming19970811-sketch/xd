import App from './App'
// #ifdef MP-WEIXIN
import { initCloudBase } from './utils/cloudbase/init'
import { refreshFeatureRuntimeBackendState } from './utils/runtime/featureRuntimePolicy'
// #endif
// #ifdef H5
import { applyH5SeoPolicy } from './utils/website/seoRuntime'
import { installWebsiteRuntimeMonitor, recordWebsiteRuntimeEvent } from './utils/website/runtimeMonitor'
// #endif

// #ifdef H5
const H5_WEBSITE_DEMAND_ROUTE = '/pages/website-demand/website-demand'
if (typeof window !== 'undefined') {
  installWebsiteRuntimeMonitor()
  const hash = window.location.hash || ''
  const pathname = window.location.pathname || '/'
  const isRootPath = pathname === '/' || pathname.endsWith('/index.html')
  const isRootHash = !hash || hash === '#' || hash === '#/'
  const replaceHash = (targetHash) => {
    recordWebsiteRuntimeEvent('route_redirect', {
      message: `${hash || '#/'} -> #${targetHash}`,
      status: 'success'
    })
    window.location.replace(`${pathname}${window.location.search || ''}#${targetHash}`)
  }
  applyH5SeoPolicy()
  window.addEventListener('hashchange', applyH5SeoPolicy)

  if (hash === '#/workspace' || hash.startsWith('#/workspace?')) {
    const workspaceHash = H5_WEBSITE_DEMAND_ROUTE.replace('website-demand/website-demand', 'workspace/workspace')
    const workspaceQuery = hash.replace('#/workspace', '')
    replaceHash(`${workspaceHash}${workspaceQuery}`)
  }

  if (hash === '#/privacy' || hash.startsWith('#/privacy?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/privacy/privacy${queryPrefix}`)
  }

  if (hash === '#/terms' || hash.startsWith('#/terms?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/terms/terms${queryPrefix}`)
  }

  if (hash === '#/help' || hash.startsWith('#/help?') || hash.startsWith('#/help/')) {
    const workspaceHash = H5_WEBSITE_DEMAND_ROUTE.replace('website-demand/website-demand', 'workspace/workspace')
    const routeText = hash.replace(/^#\/help\/?/, '')
    const [categoryPath, queryText = ''] = routeText.split('?')
    const categoryQuery = categoryPath ? `&helpCategory=${encodeURIComponent(categoryPath)}` : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`${workspaceHash}?module=help${categoryQuery}${queryPrefix}`)
  }

  if (hash.startsWith('#/workspace/')) {
    const workspaceHash = H5_WEBSITE_DEMAND_ROUTE.replace('website-demand/website-demand', 'workspace/workspace')
    const routeText = hash.replace(/^#\/workspace\/?/, '')
    const [modulePath, queryText = ''] = routeText.split('?')
    const pathParts = modulePath.split('/').filter(Boolean)
    const moduleMap = {
      'data-consent': 'data-consent',
      'ai-output': 'ai-output',
      'pattern-making': 'pattern-making',
      'ai-training': 'ai-training',
      'model-operations': 'model-operations',
      'pattern-library': 'library',
      projects: 'projects',
      assets: 'assets',
      asset: 'assets',
      batches: 'batch',
      batch: 'batch',
      deliveries: 'delivery',
      delivery: 'delivery',
      support: 'support',
      analytics: 'analytics',
      feedback: 'feedback',
      experiments: 'experiments',
      todos: 'todos',
      team: 'team',
      membership: 'membership',
      usage: 'usage',
      orders: 'orders',
      settings: 'settings',
      help: 'help'
    }
    const moduleName = moduleMap[pathParts[0] || modulePath] || 'overview'
    if (moduleName === 'data-consent') {
      const queryPrefix = queryText ? `?${queryText}` : ''
      replaceHash(`/pages/workspace-data-consent/workspace-data-consent${queryPrefix}`)
    } else if (['membership', 'usage', 'orders'].includes(moduleName)) {
      const queryPrefix = queryText ? `&${queryText}` : ''
      replaceHash(`/pages/membership-center/membership-center?tab=${encodeURIComponent(moduleName)}${queryPrefix}`)
    } else {
      const projectQuery = moduleName === 'projects' && pathParts[1] ? `&projectId=${encodeURIComponent(pathParts[1])}` : ''
      const assetQuery = moduleName === 'assets' && pathParts[1] ? `&assetId=${encodeURIComponent(pathParts[1])}` : ''
      const trainingTabQuery = moduleName === 'ai-training' && pathParts[1] ? `&trainingTab=${encodeURIComponent(pathParts[1])}` : ''
      const modelOpsTabQuery = moduleName === 'model-operations' && pathParts[1] ? `&modelOpsTab=${encodeURIComponent(pathParts[1])}` : ''
      const batchQuery = moduleName === 'batch' && pathParts[1] ? `&batchId=${encodeURIComponent(pathParts[1])}` : ''
      const supportTicketQuery = moduleName === 'support' && pathParts[0] === 'support' && pathParts[1] === 'tickets' && pathParts[2] ? `&ticketId=${encodeURIComponent(pathParts[2])}` : ''
      const teamTabQuery = moduleName === 'team' && pathParts[1] ? `&teamTab=${encodeURIComponent(pathParts[1])}` : ''
      const settingsTabQuery = moduleName === 'settings' && pathParts[1] ? `&settingsTab=${encodeURIComponent(pathParts[1])}` : ''
      const helpCategoryQuery = moduleName === 'help' && pathParts[1] ? `&helpCategory=${encodeURIComponent(pathParts[1])}` : ''
      const queryPrefix = queryText ? `&${queryText}` : ''
      replaceHash(`${workspaceHash}?module=${encodeURIComponent(moduleName)}${projectQuery}${assetQuery}${trainingTabQuery}${modelOpsTabQuery}${batchQuery}${supportTicketQuery}${teamTabQuery}${settingsTabQuery}${helpCategoryQuery}${queryPrefix}`)
    }
  }

  if (hash === '#/admin' || hash.startsWith('#/admin?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin/admin?mode=platform${queryPrefix}`)
  }

  if (hash === '#/admin/plans' || hash.startsWith('#/admin/plans?')) {
    replaceHash('/pages/admin-plans/admin-plans')
  }

  if (hash === '#/admin/providers' || hash.startsWith('#/admin/providers?') || hash.startsWith('#/admin/providers/')) {
    const routeText = hash.replace(/^#\/admin\/providers\/?/, '')
    const [routePath, queryText = ''] = routeText.split('?')
    const providerTabMap = {
      '': 'providers',
      models: 'models',
      routing: 'routing',
      costs: 'costs'
    }
    const tab = providerTabMap[routePath] || 'providers'
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-providers/admin-providers?tab=${tab}${queryPrefix}`)
  }

  if (hash === '#/admin/data-health' || hash.startsWith('#/admin/data-health?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-data-health/admin-data-health?tab=health${queryPrefix}`)
  }

  if (hash === '#/admin/backups' || hash.startsWith('#/admin/backups?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-data-health/admin-data-health?tab=backups${queryPrefix}`)
  }

  if (hash === '#/admin/recovery' || hash.startsWith('#/admin/recovery?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-data-health/admin-data-health?tab=recovery${queryPrefix}`)
  }

  if (hash === '#/admin/schema-governance' || hash.startsWith('#/admin/schema-governance?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/admin-schema-governance/admin-schema-governance${queryPrefix}`)
  }

  if (hash === '#/admin/errors' || hash.startsWith('#/admin/errors?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/admin-errors/admin-errors${queryPrefix}`)
  }

  if (hash === '#/admin/releases' || hash.startsWith('#/admin/releases?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-release-control/admin-release-control?tab=releases${queryPrefix}`)
  }

  if (hash === '#/admin/feature-flags' || hash.startsWith('#/admin/feature-flags?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-release-control/admin-release-control?tab=flags${queryPrefix}`)
  }

  if (hash === '#/admin/environments' || hash.startsWith('#/admin/environments?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/admin-release-control/admin-release-control?tab=environments${queryPrefix}`)
  }

  if (hash === '#/admin/compliance' || hash.startsWith('#/admin/compliance?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/admin-compliance/admin-compliance${queryPrefix}`)
  }

  if (hash === '#/admin/files' || hash.startsWith('#/admin/files?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const queryPrefix = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/file-governance/file-governance${queryPrefix}`)
  }

  if (hash === '#/developer' || hash.startsWith('#/developer/')) {
    const routeText = hash.replace(/^#\/developer\/?/, '')
    const [routePath] = routeText.split('?')
    const developerMap = {
      '': 'developer',
      apps: 'apps',
      'api-keys': 'api-keys',
      usage: 'usage',
      logs: 'logs',
      docs: 'docs'
    }
    const developerPage = developerMap[routePath] || 'developer'
    replaceHash(`/pages/developer/${developerPage}`)
  }

  if (hash === '#/cases' || hash.startsWith('#/cases/')) {
    const routeText = hash.replace(/^#\/cases\/?/, '')
    const [caseId] = routeText.split('?')
    const caseQuery = caseId ? `?caseId=${encodeURIComponent(caseId)}` : ''
    replaceHash(`/pages/case-center/case-center${caseQuery}`)
  }

  if (hash === '#/knowledge' || hash.startsWith('#/knowledge/')) {
    const routeText = hash.replace(/^#\/knowledge\/?/, '')
    const [articleId] = routeText.split('?')
    const articleQuery = articleId ? `?articleId=${encodeURIComponent(articleId)}` : ''
    replaceHash(`/pages/knowledge-center/knowledge-center${articleQuery}`)
  }

  if (hash === '#/solutions' || hash.startsWith('#/solutions?')) {
    replaceHash('/pages/enterprise-solution/enterprise-solution')
  }

  if (hash === '#/enterprise/request' || hash.startsWith('#/enterprise/request?')) {
    const queryText = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    const requestQuery = queryText ? `?${queryText}` : ''
    replaceHash(`/pages/enterprise-request/enterprise-request${requestQuery}`)
  }

  if (hash === '#/enterprise' || hash.startsWith('#/enterprise?')) {
    replaceHash('/pages/enterprise-request/enterprise-request?sourceType=enterprise')
  }

  if (hash === '#/client' || hash.startsWith('#/client/')) {
    const routeText = hash.replace(/^#\/client\/?/, '')
    const [routePath, queryText = ''] = routeText.split('?')
    const pathParts = routePath.split('/').filter(Boolean)
    const clientTabMap = {
      requests: 'requests',
      projects: 'projects',
      deliveries: 'deliveries'
    }
    const tab = clientTabMap[pathParts[0] || ''] || 'overview'
    const queryPrefix = queryText ? `&${queryText}` : ''
    replaceHash(`/pages/client-portal/client-portal?tab=${tab}${queryPrefix}`)
  }

  if (isRootPath && isRootHash) {
    replaceHash(H5_WEBSITE_DEMAND_ROUTE)
  }
}
// #endif

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
// #ifdef MP-WEIXIN
initCloudBase()
refreshFeatureRuntimeBackendState()
// #endif
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  // #ifdef MP-WEIXIN
  initCloudBase()
  refreshFeatureRuntimeBackendState()
  // #endif
  const app = createSSRApp(App)
  return {
    app
  }
}
// #endif
