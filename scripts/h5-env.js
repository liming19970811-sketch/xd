const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function parseDotEnv(text) {
  const values = {}
  String(text || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index <= 0) return
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  })
  return values
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  return parseDotEnv(fs.readFileSync(file, 'utf8'))
}

function resolveDeployEnv(argv = process.argv) {
  const explicit = argv.find((item) => item.startsWith('--env='))
  if (explicit) return explicit.split('=')[1]
  const envIndex = argv.indexOf('--env')
  if (envIndex >= 0 && argv[envIndex + 1]) return argv[envIndex + 1]
  return process.env.DIEBIAN_DEPLOY_ENV || process.env.NODE_ENV || 'development'
}

function loadH5Env(envName = resolveDeployEnv()) {
  const normalized = String(envName || 'development').trim().toLowerCase()
  const files = [
    path.join(ROOT, '.env.h5'),
    path.join(ROOT, `.env.h5.${normalized}`),
    path.join(ROOT, `.env.h5.${normalized}.local`)
  ]
  return files.reduce((acc, file) => Object.assign(acc, loadEnvFile(file)), {
    DIEBIAN_DEPLOY_ENV: normalized
  })
}

function getConfig(envName = resolveDeployEnv()) {
  const fileValues = loadH5Env(envName)
  return Object.assign({}, fileValues, process.env, {
    DIEBIAN_DEPLOY_ENV: String(envName || fileValues.DIEBIAN_DEPLOY_ENV || process.env.DIEBIAN_DEPLOY_ENV || 'development').trim().toLowerCase()
  })
}

module.exports = {
  ROOT,
  getConfig,
  loadH5Env,
  parseDotEnv,
  resolveDeployEnv
}
