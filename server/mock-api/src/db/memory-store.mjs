const TASK_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
}

const TASK_SOURCE = {
  MINIAPP: 'miniapp',
  WEBSITE: 'website',
  ADMIN: 'admin',
  SERVER: 'server'
}

const TASK_TYPE = {
  MODEL_REPLACE: 'model_replace'
}

const PROJECT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed'
}

const PROJECT_STAGE = {
  DISCOVERY: 'discovery'
}

const PACKAGE_TYPE = {
  BASIC: 'basic',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'
}

const FILE_STATUS = {
  UPLOADED: 'uploaded'
}

const FILE_BIZ_TYPE = {
  LEAD_ATTACHMENT: 'lead_attachment'
}

const USER_PACKAGE_STATUS = {
  ACTIVE: 'active'
}

const ORDER_STATUS = {
  CREATED: 'created'
}

const PAY_STATUS = {
  UNPAID: 'unpaid'
}

const PAY_CHANNEL = {
  WECHAT: 'wechat'
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function now() {
  return new Date().toISOString()
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createTaskRecord(overrides = {}) {
  const timestamp = now()
  return {
    taskId: createId('task'),
    userId: 'user_default',
    projectId: '',
    batchId: '',
    taskType: TASK_TYPE.MODEL_REPLACE,
    taskSource: TASK_SOURCE.MINIAPP,
    status: TASK_STATUS.DRAFT,
    stage: 'editing',
    progress: 0,
    input: {
      assets: {
        clothImage: { localPath: '', fileId: '', fileUrl: '' },
        styleImage: { localPath: '', fileId: '', fileUrl: '' }
      },
      params: {},
      options: {}
    },
    result: {
      items: [],
      coverUrl: '',
      outputType: 'main',
      meta: {}
    },
    error: {
      type: '',
      code: '',
      message: '',
      retryable: false,
      details: {
        upload: { clothImage: '', styleImage: '' },
        generate: '',
        polling: ''
      }
    },
    control: {
      canRetry: false,
      canContinuePolling: false,
      lastTaskId: '',
      pollingCount: 0,
      maxPollingCount: 10,
      retryState: {
        clothImage: false,
        styleImage: false,
        generate: false,
        polling: false
      },
      uploading: {
        clothImage: false,
        styleImage: false
      }
    },
    summary: {
      primaryText: 'Draft Task',
      secondaryText: '',
      status: TASK_STATUS.DRAFT,
      source: TASK_SOURCE.MINIAPP,
      hasResult: false,
      progress: 0,
      updatedAt: timestamp
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: '',
    completedAt: '',
    ...overrides
  }
}

function createLeadRecord(overrides = {}) {
  const timestamp = now()
  return {
    leadId: createId('lead'),
    source: 'website',
    sourcePage: 'website-demand',
    sourceChannel: 'website',
    companyName: '',
    brandName: '',
    contactName: '',
    phone: '',
    wechat: '',
    email: '',
    demandType: 'design_service',
    serviceScope: [],
    productCategory: '',
    expectedVolume: '',
    expectedDeliveryTime: '',
    budgetRange: '',
    needSample: false,
    description: '',
    referenceImages: [],
    attachmentUrls: [],
    status: 'new',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function createProjectRecord(overrides = {}) {
  const timestamp = now()
  return {
    projectId: createId('project'),
    leadId: '',
    enterpriseId: '',
    projectName: '',
    projectType: 'design_service',
    status: PROJECT_STATUS.PENDING,
    stage: PROJECT_STAGE.DISCOVERY,
    serviceScope: [],
    ownerId: '',
    taskIds: [],
    batchIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: '',
    completedAt: '',
    ...overrides
  }
}

function createPackageRecord(overrides = {}) {
  const timestamp = now()
  return {
    packageId: createId('package'),
    packageType: PACKAGE_TYPE.BASIC,
    name: 'Package',
    price: 0,
    currency: 'CNY',
    quota: 0,
    validityDays: 30,
    benefits: [],
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function createUserRecord(overrides = {}) {
  const timestamp = now()
  return {
    userId: createId('user'),
    mobile: '',
    nickname: 'Default User',
    avatarUrl: '',
    isVip: false,
    leftCount: 2,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function createFileRecord(overrides = {}) {
  const timestamp = now()
  return {
    fileId: createId('file'),
    userId: 'user_default',
    bizType: FILE_BIZ_TYPE.LEAD_ATTACHMENT,
    fileName: '',
    fileUrl: '',
    localPath: '',
    mimeType: 'image/jpeg',
    status: FILE_STATUS.UPLOADED,
    meta: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function createUserPackageRecord(overrides = {}) {
  const timestamp = now()
  return {
    userPackageId: createId('user_package'),
    userId: 'user_default',
    packageId: '',
    packageType: PACKAGE_TYPE.BASIC,
    status: USER_PACKAGE_STATUS.ACTIVE,
    totalQuota: 0,
    usedQuota: 0,
    remainingQuota: 0,
    startedAt: timestamp,
    expiredAt: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function createOrderRecord(overrides = {}) {
  const timestamp = now()
  return {
    orderId: createId('order'),
    userId: 'user_default',
    orderType: 'package_purchase',
    orderStatus: ORDER_STATUS.CREATED,
    payStatus: PAY_STATUS.UNPAID,
    payChannel: PAY_CHANNEL.WECHAT,
    amount: 0,
    packageId: '',
    itemSnapshot: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

class Collection {
  constructor(primaryKey, seedItems = []) {
    this.primaryKey = primaryKey
    this.items = seedItems
  }

  list(filters = {}) {
    const entries = this.items.filter((item) => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return true
        }
        return String(item[key]) === String(value)
      })
    })
    return clone(entries)
  }

  getById(id) {
    const found = this.items.find((item) => String(item[this.primaryKey]) === String(id))
    return found ? clone(found) : null
  }

  create(record) {
    this.items.unshift(record)
    return clone(record)
  }

  update(id, updater) {
    const index = this.items.findIndex((item) => String(item[this.primaryKey]) === String(id))
    if (index < 0) {
      return null
    }
    const current = this.items[index]
    const nextValue = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
    this.items[index] = nextValue
    return clone(nextValue)
  }
}

export function createMemoryStore() {
  const defaultUser = createUserRecord({
    userId: 'user_default',
    mobile: '13800000000',
    nickname: 'Mock User',
    leftCount: 12
  })

  const collections = {
    users: new Collection('userId', [defaultUser]),
    tasks: new Collection('taskId', [
      createTaskRecord({
        taskId: 'task_seed_001',
        userId: defaultUser.userId,
        taskSource: TASK_SOURCE.MINIAPP,
        status: TASK_STATUS.SUCCESS,
        stage: 'result_ready',
        progress: 100,
        summary: {
          primaryText: 'task_seed_001',
          secondaryText: 'female / simple / white / main',
          status: TASK_STATUS.SUCCESS,
          source: TASK_SOURCE.MINIAPP,
          hasResult: true,
          progress: 100,
          updatedAt: now()
        }
      })
    ]),
    files: new Collection('fileId', [
      createFileRecord({
        fileId: 'file_seed_001',
        userId: defaultUser.userId,
        fileName: 'lead-reference.jpg',
        fileUrl: 'https://example.com/mock/lead-reference.jpg'
      })
    ]),
    packages: new Collection('packageId', [
      createPackageRecord({
        packageId: 'pkg_times_card_001',
        packageType: PACKAGE_TYPE.BASIC,
        name: '20次生成次卡',
        price: 99,
        quota: 20,
        validityDays: 30,
        benefits: ['20次AI生成额度', '适合短期上新', '支持结果页继续迭代']
      }),
      createPackageRecord({
        packageId: 'pkg_month_card_001',
        packageType: PACKAGE_TYPE.PROFESSIONAL,
        name: '月度会员卡',
        price: 299,
        quota: 9999,
        validityDays: 30,
        benefits: ['30天内高频使用', '适合日常运营团队', '预留后续支付升级结构']
      }),
      createPackageRecord({
        packageId: 'pkg_enterprise_001',
        packageType: PACKAGE_TYPE.ENTERPRISE,
        name: '企业协作包',
        price: 999,
        quota: 500,
        validityDays: 90,
        benefits: ['批量生成与协同支持', '适合团队项目制交付', '预留企业级服务扩展']
      })
    ]),
    userPackages: new Collection('userPackageId', [
      createUserPackageRecord({
        userPackageId: 'user_package_seed_001',
        userId: defaultUser.userId,
        packageId: 'pkg_times_card_001',
        packageType: PACKAGE_TYPE.BASIC,
        totalQuota: 20,
        usedQuota: 8,
        remainingQuota: 12
      })
    ]),
    orders: new Collection('orderId', [
      createOrderRecord({
        orderId: 'order_seed_001',
        userId: defaultUser.userId,
        orderType: 'package_purchase',
        amount: 99,
        packageId: 'pkg_times_card_001',
        itemSnapshot: {
          packageId: 'pkg_times_card_001',
          packageType: PACKAGE_TYPE.BASIC,
          name: '20次生成次卡'
        }
      })
    ]),
    leads: new Collection('leadId', [
      createLeadRecord({
        leadId: 'lead_seed_001',
        source: 'website',
        sourcePage: 'website-demand',
        sourceChannel: 'website',
        companyName: 'Mock Apparel Co.',
        brandName: 'Mock Brand',
        contactName: 'Demo Owner',
        phone: '13800000000',
        demandType: 'design_service',
        serviceScope: ['model_replace', 'scene_change'],
        budgetRange: '10k - 30k',
        description: 'Need a fast AI + manual design support flow.',
        referenceImages: ['https://example.com/mock/reference-1.jpg'],
        attachmentUrls: ['https://example.com/mock/attachment-1.jpg']
      })
    ]),
    projects: new Collection('projectId', [
      createProjectRecord({
        projectId: 'project_seed_001',
        leadId: 'lead_seed_001',
        projectName: 'Mock Brand Launch',
        projectType: 'design_service',
        status: PROJECT_STATUS.CONFIRMED,
        serviceScope: ['model_replace', 'scene_change'],
        taskIds: ['task_seed_001']
      })
    ])
  }

  return {
    schemas: {
      taskStatuses: TASK_STATUS,
      taskSources: TASK_SOURCE
    },
    listTasks(filters = {}) {
      return collections.tasks.list(filters)
    },
    getTaskById(taskId) {
      return collections.tasks.getById(taskId)
    },
    createTask(payload = {}) {
      const record = createTaskRecord({
        ...payload,
        input: payload.input || {},
        result: payload.result || {},
        error: payload.error || {},
        control: payload.control || {},
        summary: payload.summary || {}
      })
      return collections.tasks.create(record)
    },
    listLeads(filters = {}) {
      return collections.leads.list(filters)
    },
    createLead(payload = {}) {
      const lead = createLeadRecord({
        ...payload,
        serviceScope: ensureArray(payload.serviceScope),
        referenceImages: ensureArray(payload.referenceImages),
        attachmentUrls: ensureArray(payload.attachmentUrls)
      })
      return collections.leads.create(lead)
    },
    convertLead(leadId, payload = {}) {
      const lead = collections.leads.getById(leadId)
      if (!lead) {
        return null
      }

      collections.leads.update(leadId, (current) => ({
        ...current,
        status: 'converted',
        updatedAt: now()
      }))

      const project = createProjectRecord({
        leadId,
        projectName: payload.projectName || `${lead.companyName || lead.brandName || lead.contactName || 'Lead'} Project`,
        projectType: payload.projectType || lead.demandType || 'design_service',
        serviceScope: ensureArray(payload.serviceScope).length ? ensureArray(payload.serviceScope) : ensureArray(lead.serviceScope),
        ownerId: payload.ownerId || lead.contactName || ''
      })

      return {
        lead: collections.leads.getById(leadId),
        project: collections.projects.create(project)
      }
    },
    listProjects(filters = {}) {
      return collections.projects.list(filters)
    },
    listPackages(filters = {}) {
      return collections.packages.list(filters)
    },
    createPackageOrder(payload = {}) {
      const order = createOrderRecord({
        ...payload
      })
      return collections.orders.create(order)
    },
    getSnapshot() {
      return {
        users: collections.users.list(),
        tasks: collections.tasks.list(),
        files: collections.files.list(),
        packages: collections.packages.list(),
        userPackages: collections.userPackages.list(),
        orders: collections.orders.list(),
        leads: collections.leads.list(),
        projects: collections.projects.list()
      }
    }
  }
}
