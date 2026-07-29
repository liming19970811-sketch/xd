const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { ROOT, getConfig, resolveDeployEnv } = require('./h5-env')

const BUILD_DIR = path.join(ROOT, 'unpackage', 'dist', 'build', 'web')
const TEXT_EXT = new Set(['.html', '.js', '.css', '.json', '.xml', '.txt', '.map'])
const REQUIRED_BY_ENV = {
  staging: [
    'DIEBIAN_SITE_DOMAIN',
    'DIEBIAN_API_BASE',
    'DIEBIAN_CLOUDBASE_ENV_ID',
    'DIEBIAN_FILE_DOMAIN',
    'DIEBIAN_LOGIN_CALLBACK_URL',
    'DIEBIAN_LOG_ENV'
  ],
  production: [
    'DIEBIAN_SITE_DOMAIN',
    'DIEBIAN_API_BASE',
    'DIEBIAN_CLOUDBASE_ENV_ID',
    'DIEBIAN_FILE_DOMAIN',
    'DIEBIAN_LOGIN_CALLBACK_URL',
    'DIEBIAN_LOG_ENV'
  ]
}

const SECRET_PATTERNS = [
  { code: 'dashscope_api_key', pattern: /sk-[A-Za-z0-9]{16,}/ },
  { code: 'cloud_secret_id', pattern: /AKID[A-Za-z0-9]{16,}/ },
  { code: 'private_key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i },
  { code: 'bearer_token', pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/i },
  { code: 'literal_secret_field', pattern: /(secretKey|apiSecret|DASHSCOPE_API_KEY|AI_API_KEY)\s*[:=]\s*['"][^'"]{8,}/i }
]

const DEV_ENDPOINT_PATTERNS = [
  { code: 'localhost_endpoint', pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/i },
  { code: 'mock_api_endpoint', pattern: /(?:server\/mock-api|serve:mock-api|mock-api)/i },
  { code: 'tmp_image_endpoint', pattern: /https?:\/\/tmp\//i }
]

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, files)
      return
    }
    files.push(full)
  })
  return files
}

function isTrue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function isFalse(value) {
  return ['0', 'false', 'no', 'off', ''].includes(String(value || '').trim().toLowerCase())
}

function isHttps(value) {
  return /^https:\/\//i.test(String(value || '').trim())
}

function pushFinding(findings, code, message, file) {
  findings.push({ code, message, file })
}

function validateEnv(config, findings) {
  const deployEnv = config.DIEBIAN_DEPLOY_ENV
  const required = REQUIRED_BY_ENV[deployEnv] || []
  required.forEach((key) => {
    if (!String(config[key] || '').trim()) {
      pushFinding(findings, 'missing_env', `${key} is required for ${deployEnv}`)
    }
  })

  if (deployEnv === 'production') {
    if (config.DIEBIAN_SITE_DOMAIN !== 'https://www.diebiandesign.com') {
      pushFinding(findings, 'production_domain_invalid', 'DIEBIAN_SITE_DOMAIN must be https://www.diebiandesign.com')
    }
    ;['DIEBIAN_API_BASE', 'DIEBIAN_FILE_DOMAIN', 'DIEBIAN_LOGIN_CALLBACK_URL'].forEach((key) => {
      if (!isHttps(config[key])) pushFinding(findings, 'https_required', `${key} must use HTTPS in production`)
    })
    if (String(config.DIEBIAN_LOG_ENV || '').trim() !== 'production') {
      pushFinding(findings, 'log_env_invalid', 'DIEBIAN_LOG_ENV must be production')
    }
    if (!isFalse(config.DIEBIAN_ENABLE_MOCK)) {
      pushFinding(findings, 'mock_enabled', 'DIEBIAN_ENABLE_MOCK must be false in production')
    }
    if (!isFalse(config.DIEBIAN_ENABLE_DEV_API)) {
      pushFinding(findings, 'dev_api_enabled', 'DIEBIAN_ENABLE_DEV_API must be false in production')
    }
  }

  if (deployEnv === 'staging') {
    ;['DIEBIAN_SITE_DOMAIN', 'DIEBIAN_API_BASE', 'DIEBIAN_FILE_DOMAIN', 'DIEBIAN_LOGIN_CALLBACK_URL'].forEach((key) => {
      if (config[key] && !isHttps(config[key])) pushFinding(findings, 'https_required', `${key} must use HTTPS in staging`)
    })
  }

  if (deployEnv !== 'development' && isTrue(config.DIEBIAN_ENABLE_MOCK)) {
    pushFinding(findings, 'mock_enabled', 'DIEBIAN_ENABLE_MOCK must not be true outside development')
  }
}

function validateBuild(findings) {
  const indexFile = path.join(BUILD_DIR, 'index.html')
  if (!fs.existsSync(indexFile)) {
    pushFinding(findings, 'build_missing', 'H5 build artifact is missing: unpackage/dist/build/web/index.html')
    return
  }

  walk(BUILD_DIR).forEach((file) => {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) return
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf8')
    SECRET_PATTERNS.forEach((rule) => {
      if (rule.pattern.test(text)) pushFinding(findings, rule.code, `Sensitive pattern found in ${rel}`, rel)
    })
    DEV_ENDPOINT_PATTERNS.forEach((rule) => {
      if (rule.pattern.test(text)) pushFinding(findings, rule.code, `Development endpoint found in ${rel}`, rel)
    })
  })
}

function runReleaseAudit(findings) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'website-release-audit.js')], {
    cwd: ROOT,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    pushFinding(findings, 'release_audit_failed', 'website-release-audit.js failed')
  }
}

function main() {
  const deployEnv = resolveDeployEnv()
  const config = getConfig(deployEnv)
  const findings = []
  validateEnv(config, findings)
  validateBuild(findings)
  runReleaseAudit(findings)

  const summary = {
    env: config.DIEBIAN_DEPLOY_ENV,
    buildDir: path.relative(ROOT, BUILD_DIR).replace(/\\/g, '/'),
    siteDomain: config.DIEBIAN_SITE_DOMAIN || '',
    cloudbaseEnvConfigured: Boolean(config.DIEBIAN_CLOUDBASE_ENV_ID),
    apiBaseConfigured: Boolean(config.DIEBIAN_API_BASE),
    fileDomainConfigured: Boolean(config.DIEBIAN_FILE_DOMAIN),
    loginCallbackConfigured: Boolean(config.DIEBIAN_LOGIN_CALLBACK_URL),
    findingCount: findings.length
  }

  console.log('[h5:preflight] summary')
  console.log(JSON.stringify(summary, null, 2))

  if (findings.length) {
    console.error('[h5:preflight] blocked')
    findings.forEach((item) => {
      console.error(`- ${item.code}: ${item.message}`)
    })
    process.exit(1)
  }

  console.log('[h5:preflight] passed')
}

main()
