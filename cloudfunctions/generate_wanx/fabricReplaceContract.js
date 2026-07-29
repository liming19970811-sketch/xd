const FABRIC_REPLACE_ACTIONS = new Set(['fabric_replace', 'fabric_variation', 'material_replace'])

const FABRIC_PHYSICS = Object.freeze({
  cotton: Object.freeze({ weave: 'fine plain weave', textureScale: 'fine', roughness: 'matte', sheen: 'low', drape: 'natural', transparency: 'opaque', elasticity: 'low', textureStrength: 'medium' }),
  linen: Object.freeze({ weave: 'fine plain weave with subtle slubs', textureScale: 'fine', roughness: 'matte natural', sheen: 'very low', drape: 'natural light folds', transparency: 'opaque', elasticity: 'low', textureStrength: 'medium' }),
  silk: Object.freeze({ weave: 'very fine smooth weave', textureScale: 'very fine', roughness: 'smooth', sheen: 'soft directional', drape: 'fluid', transparency: 'low', elasticity: 'low', textureStrength: 'subtle' }),
  knit: Object.freeze({ weave: 'fine knitted loops', textureScale: 'fine', roughness: 'soft', sheen: 'low', drape: 'soft elastic', transparency: 'opaque', elasticity: 'medium', textureStrength: 'medium' }),
  denim: Object.freeze({ weave: 'clear diagonal twill', textureScale: 'fine', roughness: 'firm', sheen: 'low', drape: 'structured', transparency: 'opaque', elasticity: 'low', textureStrength: 'medium' })
})

function text(value = '') {
  return String(value || '').trim()
}

function isFabricReplaceAction(actionType = '') {
  return FABRIC_REPLACE_ACTIONS.has(text(actionType).toLowerCase())
}

function getFabricReferenceImage(params = {}) {
  return text(params.fabricReferenceImage || params.fabricReferenceUrl || params.fabric_reference_image || params.fabric_reference_url)
}

function getFabricPhysics(params = {}) {
  const configured = params.fabricProperties && typeof params.fabricProperties === 'object' ? params.fabricProperties : {}
  return { ...(FABRIC_PHYSICS[text(params.fabricType).toLowerCase()] || {}), ...configured }
}

function validateFabricReplaceParams(params = {}, sourceImage = '') {
  if (!text(sourceImage)) return { ok: false, errorCode: 'FABRIC_SOURCE_REQUIRED', message: 'Source garment image is required' }
  if (!text(params.fabricType) && !getFabricReferenceImage(params)) {
    return { ok: false, errorCode: 'FABRIC_SELECTION_REQUIRED', message: 'Fabric preset or reference image is required' }
  }
  if (text(params.materialTransferMode) === 'precise_masked_transfer') {
    return { ok: false, errorCode: 'FABRIC_MASK_EDIT_NOT_SUPPORTED', message: 'Precise masked material transfer is not configured' }
  }
  return { ok: true }
}

function buildFabricReplacePrompt(params = {}, prompt = '', hasReference = false) {
  const physics = getFabricPhysics(params)
  const physicalSummary = Object.entries(physics).map(([key, value]) => `${key}=${value}`).join(', ')
  const colorRule = params.fabricColorMode === 'adopt_reference' ? 'Use the fabric sample color.' : 'Keep the original garment color.'
  return [
    hasReference
      ? 'Image 1 is the source person or garment. Image 2 is the fabric sample only. Transfer only its weave and material surface; never copy the sample background, border, stains, shadows, objects or printed motifs.'
      : 'Image 1 is the source person or garment. Apply the selected fabric as a material-effect reference.',
    `Target area: ${text(params.fabricTargetArea || params.materialPosition || 'whole_garment')}. ${colorRule}`,
    physicalSummary ? `Material constraints: ${physicalSummary}.` : '',
    'Strictly preserve identity, face, hair, body, pose, garment silhouette, neckline, sleeves, length, seams, folds, lighting, background and composition.',
    'Preserve metal chains, buttons, zippers, lace, bows, piping, transparent mesh, prints, trims and stitching. Do not apply fabric texture to these decorations.',
    'Keep texture fine and continuous, following garment curvature and folds. Use low-to-medium redraw strength and low style strength.',
    text(params.fabricType) === 'linen' ? 'Linen must be a clean fine plain weave with subtle slubs, matte and natural. No stains, distressing, mottling or random prints.' : '',
    text(params.fabricType) === 'silk' ? 'Silk must have soft directional sheen and fluid drape. No plastic or metallic glare.' : '',
    text(params.fabricType) === 'knit' ? 'Knit loops must remain fine and follow the body surface. Do not enlarge them into coarse yarn.' : '',
    text(params.fabricType) === 'denim' ? 'Denim must show fine diagonal twill and reasonable seams. No random holes, distressing or washing marks.' : '',
    prompt
  ].filter(Boolean).join('\n')
}

module.exports = {
  buildFabricReplacePrompt,
  getFabricReferenceImage,
  getFabricPhysics,
  isFabricReplaceAction,
  validateFabricReplaceParams
}
