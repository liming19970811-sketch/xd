import {
  DETAIL_PAGE_MAX_SEGMENT_HEIGHT,
  DETAIL_PAGE_RENDER_WIDTH,
  SIZE_FIELDS
} from './detailPageContract'

const DEFAULT_THEME = Object.freeze({
  background: '#ffffff',
  surface: '#f7f8fa',
  text: '#101828',
  muted: '#667085',
  accent: '#1677ff',
  padding: 44,
  gap: 24,
  imageHeight: 640,
  heroImageHeight: 760
})
const HEADER_HEIGHT = 112

function text(value = '') {
  return String(value || '').trim()
}

function moduleValue(module = {}, currentKey = '', legacyKey = '') {
  return module[currentKey] !== undefined ? module[currentKey] : module[legacyKey]
}

function normalizeModule(module = {}) {
  return {
    ...module,
    id: text(moduleValue(module, 'moduleId', 'id')),
    kind: text(moduleValue(module, 'moduleType', 'kind')),
    text: text(moduleValue(module, 'content', 'text')),
    order: Number(moduleValue(module, 'sortOrder', 'order')) || 0
  }
}

function themeOf(template = {}) {
  return { ...DEFAULT_THEME, ...(template || {}) }
}

function estimateTextLines(value = '', charsPerLine = 24) {
  return Math.max(1, Math.ceil(Array.from(text(value)).length / charsPerLine))
}

function getVisibleSizeFields(rows = []) {
  const visible = SIZE_FIELDS.filter((field) => field.key === 'size' || rows.some((row) => text(row[field.key])))
  return visible.length > 1 ? visible : SIZE_FIELDS.slice(0, 2)
}

export function estimateModuleHeight(source = {}, sizeRows = [], template = {}) {
  const module = normalizeModule(source)
  const theme = themeOf(template)
  const textHeight = estimateTextLines(module.text) * 42
  const imageHeight = module.id === 'hero' ? theme.heroImageHeight : theme.imageHeight
  if (module.kind === 'image') return HEADER_HEIGHT + imageHeight
  if (module.kind === 'mixed') return HEADER_HEIGHT + (module.fileId ? imageHeight : 0) + (module.text ? Math.max(96, textHeight + 30) : 0)
  if (module.kind === 'size') return HEADER_HEIGHT + 92 + Math.max(1, sizeRows.length) * 58 + (sizeRows.some((row) => text(row.measurementNote)) ? 70 : 0)
  return HEADER_HEIGHT + 60 + textHeight
}

export function buildVerticalSegments(modules = [], sizeRows = [], maxHeight = DETAIL_PAGE_MAX_SEGMENT_HEIGHT, template = {}, renderWidth = DETAIL_PAGE_RENDER_WIDTH) {
  const source = (Array.isArray(modules) ? modules : []).map(normalizeModule)
  const theme = themeOf(template)
  const segments = []
  let current = { height: theme.padding, modules: [] }
  source.forEach((module) => {
    const renderHeight = estimateModuleHeight(module, sizeRows, theme)
    const requiredHeight = renderHeight + theme.gap
    if (current.modules.length && current.height + requiredHeight + theme.padding > maxHeight) {
      current.height += theme.padding
      segments.push(current)
      current = { height: theme.padding, modules: [] }
    }
    current.modules.push({ ...module, renderHeight })
    current.height += requiredHeight
  })
  if (current.modules.length) {
    current.height += theme.padding
    segments.push(current)
  }
  return segments.map((segment, index) => ({ ...segment, index, width: Math.max(320, Number(renderWidth) || DETAIL_PAGE_RENDER_WIDTH) }))
}

