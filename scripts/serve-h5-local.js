const fs = require('fs')
const path = require('path')
const http = require('http')
const url = require('url')

const projectRoot = process.cwd()
const defaultRoot = path.join(projectRoot, 'unpackage', 'dist', 'build', 'web')

const configuredRoot = process.env.H5_ROOT
const rootDir = configuredRoot
  ? path.resolve(projectRoot, configuredRoot)
  : defaultRoot

if (!rootDir || !fs.existsSync(rootDir)) {
  console.error('[serve:h5:local] No H5 dist directory found.')
  console.error('[serve:h5:local] Build or export H5 first, or set H5_ROOT.')
  process.exit(1)
}

const host = process.env.H5_HOST || '127.0.0.1'
const port = Number(process.env.H5_PORT || 8080)

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
}

function setCommonHeaders(res, filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  if (/\/assets\/.+\.[A-Za-z0-9_-]+\.(js|css|png|jpg|jpeg|webp|svg|gif)$/i.test(normalized)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }
  if (path.basename(filePath) === 'index.html') {
    res.setHeader('Cache-Control', 'no-cache')
    return
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '/')
  const safePath = decodeURIComponent(parsed.pathname || '/').replace(/^\/+/, '')
  let filePath = path.join(rootDir, safePath)

  if (!filePath.startsWith(rootDir)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  if (safePath === '') {
    filePath = path.join(rootDir, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(rootDir, 'index.html')
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 500
      res.end('Internal Server Error')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.setHeader('Content-Type', mimeByExt[ext] || 'application/octet-stream')
    setCommonHeaders(res, filePath)
    res.statusCode = 200
    res.end(data)
  })
})

server.listen(port, host, () => {
  console.log(`[serve:h5:local] Serving ${rootDir}`)
  console.log(`[serve:h5:local] URL: http://${host}:${port}`)
})
