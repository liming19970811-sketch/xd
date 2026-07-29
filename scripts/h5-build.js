const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { ROOT, resolveDeployEnv } = require('./h5-env')

function resolveCli() {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  const localCli = path.join(ROOT, 'node_modules', '.bin', `vue-cli-service${suffix}`)
  if (fs.existsSync(localCli)) return localCli
  return ''
}

function main() {
  const deployEnv = resolveDeployEnv()
  const cli = resolveCli()
  if (!cli) {
    console.error('[h5:build] vue-cli-service local binary not found.')
    console.error('[h5:build] Run npm install first, or build H5 with HBuilderX.')
    process.exit(1)
  }

  const env = Object.assign({}, process.env, {
    NODE_ENV: 'production',
    DIEBIAN_DEPLOY_ENV: deployEnv
  })
  const result = spawnSync(cli, ['uni-build', '-p', 'h5'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: false
  })
  process.exit(result.status || 0)
}

main()