function setFont(context, size, weight = 400) {
  context.setFontSize(size)
  try {
    context.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`
  } catch (error) {}
}

function wrapText(context, value, x, y, maxWidth, lineHeight, maxLines = 12) {
  const chars = Array.from(text(value) || '未填写内容')
  const lines = []
  let line = ''
  chars.forEach((char) => {
    const next = `${line}${char}`
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  })
  if (line) lines.push(line)
  const displayed = lines.slice(0, maxLines)
  displayed.forEach((item, index) => context.fillText(item, x, y + index * lineHeight))
  return displayed.length
}

function drawImageContain(context, imagePath, imageInfo, x, y, width, height) {
  const sourcePath = (imageInfo && imageInfo.path) || imagePath
  if (!sourcePath || !imageInfo || !imageInfo.width || !imageInfo.height) return
  const scale = Math.min(width / imageInfo.width, height / imageInfo.height)
  const drawWidth = imageInfo.width * scale
  const drawHeight = imageInfo.height * scale
  context.drawImage(sourcePath, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

function drawImageCover(context, imagePath, imageInfo, x, y, width, height, focalPosition = 'center') {
  const sourcePath = (imageInfo && imageInfo.path) || imagePath
  if (!sourcePath || !imageInfo || !imageInfo.width || !imageInfo.height) return
  const scale = Math.max(width / imageInfo.width, height / imageInfo.height)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = Math.max(0, (imageInfo.width - sourceWidth) / 2)
  const verticalRatio = focalPosition === 'top' ? 0 : (focalPosition === 'bottom' ? 1 : 0.5)
  const sourceY = Math.max(0, (imageInfo.height - sourceHeight) * verticalRatio)
  context.drawImage(sourcePath, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

function drawModuleImage(context, module, imageInfo, x, y, width, height) {
  const layout = module.layout || {}
  const path = module.localPath || module.fileUrl || module.fileId
  if (layout.imageFit === 'cover') drawImageCover(context, path, imageInfo, x, y, width, height, layout.focalPosition)
  else drawImageContain(context, path, imageInfo, x, y, width, height)
}

function drawSizeTable(context, rows, x, y, width, theme) {
  const confirmedRows = rows.filter((row) => row.confirmedByUser === true)
  const fields = getVisibleSizeFields(confirmedRows)
  const cellWidth = width / fields.length
  const fontSize = fields.length >= 8 ? 16 : (fields.length >= 6 ? 18 : 22)
  setFont(context, fontSize, 600)
  context.setFillStyle(theme.text)
  fields.forEach((field, index) => context.fillText(field.label, x + index * cellWidth + 6, y + 34))
  confirmedRows.forEach((row, rowIndex) => {
    const rowY = y + 52 + rowIndex * 58
    context.setStrokeStyle(theme.muted)
    context.setGlobalAlpha(0.25)
    context.beginPath()
    context.moveTo(x, rowY)
    context.lineTo(x + width, rowY)
    context.stroke()
    context.setGlobalAlpha(1)
    setFont(context, fontSize, 400)
    fields.forEach((field, index) => context.fillText(text(row[field.key]) || '-', x + index * cellWidth + 6, rowY + 36))
  })
  const note = text((confirmedRows.find((row) => row.measurementNote) || {}).measurementNote)
  if (note) {
    setFont(context, 18, 400)
    context.setFillStyle(theme.muted)
    wrapText(context, note, x, y + 70 + confirmedRows.length * 58, width, 30, 2)
  }
}

export function drawDetailPageSegment(context, segment = {}, options = {}) {
  const sizeRows = Array.isArray(options.sizeRows) ? options.sizeRows : []
  const imageInfoMap = options.imageInfoMap || {}
  const theme = themeOf(options.template)
  context.setFillStyle(theme.background)
  context.fillRect(0, 0, segment.width, segment.height)
  let y = theme.padding
  segment.modules.map(normalizeModule).forEach((module) => {
    const height = module.renderHeight
    context.setFillStyle(theme.text)
    setFont(context, 30, 600)
    wrapText(context, module.title, theme.padding, y + 34, segment.width - theme.padding * 2, 38, 2)
    context.setFillStyle(theme.accent)
    context.fillRect(theme.padding, y + 62, 64, 5)
    const contentY = y + HEADER_HEIGHT
    const contentWidth = segment.width - theme.padding * 2
    if (module.kind === 'image') {
      context.setFillStyle(theme.surface)
      context.fillRect(theme.padding, contentY, contentWidth, height - HEADER_HEIGHT)
      drawModuleImage(context, module, imageInfoMap[module.id], theme.padding, contentY, contentWidth, height - HEADER_HEIGHT)
    } else if (module.kind === 'mixed' && (module.localPath || module.fileUrl || module.fileId)) {
      const textHeight = module.text ? Math.max(96, estimateTextLines(module.text) * 42 + 30) : 0
      const imageHeight = height - HEADER_HEIGHT - textHeight
      context.setFillStyle(theme.surface)
      context.fillRect(theme.padding, contentY, contentWidth, imageHeight)
      drawModuleImage(context, module, imageInfoMap[module.id], theme.padding, contentY, contentWidth, imageHeight)
      if (module.text) {
        context.setFillStyle(theme.text)
        setFont(context, 25, 400)
        wrapText(context, module.text, theme.padding, contentY + imageHeight + 38, contentWidth, 42)
      }
    } else if (module.kind === 'size') {
      drawSizeTable(context, sizeRows, theme.padding, contentY, contentWidth, theme)
    } else {
      context.setFillStyle(theme.text)
      setFont(context, 25, 400)
      wrapText(context, module.text, theme.padding, contentY + 28, contentWidth, 42)
    }
    y += height + theme.gap
  })
}

export const DETAIL_PAGE_CANVAS_SIZE = Object.freeze({ width: DETAIL_PAGE_RENDER_WIDTH })
