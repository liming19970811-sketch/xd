export const SUPPORTED_OUTPUT_VARIANT_COUNTS = Object.freeze([1, 2, 4, 8])

export function normalizeOutputVariantCount(value, fallback = 2) {
  const count = Number(value)
  if (SUPPORTED_OUTPUT_VARIANT_COUNTS.includes(count)) return count
  const fallbackCount = Number(fallback)
  return SUPPORTED_OUTPUT_VARIANT_COUNTS.includes(fallbackCount) ? fallbackCount : 2
}

export function buildOutputVariantSlots(outputCount, submissionKey = 'output_variant') {
  const count = normalizeOutputVariantCount(outputCount)
  const stableKey = String(submissionKey || 'output_variant')
  return Array.from({ length: count }, (_, index) => ({
    outputIndex: index,
    outputSlot: index + 1,
    outputCount: 1,
    expectedOutputCount: count,
    clientRequestId: `${stableKey}_${index + 1}`,
    idempotencyKey: `${stableKey}_${index + 1}`
  }))
}
