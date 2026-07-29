const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const pagesJson = JSON.parse(read('pages.json').replace(/^\s*\/\/.*$/gm, ''))
const gallery = read('pages/gallery/gallery.vue')
const detailPage = read('pages/work-detail/work-detail.vue')
const detailView = read('pages/gallery-detail/gallery-detail.vue')

const registeredPages = (pagesJson.pages || []).map((item) => item.path)
const tabPages = new Set((((pagesJson.tabBar || {}).list) || []).map((item) => item.pagePath))

assert(registeredPages.includes('pages/work-detail/work-detail'), '作品详情页未注册')
assert(!tabPages.has('pages/work-detail/work-detail'), '作品详情不能是 tabBar 页面')
assert(/uni\.navigateTo\(\{[\s\S]*?\/pages\/work-detail\/work-detail\?workId=/.test(gallery), '作品列表未使用 navigateTo 打开详情')
assert(!/selectedWork/.test(gallery), '作品列表仍以内嵌状态替换详情')
assert(!/(redirectTo|reLaunch|switchTab)\(\{[^}]*work-detail/.test(gallery), '详情入口使用了错误跳转方式')
assert(/backToWorks\(\)/.test(detailPage), '缺少 backToWorks')
assert(/pages\.length > 1/.test(detailPage) && /uni\.navigateBack/.test(detailPage), '多层页面栈未优先 navigateBack')
assert(/uni\.switchTab\([\s\S]*?\/pages\/gallery\/gallery/.test(detailPage), '单层页面栈未兜底返回作品 Tab')
assert(/EDGE_START_PX\s*=\s*28/.test(detailPage), '左边缘手势起点阈值缺失')
assert(/SWIPE_DISTANCE_PX\s*=\s*82/.test(detailPage) && /SWIPE_VELOCITY_PX_MS/.test(detailPage), '侧滑距离或速度阈值缺失')
assert(/this\.previewing/.test(detailPage), '图片预览期间未保护返回手势')
assert(/activeStatus:[\s\S]*activeCategory:[\s\S]*keyword:[\s\S]*sort:[\s\S]*page:[\s\S]*scrollTop:/.test(gallery), '列表状态快照字段不完整')
assert(/← 返回我的作品/.test(detailView), '详情顶部返回文案不正确')
assert(/min-height:\s*88rpx/.test(detailView), '详情返回栏点击高度不足')

console.log('WORK_DETAIL_NAVIGATION_SMOKE_OK route=navigateTo back=navigateBack|switchTab gesture=edge-right state=restored')
