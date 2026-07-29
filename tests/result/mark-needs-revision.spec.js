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
                url: 'https://example.com/e2e-result-needs-revision.png'
              }
            ],
            coverUrl: 'https://example.com/e2e-result-needs-revision.png',
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

describe('result.vue single task needs revision action', () => {
  const taskId = 'task-e2e-needs-revision-001'
  let page = null

  beforeAll(async () => {
    await program.callUniMethod('clearStorageSync')
    await program.callUniMethod('setStorageSync', 'main_chain_state', createSeedState(taskId))
    page = await program.reLaunch(`/pages/result/result?taskId=${taskId}`)
    await sleep(1200)
  })

  it('marks needs revision and refreshes summary/history', async () => {
    const markButton = await page.$('#e2e-mark-needs-revision-btn')
    expect(markButton).toBeTruthy()
    await markButton.tap()
    await sleep(1200)

    const summaryNode = await page.$('#e2e-result-review-summary')
    expect(summaryNode).toBeTruthy()
    const summaryText = await summaryNode.text()
    expect(summaryText).toContain('Last Action: Mark Needs Revision')
    expect(summaryText).toContain('Action Type: mark_needs_revision')
    expect(summaryText).toContain('Current Delivery Status: needs_revision')

    const recentActionsNode = await page.$('#e2e-recent-result-review-actions')
    const recentActionsText = await recentActionsNode.text()
    expect(recentActionsText).toContain('mark_needs_revision')

    const deliveryStatusNode = await page.$('#e2e-delivery-status-line')
    const deliveryStatusText = await deliveryStatusNode.text()
    expect(deliveryStatusText).toContain('needs_revision')

    const latestState = await program.callUniMethod('getStorageSync', 'main_chain_state')
    const task = latestState && latestState.tasks && latestState.tasks.byId && latestState.tasks.byId[taskId]
    expect(task).toBeTruthy()
    expect(task.deliveryStatus).toBe('needs_revision')
    expect(task.deliveryConfirmedAt).toBeTruthy()
    expect(task.deliveryNote).toContain('Marked as needs revision in result view')
  })
})
