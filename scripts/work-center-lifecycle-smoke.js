const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function loadCatalog() {
  const source = `${read('utils/work/workTypeCatalog.js')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\}\s*$/m, '')}
module.exports = { WORK_CATEGORIES, buildWorkTypeSource, resolveWorkType, getWorkCategoryLabel, getAvailableWorkCategories }`
  const context = { module: { exports: {} }, exports: {} }
  vm.runInNewContext(source, context, { filename: 'workTypeCatalog.js' })
  return context.module.exports
}

function loadIntegrity() {
  const source = `${read('utils/work/workResultIntegrity.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\}\s*$/m, '')}
module.exports = { pickWorkResultUrl, isStableWorkResultUrl, normalizeWorkResultItems, normalizeWorkIntegrityStatus, hasCompleteWorkResult }`
  const context = { module: { exports: {} }, exports: {}, Object, Array, Set, String, Number, Boolean, RegExp, Math }
  vm.runInNewContext(source, context, { filename: 'workResultIntegrity.js' })
  return context.module.exports
}

function loadRepository(catalog, integrity, storage) {
  const source = `${read('utils/work/workRecordRepository.js')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/workTypeCatalog['"]\s*/, 'const { getWorkCategoryLabel, resolveWorkType } = globalThis.__catalog\n')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/workResultIntegrity['"]\s*/, 'const { normalizeWorkIntegrityStatus, normalizeWorkResultItems, pickWorkResultUrl } = globalThis.__integrity\n')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\}\s*$/m, '')}
module.exports = {
  normalizeWorkStatus,
  upsertWorkRecordFromTask,
  syncWorkRecordsFromTasks,
  getWorkRecordsForCurrentUser,
  getWorkRecordByTaskId,
  moveWorkRecordToTrash,
  restoreWorkRecord
}`
  const context = {
    module: { exports: {} },
    exports: {},
    __catalog: catalog,
    __integrity: integrity,
    uni: {
      getStorageSync(key) { return storage[key] },
      setStorageSync(key, value) { storage[key] = value }
    },
    Date,
    Math,
    Object,
    Array,
    Set,
    String,
    Number,
    Boolean
  }
  vm.runInNewContext(source, context, { filename: 'workRecordRepository.js' })
  return context.module.exports
}

function task(overrides = {}) {
  return {
    taskId: 'task_scene_1',
    userId: 'user_a',
    enterpriseId: 'enterprise_a',
    taskType: 'scene_replace',
    status: 'pending',
    progress: 5,
    expectedOutputCount: 2,
    input: {
      assets: { baseImage: 'cloud://source/base.jpg' },
      params: {},
      options: { expectedOutputCount: 2 }
    },
    result: { items: [] },
    createdAt: '2026-07-28T08:00:00.000Z',
    updatedAt: '2026-07-28T08:00:00.000Z',
    ...overrides
  }
}

