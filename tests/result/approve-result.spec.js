function sleep(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSeedState(taskId) {
  const now = new Date().toISOString()
  return {
    currentTaskId: taskId,
    draftTask: {},
    tasks: {
      byId: {
        [taskId]: {
          taskId,
          clientTaskId: `client-${taskId}`,
          taskType: 'model_replace',
          source: 'miniapp',
          bizType: 'ai_listing',
          projectId: 'proj-e2e-001',
          batchId: 'batch-e2e-001',
          status: 'result_ready',
          stage: 'finished',
          progress: 100,
          result: {
            items: [
              {
                url: 'https://example.com/e2e-result.png'
              }
            ],
            coverUrl: 'https://example.com/e2e-result.png',
            outputType: 'main',
            meta: {}
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
      allIds: [taskId]
    },
    deliveryAudits: [],
    deliveryCompensationQueue: [],
    uiState: {
      currentStep: 1,
      currentView: 'result',
      taskListFilter: 'all',
      taskListKeyword: '',
      loading: false
    }
  }
}

describe('result.vue single task review action', () => {
  const taskId = 'task-e2e-approve-001'
  let page = null

  beforeAll(async () => {
    await program.callUniMethod('clearStorageSync')
    await program.callUniMethod('setStorageSync', 'main_chain_state', createSeedState(taskId))
    page = await program.reLaunch(`/pages/result/result?taskId=${taskId}`)
    await sleep(1200)
  })

  it('approves result and refreshes summary/history', async () => {
    const approveButton = await page.$('#e2e-approve-result-btn')
    expect(approveButton).toBeTruthy()
    await approveButton.tap()
    await sleep(1200)

    const summaryNode = await page.$('#e2e-result-review-summary')
    expect(summaryNode).toBeTruthy()
    const summaryText = await summaryNode.text()
    expect(summaryText).toContain('Last Action: Approve Result')
    expect(summaryText).toContain('Current Delivery Status: approved')

    const deliveryStatusNode = await page.$('#e2e-delivery-status-line')
    const deliveryStatusText = await deliveryStatusNode.text()
    expect(deliveryStatusText).toContain('approved')

    const recentActionsNode = await page.$('#e2e-recent-result-review-actions')
    const recentActionsText = await recentActionsNode.text()
    expect(recentActionsText).toContain('approve_result')

    const latestState = await program.callUniMethod('getStorageSync', 'main_chain_state')
    const task = latestState && latestState.tasks && latestState.tasks.byId && latestState.tasks.byId[taskId]
    expect(task).toBeTruthy()
    expect(task.deliveryStatus).toBe('approved')
    expect(task.deliveryConfirmedAt).toBeTruthy()
  })
})
