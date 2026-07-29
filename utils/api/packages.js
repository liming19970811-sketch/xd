import { request } from './request'
import { API_CONFIG } from './config'
import { ORDER_STATUS, ORDER_TYPE, PACKAGE_TYPE, PAY_CHANNEL, PAY_STATUS } from '../constants'

const MOCK_PACKAGES = [
  {
    packageId: 'pkg_times_card_001',
    type: PACKAGE_TYPE.BASIC,
    category: '次卡',
    name: '20次生成次卡',
    price: '99',
    benefits: ['20次AI生成额度', '适合短期上新', '支持结果页继续迭代'],
    validity: '自购买起30天',
    quota: 20
  },
  {
    packageId: 'pkg_month_card_001',
    type: PACKAGE_TYPE.PROFESSIONAL,
    category: '月卡',
    name: '月度会员卡',
    price: '299',
    benefits: ['30天内高频使用', '适合日常运营团队', '预留后续支付升级结构'],
    validity: '30天',
    quota: 9999
  },
  {
    packageId: 'pkg_enterprise_001',
    type: PACKAGE_TYPE.ENTERPRISE,
    category: '企业包',
    name: '企业协作包',
    price: '999',
    benefits: ['批量生成与协同支持', '适合团队项目制交付', '预留企业级服务扩展'],
    validity: '90天',
    quota: 500
  }
]

function getPackageListUrl() {
  if (API_CONFIG.packages && API_CONFIG.packages.url) {
    return API_CONFIG.packages.url
  }
  return '/api/packages'
}

function getPackageOrderUrl() {
  if (API_CONFIG.packageOrder && API_CONFIG.packageOrder.url) {
    return API_CONFIG.packageOrder.url
  }
  return '/api/orders/package'
}

function parseResponseData(response) {
  const data = response && Object.prototype.hasOwnProperty.call(response, 'data') ? response.data : response
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (error) {
      return {
        data
      }
    }
  }
  return data || {}
}

function normalizePackage(item = {}) {
  return {
    packageId: item.packageId || item.id || '',
    type: item.type || PACKAGE_TYPE.BASIC,
    category: item.category || item.packageCategory || '套餐',
    name: item.name || item.packageName || 'Package',
    price: String(item.price || item.amount || '0'),
    benefits: Array.isArray(item.benefits) ? item.benefits : [],
    validity: item.validity || item.validityText || '30天',
    quota: Number(item.quota || item.remainingQuota || 0)
  }
}

export async function fetchPackages() {
  try {
    const response = await request({
      url: getPackageListUrl(),
      method: 'GET'
    })
    const parsed = parseResponseData(response)
    const success = typeof parsed.success === 'boolean' ? parsed.success : true
    const code = typeof parsed.code === 'number' ? parsed.code : 0
    const list = Array.isArray(parsed.data) ? parsed.data : Array.isArray(parsed.list) ? parsed.list : []

    if (!success || code !== 0 || !list.length) {
      throw new Error(parsed.message || 'Package API unavailable')
    }

    return {
      mode: 'api',
      list: list.map(normalizePackage)
    }
  } catch (error) {
    return {
      mode: 'mock',
      list: MOCK_PACKAGES.map(normalizePackage),
      error
    }
  }
}

export async function createPackagePurchaseOrder(payload = {}) {
  const orderPayload = {
    packageId: payload.packageId || '',
    packageType: payload.packageType || '',
    orderType: ORDER_TYPE.PACKAGE_PURCHASE,
    payChannel: payload.payChannel || PAY_CHANNEL.WECHAT
  }

  const response = await request({
    url: getPackageOrderUrl(),
    method: 'POST',
    data: orderPayload,
    header: {
      'content-type': 'application/json'
    }
  })
  const parsed = parseResponseData(response)
  const success = typeof parsed.success === 'boolean' ? parsed.success : true
  const code = typeof parsed.code === 'number' ? parsed.code : 0
  if (!success || code !== 0) {
    throw new Error(parsed.message || '创建套餐订单失败')
  }

  return {
    mode: 'api',
    order: {
      orderId: (parsed.data && (parsed.data.orderId || parsed.data.id)) || '',
      status: (parsed.data && parsed.data.status) || ORDER_STATUS.CREATED,
      payStatus: (parsed.data && parsed.data.payStatus) || PAY_STATUS.UNPAID
    }
  }
}
