import { getWorkspaceIntentTargetLabel, parseWorkspaceIntent } from './workspaceIntentParser'

const PURPOSE_KEYWORDS = ['商品图', '主图', '白底图', '详情页', '新品开发', '开发新款', '新款', '品牌营销', '营销', '品牌资产', '资产管理']
const COLOR_KEYWORDS = ['纯黑', '黑色', '米白', '白色', '高级灰', '灰色', '藏蓝', '雾霾蓝', '奶油色', '香槟色', '红色', '粉色', '绿色', '蓝色', '紫色']
const SCENE_KEYWORDS = ['白底', '棚拍', '街拍', '户外', '自然', '酒店', '运动场', '节日', '办公室', '咖啡店']
const MODEL_KEYWORDS = ['亚洲女模', '欧美女模', '女模', '男模', '童模', '大码模特', '高挑', '微胖', '年轻模特', '轻熟模特']
const CHINESE_NUMBERS = Object.freeze({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 })

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value))
}

function findSpecificKeyword(text, keywords) {
  return keywords
    .filter((keyword) => String(text || '').includes(keyword))
    .sort((left, right) => right.length - left.length)[0] || ''
}

function extractQuantity(text) {
  const arabicMatch = String(text || '').match(/(?:生成|制作|要|数量)?\s*(\d{1,3})\s*(?:张|套|组|个)/)
  if (arabicMatch) return Math.max(1, Number(arabicMatch[1]) || 1)
  const chineseMatch = String(text || '').match(/(?:生成|制作|要|数量)?\s*([一二三四五六七八九十])\s*(?:张|套|组|个)/)
  return chineseMatch ? CHINESE_NUMBERS[chineseMatch[1]] : 0
}

function hasPurposeChange(text) {
  return PURPOSE_KEYWORDS.some((keyword) => String(text || '').includes(keyword))
}

function snapshotPlan(plan = {}) {
  return {
    guideId: String(plan.guideId || ''),
    category: String(plan.category || ''),
    title: String(plan.title || ''),
    entryType: String(plan.entryType || ''),
    recommendationId: String(plan.recommendationId || ''),
    actions: clone(Array.isArray(plan.actions) ? plan.actions : []),
    estimatedCost: Math.max(0, Number(plan.estimatedCost) || 0),
    outputCount: Math.max(0, Number(plan.outputCount) || 0),
    editableParams: clone(plan.editableParams || {})
  }
}

function restoreSnapshot(plan, snapshot = {}) {
  return {
    ...plan,
    guideId: snapshot.guideId,
    category: snapshot.category,
    title: snapshot.title,
    entryType: snapshot.entryType,
    recommendationId: snapshot.recommendationId,
    actions: clone(snapshot.actions || []),
    estimatedCost: Number(snapshot.estimatedCost) || 0,
    outputCount: Number(snapshot.outputCount) || 0,
    editableParams: clone(snapshot.editableParams || {})
  }
}

function collectChanges(before, after) {
  const changes = {}
  const beforeEditable = before.editableParams || {}
  const afterEditable = after.editableParams || {}
  const fields = ['model', 'color', 'scene', 'purpose', 'quantity']
  fields.forEach((field) => {
    const beforeValue = field === 'purpose' ? before.guideId : (field === 'quantity' ? before.outputCount : beforeEditable[field])
    const afterValue = field === 'purpose' ? after.guideId : (field === 'quantity' ? after.outputCount : afterEditable[field])
    if (JSON.stringify(beforeValue || '') !== JSON.stringify(afterValue || '')) {
      changes[field] = { before: beforeValue || '', after: afterValue || '' }
    }
  })
  return changes
}

export function editWorkspacePlan(plan = {}, inputText = '') {
  const text = String(inputText || '').trim()
  if (!plan.planId || !text) return null
  const beforeParams = snapshotPlan(plan)
  let nextPlan = { ...plan, editableParams: clone(plan.editableParams || {}) }
  const parsedIntent = parseWorkspaceIntent(text)

  if (hasPurposeChange(text) && parsedIntent && parsedIntent.recommendedPlan) {
    const suggested = parsedIntent.recommendedPlan
    nextPlan = {
      ...nextPlan,
      guideId: suggested.guideId,
      category: suggested.category,
      title: suggested.title,
      entryType: suggested.entryType,
      recommendationId: suggested.recommendationId,
      actions: clone(suggested.actions || []),
      estimatedCost: Number(suggested.estimatedCost) || 0,
      outputCount: Number(suggested.outputCount) || 0,
      editableParams: {
        ...nextPlan.editableParams,
        purpose: getWorkspaceIntentTargetLabel(parsedIntent.targetType)
      }
    }
  }

  const parsedParams = parsedIntent ? parsedIntent.extractedParams || {} : {}
  const model = findSpecificKeyword(text, MODEL_KEYWORDS) || (parsedParams.modelRequirement || [])[0] || ''
  const hexMatch = text.match(/#[0-9a-fA-F]{6}\b/)
  const color = hexMatch ? hexMatch[0].toUpperCase() : (findSpecificKeyword(text, COLOR_KEYWORDS) || parsedParams.color || '')
  const scene = findSpecificKeyword(text, SCENE_KEYWORDS) || (parsedParams.scene || [])[0] || ''
  const quantity = extractQuantity(text)
  nextPlan.editableParams = {
    ...nextPlan.editableParams,
    ...(model ? { model } : {}),
    ...(color ? { color } : {}),
    ...(scene ? { scene } : {}),
    ...(quantity ? { quantity } : {})
  }
  if (quantity) {
    const previousOutput = Math.max(1, Number(nextPlan.outputCount) || 1)
    const unitCost = (Number(nextPlan.estimatedCost) || 0) / previousOutput
    nextPlan.outputCount = quantity
    nextPlan.estimatedCost = Number((unitCost * quantity).toFixed(1))
    if (quantity > 1 && nextPlan.entryType !== 'brand_workspace') nextPlan.entryType = 'batch'
  }

  const afterParams = snapshotPlan(nextPlan)
  const changes = collectChanges(beforeParams, afterParams)
  if (!Object.keys(changes).length) return null
  return {
    plan: nextPlan,
    edit: {
      editId: `workspace_plan_edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      planId: plan.planId,
      changes,
      beforeParams,
      afterParams,
      createdAt: new Date().toISOString()
    }
  }
}

export function restoreWorkspacePlan(plan = {}, edit = {}) {
  if (!plan.planId || !edit.beforeParams || edit.planId !== plan.planId) return plan
  return restoreSnapshot(plan, edit.beforeParams)
}

export function logWorkspacePlanEdit(edit = {}) {
  if (!edit.editId) return
  console.log('[workspace:plan-edit]', {
    editId: edit.editId
  })
}
