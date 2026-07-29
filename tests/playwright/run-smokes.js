const { spawn } = require('child_process')
const path = require('path')

const scripts = [
  'h5-smoke.spec.js',
  'result-smoke.spec.js',
  'result-needs-revision-smoke.spec.js',
  'result-share-click-smoke.spec.js'
]

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, scriptName)
    console.log(`[pw-smoke-all] START ${scriptName}`)

    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: process.env
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[pw-smoke-all] DONE ${scriptName}`)
        resolve()
        return
      }
      reject(new Error(`${scriptName} exited with code ${code}`))
    })
  })
}

async function main() {
  console.log(`[pw-smoke-all] node=${process.version}`)
  for (const scriptName of scripts) {
    await runScript(scriptName)
  }
  console.log('[pw-smoke-all] PASS')
}

main().catch((error) => {
  console.error('[pw-smoke-all] FAIL')
  console.error(error)
  process.exit(1)
})
