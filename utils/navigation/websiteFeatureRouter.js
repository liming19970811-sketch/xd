const WEBSITE_ORIGIN = 'https://www.diebiandesign.com'

const WEBSITE_FEATURES = Object.freeze({
  pattern_library: Object.freeze({
    name: '版型库',
    path: '/pages/enterprise-web/pattern-center?tab=library'
  }),
  pattern_review: Object.freeze({
    name: '打版师复核',
    path: '/pages/enterprise-web/pattern-center?tab=review'
  }),
  pattern_training: Object.freeze({
    name: 'AI制版训练与评测',
    path: '/pages/enterprise-web/pattern-center?tab=training'
  }),
  sample_workflow: Object.freeze({
    name: '样衣与版型协作',
    path: '/pages/workspace/workspace?module=pattern-making'
  }),
  small_batch: Object.freeze({
    name: '小单生产协作',
    path: '/pages/workspace/workspace?module=batch'
  })
})

function getWebsiteFeature(featureId = '') {
  return WEBSITE_FEATURES[String(featureId || '').trim()] || null
}

function buildWebsiteFeatureUrl(featureId = '') {
  const feature = getWebsiteFeature(featureId)
  return feature ? `${WEBSITE_ORIGIN}${feature.path}` : ''
}

function copyWebsiteFeatureUrl(featureId = '') {
  const url = buildWebsiteFeatureUrl(featureId)
  if (!url) return false
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: '网页版地址已复制', icon: 'none' }),
    fail: () => uni.showToast({ title: '地址复制失败，请稍后重试', icon: 'none' })
  })
  return true
}

export function openWebsiteFeature(featureId = '') {
  const feature = getWebsiteFeature(featureId)
  if (!feature) {
    uni.showToast({ title: '该专业能力暂时无法打开', icon: 'none' })
    return false
  }

  // #ifdef H5
  uni.navigateTo({
    url: feature.path,
    fail: () => uni.showToast({ title: `${feature.name}暂时无法打开`, icon: 'none' })
  })
  return true
  // #endif

  // #ifdef MP-WEIXIN
  uni.showModal({
    title: `${feature.name}已迁移至网页版`,
    content: '复杂管理能力请使用蝶变企业网页版。可复制地址后在浏览器中打开。',
    confirmText: '复制地址',
    cancelText: '暂不前往',
    success: ({ confirm }) => {
      if (confirm) copyWebsiteFeatureUrl(featureId)
    }
  })
  return true
  // #endif

  return false
}

export { WEBSITE_ORIGIN, WEBSITE_FEATURES, buildWebsiteFeatureUrl }
