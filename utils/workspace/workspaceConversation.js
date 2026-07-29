import { getWorkspaceIntentTargetLabel, parseWorkspaceIntent } from './workspaceIntentParser'

const STEP_QUESTIONS = Object.freeze({
  clothingCategory: {
    title: '这次处理哪类服装？',
    options: ['女装', '男装', '童装', '针织', '牛仔']
  },
  purpose: {
    title: '这次主要想完成什么？',
    options: ['商品图', '新品开发', '品牌营销', '品牌资产']
  },
  color: {
    title: '希望使用什么颜色？',
    options: ['纯黑', '米白', '雾霾蓝', '奶油色', '自定义 HEX']
  },
  style: {
    title: '希望呈现什么风格？',
    options: ['韩系', '通勤', '轻奢', '极简', '街拍']
  },
  modelRequirement: {
    title: '对模特有什么要求？',
    options: ['亚洲女模', '男模', '童模', '大码模特', '高挑']
  },
  scene: {
    title: '希望放在什么场景？',
    options: ['白底', '棚拍', '街拍', '户外', '酒店']
  }
})

const PURPOSE_KEYWORDS = ['商品图', '主图', '白底图', '详情页', '模特图', '新品', '新款', '换色', '换颜色', '换图案', '改款', '营销', '小红书', '种草', '品牌资产', '品牌库', '品牌色', '品牌模特']
const CATEGORY_KEYWORDS = ['女装', '男装', '童装', '针织', '牛仔', '运动']

function nowIso() {
  return new Date().toISOString()
}

function createMessage(role, content, step = '') {
  return {
    messageId: `workspace_message_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    content: String(content || ''),
    step,
    createdAt: nowIso()
  }
}

function hasKeyword(text, keywords) {
  return keywords.some((keyword) => String(text || '').includes(keyword))
}

function getExplicitCategory(text, parsedIntent) {
  return hasKeyword(text, CATEGORY_KEYWORDS) ? parsedIntent.extractedParams.clothingCategory : ''
}

function getInitialCollectedParams(text, intent) {
  const params = intent.extractedParams || {}
  const hasPurpose = hasKeyword(text, PURPOSE_KEYWORDS)
  return {
    clothingCategory: getExplicitCategory(text, intent),
    purpose: hasPurpose ? getWorkspaceIntentTargetLabel(intent.targetType) : '',
    targetType: hasPurpose ? intent.targetType : '',
    recommendedEntry: hasPurpose ? intent.recommendedEntry : '',
    color: params.color || '',
    style: Array.isArray(params.style) ? [...params.style] : [],
    modelRequirement: Array.isArray(params.modelRequirement) ? [...params.modelRequirement] : [],
    scene: Array.isArray(params.scene) ? [...params.scene] : []
  }
}

function getRequiredSteps(collected = {}) {
  const common = ['clothingCategory', 'purpose']
  const targetSteps = {
    product_images: ['style', 'modelRequirement', 'scene'],
    new_design: ['color', 'style'],
    brand_marketing: ['style', 'scene'],
    brand_assets: []
  }
  return [...common, ...(targetSteps[collected.targetType] || [])]
}

function hasStepValue(collected, step) {
  const value = collected[step]
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim())
}

function getNextStep(collected = {}) {
  return getRequiredSteps(collected).find((step) => !hasStepValue(collected, step)) || 'completed'
}

function getUserMessageText(messages = []) {
  return messages.filter((message) => message.role === 'user').map((message) => message.content).join('，')
}

function mergeStepAnswer(collected, step, answer) {
  const parsed = parseWorkspaceIntent(answer)
  const params = parsed ? parsed.extractedParams || {} : {}
  const next = { ...collected }
  if (step === 'clothingCategory') next.clothingCategory = params.clothingCategory || answer
  if (step === 'purpose' && parsed) {
    next.purpose = getWorkspaceIntentTargetLabel(parsed.targetType)
    next.targetType = parsed.targetType
    next.recommendedEntry = parsed.recommendedEntry
  }
  if (step === 'color') next.color = params.color || answer
  if (step === 'style') next.style = params.style && params.style.length ? params.style : [answer]
  if (step === 'modelRequirement') next.modelRequirement = params.modelRequirement && params.modelRequirement.length ? params.modelRequirement : [answer]
  if (step === 'scene') next.scene = params.scene && params.scene.length ? params.scene : [answer]
  return next
}

function buildCompletedIntent(messages, collected) {
  const intent = parseWorkspaceIntent(getUserMessageText(messages))
  if (!intent) return null
  return {
    ...intent,
    targetType: collected.targetType || intent.targetType,
    recommendedEntry: intent.recommendedEntry || collected.recommendedEntry,
    extractedParams: {
      clothingCategory: collected.clothingCategory || intent.extractedParams.clothingCategory,
      color: collected.color || intent.extractedParams.color,
      style: [...collected.style],
      modelRequirement: [...collected.modelRequirement],
      scene: [...collected.scene]
    }
  }
}

function appendAssistantQuestion(messages, step) {
  if (step === 'completed') return messages
  const question = STEP_QUESTIONS[step]
  return [...messages, createMessage('assistant', question.title, step)]
}

export function createWorkspaceConversation(inputText = '') {
  const intent = parseWorkspaceIntent(inputText)
  if (!intent) return null
  const collectedParams = getInitialCollectedParams(inputText, intent)
  const currentStep = getNextStep(collectedParams)
  const userMessage = createMessage('user', inputText, 'initial')
  const messages = appendAssistantQuestion([userMessage], currentStep)
  return {
    conversationId: `workspace_conversation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    intentId: intent.intentId,
    messages,
    currentStep,
    collectedParams,
    recommendedIntent: currentStep === 'completed' ? buildCompletedIntent(messages, collectedParams) : null,
    createdAt: nowIso()
  }
}

export function answerWorkspaceConversation(conversation = {}, answerText = '') {
  const answer = String(answerText || '').trim()
  if (!conversation.conversationId || !answer || conversation.currentStep === 'completed') return conversation
  const step = conversation.currentStep
  const collectedParams = mergeStepAnswer(conversation.collectedParams || {}, step, answer)
  const userMessage = createMessage('user', answer, step)
  const answeredMessages = [...(conversation.messages || []), userMessage]
  const currentStep = getNextStep(collectedParams)
  const messages = appendAssistantQuestion(answeredMessages, currentStep)
  return {
    ...conversation,
    messages,
    currentStep,
    collectedParams,
    recommendedIntent: currentStep === 'completed' ? buildCompletedIntent(messages, collectedParams) : null
  }
}

export function getWorkspaceConversationQuestion(conversation = {}) {
  return STEP_QUESTIONS[conversation.currentStep] || null
}

export function logWorkspaceConversation(conversation = {}) {
  if (!conversation.conversationId) return
  console.log('[workspace:conversation]', {
    conversationId: conversation.conversationId
  })
}
