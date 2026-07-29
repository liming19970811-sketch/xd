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
                url: 'https://example.com/e2e-batch-revision-task-result-1.png'
              }
            ],
            coverUrl: 'https://example.com/e2e-batch-revision-task-result-1.png',
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
                url: 'https://example.com/e2e-batch-revision-task-result-2.png'
              }
            ],
            coverUrl: 'https://example.com/e2e-batch-revision-task-result-2.png',
            outputType: 'main',
            meta: {}
          },
          deliveryStatus: 'approved',
          deliveryConfirmedAt: now,
          deliveryNote: 'Seed approved',
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
      batchName: 'E2E Batch Revision',
      status: 'running',
      taskIds: [taskId, `${taskId}-2`],
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: ''
    }
  ]
}

describe('batch-detail.vue batch-level revision action', () => {
  const taskId = 'task-e2e-batch-revision-001'
  const batchId = 'batch-e2e-revision-001'
  const projectId = 'proj-e2e-revision-001'
  let page = null

  beforeAll(async () => {
    await program.callUniMethod('clearStorageSync')
    await program.callUniMethod('setStorageSync', 'main_chain_state', createSeedState(taskId, batchId, projectId))
    await program.callUniMethod('setStorageSync', 'service_batches', createSeedBatch(batchId, projectId, taskId))
    await program.callUniMethod('setStorageSync', 'service_batch_logs', [])
    page = await program.reLaunch(`/pages/batch-detail/batch-detail?batchId=${batchId}`)
    await sleep(1400)
  })

  it('marks pending review tasks as needs revision and refreshes summary/history', async () => {
    const markButton = await page.$('#e2e-mark-pending-review-tasks-as-needs-revision-btn')
    expect(markButton).toBeTruthy()
    await markButton.tap()
    await sleep(1400)

    const summaryNode = await page.$('#e2e-batch-review-action-summary')
    expect(summaryNode).toBeTruthy()
    const summaryText = await summaryNode.text()
    expect(summaryText).toContain('Last Action: Mark Pending Review Tasks As Needs Revision')
    expect(summaryText).toContain('Action Type: mark_pending_review_as_needs_revision')

    const recentActionsNode = await page.$('#e2e-recent-batch-review-actions')
    expect(recentActionsNode).toBeTruthy()
    const recentActionsText = await recentActionsNode.text()
    expect(recentActionsText).toContain('mark_pending_review_as_needs_revision')

    const latestState = await program.callUniMethod('getStorageSync', 'main_chain_state')
    const targetTask = latestState && latestState.tasks && latestState.tasks.byId && latestState.tasks.byId[taskId]
    expect(targetTask).toBeTruthy()
    expect(targetTask.deliveryStatus).toBe('needs_revision')
    expect(targetTask.deliveryConfirmedAt).toBeTruthy()
    expect(targetTask.deliveryNote).toContain('Marked as needs revision in batch quick action')
  })
})
