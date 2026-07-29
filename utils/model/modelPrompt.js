const genderTextMap = {
  female: '女性',
  male: '男性',
  kids: '儿童'
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeRegion(region = '') {
  if (!region) {
    return '亚洲'
  }
  if (region === '东亚') {
    return '亚洲'
  }
  return region
}

function normalizeAgeRange(ageRange = '') {
  return ageRange ? `${ageRange}岁` : ''
}

function normalizeBodyType(bodyType = '') {
  return bodyType ? `${bodyType}身材` : ''
}

export function buildModelPrompt(model = {}) {
  if (model.modelPrompt) {
    return model.modelPrompt
  }
  const genderText = genderTextMap[model.modelGender] || genderTextMap[model.gender] || model.modelGender || model.gender || ''
  const subjectText = genderText ? `${genderText}模特` : '服装模特'
  const ageText = normalizeAgeRange(model.modelAgeRange || model.ageRange)
  const regionText = normalizeRegion(model.modelRegion || model.region)
  const bodyText = normalizeBodyType(model.modelBodyType || model.bodyType)
  const heightText = model.modelHeight || model.height || ''
  const faceText = model.modelFaceStyle || model.faceStyle || ''
  const hairText = model.modelHairStyle || model.hairStyle || ''
  const styleTags = normalizeList(model.styleTags || model.modelStyleTags).slice(0, 3)
  const sceneTags = normalizeList(model.sceneTags || model.modelSceneTags).slice(0, 2)
  const styleText = styleTags.length ? `${styleTags.join('、')}展示` : '服装展示'
  const sceneText = sceneTags.length ? `适合${sceneTags.join('、')}场景` : ''

  return [
    `${ageText}${regionText}${subjectText}`,
    faceText,
    hairText,
    heightText,
    bodyText,
    styleText,
    sceneText,
    '商业摄影质感'
  ].filter(Boolean).join('，') + '。'
}
