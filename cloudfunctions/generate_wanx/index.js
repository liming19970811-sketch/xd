const cloud = require('wx-server-sdk')
const {
  buildGarmentPrompt,
  getGarmentProviderCapabilities,
  isGarmentReplaceAction,
  validateGarmentParams,
  validateGarmentProviderCapabilities
} = require('./garmentReplaceContract')
const {
  buildPatternStructurePrompt,
  isPatternStructureAction,
  validatePatternStructureParams
} = require('./patternStructureContract')
const {
  buildIdentityOutputSize,
  buildIdentityReplacePrompt,
  getIdentityReferenceImage,
  getIdentityProviderCapabilities,
  isIdentityReplaceAction,
  supportsIdentityReference,
  validateIdentityProviderCapabilities,
  validateIdentityReplaceParams
} = require('./identityReplaceContract')
const {
  buildFabricReplacePrompt,
  getFabricReferenceImage,
  isFabricReplaceAction,
  validateFabricReplaceParams
} = require('./fabricReplaceContract')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_WANX_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const DEFAULT_WANX_TASK_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/tasks'
const DEFAULT_WANX_MODEL = 'qwen-image-2.0-pro'
const DEFAULT_REQUEST_TIMEOUT_MS = 110000
const POLL_INTERVAL_MS = 1200
const MAX_POLL_COUNT = 20
const SCENE_REPLACE_ACTIONS = new Set(['scene_replace', 'replace_scene', 'scene_change', 'background_replace'])
const POSE_REPLACE_ACTIONS = new Set(['pose_replace', 'pose_adjust', 'pose_variation', 'pose_variant', 'pose_change'])
const PATTERN_REPLACE_ACTIONS = new Set(['pattern_replace', 'pattern_variation', 'print_generate', 'print_placement'])
const STYLE_REFERENCE_ACTIONS = new Set(['micro_redesign', 'style_redesign', 'hot_style_remix'])
const MODEL_PROFILE_COLLECTION = 'modelProfiles'
const USERS_COLLECTION = 'users'
const QUOTA_RECORDS_COLLECTION = 'membership_usage_records'
const INTERNAL_TEST_ROLES = new Set(['admin', 'super_admin', 'platform_admin', 'internaltester', 'internal_tester', 'tester', 'developer', 'tech', 'ops', 'algorithm'])

function envFlag(name = '') {
  return String(process.env[name] || '').trim().toLowerCase() === 'true'
}

