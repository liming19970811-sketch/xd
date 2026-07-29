import { getMainChainState } from '../mainChainState'
import { uploadImage } from '../api/upload'
import { submitTask, syncDraftTaskToState } from './taskActions'

function getRuntimeTask(state) {
  const currentTaskId = state.currentTaskId || state.taskId || state.lastTaskId || ''
  const currentTask = currentTaskId && state.tasks && state.tasks.byId && state.tasks.byId[currentTaskId]
  return currentTask || state.draftTask || {}
}

export function retryTask(payload) {
  return submitTask(payload)
}

export async function retryUploadAsset(field, localPath, scene) {
  const state = getMainChainState()
  const runtimeTask = getRuntimeTask(state)
  const runtimeError = runtimeTask.error || {}
  const runtimeErrorDetails = runtimeError.details || {}
  const runtimeUploadError = runtimeErrorDetails.upload || {}
  const runtimeControl = runtimeTask.control || {}
  const runtimeRetryState = runtimeControl.retryState || {}
  const runtimeUploading = runtimeControl.uploading || {}
  const isClothImage = field === 'clothImage'
  const uploadErrorKey = isClothImage ? 'clothImage' : 'styleImage'

  syncDraftTaskToState({
    [field]: {
      localPath,
      fileId: '',
      fileUrl: ''
    },
    uploadError: {
      ...runtimeUploadError,
      [uploadErrorKey]: ''
    },
    retryable: {
      ...runtimeRetryState,
      [uploadErrorKey]: false
    },
    uploading: {
      ...runtimeUploading,
      [uploadErrorKey]: true
    }
  })

  try {
    const uploadResult = await uploadImage({
      filePath: localPath,
      scene
    })

    syncDraftTaskToState({
      [field]: {
        localPath,
        fileId: uploadResult.fileId,
        fileUrl: uploadResult.fileUrl
      },
      uploadError: {
        ...(((getRuntimeTask(getMainChainState()).error || {}).details || {}).upload || {}),
        [uploadErrorKey]: ''
      },
      retryable: {
        ...(((getRuntimeTask(getMainChainState()).control || {}).retryState) || {}),
        [uploadErrorKey]: false
      },
      uploading: {
        ...(((getRuntimeTask(getMainChainState()).control || {}).uploading) || {}),
        [uploadErrorKey]: false
      }
    })

    return uploadResult
  } catch (error) {
    syncDraftTaskToState({
      uploadError: {
        ...(((getRuntimeTask(getMainChainState()).error || {}).details || {}).upload || {}),
        [uploadErrorKey]: error && error.message ? error.message : '图片上传失败'
      },
      retryable: {
        ...(((getRuntimeTask(getMainChainState()).control || {}).retryState) || {}),
        [uploadErrorKey]: true
      },
      uploading: {
        ...(((getRuntimeTask(getMainChainState()).control || {}).uploading) || {}),
        [uploadErrorKey]: false
      }
    })

    throw error
  }
}
