import { getMainChainState } from '../mainChainState'
import { uploadImage } from '../api/upload'
import { submitTask, syncDraftTaskToState } from './taskActions'

function normalizeUploadedAsset(localPath, uploadResult = {}) {
  const fileId = uploadResult.fileId || uploadResult.file_id || uploadResult.fileID || ''
  const fileUrl =
    uploadResult.fileUrl ||
    uploadResult.file_url ||
    uploadResult.imageUrl ||
    uploadResult.image_url ||
    uploadResult.url ||
    ''

  return {
    localPath: uploadResult.localPath || localPath,
    fileId,
    file_id: fileId,
    fileUrl,
    file_url: fileUrl,
    imageUrl: fileUrl,
    image_url: fileUrl,
    url: fileUrl,
    source: uploadResult.source || ''
  }
}

function normalizeUploadTarget(field, scene) {
  if (scene === 'cloth_image' || scene === 'clothImage') {
    return {
      field: 'clothImage',
      scene: 'cloth_image',
      uploadErrorKey: 'clothImage'
    }
  }
  if (scene === 'style_image' || scene === 'styleImage') {
    return {
      field: 'styleImage',
      scene: 'style_image',
      uploadErrorKey: 'styleImage'
    }
  }

  const normalizedField = field === 'styleImage' ? 'styleImage' : 'clothImage'
  return {
    field: normalizedField,
    scene: normalizedField === 'styleImage' ? 'style_image' : 'cloth_image',
    uploadErrorKey: normalizedField === 'styleImage' ? 'styleImage' : 'clothImage'
  }
}

function getRuntimeTask(state) {
  const currentTaskId = state.currentTaskId || state.taskId || state.lastTaskId || ''
  const currentTask = currentTaskId && state.tasks && state.tasks.byId && state.tasks.byId[currentTaskId]
  return currentTask || state.draftTask || {}
}

export function retryTask(payload) {
  return submitTask(payload)
}

export async function retryUploadAsset(field, localPath, scene) {
  const target = normalizeUploadTarget(field, scene)
  const state = getMainChainState()
  const runtimeTask = getRuntimeTask(state)
  const runtimeError = runtimeTask.error || {}
  const runtimeErrorDetails = runtimeError.details || {}
  const runtimeUploadError = runtimeErrorDetails.upload || {}
  const runtimeControl = runtimeTask.control || {}
  const runtimeRetryState = runtimeControl.retryState || {}
  const runtimeUploading = runtimeControl.uploading || {}
  const uploadErrorKey = target.uploadErrorKey

  if (target.field !== field || target.scene !== scene) {
    console.warn('[upload:asset] target normalized', {
      requestedField: field,
      requestedScene: scene,
      field: target.field,
      scene: target.scene
    })
  }

  syncDraftTaskToState({
    [target.field]: {
      localPath,
      fileId: '',
      file_id: '',
      fileUrl: '',
      file_url: '',
      imageUrl: '',
      image_url: '',
      url: '',
      source: ''
    },
    taskError: {
      message: '',
      retryable: false,
      details: {
        upload: {
          ...runtimeUploadError,
          [uploadErrorKey]: ''
        }
      }
    },
    taskControl: {
      retryState: {
        ...runtimeRetryState,
        [uploadErrorKey]: false
      },
      uploading: {
        ...runtimeUploading,
        [uploadErrorKey]: true
      }
    }
  })

  try {
    const uploadResult = await uploadImage({
      filePath: localPath,
      scene: target.scene
    })
    const uploadedAsset = normalizeUploadedAsset(localPath, uploadResult)

    syncDraftTaskToState({
      [target.field]: uploadedAsset,
      taskError: {
        message: '',
        retryable: false,
        details: {
          upload: {
            ...(((getRuntimeTask(getMainChainState()).error || {}).details || {}).upload || {}),
            [uploadErrorKey]: ''
          }
        }
      },
      taskControl: {
        retryState: {
          ...(((getRuntimeTask(getMainChainState()).control || {}).retryState) || {}),
          [uploadErrorKey]: false
        },
        uploading: {
          ...(((getRuntimeTask(getMainChainState()).control || {}).uploading) || {}),
          [uploadErrorKey]: false
        }
      }
    })

    console.log('[upload:asset] uploaded', {
      field: target.field,
      scene: target.scene,
      hasLocalPath: !!uploadedAsset.localPath,
      hasFileId: !!uploadedAsset.fileId,
      hasFileUrl: !!uploadedAsset.fileUrl,
      hasHttpsUrl: /^https:\/\//.test(uploadedAsset.fileUrl || ''),
      hasCloudFileId: /^cloud:\/\//.test(uploadedAsset.fileId || ''),
      source: uploadedAsset.source || ''
    })

    return {
      ...uploadResult,
      field: target.field,
      scene: target.scene
    }
  } catch (error) {
    syncDraftTaskToState({
      taskError: {
        type: 'upload',
        message: error && error.message ? error.message : '图片上传失败',
        retryable: true,
        details: {
          upload: {
            ...(((getRuntimeTask(getMainChainState()).error || {}).details || {}).upload || {}),
            [uploadErrorKey]: error && error.message ? error.message : '图片上传失败'
          }
        }
      },
      taskControl: {
        retryState: {
          ...(((getRuntimeTask(getMainChainState()).control || {}).retryState) || {}),
          [uploadErrorKey]: true
        },
        uploading: {
          ...(((getRuntimeTask(getMainChainState()).control || {}).uploading) || {}),
          [uploadErrorKey]: false
        }
      }
    })

    throw error
  }
}
