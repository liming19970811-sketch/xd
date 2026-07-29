const cloud = require('wx-server-sdk')

const IMAGE_URL_RESOLVE_ERROR_CODE = Object.freeze({
  MISSING_CLOTH_IMAGE: 'REAL_PROVIDER_MISSING_CLOTH_IMAGE',
  RESOLVE_FAILED: 'REAL_PROVIDER_IMAGE_URL_RESOLVE_FAILED'
})

function getImageValue(image = {}, keys = []) {
  for (const key of keys) {
    if (image && image[key]) {
      return String(image[key]).trim()
    }
  }
  return ''
}

function getHttpsUrl(image = {}) {
  return getImageValue(image, [
    'fileUrl',
    'file_url',
    'imageUrl',
    'image_url',
    'url'
  ])
}

function getCloudFileId(image = {}) {
  const directFileId = getImageValue(image, [
    'fileId',
    'file_id',
    'fileID'
  ])
  if (directFileId) {
    return directFileId
  }

  const urlLikeValue = getHttpsUrl(image)
  if (/^cloud:\/\//.test(urlLikeValue)) {
    return urlLikeValue
  }

  return ''
}

async function resolveProviderImageUrl(image = {}) {
  const httpsUrl = getHttpsUrl(image)
  if (/^https:\/\//.test(httpsUrl)) {
    return {
      ok: true,
      url: httpsUrl,
      source: 'https_url',
      cloudStatus: '',
      hasCloudFileId: false
    }
  }

  const cloudFileId = getCloudFileId(image)
  if (!cloudFileId) {
    return {
      ok: false,
      reason: 'missing_cloth_image',
      errorCode: IMAGE_URL_RESOLVE_ERROR_CODE.MISSING_CLOTH_IMAGE,
      source: '',
      cloudStatus: '',
      hasCloudFileId: false
    }
  }

  try {
    const response = await cloud.getTempFileURL({
      fileList: [cloudFileId]
    })
    const fileInfo = response && Array.isArray(response.fileList)
      ? response.fileList[0]
      : null
    const tempFileURL = fileInfo && fileInfo.tempFileURL
    const cloudStatus = fileInfo && fileInfo.status !== undefined
      ? String(fileInfo.status)
      : ''

    if (tempFileURL && /^https:\/\//.test(tempFileURL)) {
      return {
        ok: true,
        url: tempFileURL,
        source: 'cloud_temp_url',
        cloudStatus,
        hasCloudFileId: true
      }
    }

    return {
      ok: false,
      reason: 'real_provider_image_url_resolve_failed',
      errorCode: IMAGE_URL_RESOLVE_ERROR_CODE.RESOLVE_FAILED,
      source: 'cloud_temp_url',
      cloudStatus,
      hasCloudFileId: true
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'real_provider_image_url_resolve_failed',
      errorCode: IMAGE_URL_RESOLVE_ERROR_CODE.RESOLVE_FAILED,
      source: 'cloud_temp_url',
      cloudStatus: (error && (error.errCode || error.errMsg || error.message)) || 'unknown',
      hasCloudFileId: true
    }
  }
}

module.exports = {
  IMAGE_URL_RESOLVE_ERROR_CODE,
  resolveProviderImageUrl
}
