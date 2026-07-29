function sleep(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSeedState(taskId, batchId, projectId) {
  const now = new Date().toISOString()
  const secondTaskId = `${taskId}-2`
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
          projectId,
          batchId,
          status: 'success',
          stage: 'finished',
          progress: 100,
          result: {
            items: [
              {
                url: 'https://example.com/e2e-batch-task-result-1.png'
              }
            ],
            coverUrl: 'https://example.com/e2e-batch-task-result-1.png',
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
        },
        [secondTaskId]: {
          taskId: secondTaskId,
          clientTaskId: `client-${secondTaskId}`,
          taskType: 'model_replace',
          source: 'miniapp',
          bizType: 'ai_listing',
          projectId,
          batchId,
          status: 'success',
          stage: 'finished',
          progress: 100,
          result: {
            items: [
              {
                url: 'https://example.com/e2e-batch-task-result-2.png'
              }
            ],
            coverUrl: 'https://example.com/e2e-batch-task-result-2.png',
            outputType: 'main',
            meta: {}
          },
          deliveryStatus: 'needs_revision',
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
      allIds: [taskId, secondTaskId]
    },
    deliveryAudits: [],
    deliveryCompensationQueue: [],
    uiState: {
      currentStep: 1,
      currentView: 'batch-detail',
      taskListFilter: 'all',
      taskListKeyword: '',
      loading: false
    }
  }
}

function createSeedBatch(batchId, projectId, taskId) {
  const now = new Date().toISOString()
  return [
    {
      batchId,
      projectId,
      batchName: 'E2E Batch',
      status: 'running',
      taskIds: [taskId, `${taskId}-2`],
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: ''
    }
  ]
}

describe('batch-detail.vue batch-level review action', () => {
  const taskId = 'task-e2e-batch-approve-001'
  const batchId = 'batch-e2e-approve-001'
  const projectId = 'proj-e2e-approve-001'
  let page = null

  beforeAll(async () => {
    await program.callUniMethod('clearStorageSync')
    await program.callUniMethod('setStorageSync', 'main_chain_state', createSeedState(taskId, batchId, projectId))
    await program.callUniMethod('setStorageSync', 'service_batches', createSeedBatch(batchId, projectId, taskId))
    await program.callUniMethod('setStorageSync', 'service_batch_logs', [])
    page = await program.reLaunch(`/pages/batch-detail/batch-detail?batchId=${batchId}`)
    await sleep(1400)
  })

  it('approves deliverable results and refreshes summary/history', async () => {
    const approveButton = await page.$('#e2e-approve-deliverable-results-btn')
    expect(approveButton).toBeTruthy()
    await approveButton.tap()
    await sleep(1400)

    const summaryNode = await page.$('#e2e-batch-review-action-summary')
    expect(summaryNode).toBeTruthy()
    const summaryText = await summaryNode.text()
    expect(summaryText).toContain('Last Action: Approve Deliverable Results')
    expect(summaryText).toContain('Action Type: approve_deliverable_results')

    const recentActionsNode = await page.$('#e2e-recent-batch-review-actions')
    expect(recentActionsNode).toBeTruthy()
    const recentActionsText = await recentActionsNode.text()
    expect(recentActionsText).toContain('approve_deliverable_results')

    const latestState = await program.callUniMethod('getStorageSync', 'main_chain_state')
    const task = latestState && latestState.tasks && latestState.tasks.byId && latestState.tasks.byId[taskId]
    expect(task).toBeTruthy()
    expect(task.deliveryStatus).toBe('approved')
    expect(task.deliveryConfirmedAt).toBeTruthy()
  })
})