function run() {
  const storage = {
    diebiandesign_current_user: { userId: 'user_a', enterpriseId: 'enterprise_a' },
    diebiandesign_wechat_identity: { userId: 'user_a', enterpriseId: 'enterprise_a', openId: 'openid_a' }
  }
  const repository = loadRepository(loadCatalog(), loadIntegrity(), storage)

  const pending = repository.upsertWorkRecordFromTask(task())
  assert.strictEqual(pending.workId, 'work_task_scene_1', 'workId必须由taskId稳定生成')
  assert.strictEqual(pending.status, 'pending', '任务创建后必须立即生成等待处理作品')
  assert.strictEqual(pending.category, 'product_display', '换场景必须归入商品展示')
  assert.ok(/^换场景 · 07月28日 · 01$/.test(pending.title), '作品必须自动命名')

  const partial = repository.upsertWorkRecordFromTask(task({
    status: 'processing',
    progress: 55,
    result: { items: [{ assetId: 'asset_1', url: 'https://example.com/one.jpg' }] }
  }))
  assert.strictEqual(partial.workId, pending.workId, '更新任务不得创建第二条作品')
  assert.strictEqual(partial.status, 'partial_success', '部分结果必须立即显示')
  assert.strictEqual(partial.completedOutputCount, 1)
  assert.strictEqual(partial.expectedOutputCount, 2)

  const completed = repository.upsertWorkRecordFromTask(task({
    status: 'completed',
    progress: 100,
    completedAt: '2026-07-28T08:03:00.000Z',
    result: { items: [
      { assetId: 'asset_1', url: 'https://example.com/one.jpg' },
      { assetId: 'asset_2', url: 'https://example.com/two.jpg' }
    ] }
  }))
  assert.strictEqual(completed.status, 'completed')
  assert.strictEqual(completed.completedOutputCount, 2)
  assert.strictEqual(completed.resultUrls.length, 2, '多结果必须保持独立文件')
  assert.strictEqual(repository.getWorkRecordsForCurrentUser().length, 1, '相同taskId不得重复建作品')

  const missing = repository.upsertWorkRecordFromTask(task({
    taskId: 'task_missing_1',
    status: 'completed',
    expectedOutputCount: 1,
    completedOutputCount: 0,
    result: { items: [] }
  }))
  assert.strictEqual(missing.status, 'result_missing', 'completed 0/1必须降级为结果缺失')
  assert.strictEqual(missing.coverUrl, '', '结果缺失作品不得用输入图冒充生成封面')
  assert.strictEqual(missing.completedOutputCount, 0)

  const failed = repository.upsertWorkRecordFromTask(task({ taskId: 'task_failed_1', status: 'failed', expectedOutputCount: 1, error: { code: 'PROVIDER_FAILED', message: '生成失败', retryable: true } }))
  assert.strictEqual(failed.status, 'failed', '失败作品必须保留')
  assert.strictEqual(failed.error.retryable, true)

  storage.diebiandesign_current_user = { userId: 'user_b', enterpriseId: 'enterprise_a' }
  storage.diebiandesign_wechat_identity = { userId: 'user_b', enterpriseId: 'enterprise_a', openId: 'openid_b' }
  assert.strictEqual(repository.getWorkRecordsForCurrentUser().length, 0, '跨用户不得读取作品')

  storage.diebiandesign_current_user = { userId: 'user_a', enterpriseId: 'enterprise_b' }
  storage.diebiandesign_wechat_identity = { userId: 'user_a', enterpriseId: 'enterprise_b', openId: 'openid_a' }
  assert.strictEqual(repository.getWorkRecordsForCurrentUser().length, 0, '跨企业不得读取作品')

  storage.diebiandesign_current_user = { userId: 'user_a', enterpriseId: 'enterprise_a' }
  storage.diebiandesign_wechat_identity = { userId: 'user_a', enterpriseId: 'enterprise_a', openId: 'openid_a' }
  assert.ok(repository.moveWorkRecordToTrash('task_scene_1'), '终态作品应可进入回收站')
  assert.strictEqual(repository.getWorkRecordsForCurrentUser().some((item) => item.taskId === 'task_scene_1'), false)
  assert.ok(repository.restoreWorkRecord('task_scene_1'), '回收站作品应可恢复')
  assert.strictEqual(repository.getWorkRecordsForCurrentUser().some((item) => item.taskId === 'task_scene_1'), true)

  const gallery = read('pages/gallery/gallery.vue')
  assert.ok(gallery.includes("{ label: '生成中', value: 'generating' }"), '作品中心必须提供生成中筛选')
  assert.ok(gallery.includes('已完成 {{ work.completedOutputCount }}/{{ work.expectedOutputCount }}'), '卡片必须显示真实完成数量')
  assert.ok(gallery.includes('恢复作品'), '作品中心必须支持回收站恢复')

  const resultPage = read('package-ai/result/result.vue')
  assert.ok(resultPage.includes("return '查看我的作品'"), '结果页按钮不得承担持久化职责')
  assert.ok(resultPage.includes('生成成功后会自动收录到作品库'), '结果页必须说明自动保存')

  console.log('WORK_CENTER_LIFECYCLE_SMOKE_OK records=2 results=2 isolation=user+enterprise trash=restore')
}

try {
  run()
} catch (error) {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
}
