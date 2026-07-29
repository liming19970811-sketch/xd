// DEV ONLY: mock image for ai_generate cloud function smoke.
const MOCK_RESULT_IMAGE_URL = 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80'

async function generateMockResult(input = {}) {
  return {
    taskId: input.taskId,
    status: 'success',
    resultImageUrl: MOCK_RESULT_IMAGE_URL,
    mock: true,
    provider: 'mock',
    inputSummary: {
      modelType: input.modelType,
      scene: input.scene,
      hasClothImage: !!(
        input.clothImage &&
        (input.clothImage.fileId || input.clothImage.fileUrl)
      ),
      hasStyleImage: !!(
        input.styleImage &&
        (input.styleImage.fileId || input.styleImage.fileUrl)
      )
    }
  }
}

module.exports = {
  generateMockResult
}
