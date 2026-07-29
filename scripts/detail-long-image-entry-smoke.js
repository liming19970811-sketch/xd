const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function run() {
  const capabilities = read('utils/home/homeCapabilities.js')
  const home = read('pages/index/index.vue')
  const pages = read('pages.json')
  const contract = read('utils/detail-page/detailPageContract.js')
  const renderer = read('utils/detail-page/detailPageRenderer.js')
  const task = read('utils/detail-page/detailPageTask.js')
  const page = read('package-ai/detail-long-image/detail-long-image.vue')
  const upload = read('package-ai/upload/upload.vue')
  const result = read('package-ai/result/result.vue')

  assert.ok(
    capabilities.includes("route: DETAIL_LONG_IMAGE_ROUTE") &&
      capabilities.includes("taskType: 'detail_page_long_image'"),
    '首页能力配置必须进入独立详情长图页面'
  )
  assert.ok(
    home.includes("createHomeTool('detail_long_image', { name: '商品详情页'"),
    '商品详情页卡片必须接入自动排版详情长图'
  )
  assert.ok(
    !home.includes("createHomeTool('detail_image', { name: '商品详情页'"),
    '商品详情页不得继续误跳到服装细节图'
  )
  assert.ok(pages.includes('"path": "detail-long-image/detail-long-image"'), '详情长图目标页必须已注册')
  assert.ok(
    contract.includes("DETAIL_PAGE_TASK_TYPE = 'detail_page_long_image'") &&
      contract.includes("allowGrid: false") &&
      contract.includes('confirmedByUser'),
    '详情长图必须使用独立契约并禁止宫格和未确认尺码'
  )
  assert.ok(
    renderer.includes('buildVerticalSegments') && renderer.includes('drawDetailPageSegment'),
    '详情长图必须使用纵向模板渲染器'
  )
  assert.ok(
    page.includes('AI整理结果') && page.includes('module-grid') && page.includes('确认尺码数据') && page.includes('生成详情长图'),
    '独立页面必须提供AI整理、模块确认、尺码确认和渲染流程'
  )
  assert.ok(task.includes('createDetailPageRenderTask') && task.includes("provider: 'deterministic_canvas'"), '详情长图不得调用通用图片生成provider')
  assert.ok(task.includes('persistDetailPageSegments') && task.includes('assetIds'), '详情长图结果必须先保存资产再完成任务')
  assert.ok(upload.includes("['detail_page_from_photo', 'detail_long_image', 'detail_page_long_image']"), '历史详情页深链必须转到独立模板渲染页')
  assert.ok(!result.includes("title: '自动排版详情长图'"), '结果页不得保留旧的通用AI详情长图二次生成入口')
  assert.ok(result.includes('autoPersistCompletedWorks'), '完成结果必须自动保存到作品中心')

  console.log('DETAIL_LONG_IMAGE_ENTRY_SMOKE_OK')
}

try {
  run()
} catch (error) {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
}
