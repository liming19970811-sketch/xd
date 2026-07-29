const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

let source = read('utils/work/workDetailDisplay.js')
  .replace(/export\s+function\s+/g, 'function ')
  .replace(/export\s*\{[^}]+\}\s*$/gm, '')
source += '\nmodule.exports = { buildWorkChangeFields, buildSchemeFields, buildGenerationInfo };'
const context = { module: { exports: {} }, exports: {}, Object, Array, String, Number, Boolean, RegExp }
vm.runInNewContext(source, context, { filename: 'workDetailDisplay.js' })
const { buildWorkChangeFields, buildSchemeFields, buildGenerationInfo } = context.module.exports

const colorFields = buildWorkChangeFields({
  workType: 'color_replace',
  typeLabel: '换颜色',
  params: {
    targetColor: { name: '雾霾蓝', hex: '#91AEC3' },
    targetRegion: 'whole_garment',
    colorSource: 'system',
    preserveTexture: true,
    preserveIdentity: true,
    preserveBackground: true
  }
})
assert(colorFields.some((item) => item.label === '目标颜色' && item.value === '雾霾蓝'), '换色目标未归一')
assert(colorFields.some((item) => item.label === '目标色值' && item.value === '#91AEC3'), '换色色值未保留')
assert(!JSON.stringify(colorFields).includes('whole_garment'), '页面泄露英文换色区域')

const redesignFields = buildWorkChangeFields({
  workType: 'style_redesign',
  typeLabel: '改款式',
  params: {
    changeTargets: ['neckline', 'sleeve'],
    targetDirections: { neckline: 'v_neck', sleeve: 'puff_sleeve' },
    changeIntensity: 'micro_adjust',
    preserveItems: ['color', 'fabric', 'background_composition'],
    additionalRequirements: '保留金属链条和原有装饰'
  }
})
assert(redesignFields.some((item) => /领口 → V领/.test(item.value)), '改款部位方向未中文化')
assert(redesignFields.some((item) => item.label === '补充要求' && /金属链条/.test(item.value)), '补充要求未读取真实参数')

const garmentFields = buildWorkChangeFields({
  workType: 'clothes_replace',
  typeLabel: 'AI换衣服',
  inputAssetSummary: { hasTopGarment: true, hasBottomGarment: true },
  params: { garmentMode: 'separate', preserveFace: true, preservePose: true, preserveBackground: true }
})
assert(garmentFields.some((item) => item.label === '上装参考' && item.value === '已上传'), '上装参考摘要缺失')
assert(garmentFields.some((item) => item.label === '下装参考' && item.value === '已上传'), '下装参考摘要缺失')

const historicalFields = buildWorkChangeFields({ workType: 'legacy_unknown', typeLabel: '历史作品', params: {} })
assert(historicalFields.some((item) => item.value === '未记录'), '历史缺失字段未显示未记录')

const scheme = buildSchemeFields({ schemeName: '方案二', changeSummary: '袖型更轻盈' }, 1)
assert(scheme.some((item) => item.value === '方案二') && scheme.some((item) => item.value === '袖型更轻盈'), '独立方案特点未读取')

const generation = buildGenerationInfo({ statusLabel: '已完成', taskId: 'task_test', provider: 'provider_test', expectedOutputCount: 2, completedOutputCount: 2 })
assert(generation.some((item) => item.label === '任务信息'), '折叠生成信息缺少任务字段')

const template = read('pages/gallery-detail/gallery-detail.vue')
const order = ['生成结果', '前后图对比', '本次更改要求', '生成信息', '作品操作'].map((label) => template.indexOf(label))
assert(order.every((index) => index >= 0) && order.every((index, i) => i === 0 || index > order[i - 1]), '作品详情区域顺序不正确')
assert(/activeResultIndex/.test(template) && /selectResult\(index\)/.test(template), '多结果切换未联动当前结果')
assert(!/\{\{\s*work\.params\s*\}\}/.test(template), '页面直接渲染了原始参数')

console.log('WORK_DETAIL_DISPLAY_SMOKE_OK order=result>compare>requirements>info>actions multi=linked history=safe')
