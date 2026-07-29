import { hexToRgb, normalizeRgb, rgbToHex } from './colorPicker.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function rgbDistance(left = [], right = []) {
  return Math.sqrt(left.reduce((sum, value, index) => sum + Math.pow(value - right[index], 2), 0))
}

function luminance(rgb = []) {
  return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2])
}

export function buildConnectedColorMask(data = [], width = 0, height = 0, options = {}) {
  const safeWidth = Math.max(1, Math.floor(Number(width) || 0))
  const safeHeight = Math.max(1, Math.floor(Number(height) || 0))
  if (!data || data.length < safeWidth * safeHeight * 4) return new Uint8ClampedArray(0)
  const seedX = clamp(Math.round(options.seedX === undefined ? safeWidth * 0.5 : options.seedX), 0, safeWidth - 1)
  const seedY = clamp(Math.round(options.seedY === undefined ? safeHeight * 0.58 : options.seedY), 0, safeHeight - 1)
  const threshold = clamp(options.threshold || 74, 28, 120)
  const seedOffset = (seedY * safeWidth + seedX) * 4
  const seed = [data[seedOffset], data[seedOffset + 1], data[seedOffset + 2]]
  const mask = new Uint8ClampedArray(safeWidth * safeHeight)
  const visited = new Uint8Array(safeWidth * safeHeight)
  const queue = []
  let head = 0
  const seedIndex = seedY * safeWidth + seedX
  queue.push(seedIndex)
  visited[seedIndex] = 1
  while (head < queue.length) {
    const pixelIndex = queue[head++]
    const offset = pixelIndex * 4
    if (data[offset + 3] < 32) continue
    const current = [data[offset], data[offset + 1], data[offset + 2]]
    const distance = rgbDistance(current, seed)
    if (distance > threshold) continue
    mask[pixelIndex] = Math.round(255 * Math.pow(1 - (distance / threshold), 0.55))
    const x = pixelIndex % safeWidth
    const y = Math.floor(pixelIndex / safeWidth)
    const neighbors = []
    if (x > 0) neighbors.push(pixelIndex - 1)
    if (x < safeWidth - 1) neighbors.push(pixelIndex + 1)
    if (y > 0) neighbors.push(pixelIndex - safeWidth)
    if (y < safeHeight - 1) neighbors.push(pixelIndex + safeWidth)
    neighbors.forEach((neighbor) => {
      if (visited[neighbor]) return
      visited[neighbor] = 1
      queue.push(neighbor)
    })
  }
  return mask
}

export function applyMaskedColorMap(data = [], mask = [], targetColor = {}) {
  const targetRgbObject = hexToRgb(targetColor.hex || '')
  const targetRgb = normalizeRgb(targetColor.rgb) || normalizeRgb(targetRgbObject)
  if (!targetRgb || !data || !mask || mask.length * 4 > data.length) return new Uint8ClampedArray(0)
  const output = new Uint8ClampedArray(data)
  const targetLuminance = Math.max(1, luminance(targetRgb))
  for (let index = 0; index < mask.length; index += 1) {
    const alpha = Number(mask[index]) / 255
    if (alpha <= 0) continue
    const offset = index * 4
    const original = [data[offset], data[offset + 1], data[offset + 2]]
    const originalLuminance = luminance(original)
    const luminanceScale = clamp(originalLuminance / targetLuminance, 0.18, 2.8)
    const mapped = targetRgb.map((channel) => clamp(Math.round(channel * luminanceScale), 0, 255))
    const textureBlend = 0.88 * alpha
    output[offset] = Math.round(original[0] * (1 - textureBlend) + mapped[0] * textureBlend)
    output[offset + 1] = Math.round(original[1] * (1 - textureBlend) + mapped[1] * textureBlend)
    output[offset + 2] = Math.round(original[2] * (1 - textureBlend) + mapped[2] * textureBlend)
  }
  return output
}

export function previewColorSummary(targetColor = {}) {
  const rgb = normalizeRgb(targetColor.rgb) || normalizeRgb(hexToRgb(targetColor.hex || ''))
  return rgb ? { hex: rgbToHex(...rgb), rgb } : null
}
