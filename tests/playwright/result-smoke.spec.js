const assert = require('assert')
const { chromium } = require('playwright')

const baseUrl = process.env.H5_URL || 'http://127.0.0.1:8080/#/'
const headless = process.env.PW_HEADLESS !== 'false'
const taskId = process.env.RESULT_TASK_ID || 'task-pw-result-smoke-001'

function createSeedState(currentTaskId) {
  const now = new Date().toISOString()
  return {
    currentTaskId,
    draftTask: {},
    tasks: {
      byId: {
        [currentTaskId]: {
          taskId: currentTaskId,
          clientTaskId: `client-${currentTaskId}`,
          taskType: 'model_replace',
          source: 'miniapp',
          bizType: 'ai_listing',
          projectId: 'proj-pw-result-smoke-001',
          batchId: 'batch-pw-result-smoke-001',
          input: {
            assets: {
              clothImage: {
                localPath: '',
                fileId: 'cloth-file-001',
                fileUrl: 'https://example.com/cloth.png'
              },
              styleImage: {
                localPath: '',
                fileId: 'style-file-001',
                fileUrl: 'https://example.com/style.png'
              }
            },
            params: {
              modelType: 'female',
              bodyType: 'normal',
              kidsAgeGroup: 'middle',
              styleTag: 'simple',
              sceneType: 'white',
              neckType: 'round',
              sleeveType: 'long',
              fitType: 'loose'
            },
            options: {
              backgroundType: 'normal',
              outputType: 'main'
            }
          },
          status: 'success',
          stage: 'finished',
          progress: 100,
          statusText: 'Result ready',
          result: {
            items: [
              {
                fileUrl: 'https://example.com/result.png'
              }
            ],
            coverUrl: 'https://example.com/result.png',
            outputType: 'main',
            meta: {}
          },
          error: {
            type: '',
            code: '',
            message: '',
            retryable: false
          },
          control: {
            canRetry: false,
            canContinuePolling: false,
            lastTaskId: currentTaskId,
            pollingCount: 0,
            maxPollingCount: 10
          },
          deliveryStatus: 'pending_review',
          deliveryConfirmedAt: '',
          deliveryNote: '',
          lastDeliverySyncAt: '',
          lastDeliverySyncStatus: 'unknown',
          lastDeliveryReconcileAt: '',
          lastDeliveryReconcileStatus: 'unknown',
          createdAt: now,
          updatedAt: now,
          submittedAt: now,
          completedAt: now
        }
      },
      allIds: [currentTaskId]
    },
    deliveryAudits: [],
    deliveryCompensationQueue: [],
    uiState: {
      currentStep: 1,
      currentView: 'result',
      taskListFilter: 'all',
      taskListKeyword: '',
      loading: false
    },
    taskId: currentTaskId,
    lastTaskId: currentTaskId
  }
}

async function run() {
  const resultUrl = new URL(baseUrl)
  resultUrl.hash = `/pages/result/result?taskId=${encodeURIComponent(taskId)}`

  console.log(`[pw-result-smoke] node=${process.version}`)
  console.log(`[pw-result-smoke] url=${resultUrl.toString()}`)
  console.log(`[pw-result-smoke] headless=${headless}`)

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-gpu']
  })

  try {
    const page = await browser.newPage()
    const seedState = createSeedState(taskId)

    await page.addInitScript((state) => {
      window.localStorage.setItem('main_chain_state', JSON.stringify(state))
    }, seedState)

    const response = await page.goto(resultUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    const status = response ? response.status() : 0
    console.log(`[pw-result-smoke] status=${status}`)
    assert(response && response.ok(), `Expected 2xx response, got ${status || 'NO_RESPONSE'}`)

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((error) => {
      console.log(`[pw-result-smoke] networkidle skipped: ${error.message}`)
    })

    await page.waitForURL(/#\/pages\/result\/result\?taskId=/, { timeout: 10000 })

    const approveButton = page.locator('#e2e-approve-result-btn')
    await approveButton.waitFor({ state: 'visible', timeout: 10000 })

    const approveText = await approveButton.innerText()
    console.log(`[pw-result-smoke] approveText=${approveText}`)
    assert(approveText.includes('通过结果'), 'Expected approve result button to be visible')

    const deliveryLine = page.locator('#e2e-delivery-status-line')
    await deliveryLine.waitFor({ state: 'visible', timeout: 10000 })
    const deliveryText = await deliveryLine.innerText()
    console.log(`[pw-result-smoke] deliveryLine=${deliveryText}`)

    console.log('[pw-result-smoke] PASS')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('[pw-result-smoke] FAIL')
  console.error(error)
  process.exit(1)
})
