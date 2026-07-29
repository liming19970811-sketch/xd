const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function loadSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

async function importSource(source) {
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

async function run() {
  const librarySource = loadSource('utils/color/colorLibrary.js')
  const library = await importSource(librarySource)
  const pickerSource = loadSource('utils/color/colorPicker.js')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/colorLibrary['"]/, 'const COLOR_GROUPS = []')
    .replace(/export\s*\{\s*COLOR_GROUPS\s*\}\s*from\s*['"]\.\/colorLibrary['"]/, 'export { COLOR_GROUPS }')
  const picker = await importSource(pickerSource)

  const matrix = library.getSystemColorMatrix()
  const configuredColors = matrix.flat()
  assert(matrix.length === 8, `系统色矩阵应为8行，实际为${matrix.length}`)
  assert(matrix.every((row) => row.length === 10), '系统色矩阵每行应为10列')
  assert(configuredColors.length === 80, `系统色数量应为80，实际为${configuredColors.length}`)
  assert(new Set(configuredColors.map((item) => item.hex)).size === 80, '系统色值必须稳定且不重复')
  assert(configuredColors.every((item) => item.sourceType === 'system_palette'), '系统颜色来源枚举不正确')

  const white = picker.normalizeStandardColor({ name: '纯白', hex: '#FFFFFF' }, 'system')
  assert(white.hex === '#FFFFFF', 'HEX归一失败')
  assert(white.rgb.join(',') === '255,255,255', 'RGB归一失败')
  assert(Math.abs(white.lab[0] - 100) < 0.1, 'Lab转换失败')
  assert(picker.matchColorDisplayName({ hex: '#91AEC3' }) === '雾蓝', 'Lab颜色名称匹配失败')
  assert(picker.matchColorDisplayName({ hex: '#123456' }, 1) === '自定义颜色', '不确定颜色应显示自定义颜色')

  const pixels = []
  for (let index = 0; index < 25; index += 1) pixels.push(90, 120, 150, 255)
  const averaged = picker.averageImageColor(pixels)
  assert(averaged && averaged.r === 90 && averaged.g === 120 && averaged.b === 150, '5x5平均取色失败')

  const palettePixels = []
  for (const rgb of [[17, 17, 17], [145, 174, 195], [200, 170, 137]]) {
    for (let index = 0; index < 40; index += 1) palettePixels.push(...rgb, 255)
  }
  const palette = picker.extractDominantColors(palettePixels, { limit: 6, pixelStep: 1 })
  assert(palette.length === 2, `纯黑边框过滤后的主色提取数量异常：${palette.length}`)
  assert(palette.every((item) => item.hex && item.rgb.length === 3 && item.lab.length === 3), '主色缺少标准颜色字段')

  const storage = new Map([
    ['diebiandesign_current_user', { userId: 'color-smoke-user', enterpriseId: 'color-smoke-enterprise' }]
  ])
  global.uni = {
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value)
  }
  for (let index = 0; index < 31; index += 1) {
    picker.saveColorHistory({ hex: picker.rgbToHex(index, 80, 140), sourceType: 'system_palette' })
  }
  assert(picker.getColorHistory().length === 30, '最近颜色应限制为30个')
  picker.saveColorHistory({ hex: '#05508C', sourceType: 'recent_color' })
  assert(picker.getColorHistory()[0].hex === '#05508C', '重复颜色应去重并移动到第一位')
  picker.removeColorHistory('#05508C')
  assert(!picker.getColorHistory().some((item) => item.hex === '#05508C'), '单个最近颜色删除失败')
  picker.clearColorHistory()
  assert(picker.getColorHistory().length === 0, '最近颜色清空失败')

  const componentSource = loadSource('components/color-picker/color-picker-canvas.vue')
  assert(componentSource.includes('uni.canvasGetImageData'), '吸管未读取Canvas像素')
  assert(componentSource.includes('averageImageColor(data)'), '吸管未执行邻域平均')
  assert(componentSource.includes('extractDominantPalette'), '上传色卡未执行主色提取')
  const customPickerSource = loadSource('components/color-picker/custom-color-picker.vue')
  assert(customPickerSource.includes('hsvToRgb'), '自定义颜色未使用跨端HSV取色逻辑')
  assert(customPickerSource.includes('确认选择'), '自定义颜色缺少确认行为')
  const quickPreviewComponent = loadSource('components/color-picker/color-quick-preview.vue')
  assert(quickPreviewComponent.includes('canvasGetImageData') && quickPreviewComponent.includes('canvasPutImageData'), '快速预览未执行本地像素映射')
  assert(!quickPreviewComponent.includes('createTaskAndRun') && !quickPreviewComponent.includes('quota') && !quickPreviewComponent.includes('provider'), '快速预览不得创建任务、扣额度或调用Provider')
  const previewSource = loadSource('utils/color/colorPreview.js').replace(
    /import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/colorPicker\.js['"]/,
    `const hexToRgb=(hex)=>{const value=String(hex).replace('#','');return {r:parseInt(value.slice(0,2),16),g:parseInt(value.slice(2,4),16),b:parseInt(value.slice(4,6),16)}};const normalizeRgb=(value)=>Array.isArray(value)?value:(value?[value.r,value.g,value.b]:null);const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Number(v)||0)).toString(16).padStart(2,'0')).join('').toUpperCase()`
  )
  const preview = await importSource(previewSource)
  const previewPixels = new Uint8ClampedArray(4 * 4 * 4)
  for (let index = 0; index < 16; index += 1) previewPixels.set([240, 240, 240, 255], index * 4)
  for (const index of [5, 6, 9, 10]) previewPixels.set([110, 60, 60, 255], index * 4)
  const previewMask = preview.buildConnectedColorMask(previewPixels, 4, 4, { seedX: 1, seedY: 1, threshold: 50 })
  assert(Array.from(previewMask).filter((value) => value > 20).length === 4, '快速预览蒙版应只覆盖连通服装区域')
  const previewOutput = preview.applyMaskedColorMap(previewPixels, previewMask, { hex: '#2563EB' })
  assert(previewOutput[0] === previewPixels[0] && previewOutput[1] === previewPixels[1], '蒙版外像素不应变化')
  assert(previewOutput[5 * 4] !== previewPixels[5 * 4], '蒙版内像素应完成颜色映射')
  const originalLight = (previewPixels[20] * .2126) + (previewPixels[21] * .7152) + (previewPixels[22] * .0722)
  const previewLight = (previewOutput[20] * .2126) + (previewOutput[21] * .7152) + (previewOutput[22] * .0722)
  assert(Math.abs(originalLight - previewLight) < 28, '快速预览应保留原始明暗层级')

  const pageSource = loadSource('package-ai/simple-ai-workbench/simple-ai-workbench.vue')
  for (const contract of [
    'baseImage:', 'colorReferenceImage:', 'targetColor:', 'sourceImageFileId:', 'colorSource:', 'targetRegion:',
    'preserveTexture: true', 'preservePattern: true', 'preserveBackground: true', 'preserveIdentity: true'
  ]) {
    assert(pageSource.includes(contract), `任务契约缺少 ${contract}`)
  }
  assert(pageSource.includes("colorAccuracyMode: 'generative_approximate'"), '服务能力未标注为生成式近似换色')
  for (const source of ['system_palette', 'custom_picker', 'eyedropper_garment', 'eyedropper_uploaded', 'dominant_color', 'recent_color']) {
    assert(pageSource.includes(source), `页面缺少颜色来源 ${source}`)
  }
  assert(pageSource.includes('clearRecentColors'), '最近颜色缺少清空确认')
  assert(pageSource.includes('ColorQuickPreview'), '换颜色页缺少快速预览组件')
  assert(pageSource.includes('previewOnly: false'), '正式任务未明确标记previewOnly=false')
  assert(!pageSource.includes('selectedColors:'), '正式任务仍提交多颜色数组')
  const cloudSource = loadSource('cloudfunctions/color_preference/index.js')
  assert(cloudSource.includes("cloud.getWXContext()"), '云端最近颜色未使用可信微信身份')
  assert(cloudSource.includes("COLLECTION = 'colorPreferences'"), '云端最近颜色集合未定义')
  assert(cloudSource.includes('MAX_COLORS = 30'), '云端最近颜色上限不是30')
  assert(cloudSource.includes("enterprise_auth_sessions") && cloudSource.includes("enterprise_members"), '企业颜色缺少服务端成员校验')

  console.log('COLOR_REPLACE_CONTRACT_SMOKE_OK')
  console.log(JSON.stringify({ systemColorCount: configuredColors.length, matrix: '10x8', paletteCount: palette.length, recentLimit: 30, serviceMode: 'generative_approximate' }))
}

run().catch((error) => {
  console.error(`COLOR_REPLACE_CONTRACT_SMOKE_FAILED: ${error.message}`)
  process.exitCode = 1
})
