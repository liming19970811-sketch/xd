const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const reportPath = path.join(root, 'docs', 'security-baseline-audit-v1.md')

function readFile(relativePath) {
  const fullPath = path.join(root, relativePath)
  try {
    return fs.readFileSync(fullPath, 'utf8')
  } catch (error) {
    return ''
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function has(relativePath, pattern) {
  return pattern.test(readFile(relativePath))
}

function statusIcon(status) {
  return {
    pass: 'PASS',
    warn: 'WARN',
    fail: 'FAIL',
    manual: 'MANUAL'
  }[status] || status.toUpperCase()
}

function table(rows) {
  return rows.join('\n')
}

function addCheck(checks, item) {
  checks.push({
    id: item.id,
    area: item.area,
    status: item.status,
    evidence: item.evidence,
    files: item.files || []
  })
}

function addFinding(findings, item) {
  findings.push({
    id: item.id,
    risk: item.risk,
    title: item.title,
    impact: item.impact,
    reproduce: item.reproduce,
    rootCause: item.rootCause,
    files: item.files || [],
    fix: item.fix,
    regression: item.regression,
    releaseBlocker: Boolean(item.releaseBlocker)
  })
}

const files = {
  enterpriseWebGuard: 'utils/enterprise-web/enterpriseWebGuard.js',
  tenantGuard: 'utils/tenant/tenantGuard.js',
  tenantContext: 'utils/tenant/tenantContext.js',
  unifiedUpload: 'utils/upload/unifiedUploadService.js',
  fileRepository: 'utils/upload/fileRepository.js',
  enterpriseAuth: 'cloudfunctions/enterprise_auth/index.js',
  enterpriseWebLogin: 'cloudfunctions/enterprise_web_login/core.js',
  enterpriseApi: 'cloudfunctions/enterprise_api/index.js',
  enterpriseData: 'cloudfunctions/enterprise_data/index.js',
  quotaGuard: 'cloudfunctions/quota_guard/index.js',
  workspaceAssetCenter: 'utils/workspace/workspaceAssetCenter.js',
  modelOpsCenter: 'utils/workspace/workspaceModelOperationsCenter.js',
  runtimeMonitor: 'utils/website/runtimeMonitor.js'
}

const checks = []
const findings = []

addCheck(checks, {
  id: 'AUTH-001',
  area: '身份认证',
  status: has(files.enterpriseWebGuard, /requireAuthenticatedUser/) && has(files.enterpriseWebGuard, /requireActiveMember/) ? 'pass' : 'fail',
  evidence: '企业网页版守卫包含登录态、企业选择、成员状态和权限检查。',
  files: [files.enterpriseWebGuard]
})

addCheck(checks, {
  id: 'AUTH-002',
  area: 'Session 安全',
  status: has(files.enterpriseAuth, /sessionTokenHash/) && has(files.enterpriseAuth, /requireValidSession/) ? 'pass' : 'fail',
  evidence: 'enterprise_auth 使用 sessionTokenHash 查询 Session，并通过 requireValidSession 恢复身份。',
  files: [files.enterpriseAuth]
})

addCheck(checks, {
  id: 'AUTH-003',
  area: '扫码登录',
  status: has(files.enterpriseWebLogin, /ticketHash/) && has(files.enterpriseWebLogin, /sessionTokenHash/) && has(files.enterpriseWebLogin, /getWXContext\(\)\.OPENID|getIdentity\(wxContext/) ? 'pass' : 'fail',
  evidence: '小程序确认链路以云端 wxContext 身份创建用户，ticket 和 session 均按哈希保存。',
  files: [files.enterpriseWebLogin]
})

addCheck(checks, {
  id: 'TENANT-001',
  area: '租户隔离',
  status: has(files.enterpriseWebGuard, /canAccessTenantRecord/) && has(files.enterpriseWebGuard, /canAccessProject/) ? 'pass' : 'fail',
  evidence: '企业网页提供资源级租户校验方法。',
  files: [files.enterpriseWebGuard]
})

addCheck(checks, {
  id: 'TENANT-002',
  area: '租户隔离',
  status: has(files.tenantGuard, /record\?\.enterpriseId \|\| DEFAULT_ENTERPRISE_ID/) ? 'warn' : 'pass',
  evidence: 'tenantGuard 对缺失 enterpriseId 的历史记录默认归入 DEFAULT_ENTERPRISE_ID，真实上线前需人工迁移或隔离。',
  files: [files.tenantGuard]
})

addFinding(findings, {
  id: 'SEC-P1-001',
  risk: 'P1',
  title: '缺失 enterpriseId 的历史记录可能被默认企业读取',
  impact: '如果生产中存在旧项目、任务、资产或交付记录缺失 enterpriseId，默认企业上下文可能读到不应自动归属的数据。',
  reproduce: '构造一条缺失 enterpriseId 的旧业务记录，使用默认企业登录后调用列表筛选，观察记录是否被 normalize 到默认企业。',
  rootCause: 'utils/tenant/tenantGuard.js 将缺失 enterpriseId 的记录归一化为 DEFAULT_ENTERPRISE_ID。',
  files: [files.tenantGuard],
  fix: '迁移前把缺失 enterpriseId 的记录进入人工处理清单；数据层默认拒绝缺失 enterpriseId 的私有记录，只有明确 legacy 白名单可读。',
  regression: '新增缺失 enterpriseId 记录读取测试、跨企业读取测试、legacy 手工清单测试。',
  releaseBlocker: true
})

addCheck(checks, {
  id: 'FILE-001',
  area: '文件安全',
  status: has(files.unifiedUpload, /BLOCKED_EXTENSIONS/) && has(files.unifiedUpload, /validateUploadFiles/) ? 'pass' : 'fail',
  evidence: '统一上传服务包含文件类型、大小、数量和危险扩展名校验。',
  files: [files.unifiedUpload]
})

addCheck(checks, {
  id: 'FILE-002',
  area: '文件安全',
  status: has(files.unifiedUpload, /getTempFileURL|getTempFileURL/) && !has(files.unifiedUpload, /getFileRecord\(fileId\)|assertFileAccess|canAccessFile/) ? 'fail' : 'pass',
  evidence: '生成临时 URL 前未看到基于 fileId 的文件记录归属和项目权限校验。',
  files: [files.unifiedUpload, files.fileRepository]
})

addFinding(findings, {
  id: 'SEC-P1-002',
  risk: 'P1',
  title: '私有文件临时链接生成缺少资源归属校验',
  impact: '如果调用方能传入他人 cloud fileID，当前临时链接生成路径可能直接请求云存储临时 URL，存在文件横向越权风险。',
  reproduce: '用户 A 上传私有文件得到 fileId；用户 B 在 H5 或调试入口调用 getTemporaryFileUrl(fileId)，观察是否返回可访问临时 URL。',
  rootCause: 'utils/upload/unifiedUploadService.js 的 getTemporaryFileUrl 只校验 fileId 形态，未先查询 fileRepository 并验证 ownerId、enterpriseId、projectId 权限。',
  files: [files.unifiedUpload, files.fileRepository],
  fix: '在统一上传服务增加 assertFileAccess(fileId, action)，读取文件记录并按 ownerId/currentEnterpriseId/project membership 校验后才生成临时 URL。',
  regression: '覆盖他人 fileId、他企业 fileId、过期/归档/隔离文件、合法项目成员下载四类测试。',
  releaseBlocker: true
})

addCheck(checks, {
  id: 'FILE-003',
  area: '文件安全',
  status: has(files.unifiedUpload, /temporary_https_input/) ? 'warn' : 'pass',
  evidence: 'getTemporaryFileUrl 接受外部 https 输入并原样返回，需确保生产 AI 调用只使用稳定 fileId。',
  files: [files.unifiedUpload]
})

addFinding(findings, {
  id: 'SEC-P2-001',
  risk: 'P2',
  title: 'AI 文件地址转换允许外部 HTTPS 直通',
  impact: '外部 URL 可能绕过私有文件治理、审计与短期授权策略；也可能把不可控地址传给 AI 供应商。',
  reproduce: '调用 resolveAiProviderImageUrl("https://example.com/a.jpg")，观察返回 providerImageUrl 为原始地址。',
  rootCause: '为了兼容旧链路，getTemporaryFileUrl 对 HTTPS 输入返回 warning 而非拒绝。',
  files: [files.unifiedUpload],
  fix: '生产环境要求 AI 供应商输入必须来自 fileId 或经过 allowlist 的公开素材；外部 URL 进入 quarantine 或人工确认。',
  regression: '覆盖 http://tmp、wxfile://、任意 https、合法 cloud fileID 四种输入。',
  releaseBlocker: false
})

addCheck(checks, {
  id: 'FILE-004',
  area: '文件安全',
  status: has(files.fileRepository, /export function getFileRecord\(fileId[\s\S]*?listFileRecords\(\)\.find/) ? 'fail' : 'pass',
  evidence: 'fileRepository 的 getFileRecord 当前基于无过滤 listFileRecords() 查找，未默认按当前租户过滤。',
  files: [files.fileRepository]
})

addFinding(findings, {
  id: 'SEC-P1-003',
  risk: 'P1',
  title: '文件记录读取默认不按当前租户过滤',
  impact: '本地/H5 数据层若被页面或工具直接调用，可能根据 fileId 读取其他用户或企业的文件元数据。',
  reproduce: '准备两个企业的 fileRecords，调用 getFileRecord(其他企业 fileId)，观察是否返回文件名、storagePath 或状态。',
  rootCause: 'utils/upload/fileRepository.js 的 getFileRecord 基于全量 listFileRecords() 查找；listFileRecords 无过滤条件时返回全部本地记录。',
  files: [files.fileRepository],
  fix: '新增 getFileRecordForCurrentTenant 或在 getFileRecord 默认执行当前 owner/enterprise/project 权限过滤；下载、删除、临时 URL 全部复用。',
  regression: '覆盖文件元数据不可枚举、他企业 fileId 返回 forbidden 而非泄露存在性。',
  releaseBlocker: true
})

addCheck(checks, {
  id: 'RBAC-001',
  area: '纵向越权',
  status: has(files.enterpriseWebGuard, /requirePermission/) && has('utils/permission/permissionCatalog.js', /member\.manage/) ? 'pass' : 'fail',
  evidence: '权限目录与企业网页 requirePermission 已存在。',
  files: [files.enterpriseWebGuard, 'utils/permission/permissionCatalog.js']
})

addCheck(checks, {
  id: 'API-001',
  area: '接口安全',
  status: has(files.enterpriseApi, /secretHash/) && has(files.enterpriseApi, /plainTextKey/) ? 'pass' : 'fail',
  evidence: '企业 API 密钥使用 secretHash 存储，明文 key 仅创建时返回。',
  files: [files.enterpriseApi]
})

addCheck(checks, {
  id: 'API-002',
  area: '接口安全',
  status: has(files.enterpriseApi, /idempotencyKey/) && has(files.quotaGuard, /missing_idempotency_key/) ? 'pass' : 'fail',
  evidence: 'API 与 quota_guard 存在幂等键要求。',
  files: [files.enterpriseApi, files.quotaGuard]
})

addCheck(checks, {
  id: 'QUOTA-001',
  area: '额度红线',
  status: has(files.quotaGuard, /P0 placeholder/) ? 'fail' : 'pass',
  evidence: 'quota_guard 文件内仍标注真实上线需按 OPENID/userId 查询会员的 P0 placeholder。',
  files: [files.quotaGuard]
})

addFinding(findings, {
  id: 'SEC-P0-001',
  risk: 'P0',
  title: 'quota_guard 真实上线仍存在 P0 占位',
  impact: '真实扣费/额度启用前，如果会员档位、身份和企业额度没有由服务端权威解析，可能造成越权消费、错误扣费或额度绕过。',
  reproduce: '开启真实 quota guard 前，审查 getServerResolvedTier 与身份解析；尝试伪造 event.userId/openid 或 membershipTier 验证服务端是否完全忽略前端字段。',
  rootCause: 'cloudfunctions/quota_guard/index.js 明确保留 P0 placeholder 注释，并存在 mock/default usage 路径。',
  files: [files.quotaGuard],
  fix: '在启用 ENABLE_REAL_QUOTA_GUARD 前完成服务端会员/企业额度权威查询、幂等消费、终态回滚锁定和跨企业测试。',
  regression: '并发扣费、同幂等键重复消费、回滚二次执行、伪造身份、mock/fallback 进入正式审核专项测试。',
  releaseBlocker: true
})

addCheck(checks, {
  id: 'DELIVERY-001',
  area: '交付红线',
  status: has(files.workspaceAssetCenter, /mock|fallback/) && has(files.modelOpsCenter, /formalReviewRisk/) ? 'pass' : 'warn',
  evidence: '工作台资产/模型监控层包含 mock/fallback 正式审核风险识别文案或逻辑。',
  files: [files.workspaceAssetCenter, files.modelOpsCenter]
})

addCheck(checks, {
  id: 'LOG-001',
  area: '日志脱敏',
  status: has(files.runtimeMonitor, /\\[email\\]/) && has(files.runtimeMonitor, /\\[phone\\]/) && has(files.runtimeMonitor, /redacted/) ? 'pass' : 'warn',
  evidence: '网站运行监控有基础脱敏工具。',
  files: [files.runtimeMonitor]
})

addCheck(checks, {
  id: 'FRONTEND-001',
  area: '前端安全',
  status: has('scripts/h5-preflight.js', /localhost|sensitive|mock|secret|apiKey/i) ? 'pass' : 'warn',
  evidence: 'H5 发布前检查脚本存在开发接口、mock 和敏感字段扫描。',
  files: ['scripts/h5-preflight.js']
})

addCheck(checks, {
  id: 'ALERT-001',
  area: '安全告警',
  status: exists('utils/observability/observabilityCenter.js') || exists('utils/admin/errorCenter.js') ? 'pass' : 'warn',
  evidence: '仓库存在错误/观测中心模块基础；仍需真实运行环境告警联动验证。',
  files: ['utils/observability/observabilityCenter.js', 'utils/admin/errorCenter.js'].filter(exists)
})

const passCount = checks.filter((item) => item.status === 'pass').length
const warnCount = checks.filter((item) => item.status === 'warn').length
const failCount = checks.filter((item) => item.status === 'fail').length
const blockerCount = findings.filter((item) => item.releaseBlocker).length
const generatedAt = new Date().toISOString()

const report = `# 系统安全基线与越权专项检查 V1

生成时间：${generatedAt}

检查范围：网站 H5、微信小程序相关共享前端模块、企业网页守卫、关键云函数入口、文件上传与临时链接、额度与交付红线、日志脱敏与告警基础。

本报告为代码静态专项审计结果，不等同于真实线上渗透测试。P0/P1 项未清零前，不建议正式扩大灰度或生产上线。

## 汇总

| 项目 | 数量 |
| --- | ---: |
| 通过 | ${passCount} |
| 警告 | ${warnCount} |
| 失败 | ${failCount} |
| 发布阻断项 | ${blockerCount} |

发布建议：${blockerCount > 0 ? '暂停生产发布，先处理 P0/P1 阻断项。' : '可进入下一轮人工真实环境验收。'}

## 自动检查项

| ID | 范围 | 结果 | 证据 | 文件 |
| --- | --- | --- | --- | --- |
${checks.map((item) => `| ${item.id} | ${item.area} | ${statusIcon(item.status)} | ${item.evidence} | ${item.files.join('<br>')} |`).join('\n')}

## 安全发现

${findings.map((item) => `### ${item.id}｜${item.risk}｜${item.title}

- 影响范围：${item.impact}
- 复现步骤：${item.reproduce}
- 根因：${item.rootCause}
- 修改文件：${item.files.join('、')}
- 修复方案：${item.fix}
- 回归测试：${item.regression}
- 是否阻断发布：${item.releaseBlocker ? '是' : '否'}
`).join('\n')}

## 横向越权测试矩阵

| 参数 | 当前检查结论 | 下一步真实环境验证 |
| --- | --- | --- |
| userId | 服务端 session 路径已存在，但仍需逐接口验证不信任前端 userId。 | 用用户 A 登录后传用户 B 的 userId，接口应返回 forbidden/authentication_required。 |
| enterpriseId | 企业网页守卫与云函数多处使用 session enterpriseId；legacy 缺失 enterpriseId 是阻断风险。 | 构造其他企业 enterpriseId，确认不返回名称、数量、缩略图或存在性。 |
| projectId | 项目守卫存在 canAccessProject。 | 逐个 H5 详情页和云函数 action 传其他企业 projectId。 |
| taskId | 任务链路需结合 taskLayer/result/gallery 做动态验证。 | 尝试访问他人 taskId 的结果、审核和交付入口。 |
| batchId | 批次模块有本地聚合，需真实接口逐项验证。 | 尝试读取其他企业 batchId 和批量交付清单。 |
| assetId | 文件与资产中心是本轮重点阻断项。 | 他企业 assetId/fileId 不得返回元数据或临时 URL。 |
| patternId | 版型库有权限模型，但需云端接口真实验证。 | 他企业版型详情、版本、下载、训练候选集均应 forbidden。 |
| deliveryId | 交付接口存在 session transport，需验证下载授权。 | 修改 deliveryId 下载正式交付文件，应拒绝且写安全告警。 |
| ticketId | 扫码登录 ticket 使用 hash 与 TTL。 | 重放 consumed/expired/cancelled ticket，均不得签发新 session。 |

## 纵向越权测试矩阵

| 角色 | 应拒绝行为 | 当前结论 |
| --- | --- | --- |
| 普通用户 | 企业管理、成员邀请、角色编辑 | 需真实账号回归。 |
| 企业管理员 | 平台后台 /admin、模型激活、全局额度配置 | 需服务端平台管理员权限回归。 |
| 审核员 | 修改额度、激活模型 | 需接口级权限回归。 |
| 客服 | 激活模型、直接改余额 | 需后台接口回归。 |
| 设计师 | 批准正式交付 | 需 delivery.manage 权限回归。 |
| 版师 | 读取其他企业版型 | 需 enterpriseId 隔离回归。 |
| 只读成员 | 任意写操作 | permissionService 已有基础，需逐写接口回归。 |

## 文件安全检查

- 已具备：统一上传校验、危险扩展名阻断、云存储 fileID、临时 URL 生成、下载审计记录。
- 阻断项：临时 URL 生成与 fileRepository 默认读取缺少当前用户/企业/项目授权闭环。
- 验收建议：上线前必须完成他人 fileId、他企业 fileId、归档/隔离文件、过期下载链接、伪造 MIME、超大文件、批量上传绕过七类测试。

## 额度与交付红线

- 已具备：quota_guard 幂等键、回滚记录、终态回滚限制基础；工作台侧有 mock/fallback 交付风险提示。
- 阻断项：真实 quota guard 仍有 P0 placeholder，未开启真实扣点前不能声称额度安全闭环完成。
- 验收建议：并发重复扣费、相同 idempotencyKey、已回滚再回滚、终态修改、mock/fallback 审核、未审核交付必须作为发布阻断测试。

## 敏感信息

- API Key、Session Token、OPENID、完整手机号/邮箱、私有图片完整 URL 不应进入日志或前端构建产物。
- 本轮静态扫描未修改任何密钥配置。仍需在生产构建产物中执行独立敏感信息扫描。

## 回归清单

1. 未登录访问所有私有接口，应返回 authentication_required。
2. session_expired/session_invalid 后清理本地 session 并跳登录。
3. 伪造 userId、enterpriseId、role 不应改变服务端授权结果。
4. 连续越权访问和资源枚举应产生安全告警。
5. 私有 fileId 生成临时 URL 前必须校验资源归属。
6. mock/fallback/空结果/未完成结果不得进入正式审核或交付。
7. 所有额度变动必须有不可变记录和幂等键。
8. 平台后台只允许平台管理员访问。
9. 高风险管理操作必须有审计记录。

## 未覆盖

- 未连接真实 CloudBase 生产环境进行动态攻击测试。
- 未执行 HBuilderX 小程序真实编译后的包体/运行验证。
- 未对所有云函数 action 做逐接口 fuzz。
- 未验证真实下载 URL 过期策略和云存储权限规则。
`

fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, report, 'utf8')

console.log('[security-baseline-audit]', {
  generatedAt,
  reportPath: path.relative(root, reportPath),
  passCount,
  warnCount,
  failCount,
  blockerCount,
  releaseRecommendation: blockerCount > 0 ? 'pause_release' : 'manual_acceptance'
})
