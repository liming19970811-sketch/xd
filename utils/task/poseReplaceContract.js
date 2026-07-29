export const POSE_REPLACE_ACTION = 'pose_replace'
export const POSE_REPLACE_DRAFT_KEY = 'diebiandesign_pose_replace_draft_v1'

export const POSE_PRESETS = Object.freeze([
  Object.freeze({ value: 'standing', label: '站姿' }),
  Object.freeze({ value: 'sitting', label: '坐姿' }),
  Object.freeze({ value: 'walking', label: '行走' }),
  Object.freeze({ value: 'look_back', label: '回头' }),
  Object.freeze({ value: 'side_pose', label: '侧身' }),
  Object.freeze({ value: 'raise_hand', label: '抬手' }),
  Object.freeze({ value: 'full_body', label: '全身展示' }),
  Object.freeze({ value: 'natural_motion', label: '自然动态' })
])

function text(value = '') {
  return String(value || '').trim()
}

function readAssetUrl(asset = {}) {
  if (typeof asset === 'string') return text(asset)
  return text(asset.fileId || asset.fileID || asset.fileUrl || asset.imageUrl || asset.url)
}

export function isStablePoseImage(value = '') {
  return /^(cloud:\/\/|https:\/\/)/i.test(text(value))
}

export function validatePoseReplaceInput(input = {}) {
  const baseImage = readAssetUrl(input.baseImage)
  const poseSource = text(input.poseSource)
  const posePreset = text(input.posePreset)
  const poseReferenceImage = readAssetUrl(input.poseReferenceImage)

  if (!isStablePoseImage(baseImage)) {
    return { ok: false, errorCode: 'POSE_BASE_IMAGE_REQUIRED', message: '请先上传人物图片' }
  }
  if (!['preset', 'reference'].includes(poseSource)) {
    return { ok: false, errorCode: 'POSE_SOURCE_REQUIRED', message: '请选择姿势来源' }
  }
  if (poseSource === 'preset' && !POSE_PRESETS.some((item) => item.value === posePreset)) {
    return { ok: false, errorCode: 'POSE_PRESET_REQUIRED', message: '请选择目标姿势' }
  }
  if (poseSource === 'reference' && !isStablePoseImage(poseReferenceImage)) {
    return { ok: false, errorCode: 'POSE_REFERENCE_IMAGE_REQUIRED', message: '请上传姿势参考图' }
  }
  if (poseReferenceImage && poseReferenceImage === baseImage) {
    return { ok: false, errorCode: 'POSE_REFERENCE_MUST_DIFFER', message: '姿势参考图不能与人物原图相同' }
  }
  return { ok: true, errorCode: '', message: '' }
}

export function buildPoseReplaceTaskPayload(input = {}) {
  const validation = validatePoseReplaceInput(input)
  if (!validation.ok) return { ok: false, ...validation }
  const baseImage = readAssetUrl(input.baseImage)
  const poseReferenceImage = input.poseSource === 'reference' ? readAssetUrl(input.poseReferenceImage) : ''
  const posePreset = input.poseSource === 'preset' ? text(input.posePreset) : ''
  const toAsset = (value) => ({
    fileId: /^cloud:\/\//i.test(value) ? value : '',
    fileID: /^cloud:\/\//i.test(value) ? value : '',
    fileUrl: /^https:\/\//i.test(value) ? value : value
  })

  return {
    ok: true,
    type: POSE_REPLACE_ACTION,
    taskType: POSE_REPLACE_ACTION,
    channel: 'change_pose',
    run: { fallbackToMock: false },
    input: {
      imageUrl: baseImage,
      image_url: baseImage,
      assets: {
        baseImage: toAsset(baseImage),
        ...(poseReferenceImage ? { poseReferenceImage: toAsset(poseReferenceImage) } : {})
      },
      params: {
        actionType: POSE_REPLACE_ACTION,
        taskType: POSE_REPLACE_ACTION,
        poseSource: input.poseSource,
        posePreset,
        poseReferenceImage,
        costActionType: POSE_REPLACE_ACTION,
        planName: 'AI换姿势',
        outputUsage: '姿势替换图'
      },
      options: {
        posePreset,
        preserveIdentity: true,
        preserveFace: true,
        preserveExpression: true,
        preserveHair: true,
        preserveGarment: true,
        preserveBackground: true,
        preserveScene: true,
        preserveAspectRatio: true,
        allowNecessaryOutpaint: true,
        extractPoseOnly: true,
        useReferenceIdentity: false,
        useReferenceGarment: false,
        useReferenceBackground: false
      }
    },
    params: {
      actionType: POSE_REPLACE_ACTION,
      taskType: POSE_REPLACE_ACTION,
      costActionType: POSE_REPLACE_ACTION,
      poseSource: input.poseSource,
      posePreset
    }
  }
}

export function getPoseProviderCapability() {
  return Object.freeze({
    supported: true,
    provider: 'wanx',
    model: 'qwen-image-2.0-pro',
    errorCode: '',
    message: ''
  })
}
