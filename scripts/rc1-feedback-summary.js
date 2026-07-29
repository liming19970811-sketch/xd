const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const FEEDBACK_ROOT = path.join(ROOT, 'docs', 'rc1-feedback')
const OUTPUT = path.join(ROOT, 'docs', 'rc1-feedback-summary.md')
const ALLOWED_SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3', '待分级'])
const ALLOWED_CATEGORIES = new Set(['code', 'config', 'cloud_environment', 'device_compatibility', 'unknown'])
const ALLOWED_STATUSES = new Set(['new', 'triaged', 'fixing', 'ready_for_retest', 'verified', 'closed', 'deferred'])

function field(source, label) {
  const match = source.match(new RegExp(`^${label}：\\s*(.+)$`, 'm'))
  return match ? match[1].trim() : ''
}

function sanitizeCell(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim()
}

function readFeedback() {
  if (!fs.existsSync(FEEDBACK_ROOT)) return []
  return fs.readdirSync(FEEDBACK_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^RC1-[A-Za-z0-9_-]+\.md$/i.test(entry.name))
    .map((entry) => {
      const file = path.join(FEEDBACK_ROOT, entry.name)
      const source = fs.readFileSync(file, 'utf8')
      const item = {
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        id: field(source, '问题编号') || path.basename(entry.name, '.md'),
        version: field(source, 'RC1版本') || '未填写',
        page: field(source, '问题页面') || '未填写',
        feature: field(source, '功能名称') || '未填写',
        category: field(source, '问题分类') || 'unknown',
        severity: field(source, '严重等级') || '待分级',
        status: field(source, '回归状态') || 'new'
      }
      item.valid = ALLOWED_SEVERITIES.has(item.severity) && ALLOWED_CATEGORIES.has(item.category) && ALLOWED_STATUSES.has(item.status)
      return item
    })
}

function main() {
  const items = readFeedback()
  const counts = ['P0', 'P1', 'P2', 'P3', '待分级'].reduce((result, severity) => {
    result[severity] = items.filter((item) => item.severity === severity).length
    return result
  }, {})
  const unresolved = items.filter((item) => !['verified', 'closed'].includes(item.status))
  const invalid = items.filter((item) => !item.valid)
  const releaseBlockedByFeedback = counts.P0 > 0 || counts.P1 > 0 || invalid.length > 0

  const lines = [
    '# 蝶变小程序 RC1 体验反馈汇总',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '## 重要说明',
    '',
    '- 本表只统计已提交到 `docs/rc1-feedback/` 的反馈，不能代表未执行用例已经通过。',
    '- 即使当前收集到的 P0/P1 为 0，只要 RC1 前置报告、权限、构建或真机验收仍为 BLOCKED/NOT RUN，整体发布结论仍是 BLOCKED。',
    '- 当前辅助发布基线至少有 P0=3；指定缺陷报告缺失，因此 P1 是否为 0 仍为 UNKNOWN。',
    '',
    '## 计数',
    '',
    `- 已提交反馈：${items.length}`,
    `- P0=${counts.P0} / P1=${counts.P1} / P2=${counts.P2} / P3=${counts.P3} / 待分级=${counts['待分级']}`,
    `- 未关闭反馈：${unresolved.length}`,
    `- 字段不合规：${invalid.length}`,
    `- 反馈维度准入：${releaseBlockedByFeedback ? 'BLOCKED' : 'NO P0/P1 IN COLLECTED FEEDBACK'}`,
    '- RC1 整体准入：BLOCKED（沿用 RC1 预检结论，需完成构建、权限和真机复验）。',
    '',
    '## 问题列表',
    '',
    '| 编号 | 等级 | 分类 | 页面 | 功能 | 状态 | 文件 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...(items.length
      ? items.map((item) => `| ${sanitizeCell(item.id)} | ${sanitizeCell(item.severity)} | ${sanitizeCell(item.category)} | ${sanitizeCell(item.page)} | ${sanitizeCell(item.feature)} | ${sanitizeCell(item.status)} | \`${item.file}\` |`)
      : ['| - | - | - | - | - | - | 暂无已提交反馈 |']),
    '',
    '## 回归入口',
    '',
    '- 测试清单：`docs/rc1-tester-checklist.md`',
    '- 反馈模板：`docs/rc1-feedback-template.md`',
    '- 分级与归因：`docs/rc1-defect-severity.md`',
    '- RC1 准入报告：`docs/miniapp-rc1-preflight-report.md`',
    '- RC1 回归基线：`docs/miniapp-rc1-regression-checklist.md`',
    ''
  ]
  fs.writeFileSync(OUTPUT, `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
  if (invalid.length || counts.P0 || counts.P1) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`[rc1-feedback-summary] ${error && error.message ? error.message : 'unknown_error'}`)
  process.exitCode = 1
}
