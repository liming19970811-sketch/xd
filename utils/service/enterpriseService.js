import { getList as getEnterpriseList, update as updateEnterprise } from '../repository/enterpriseRepository.js'
import { getList as getCustomerList } from '../repository/customerRepository.js'
import { getList as getProjectList } from '../repository/projectRepository.js'
import { getList as getProductPackageList } from '../repository/productPackageRepository.js'
import { getList as getQuoteList } from '../repository/quoteRepository.js'
import { getList as getOrderList } from '../repository/orderRepository.js'
import { getList as getDeliveryList } from '../repository/deliveryRepository.js'

export const ENTERPRISE_ROLE_PERMISSIONS = Object.freeze({
  '管理员': ['business', 'customer', 'project', 'design', 'product', 'production', 'asset', 'marketing', 'delivery', 'follow'],
  '老板': ['business', 'customer', 'project', 'design', 'product', 'production', 'asset', 'marketing', 'delivery', 'follow'],
  '项目经理': ['customer', 'project', 'product', 'production', 'asset', 'delivery', 'follow'],
  '设计师': ['design', 'product', 'production'],
  '运营': ['asset', 'marketing', 'production'],
  '销售': ['customer', 'follow']
})

export function getEnterprise() {
  return getEnterpriseList()[0] || null
}

export function getMembers() {
  const enterprise = getEnterprise()
  return enterprise && Array.isArray(enterprise.members) ? enterprise.members : []
}

export function getCurrentMember() {
  const enterprise = getEnterprise()
  const members = getMembers()
  return members.find((item) => item.memberId === enterprise?.currentMemberId) || members[0] || null
}

export function getRolePermissions(role = '') {
  return [...(ENTERPRISE_ROLE_PERMISSIONS[role] || [])]
}

export function canAccess(permission = '', member = getCurrentMember()) {
  return Boolean(permission && member && getRolePermissions(member.role).includes(permission))
}

export function saveEnterprise(patch = {}) {
  const enterprise = getEnterprise()
  if (!enterprise) return null
  return updateEnterprise(enterprise.enterpriseId, {
    ...patch,
    updatedBy: patch.updatedBy || patch.currentMemberId || enterprise.currentMemberId
  })
}

export function getEnterpriseStatistics(input = {}) {
  const customers = input.customers || getCustomerList()
  const projects = input.projects || getProjectList()
  const products = input.products || getProductPackageList()
  const quotes = input.quotes || getQuoteList()
  const orders = input.orders || getOrderList()
  const deliveries = input.deliveries || getDeliveryList()
  return {
    memberCount: getMembers().length,
    customerCount: customers.length,
    projectCount: projects.length,
    productCount: products.length,
    quoteCount: quotes.length,
    orderCount: orders.length,
    deliveryCount: deliveries.length
  }
}
