import { API_CONFIG } from './api/config'

function normalizeOrderPayload(input, legacyType) {
  if (input && typeof input === 'object') {
    return {
      packageId: input.packageId || input.package_id || '',
      packageType: input.packageType || input.package_type || '',
      quantity: input.quantity || undefined,
      source: input.source || undefined
    }
  }

  console.warn('[pay] createOrder legacy signature is deprecated; client price is ignored')
  return {
    packageId: '',
    packageType: legacyType || '',
    quantity: undefined,
    source: undefined
  }
}

function compactPayload(payload = {}) {
  return Object.keys(payload).reduce((nextPayload, key) => {
    if (payload[key] !== undefined && payload[key] !== '') {
      nextPayload[key] = payload[key]
    }
    return nextPayload
  }, {})
}

function normalizeOrderResponse(response) {
  const data = response && Object.prototype.hasOwnProperty.call(response, 'data')
    ? response.data
    : response
  const parsed = typeof data === 'string' ? JSON.parse(data) : (data || {})
  const success = typeof parsed.success === 'boolean' ? parsed.success : true
  const code = typeof parsed.code === 'number' ? parsed.code : 0

  if (!success || code !== 0) {
    throw new Error(parsed.message || parsed.errorMessage || '下单失败')
  }

  return parsed.data || parsed
}

export function createOrder(input, legacyType) {
  const orderPayload = compactPayload(normalizeOrderPayload(input, legacyType))

  return new Promise((resolve, reject) => {
    if (!orderPayload.packageId && !orderPayload.packageType) {
      reject(new Error('缺少套餐信息'))
      return
    }

    uni.request({
      url: API_CONFIG.packageOrder.url,
      method: 'POST',
      data: orderPayload,
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        try {
          resolve(normalizeOrderResponse(res))
        } catch (error) {
          reject(error)
        }
      },
      fail: (error) => {
        uni.showToast({ icon: 'none', title: '网络异常' })
        reject(error instanceof Error ? error : new Error((error && error.errMsg) || '网络异常'))
      }
    })
  })
}

export function createOrderByPackage(packageId, packageType, options = {}) {
  return createOrder({
    packageId,
    packageType,
    quantity: options.quantity,
    source: options.source
  })
}

export function wxPay(order) {
  return new Promise((resolve, reject) => {
    if (!order) {
      reject(new Error('缺少支付订单信息'))
      return
    }

    uni.requestPayment({
      provider: 'wxpay',
      timeStamp: order.timeStamp,
      nonceStr: order.nonceStr,
      package: order.package,
      signType: order.signType,
      paySign: order.paySign,
      success: () => resolve(true),
      fail: (error) => {
        reject(error instanceof Error ? error : new Error((error && error.errMsg) || '支付失败'))
      }
    })
  })
}
