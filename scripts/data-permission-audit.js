const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SOURCE_ROOTS = [
  'pages',
  'package-ai',
  'package-assets',
  'package-mobile-enterprise',
  'components',
  'utils',
  'cloudfunctions'
]
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.vue', '.json'])
const IGNORED_DIRECTORIES = new Set(['node_modules', 'backup', 'unpackage', '.git'])

function toPosix(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/')
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) return
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(target, files)
      return
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(target)
  })
  return files
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length
}

function addMatch(findings, filePath, source, index, rule, severity) {
  findings.push({
    severity,
    rule,
    file: toPosix(filePath),
    line: lineNumber(source, index)
  })
}

const files = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)))
const sources = files.map((filePath) => ({
  filePath,
  file: toPosix(filePath),
  source: fs.readFileSync(filePath, 'utf8')
}))

const collectionNames = new Set()
const collectionCallSites = []
const clientDatabaseFiles = []
const cloudStorageFiles = []
const localStorageFiles = []
const cloudFunctions = []
const findings = []
const safeLogRegressions = []
const credentialLiteralRegressions = []
const databaseOperationCounts = {
  collection: 0,
  doc: 0,
  where: 0,
  add: 0,
  set: 0,
  update: 0,
  remove: 0,
  command: 0,
  transaction: 0
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

sources.forEach(({ filePath, file, source }) => {
  const literalCollectionPattern = /\.collection\(\s*['"]([^'"]+)['"]\s*\)/g
  const collectionConstantPattern = /(?:const|let|var)\s+[A-Z][A-Z0-9_]*(?:COLLECTION|COLLECTIONS)[A-Z0-9_]*\s*=\s*['"]([^'"]+)['"]/g

  ;[literalCollectionPattern, collectionConstantPattern].forEach((pattern) => {
    let match
    while ((match = pattern.exec(source))) collectionNames.add(match[1])
  })

  const collectionObjectBlockPattern = /const\s+COLLECTIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/g
  let blockMatch
  while ((blockMatch = collectionObjectBlockPattern.exec(source))) {
    const collectionObjectValuePattern = /^\s*[a-zA-Z][\w]*:\s*(?:\{\s*name:\s*)?['"]([^'"]+)['"]/gm
    let valueMatch
    while ((valueMatch = collectionObjectValuePattern.exec(blockMatch[1]))) {
      collectionNames.add(valueMatch[1])
    }
  }

  const genericCollectionPattern = /\.collection\(([^)]+)\)/g
  let collectionMatch
  while ((collectionMatch = genericCollectionPattern.exec(source))) {
    collectionCallSites.push({ file, line: lineNumber(source, collectionMatch.index) })
  }

  databaseOperationCounts.collection += countMatches(source, /\.collection\s*\(/g)
  databaseOperationCounts.doc += countMatches(source, /\.doc\s*\(/g)
  databaseOperationCounts.where += countMatches(source, /\.where\s*\(/g)
  databaseOperationCounts.add += countMatches(source, /\.add\s*\(/g)
  databaseOperationCounts.set += countMatches(source, /\.set\s*\(/g)
  databaseOperationCounts.update += countMatches(source, /\.update\s*\(/g)
  databaseOperationCounts.remove += countMatches(source, /\.remove\s*\(/g)
  databaseOperationCounts.command += countMatches(source, /(?:db\.)?command\b/g)
  databaseOperationCounts.transaction += countMatches(source, /(?:runTransaction|startTransaction|transaction\.collection)\b/g)

  if (!file.startsWith('cloudfunctions/') && /(?:wx|uni)\.cloud\.database\s*\(/.test(source)) {
    clientDatabaseFiles.push(file)
  }

  if (/(?:wx|uni)\.cloud\.(?:uploadFile|getTempFileURL|downloadFile|deleteFile)\s*\(/.test(source)) {
    cloudStorageFiles.push(file)
  }

  if (/(?:uni|wx)\.(?:getStorageSync|setStorageSync|removeStorageSync)\s*\(/.test(source)) {
    localStorageFiles.push(file)
  }

  if (file.startsWith('cloudfunctions/') && file.split('/').length === 3 && /\/index\.js$/.test(file)) {
    cloudFunctions.push({
      name: file.split('/')[1],
      usesWxContextDirectly: /getWXContext\s*\(/.test(source),
      usesSessionValidation: /(?:sessionTokenHash|requireSession\s*\()/.test(source)
    })
  }

  if (file.startsWith('cloudfunctions/') && /event\.(?:openid|openId|userId)\b/.test(source)) {
    const match = /event\.(?:openid|openId|userId)\b/.exec(source)
    addMatch(findings, filePath, source, match.index, 'cloud_function_accepts_client_identity_field', 'high')
  }

  if (!file.startsWith('cloudfunctions/') && /where\s*\(\s*\{[^}]*\b(?:openid|openId|userId)\b/s.test(source)) {
    const match = /where\s*\(\s*\{[^}]*\b(?:openid|openId|userId)\b/s.exec(source)
    addMatch(findings, filePath, source, match.index, 'client_supplied_identity_filter', 'high')
  }

  if (/onShareAppMessage/.test(source) && /(?:taskId|historyId|batchId|projectId)/.test(source)) {
    const match = /onShareAppMessage/.exec(source)
    addMatch(findings, filePath, source, match.index, 'share_route_contains_record_identifier', 'medium')
  }

  if (/console\.log\(\s*['"]\[taskLayer:prompt\]['"]\s*,/.test(source)) {
    const match = /console\.log\(\s*['"]\[taskLayer:prompt\]['"]\s*,/.exec(source)
    addMatch(findings, filePath, source, match.index, 'frontend_log_exposes_full_generation_prompt', 'high')
  }

  const knownUnsafeLogs = [
    { rule: 'log_exposes_cloud_environment_id', pattern: /console\.(?:log|info|warn|error)\([^\n]*envId=\$\{envId/ },
    { rule: 'log_exposes_lead_debug_payload', pattern: /console\.(?:log|info|warn|error)\([\s\S]{0,400}\bdebug:\s*result\s*&&\s*result\.debug/ },
    { rule: 'log_exposes_resolved_image_urls', pattern: /console\.(?:log|info|warn|error)\([^\n]*resolved image urls/ },
    { rule: 'log_exposes_cloud_file_response', pattern: /console\.(?:log|info|warn|error)\([^\n]*getTempFileURL success[^\n]*fileList/ },
    { rule: 'log_exposes_sdk_write_response', pattern: /console\.(?:log|info|warn|error)\([^\n]*(?:setResponse|addResponse)/ },
    { rule: 'log_exposes_image_source', pattern: /console\.(?:log|info|warn|error)\([\s\S]{0,240}\bsrc:\s*String\(src/ }
  ]

  knownUnsafeLogs.forEach(({ rule, pattern }) => {
    const match = pattern.exec(source)
    if (match) addMatch(safeLogRegressions, filePath, source, match.index, rule, 'low')
  })

  const credentialPatterns = [
    { rule: 'private_key_literal', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { rule: 'provider_secret_literal', pattern: /(?:sk-[A-Za-z0-9_-]{20,}|AKID[A-Za-z0-9]{12,})/ }
  ]
  credentialPatterns.forEach(({ rule, pattern }) => {
    const match = pattern.exec(source)
    if (match) addMatch(credentialLiteralRegressions, filePath, source, match.index, rule, 'critical')
  })
})

clientDatabaseFiles.forEach((file) => {
  const entry = sources.find((item) => item.file === file)
  if (!entry) return
  const match = /(?:wx|uni)\.cloud\.database\s*\(/.exec(entry.source)
  addMatch(findings, entry.filePath, entry.source, match.index, 'client_direct_cloud_database_access', 'high')
})

const report = {
  scope: SOURCE_ROOTS,
  filesScanned: files.length,
  cloudFunctions: cloudFunctions.sort((a, b) => a.name.localeCompare(b.name)),
  collectionNames: [...collectionNames].sort(),
  collectionCallSiteCount: collectionCallSites.length,
  databaseOperationCounts,
  clientDatabaseFiles: [...new Set(clientDatabaseFiles)].sort(),
  cloudStorageFiles: [...new Set(cloudStorageFiles)].sort(),
  localStorageFileCount: new Set(localStorageFiles).size,
  securityRelevantLocalStorageFiles: [...new Set(localStorageFiles)]
    .filter((file) => /(?:auth|user|member|task|work|workspace|asset|order|project|settings)/.test(file))
    .sort(),
  findings: findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  safeLogRegressions,
  credentialLiteralRegressions,
  databaseRuleFilesPresent: fs.existsSync(path.join(ROOT, 'database.rules.json')) ||
    fs.existsSync(path.join(ROOT, 'database.rules')) ||
    fs.existsSync(path.join(ROOT, 'cloudbase.rules.json'))
}

console.log(JSON.stringify(report, null, 2))

if (safeLogRegressions.length > 0 || credentialLiteralRegressions.length > 0) {
  process.exitCode = 1
}