function envList(name = '') {
  return String(process.env[name] || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function getUserRoles(user = {}) {
  return [user.role, user.memberRole, user.systemRole, ...(Array.isArray(user.roles) ? user.roles : [])]
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)
}

async function findInternalTester(openid = '') {
  if (!openid) return null
  if (envList('INTERNAL_TEST_OPENIDS').includes(openid)) return { source: 'environment_whitelist', roles: ['internal_tester'] }
  for (const condition of [{ _openid: openid }, { openid }, { openId: openid }]) {
    try {
      const response = await db.collection(USERS_COLLECTION).where(condition).limit(1).get()
      const user = response && response.data && response.data[0]
      if (user && getUserRoles(user).some((role) => INTERNAL_TEST_ROLES.has(role))) return user
    } catch (error) {
      // Continue through the supported legacy identity fields.
    }
  }
  return null
}

async function verifyRealProviderTestRequest(params = {}, taskId = '') {
  const appStage = String(process.env.APP_STAGE || '').trim().toLowerCase()
  if (!['development', 'testing'].includes(appStage)) return { ok: false, errorCode: 'APP_STAGE_NOT_TESTABLE', message: '当前运行环境不允许内部真实 API 测试' }
  if (!envFlag('ENABLE_REAL_PROVIDER_CALL')) return { ok: false, errorCode: 'REAL_PROVIDER_DISABLED', message: '真实 Provider 调用开关未开启' }
  if (!envFlag('ENABLE_REAL_PROVIDER_TEST')) return { ok: false, errorCode: 'REAL_PROVIDER_TEST_DISABLED', message: '内部真实 API 测试开关未开启' }
  if (!envFlag('ENABLE_REAL_QUOTA_GUARD')) return { ok: false, errorCode: 'REAL_QUOTA_DISABLED', message: '真实额度保护未开启' }
  if (!envFlag('ALLOW_EXPERIMENTAL_PROVIDER')) return { ok: false, errorCode: 'EXPERIMENTAL_PROVIDER_DISABLED', message: '实验 Provider 调用未获允许' }
  if (envFlag('PROVIDER_DRY_RUN')) return { ok: false, errorCode: 'PROVIDER_DRY_RUN_ENABLED', message: 'Provider 当前仍为 dry run' }
  if (!envFlag('DISABLE_MOCK_FALLBACK')) return { ok: false, errorCode: 'MOCK_FALLBACK_NOT_DISABLED', message: '真实测试必须关闭 mock fallback' }
  const context = cloud.getWXContext ? cloud.getWXContext() : {}
  const openid = String((context && context.OPENID) || '').trim()
  const tester = await findInternalTester(openid)
  if (!tester) return { ok: false, errorCode: 'INTERNAL_TEST_ACCOUNT_REQUIRED', message: 'Internal tester authorization is required' }

  const quotaRecordId = String(params.quotaRecordId || '').trim()
  if (!quotaRecordId) return { ok: false, errorCode: 'REAL_QUOTA_RECORD_REQUIRED', message: 'A consumed quota record is required' }
  try {
    const response = await db.collection(QUOTA_RECORDS_COLLECTION).where({ recordId: quotaRecordId, openid }).limit(1).get()
    const record = response && response.data && response.data[0]
    if (!record || !['consumed', 'finalized'].includes(record.status)) {
      return { ok: false, errorCode: 'REAL_QUOTA_RECORD_INVALID', message: 'Quota record is missing or not consumed' }
    }
    if (record.sourceTaskId && taskId && record.sourceTaskId !== taskId) {
      return { ok: false, errorCode: 'REAL_QUOTA_TASK_MISMATCH', message: 'Quota record does not belong to this task' }
    }
    return { ok: true, openid, quotaRecordId, quotaStatus: record.status }
  } catch (error) {
    return { ok: false, errorCode: 'REAL_QUOTA_RECORD_CHECK_FAILED', message: 'Unable to verify quota record' }
  }
}

function getWanxEndpoint() {
  return String(process.env.WANX_API_ENDPOINT || process.env.AI_API_ENDPOINT || DEFAULT_WANX_ENDPOINT).trim()
}

function getWanxTaskEndpoint() {
  return String(process.env.WANX_POLL_ENDPOINT || process.env.AI_POLL_ENDPOINT || DEFAULT_WANX_TASK_ENDPOINT).trim()
}

function getEndpointRegion(endpoint = '') {
  const value = String(endpoint || '').toLowerCase()
  if (value.includes('.cn-beijing.maas.aliyuncs.com') || value.includes('dashscope.aliyuncs.com')) return 'cn-beijing'
  if (value.includes('.ap-southeast-1.maas.aliyuncs.com') || value.includes('dashscope-intl.aliyuncs.com')) return 'ap-southeast-1'
  return 'unknown'
}

function isMultimodalGenerationEndpoint(endpoint = '') {
  return /^https:\/\/[^/]+\/api\/v1\/services\/aigc\/multimodal-generation\/generation\/?(?:\?.*)?$/i.test(String(endpoint || '').trim())
}

function getSafeDebugConfig() {
  const endpoint = getWanxEndpoint()
  const model = String(process.env.WANX_MODEL || DEFAULT_WANX_MODEL).trim() || DEFAULT_WANX_MODEL
  return {
    provider: 'wanx',
    model,
    appStage: String(process.env.APP_STAGE || '').trim().toLowerCase(),
    realProviderEnabled: envFlag('ENABLE_REAL_PROVIDER_CALL') && envFlag('ENABLE_REAL_PROVIDER_TEST'),
    realQuotaGuardEnabled: envFlag('ENABLE_REAL_QUOTA_GUARD'),
    dryRun: envFlag('PROVIDER_DRY_RUN'),
    hasEndpoint: isMultimodalGenerationEndpoint(endpoint),
    endpointRegion: getEndpointRegion(endpoint),
    hasApiKey: Boolean(String(process.env.DASHSCOPE_API_KEY || '').trim()),
    hasPollEndpoint: Boolean(getWanxTaskEndpoint()),
    mockFallbackEnabled: !envFlag('DISABLE_MOCK_FALLBACK'),
    supportedTaskTypes: [
      'head_replace', 'face_replace', 'garment_replace', 'pose_replace', 'pose_adjust',
      'scene_replace', 'color_replace', 'fabric_replace', 'pattern_replace',
      'micro_redesign', 'style_redesign', 'flat_lay_generate', 'detail_photo_generate',
      'display_3d_generate', 'hanging_photo_generate', 'mannequin_generate',
      'pattern_structure_generate', 'ai_model_image'
    ]
  }
}

async function settleRealProviderTestQuota(context = null, response = {}) {
  if (!context || !context.quotaRecordId || context.quotaStatus === 'finalized') return response
  const hasValidImage = response && response.success === true && Boolean(response.resultImageUrl)
  // The client task layer persists the temporary provider URL to Cloud Storage first.
  // Only settleQuotaByTask may finalize after that stable asset is attached to the work.
  if (hasValidImage) {
    return {
      ...response,
      quotaRecordId: context.quotaRecordId,
      quotaStatus: 'consumed'
    }
  }
  try {
    const quotaResponse = await cloud.callFunction({
      name: 'quota_guard',
      data: {
        action: 'rollbackUsage',
        recordId: context.quotaRecordId,
        openid: context.openid,
        statusReason: String(response.errorCode || 'provider_failed')
      }
    })
    const result = (quotaResponse && quotaResponse.result) || {}
    return {
      ...response,
      quotaRecordId: context.quotaRecordId,
      quotaStatus: result.ok ? 'rolled_back' : 'settlement_failed',
      quotaErrorCode: result.ok ? '' : String(result.errorCode || result.reason || 'QUOTA_SETTLEMENT_FAILED')
    }
  } catch (error) {
    return { ...response, quotaRecordId: context.quotaRecordId, quotaStatus: 'settlement_failed', quotaErrorCode: 'QUOTA_SETTLEMENT_FAILED' }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSceneReplaceDevelopment() {
  return ['development', 'dev'].includes(String(process.env.NODE_ENV || '').trim().toLowerCase())
}

async function readJsonResponse(response) {
  const text = await response.text()
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    return {
      rawText: text
    }
  }
}

function getPayload(event = {}) {
  return event.payload || event || {}
}

function getResultImageUrls(data = {}) {
  const output = data.output || {}
  const choices = Array.isArray(output.choices) ? output.choices : []
  const choiceImages = choices.flatMap((choice) => {
    const message = (choice && choice.message) || {}
    const content = Array.isArray(message.content) ? message.content : []
    return content.map((item) => item && item.image).filter(Boolean)
  })
  const results = Array.isArray(output.results) ? output.results : []
  const images = Array.isArray(output.images) ? output.images : []
  return [...new Set([
    ...choiceImages,
    output.result_image_url,
    output.resultImageUrl,
    output.image_url,
    output.imageUrl,
    ...results.flatMap((item) => [item && item.url, item && item.image_url, item && item.imageUrl]),
    ...images.flatMap((item) => [item && item.url, item && item.image_url, item && item.imageUrl])
  ].filter(Boolean))]
}

function getResultImageUrl(data = {}) {
  return getResultImageUrls(data)[0] || ''
}

function getWanxTaskId(data = {}) {
  const output = data.output || {}
  return output.task_id || output.taskId || data.task_id || data.taskId || ''
}

function getWanxTaskStatus(data = {}) {
  const output = data.output || {}
  return output.task_status || output.taskStatus || data.task_status || data.taskStatus || data.status || ''
}

function getWanxCode(data = {}) {
  const output = data.output || {}
  return data.code || output.code || ''
}

function getWanxMessage(data = {}) {
  const output = data.output || {}
  return data.message || output.message || ''
}

function getRawForReturn(data = {}) {
  return {
    request_id: data.request_id || data.requestId || '',
    code: getWanxCode(data),
    message: getWanxMessage(data),
    output: data.output || null
  }
}

function getOutputLogSummary(output = {}) {
  const choices = Array.isArray(output.choices) ? output.choices : []
  const firstChoice = choices[0] || {}
  const message = firstChoice.message || {}
  const content = Array.isArray(message.content) ? message.content : []
  const results = Array.isArray(output.results) ? output.results : []
  const images = Array.isArray(output.images) ? output.images : []
  return {
    task_id: output.task_id || output.taskId || '',
    task_status: output.task_status || output.taskStatus || '',
    code: output.code || '',
    message: output.message || '',
    hasResultImageUrl: !!getResultImageUrl({ output }),
    choicesCount: choices.length,
    firstChoiceContentCount: content.length,
    resultsCount: results.length,
    imagesCount: images.length,
    firstResultHasUrl: !!((results[0] || {}).url || (results[0] || {}).image_url || (results[0] || {}).imageUrl),
    firstImageHasUrl: !!((images[0] || {}).url || (images[0] || {}).image_url || (images[0] || {}).imageUrl)
  }
}

function logWanxResponse(label, httpStatus, data = {}) {
  console.log(label, {
    httpStatus,
    code: getWanxCode(data),
    message: getWanxMessage(data),
    request_id: data.request_id || data.requestId || '',
    output: getOutputLogSummary(data.output || {})
  })
}

function isCloudFileId(value = '') {
  return /^cloud:\/\//.test(String(value || ''))
}

function isHttpsUrl(value = '') {
  return /^https:\/\//.test(String(value || ''))
}

async function resolveAuthorizedModelProfile(params = {}) {
  const modelProfileId = String(params.modelProfileId || '').trim()
  if (!modelProfileId) return null
  const context = cloud.getWXContext()
  const ownerId = String((context && context.OPENID) || '').trim()
  if (!ownerId) throw Object.assign(new Error('Model profile caller identity is unavailable'), { errorCode: 'MODEL_PROFILE_AUTH_REQUIRED' })
  const result = await db.collection(MODEL_PROFILE_COLLECTION).where({ modelProfileId }).limit(1).get()
  const profile = result.data && result.data[0]
  if (!profile || profile.status !== 'active') throw Object.assign(new Error('Model profile is inactive'), { errorCode: 'MODEL_PROFILE_INACTIVE' })
  if (profile.scope !== 'personal' || profile.ownerId !== ownerId) throw Object.assign(new Error('Model profile access denied'), { errorCode: 'MODEL_PROFILE_FORBIDDEN' })
  if (profile.consentConfirmed !== true || profile.trainingAllowed === true) throw Object.assign(new Error('Model profile consent is invalid'), { errorCode: 'MODEL_PROFILE_CONSENT_INVALID' })
  const referenceImage = String(profile.coverFileId || '').trim()
  if (!/^cloud:\/\//i.test(referenceImage)) throw Object.assign(new Error('Model profile reference is invalid'), { errorCode: 'MODEL_PROFILE_REFERENCE_INVALID' })
  return { modelProfileId, referenceImage }
}

function normalizeActionType(payload = {}, params = {}) {
  return String(payload.type || payload.actionType || params.actionType || params.taskType || '').trim().toLowerCase()
}

function isSceneReplaceAction(actionType = '') {
  return SCENE_REPLACE_ACTIONS.has(String(actionType || '').trim().toLowerCase())
}

function getSceneReferenceImage(params = {}) {
  return String(
    params.sceneReferenceImage ||
    params.sceneReferenceUrl ||
    params.scene_reference_image ||
    params.scene_reference_url ||
    ''
  ).trim()
}

function getSceneMode(params = {}) {
  const mode = String(params.sceneMode || '').trim().toLowerCase()
  return mode === 'exact_composite' ? 'exact_composite' : 'generative_reference'
}

function supportsSceneReference(modelName = '') {
  const value = String(modelName || '').trim().toLowerCase()
  return /^qwen-image-(2\.0|edit)/.test(value)
}

function supportsGarmentReferences(modelName = '') {
  const value = String(modelName || '').trim().toLowerCase()
  return /^qwen-image-(2\.0|edit)/.test(value)
}

function buildSceneReplacePrompt(params = {}, prompt = '') {
  const sceneDirection = String(params.scenePrompt || params.sceneType || prompt || '').trim()
  const hasSceneReference = Boolean(getSceneReferenceImage(params))
  return [
    hasSceneReference
      ? '执行双图风格参考场景生成。图一是需要尽量保留的人物与服装主体，图二仅作为目标场景风格参考，结果不会与图二完全一致。'
      : '执行文字引导的场景风格生成。图一是需要尽量保留的人物与服装主体，按场景要求重新生成背景环境。',
    '完整保留图一人物身份、身体姿态和服装的颜色、版型、纹理、图案与细节，移除图一原始背景。',
    hasSceneReference
      ? '使用图二的空间布局、材质、色调、家具元素和光照关系构建新环境，使主体与新场景的透视、接地阴影和光影方向一致。'
      : '根据用户场景要求构建新环境，使主体与新场景的透视、接地阴影和光影方向一致。',
    hasSceneReference ? '不要复制图二中的人物、服装或商品主体。' : '',
    sceneDirection ? `用户场景要求：${sceneDirection}` : ''
  ].filter(Boolean).join('\n')
}

function buildPoseReplacePrompt(params = {}, prompt = '') {
  const preset = String(params.posePreset || '').trim()
  const hasReference = Boolean(params.poseReferenceImage)
  return [
    hasReference
      ? '图一是需要编辑的人物原图，图二只提供目标身体姿势参考。只改变图一人物动作，不得复制图二的人脸、服装或背景。'
      : `只将图一人物调整为目标姿势：${preset || '自然展示姿势'}。`,
    '严格保留图一人物身份、面部特征、发型、服装款式、颜色、图案、材质、原始背景、场景和画面比例。',
    '姿势变化需要扩展构图时只补全必要区域，不得随机换人、换衣或换背景。',
    prompt
  ].filter(Boolean).join('\n')
}

function createSceneError(taskId, errorCode, message, details = {}) {
  return {
    success: false,
    taskId,
    provider: 'wanx',
    errorCode,
    message,
    ...details,
    raw: getRawForReturn({ code: errorCode, message })
  }
}

async function resolveWanxInputImageUrl(imageUrl = '') {
  if (!imageUrl) {
    return ''
  }

  if (isHttpsUrl(imageUrl)) {
    return imageUrl
  }

  if (!isCloudFileId(imageUrl)) {
    return imageUrl
  }

  const result = await cloud.getTempFileURL({
    fileList: [imageUrl]
  })
  const fileList = Array.isArray(result.fileList) ? result.fileList : []
  const firstFile = fileList[0] || {}
  return firstFile.tempFileURL || firstFile.tempFileUrl || ''
}

async function requestWanx(url, options = {}) {
  const configuredTimeout = Number(process.env.WANX_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.max(10000, Math.min(configuredTimeout, 115000)) : DEFAULT_REQUEST_TIMEOUT_MS
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) })
    const data = await readJsonResponse(response)
    return {
      ok: response.ok,
      status: response.status,
      data,
      timedOut: false
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw Object.assign(new Error('Provider request timed out'), {
        errorCode: 'provider_timeout',
        failureStage: 'provider_request',
        timedOut: true
      })
    }
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function pollWanxTask(dashscopeTaskId, apiKey) {
  let latest = null
  for (let i = 0; i < MAX_POLL_COUNT; i += 1) {
    await sleep(POLL_INTERVAL_MS)
    latest = await requestWanx(`${getWanxTaskEndpoint()}/${encodeURIComponent(dashscopeTaskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })
    logWanxResponse('generate_wanx poll response', latest.status, latest.data)

    if (!latest.ok) {
      return latest
    }

    const imageUrl = getResultImageUrl(latest.data)
    if (imageUrl) {
      return latest
    }

    const taskStatus = String(getWanxTaskStatus(latest.data) || '').toUpperCase()
    if (['FAILED', 'CANCELED', 'UNKNOWN', 'SUSPENDED'].includes(taskStatus)) {
      return latest
    }
  }

  return latest || {
    ok: false,
    status: 0,
    data: {
      code: 'wanx_poll_timeout',
      message: 'Wanx task polling timeout',
      output: {
        task_id: dashscopeTaskId
      }
    }
  }
}

function classifyProviderFailure({ httpStatus = 0, providerCode = '', providerMessage = '', timedOut = false } = {}) {
  const code = String(providerCode || '')
  const message = String(providerMessage || '')
  const text = `${code} ${message}`.toLowerCase()
  if (timedOut || text.includes('timeout') || text.includes('timed out')) return 'provider_timeout'
  if (httpStatus === 429 || text.includes('rate limit') || text.includes('throttl')) return 'provider_rate_limited'
  if (text.includes('region') || text.includes('workspace') || text.includes('地域') || text.includes('区域')) return 'provider_region_mismatch'
  if (httpStatus === 401 || httpStatus === 403 || text.includes('invalidapikey') || text.includes('invalid api key') || text.includes('unauthorized')) return 'provider_auth_failed'
  if (httpStatus >= 400 && httpStatus < 500) return 'provider_request_invalid'
  if (httpStatus >= 500) return 'provider_request_failed'
  return code || 'provider_request_failed'
}

function safeProviderMessage(category = '', providerCode = '', providerMessage = '') {
  const safeCode = String(providerCode || category || '').slice(0, 80)
  const messages = {
    provider_auth_failed: 'API Key 无效或无权访问当前模型',
    provider_region_mismatch: 'API Key、Workspace 与接口地域可能不一致',
    provider_request_invalid: 'Provider 请求参数不符合接口要求',
    provider_rate_limited: 'Provider 请求频率受限，请稍后重试',
    provider_timeout: 'Provider 图像编辑请求超时，额度已按失败流程处理',
    provider_empty_result: 'Provider 未返回有效图片',
    image_url_failed: '输入图片无法转换为 Provider 可访问地址',
    quota_failed: '额度预扣或额度记录校验失败'
  }
  const summary = messages[category] || String(providerMessage || 'Provider 调用失败').slice(0, 160)
  return safeCode ? `${safeCode}：${summary}` : summary
}

exports.main = async (event = {}) => {
  const payload = getPayload(event)
  if (String(payload.action || '').trim() === 'debugConfig') {
    return { ok: true, success: true, debugConfig: getSafeDebugConfig() }
  }
  const taskId = payload.taskId || ''
  const imageUrl = payload.imageUrl || ''
  const prompt = payload.prompt || ''
  const params = { ...(payload.params || {}) }
  const realProviderTest = params.realProviderTest === true && params.resultMode === 'real_provider_test'
  let realProviderTestContext = null
  if (realProviderTest) {
    realProviderTestContext = await verifyRealProviderTestRequest(params, taskId)
    if (!realProviderTestContext.ok) {
      const quotaFailure = String(realProviderTestContext.errorCode || '').includes('QUOTA')
      return createSceneError(taskId, quotaFailure ? 'quota_failed' : 'provider_request_invalid', realProviderTestContext.message, {
        providerCode: realProviderTestContext.errorCode,
        failureStage: quotaFailure ? 'quota_preflight' : 'provider_preflight'
      })
    }
  }
  const finish = (response = {}) => settleRealProviderTestQuota(realProviderTest ? realProviderTestContext : null, {
    ...response,
    ...(realProviderTest ? { resultMode: 'real_provider_test', isExperimental: true, isMock: false } : {})
  })
  const actionType = normalizeActionType(payload, params)
  const sceneReplace = isSceneReplaceAction(actionType)
  const poseReplace = POSE_REPLACE_ACTIONS.has(actionType)
  const patternReplace = PATTERN_REPLACE_ACTIONS.has(actionType)
  const styleReferenceEdit = STYLE_REFERENCE_ACTIONS.has(actionType)
  const sceneMode = sceneReplace ? getSceneMode(params) : ''
  const garmentReplace = isGarmentReplaceAction(actionType)
  const patternStructure = isPatternStructureAction(actionType)
  const identityReplace = isIdentityReplaceAction(actionType)
  const fabricReplace = isFabricReplaceAction(actionType)
  const sceneReferenceImage = getSceneReferenceImage(params)
  const fabricReferenceImage = fabricReplace ? getFabricReferenceImage(params) : ''
  let identityReferenceImage = getIdentityReferenceImage(params, actionType)
  let modelProfile = null
  const startedAt = Date.now()
  const apiKey = process.env.DASHSCOPE_API_KEY || ''
  const wanxEndpoint = getWanxEndpoint()
  const modelName = String(process.env.WANX_MODEL || DEFAULT_WANX_MODEL).trim() || DEFAULT_WANX_MODEL
  const garmentValidation = garmentReplace ? validateGarmentParams(params, imageUrl) : null
  const garmentCapabilityValidation = garmentReplace
    ? validateGarmentProviderCapabilities(modelName, garmentValidation && garmentValidation.input.replaceMode)
    : null
  const patternValidation = patternStructure ? validatePatternStructureParams(params, imageUrl) : null
  const identityValidation = identityReplace ? validateIdentityReplaceParams(params, imageUrl, actionType) : null
  const identityCapabilityValidation = identityReplace
    ? validateIdentityProviderCapabilities(modelName, actionType)
    : null
  const fabricValidation = fabricReplace ? validateFabricReplaceParams(params, imageUrl) : null

  if (poseReplace && !realProviderTest) {
    return createSceneError(taskId, 'POSE_CONTROL_NOT_SUPPORTED', 'Current provider does not support reliable pose control')
  }

  if (sceneReplace && sceneMode === 'exact_composite' && !sceneReferenceImage) {
    return createSceneError(taskId, 'SCENE_REFERENCE_REQUIRED', 'Scene reference image is required')
  }
  if (sceneReplace && sceneMode === 'exact_composite') {
    return createSceneError(taskId, 'SCENE_EXACT_COMPOSITE_NOT_AVAILABLE', 'Exact foreground segmentation and pixel compositing are not configured')
  }
  if (sceneReplace && sceneReferenceImage && String(imageUrl).trim() === sceneReferenceImage) {
    return createSceneError(taskId, 'SCENE_REFERENCE_MUST_DIFFER', 'Source image and scene reference image must be different')
  }
  if (sceneReplace && sceneReferenceImage && !supportsSceneReference(modelName)) {
    return createSceneError(taskId, 'SCENE_REFERENCE_NOT_SUPPORTED', 'Current model does not support scene reference images')
  }
  if (garmentValidation && !garmentValidation.ok) {
    return finish(createSceneError(taskId, garmentValidation.errorCode, garmentValidation.message))
  }
  const garmentExperimentalSupported = garmentCapabilityValidation && garmentCapabilityValidation.capability.supportsMultipleImages &&
    garmentCapabilityValidation.capability.maxReferenceImages >= ((garmentValidation && garmentValidation.input.replaceMode === 'separate') ? 2 : 1)
  if (garmentCapabilityValidation && !garmentCapabilityValidation.ok && !(realProviderTest && garmentExperimentalSupported)) {
    console.log('[garment-replace:blocked]', {
      actionType: 'garment_replace',
      modelName,
      providerImageCount: 0,
      ...garmentCapabilityValidation.capability,
      errorCode: garmentCapabilityValidation.errorCode
    })
    return finish(createSceneError(taskId, realProviderTest ? 'provider_capability_mismatch' : garmentCapabilityValidation.errorCode, garmentCapabilityValidation.message))
  }
  if (patternValidation && !patternValidation.ok) {
    return createSceneError(taskId, patternValidation.errorCode, patternValidation.message)
  }
  if (patternStructure && !supportsGarmentReferences(modelName)) {
    return createSceneError(taskId, 'PATTERN_REFERENCE_NOT_SUPPORTED', 'Current model does not support pattern reference images')
  }
  if (identityValidation && !identityValidation.ok) {
    return finish(createSceneError(taskId, identityValidation.errorCode, identityValidation.message))
  }
  const identityExperimentalSupported = identityCapabilityValidation && identityCapabilityValidation.capability.supportsMultipleImages && identityCapabilityValidation.capability.maxReferenceImages >= 1
  if (identityCapabilityValidation && !identityCapabilityValidation.ok && !(realProviderTest && identityExperimentalSupported)) {
    console.log('[identity-replace:blocked]', {
      actionType,
      modelName,
      requestedImageCount: identityReferenceImage ? 2 : 1,
      providerImageCount: 0,
      ...identityCapabilityValidation.capability,
      errorCode: identityCapabilityValidation.errorCode
    })
    return finish(createSceneError(taskId, realProviderTest ? 'provider_capability_mismatch' : identityCapabilityValidation.errorCode, identityCapabilityValidation.message))
  }
  if (fabricValidation && !fabricValidation.ok) {
    return createSceneError(taskId, fabricValidation.errorCode, fabricValidation.message)
  }
  if (fabricReplace && fabricReferenceImage && !supportsGarmentReferences(modelName)) {
    return createSceneError(taskId, 'FABRIC_REFERENCE_NOT_SUPPORTED', 'Current model does not support fabric reference images')
  }

  console.log('generate_wanx start', {
    taskId,
    hasImageUrl: !!imageUrl,
    imageSource: isCloudFileId(imageUrl) ? 'cloud_file_id' : (isHttpsUrl(imageUrl) ? 'https_url' : 'other'),
    hasPrompt: !!prompt,
    modelName
  })
  console.log('[generate_wanx:input]', {
    modelName,
    promptLength: String(prompt || '').length,
    hasModelPrompt: !!(params.modelPrompt && String(prompt || '').includes(params.modelPrompt)),
    hasColorPrompt: !!(params.targetColorPrompt && String(prompt || '').includes(params.targetColorPrompt)),
    hasPatternPrompt: !!(params.patternPrompt && String(prompt || '').includes(params.patternPrompt))
  })

  if (!apiKey) {
    return finish({
      success: false,
      taskId,
      provider: 'wanx',
      errorCode: 'provider_auth_failed',
      providerCode: 'missing_api_key',
      failureStage: 'provider_preflight',
      message: 'missing_api_key：尚未配置 DASHSCOPE_API_KEY',
      raw: getRawForReturn({
        code: 'missing_api_key',
        message: 'DASHSCOPE_API_KEY is missing'
      })
    })
  }
  if (!isMultimodalGenerationEndpoint(wanxEndpoint)) {
    return finish({
      success: false,
      taskId,
      provider: 'wanx',
      errorCode: 'provider_request_invalid',
      providerCode: 'invalid_endpoint',
      failureStage: 'provider_preflight',
      message: 'invalid_endpoint：Endpoint 不是多模态生成接口',
      raw: getRawForReturn({ code: 'invalid_endpoint', message: 'Invalid multimodal generation endpoint' })
    })
  }

  try {
    modelProfile = await resolveAuthorizedModelProfile(params)
    if (modelProfile) {
      params.modelReferenceImage = modelProfile.referenceImage
      if (identityReplace) {
        if (!identityReferenceImage) {
          params.identityReferenceImage = modelProfile.referenceImage
          params.targetPersonImage = modelProfile.referenceImage
          if (actionType === 'face_replace') params.faceReferenceImage = modelProfile.referenceImage
          else params.headReferenceImage = modelProfile.referenceImage
          identityReferenceImage = modelProfile.referenceImage
        }
      } else {
        params.targetPersonImage = modelProfile.referenceImage
      }
    }

    const wanxImageUrl = await resolveWanxInputImageUrl(imageUrl)
    if (!wanxImageUrl || !isHttpsUrl(wanxImageUrl)) {
      return finish({
        success: false,
        taskId,
        provider: 'wanx',
        errorCode: 'image_url_failed',
        providerCode: 'invalid_image_url',
        failureStage: 'input_image_resolve',
        message: 'invalid_image_url：原图无法转换为 Provider 可访问的 HTTPS 地址',
        raw: getRawForReturn({
          code: 'invalid_image_url',
          message: 'Wanx input image must be an accessible https url'
        })
      })
    }
    const poseReferenceImage = poseReplace ? String(params.poseReferenceImage || '').trim() : ''
    const wanxPoseReferenceUrl = poseReferenceImage ? await resolveWanxInputImageUrl(poseReferenceImage) : ''
    if (poseReferenceImage && (!wanxPoseReferenceUrl || !isHttpsUrl(wanxPoseReferenceUrl))) {
      return finish(createSceneError(taskId, 'image_url_failed', 'Pose reference image cannot be converted to an accessible HTTPS URL', {
        providerCode: 'pose_reference_invalid',
        failureStage: 'input_image_resolve'
      }))
    }
    if (wanxPoseReferenceUrl && wanxPoseReferenceUrl === wanxImageUrl) {
      return finish(createSceneError(taskId, 'POSE_REFERENCE_MUST_DIFFER', 'Pose reference image must differ from the base image'))
    }
    const genericReferenceImage = patternReplace
      ? String(params.patternReferenceImage || '').trim()
      : (styleReferenceEdit ? String(params.styleReferenceImage || '').trim() : '')
    const wanxGenericReferenceUrl = genericReferenceImage ? await resolveWanxInputImageUrl(genericReferenceImage) : ''
    if (genericReferenceImage && (!wanxGenericReferenceUrl || !isHttpsUrl(wanxGenericReferenceUrl))) {
      return finish(createSceneError(taskId, 'image_url_failed', 'Reference image cannot be converted to an accessible HTTPS URL', {
        providerCode: 'reference_image_invalid',
        failureStage: 'input_image_resolve'
      }))
    }

    const wanxSceneReferenceUrl = sceneReplace && sceneReferenceImage
      ? await resolveWanxInputImageUrl(sceneReferenceImage)
      : ''
    if (sceneReplace && sceneReferenceImage && (!wanxSceneReferenceUrl || !isHttpsUrl(wanxSceneReferenceUrl))) {
      return createSceneError(taskId, 'SCENE_REFERENCE_INVALID', 'Scene reference image must be an accessible https url')
    }
    if (sceneReplace && wanxSceneReferenceUrl && wanxImageUrl === wanxSceneReferenceUrl) {
      return createSceneError(taskId, 'SCENE_REFERENCE_MUST_DIFFER', 'Source image and scene reference image must be different')
    }

    const wanxIdentityReferenceUrl = identityReplace
      ? await resolveWanxInputImageUrl(identityReferenceImage)
      : ''
    if (identityReplace && (!wanxIdentityReferenceUrl || !isHttpsUrl(wanxIdentityReferenceUrl))) {
      return finish(createSceneError(taskId, 'image_url_failed', 'identity_reference_invalid：目标人像无法转换为 Provider 可访问的 HTTPS 地址', {
        providerCode: 'identity_reference_invalid',
        failureStage: 'input_image_resolve'
      }))
    }
    if (identityReplace && wanxImageUrl === wanxIdentityReferenceUrl) {
      return finish(createSceneError(taskId, 'SOURCE_TARGET_IMAGE_MUST_DIFFER', 'Base image and identity reference image must be different'))
    }

    const modelProfileReferenceImage = modelProfile && !identityReplace ? modelProfile.referenceImage : ''
    const wanxModelProfileReferenceUrl = modelProfileReferenceImage
      ? await resolveWanxInputImageUrl(modelProfileReferenceImage)
      : ''
    if (modelProfileReferenceImage && (!wanxModelProfileReferenceUrl || !isHttpsUrl(wanxModelProfileReferenceUrl))) {
      return createSceneError(taskId, 'MODEL_PROFILE_REFERENCE_INVALID', 'Model profile reference image must be an accessible https url')
    }
    if (wanxModelProfileReferenceUrl && wanxModelProfileReferenceUrl === wanxImageUrl) {
      return createSceneError(taskId, 'SOURCE_TARGET_IMAGE_MUST_DIFFER', 'Source image and model profile reference image must be different')
    }
    if (wanxModelProfileReferenceUrl && !supportsIdentityReference(modelName)) {
      return createSceneError(taskId, 'MODEL_PROFILE_NOT_SUPPORTED', 'Current model does not support model profile references')
    }

    const wanxFabricReferenceUrl = fabricReplace && fabricReferenceImage
      ? await resolveWanxInputImageUrl(fabricReferenceImage)
      : ''
    if (fabricReplace && fabricReferenceImage && (!wanxFabricReferenceUrl || !isHttpsUrl(wanxFabricReferenceUrl))) {
      return createSceneError(taskId, 'FABRIC_REFERENCE_INVALID', 'Fabric reference image must be an accessible https url')
    }
    if (fabricReplace && wanxFabricReferenceUrl === wanxImageUrl) {
      return createSceneError(taskId, 'FABRIC_REFERENCE_MUST_DIFFER', 'Source garment and fabric reference images must be different')
    }

    const garmentInput = garmentValidation ? garmentValidation.input : null
    const garmentReferenceValues = garmentInput
      ? garmentInput.replaceMode === 'upper_only'
        ? [garmentInput.upperGarment]
        : garmentInput.replaceMode === 'lower_only'
          ? [garmentInput.lowerGarment]
          : garmentInput.replaceMode === 'separate'
            ? [garmentInput.upperGarment, garmentInput.lowerGarment]
            : [garmentInput.outfitGarment]
      : []
    const wanxGarmentReferenceUrls = []
    for (const reference of garmentReferenceValues) {
      const resolved = await resolveWanxInputImageUrl(reference)
      if (!resolved || !isHttpsUrl(resolved)) {
        return finish(createSceneError(taskId, 'GARMENT_REFERENCE_INVALID', 'Garment reference image must be an accessible https url'))
      }
      wanxGarmentReferenceUrls.push(resolved)
    }
    if (garmentReplace && wanxGarmentReferenceUrls.some((reference) => reference === wanxImageUrl)) {
      return finish(createSceneError(taskId, 'GARMENT_REFERENCE_MUST_DIFFER', 'Person and garment images must be different'))
    }
    if (garmentInput && garmentInput.replaceMode === 'separate' && wanxGarmentReferenceUrls[0] === wanxGarmentReferenceUrls[1]) {
      return finish(createSceneError(taskId, 'GARMENT_REFERENCES_MUST_DIFFER', 'Upper and lower garment images must be different'))
    }
    const wanxAccessoryReferenceUrls = []
    for (const accessory of (garmentInput && garmentInput.accessoryReferences) || []) {
      const resolved = await resolveWanxInputImageUrl(accessory.imageUrl)
      if (!resolved || !isHttpsUrl(resolved)) {
        return finish(createSceneError(taskId, 'GARMENT_ACCESSORY_REFERENCE_INVALID', 'Accessory reference image must be an accessible https url'))
      }
      if ([wanxImageUrl, ...wanxGarmentReferenceUrls, ...wanxAccessoryReferenceUrls].includes(resolved)) {
        return finish(createSceneError(taskId, 'GARMENT_ACCESSORY_REFERENCE_MUST_DIFFER', 'Person, garment and accessory images must be different'))
      }
      wanxAccessoryReferenceUrls.push(resolved)
    }

    const patternInput = patternValidation ? patternValidation.input : null
    const patternReferenceValues = patternInput
      ? [...new Set((patternInput.referenceImages.length ? patternInput.referenceImages : [patternInput.frontImage]).filter(Boolean))].slice(0, 3)
      : []
    const wanxPatternReferenceUrls = []
    for (const reference of patternReferenceValues) {
      const resolved = reference === imageUrl ? wanxImageUrl : await resolveWanxInputImageUrl(reference)
      if (!resolved || !isHttpsUrl(resolved)) {
        return createSceneError(taskId, 'PATTERN_REFERENCE_INVALID', 'Pattern reference image must be an accessible https url')
      }
      if (!wanxPatternReferenceUrls.includes(resolved)) wanxPatternReferenceUrls.push(resolved)
    }
    if (patternStructure && !wanxPatternReferenceUrls.length) {
      return createSceneError(taskId, 'PATTERN_FRONT_IMAGE_REQUIRED', 'Front garment reference is required')
    }

    const baseProviderPrompt = sceneReplace
      ? buildSceneReplacePrompt(params, prompt)
      : poseReplace
        ? buildPoseReplacePrompt(params, prompt)
      : identityReplace
        ? buildIdentityReplacePrompt(identityValidation.input)
      : garmentReplace
        ? buildGarmentPrompt(garmentInput, prompt)
        : patternStructure
          ? buildPatternStructurePrompt(patternInput, prompt)
          : fabricReplace
            ? buildFabricReplacePrompt(params, prompt, Boolean(wanxFabricReferenceUrl))
            : prompt
    const providerPrompt = wanxModelProfileReferenceUrl
      ? [
          baseProviderPrompt,
          '图一是服装或人物主体图，图二是用户已授权的固定模特身份参考图。',
          '生成结果必须参考图二的人物身份、面部和整体形象，不得使用随机人脸；同时保持图一服装款式、颜色、图案与细节。'
        ].filter(Boolean).join('\n')
      : baseProviderPrompt
    const providerContent = patternStructure
      ? [...wanxPatternReferenceUrls.map((image) => ({ image })), { text: providerPrompt }]
      : [{ image: wanxImageUrl }, ...(wanxPoseReferenceUrl ? [{ image: wanxPoseReferenceUrl }] : []), ...(wanxGenericReferenceUrl ? [{ image: wanxGenericReferenceUrl }] : []), ...(identityReplace ? [{ image: wanxIdentityReferenceUrl }] : []), ...(wanxModelProfileReferenceUrl ? [{ image: wanxModelProfileReferenceUrl }] : []), ...(wanxSceneReferenceUrl ? [{ image: wanxSceneReferenceUrl }] : []), ...(wanxFabricReferenceUrl ? [{ image: wanxFabricReferenceUrl }] : []), ...wanxGarmentReferenceUrls.map((image) => ({ image })), ...wanxAccessoryReferenceUrls.map((image) => ({ image })), { text: providerPrompt }]
    const providerImageCount = providerContent.filter((item) => item && item.image).length
    if (providerImageCount < 1 || providerImageCount > 3) {
      return finish(createSceneError(taskId, 'provider_request_invalid', 'Qwen image editing requires 1 to 3 input images', {
        providerCode: 'INPUT_IMAGE_COUNT_INVALID',
        failureStage: 'provider_preflight'
      }))
    }
    if (fabricReplace && isSceneReplaceDevelopment()) {
      console.log('[fabric-replace:provider]', {
        actionType: 'fabric_replace',
        hasSourceImage: true,
        hasFabricReferenceImage: Boolean(wanxFabricReferenceUrl),
        hasGarmentMask: false,
        materialTransferMode: 'generative_reference',
        modelName,
        deliveryEligible: false
      })
    }
    if (sceneReplace && isSceneReplaceDevelopment()) {
      console.log('[scene-replace:provider]', {
        actionType: 'scene_replace',
        sceneMode,
        hasSourceImage: !!wanxImageUrl,
        hasSceneReferenceImage: !!wanxSceneReferenceUrl,
        sourceAndReferenceDifferent: wanxImageUrl !== wanxSceneReferenceUrl,
        provider: 'wanx',
        success: null,
        errorCode: '',
        durationMs: Date.now() - startedAt
      })
    }
    if (garmentReplace && isSceneReplaceDevelopment()) {
      const garmentCapabilities = getGarmentProviderCapabilities(modelName)
      console.log('[garment-replace:provider]', {
        actionType: 'garment_replace',
        replaceMode: garmentInput.replaceMode,
        hasPersonImage: !!wanxImageUrl,
        garmentReferenceCount: wanxGarmentReferenceUrls.length,
        accessoryReferenceCount: wanxAccessoryReferenceUrls.length,
        providerImageCount: 1 + wanxGarmentReferenceUrls.length + wanxAccessoryReferenceUrls.length,
        virtualTryOnEnabled: garmentCapabilities.supportsVirtualTryOn,
        supportsGarmentMask: garmentCapabilities.supportsGarmentMask,
        referencesDifferent: new Set([wanxImageUrl, ...wanxGarmentReferenceUrls, ...wanxAccessoryReferenceUrls]).size === wanxGarmentReferenceUrls.length + wanxAccessoryReferenceUrls.length + 1,
        provider: 'wanx',
        success: null,
        errorCode: '',
        durationMs: Date.now() - startedAt
      })
    }
    if (patternStructure && isSceneReplaceDevelopment()) {
      console.log('[pattern-structure:provider]', {
        actionType: 'pattern_structure_generate',
        inputMode: patternInput.inputMode,
        category: patternInput.category,
        outputTarget: patternInput.outputTarget,
        referenceCount: wanxPatternReferenceUrls.length,
        hasMeasurements: Object.keys(patternInput.measurements || {}).length > 0,
        provider: 'wanx',
        success: null,
        errorCode: '',
        durationMs: Date.now() - startedAt
      })
    }
    if (identityReplace && isSceneReplaceDevelopment()) {
      const identityCapabilities = getIdentityProviderCapabilities(modelName)
      console.log('[identity-replace:provider]', {
        actionType,
        hasBaseImage: !!wanxImageUrl,
        hasIdentityReferenceImage: !!wanxIdentityReferenceUrl,
        sourceAndReferenceDifferent: wanxImageUrl !== wanxIdentityReferenceUrl,
        preserveGarment: identityValidation.input.preserveGarment,
        preserveBody: identityValidation.input.preserveBody,
        preservePose: identityValidation.input.preservePose,
        preserveComposition: identityValidation.input.preserveComposition,
        preserveBackground: identityValidation.input.preserveBackground,
        providerImageCount: 2,
        identityControlEnabled: identityCapabilities.supportsIdentityReference,
        supportsMaskEdit: identityCapabilities.supportsMaskEdit,
        provider: 'wanx',
        success: null,
        errorCode: '',
        durationMs: Date.now() - startedAt
      })
    }

    const identityOutputSize = identityReplace ? buildIdentityOutputSize(identityValidation.input) : ''

    if (realProviderTest) {
      console.log('[real-provider-test:request]', {
        taskId,
        provider: 'wanx',
        modelName,
        actionType,
        isMultipleImageRequest: providerContent.filter((item) => item && item.image).length > 1,
        inputImageCount: providerContent.filter((item) => item && item.image).length,
        dryRun: false,
        mockFallback: false,
        quotaStatus: realProviderTestContext.quotaStatus
      })
    }

    const submitResult = await requestWanx(wanxEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        input: {
          messages: [
            {
              role: 'user',
              content: providerContent
            }
          ]
        },
        parameters: {
          n: 1,
          negative_prompt: identityReplace
            ? '白色背景，影棚白底，商品抠图，背景简化，重新构图，随机人物，随机脸，替换场景，改变服装，改变姿势'
            : sceneReplace
              ? '改变人脸，改变表情，改变发型，改变手部，改变身体，改变姿势，改变服装，改变服装图案，白色背景，电商白底，随机背景，随机镜头，随机人物动作，自动模特优化'
              : fabricReplace
                ? 'changed face, changed identity, changed body, changed pose, changed garment silhouette, changed neckline, changed sleeves, changed garment length, changed background, changed composition, missing metal chain, missing buttons, missing zipper, plastic shine, stains, dirt, mottling, random print, oversized yarn, floating texture, texture on hardware'
                : ' ',
          prompt_extend: identityReplace ? false : true,
          watermark: false,
          ...(identityOutputSize ? { size: identityOutputSize } : (identityReplace ? {} : { size: '1024*1024' }))
        }
      })
    })

    logWanxResponse('generate_wanx response', submitResult.status, submitResult.data)

    if (!submitResult.ok) {
      const providerCode = getWanxCode(submitResult.data) || `http_${submitResult.status}`
      const providerMessage = getWanxMessage(submitResult.data) || 'wanx_request_failed'
      const errorCode = classifyProviderFailure({ httpStatus: submitResult.status, providerCode, providerMessage })
      return finish({
        success: false,
        taskId,
        provider: 'wanx',
        errorCode,
        providerCode,
        providerMessage: String(providerMessage).slice(0, 200),
        providerRequestId: submitResult.data.request_id || submitResult.data.requestId || '',
        failureStage: 'provider_response',
        httpStatus: submitResult.status,
        message: safeProviderMessage(errorCode, providerCode, providerMessage),
        raw: getRawForReturn(submitResult.data)
      })
    }

    if (getWanxCode(submitResult.data) && !getResultImageUrl(submitResult.data)) {
      const providerCode = getWanxCode(submitResult.data)
      const providerMessage = getWanxMessage(submitResult.data) || 'wanx_request_failed'
      const errorCode = classifyProviderFailure({ httpStatus: submitResult.status, providerCode, providerMessage })
      return finish({
        success: false,
        taskId,
        provider: 'wanx',
        errorCode,
        providerCode,
        providerMessage: String(providerMessage).slice(0, 200),
        providerRequestId: submitResult.data.request_id || submitResult.data.requestId || '',
        failureStage: 'provider_response',
        httpStatus: submitResult.status,
        message: safeProviderMessage(errorCode, providerCode, providerMessage),
        raw: getRawForReturn(submitResult.data)
      })
    }

    let finalData = submitResult.data
    let finalStatus = submitResult.status
    let resultImageUrls = getResultImageUrls(finalData)
    let resultImageUrl = resultImageUrls[0] || ''
    const dashscopeTaskId = getWanxTaskId(finalData)

    if (!resultImageUrl && dashscopeTaskId && modelName !== 'qwen-image-2.0-pro') {
      const pollResult = await pollWanxTask(dashscopeTaskId, apiKey)
      finalData = pollResult.data || {}
      finalStatus = pollResult.status
      resultImageUrls = getResultImageUrls(finalData)
      resultImageUrl = resultImageUrls[0] || ''

      if (!pollResult.ok) {
        return finish({
          success: false,
          taskId,
          provider: 'wanx',
          errorCode: getWanxCode(finalData) || `http_${finalStatus}`,
          message: getWanxMessage(finalData) || 'wanx_poll_failed',
          raw: getRawForReturn(finalData)
        })
      }
    }

    if (!resultImageUrl) {
      return finish({
        success: false,
        taskId,
        provider: 'wanx',
        errorCode: 'provider_empty_result',
        providerCode: getWanxCode(finalData) || 'no_image_returned',
        providerRequestId: finalData.request_id || finalData.requestId || dashscopeTaskId || '',
        failureStage: 'provider_response_parse',
        httpStatus: finalStatus,
        message: safeProviderMessage('provider_empty_result', 'no_image_returned', 'Wanx response did not contain image url'),
        raw: getRawForReturn(finalData)
      })
    }

    if (sceneReplace && resultImageUrl === wanxImageUrl) {
      return createSceneError(taskId, 'SCENE_REPLACE_UNCHANGED_RESULT', 'Scene replacement returned the original source image')
    }
    if (garmentReplace && resultImageUrl === wanxImageUrl) {
      return finish(createSceneError(taskId, 'GARMENT_REPLACE_UNCHANGED_RESULT', 'Garment replacement returned the original person image'))
    }
    if (identityReplace && resultImageUrl === wanxImageUrl) {
      return finish(createSceneError(taskId, 'IDENTITY_REPLACE_UNCHANGED_RESULT', 'Identity replacement returned the original base image'))
    }

    if (sceneReplace && isSceneReplaceDevelopment()) {
      console.log('[scene-replace:result]', {
        actionType: 'scene_replace',
        hasSourceImage: true,
        hasSceneReferenceImage: !!wanxSceneReferenceUrl,
        sourceAndReferenceDifferent: wanxSceneReferenceUrl ? wanxImageUrl !== wanxSceneReferenceUrl : true,
        provider: 'wanx',
        success: true,
        errorCode: '',
        durationMs: Date.now() - startedAt
      })
    }

    if (realProviderTest) {
      console.log('[real-provider-test:result]', {
        taskId,
        provider: 'wanx',
        modelName,
        actionType,
        providerRequestId: finalData.request_id || finalData.requestId || dashscopeTaskId || '',
        hasValidImage: true
      })
    }

    return finish({
      success: true,
      taskId,
      provider: 'wanx',
      resultImageUrl,
      result: {
        items: resultImageUrls.map((imageUrl, index) => ({ imageUrl, sequence: index + 1 }))
      },
      usage: {
        imageCount: Number((finalData.usage || {}).image_count || resultImageUrls.length)
      },
      actionType: sceneReplace ? 'scene_replace' : (garmentReplace ? 'garment_replace' : (patternStructure ? 'pattern_structure_generate' : actionType)),
      sceneMode,
      sceneReferenceUsed: sceneReplace ? Boolean(wanxSceneReferenceUrl) : undefined,
      reviewStatus: (sceneReplace || identityReplace || modelProfile || fabricReplace) ? 'needs_review' : '',
      deliveryEligible: !(sceneReplace || identityReplace || modelProfile || fabricReplace),
      fabricReferenceUsed: fabricReplace ? Boolean(wanxFabricReferenceUrl) : undefined,
      fabricMaskUsed: fabricReplace ? false : undefined,
      materialTransferMode: fabricReplace ? 'generative_reference' : undefined,
      modelVersion: modelName,
      providerRequestId: finalData.request_id || finalData.requestId || dashscopeTaskId || ''
    })
  } catch (error) {
    const errorCode = classifyProviderFailure({
      providerCode: error && error.errorCode,
      providerMessage: error && error.message,
      timedOut: error && error.timedOut
    })
    console.log('generate_wanx response', {
      success: false,
      errorCode
    })
    const message = (error && error.message) || 'wanx_request_error'
    return finish({
      success: false,
      taskId,
      provider: 'wanx',
      errorCode,
      providerCode: String((error && error.errorCode) || 'wanx_request_error'),
      failureStage: String((error && error.failureStage) || 'provider_request'),
      timedOut: Boolean(error && error.timedOut),
      message: safeProviderMessage(errorCode, error && error.errorCode, message),
      raw: getRawForReturn({
        code: errorCode,
        message
      })
    })
  }
}
