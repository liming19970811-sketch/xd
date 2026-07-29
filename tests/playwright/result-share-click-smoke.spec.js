const assert = require('assert')
const { chromium } = require('playwright')

const baseUrl = process.env.H5_URL || 'http://127.0.0.1:8080/#/'
const headless = process.env.PW_HEADLESS !== 'false'
const taskId = process.env.RESULT_TASK_ID || 'task-pw-result-share-001'

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
          projectId: 'proj-pw-result-share-001',
          batchId: 'batch-pw-result-share-001',
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
                fileUrl: 'https://example.com/result-share.png'
              }
            ],
            coverUrl: 'https://example.com/result-share.png',
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

  console.log(`[pw-result-share-click-smoke] node=${process.version}`)
  console.log(`[pw-result-share-click-smoke] url=${resultUrl.toString()}`)
  console.log(`[pw-result-share-click-smoke] headless=${headless}`)

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
    console.log(`[pw-result-share-click-smoke] status=${status}`)
    assert(response && response.ok(), `Expected 2xx response, got ${status || 'NO_RESPONSE'}`)

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((error) => {
      console.log(`[pw-result-share-click-smoke] networkidle skipped: ${error.message}`)
    })

    await page.waitForURL(/#\/pages\/result\/result\?taskId=/, { timeout: 10000 })

    const manualServiceEntry = page.getByText('一键转人工精修', { exact: true }).first()
    await manualServiceEntry.waitFor({ state: 'visible', timeout: 10000 })
    const manualServiceText = await manualServiceEntry.innerText()
    console.log(`[pw-result-share-click-smoke] manualServiceEntry=${manualServiceText}`)
    assert(
      manualServiceText.includes('一键转人工精修'),
      'Expected manual service entry to be visible'
    )

    console.log('[pw-result-share-click-smoke] PASS')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('[pw-result-share-click-smoke] FAIL')
  console.error(error)
  process.exit(1)
})
