import { ENTERPRISE_WEB_ROUTES } from './enterpriseWebRoutes.js'
import { requirePermission } from './enterpriseWebGuard.js'

export const ENTERPRISE_WEB_MENU = Object.freeze([
  {
    key: 'dashboard',
    label: '经营首页',
    icon: '概',
    permission: 'enterprise.view',
    route: ENTERPRISE_WEB_ROUTES.dashboard
  },
  {
    key: 'projects',
    label: '项目管理',
    icon: '项',
    permission: 'project.view',
    route: ENTERPRISE_WEB_ROUTES.projects
  },
  {
    key: 'products',
    label: '商品资料包',
    icon: '品',
    permission: 'product.view',
    route: ENTERPRISE_WEB_ROUTES.products
  },
  {
    key: 'quotes',
    label: '报价管理',
    icon: '报',
    permission: 'quote.view',
    route: ENTERPRISE_WEB_ROUTES.quotes
  },
  {
    key: 'orders',
    label: '订单管理',
    icon: '订',
    permission: 'order.view',
    route: ENTERPRISE_WEB_ROUTES.orders
  },
  {
    key: 'deliveries',
    label: '交付中心',
    icon: '交',
    permission: 'delivery.view',
    route: ENTERPRISE_WEB_ROUTES.deliveries
  },
  {
    key: 'members',
    label: '成员管理',
    icon: '员',
    permission: 'member.manage',
    route: ENTERPRISE_WEB_ROUTES.members
  },
  {
    key: 'roles',
    label: '角色权限',
    icon: '权',
    permission: 'member.manage',
    route: ENTERPRISE_WEB_ROUTES.roles
  },
  {
    key: 'patternCenter',
    label: '\u7248\u578b\u4e0e AI \u8bad\u7ec3',
    icon: '\u7248',
    permission: 'pattern_library.view',
    route: ENTERPRISE_WEB_ROUTES.patternCenter
  },
  {
    key: 'audit',
    label: '审计中心',
    icon: '审',
    permission: 'audit.view',
    route: ENTERPRISE_WEB_ROUTES.audit
  },
  {
    key: 'analytics',
    label: '数据中心',
    icon: '数',
    permission: 'analytics.view',
    route: ENTERPRISE_WEB_ROUTES.analytics
  }
])

export function getEnterpriseWebMenu() {
  return ENTERPRISE_WEB_MENU
    .filter((item) => !item.permission || requirePermission(item.permission).allowed)
    .map((item) => ({ ...item }))
}
