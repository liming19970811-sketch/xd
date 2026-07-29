function sleep(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSeedState(taskId, batchId, projectId) {
  const now = new Date().toISOString()
  const secondTaskId = `${taskId}-2`
  const thirdTaskId = `${taskId}-3`
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
            items: [{ url: 'https://example.com/e2e-project-revision-task-result-1.png' }],
            coverUrl: 'https://example.com/e2e-project-revision-task-result-1.png',
            outputType: 'main',
            meta: {}
          },
          deliveryStatus: 'approved',
          deliveryConfirmedAt: now,
          deliveryNote: 'Seed approved task',
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
          batchId: `${batchId}-pending`,
          status: 'success',
          stage: 'finished',
          progress: 100,
          result: {
            items: [{ url: 'https://example.com/e2e-project-revision-task-result-2.png' }],
            coverUrl: 'https://example.com/e2e-project-revision-task-result-2.png',
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
        [thirdTaskId]: {
          taskId: thirdTaskId,
          clientTaskId: `client-${thirdTaskId}`,
          taskType: 'model_replace',
          source: 'miniapp',
          bizType: 'ai_listing',
          projectId,
          batchId: `${batchId}-pending`,
          status: 'success',
          stage: 'finished',
          progress: 100,
          result: {
            items: [{ url: 'https://example.com/e2e-project-revision-task-result-3.png' }],
            coverUrl: 'https://example.com/e2e-project-revision-task-result-3.png',
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
      allIds: [taskId, secondTaskId, thirdTaskId]
    },
    deliveryAudits: [],
    deliveryCompensationQueue: [],
    uiState: {
      currentStep: 1,
      currentView: 'project-detail',
      taskListFilter: 'all',
      taskListKeyword: '',
      loading: false
    }
  }
}

function createSeedProjects(projectId, batchId, taskId) {
  const now = new Date().toISOString()
  return [
    {
      projectId,
      leadId: '',
      enterpriseId: '',
      projectName: 'E2E Project Revision',
      projectType: 'design_service',
      status: 'pending',
      serviceScope: [],
      ownerId: '',
      taskIds: [taskId, `${taskId}-2`, `${taskId}-3`],
      batchIds: [batchId, `${batchId}-pending`],
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: ''
    }
  ]
}

function createSeedBatches(batchId, projectId, taskId) {
  const now = new Date().toISOString()
  return [
    {
      batchId,
      projectId,
      batchName: 'E2E Deliverable Batch',
      status: 'running',
      taskIds: [taskId],
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: ''
    },
    {
      batchId: `${batchId}-pending`,
      projectId,
      batchName: 'E2E Pending Review Batch',
      status: 'running',
      taskIds: [`${taskId}-2`, `${taskId}-3`],
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: ''
    }
  ]
}

describe('project-detail.vue project-level revision action', () => {
  const taskId = 'task-e2e-project-revision-001'
  const batchId = 'batch-e2e-project-revision-001'
  const projectId = 'proj-e2e-project-revision-001'
  const targetTaskId = `${taskId}-2`
  let page = null

  beforeAll(async () => {
    await program.callUniMethod('clearStorageSync')
    await program.callUniMethod('setStorageSync', 'main_chain_state', createSeedState(taskId, batchId, projectId))
    await program.callUniMethod('setStorageSync', 'service_projects', createSeedProjects(projectId, batchId, taskId))
    await program.callUniMethod('setStorageSync', 'service_batches', createSeedBatches(batchId, projectId, taskId))
    await program.callUniMethod('setStorageSync', 'service_project_notes', {})
    await program.callUniMethod('setStorageSync', 'service_batch_logs', [])
    page = await program.reLaunch(`/pages/project-detail/project-detail?projectId=${projectId}`)
    await sleep(1500)
  })

  it('marks pending review batches as needs revision and refreshes summary/history', async () => {
    const markButton = await page.$('#e2e-mark-pending-review-batches-as-needs-revision-in-project-btn')
    expect(markButton).toBeTruthy()
    await markButton.tap()
    await sleep(1500)

    const summaryNode = await page.$('#e2e-project-batch-review-summary')
    expect(summaryNode).toBeTruthy()
    const summaryText = await summaryNode.text()
    expect(summaryText).toContain('Last Action: Mark Pending Review Batches As Needs Revision In Project')
    expect(summaryText).toContain('Action Type: mark_pending_review_batches_as_needs_revision_in_project')

    const recentNode = await page.$('#e2e-recent-project-review-actions')
    expect(recentNode).toBeTruthy()
    const recentText = await recentNode.text()
    expect(recentText).toContain('mark_pending_review_batches_as_needs_revision_in_project')

    const latestState = await program.callUniMethod('getStorageSync', 'main_chain_state')
    const targetTask = latestState && latestState.tasks && latestState.tasks.byId && latestState.tasks.byId[targetTaskId]
    expect(targetTask).toBeTruthy()
    expect(targetTask.deliveryStatus).toBe('needs_revision')
    expect(targetTask.deliveryConfirmedAt).toBeTruthy()
    expect(targetTask.deliveryNote).toContain('Marked as needs revision in project quick action')
  })
})
