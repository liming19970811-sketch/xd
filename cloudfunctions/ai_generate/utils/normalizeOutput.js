function normalizeSuccessOutput(result = {}, message = 'ok') {
  const taskId = result.taskId || result.task_id || ''
  const resultImageUrl =
    result.resultImageUrl ||
    result.result_image_url ||
    result.imageUrl ||
    result.image_url ||
    ''
  const status = result.status || 'success'
  const inputSummary = result.inputSummary || {}
  const isMock = !!result.mock
  const provider = result.provider || (isMock ? 'mock' : '')
  const requestedProvider = result.requestedProvider || provider || (isMock ? 'mock' : '')
  const data = {
    task_id: taskId,
    taskId,
    status,
    task_status: status,
    taskStatus: status,
    result_image_url: resultImageUrl,
    resultImageUrl,
    image_url: resultImageUrl,
    imageUrl: resultImageUrl,
    mock: isMock,
    provider,
    requestedProvider,
    fallback: !!result.fallback,
    fallbackReason: result.fallbackReason || '',
    fallbackErrorCode: result.fallbackErrorCode || '',
    errorCode: result.errorCode || result.fallbackErrorCode || '',
    input: {
      modelType: inputSummary.modelType || '',
      scene: inputSummary.scene || '',
      hasClothImage: !!inputSummary.hasClothImage,
      hasStyleImage: !!inputSummary.hasStyleImage
    }
  }

  return {
    code: 0,
    success: true,
    message,
    task_id: taskId,
    taskId,
    status,
    taskStatus: status,
    result_image_url: resultImageUrl,
    resultImageUrl,
    data
  }
}

function normalizeFailureOutput(message = 'ai_generate failed', code = -1) {
  return {
    code,
    success: false,
    message,
    errorMessage: message,
    data: null
  }
}

module.exports = {
  normalizeSuccessOutput,
  normalizeFailureOutput
}
