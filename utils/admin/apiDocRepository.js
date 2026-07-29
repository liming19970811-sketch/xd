import { getBrandApiAppById } from './apiRepository'

const API_DOC_STORAGE_KEY = 'diebiandesign_brand_api_docs'

const API_DOC_TEMPLATES = Object.freeze({
  image_generate: Object.freeze({
    name: '单图生成',
    path: '/api/v1/images/generate',
    method: 'POST',
    params: Object.freeze([
      { name: 'imageUrl', required: true, description: '待处理服装图片地址' },
      { name: 'prompt', required: true, description: '本次出图要求' }
    ]),
    request: Object.freeze({ imageUrl: 'https://example.com/cloth.jpg', prompt: '生成电商模特展示图' }),
    response: Object.freeze({ success: true, requestId: 'mock_request_id', resultImageUrl: 'https://example.com/result.jpg' })
  }),
  batch_generate: Object.freeze({
    name: '批量生成',
    path: '/api/v1/images/batch-generate',
    method: 'POST',
    params: Object.freeze([
      { name: 'items', required: true, description: '批量生成参数数组' },
      { name: 'callbackUrl', required: false, description: '模拟回调地址' }
    ]),
    request: Object.freeze({ items: [{ imageUrl: 'https://example.com/cloth.jpg', prompt: '生成白底商品图' }] }),
    response: Object.freeze({ success: true, batchId: 'mock_batch_id', taskCount: 1 })
  }),
  asset_access: Object.freeze({
    name: '资产查询',
    path: '/api/v1/assets',
    method: 'GET',
    params: Object.freeze([
      { name: 'assetType', required: false, description: 'image、clothing、model 或 batch' },
      { name: 'page', required: false, description: '分页页码' }
    ]),
    request: Object.freeze({ assetType: 'image', page: 1 }),
    response: Object.freeze({ success: true, items: [], total: 0 })
  }),
  project_access: Object.freeze({
    name: '项目查询',
    path: '/api/v1/projects/{projectId}',
    method: 'GET',
    params: Object.freeze([
      { name: 'projectId', required: true, description: '企业项目编号' }
    ]),
    request: Object.freeze({ projectId: 'project_demo_001' }),
    response: Object.freeze({ success: true, project: { projectId: 'project_demo_001', status: '生成中' } })
  })
})

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeDoc(doc = {}) {
  return {
    docId: String(doc.docId || ''),
    appId: String(doc.appId || ''),
    endpoint: String(doc.endpoint || ''),
    name: String(doc.name || doc.endpoint || 'API 接口'),
    path: String(doc.path || ''),
    method: String(doc.method || 'GET').toUpperCase(),
    params: Array.isArray(doc.params) ? cloneValue(doc.params) : [],
    example: doc.example && typeof doc.example === 'object'
      ? cloneValue(doc.example)
      : { request: {}, response: {} },
    createdAt: doc.createdAt || new Date().toISOString()
  }
}

function readDocs() {
  try {
    const docs = uni.getStorageSync(API_DOC_STORAGE_KEY)
    return Array.isArray(docs) ? docs.map(normalizeDoc) : []
  } catch (error) {
    return []
  }
}

function writeDocs(docs = []) {
  try {
    uni.setStorageSync(API_DOC_STORAGE_KEY, docs.map(normalizeDoc))
  } catch (error) {}
  return docs
}

function createDocFromTemplate(appId, endpoint, createdAt = '') {
  const template = API_DOC_TEMPLATES[endpoint]
  if (!template) return null
  return normalizeDoc({
    docId: `api_doc_${appId}_${endpoint}`,
    appId,
    endpoint,
    name: template.name,
    path: template.path,
    method: template.method,
    params: template.params,
    example: { request: template.request, response: template.response },
    createdAt: createdAt || new Date().toISOString()
  })
}

export function getApiDocs(appId = '') {
  const app = getBrandApiAppById(appId)
  if (!app) return []
  const allDocs = readDocs()
  const docsByEndpoint = allDocs
    .filter((doc) => doc.appId === appId)
    .reduce((result, doc) => {
      result[doc.endpoint] = doc
      return result
    }, {})
  const docs = app.permissions
    .map((endpoint) => docsByEndpoint[endpoint] || createDocFromTemplate(appId, endpoint))
    .filter(Boolean)
  const retained = allDocs.filter((doc) => doc.appId !== appId)
  writeDocs([...retained, ...docs])
  return docs.map(normalizeDoc)
}

export function getApiDocById(docId = '') {
  const doc = readDocs().find((item) => item.docId === docId)
  if (!doc) return null
  console.log('[api:doc]', {
    docId: doc.docId,
    appId: doc.appId
  })
  return normalizeDoc(doc)
}

export function getApiDocEndpointOptions() {
  return Object.keys(API_DOC_TEMPLATES).map((endpoint) => ({
    endpoint,
    name: API_DOC_TEMPLATES[endpoint].name,
    path: API_DOC_TEMPLATES[endpoint].path,
    method: API_DOC_TEMPLATES[endpoint].method
  }))
}
