import http from 'node:http'
import { URL } from 'node:url'
import { createMemoryStore } from './src/db/memory-store.mjs'
import { ENTITY_SCHEMAS } from './src/db/schema.mjs'

const PORT = Number(process.env.MOCK_API_PORT || 3100)
const store = createMemoryStore()

function sendJson(res, httpStatus, code, message, data) {
  res.writeHead(httpStatus, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(
    JSON.stringify({
      code,
      message,
      data
    })
  )
}

function sendOk(res, data, message = 'ok') {
  sendJson(res, 200, 0, message, data)
}

function sendBadRequest(res, message) {
  sendJson(res, 400, 400, message, null)
}

function sendNotFound(res, message = 'Not Found') {
  sendJson(res, 404, 404, message, null)
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function pickFilters(searchParams, keys) {
  return keys.reduce((filters, key) => {
    const value = searchParams.get(key)
    if (value !== null && value !== '') {
      filters[key] = value
    }
    return filters
  }, {})
}

function validateTaskPayload(payload = {}) {
  if (!payload.taskType) {
    return 'taskType is required'
  }
  if (!payload.taskSource) {
    return 'taskSource is required'
  }
  return ''
}

function validateLeadPayload(payload = {}) {
  if (!payload.contactName) {
    return 'contactName is required'
  }
  if (!payload.phone && !payload.mobile) {
    return 'phone is required'
  }
  if (!payload.demandType) {
    return 'demandType is required'
  }
  return ''
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendNotFound(res)
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, 0, 'ok', null)
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`)
  const { pathname, searchParams } = url

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendOk(res, {
        service: 'mock-api',
        port: PORT
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/schema') {
      sendOk(res, ENTITY_SCHEMAS)
      return
    }

    if (req.method === 'POST' && pathname === '/api/tasks') {
      const payload = await readJsonBody(req)
      const errorMessage = validateTaskPayload(payload)
      if (errorMessage) {
        sendBadRequest(res, errorMessage)
        return
      }

      const task = store.createTask(payload)
      sendOk(res, task, 'task created')
      return
    }

    if (req.method === 'GET' && pathname === '/api/tasks') {
      const filters = pickFilters(searchParams, ['status', 'userId', 'projectId', 'taskSource'])
      sendOk(res, store.listTasks(filters))
      return
    }

    if (req.method === 'GET' && pathname.startsWith('/api/tasks/')) {
      const taskId = pathname.split('/').pop()
      const task = store.getTaskById(taskId)
      if (!task) {
        sendNotFound(res, 'Task not found')
        return
      }
      sendOk(res, task)
      return
    }

    if (req.method === 'POST' && pathname === '/api/leads') {
      const payload = await readJsonBody(req)
      const errorMessage = validateLeadPayload(payload)
      if (errorMessage) {
        sendBadRequest(res, errorMessage)
        return
      }

      const lead = store.createLead({
        ...payload,
        phone: payload.phone || payload.mobile || ''
      })
      sendOk(res, lead, 'lead created')
      return
    }

    if (req.method === 'GET' && pathname === '/api/leads') {
      const filters = pickFilters(searchParams, ['status', 'source', 'sourceChannel', 'demandType'])
      sendOk(res, store.listLeads(filters))
      return
    }

    if (req.method === 'POST' && /^\/api\/leads\/[^/]+\/convert$/.test(pathname)) {
      const leadId = pathname.split('/')[3]
      const payload = await readJsonBody(req)
      const result = store.convertLead(leadId, payload)
      if (!result) {
        sendNotFound(res, 'Lead not found')
        return
      }
      sendOk(res, result, 'lead converted')
      return
    }

    if (req.method === 'GET' && pathname === '/api/projects') {
      const filters = pickFilters(searchParams, ['status', 'projectType', 'leadId'])
      sendOk(res, store.listProjects(filters))
      return
    }

    if (req.method === 'GET' && pathname === '/api/packages') {
      const filters = pickFilters(searchParams, ['packageType', 'status'])
      sendOk(res, store.listPackages(filters))
      return
    }

    if (req.method === 'GET' && pathname === '/api/debug/snapshot') {
      sendOk(res, store.getSnapshot())
      return
    }

    sendNotFound(res)
  } catch (error) {
    sendJson(res, 500, 500, error && error.message ? error.message : 'Internal Server Error', null)
  }
})

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://127.0.0.1:${PORT}`)
})
