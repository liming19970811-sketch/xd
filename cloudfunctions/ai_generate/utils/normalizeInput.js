function getNestedValue(source = {}, key = '') {
  return source && source[key] ? source[key] : ''
}

function normalizeImage(image = {}) {
  return {
    fileId: getNestedValue(image, 'fileId') || getNestedValue(image, 'file_id') || getNestedValue(image, 'fileID'),
    fileUrl: getNestedValue(image, 'fileUrl') || getNestedValue(image, 'file_url'),
    imageUrl: getNestedValue(image, 'imageUrl') || getNestedValue(image, 'image_url'),
    url: getNestedValue(image, 'url')
  }
}

function normalizeInput(event = {}) {
  const payload = event.payload || event || {}
  const taskId =
    payload.taskId ||
    payload.task_id ||
    event.taskId ||
    event.task_id ||
    `mock_generate_${Date.now()}`

  return {
    taskId,
    modelType: payload.modelType || payload.model_type || 'female',
    scene: payload.scene || 'white',
    clothImage: normalizeImage(payload.cloth_image || payload.clothImage || {}),
    styleImage: normalizeImage(payload.style_image || payload.styleImage || {}),
    raw: event
  }
}

function normalizeFabricReplaceInput(event = {}) {
  const payload = event.payload || event || {}
  const sourceTaskId = payload.sourceTaskId || payload.source_task_id || ''
  const sourceImageUrl = payload.sourceImageUrl || payload.source_image_url || ''
  const fabricType = payload.fabricType || payload.fabric_type || ''
  const idempotencyKey = payload.idempotencyKey || payload.idempotency_key || ''
  return {
    sourceTaskId,
    sourceImageUrl,
    fabricType,
    idempotencyKey,
    taskId: payload.taskId || payload.task_id || `fabric_replace_${Date.now()}`,
    raw: event
  }
}

function getInputLogSummary(input = {}) {
  const payload = input.payload || input
  const clothImage = payload.clothImage || payload.cloth_image || {}
  const styleImage = payload.styleImage || payload.style_image || {}
  return {
    taskId: payload.taskId || payload.task_id || '',
    modelType: payload.modelType || payload.model_type || '',
    scene: payload.scene || '',
    hasClothImage: !!(
      clothImage.fileId ||
      clothImage.file_id ||
      clothImage.fileID ||
      clothImage.fileUrl ||
      clothImage.file_url ||
      clothImage.imageUrl ||
      clothImage.image_url ||
      clothImage.url
    ),
    hasStyleImage: !!(
      styleImage.fileId ||
      styleImage.file_id ||
      styleImage.fileID ||
      styleImage.fileUrl ||
      styleImage.file_url ||
      styleImage.imageUrl ||
      styleImage.image_url ||
      styleImage.url
    )
  }
}

function getFabricReplaceLogSummary(input = {}) {
  return {
    sourceTaskId: input.sourceTaskId || input.source_task_id || '',
    taskId: input.taskId || input.task_id || '',
    fabricType: input.fabricType || input.fabric_type || '',
    hasSourceImageUrl: !!(input.sourceImageUrl || input.source_image_url),
    hasIdempotencyKey: !!(input.idempotencyKey || input.idempotency_key)
  }
}

module.exports = {
  normalizeFabricReplaceInput,
  normalizeInput,
  getFabricReplaceLogSummary,
  getInputLogSummary
}
