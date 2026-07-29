const childProcess = require('child_process')
const http = require('http')
const { PassThrough } = require('stream')

const originalSpawn = childProcess.spawn

function isLikelyBrowserExecutable(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  return normalized.endsWith('/chrome.exe')
    || normalized.endsWith('/chrome-headless-shell.exe')
    || normalized.endsWith('/msedge.exe')
    || normalized.endsWith('/firefox.exe')
    || normalized.endsWith('/playwright.sh')
}

function hasPipeStdio(options) {
  if (!options || options.stdio === undefined) {
    return false
  }
  if (options.stdio === 'pipe') {
    return true
  }
  if (Array.isArray(options.stdio)) {
    return options.stdio.some(entry => entry === 'pipe')
  }
  return false
}

childProcess.spawn = function patchedSpawn(file, args, options) {
  if (isLikelyBrowserExecutable(file) && hasPipeStdio(options)) {
    const patchedOptions = {
      ...(options || {}),
      stdio: ['ignore', 'ignore', 'ignore', 'ignore', 'ignore']
    }
    const child = originalSpawn.call(childProcess, file, args, patchedOptions)

    if (!child.stdout) {
      child.stdout = new PassThrough()
    }
    if (!child.stderr) {
      child.stderr = new PassThrough()
    }
    if (!Array.isArray(child.stdio) || child.stdio.length < 5) {
      child.stdio = [null, child.stdout, child.stderr, new PassThrough(), new PassThrough()]
    } else {
      if (!child.stdio[1]) child.stdio[1] = child.stdout
      if (!child.stdio[2]) child.stdio[2] = child.stderr
      if (!child.stdio[3]) child.stdio[3] = new PassThrough()
      if (!child.stdio[4]) child.stdio[4] = new PassThrough()
    }

    return child
  }
  return originalSpawn.call(childProcess, file, args, options)
}

function patchChromiumWaitForReadyState(ChromiumClass) {
  if (!ChromiumClass || ChromiumClass.__epremWaitPatched) {
    return
  }
  ChromiumClass.__epremWaitPatched = true

  ChromiumClass.prototype.waitForReadyState = async function patchedWaitForReadyState(options) {
    if (!options || options.cdpPort === undefined) {
      return {}
    }

    const port = options.cdpPort
    const endpointUrl = `http://127.0.0.1:${port}/json/version/`
    const timeoutMs = 30000
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      try {
        const wsEndpoint = await new Promise((resolve, reject) => {
          const req = http.get(endpointUrl, (res) => {
            if (res.statusCode !== 200) {
              res.resume()
              reject(new Error(`Unexpected status: ${res.statusCode}`))
              return
            }
            let body = ''
            res.on('data', chunk => {
              body += chunk
            })
            res.on('end', () => {
              try {
                const payload = JSON.parse(body)
                resolve(payload.webSocketDebuggerUrl)
              } catch (error) {
                reject(error)
              }
            })
          })
          req.on('error', reject)
          req.setTimeout(2000, () => {
            req.destroy(new Error('request timeout'))
          })
        })

        if (wsEndpoint) {
          return { wsEndpoint }
        }
      } catch (error) {
        // Keep retrying until timeout.
      }

      await new Promise(resolve => setTimeout(resolve, 250))
    }

    throw new Error(`Timed out waiting for Chromium DevTools endpoint at ${endpointUrl}`)
  }
}

const Module = require('module')
const originalLoad = Module._load

Module._load = function patchedModuleLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments)
  try {
    const resolved = Module._resolveFilename(request, parent, isMain)
    if (
      typeof resolved === 'string'
      && /playwright-core[\\/]lib[\\/]server[\\/]chromium[\\/]chromium\.js$/i.test(resolved)
      && loaded
      && loaded.Chromium
    ) {
      patchChromiumWaitForReadyState(loaded.Chromium)
    }
  } catch (error) {
    // ignore patch errors to avoid blocking normal startup
  }
  return loaded
}
