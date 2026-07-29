export const ENTITY_SCHEMAS = {
  users: {
    tableName: 'users',
    primaryKey: 'userId',
    fields: {
      userId: 'user_id',
      mobile: 'mobile',
      nickname: 'nickname',
      avatarUrl: 'avatar_url',
      isVip: 'is_vip',
      leftCount: 'left_count',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  tasks: {
    tableName: 'tasks',
    primaryKey: 'taskId',
    fields: {
      taskId: 'task_id',
      userId: 'user_id',
      projectId: 'project_id',
      batchId: 'batch_id',
      taskType: 'task_type',
      taskSource: 'task_source',
      status: 'status',
      stage: 'stage',
      progress: 'progress',
      input: 'input_json',
      result: 'result_json',
      error: 'error_json',
      control: 'control_json',
      summary: 'summary_json',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      submittedAt: 'submitted_at',
      completedAt: 'completed_at'
    }
  },
  files: {
    tableName: 'files',
    primaryKey: 'fileId',
    fields: {
      fileId: 'file_id',
      userId: 'user_id',
      bizType: 'biz_type',
      fileName: 'file_name',
      fileUrl: 'file_url',
      localPath: 'local_path',
      mimeType: 'mime_type',
      status: 'status',
      meta: 'meta_json',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  packages: {
    tableName: 'packages',
    primaryKey: 'packageId',
    fields: {
      packageId: 'package_id',
      packageType: 'package_type',
      name: 'name',
      price: 'price',
      currency: 'currency',
      quota: 'quota',
      validityDays: 'validity_days',
      benefits: 'benefits_json',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  userPackages: {
    tableName: 'user_packages',
    primaryKey: 'userPackageId',
    fields: {
      userPackageId: 'user_package_id',
      userId: 'user_id',
      packageId: 'package_id',
      packageType: 'package_type',
      status: 'status',
      totalQuota: 'total_quota',
      usedQuota: 'used_quota',
      remainingQuota: 'remaining_quota',
      startedAt: 'started_at',
      expiredAt: 'expired_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  orders: {
    tableName: 'orders',
    primaryKey: 'orderId',
    fields: {
      orderId: 'order_id',
      userId: 'user_id',
      orderType: 'order_type',
      orderStatus: 'order_status',
      payStatus: 'pay_status',
      payChannel: 'pay_channel',
      amount: 'amount',
      packageId: 'package_id',
      itemSnapshot: 'item_snapshot_json',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  leads: {
    tableName: 'leads',
    primaryKey: 'leadId',
    fields: {
      leadId: 'lead_id',
      source: 'source',
      sourcePage: 'source_page',
      sourceChannel: 'source_channel',
      companyName: 'company_name',
      brandName: 'brand_name',
      contactName: 'contact_name',
      phone: 'phone',
      wechat: 'wechat',
      email: 'email',
      demandType: 'demand_type',
      serviceScope: 'service_scope_json',
      productCategory: 'product_category',
      expectedVolume: 'expected_volume',
      expectedDeliveryTime: 'expected_delivery_time',
      budgetRange: 'budget_range',
      needSample: 'need_sample',
      description: 'description',
      referenceImages: 'reference_images_json',
      attachmentUrls: 'attachment_urls_json',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  projects: {
    tableName: 'projects',
    primaryKey: 'projectId',
    fields: {
      projectId: 'project_id',
      leadId: 'lead_id',
      enterpriseId: 'enterprise_id',
      projectName: 'project_name',
      projectType: 'project_type',
      status: 'status',
      stage: 'stage',
      serviceScope: 'service_scope_json',
      ownerId: 'owner_id',
      taskIds: 'task_ids_json',
      batchIds: 'batch_ids_json',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      startedAt: 'started_at',
      completedAt: 'completed_at'
    }
  }
}

export function createColumnMap(entityName) {
  const schema = ENTITY_SCHEMAS[entityName]
  return schema ? schema.fields : {}
}
