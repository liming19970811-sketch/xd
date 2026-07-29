const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { ROOT, getConfig, resolveDeployEnv } = require('./h5-env')

const BUILD_DIR = path.join(ROOT, 'unpackage', 'dist', 'build', 'web')
const MANIFEST_PATH = path.join(ROOT, 'docs', 'website-release-manifest.json')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, Object.assign({
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }, options))
  return result.status || 0
}

function main() {
  const deployEnv = resolveDeployEnv()
  const config = getConfig(deployEnv)
  const preflightStatus = run(process.execPath, [path.join(ROOT, 'scripts', 'h5-preflight.js'), '--env', deployEnv])
  if (preflightStatus !== 0) process.exit(preflightStatus)

  if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    console.error('[h5:deploy] H5 build artifact missing.')
    process.exit(1)
  }

  const envId = String(config.DIEBIAN_CLOUDBASE_ENV_ID || '').trim()
  if (!envId) {
    console.error('[h5:deploy] DIEBIAN_CLOUDBASE_ENV_ID is required.')
    process.exit(1)
  }

  const targetPath = String(config.DIEBIAN_TCB_TARGET_PATH || '/').trim() || '/'
  const args = ['hosting', 'deploy', BUILD_DIR, targetPath, '-e', envId]
  console.log('[h5:deploy] tcb ' + args.map((item) => (item === BUILD_DIR ? 'unpackage/dist/build/web' : item)).join(' '))
  const status = run('tcb', args)
  if (status !== 0) {
    console.error('[h5:deploy] deploy failed. Ensure tcb is installed and logged in, and static hosting is enabled.')
    process.exit(status)
  }
  writeReleaseManifest(deployEnv, config)
  console.log(`[h5:deploy] deployed ${deployEnv} to ${config.DIEBIAN_SITE_DOMAIN || '(domain not set)'}`)
}

function readGitSha() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
  return result.status === 0 ? String(result.stdout || '').trim() : ''
}

function writeReleaseManifest(deployEnv, config) {
  const manifest = {
    version: `h5-${deployEnv}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    gitCommit: readGitSha(),
    releasedAt: new Date().toISOString(),
    releasedBy: process.env.USERNAME || process.env.USER || '',
    environment: deployEnv,
    siteDomain: config.DIEBIAN_SITE_DOMAIN || '',
    cloudbaseEnvId: config.DIEBIAN_CLOUDBASE_ENV_ID || '',
    apiBaseConfigured: Boolean(config.DIEBIAN_API_BASE),
    fileDomainConfigured: Boolean(config.DIEBIAN_FILE_DOMAIN),
    loginCallbackConfigured: Boolean(config.DIEBIAN_LOGIN_CALLBACK_URL),
    validation: {
      preflight: 'passed',
      sensitiveScan: 'passed',
      deployCommand: 'tcb hosting deploy'
    }
  }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

main()
