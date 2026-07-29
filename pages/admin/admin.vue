<template>
  <view class="admin-page">
  <view v-if="platformAdminMode" class="platform-admin-page">
    <view v-if="!platformAdminCenter.canAccess" class="platform-admin-forbidden">
      <text class="platform-admin-title">平台运营管理后台</text>
      <text class="platform-admin-desc">仅平台管理员可访问。普通用户和企业管理员不能通过修改 URL 读取后台数据。</text>
      <text class="platform-admin-deny">访问被拦截：{{ platformAdminCenter.reason || 'platform_admin_required' }}</text>
    </view>
    <view v-else class="platform-admin-shell">
      <aside class="platform-admin-sidebar">
        <view class="platform-admin-brand">
          <text>蝶变平台后台</text>
          <text>Platform Ops</text>
        </view>
        <text
          v-for="item in platformAdminSections"
          :key="item.key"
          :class="{ active: platformAdminTab === item.key }"
          @click="setPlatformAdminTab(item.key)"
        >{{ item.label }}</text>
      </aside>
      <view class="platform-admin-main">
        <view class="platform-admin-header">
          <view>
            <text class="platform-admin-title">平台运营管理后台</text>
            <text class="platform-admin-desc">用户、企业、任务、额度、工单和系统状态集中管理，与普通工作台严格分离。</text>
          </view>
          <view class="platform-admin-filters">
            <input v-model.trim="platformAdminKeyword" placeholder="搜索用户、企业、任务、工单" />
            <picker :range="platformAdminEnvOptions" :value="platformAdminEnvIndex" @change="changePlatformAdminEnv">
              <view>{{ platformAdminEnvOptions[platformAdminEnvIndex] }}</view>
            </picker>
            <button @click="loadPlatformAdmin">刷新</button>
          </view>
        </view>

        <view v-if="platformAdminTab === 'overview'" class="platform-admin-section">
          <view class="platform-admin-grid">
            <view v-for="item in platformAdminOverviewCards" :key="item.label" class="platform-admin-card">
              <text>{{ item.value }}</text>
              <text>{{ item.label }}</text>
              <text>{{ item.desc }}</text>
            </view>
          </view>
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">当前模型版本</text>
            <text>{{ platformAdminCenter.overview.currentModelVersion || '未接入' }}</text>
            <text class="platform-admin-muted">看板只聚合真实本地/业务记录；无数据时显示 0，不生成演示数字。</text>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'users'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">用户管理</text>
            <view class="platform-admin-table">
              <view class="platform-admin-row head"><text>用户</text><text>状态</text><text>角色</text><text>操作</text></view>
              <view v-for="item in filteredPlatformUsers" :key="item.userId" class="platform-admin-row">
                <text>{{ item.name || item.userId }}</text><text>{{ item.status || 'active' }}</text><text>{{ item.role || '未绑定角色' }}</text><text>暂停/恢复需二次确认并写审计</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'enterprises'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">企业管理</text>
            <view class="platform-admin-table">
              <view class="platform-admin-row head"><text>企业</text><text>成员</text><text>套餐</text><text>状态</text></view>
              <view v-for="item in filteredPlatformEnterprises" :key="item.enterpriseId" class="platform-admin-row">
                <text>{{ item.enterpriseName }}</text><text>{{ item.members.length }}</text><text>{{ item.planId || '未设置' }}</text><text>{{ item.status || 'active' }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'tasks'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">AI任务管理</text>
            <view class="platform-admin-table wide">
              <view class="platform-admin-row head"><text>taskId</text><text>功能</text><text>provider</text><text>模型</text><text>状态</text><text>mock/fallback</text></view>
              <view v-for="item in filteredPlatformTasks" :key="item.taskId" class="platform-admin-row">
                <text>{{ item.taskId }}</text><text>{{ item.type || 'unknown' }}</text><text>{{ item.provider || '未记录' }}</text><text>{{ item.modelVersion || '未记录' }}</text><text>{{ item.status }}</text><text>{{ item.isMock ? 'mock' : '' }} {{ item.isFallback ? 'fallback' : '' }}</text>
              </view>
            </view>
            <text class="platform-admin-muted">后台只允许标记异常、允许用户重试或查看扣费链路；禁止直接把失败任务改为成功。</text>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'projects'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">项目与交付</text>
            <view class="platform-admin-grid">
              <view class="platform-admin-card"><text>{{ platformAdminCenter.projects.length }}</text><text>项目</text><text>来自项目数据</text></view>
              <view class="platform-admin-card"><text>{{ platformAdminCenter.deliveries.length }}</text><text>交付</text><text>来自交付记录</text></view>
            </view>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'patterns'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">版型与训练数据</text>
            <view class="platform-admin-table">
              <view class="platform-admin-row head"><text>样本</text><text>品类</text><text>状态</text><text>授权</text></view>
              <view v-for="item in platformAdminCenter.patterns" :key="item.sampleId || item.versionId" class="platform-admin-row">
                <text>{{ item.title || item.versionId }}</text><text>{{ item.category || '未分类' }}</text><text>{{ item.status || '待处理' }}</text><text>{{ item.authorized ? '已授权' : '未授权' }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'quota'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">额度记录</text>
            <view class="platform-admin-table">
              <view class="platform-admin-row head"><text>记录</text><text>类型</text><text>额度</text><text>状态</text></view>
              <view v-for="item in platformAdminCenter.quotaRecords" :key="item.recordId" class="platform-admin-row">
                <text>{{ item.recordId }}</text><text>{{ item.type }}</text><text>{{ item.amount }}</text><text>{{ item.status }}</text>
              </view>
            </view>
            <text class="platform-admin-muted">额度调整必须生成记录和幂等键，禁止直接修改余额字段。</text>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'tickets'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">工单中心</text>
            <view class="platform-admin-table">
              <view class="platform-admin-row head"><text>工单</text><text>类型</text><text>优先级</text><text>状态</text></view>
              <view v-for="item in platformAdminCenter.tickets" :key="item.ticketId" class="platform-admin-row">
                <text>{{ item.title }}</text><text>{{ item.typeLabel }}</text><text>{{ item.priority }}</text><text>{{ item.status }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'models'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">模型发布</text>
            <view class="platform-admin-table">
              <view class="platform-admin-row head"><text>releaseId</text><text>模型</text><text>版本</text><text>状态</text></view>
              <view v-for="item in platformAdminCenter.modelReleases" :key="item.releaseId" class="platform-admin-row">
                <text>{{ item.releaseId }}</text><text>{{ item.modelId }}</text><text>{{ item.modelVersion }}</text><text>{{ item.status }}</text>
              </view>
            </view>
            <text class="platform-admin-muted">模型/provider 高风险配置必须二次确认和审计，本阶段不直接切换线上 provider。</text>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'config'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">系统配置</text>
            <view class="platform-admin-config-list">
              <text>功能开关：需二次确认</text>
              <text>灰度范围：需记录影响企业/用户</text>
              <text>上传限制与批量任务上限：需审计</text>
              <text>provider 开关：本阶段只读展示，不直接修改</text>
              <text>维护公告与企业权限：需审批后生效</text>
            </view>
          </view>
        </view>

        <view v-else-if="platformAdminTab === 'content'" class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">公开内容管理</text>
            <text class="platform-admin-muted">支持草稿、待审核、已发布、已下线的内容状态展示。已发布内容修改需要保留版本记录；案例需记录授权状态和有效期。</text>
            <view class="platform-admin-table wide">
              <view class="platform-admin-row head"><text>类型</text><text>标题</text><text>状态</text><text>SEO / 授权</text></view>
              <view v-for="item in platformContentCases" :key="item.caseId" class="platform-admin-row">
                <text>案例</text>
                <text>{{ item.title }}</text>
                <text>{{ item.publishStatus }}</text>
                <text>{{ item.authorization && item.authorization.publicAuthorized ? '已授权' : '产品能力演示' }}</text>
              </view>
              <view v-for="item in platformContentArticles" :key="item.articleId" class="platform-admin-row">
                <text>文章</text>
                <text>{{ item.title }}</text>
                <text>{{ item.publishStatus }}</text>
                <text>{{ item.metaTitle || 'SEO待补充' }} · {{ item.version || 'v1' }}</text>
              </view>
            </view>
            <text class="platform-admin-muted">本阶段只做内容状态、SEO 信息和授权字段收口，不发布虚假客户案例或虚构数据。</text>
          </view>
        </view>

        <view v-else class="platform-admin-section">
          <view class="platform-admin-panel">
            <text class="platform-admin-panel-title">审计日志</text>
            <view class="platform-admin-table wide">
              <view class="platform-admin-row head"><text>时间</text><text>操作人</text><text>动作</text><text>对象</text></view>
              <view v-for="item in platformAdminCenter.auditLogs" :key="item.logId" class="platform-admin-row">
                <text>{{ formatDashboardDate(item.createdAt) }}</text><text>{{ item.operator }}</text><text>{{ item.action }}</text><text>{{ item.resourceType }} · {{ item.resourceId }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <view v-else-if="clientPortalView" class="client-portal-page">
    <view class="client-portal-header">
      <text class="operation-back" @click="closeClientPortal">‹ 返回项目详情</text>
      <text class="client-portal-badge">客户门户 · Mock Customer</text>
      <text class="client-portal-title">{{ clientPortalView.project.projectName }}</text>
      <text class="client-portal-subtitle">{{ clientPortalView.portal.customerName }}，您好。这里可以查看项目进度并确认当前方案。</text>
    </view>

    <view class="client-portal-summary">
      <view><text>项目状态</text><text>{{ getClientStatusLabel(clientPortalView.project.status) }}</text></view>
      <view><text>当前版本</text><text>{{ getClientVersionName(clientPortalView.currentVersion) }}</text></view>
      <view><text>批次数量</text><text>{{ clientPortalView.batches.length }}</text></view>
      <view><text>交付状态</text><text>{{ clientPortalDeliveryStatus }}</text></view>
    </view>

    <view class="client-portal-card">
      <text class="client-portal-section-title">客户需求</text>
      <view v-if="clientPortalView.demand" class="client-demand-content">
        <text>{{ getDemandTypeFilterLabel(clientPortalView.demand.demandType) }} · {{ clientPortalView.demand.clothingCategory || '服装视觉项目' }}</text>
        <text>{{ clientPortalView.demand.description || '需求已进入项目执行流程。' }}</text>
      </view>
      <text v-else class="operation-empty">暂无需求快照</text>
    </view>

    <view class="client-portal-card">
      <text class="client-portal-section-title">作品图片 · {{ clientPortalView.works.length }}</text>
      <view v-if="clientPortalView.works.length" class="client-work-grid">
        <view v-for="work in clientPortalView.works" :key="work.url" class="client-work-card">
          <image :src="work.url" mode="aspectFill" />
          <text>{{ work.status }}</text>
        </view>
      </view>
      <view v-else class="client-work-empty">作品生成后将在这里展示</view>
    </view>

    <view class="client-portal-card">
      <text class="client-portal-section-title">批次进度</text>
      <view v-if="clientPortalView.batches.length" class="client-progress-list">
        <view v-for="batch in clientPortalView.batches" :key="batch.batchId" class="client-progress-row">
          <view><text>{{ batch.batchId }}</text><text>{{ getClientBatchStatus(batch.status) }}</text></view>
          <text>{{ batch.completedCount }}/{{ batch.totalCount }} 完成{{ batch.failedCount ? ' · ' + batch.failedCount + ' 失败' : '' }}</text>
        </view>
      </view>
      <text v-else class="operation-empty">暂无批次任务</text>
    </view>

    <view class="client-portal-card">
      <text class="client-portal-section-title">交付记录</text>
      <view v-if="clientPortalView.deliveries.length" class="client-progress-list">
        <view v-for="delivery in clientPortalView.deliveries" :key="delivery.deliveryId" class="client-progress-row">
          <view><text>{{ getClientVersionName(delivery.version) }}</text><text>{{ delivery.deliveryId }}</text></view>
          <text>{{ getDashboardDeliveryStatus(delivery.status) }}</text>
        </view>
      </view>
      <text v-else class="operation-empty">项目尚未进入交付阶段</text>
    </view>

    <view class="client-portal-card">
      <text class="client-portal-section-title">方案确认与修改意见</text>
      <textarea v-model.trim="clientFeedbackContent" class="client-feedback-input" maxlength="300" placeholder="填写需要调整的内容、风格或交付要求"></textarea>
      <view class="client-feedback-actions">
        <button class="client-feedback-button secondary" @click="submitPortalFeedback">提交修改意见</button>
        <button class="client-feedback-button primary" @click="confirmPortalProposal">确认方案</button>
      </view>
      <view v-if="clientPortalView.feedbacks.length" class="client-feedback-list">
        <view v-for="feedback in clientPortalView.feedbacks" :key="feedback.feedbackId">
          <text>{{ feedback.content }}</text>
          <text>{{ formatOperationDate(feedback.createdAt) }}</text>
        </view>
      </view>
    </view>
  </view>

  <view v-else-if="adminProjectDetail" class="project-operation-page">
    <view class="operation-header">
      <text class="operation-back" @click="closeAdminProjectDetail">‹ 返回运营后台</text>
      <text class="current-role-chip">当前角色：{{ currentRoleLabel }}</text>
      <text class="operation-title">{{ adminProjectDetail.project.projectName }}</text>
      <text class="operation-subtitle">{{ adminProjectDetail.project.projectId }} · {{ getOperationStatusLabel(adminProjectDetail.project.status) }}</text>
    </view>

    <view v-if="canPermission('customer:view')" class="operation-card project-overview-card">
      <text class="operation-section-title">项目与客户</text>
      <view class="operation-info-grid">
        <view><text class="operation-label">客户名称</text><text class="operation-value">{{ adminProjectDetail.project.customerName }}</text></view>
        <view><text class="operation-label">联系方式</text><text class="operation-value">{{ adminProjectDetail.project.customerContact }}</text></view>
        <view><text class="operation-label">截止时间</text><text class="operation-value">{{ adminProjectDetail.project.deadline || '待确认' }}</text></view>
        <view><text class="operation-label">关联线索</text><text class="operation-value">{{ adminProjectDetail.project.leadId || '无' }}</text></view>
      </view>
      <button class="client-portal-entry" @click="openClientPortal">预览客户门户</button>
    </view>

    <view v-if="canPermission('customer:view')" class="operation-card">
      <text class="operation-section-title">需求快照</text>
      <view v-if="adminProjectDetail.lead" class="demand-snapshot">
        <text>公司：{{ adminProjectDetail.lead.companyName }}</text>
        <text>需求类型：{{ getDemandTypeFilterLabel(adminProjectDetail.lead.demandType) }}</text>
        <text>服装品类：{{ adminProjectDetail.lead.clothingCategory || '未填写' }}</text>
        <text>预计数量：{{ adminProjectDetail.lead.quantity || '未填写' }}</text>
        <text>提交时间：{{ formatOperationDate(adminProjectDetail.lead.createdAt) }}</text>
        <text class="demand-description">{{ adminProjectDetail.lead.description || '暂无需求说明' }}</text>
      </view>
      <text v-else class="operation-empty">暂无关联需求快照</text>
    </view>

    <view class="operation-card">
      <text class="operation-section-title">项目状态管理</text>
      <text v-if="!canPermission('project:update')" class="permission-readonly">当前角色仅可查看项目状态</text>
      <view class="operation-status-flow" :class="{ readonly: !canPermission('project:update') }">
        <view v-for="status in adminProjectStatusOptions" :key="status.value" class="operation-status-item" :class="{ active: adminProjectDetail.project.status === status.value }" @click="changeAdminProjectLifecycle(status.value)">
          <text class="operation-status-dot"></text>
          <text>{{ status.label }}</text>
        </view>
      </view>
      <view v-if="canPermission('project:update')" class="operation-form-row">
        <input :value="currentAdminUser.name" class="operation-input" disabled />
        <input v-model.trim="operationForm.remark" class="operation-input" maxlength="120" placeholder="状态调整备注" />
      </view>
    </view>

    <view class="operation-resource-grid">
      <view v-if="canPermission('asset:view')" class="operation-card">
        <text class="operation-section-title">关联素材 · {{ adminProjectDetail.assets.length }}</text>
        <view v-if="adminProjectDetail.assets.length" class="operation-mini-list">
          <view v-for="asset in adminProjectDetail.assets" :key="asset.assetId" class="operation-mini-row">
            <text>{{ asset.assetId }}</text><text>{{ asset.assetType || 'asset' }}</text>
          </view>
        </view>
        <text v-else class="operation-empty">暂无素材</text>
      </view>

      <view v-if="canPermission('task:view')" class="operation-card">
        <text class="operation-section-title">关联任务 · {{ adminProjectDetail.tasks.length }}</text>
        <view v-if="adminProjectDetail.tasks.length" class="operation-mini-list">
          <view v-for="task in adminProjectDetail.tasks" :key="task.taskId" class="operation-mini-row">
            <text>{{ task.taskId }}</text><text>{{ task.status || 'pending' }}</text>
          </view>
        </view>
        <text v-else class="operation-empty">暂无任务</text>
      </view>

      <view v-if="canPermission('project:view')" class="operation-card">
        <text class="operation-section-title">关联批次 · {{ adminProjectDetail.batches.length }}</text>
        <view v-if="adminProjectDetail.batches.length" class="operation-mini-list">
          <view v-for="batch in adminProjectDetail.batches" :key="batch.batchId" class="operation-mini-row">
            <text>{{ batch.batchId }}</text><text>{{ batch.status || 'pending' }}</text>
          </view>
        </view>
        <text v-else class="operation-empty">暂无批次</text>
      </view>

      <view v-if="canViewDelivery" class="operation-card">
        <text class="operation-section-title">交付记录 · {{ adminProjectDetail.deliveries.length }}</text>
        <view v-if="adminProjectDetail.deliveries.length" class="operation-mini-list">
          <view v-for="delivery in adminProjectDetail.deliveries" :key="delivery.deliveryId" class="operation-mini-row">
            <text>{{ delivery.deliveryId }}</text>
            <view class="delivery-operation-side">
              <text>{{ getDashboardDeliveryStatus(delivery.status) }}</text>
              <button v-if="canPermission('delivery:update')" class="delivery-operation-button" @click="openDeliveryOperation(delivery)">交付操作</button>
              <text v-else class="delivery-readonly-label">只读</text>
            </view>
          </view>
        </view>
        <text v-else class="operation-empty">暂无交付</text>
      </view>
    </view>

    <view class="operation-card">
      <text class="operation-section-title">操作日志</text>
      <view v-if="adminProjectDetail.operations.length" class="operation-log-list">
        <view v-for="operation in adminProjectDetail.operations" :key="operation.actionId" class="operation-log-row">
          <view>
            <text class="operation-log-title">{{ getOperationStatusLabel(operation.beforeStatus) }} → {{ getOperationStatusLabel(operation.afterStatus) }}</text>
            <text class="operation-log-meta">{{ operation.operator }} · {{ getOperationRoleLabel(operation.operatorRole) }} · {{ formatOperationDate(operation.createdAt) }}</text>
          </view>
          <text class="operation-log-remark">{{ operation.remark || '无备注' }}</text>
        </view>
      </view>
      <text v-else class="operation-empty">暂无项目操作记录</text>
    </view>
  </view>

  <view v-else class="container">
    <view class="header">
      <view>
        <text class="title">企业运营后台</text>
        <text class="subtitle">统一查看客户需求、项目进度与交付状态</text>
      </view>
      <picker :range="roleOptionLabels" :value="currentRoleIndex" @change="onRoleChange">
        <view class="role-switcher">
          <text class="role-switcher-label">当前角色</text>
          <text class="role-switcher-value">{{ currentRoleLabel }}</text>
        </view>
      </picker>
    </view>

    <view v-if="canRbacView('enterprise.view') || canRbacOperate('member.manage')" class="enterprise-team-admin-card">
      <view class="enterprise-team-admin-head">
        <view>
          <text class="demo-mode-title">企业团队与权限</text>
          <text class="demo-mode-desc">{{ enterpriseName }} · {{ enterpriseCurrentMember.name }} · {{ enterpriseCurrentMember.role }}</text>
        </view>
        <picker :range="enterpriseMemberLabels" :value="enterpriseCurrentMemberIndex" @change="changeEnterpriseMember">
          <view class="enterprise-team-picker">切换成员 ▾</view>
        </picker>
      </view>
      <view class="enterprise-plan-overview">
        <view>
          <text>{{ enterpriseCurrentPlan.name }}</text>
          <text>企业套餐</text>
        </view>
        <view><text>{{ enterpriseMembers.length }}/{{ enterpriseCurrentPlan.memberLimit }}</text><text>成员</text></view>
        <view><text>{{ enterpriseUsageSummary.projectCount }}/{{ enterpriseCurrentPlan.projectLimit }}</text><text>项目</text></view>
        <view><text>{{ enterpriseCurrentPlan.aiQuota }}</text><text>AI额度</text></view>
        <view><text>{{ enterpriseCurrentPlan.storageSpace }}</text><text>存储空间</text></view>
      </view>
      <picker v-if="canRbacOperate('enterprise.manage')" :range="enterprisePlanLabels" :value="enterprisePlanIndex" @change="changeEnterprisePlan">
        <view class="enterprise-plan-picker">切换展示套餐：{{ enterpriseCurrentPlan.name }} ▾</view>
      </picker>
      <view class="enterprise-usage-center">
        <text class="operation-section-title">本月企业用量</text>
        <view class="enterprise-usage-grid">
          <view><text>{{ enterpriseUsageSummary.generationCount }}</text><text>生成次数</text></view>
          <view><text>{{ enterpriseUsageSummary.imageCount }}</text><text>图片数量</text></view>
          <view><text>{{ enterpriseUsageSummary.productCount }}</text><text>商品数量</text></view>
          <view><text>{{ enterpriseUsageSummary.projectCount }}</text><text>项目数量</text></view>
        </view>
        <view class="enterprise-member-usage">
          <text v-for="member in enterpriseUsageSummary.memberUsage" :key="member.memberId">{{ member.name }} · {{ member.role }} · {{ member.usageCount }} 次操作</text>
        </view>
      </view>
      <view class="enterprise-team-permissions">
        <text v-for="permission in enterpriseCurrentPermissions" :key="permission">{{ getEnterprisePermissionLabel(permission) }}</text>
      </view>
      <view class="enterprise-member-list">
        <view v-for="member in enterpriseMembers" :key="member.memberId">
          <text>{{ member.name }}</text>
          <text>{{ member.role }}</text>
        </view>
      </view>
      <view v-if="canRbacOperate('member.manage')" class="enterprise-member-form">
        <input v-model.trim="enterpriseMemberForm.name" maxlength="20" placeholder="成员姓名" />
        <picker :range="enterpriseMemberRoles" :value="enterpriseMemberRoleIndex" @change="changeEnterpriseMemberRole">
          <view class="enterprise-team-picker">{{ enterpriseMemberForm.role }} ▾</view>
        </picker>
        <button @click="addEnterpriseMember">添加成员</button>
      </view>
      <view v-if="canRbacOperate('member.manage')" class="enterprise-role-manager">
        <view class="enterprise-role-manager-head">
          <view>
            <text class="operation-section-title">角色管理</text>
            <text class="enterprise-role-manager-desc">配置企业自定义角色、权限与数据范围</text>
          </view>
          <button class="enterprise-role-reset" @click="resetEnterpriseRoleForm">新增角色</button>
        </view>
        <view class="enterprise-role-list">
          <view v-for="role in enterpriseRoles" :key="role.roleId" class="enterprise-role-card">
            <view>
              <text class="enterprise-role-name">{{ role.roleName }}</text>
              <text class="enterprise-role-meta">{{ role.permissions.length }} 项权限 · {{ getEnterpriseRoleScopeLabel(role.scope) }}</text>
            </view>
            <text v-if="role.builtin" class="enterprise-role-builtin">内置</text>
            <view v-else class="enterprise-role-actions">
              <text @click="editEnterpriseRole(role)">编辑</text>
              <text class="danger" @click="removeEnterpriseRole(role)">删除</text>
            </view>
          </view>
        </view>
        <view class="enterprise-role-editor">
          <input v-model.trim="enterpriseRoleForm.roleName" maxlength="20" placeholder="角色名称，例如：高级设计师" />
          <picker :range="enterpriseRoleScopeLabels" :value="enterpriseRoleScopeIndex" @change="changeEnterpriseRoleScope">
            <view class="enterprise-team-picker">数据范围：{{ getEnterpriseRoleScopeLabel(enterpriseRoleForm.scope) }} ▾</view>
          </picker>
          <input v-if="enterpriseRoleForm.scope === 'custom'" v-model.trim="enterpriseRoleForm.projectIdsText" placeholder="指定项目 ID，多个用逗号分隔" />
          <text class="enterprise-role-editor-label">权限配置</text>
          <view class="enterprise-role-permission-list">
            <text
              v-for="permission in enterpriseRolePermissionOptions"
              :key="permission"
              :class="{ active: enterpriseRoleForm.permissions.includes(permission) }"
              @click="toggleEnterpriseRolePermission(permission)"
            >{{ getEnterprisePermissionLabel(permission) }}</text>
          </view>
          <view class="enterprise-role-editor-actions">
            <button @click="resetEnterpriseRoleForm">取消</button>
            <button class="primary" @click="saveEnterpriseRole">{{ editingEnterpriseRoleId ? '保存修改' : '创建角色' }}</button>
          </view>
        </view>
      </view>
      <view class="enterprise-operation-log-panel">
        <text class="operation-section-title">团队操作日志</text>
        <view v-if="enterpriseRecentOperationLogs.length">
          <view v-for="log in enterpriseRecentOperationLogs" :key="log.logId" class="enterprise-operation-log-row">
            <text>{{ log.operator }}</text>
            <text>{{ formatDashboardDate(log.time) }}</text>
            <text>{{ log.action }} · {{ log.target }}</text>
          </view>
        </view>
        <text v-else class="operation-empty">暂无记录</text>
      </view>
      <view class="enterprise-customer-message-panel">
        <text class="operation-section-title">客户消息</text>
        <view v-if="enterpriseCustomerMessages.length">
          <view v-for="message in enterpriseCustomerMessages" :key="message.messageId" class="enterprise-customer-message-row">
            <view><text>{{ message.author }}</text><text>{{ message.status }}</text></view>
            <text>{{ message.content }}</text>
            <text>{{ formatDashboardDate(message.time) }}</text>
            <view v-if="canRbacOperate('customer.manage')" class="enterprise-customer-message-actions">
              <text v-if="message.status === '待处理'" @click="changeCustomerMessageStatus(message, '处理中')">开始处理</text>
              <text v-if="message.status !== '已完成'" @click="changeCustomerMessageStatus(message, '已完成')">完成</text>
            </view>
          </view>
        </view>
        <text v-else class="operation-empty">暂无客户消息</text>
      </view>
    </view>

    <view v-if="canRbacView('finance.view')" class="enterprise-data-center">
      <view class="enterprise-data-center-head">
        <view>
          <text class="demo-mode-title">企业数据中心 2.0</text>
          <text class="demo-mode-desc">经营、生产、团队、审计与 AI 使用统一视图</text>
        </view>
        <text class="enterprise-data-center-source">LOCAL / MOCK</text>
      </view>
      <view class="enterprise-data-center-section">
        <text class="operation-section-title">经营总览</text>
        <view class="enterprise-data-center-grid overview">
          <view v-for="item in enterpriseDataCenter.overview" :key="item.key"><text>{{ item.value }}</text><text>{{ item.label }}</text></view>
        </view>
      </view>
      <view class="enterprise-data-center-columns">
        <view class="enterprise-data-center-section">
          <text class="operation-section-title">生产分析</text>
          <view class="enterprise-data-center-list">
            <view v-for="item in enterpriseDataCenter.production" :key="item.key"><text>{{ item.label }}</text><text>{{ item.value }}</text></view>
          </view>
        </view>
        <view class="enterprise-data-center-section">
          <text class="operation-section-title">团队效率</text>
          <view class="enterprise-data-center-list">
            <view v-for="item in enterpriseDataCenter.team" :key="item.key"><text>{{ item.label }}</text><text>{{ item.value }}</text></view>
          </view>
        </view>
      </view>
      <view class="enterprise-data-center-columns">
        <view class="enterprise-data-center-section">
          <text class="operation-section-title">审计趋势</text>
          <view class="enterprise-audit-trend">
            <view v-for="item in enterpriseDataCenter.auditTrend" :key="item.key">
              <text>{{ item.label }}</text><text>{{ item.operations }} 次操作</text><text>审批 {{ item.approvals }} · 状态变化 {{ item.statusChanges }}</text>
            </view>
          </view>
        </view>
        <view class="enterprise-data-center-section">
          <text class="operation-section-title">AI 使用趋势</text>
          <view class="enterprise-data-center-grid ai">
            <view v-for="item in enterpriseDataCenter.aiUsage" :key="item.key"><text>{{ item.value }}</text><text>{{ item.label }}</text></view>
          </view>
          <text class="enterprise-data-center-note">预计消耗仅为展示层估算，不连接真实额度。</text>
        </view>
      </view>
    </view>

    <view v-if="canRbacView('project.view')" class="enterprise-approval-admin-card">
      <view class="enterprise-team-admin-head">
        <view>
          <text class="demo-mode-title">企业协作审批</text>
          <text class="demo-mode-desc">{{ enterpriseApprovalTaskSummary.label }}：{{ enterpriseApprovalTaskSummary.value }}</text>
        </view>
        <text class="enterprise-approval-count">{{ enterpriseApprovalItems.length }} 项</text>
      </view>
      <textarea v-if="canRbacOperate('project.approve') || canRbacEdit('design.edit') || canRbacOperate('product.publish')" v-model.trim="enterpriseApprovalComment" maxlength="120" placeholder="填写审批意见（可选）" />
      <view v-if="enterpriseApprovalItems.length" class="enterprise-approval-admin-list">
        <view v-for="item in enterpriseApprovalItems" :key="`${item.targetType}_${item.targetId}`" class="enterprise-approval-admin-row">
          <view>
            <text>{{ getEnterpriseApprovalTypeLabel(item.targetType) }} · {{ item.targetName }}</text>
            <text>{{ item.projectId || '未关联项目' }} · {{ getEnterpriseApprovalStatusLabel(item.status) }}</text>
          </view>
          <view class="enterprise-approval-admin-actions">
            <text v-if="canSubmitEnterpriseApproval(item)" @click="submitEnterpriseApproval(item)">提交</text>
            <text v-if="canReviewEnterpriseApproval(item)" @click="reviewEnterpriseApproval(item, true)">通过</text>
            <text v-if="canReviewEnterpriseApproval(item)" class="danger" @click="reviewEnterpriseApproval(item, false)">驳回</text>
            <text v-if="canPublishEnterpriseProduct(item)" @click="publishEnterpriseProduct(item)">发布</text>
          </view>
        </view>
      </view>
      <text v-else class="operation-empty">暂无审批事项</text>
      <view class="enterprise-approval-admin-timeline">
        <text class="operation-section-title">审批时间线</text>
        <view v-if="enterpriseApprovalLogs.length">
          <view v-for="log in enterpriseApprovalLogs" :key="log.approvalLogId">
            <text>{{ log.operator }} · {{ log.role }}</text>
            <text>{{ formatDashboardDate(log.time) }}</text>
            <text>{{ log.action }} · {{ log.target }}</text>
            <text v-if="log.comment">{{ log.comment }}</text>
          </view>
        </view>
        <text v-else class="operation-empty">暂无审批记录</text>
      </view>
    </view>

    <view v-if="canEnterpriseAccess('business')" class="demo-mode-card">
      <view>
        <text class="demo-mode-title">{{ demoMode.demoEnabled ? '企业 Demo 导航中心' : '企业 Demo 模式' }}</text>
        <text class="demo-mode-desc">{{ demoMode.demoEnabled ? demoNavigatorSummary.companyName + ' · ' + demoNavigatorSummary.projectName : '快速生成一套企业客户演示数据，不影响真实业务数据。' }}</text>
        <view v-if="demoMode.demoEnabled" class="demo-navigator-meta">
          <text>品牌：{{ demoNavigatorSummary.brandName }}</text>
          <text>资产：{{ demoNavigatorSummary.assetCount }}</text>
          <text>生产：{{ demoNavigatorSummary.productionCount }}</text>
          <text>交付：{{ demoNavigatorSummary.deliveryStatus }}</text>
        </view>
      </view>
      <view class="demo-mode-actions">
        <button class="demo-mode-btn primary" @click="startEnterpriseDemoPresentation">开始企业演示</button>
        <button class="demo-mode-btn warning" @click="resetEnterpriseDemoPresentation">重置企业演示</button>
        <button v-if="!demoMode.demoEnabled" class="demo-mode-btn primary" @click="enterAdminDemoMode">开启 Demo</button>
        <button v-else class="demo-mode-btn" @click="exitAdminDemoMode">退出 Demo</button>
        <button class="demo-mode-btn" @click="navigateDemoScene('brand_space')">品牌空间</button>
        <button class="demo-mode-btn" @click="navigateDemoScene('project_space')">项目空间</button>
        <button class="demo-mode-btn" @click="navigateDemoScene('workspace')">工作台</button>
        <button class="demo-mode-btn" @click="navigateDemoScene('production')">生产记录</button>
        <button class="demo-mode-btn" @click="navigateDemoScene('delivery')">交付中心</button>
        <button class="demo-mode-btn" @click="navigateDemoScene('business')">经营驾驶舱</button>
      </view>
    </view>

    <view v-if="canEnterpriseAccess('business') || canEnterpriseAccess('project')" class="dashboard-stats">
      <view class="dashboard-stat-card">
        <text class="dashboard-stat-value">{{ dashboard.stats.leadCount }}</text>
        <text class="dashboard-stat-label">客户数量</text>
      </view>
      <view class="dashboard-stat-card">
        <text class="dashboard-stat-value">{{ dashboard.stats.projectCount }}</text>
        <text class="dashboard-stat-label">项目数量</text>
      </view>
      <view class="dashboard-stat-card">
        <text class="dashboard-stat-value">{{ dashboard.stats.activeProjectCount }}</text>
        <text class="dashboard-stat-label">进行中项目</text>
      </view>
      <view class="dashboard-stat-card warning">
        <text class="dashboard-stat-value">{{ dashboard.stats.pendingDeliveryCount }}</text>
        <text class="dashboard-stat-label">待审核交付</text>
      </view>
      <view class="dashboard-stat-card success">
        <text class="dashboard-stat-value">{{ dashboard.stats.completedDeliveryCount }}</text>
        <text class="dashboard-stat-label">已完成交付</text>
      </view>
      <view class="dashboard-stat-card"><text class="dashboard-stat-value">{{ enterpriseCommerceStats.orderCount }}</text><text class="dashboard-stat-label">订单数量</text></view>
      <view class="dashboard-stat-card success"><text class="dashboard-stat-value">{{ formatEnterpriseMoney(enterpriseCommerceStats.dealAmount) }}</text><text class="dashboard-stat-label">成交金额</text></view>
      <view class="dashboard-stat-card warning"><text class="dashboard-stat-value">{{ formatEnterpriseMoney(enterpriseCommerceStats.pendingAmount) }}</text><text class="dashboard-stat-label">待收金额</text></view>
      <view class="dashboard-stat-card"><text class="dashboard-stat-value">{{ enterpriseCommerceStats.completedCount }}</text><text class="dashboard-stat-label">完成订单</text></view>
    </view>

    <view v-if="canEnterpriseAccess('business') || canEnterpriseAccess('project')" class="dashboard-source-meta">
      <text>已读取资产 {{ dashboard.stats.assetCount }} 项</text>
      <text>任务 {{ dashboard.stats.taskCount }} 个</text>
    </view>

    <view v-if="canRbacView('finance.view')" class="enterprise-commerce-admin-card">
      <view class="enterprise-team-admin-head">
        <view><text class="demo-mode-title">企业报价与订单</text><text class="demo-mode-desc">客户 → 项目 → 报价 → 订单 → 交付</text></view>
        <text class="enterprise-approval-count">报价 {{ enterpriseQuotes.length }} · 订单 {{ enterpriseOrders.length }}</text>
      </view>
      <view class="enterprise-commerce-admin-grid">
        <view>
          <text class="operation-section-title">报价单</text>
          <view v-if="enterpriseQuotes.length" class="enterprise-commerce-admin-list">
            <view v-for="quote in enterpriseQuotes" :key="quote.quoteId">
              <text>{{ quote.customer }} · {{ formatEnterpriseMoney(quote.amount) }}</text>
              <text>{{ quote.items.join('、') }} · {{ getEnterpriseQuoteStatusLabel(quote.status) }}</text>
              <view v-if="canRbacOperate('finance.manage')">
                <text v-if="quote.status === 'draft'" @click="changeEnterpriseQuoteStatus(quote, 'sent')">发送</text>
                <text v-if="quote.status === 'sent'" @click="changeEnterpriseQuoteStatus(quote, 'confirmed')">确认</text>
                <text v-if="quote.status === 'sent'" @click="changeEnterpriseQuoteStatus(quote, 'rejected')">拒绝</text>
                <text v-if="quote.status === 'confirmed'" @click="createEnterpriseOrder(quote)">生成订单</text>
              </view>
            </view>
          </view>
          <text v-else class="operation-empty">暂无报价</text>
        </view>
        <view>
          <text class="operation-section-title">订单</text>
          <view v-if="enterpriseOrders.length" class="enterprise-commerce-admin-list">
            <view v-for="order in enterpriseOrders" :key="order.orderId">
              <text>{{ order.customer }} · {{ formatEnterpriseMoney(order.amount) }}</text>
              <text>{{ getEnterpriseOrderStatusLabel(order.status) }} · 项目 {{ order.projectId || '未关联' }}</text>
              <view v-if="canRbacOperate('finance.manage')">
                <text v-if="order.status === 'pending_payment'" @click="changeEnterpriseOrderStatus(order, 'processing')">标记处理中</text>
                <text v-if="order.status === 'processing'" @click="changeEnterpriseOrderStatus(order, 'completed')">完成</text>
                <text v-if="!['completed', 'closed'].includes(order.status)" @click="changeEnterpriseOrderStatus(order, 'closed')">关闭</text>
              </view>
            </view>
          </view>
          <text v-else class="operation-empty">暂无订单</text>
        </view>
      </view>
    </view>

    <view class="dashboard-card">
      <view class="dashboard-tabs">
        <text v-if="canRbacView('finance.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'businessDashboard' }" @click="dashboardTab = 'businessDashboard'">经营驾驶舱</text>
        <text v-if="canRbacView('finance.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'businessAlerts' }" @click="dashboardTab = 'businessAlerts'">经营预警</text>
        <text v-if="canRbacView('finance.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'businessReport' }" @click="dashboardTab = 'businessReport'">经营报告</text>
        <text v-if="canRbacView('finance.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'businessInsights' }" @click="dashboardTab = 'businessInsights'">经营洞察</text>
        <text v-if="canRbacView('finance.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'businessAdvisor' }" @click="dashboardTab = 'businessAdvisor'">经营助手</text>
        <text v-if="canRbacView('customer.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'customers' }" @click="dashboardTab = 'customers'">客户</text>
        <text v-if="canRbacView('customer.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'leadPipeline' }" @click="dashboardTab = 'leadPipeline'">销售漏斗</text>
        <text v-if="canRbacView('customer.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'salesForecast' }" @click="dashboardTab = 'salesForecast'">销售预测</text>
        <text v-if="canRbacView('customer.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'leadFollows' }" @click="dashboardTab = 'leadFollows'">客户跟进</text>
        <text v-if="canRbacView('project.view') || canRbacView('design.view') || canRbacView('asset.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'projects' }" @click="dashboardTab = 'projects'">项目</text>
        <text v-if="canRbacView('delivery.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'deliveries' }" @click="dashboardTab = 'deliveries'">交付</text>
        <text v-if="canManageApi && canRbacOperate('enterprise.manage')" class="dashboard-tab" :class="{ active: dashboardTab === 'apis' }" @click="dashboardTab = 'apis'">API 管理</text>
        <text v-if="canRbacView('finance.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'orders' }" @click="dashboardTab = 'orders'">订单</text>
        <text v-if="canRbacView('enterprise.view')" class="dashboard-tab" :class="{ active: dashboardTab === 'auditCenter' }" @click="openAuditCenter">审计中心</text>
      </view>

      <view v-if="dashboardTab === 'businessDashboard' && canRbacView('finance.view')" class="business-dashboard-view">
        <view class="business-period-switch">
          <text
            v-for="period in businessDashboardPeriods"
            :key="period.value"
            :class="{ active: businessDashboardPeriod === period.value }"
            @click="setBusinessDashboardPeriod(period.value)"
          >
            {{ period.label }}
          </text>
        </view>
        <view class="business-metric-grid">
          <view><text>新增客户数量</text><text>{{ businessDashboard.leadCount }}</text></view>
          <view><text>销售阶段金额</text><text>{{ formatPipelineAmount(businessDashboard.pipelineAmount) }}</text></view>
          <view><text>预计成交金额</text><text>{{ formatPipelineAmount(businessDashboard.forecastAmount) }}</text></view>
          <view><text>订单金额</text><text>{{ formatPipelineAmount(businessDashboard.orderAmount) }}</text></view>
          <view><text>项目数量</text><text>{{ businessDashboard.projectCount }}</text></view>
          <view><text>交付数量</text><text>{{ businessDashboard.deliveryCount }}</text></view>
        </view>
        <view class="boss-dashboard-panel">
          <view class="boss-dashboard-head">
            <view>
              <text class="business-section-title">企业经营总览</text>
              <text>客户、项目、商品、生产与交付的实时聚合</text>
            </view>
            <text>老板视角</text>
          </view>
          <view class="boss-overview-grid">
            <view v-for="item in enterpriseOperatingSnapshot.overview" :key="item.key">
              <text>{{ item.value }}</text>
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view class="boss-dashboard-grid">
            <view class="boss-section-card">
              <text class="business-section-title">客户转化漏斗</text>
              <view v-for="stage in enterpriseOperatingSnapshot.funnel" :key="stage.label" class="boss-funnel-row">
                <text>{{ stage.label }}</text>
                <view><view :style="{ width: stage.percent + '%' }"></view></view>
                <text>{{ stage.count }}</text>
              </view>
            </view>
            <view class="boss-section-card">
              <text class="business-section-title">本月生产效率</text>
              <view class="boss-efficiency-grid">
                <view><text>{{ enterpriseOperatingSnapshot.efficiency.generatedProducts }}</text><text>生成商品</text></view>
                <view><text>{{ enterpriseOperatingSnapshot.efficiency.generatedAssets }}</text><text>生成素材</text></view>
                <view><text>{{ enterpriseOperatingSnapshot.efficiency.completedDeliveries }}</text><text>完成交付</text></view>
              </view>
              <view class="boss-trend-row">
                <text>新增商品 {{ enterpriseOperatingSnapshot.efficiency.newProducts }}</text>
                <text>完成商品 {{ enterpriseOperatingSnapshot.efficiency.completedProducts }}</text>
                <text>交付商品 {{ enterpriseOperatingSnapshot.efficiency.deliveredProducts }}</text>
              </view>
            </view>
          </view>

          <view class="boss-section-card boss-full-section">
            <view class="boss-section-head">
              <text class="business-section-title">项目风险中心</text>
              <text>{{ enterpriseOperatingSnapshot.risks.length }} 个风险项目</text>
            </view>
            <view v-if="enterpriseOperatingSnapshot.risks.length" class="boss-risk-list">
              <view v-for="risk in enterpriseOperatingSnapshot.risks" :key="risk.projectId" class="boss-risk-row">
                <view>
                  <text>{{ risk.projectName }}</text>
                  <text>{{ risk.reasons.join('、') }}</text>
                </view>
                <text :class="risk.level">{{ risk.level === 'high' ? '高风险' : (risk.level === 'medium' ? '中风险' : '低风险') }}</text>
                <text>{{ risk.suggestedAction }}</text>
              </view>
            </view>
            <text v-else class="boss-empty">暂无数据</text>
          </view>

          <view class="boss-dashboard-grid">
            <view class="boss-section-card">
              <text class="business-section-title">重点客户</text>
              <view v-if="enterpriseOperatingSnapshot.keyCustomers.length">
                <view v-for="customer in enterpriseOperatingSnapshot.keyCustomers" :key="customer.customerName" class="boss-customer-row">
                  <text>{{ customer.customerName }}</text>
                  <text>项目 {{ customer.projectCount }} · 商品 {{ customer.productCount }}</text>
                  <text>交付 {{ customer.confirmedCount }}/{{ customer.deliveryCount }}</text>
                </view>
              </view>
              <text v-else class="boss-empty">暂无数据</text>
            </view>
            <view class="boss-section-card">
              <text class="business-section-title">经营建议</text>
              <view class="boss-advice-list">
                <text v-for="(advice, index) in enterpriseOperatingSnapshot.advice" :key="index">{{ advice }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="business-section-grid">
          <view class="business-section-card">
            <text class="business-section-title">销售阶段分布</text>
            <view v-for="stage in businessDashboard.pipelineStats" :key="stage.value" class="business-stage-row">
              <text>{{ stage.label }}</text>
              <text>{{ stage.count }} 个 · {{ formatPipelineAmount(stage.amount) }}</text>
            </view>
          </view>
          <view class="business-section-card">
            <text class="business-section-title">API 使用情况</text>
            <view class="business-api-summary">
              <view><text>{{ businessDashboard.apiUsage.totalCalls }}</text><text>调用次数</text></view>
              <view><text>{{ businessDashboard.apiUsage.successCalls }}</text><text>成功次数</text></view>
              <view><text>{{ businessDashboard.apiUsage.failedCalls }}</text><text>失败次数</text></view>
              <view><text>{{ businessDashboard.apiUsage.successRate }}%</text><text>成功率</text></view>
            </view>
            <view v-for="action in businessDashboard.apiUsage.topActions" :key="action.action" class="business-stage-row">
              <text>{{ getAnalyticsActionLabel(action.action) }}</text>
              <text>{{ action.totalCalls }} 次 · 消耗 {{ action.totalCost }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'businessAlerts' && canRbacView('finance.view')" class="business-alert-view">
        <view class="business-alert-summary">
          <view><text>全部预警</text><text>{{ businessAlertSummary.total }}</text></view>
          <view><text>高风险</text><text>{{ businessAlertSummary.high }}</text></view>
          <view><text>中风险</text><text>{{ businessAlertSummary.medium }}</text></view>
          <view><text>待处理</text><text>{{ businessAlertSummary.open }}</text></view>
        </view>
        <view v-if="businessAlerts.length" class="business-alert-list">
          <view
            v-for="alert in businessAlerts"
            :key="alert.alertId"
            class="business-alert-row"
            :class="{ active: selectedBusinessAlert && selectedBusinessAlert.alertId === alert.alertId }"
            @click="selectBusinessAlert(alert)"
          >
            <view class="business-alert-main">
              <text class="business-alert-title">{{ alert.title }}</text>
              <text class="business-alert-desc">{{ alert.description }}</text>
              <text class="business-alert-target">目标对象：{{ alert.targetId }}</text>
              <text v-if="alert.operator" class="business-alert-target">处理人：{{ alert.operator }}</text>
            </view>
            <view class="business-alert-side">
              <text class="business-alert-type">{{ getBusinessAlertTypeLabel(alert.type) }}</text>
              <text class="business-alert-level" :class="alert.level">{{ getSalesForecastRiskLabel(alert.level) }}</text>
              <text>{{ formatDashboardDate(alert.createdAt) }}</text>
              <text>{{ getBusinessAlertStatusLabel(alert.status) }}</text>
            </view>
          </view>
        </view>
        <view v-if="selectedBusinessAlert" class="business-alert-detail">
          <view class="business-alert-detail-head">
            <view>
              <text class="business-alert-detail-title">预警详情</text>
              <text class="business-alert-detail-subtitle">{{ selectedBusinessAlert.title }}</text>
            </view>
            <text class="business-alert-status-pill">{{ getBusinessAlertStatusLabel(selectedBusinessAlert.status) }}</text>
          </view>
          <view class="business-alert-detail-grid">
            <view><text>风险类型</text><text>{{ getBusinessAlertTypeLabel(selectedBusinessAlert.type) }}</text></view>
            <view><text>目标对象</text><text>{{ selectedBusinessAlert.targetId }}</text></view>
            <view><text>创建时间</text><text>{{ formatDashboardDate(selectedBusinessAlert.createdAt) }}</text></view>
            <view><text>处理人</text><text>{{ selectedBusinessAlert.operator || '待分配' }}</text></view>
          </view>
          <view class="business-alert-reason">
            <text>风险原因</text>
            <text>{{ selectedBusinessAlert.description }}</text>
          </view>
          <view class="business-alert-action-form">
            <input v-model.trim="businessAlertActionForm.operator" class="business-alert-input" maxlength="20" placeholder="处理人" />
            <picker :range="businessAlertActionTypeLabels" :value="businessAlertActionTypeIndex" @change="onBusinessAlertActionTypeChange">
              <view class="business-alert-picker">{{ getBusinessAlertActionTypeName(businessAlertActionForm.actionType) }}</view>
            </picker>
            <picker :range="businessAlertStatusLabels" :value="businessAlertActionStatusIndex" @change="onBusinessAlertStatusChange">
              <view class="business-alert-picker">{{ getBusinessAlertStatusLabel(businessAlertActionForm.status) }}</view>
            </picker>
            <textarea v-model.trim="businessAlertActionForm.content" class="business-alert-textarea" maxlength="240" placeholder="填写处理说明、沟通结果或下一步安排"></textarea>
            <view class="business-alert-action-buttons">
              <button class="business-alert-action-button ghost" @click="assignSelectedBusinessAlert">分配处理人</button>
              <button class="business-alert-action-button primary" @click="submitBusinessAlertAction">保存处理记录</button>
            </view>
          </view>
          <view class="business-alert-action-list">
            <text class="business-alert-action-title">处理记录</text>
            <view v-if="businessAlertActions.length">
              <view v-for="action in businessAlertActions" :key="action.actionId" class="business-alert-action-row">
                <view>
                  <text>{{ getBusinessAlertActionTypeName(action.actionType) }} · {{ getBusinessAlertStatusLabel(action.status) }}</text>
                  <text>{{ action.content }}</text>
                </view>
                <view>
                  <text>{{ action.operator }}</text>
                  <text>{{ formatDashboardDate(action.createdAt) }}</text>
                </view>
              </view>
            </view>
            <view v-else class="business-alert-action-empty">暂无处理记录</view>
          </view>
        </view>
        <view v-else class="dashboard-empty">暂无经营预警</view>
      </view>

      <view v-else-if="dashboardTab === 'businessReport' && canRbacView('finance.view')" class="business-report-view">
        <view class="business-period-switch">
          <text
            v-for="period in businessDashboardPeriods"
            :key="'report-' + period.value"
            :class="{ active: businessDashboardPeriod === period.value }"
            @click="setBusinessDashboardPeriod(period.value)"
          >
            {{ period.label }}
          </text>
        </view>
        <view class="business-report-hero">
          <view>
            <text class="business-report-title">经营复盘报告</text>
            <text class="business-report-summary">{{ businessReport.summary }}</text>
          </view>
          <view>
            <text>{{ businessReport.period }}</text>
            <text>{{ formatDashboardDate(businessReport.createdAt) }}</text>
          </view>
        </view>
        <view class="business-report-grid">
          <view class="business-report-card">
            <text>新增客户</text>
            <text>{{ businessReport.leadSummary.newLeadCount }}</text>
            <text>累计线索 {{ businessReport.leadSummary.totalLeadCount }}</text>
          </view>
          <view class="business-report-card">
            <text>销售变化</text>
            <text>{{ formatPipelineAmount(businessReport.salesSummary.forecastAmount) }}</text>
            <text>高风险 {{ businessReport.salesSummary.highRiskCount }} · 中风险 {{ businessReport.salesSummary.mediumRiskCount }}</text>
          </view>
          <view class="business-report-card">
            <text>项目状态</text>
            <text>{{ businessReport.projectSummary.projectCount }}</text>
            <text>进行中 {{ businessReport.projectSummary.activeCount }} · 全部 {{ businessReport.projectSummary.totalProjectCount }}</text>
          </view>
          <view class="business-report-card">
            <text>交付情况</text>
            <text>{{ businessReport.deliverySummary.deliveryCount }}</text>
            <text>待审核 {{ businessReport.deliverySummary.pendingReviewCount }}</text>
          </view>
          <view class="business-report-card">
            <text>风险处理</text>
            <text>{{ businessReport.riskSummary.total }}</text>
            <text>处理中 {{ businessReport.riskSummary.processing }} · 已解决 {{ businessReport.riskSummary.resolved }}</text>
          </view>
        </view>
        <view class="business-report-section">
          <text class="business-section-title">销售阶段复盘</text>
          <view v-for="stage in businessReport.salesSummary.stageStats" :key="'report-' + stage.value" class="business-stage-row">
            <text>{{ stage.label }}</text>
            <text>{{ stage.count }} 个 · {{ formatPipelineAmount(stage.amount) }}</text>
          </view>
        </view>
        <view class="business-report-section">
          <text class="business-section-title">风险处理复盘</text>
          <view class="business-report-risk-grid">
            <view><text>高风险</text><text>{{ businessReport.riskSummary.high }}</text></view>
            <view><text>中风险</text><text>{{ businessReport.riskSummary.medium }}</text></view>
            <view><text>待处理</text><text>{{ businessReport.riskSummary.open }}</text></view>
            <view><text>已忽略</text><text>{{ businessReport.riskSummary.ignored }}</text></view>
            <view><text>处理记录</text><text>{{ businessReport.riskSummary.actionCount }}</text></view>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'businessInsights' && canRbacView('finance.view')" class="business-insight-view">
        <view class="business-period-switch">
          <text
            v-for="period in businessDashboardPeriods"
            :key="'insight-' + period.value"
            :class="{ active: businessDashboardPeriod === period.value }"
            @click="setBusinessDashboardPeriod(period.value)"
          >
            {{ period.label }}
          </text>
        </view>
        <view class="business-insight-hero">
          <view>
            <text class="business-insight-title">经营洞察</text>
            <text class="business-insight-summary">基于经营报告、销售预测和风险闭环自动生成，只做分析不修改业务数据。</text>
          </view>
          <view>
            <text>{{ businessInsightSummary.total }}</text>
            <text>洞察数量</text>
          </view>
        </view>
        <view class="business-insight-summary-grid">
          <view><text>重点机会</text><text>{{ businessInsightSummary.opportunityCount }}</text></view>
          <view><text>风险提醒</text><text>{{ businessInsightSummary.riskCount }}</text></view>
          <view><text>行动建议</text><text>{{ businessInsightSummary.actionCount }}</text></view>
        </view>
        <view class="business-insight-section">
          <text class="business-section-title">经营总结</text>
          <view v-for="insight in growthBusinessInsights" :key="insight.insightId" class="business-insight-card" :class="insight.type">
            <text>{{ getBusinessInsightTypeLabel(insight.type) }}</text>
            <text>{{ insight.title }}</text>
            <text>{{ insight.description }}</text>
            <text>{{ insight.suggestion }}</text>
          </view>
        </view>
        <view class="business-insight-section">
          <text class="business-section-title">重点机会</text>
          <view class="business-insight-list">
            <view v-for="insight in opportunityBusinessInsights" :key="insight.insightId" class="business-insight-card" :class="insight.type">
              <text>{{ getBusinessInsightTypeLabel(insight.type) }}</text>
              <text>{{ insight.title }}</text>
              <text>{{ insight.description }}</text>
              <text>{{ insight.suggestion }}</text>
            </view>
          </view>
        </view>
        <view class="business-insight-section">
          <text class="business-section-title">风险提醒</text>
          <view v-for="insight in riskBusinessInsights" :key="insight.insightId" class="business-insight-card" :class="insight.type">
            <text>{{ getBusinessInsightTypeLabel(insight.type) }}</text>
            <text>{{ insight.title }}</text>
            <text>{{ insight.description }}</text>
            <text>{{ insight.suggestion }}</text>
          </view>
        </view>
        <view class="business-insight-section">
          <text class="business-section-title">行动建议</text>
          <view class="business-insight-action-list">
            <view v-for="insight in suggestedBusinessInsights" :key="'suggestion-' + insight.insightId" class="business-insight-action-row">
              <text>{{ getBusinessInsightTypeLabel(insight.type) }}</text>
              <text>{{ insight.suggestion }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'businessAdvisor' && canRbacView('finance.view')" class="business-advisor-view">
        <view class="business-period-switch">
          <text
            v-for="period in businessDashboardPeriods"
            :key="'advisor-' + period.value"
            :class="{ active: businessDashboardPeriod === period.value }"
            @click="setBusinessDashboardPeriod(period.value)"
          >
            {{ period.label }}
          </text>
        </view>
        <view class="business-advisor-hero">
          <view>
            <text class="business-advisor-title">经营助手</text>
            <text class="business-advisor-summary">根据经营洞察生成下一步行动建议，只读分析，不修改客户、项目或交付数据。</text>
          </view>
          <view>
            <text>{{ businessAdvisorSummary.todayCount }}</text>
            <text>今日建议</text>
          </view>
        </view>
        <view class="business-advisor-summary-grid">
          <view><text>全部建议</text><text>{{ businessAdvisorSummary.total }}</text></view>
          <view><text>高优先级</text><text>{{ businessAdvisorSummary.highCount }}</text></view>
          <view><text>风险建议</text><text>{{ businessAdvisorSummary.riskActionCount }}</text></view>
        </view>
        <view class="business-advisor-section">
          <text class="business-section-title">今日建议</text>
          <view class="business-advisor-list">
            <view v-for="advisor in todayBusinessAdvisors" :key="advisor.advisorId" class="business-advisor-card" :class="advisor.priority">
              <view>
                <text>{{ getBusinessAdvisorTypeLabel(advisor.adviceType) }}</text>
                <text>{{ getBusinessAdvisorPriorityLabel(advisor.priority) }}</text>
              </view>
              <text>{{ advisor.title }}</text>
              <text>{{ advisor.description }}</text>
              <text>{{ advisor.action }}</text>
            </view>
          </view>
        </view>
        <view class="business-advisor-section">
          <text class="business-section-title">重点客户</text>
          <view v-for="advisor in salesBusinessAdvisors" :key="'customer-' + advisor.advisorId" class="business-advisor-row">
            <text>{{ advisor.title }}</text>
            <text>{{ advisor.description }}</text>
            <text>{{ advisor.action }}</text>
          </view>
        </view>
        <view class="business-advisor-section">
          <text class="business-section-title">重点项目</text>
          <view v-for="advisor in projectBusinessAdvisors" :key="'project-' + advisor.advisorId" class="business-advisor-row">
            <text>{{ advisor.title }}</text>
            <text>{{ advisor.description }}</text>
            <text>{{ advisor.action }}</text>
          </view>
        </view>
        <view class="business-advisor-section">
          <text class="business-section-title">风险处理建议</text>
          <view v-for="advisor in riskBusinessAdvisors" :key="'risk-' + advisor.advisorId" class="business-advisor-row risk">
            <text>{{ advisor.title }}</text>
            <text>{{ advisor.description }}</text>
            <text>{{ advisor.action }}</text>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'customers' && canRbacView('customer.view') && dashboard.leads.length" class="dashboard-list">
        <view v-for="lead in dashboard.leads" :key="lead.leadId" class="dashboard-row">
          <view class="dashboard-row-main">
            <text class="dashboard-row-title">{{ lead.customerName }}</text>
            <text class="dashboard-row-subtitle">{{ lead.companyName }} · {{ lead.customerContact }}</text>
          </view>
          <view class="dashboard-row-side">
            <text class="dashboard-row-status">{{ getDemandTypeFilterLabel(lead.demandType) }}</text>
            <text class="dashboard-row-time">{{ formatDashboardDate(lead.createdAt) }}</text>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'leadPipeline' && canRbacView('customer.view') && leadPipelineRows.length" class="lead-pipeline-view">
        <view class="lead-pipeline-stats">
          <view v-for="stage in leadPipelineStats" :key="stage.value" class="lead-pipeline-stat">
            <text>{{ stage.label }}</text>
            <text>{{ stage.count }}</text>
            <text>{{ formatPipelineAmount(stage.amount) }}</text>
          </view>
        </view>
        <view class="lead-pipeline-list">
          <view v-for="row in leadPipelineRows" :key="row.leadId" class="lead-pipeline-row">
            <view class="lead-pipeline-main">
              <text class="lead-pipeline-customer">{{ row.customerName }}</text>
              <text class="lead-pipeline-company">{{ row.companyName }} · {{ row.leadId }}</text>
              <text class="lead-pipeline-project">关联项目：{{ row.projectName }}</text>
            </view>
            <view class="lead-pipeline-side">
              <picker :range="leadPipelineStageLabels" :value="getLeadPipelineStageIndex(row.stage)" @change="changeLeadPipelineStage(row, $event)">
                <view class="lead-pipeline-stage">{{ getLeadPipelineStageName(row.stage) }}</view>
              </picker>
              <text>{{ formatPipelineAmount(row.amount) }}</text>
              <text>成交概率 {{ row.probability }}%</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'salesForecast' && canRbacView('customer.view') && salesForecastRows.length" class="sales-forecast-view">
        <view class="sales-forecast-summary">
          <view><text>预计成交金额</text><text>{{ formatPipelineAmount(salesForecastSummary.expectedAmount) }}</text></view>
          <view><text>预测客户数</text><text>{{ salesForecastSummary.forecastCount }}</text></view>
          <view><text>高风险客户</text><text>{{ salesForecastSummary.highRiskCount }}</text></view>
          <view><text>中风险客户</text><text>{{ salesForecastSummary.mediumRiskCount }}</text></view>
        </view>
        <view class="sales-forecast-list">
          <view v-for="row in salesForecastRows" :key="row.forecastId" class="sales-forecast-row">
            <view class="sales-forecast-main">
              <text class="sales-forecast-customer">{{ row.customerName }}</text>
              <text class="sales-forecast-company">{{ row.companyName }} · {{ row.leadId }}</text>
              <text class="sales-forecast-project">关联项目：{{ row.projectName }}</text>
            </view>
            <view class="sales-forecast-side">
              <text class="sales-forecast-stage">{{ getSalesForecastStageName(row.stage) }}</text>
              <text>{{ formatPipelineAmount(row.expectedAmount) }}</text>
              <text>成交概率 {{ row.probability }}%</text>
              <text>预计日期 {{ formatLeadFollowDate(row.expectedDate) }}</text>
              <text class="sales-forecast-risk" :class="row.riskLevel">{{ getSalesForecastRiskLabel(row.riskLevel) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'leadFollows' && canRbacView('customer.view') && leadFollowRows.length" class="lead-follow-center">
        <view v-for="row in leadFollowRows" :key="row.leadId" class="lead-follow-card">
          <view class="lead-follow-head">
            <view>
              <text class="lead-follow-customer">{{ row.customerName }}</text>
              <text class="lead-follow-company">{{ row.companyName }} · {{ row.leadId }}</text>
            </view>
            <text class="lead-follow-status">{{ row.followStatus }}</text>
          </view>
          <view class="lead-follow-grid">
            <view><text>来源类型</text><text>{{ getLeadFollowSourceLabel(row.sourceType) }}</text></view>
            <view><text>兴趣方向</text><text>{{ getLeadFollowInterestLabel(row) }}</text></view>
            <view><text>关联项目</text><text>{{ row.projectName }}</text></view>
            <view><text>下次跟进</text><text>{{ formatLeadFollowDate(row.nextFollowAt) }}</text></view>
          </view>
          <view class="lead-follow-latest">
            <text>最近记录</text>
            <text>{{ row.latestContent }}</text>
          </view>
          <view class="lead-follow-actions">
            <button
              v-for="actionType in leadFollowActionTypes"
              :key="row.leadId + actionType"
              class="lead-follow-action"
              @click="quickCreateLeadFollow(row, actionType)"
            >
              {{ actionType }}
            </button>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'projects' && (canRbacView('project.view') || canRbacView('design.view') || canRbacView('asset.view')) && enterpriseProjectRows.length" class="enterprise-project-list">
        <view v-for="project in enterpriseProjectRows" :key="project.projectId" class="enterprise-project-card" @click="openAdminProjectDetail(project)">
          <view class="enterprise-project-head">
            <view class="dashboard-row-main">
              <text class="dashboard-row-title">{{ project.projectName }}</text>
              <text v-if="canEnterpriseAccess('customer')" class="dashboard-row-subtitle">{{ project.customerName }} · {{ project.contactName }} · {{ project.enterpriseType }}</text>
              <text v-if="canEnterpriseAccess('customer')" class="dashboard-row-subtitle">{{ project.industry }} · {{ project.contact }}</text>
            </view>
            <view v-if="canEnterpriseAccess('follow') || canEnterpriseAccess('project')" class="enterprise-stage-control" @click.stop>
              <picker :range="enterpriseLeadStatusOptions" :value="project.leadStatusIndex" @change="changeEnterpriseProjectLeadStatus(project, $event)">
                <text class="enterprise-lead-status">{{ project.leadStatus }} ▾</text>
              </picker>
              <text>{{ project.leadStatusUpdatedAt }}</text>
            </view>
          </view>
          <view v-if="canEnterpriseAccess('project')" class="enterprise-project-value-grid">
            <view><text>合作类型</text><text>{{ project.cooperationType }}</text></view>
            <view><text>预计产出</text><text>{{ project.expectedOutput }}</text></view>
            <view class="wide"><text>项目目标</text><text>{{ project.projectGoal }}</text></view>
          </view>
          <view v-if="canEnterpriseAccess('project')" class="enterprise-project-timeline">
            <view v-for="stage in project.timeline" :key="stage.key" :class="{ completed: stage.completed, active: stage.active }">
              <text></text>
              <text>{{ stage.label }}</text>
            </view>
          </view>
          <view v-if="canEnterpriseAccess('follow')" class="enterprise-project-follow">
            <text>最近跟进</text>
            <text>{{ project.followContent }}</text>
            <text>下一步：{{ project.nextAction }}</text>
          </view>
          <view class="enterprise-project-footer">
            <text>{{ getDashboardProjectStatus(project.status) }}</text>
            <text>截止 {{ project.deadline || '待确认' }} · {{ formatDashboardDate(project.updatedAt) }}</text>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'deliveries' && canRbacView('delivery.view') && dashboard.deliveries.length" class="dashboard-list">
        <view v-for="delivery in dashboard.deliveries" :key="delivery.deliveryId" class="dashboard-row">
          <view class="dashboard-row-main">
            <text class="dashboard-row-title">{{ delivery.projectId }}</text>
            <text class="dashboard-row-subtitle">{{ getDashboardVersion(delivery.version) }} · {{ delivery.deliveryId }}</text>
          </view>
          <view class="dashboard-row-side">
            <text class="dashboard-row-status delivery">{{ getDashboardDeliveryStatus(delivery.status) }}</text>
            <text class="dashboard-row-time">{{ formatDashboardDate(delivery.createdAt) }}</text>
          </view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'apis' && canRbacOperate('enterprise.manage')" class="api-management-view">
        <view class="api-view-switch">
          <text :class="{ active: apiManagementMode === 'assets' }" @click="apiManagementMode = 'assets'">API 资产</text>
          <text :class="{ active: apiManagementMode === 'brandApps' }" @click="apiManagementMode = 'brandApps'">品牌应用</text>
          <text :class="{ active: apiManagementMode === 'policies' }" @click="apiManagementMode = 'policies'">权限策略</text>
          <text :class="{ active: apiManagementMode === 'docs' }" @click="apiManagementMode = 'docs'">API 文档</text>
          <text :class="{ active: apiManagementMode === 'sandbox' }" @click="apiManagementMode = 'sandbox'">API 沙箱</text>
          <text :class="{ active: apiManagementMode === 'audit' }" @click="apiManagementMode = 'audit'">调用审计</text>
          <text :class="{ active: apiManagementMode === 'analytics' }" @click="apiManagementMode = 'analytics'">API 分析</text>
          <text :class="{ active: apiManagementMode === 'billing' }" @click="apiManagementMode = 'billing'">API 账单</text>
          <text :class="{ active: apiManagementMode === 'usage' }" @click="apiManagementMode = 'usage'">调用记录</text>
        </view>

        <view v-if="apiManagementMode === 'assets'">
          <view class="api-endpoint-section">
            <text class="api-section-title">开放接口</text>
            <view class="api-endpoint-list">
              <text v-for="endpoint in apiEndpoints" :key="endpoint.value">{{ endpoint.value }} · {{ endpoint.label }}</text>
            </view>
          </view>
          <view v-if="enterpriseApis.length" class="api-list">
            <view v-for="api in enterpriseApis" :key="api.apiId" class="api-card">
              <view class="api-card-header">
                <view>
                  <text class="api-card-title">{{ getApiName(api) }}</text>
                  <text class="api-company-name">{{ getApiCompanyName(api.companyId) }}</text>
                </view>
                <text class="api-status" :class="api.status">{{ getApiStatus(api.status) }}</text>
              </view>
              <view class="api-usage-grid">
                <view><text>调用额度</text><text>{{ api.quota }}</text></view>
                <view><text>已使用次数</text><text>{{ api.usedCount }}</text></view>
              </view>
              <view class="api-key-row">
                <text>{{ maskApiKey(api.keyPrefix) }}</text>
                <text>{{ api.apiId }}</text>
              </view>
              <view class="api-permission-list">
                <text v-for="permission in api.permissions" :key="permission">{{ permission }}</text>
              </view>
              <button class="api-status-action" :class="api.status" @click="toggleApiStatus(api)">
                {{ api.status === 'enabled' ? '暂停 API' : '启用 API' }}
              </button>
            </view>
          </view>
          <view v-else class="dashboard-empty">暂无企业 API</view>
        </view>

        <view v-else-if="apiManagementMode === 'brandApps'" class="brand-api-app-view">
          <view class="api-plan-grid">
            <view v-for="plan in apiPlans" :key="plan.planId" class="api-plan-card">
              <view class="api-plan-head">
                <text>{{ plan.name }}</text>
                <text>¥{{ plan.price }}</text>
              </view>
              <text class="api-plan-meta">额度 {{ plan.apiQuota }} · 最多 {{ plan.maxApps }} 个应用</text>
              <view class="api-permission-list">
                <text v-for="permission in plan.permissions" :key="permission">{{ permission }}</text>
              </view>
            </view>
          </view>
          <button v-if="!brandApiEditorOpen" class="brand-api-create" @click="openBrandApiCreator">创建 API 应用</button>
          <view v-if="brandApiEditorOpen" class="brand-api-editor">
            <text class="api-section-title">创建品牌 API 应用</text>
            <input v-model.trim="brandApiForm.appName" class="brand-api-input" maxlength="30" placeholder="应用名称" />
            <text class="brand-api-field-title">所属品牌</text>
            <view class="brand-api-chip-list">
              <text v-for="brand in brandOptions" :key="brand.brandId" class="brand-api-chip" :class="{ active: brandApiForm.brandId === brand.brandId }" @click="brandApiForm.brandId = brand.brandId">{{ brand.brandName }}</text>
            </view>
            <text class="brand-api-field-title">API 套餐</text>
            <view class="brand-api-chip-list">
              <text v-for="plan in apiPlans" :key="plan.planId" class="brand-api-chip" :class="{ active: brandApiForm.planId === plan.planId }" @click="selectBrandApiPlan(plan.planId)">{{ plan.name }}</text>
            </view>
            <text class="brand-api-plan-summary">总额度 {{ selectedBrandApiPlan.apiQuota }} · 剩余额度 {{ selectedBrandApiPlan.apiQuota }} · 最多 {{ selectedBrandApiPlan.maxApps }} 个应用</text>
            <text class="brand-api-field-title">应用权限</text>
            <view class="brand-api-chip-list">
              <text v-for="permission in selectedBrandApiPlan.permissions" :key="permission" class="brand-api-chip" :class="{ active: brandApiForm.permissions.includes(permission) }" @click="toggleBrandApiPermission(permission)">{{ permission }}</text>
            </view>
            <view class="brand-api-editor-actions">
              <button class="api-status-action" @click="closeBrandApiCreator">取消</button>
              <button class="api-status-action paused" @click="saveBrandApiApp">创建并生成测试 Key</button>
            </view>
          </view>

          <view v-if="brandApiApps.length" class="api-list">
            <view v-for="app in brandApiApps" :key="app.appId" class="api-card">
              <view class="api-card-header">
                <view>
                  <text class="api-card-title">{{ app.appName }}</text>
                  <text class="api-company-name">{{ getBrandApiName(app.brandId) }}</text>
                  <text class="api-company-name">{{ getApiPlanName(app.planId) }}</text>
                </view>
                <text class="api-status" :class="app.status">{{ getApiStatus(app.status) }}</text>
              </view>
              <view class="api-usage-grid">
                <view><text>总额度</text><text>{{ app.quota }}</text></view>
                <view><text>剩余额度</text><text>{{ app.remainingQuota }}</text></view>
              </view>
              <text class="brand-api-plan-summary">已使用 {{ app.usedCount }} 次</text>
              <text class="brand-api-field-title credential-title">凭证管理</text>
              <view v-if="getAppCredentials(app.appId).length" class="api-credential-list">
                <view v-for="credential in getAppCredentials(app.appId)" :key="credential.credentialId" class="api-credential-row">
                  <view>
                    <text>{{ getCredentialMask(credential) }}</text>
                    <text>{{ credential.credentialId }}</text>
                  </view>
                  <view>
                    <text class="api-credential-status" :class="credential.status">{{ getCredentialStatus(credential.status) }}</text>
                    <text>{{ getCredentialLastUsed(credential) }}</text>
                  </view>
                </view>
              </view>
              <view v-else class="dashboard-empty compact">尚未生成 API 凭证</view>
              <view class="api-permission-list">
                <text v-for="permission in app.permissions" :key="permission">{{ permission }}</text>
              </view>
              <view class="brand-api-card-actions">
                <button class="api-status-action" :class="app.status" @click="toggleBrandApiStatus(app)">
                  {{ app.status === 'enabled' ? '暂停应用' : '启用应用' }}
                </button>
                <button class="api-status-action paused" @click="simulateBrandApiUsage(app)">模拟调用</button>
                <button class="api-status-action" @click="rotateAppCredential(app)">
                  {{ getActiveAppCredential(app.appId) ? '重新生成 Key' : '生成测试 Key' }}
                </button>
                <button v-if="getActiveAppCredential(app.appId)" class="api-status-action disabled" @click="disableAppCredential(app)">禁用 Key</button>
              </view>
            </view>
          </view>
          <view v-else-if="!brandApiEditorOpen" class="dashboard-empty">暂无品牌 API 应用</view>
        </view>

        <view v-else-if="apiManagementMode === 'policies'" class="api-policy-view">
          <button v-if="!apiPolicyEditorOpen" class="brand-api-create" @click="openApiPolicyCreator">创建权限策略</button>
          <view v-if="apiPolicyEditorOpen" class="brand-api-editor api-policy-editor">
            <text class="api-section-title">{{ editingApiPolicyId ? '编辑权限策略' : '创建权限策略' }}</text>
            <text class="brand-api-field-title">绑定应用</text>
            <view class="brand-api-chip-list">
              <text v-for="app in brandApiApps" :key="app.appId" class="brand-api-chip" :class="{ active: apiPolicyForm.appId === app.appId }" @click="selectApiPolicyApp(app.appId)">{{ app.appName }}</text>
            </view>
            <text class="brand-api-field-title">绑定 API Key</text>
            <view class="brand-api-chip-list">
              <text class="brand-api-chip" :class="{ active: !apiPolicyForm.credentialId }" @click="apiPolicyForm.credentialId = ''">应用级策略</text>
              <text v-for="credential in getAppCredentials(apiPolicyForm.appId)" :key="credential.credentialId" class="brand-api-chip" :class="{ active: apiPolicyForm.credentialId === credential.credentialId }" @click="apiPolicyForm.credentialId = credential.credentialId">{{ getCredentialMask(credential) }}</text>
            </view>
            <text class="brand-api-field-title">策略权限</text>
            <view class="brand-api-chip-list">
              <text v-for="permission in apiPolicyPermissions" :key="permission" class="brand-api-chip" :class="{ active: apiPolicyForm.permissions.includes(permission) }" @click="toggleApiPolicyPermission(permission)">{{ permission }}</text>
            </view>
            <text class="brand-api-field-title">限制条件 JSON</text>
            <textarea v-model="apiPolicyRestrictionsText" class="api-sandbox-request api-policy-restrictions" maxlength="2000" />
            <view class="brand-api-editor-actions">
              <button class="api-status-action" @click="closeApiPolicyEditor">取消</button>
              <button class="api-status-action paused" @click="saveApiPolicy">保存策略</button>
            </view>
          </view>
          <view v-if="apiPolicies.length" class="api-policy-list">
            <view v-for="policy in apiPolicies" :key="policy.policyId" class="api-card api-policy-card">
              <view class="api-card-header">
                <view>
                  <text class="api-card-title">{{ getPolicyAppName(policy.appId) }}</text>
                  <text class="api-company-name">{{ getPolicyCredentialName(policy) }}</text>
                </view>
                <text class="api-status" :class="getPolicyStateClass(policy)">{{ getPolicyStateLabel(policy) }}</text>
              </view>
              <view class="api-permission-list">
                <text v-for="permission in policy.permissions" :key="permission">{{ permission }}</text>
              </view>
              <text class="api-plan-meta">{{ policy.credentialId ? 'Key 级策略' : '应用级策略' }} · 更新于 {{ formatUsageTime(policy.updatedAt) }}</text>
              <view class="brand-api-card-actions">
                <button class="api-status-action" @click="editApiPolicy(policy)">编辑策略</button>
                <button class="api-status-action disabled" @click="removeApiPolicy(policy)">删除策略</button>
              </view>
            </view>
          </view>
          <view v-else-if="!apiPolicyEditorOpen" class="dashboard-empty">暂无权限策略，未配置时继承应用权限</view>
        </view>

        <view v-else-if="apiManagementMode === 'docs'" class="api-doc-view">
          <view v-if="brandApiApps.length" class="api-doc-apps">
            <text v-for="app in brandApiApps" :key="app.appId" class="brand-api-chip" :class="{ active: selectedApiDocAppId === app.appId }" @click="selectApiDocApp(app.appId)">{{ app.appName }}</text>
          </view>
          <view v-if="selectedApiDeveloperContext" class="api-doc-key-card">
            <text class="api-section-title">API Key 使用说明</text>
            <text class="api-doc-key">{{ selectedApiDeveloperContext.maskedApiKey }}</text>
            <text class="api-plan-meta">请求时通过 Authorization: Bearer &lt;API_KEY&gt; 携带测试 Key。本阶段不连接真实网关。</text>
            <view class="api-usage-grid">
              <view><text>总额度</text><text>{{ selectedApiDeveloperContext.quota }}</text></view>
              <view><text>剩余额度</text><text>{{ selectedApiDeveloperContext.remainingQuota }}</text></view>
            </view>
            <view class="api-permission-list">
              <text v-for="permission in selectedApiDeveloperContext.permissions" :key="permission">{{ permission }}</text>
            </view>
          </view>
          <view v-if="apiDocs.length" class="api-doc-layout">
            <view class="api-doc-list">
              <view v-for="doc in apiDocs" :key="doc.docId" class="api-doc-list-item" :class="{ active: selectedApiDoc && selectedApiDoc.docId === doc.docId }" @click="openApiDoc(doc)">
                <text>{{ doc.name }}</text>
                <text>{{ doc.method }} · {{ doc.path }}</text>
              </view>
            </view>
            <view v-if="selectedApiDoc" class="api-doc-detail">
              <view class="api-doc-title-row">
                <text class="api-section-title">{{ selectedApiDoc.name }}</text>
                <text class="api-doc-method">{{ selectedApiDoc.method }}</text>
              </view>
              <text class="api-doc-path">{{ selectedApiDoc.path }}</text>
              <text class="brand-api-field-title">参数说明</text>
              <view v-for="param in selectedApiDoc.params" :key="param.name" class="api-doc-param">
                <text>{{ param.name }}{{ param.required ? ' · 必填' : ' · 可选' }}</text>
                <text>{{ param.description }}</text>
              </view>
              <text class="brand-api-field-title">请求示例</text>
              <text class="api-doc-code" selectable>{{ formatApiDocValue(selectedApiDoc.example.request) }}</text>
              <text class="brand-api-field-title">返回示例</text>
              <text class="api-doc-code" selectable>{{ formatApiDocValue(selectedApiDoc.example.response) }}</text>
            </view>
          </view>
          <view v-else class="dashboard-empty">暂无可用 API 文档，请先创建品牌应用并配置权限</view>
        </view>

        <view v-else-if="apiManagementMode === 'sandbox'" class="api-sandbox-view">
          <view v-if="brandApiApps.length">
            <text class="api-section-title">选择应用</text>
            <view class="api-doc-apps">
              <text v-for="app in brandApiApps" :key="app.appId" class="brand-api-chip" :class="{ active: selectedApiSandboxAppId === app.appId }" @click="selectApiSandboxApp(app.appId)">{{ app.appName }}</text>
            </view>
            <view v-if="selectedApiSandboxContext" class="api-sandbox-form">
              <view class="api-sandbox-summary">
                <text>{{ selectedApiSandboxContext.appName }}</text>
                <text>{{ getApiStatus(selectedApiSandboxContext.status) }} · 剩余 {{ selectedApiSandboxContext.remainingQuota }}</text>
              </view>
              <text class="brand-api-field-title">选择测试接口</text>
              <view class="brand-api-chip-list">
                <text v-for="option in apiSandboxActions" :key="option.action" class="brand-api-chip" :class="{ active: apiSandboxAction === option.action }" @click="selectApiSandboxAction(option.action)">{{ option.label }} · {{ option.cost }}</text>
              </view>
              <text class="brand-api-field-title">请求参数 JSON</text>
              <textarea v-model="apiSandboxRequestText" class="api-sandbox-request" maxlength="4000" />
              <button class="brand-api-create api-sandbox-run" @click="submitApiSandboxTest">模拟调用</button>
            </view>
            <view v-if="apiSandboxResult" class="api-sandbox-result">
              <view class="api-sandbox-result-head">
                <text>最近测试结果</text>
                <text class="api-sandbox-status" :class="apiSandboxResult.status">{{ getSandboxStatus(apiSandboxResult.status) }}</text>
              </view>
              <text class="api-plan-meta">{{ apiSandboxResult.action }} · 消耗 {{ apiSandboxResult.cost }} · {{ formatUsageTime(apiSandboxResult.createdAt) }}</text>
              <text class="api-doc-code" selectable>{{ formatApiDocValue(apiSandboxResult.response) }}</text>
            </view>
            <text class="brand-api-field-title">沙箱测试记录</text>
            <view v-if="apiSandboxRecords.length" class="api-call-list">
              <view v-for="record in apiSandboxRecords" :key="record.sandboxId" class="api-call-row">
                <view class="api-call-main">
                  <text>{{ getBrandUsageAppName(record.appId) }}</text>
                  <text>{{ record.action }} · {{ record.sandboxId }}</text>
                </view>
                <view class="api-call-side">
                  <text class="api-sandbox-status" :class="record.status">{{ getSandboxStatus(record.status) }}</text>
                  <text>消耗 {{ record.cost }} · {{ formatUsageTime(record.createdAt) }}</text>
                </view>
              </view>
            </view>
            <view v-else class="dashboard-empty compact">暂无沙箱测试记录</view>
          </view>
          <view v-else class="dashboard-empty">请先创建品牌 API 应用</view>
        </view>

        <view v-else-if="apiManagementMode === 'audit'" class="api-audit-view">
          <view class="api-usage-stats">
            <view><text>{{ apiAuditStats.todayCount }}</text><text>今日调用次数</text></view>
            <view><text>{{ apiAuditStats.successCount }}</text><text>成功次数</text></view>
            <view><text>{{ apiAuditStats.failedCount }}</text><text>失败次数</text></view>
            <view><text>{{ apiAuditStats.totalCost }}</text><text>总消耗</text></view>
          </view>
          <view v-if="apiAuditRecords.length" class="api-audit-list">
            <view v-for="audit in apiAuditRecords" :key="audit.auditId" class="api-audit-row">
              <view class="api-audit-main">
                <text>{{ getAuditBrandName(audit.brandId) }} · {{ getBrandUsageAppName(audit.appId) }}</text>
                <text>{{ getAuditCredentialName(audit.credentialId) }}</text>
                <text>{{ audit.action }}</text>
              </view>
              <view class="api-audit-side">
                <text class="api-audit-status" :class="audit.status">{{ getAuditStatus(audit.status) }}</text>
                <text>消耗 {{ audit.cost }} · {{ formatUsageTime(audit.createdAt) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="dashboard-empty">暂无 API 调用审计记录</view>
        </view>

        <view v-else-if="apiManagementMode === 'analytics'" class="api-analytics-view">
          <view class="api-analytics-filter-card">
            <text class="api-section-title">企业 API 使用分析</text>
            <text class="brand-api-field-title">时间周期</text>
            <view class="brand-api-chip-list">
              <text v-for="period in apiAnalyticsPeriods" :key="period.value" class="brand-api-chip" :class="{ active: apiAnalyticsFilters.period === period.value }" @click="setApiAnalyticsPeriod(period.value)">{{ period.label }}</text>
            </view>
            <text class="brand-api-field-title">品牌</text>
            <view class="brand-api-chip-list">
              <text class="brand-api-chip" :class="{ active: !apiAnalyticsFilters.brandId }" @click="setApiAnalyticsBrand('')">全部品牌</text>
              <text v-for="brand in brandOptions" :key="brand.brandId" class="brand-api-chip" :class="{ active: apiAnalyticsFilters.brandId === brand.brandId }" @click="setApiAnalyticsBrand(brand.brandId)">{{ brand.brandName }}</text>
            </view>
            <text class="brand-api-field-title">应用</text>
            <view class="brand-api-chip-list">
              <text class="brand-api-chip" :class="{ active: !apiAnalyticsFilters.appId }" @click="setApiAnalyticsApp('')">全部应用</text>
              <text v-for="app in analyticsAppOptions" :key="app.appId" class="brand-api-chip" :class="{ active: apiAnalyticsFilters.appId === app.appId }" @click="setApiAnalyticsApp(app.appId)">{{ app.appName }}</text>
            </view>
            <text class="brand-api-field-title">接口动作</text>
            <view class="brand-api-chip-list">
              <text class="brand-api-chip" :class="{ active: !apiAnalyticsFilters.action }" @click="setApiAnalyticsAction('')">全部接口</text>
              <text v-for="action in apiAnalyticsActions" :key="action" class="brand-api-chip" :class="{ active: apiAnalyticsFilters.action === action }" @click="setApiAnalyticsAction(action)">{{ getAnalyticsActionLabel(action) }}</text>
            </view>
          </view>

          <view class="api-analytics-metrics">
            <view><text>{{ apiAnalytics.totalCalls }}</text><text>调用次数</text></view>
            <view><text>{{ apiAnalytics.successCalls }}</text><text>成功次数</text></view>
            <view><text>{{ apiAnalytics.failedCalls }}</text><text>失败次数</text></view>
            <view><text>{{ apiAnalytics.successRate }}%</text><text>成功率</text></view>
            <view><text>{{ apiAnalytics.totalCost }}</text><text>消耗额度</text></view>
          </view>

          <view class="api-analytics-section">
            <text class="api-section-title">热门接口</text>
            <view class="api-analytics-list">
              <view v-for="item in apiAnalytics.topActions" :key="item.action" class="api-analytics-row">
                <view>
                  <text>{{ getAnalyticsActionLabel(item.action) }}</text>
                  <text>{{ item.action }}</text>
                </view>
                <view>
                  <text>{{ item.totalCalls }} 次</text>
                  <text>成功 {{ item.successCalls }} · 失败 {{ item.failedCalls }} · 消耗 {{ item.totalCost }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="api-analytics-section">
            <text class="api-section-title">失败分析</text>
            <view class="api-analytics-list">
              <view v-for="item in apiAnalytics.failureAnalysis" :key="item.code" class="api-analytics-row failure">
                <view>
                  <text>{{ getAnalyticsFailureLabel(item.code) }}</text>
                  <text>{{ item.code }}</text>
                </view>
                <text>{{ item.count }} 次</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="apiManagementMode === 'billing'" class="api-billing-view">
          <view v-if="selectedApiBilling" class="api-billing-detail">
            <view class="api-billing-detail-head">
              <view>
                <text class="api-section-title">账单详情</text>
                <text>{{ selectedApiBilling.billingId }}</text>
              </view>
              <button class="api-status-action" @click="closeApiBillingDetail">返回账单</button>
            </view>
            <view class="api-billing-detail-grid">
              <view><text>品牌</text><text>{{ getBrandApiName(selectedApiBilling.brandId) }}</text></view>
              <view><text>应用</text><text>{{ getBrandUsageAppName(selectedApiBilling.appId) }}</text></view>
              <view><text>周期</text><text>{{ getApiBillingPeriodLabel(selectedApiBilling) }}</text></view>
              <view><text>调用次数</text><text>{{ selectedApiBilling.totalCalls }}</text></view>
              <view><text>成功 / 失败</text><text>{{ selectedApiBilling.successCalls }} / {{ selectedApiBilling.failedCalls }}</text></view>
              <view><text>额度消耗</text><text>{{ selectedApiBilling.quotaUsed }}</text></view>
              <view><text>审计费用</text><text>{{ selectedApiBilling.totalCost }}</text></view>
              <view><text>生成时间</text><text>{{ formatUsageTime(selectedApiBilling.createdAt) }}</text></view>
            </view>
            <view class="api-billing-source">
              <text>审计记录 {{ selectedApiBilling.auditIds.length }} 条</text>
              <text>消费记录 {{ selectedApiBilling.usageIds.length }} 条</text>
            </view>
          </view>

          <view v-else>
            <view class="api-billing-toolbar">
              <view class="brand-api-chip-list">
                <text v-for="option in apiBillingPeriodOptions" :key="option.value" class="brand-api-chip" :class="{ active: apiBillingPeriodType === option.value }" @click="setApiBillingPeriodType(option.value)">{{ option.label }}</text>
              </view>
              <text>{{ apiBillingPeriod }}</text>
            </view>
            <view class="api-billing-summary">
              <view><text>{{ apiBillingSummary.totalCalls }}</text><text>调用次数</text></view>
              <view><text>{{ apiBillingSummary.successCalls }}</text><text>成功次数</text></view>
              <view><text>{{ apiBillingSummary.failedCalls }}</text><text>失败次数</text></view>
              <view><text>{{ apiBillingSummary.quotaUsed }}</text><text>额度消耗</text></view>
              <view><text>{{ apiBillingSummary.totalCost }}</text><text>审计费用</text></view>
            </view>
            <view v-if="apiBillings.length" class="api-billing-list">
              <view v-for="billing in apiBillings" :key="billing.billingId" class="api-billing-card" @click="openApiBillingDetail(billing)">
                <view class="api-billing-card-head">
                  <view>
                    <text>{{ getBrandApiName(billing.brandId) }}</text>
                    <text>{{ getBrandUsageAppName(billing.appId) }}</text>
                  </view>
                  <text>{{ getApiBillingPeriodLabel(billing) }}</text>
                </view>
                <view class="api-billing-card-grid">
                  <view><text>调用</text><text>{{ billing.totalCalls }}</text></view>
                  <view><text>成功</text><text>{{ billing.successCalls }}</text></view>
                  <view><text>失败</text><text>{{ billing.failedCalls }}</text></view>
                  <view><text>额度</text><text>{{ billing.quotaUsed }}</text></view>
                  <view><text>费用</text><text>{{ billing.totalCost }}</text></view>
                </view>
                <text class="api-billing-detail-link">查看账单详情</text>
              </view>
            </view>
            <view v-else class="dashboard-empty">当前周期暂无 API 账单</view>
          </view>
        </view>

        <view v-else class="api-usage-view">
          <view class="api-usage-stats brand-usage-stats">
            <view><text>{{ brandApiUsageStats.callCount }}</text><text>品牌应用调用</text></view>
            <view><text>{{ brandApiUsageStats.successCount }}</text><text>成功消费</text></view>
            <view><text>{{ brandApiUsageStats.totalCost }}</text><text>累计消耗额度</text></view>
          </view>
          <view v-if="brandApiUsageRecords.length" class="api-call-list brand-api-call-list">
            <view v-for="usage in brandApiUsageRecords" :key="usage.usageId" class="api-call-row">
              <view class="api-call-main">
                <text>{{ getBrandUsageAppName(usage.appId) }}</text>
                <text>{{ getBrandApiName(usage.brandId) }} · {{ usage.action }}</text>
              </view>
              <view class="api-call-side">
                <text class="api-call-status success">消耗 {{ usage.cost }}</text>
                <text>剩余 {{ usage.afterQuota }} · {{ formatUsageTime(usage.createdAt) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="dashboard-empty compact">暂无品牌 API 消费记录</view>
          <view class="api-usage-stats">
            <view><text>{{ apiUsageStats.todayCount }}</text><text>今日调用次数</text></view>
            <view><text>{{ apiUsageStats.successCount }}</text><text>成功次数</text></view>
            <view><text>{{ apiUsageStats.failedCount }}</text><text>失败次数</text></view>
            <view><text>{{ apiUsageStats.totalCost }}</text><text>消耗总额度</text></view>
          </view>
          <view v-if="apiUsageLogs.length" class="api-call-list">
            <view v-for="log in apiUsageLogs" :key="log.logId" class="api-call-row">
              <view class="api-call-main">
                <text>{{ getApiCompanyName(log.companyId) }}</text>
                <text>{{ getUsageApiName(log) }} · {{ getUsageEndpoint(log.endpoint) }}</text>
              </view>
              <view class="api-call-side">
                <text class="api-call-status" :class="log.status">{{ getUsageStatus(log.status) }}</text>
                <text>{{ log.cost }} 积分 · {{ formatUsageTime(log.createdAt) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="dashboard-empty">暂无 API 调用记录</view>
        </view>
      </view>

      <view v-else-if="dashboardTab === 'auditCenter' && canRbacView('enterprise.view')" class="dashboard-list">
        <view v-if="auditLogs.length">
          <view v-for="log in auditLogs" :key="log.auditId" class="dashboard-row">
            <view class="dashboard-row-main">
              <text class="dashboard-row-title">{{ log.operator }} · {{ log.action }}</text>
              <text class="dashboard-row-subtitle">{{ getAuditTargetLabel(log.targetType) }}：{{ log.targetId || '未设置' }}</text>
              <text class="dashboard-row-subtitle">{{ formatAuditChange(log) }}</text>
            </view>
            <view class="dashboard-row-side">
              <text class="dashboard-row-status">{{ log.targetType }}</text>
              <text class="dashboard-row-time">{{ formatDashboardDate(log.createdAt) }}</text>
            </view>
          </view>
        </view>
        <view v-else class="dashboard-empty">暂无记录</view>
      </view>

      <view v-else-if="dashboardTab === 'orders' && canRbacView('finance.view')" class="order-management-view">
        <view class="order-summary-row">
          <text>商业订单</text>
          <text>{{ orders.length }} 笔 · 本阶段不接真实支付</text>
        </view>
        <view class="order-view-switch">
          <text :class="{ active: orderManagementMode === 'orders' }" @click="orderManagementMode = 'orders'">订单列表</text>
          <text :class="{ active: orderManagementMode === 'fulfillments' }" @click="orderManagementMode = 'fulfillments'">履约记录</text>
        </view>

        <view v-if="orderManagementMode === 'orders'">
          <view v-if="orders.length" class="order-list">
            <view v-for="order in orders" :key="order.orderId" class="order-row">
              <view class="order-main">
                <view class="order-title-row">
                  <text>{{ order.productName }}</text>
                  <text>{{ getOrderTypeName(order.orderType) }}</text>
                </view>
                <text class="order-id">{{ order.orderId }}</text>
                <text class="order-customer">{{ getOrderCustomer(order) }}</text>
                <text class="order-target">购买对象：{{ getOrderTargetName(order.targetType) }}</text>
                <text class="order-target">{{ order.targetType === 'project_service' ? '关联项目' : '关联套餐' }}：{{ getOrderPlanName(order) }}</text>
              </view>
              <view class="order-value-group">
                <text class="order-amount">¥{{ formatOrderAmount(order.amount) }}</text>
                <text>{{ order.points }} 积分</text>
              </view>
              <view class="order-status-group">
                <text class="order-status" :class="order.status">{{ getOrderStatusName(order.status) }}</text>
                <text>{{ formatOrderDate(order.createdAt) }}</text>
                <button v-if="canStartFulfillment(order)" class="order-fulfill-button" @click="startOrderFulfillment(order)">模拟履约</button>
                <text v-else-if="getOrderFulfillment(order.orderId)" class="order-fulfilled-label">{{ getFulfillmentStatusName(getOrderFulfillment(order.orderId).status) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="dashboard-empty">暂无订单数据</view>
        </view>

        <view v-else>
          <view v-if="orderFulfillments.length" class="fulfillment-list">
            <view v-for="record in orderFulfillments" :key="record.fulfillmentId" class="fulfillment-row">
              <view class="fulfillment-main">
                <text>{{ record.orderId }}</text>
                <text>{{ getFulfillmentActionName(record.action) }} · {{ getOrderTargetName(record.targetType) }}</text>
                <text>目标对象：{{ record.targetId }}</text>
              </view>
              <view class="fulfillment-side">
                <text class="fulfillment-status" :class="record.status">{{ getFulfillmentStatusName(record.status) }}</text>
                <text>{{ formatFulfillmentDate(record.createdAt) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="dashboard-empty">暂无履约记录</view>
        </view>
      </view>

      <view v-else class="dashboard-empty">暂无{{ dashboardTabLabel }}数据</view>
    </view>

    <view v-if="canPermission('customer:view')" class="lead-section-title">
      <text>线索跟进</text>
      <text>保留原线索筛选、状态更新和转项目能力</text>
    </view>

    <view v-if="canPermission('customer:view')" class="admin-nav-card">
      <button class="nav-btn" @click="goToTaskAdmin">任务管理</button>
      <button class="nav-btn" @click="goToOrderAdmin">订单管理</button>
      <button class="nav-btn" @click="goToProjectAdmin">项目管理</button>
    </view>

    <view v-if="canPermission('customer:view')" class="summary-card">
      <text>线索总数：{{ leads.length }}</text>
      <text>新增线索：{{ newLeadCount }}</text>
      <text>当前可见：{{ filteredLeads.length }}</text>
    </view>

    <view v-if="canPermission('customer:view')" class="filter-card">
      <input
        v-model.trim="searchKeyword"
        class="search-input"
        placeholder="搜索公司、品牌、联系人、手机号或微信"
      />

      <view class="filter-row">
        <picker :range="statusFilterLabels" :value="statusFilterIndex" @change="onStatusFilterChange">
          <view class="filter-chip">跟进状态：{{ getFollowStatusFilterLabel(filterStatus) }}</view>
        </picker>

        <picker :range="demandTypeLabels" :value="demandTypeFilterIndex" @change="onDemandTypeFilterChange">
          <view class="filter-chip">需求类型：{{ getDemandTypeFilterLabel(filterDemandType) }}</view>
        </picker>

        <picker :range="sourcePageLabels" :value="sourcePageFilterIndex" @change="onSourcePageFilterChange">
          <view class="filter-chip">来源页面：{{ getSourcePageFilterLabel(filterSourcePage) }}</view>
        </picker>
      </view>
    </view>

    <view v-if="canPermission('customer:view') && isLoadingLeads && !leads.length" class="loading-state">
      <text>加载线索数据中...</text>
    </view>

    <view v-else-if="canPermission('customer:view') && filteredLeads.length" class="lead-list">
      <view v-for="lead in filteredLeads" :key="lead.leadId" class="lead-card">
        <view class="lead-top">
          <view>
            <text class="lead-company">{{ lead.companyName || '暂无公司' }}</text>
            <text class="lead-meta">{{ lead.contactName || '暂无联系人' }} / {{ lead.mobile || lead.phone || '暂无手机号' }}</text>
          </view>
          <picker :range="statusOptionLabels" :value="statusIndexMap[lead.followStatus] || 0" @change="onStatusChange(lead, $event)">
            <view class="status-chip">{{ getFollowStatusLabel(lead.followStatus) }}</view>
          </picker>
        </view>

        <text class="lead-line">线索编号：{{ lead.leadId }}</text>
        <text class="lead-line">来源：{{ lead.source || 'website' }}</text>
        <text class="lead-line">来源页面：{{ lead.sourcePage || 'website-demand' }}</text>
        <text class="lead-line">手机号：{{ lead.mobile || lead.phone || '暂无' }}</text>
        <text class="lead-line">微信：{{ lead.wechat || '暂无' }}</text>
        <text class="lead-line">品牌：{{ lead.brandName || '暂无' }}</text>
        <text class="lead-line">需求：{{ lead.demandType || '暂无' }}</text>
        <text class="lead-line">期望交付：{{ lead.expectedDeliveryDate || lead.expectedDeliveryTime || '暂无' }}</text>
        <text class="lead-line">服务范围：{{ formatScope(lead.serviceScope) }}</text>
        <text class="lead-line">品类：{{ lead.productCategory || '暂无' }}</text>
        <text class="lead-line">预计数量：{{ lead.expectedVolume || '暂无' }}</text>
        <text class="lead-line">预算：{{ lead.budgetRange || '暂无' }}</text>
        <text class="lead-line">附件：{{ formatAttachmentFileIds(lead.attachmentFileIds) }}</text>
        <text class="lead-line">参考图：{{ formatReferenceImages(lead.referenceImages) }}</text>
        <text class="lead-line">是否需要样衣：{{ lead.needSample ? '需要' : '不需要' }}</text>
        <text class="lead-line">更新时间：{{ lead.updatedAt || '-' }}</text>
        <text class="lead-line">项目关联：{{ formatLeadProject(lead) }}</text>
        <text v-if="getLeadProject(lead)" class="lead-line">项目状态：{{ getProjectStatusLabel(getLeadProject(lead).status) }}</text>
        <text v-if="getLeadProject(lead)" class="lead-line">项目阶段：{{ getProjectStageLabel(getLeadProject(lead).stage) }}</text>
        <text class="lead-desc">{{ lead.requirementText || lead.description || '暂无需求说明' }}</text>
        <view class="card-actions">
          <button class="detail-btn" @click="goToLeadDetail(lead)">查看详情</button>
          <button class="project-btn" @click="onProjectActionForLead(lead)">
            {{ getLeadProjectState(lead).hasProject ? '查看项目' : '转为项目' }}
          </button>
        </view>
      </view>
    </view>

    <view v-else-if="canPermission('customer:view') && hasAttemptedLeadLoad" class="empty-state">
      <text class="empty-title">{{ leads.length ? '暂无匹配线索' : '暂无线索' }}</text>
      <text class="empty-desc">{{ leads.length ? '可以调整筛选条件或搜索关键词。' : '先提交一条官网或小程序需求。' }}</text>
      <text v-if="leadLoadError" class="empty-desc">加载失败：{{ leadLoadError }}</text>
      <button v-if="leadLoadError" class="retry-btn" @click="loadLeads">重试</button>
    </view>

    <view v-if="cloudAlphaDevelopment" class="cloud-alpha-panel">
      <view class="cloud-alpha-head">
        <view>
          <text class="cloud-alpha-title">Cloud Alpha 验收</text>
          <text class="cloud-alpha-desc">仅开发环境可见，仅验证 Enterprise、Member、Project。</text>
        </view>
        <text class="cloud-alpha-badge">DEV ONLY</text>
      </view>

      <view class="cloud-alpha-context">
        <view><text>DATA_SOURCE_MODE</text><text>{{ cloudAlphaConfiguredMode }}</text></view>
        <view><text>当前 enterpriseId</text><text>{{ cloudAlphaCurrentEnterpriseId }}</text></view>
        <view><text>当前 memberId</text><text>{{ cloudAlphaMemberId || '-' }}</text></view>
        <view><text>企业来源</text><text>{{ cloudAlphaEnterpriseSource || '-' }}</text></view>
        <view><text>当前 Provider</text><text>{{ cloudAlphaProviderMode }}</text></view>
        <view><text>云函数</text><text>{{ cloudAlphaFunctionName }}</text></view>
      </view>

      <view class="cloud-alpha-session">
        <button v-if="!cloudAlphaSessionEnabled" class="cloud-alpha-session-button primary" @click="enableCloudAlphaSession">本次会话使用 cloud</button>
        <button v-else class="cloud-alpha-session-button" @click="disableCloudAlphaSession">结束 Cloud 验收会话</button>
        <text>{{ cloudAlphaSessionEnabled ? 'Cloud 会话已开启，不会写回 local。' : '当前为安全模式，验收操作不会调用云函数。' }}</text>
      </view>

      <text v-if="cloudAlphaIdentityMessage" class="cloud-alpha-identity-message">{{ cloudAlphaIdentityMessage }}</text>
      <view v-if="cloudAlphaSessionEnabled && !cloudAlphaMemberId" class="cloud-alpha-recovery">
        <input v-model.trim="cloudAlphaRecoveryEnterpriseId" maxlength="80" placeholder="已有账号可粘贴 alpha_enterprise_* 进行安全恢复" />
        <button :disabled="!!cloudAlphaRunning || !cloudAlphaRecoveryEnterpriseId" @click="recoverCloudAlphaExistingEnterprise">恢复已有企业</button>
      </view>

      <view class="cloud-alpha-actions">
        <button :disabled="!cloudAlphaSessionEnabled || !!cloudAlphaRunning" @click="createCloudAlphaEnterprise">1. 创建测试企业</button>
        <button :disabled="!cloudAlphaSessionEnabled || !cloudAlphaEnterpriseId || !cloudAlphaMemberId || !!cloudAlphaRunning" @click="repeatCloudAlphaEnterprise">2. 重复创建</button>
        <button :disabled="!cloudAlphaSessionEnabled || !cloudAlphaEnterpriseId || !cloudAlphaMemberId || !!cloudAlphaRunning" @click="createCloudAlphaProject">3. 创建测试项目</button>
        <button :disabled="!cloudAlphaSessionEnabled || !cloudAlphaEnterpriseId || !cloudAlphaMemberId || !!cloudAlphaRunning" @click="queryCloudAlphaProjects">4. 查询项目</button>
        <button :disabled="!cloudAlphaSessionEnabled || !cloudAlphaEnterpriseId || !cloudAlphaMemberId || !cloudAlphaProjectId || !!cloudAlphaRunning" @click="updateCloudAlphaProject">5. 更新项目</button>
        <button :disabled="!cloudAlphaSessionEnabled || !cloudAlphaEnterpriseId || !cloudAlphaMemberId || !cloudAlphaProjectId || !!cloudAlphaRunning" @click="removeCloudAlphaProject">6. 删除项目</button>
      </view>

      <text v-if="cloudAlphaRunning" class="cloud-alpha-running">正在执行：{{ cloudAlphaRunning }}</text>
      <view v-if="cloudAlphaResults.length" class="cloud-alpha-results">
        <view v-for="item in cloudAlphaResults" :key="item.resultId" class="cloud-alpha-result" :class="{ success: item.ok }">
          <view class="cloud-alpha-result-head">
            <text>{{ item.operation }}</text>
            <text>{{ item.ok ? 'PASS' : 'FAIL' }}</text>
          </view>
          <view class="cloud-alpha-result-grid">
            <text>ok：{{ item.ok }}</text>
            <text>status：{{ item.status }}</text>
            <text>errorCode：{{ item.errorCode || '-' }}</text>
            <text>耗时：{{ item.elapsedMs }} ms</text>
          </view>
          <text class="cloud-alpha-result-message">message：{{ item.message || '-' }}</text>
          <text v-if="item.summary" class="cloud-alpha-result-message">验收摘要：{{ item.summary }}</text>
          <view v-if="item.debug" class="cloud-alpha-debug">
            <text>安全 debug</text>
            <text v-for="(value, key) in item.debug" :key="key">{{ key }}：{{ value }}</text>
          </view>
        </view>
      </view>
      <text v-else class="cloud-alpha-empty">尚未执行 Cloud Alpha 验收。</text>
    </view>
  </view>
  </view>
</template>

<script>
import {
  LEAD_FOLLOW_STATUS,
  LEAD_FOLLOW_STATUS_DISPLAY,
  getLeadFollowStatusLabel,
  getProjectStageLabel,
  getProjectStatusLabel
} from '../../utils/constants'
import {
  convertAdminLeadToProject,
  getAdminLeadList,
  getAdminLeadProjectStateMap,
  getAdminProjectList,
  updateAdminLeadFollowStatus
} from '../../utils/service/adminRepository'
import {
  formatDashboardTime,
  getAdminDashboardData,
  getDashboardDeliveryStatusLabel,
  getDashboardProjectStatusLabel,
  getDashboardVersionLabel
} from '../../utils/admin/adminDashboard'
import {
  LEAD_FOLLOW_ACTION_TYPES,
  buildLeadFollowRows,
  createLeadFollow,
  listLeadFollows
} from '../../utils/admin/leadFollowRepository'
import {
  LEAD_PIPELINE_STAGES,
  buildLeadPipelineRows,
  buildLeadPipelineStats,
  getLeadPipelineStageLabel,
  listLeadPipelines,
  updateLeadPipeline
} from '../../utils/admin/leadPipelineRepository'
import {
  buildSalesForecastRows,
  buildSalesForecastSummary,
  getSalesForecastStageLabel
} from '../../utils/admin/salesForecastRepository'
import {
  BUSINESS_DASHBOARD_PERIODS,
  buildBusinessDashboard
} from '../../utils/admin/businessDashboardRepository'
import {
  buildBusinessReport
} from '../../utils/admin/businessReportRepository'
import {
  buildBusinessInsightSummary,
  buildBusinessInsights
} from '../../utils/admin/businessInsightRepository'
import {
  buildBusinessAdvisorSummary,
  buildBusinessAdvisors
} from '../../utils/admin/businessAdvisorRepository'
import {
  disableDemoMode,
  enableDemoMode,
  getDemoEnterpriseData,
  getDemoMode,
  resetEnterpriseDemoMode
} from '../../utils/demo/demoMode'
import {
  buildDemoNavigator,
  buildDemoNavigatorSummary
} from '../../utils/demo/demoNavigator'
import {
  buildBusinessAlerts,
  buildBusinessAlertSummary
} from '../../utils/admin/businessAlertRepository'
import {
  BUSINESS_ALERT_ACTION_STATUSES,
  BUSINESS_ALERT_ACTION_TYPES,
  assignBusinessAlert,
  createBusinessAlertAction,
  getBusinessAlertActionState,
  getBusinessAlertActionStatusLabel,
  getBusinessAlertActionTypeLabel,
  getBusinessAlertActions,
  updateBusinessAlertStatus
} from '../../utils/admin/businessAlertActionRepository'
import {
  ADMIN_PROJECT_STATUS_OPTIONS,
  formatProjectOperationTime,
  getAdminProjectOperationDetail,
  getAdminProjectStatusLabel,
  updateAdminProjectLifecycle
} from '../../utils/admin/projectOperation'
import {
  getAdminRoleLabel,
  getCurrentAdminUser,
  getMockAdminUsers,
  hasAdminPermission,
  setCurrentAdminRole
} from '../../utils/admin/roleRepository'
import {
  confirmClientProposal,
  getClientPortalView,
  getClientProjectStatusLabel,
  getClientVersionLabel,
  submitClientFeedback
} from '../../utils/project/clientPortal'
import {
  BRAND_API_APP_PERMISSIONS,
  ENTERPRISE_API_ENDPOINTS,
  ENTERPRISE_API_STATUS,
  createBrandApiApp,
  getBrandApiApps,
  getBrandApiDeveloperContext,
  getEnterpriseApiCompanyName,
  getEnterpriseApiName,
  getEnterpriseApis,
  getEnterpriseApiStatusLabel,
  maskEnterpriseApiKey,
  updateBrandApiAppStatus,
  updateEnterpriseApiStatus
} from '../../utils/admin/apiRepository'
import { getApiDocById, getApiDocs } from '../../utils/admin/apiDocRepository'
import {
  API_CREDENTIAL_STATUS,
  createApiCredential,
  disableApiCredential,
  formatApiCredentialMask,
  getActiveApiCredential,
  getApiCredentials,
  markApiCredentialUsed,
  regenerateApiCredential,
  validateApiCredentialUsage
} from '../../utils/admin/apiCredentialRepository'
import {
  API_POLICY_PERMISSIONS,
  createApiPolicy,
  deleteApiPolicy,
  getApiPolicies,
  updateApiPolicy
} from '../../utils/admin/apiPolicyRepository'
import {
  createApiAuditRecord,
  getApiAuditRecords,
  getApiAuditStats,
  getApiAuditStatusFromCode,
  getApiAuditStatusLabel
} from '../../utils/admin/apiAuditRepository'
import {
  API_ANALYTICS_ACTIONS,
  buildApiAnalytics,
  getApiAnalyticsPeriodOptions
} from '../../utils/admin/apiAnalyticsRepository'
import {
  getApiBillingPeriodOptions,
  getApiBillings,
  getCurrentApiBillingPeriod
} from '../../utils/admin/billingRepository'
import {
  getApiSandboxActionOptions,
  getApiSandboxDefaultRequest,
  getApiSandboxRecords,
  getApiSandboxStatusLabel,
  runApiSandboxTest as executeApiSandboxTest
} from '../../utils/admin/apiSandboxRepository'
import { getBrands, updateBrandWorkspaceRelations } from '../../utils/brand/brandRepository'
import { getDeliveryPackages } from '../../utils/workspace/deliveryPackage'
import {
  ENTERPRISE_DATA_SOURCE_LOCAL,
  ENTERPRISE_SCHEMA_VERSION,
  getList as getEnterpriseRepositoryList,
  normalizeSaasRecord,
  update as updateEnterpriseRepository
} from '../../utils/repository/enterpriseRepository'
import { normalize as normalizeCustomerRepositoryRecord } from '../../utils/repository/customerRepository'
import { getProjectMeta, getProjectMetaMap, normalize as normalizeProjectRepositoryRecord, updateProjectMeta } from '../../utils/repository/projectRepository'
import { getList as getProductPackageRepositoryList } from '../../utils/repository/productPackageRepository'
import { normalize as normalizeDeliveryRepositoryRecord } from '../../utils/repository/deliveryRepository'
import { getRolePermissions as getLegacyRolePermissions } from '../../utils/service/enterpriseService'
import { getRolePermissions as getRbacRolePermissions } from '../../utils/auth/permissionService'
import {
  ROLE_PERMISSION_OPTIONS,
  createRole,
  deleteRole,
  getRoles,
  updateRole
} from '../../utils/auth/roleService'
import { canEdit as guardCanEdit, canOperate as guardCanOperate, canView as guardCanView } from '../../utils/auth/permissionGuard'
import '../../utils/service/projectService'
import { getQuotes, transitionQuote } from '../../utils/service/quoteService'
import { calculateOrderStatistics, createOrderFromQuote, getOrders as getEnterpriseOrders, transitionOrder } from '../../utils/service/orderService'
import { getAuditLogs, recordAudit } from '../../utils/audit/auditService'
import { getWorkspaceProductions } from '../../utils/workspace/workspaceProduction'
import { API_PLAN_IDS, getApiPlanById, getApiPlans, selectApiPlan } from '../../utils/admin/apiPlanRepository'
import {
  formatApiUsageTime,
  getApiCallStatusLabel,
  getApiEndpointLabel,
  getApiUsageLogs,
  getApiUsageStats,
  getBrandApiUsageRecords,
  getBrandApiUsageStats,
  linkBrandApiUsageAudit
} from '../../utils/admin/apiUsageRepository'
import { consumeBrandApiUsage } from '../../utils/admin/apiUsageFlow'
import {
  formatOrderTime,
  getOrderApiPlanId,
  getOrderCustomerLabel,
  getOrders,
  getOrderStatusLabel,
  getOrderTargetTypeLabel,
  getOrderTypeLabel
} from '../../utils/order/orderRepository'
import {
  canFulfillOrder,
  createMockOrderFulfillment,
  formatFulfillmentTime,
  getFulfillmentActionLabel,
  getOrderFulfillments,
  getFulfillmentStatusLabel
} from '../../utils/order/orderFulfillment'
import cloudProvider, {
  clearCloudSessionEnterpriseId,
  getCloudFunctionName,
  getCloudSessionEnterpriseId,
  restoreCloudSessionIdentity,
  setCloudSessionEnterpriseId
} from '../../utils/data-provider/cloudProvider'
import {
  DATA_PROVIDER_CLOUD,
  DATA_PROVIDER_LOCAL,
  getConfiguredDataSourceMode,
  getDataProviderName,
  isDataProviderDevelopment,
  useDataProvider
} from '../../utils/data-provider/dataProvider'
import { loadPlatformAdminCenter } from '../../utils/admin/platformAdminRepository'
import { ENTERPRISE_CASES } from '../../utils/website/caseRepository'
import { WEBSITE_ARTICLES } from '../../utils/website/articleRepository'

const getFollowStatusLabel = getLeadFollowStatusLabel
const FOLLOW_STATUS_OPTIONS = LEAD_FOLLOW_STATUS_DISPLAY
const PLATFORM_ADMIN_SECTIONS = Object.freeze([
  { key: 'overview', label: '运营总览' },
  { key: 'users', label: '用户管理' },
  { key: 'enterprises', label: '企业管理' },
  { key: 'tasks', label: 'AI任务' },
  { key: 'projects', label: '项目与交付' },
  { key: 'patterns', label: '版型与训练数据' },
  { key: 'quota', label: '额度记录' },
  { key: 'tickets', label: '工单中心' },
  { key: 'models', label: '模型发布' },
  { key: 'config', label: '系统配置' },
  { key: 'content', label: '内容管理' },
  { key: 'audit', label: '审计日志' }
])

const ENTERPRISE_LEAD_STATUS_LABELS = Object.freeze({
  new_lead: '初次接触',
  contacted: '初次接触',
  demo: 'Demo演示',
  demo_presented: 'Demo演示',
  requirement_confirmed: '需求确认',
  solution_sent: '方案报价',
  quotation: '方案报价',
  cooperating: '合作中',
  in_progress: '合作中',
  won: '已成交'
})
const ENTERPRISE_LEAD_STATUS_OPTIONS = Object.freeze([
  '初次接触',
  'Demo演示',
  '需求确认',
  '方案报价',
  '合作中',
  '已成交'
])
const ENTERPRISE_OPERATION_LOG_STORAGE_KEY = 'diebiandesign_enterprise_operation_logs_v1'
const CLOUD_ALPHA_IDENTITY_STORAGE_KEY = 'diebiandesign_cloud_alpha_identity_v1'
const ENTERPRISE_APPROVAL_STORAGE_KEY = 'diebiandesign_enterprise_approvals_v1'
const CUSTOMER_PORTAL_STORAGE_KEY = 'diebiandesign_customer_portal_v1'
const ENTERPRISE_QUOTE_ITEM_OPTIONS = Object.freeze(['AI设计服务', '商品视觉生产', '详情页制作', '企业服务'])
const ENTERPRISE_MEMBER_ROLES = Object.freeze(['管理员', '老板', '项目经理', '设计师', '运营', '销售'])
const ENTERPRISE_PLAN_OPTIONS = Object.freeze([
  { planId: 'basic', name: '基础版', memberLimit: 5, projectLimit: 3, aiQuota: 500, storageSpace: '10 GB' },
  { planId: 'professional', name: '专业版', memberLimit: 20, projectLimit: 20, aiQuota: 3000, storageSpace: '100 GB' },
  { planId: 'enterprise', name: '企业版', memberLimit: '不限', projectLimit: '不限', aiQuota: '按需配置', storageSpace: '1 TB' }
])
function normalizeEnterpriseRecord(record = {}, options = {}) {
  return normalizeSaasRecord(record, options)
}

function getEnterpriseTeamState() {
  return getEnterpriseRepositoryList()[0]
}

function saveEnterpriseTeamState(state = {}) {
  const current = getEnterpriseTeamState()
  return updateEnterpriseRepository(current.enterpriseId, { ...state, updatedBy: state.currentMemberId || current.currentMemberId }) || current
}

function getEnterpriseOperationLogs() {
  try {
    const value = uni.getStorageSync(ENTERPRISE_OPERATION_LOG_STORAGE_KEY)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function appendEnterpriseOperationLog(input = {}) {
  const logs = getEnterpriseOperationLogs()
  const log = {
    logId: input.logId || `enterprise_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operator: input.operator || '默认管理员',
    action: input.action || '查看',
    target: input.target || '企业后台',
    time: input.time || new Date().toISOString(),
    projectId: input.projectId || ''
  }
  try {
    uni.setStorageSync(ENTERPRISE_OPERATION_LOG_STORAGE_KEY, [log, ...logs].slice(0, 100))
  } catch (error) {
    // Collaboration logs must not block admin actions.
  }
  return log
}

function getEnterpriseApprovalState() {
  const emptyState = { designApprovals: {}, productApprovals: {}, deliveryApprovals: {}, approvalLogs: [] }
  try {
    const value = uni.getStorageSync(ENTERPRISE_APPROVAL_STORAGE_KEY)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState
    return {
      designApprovals: value.designApprovals && typeof value.designApprovals === 'object' ? value.designApprovals : {},
      productApprovals: value.productApprovals && typeof value.productApprovals === 'object' ? value.productApprovals : {},
      deliveryApprovals: value.deliveryApprovals && typeof value.deliveryApprovals === 'object' ? value.deliveryApprovals : {},
      approvalLogs: Array.isArray(value.approvalLogs) ? value.approvalLogs : []
    }
  } catch (error) {
    return emptyState
  }
}

function updateEnterpriseApproval(input = {}) {
  const state = getEnterpriseApprovalState()
  const mapNames = { design: 'designApprovals', product: 'productApprovals', delivery: 'deliveryApprovals' }
  const statusFields = { design: 'designApprovalStatus', product: 'publishStatus', delivery: 'deliveryApprovalStatus' }
  const mapName = mapNames[input.targetType]
  const statusField = statusFields[input.targetType]
  if (!mapName || !statusField || !input.targetId) return state
  const current = state[mapName][input.targetId] || {}
  const record = {
    ...current,
    targetId: input.targetId,
    targetType: input.targetType,
    targetName: input.targetName || current.targetName || input.targetId,
    projectId: input.projectId || current.projectId || '',
    [statusField]: input.status,
    updatedAt: new Date().toISOString()
  }
  const approvalLog = {
    approvalLogId: `approval_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operator: input.operator || '默认管理员',
    role: input.role || '老板',
    action: input.action || '更新审批状态',
    target: record.targetName,
    comment: input.comment || '',
    time: record.updatedAt,
    projectId: record.projectId,
    targetType: input.targetType,
    targetId: input.targetId
  }
  const nextState = {
    ...state,
    [mapName]: { ...state[mapName], [input.targetId]: record },
    approvalLogs: [approvalLog, ...state.approvalLogs].slice(0, 200)
  }
  try {
    uni.setStorageSync(ENTERPRISE_APPROVAL_STORAGE_KEY, nextState)
  } catch (error) {
    // Approval metadata must never block existing admin flows.
  }
  const team = getEnterpriseTeamState()
  recordAudit({
    enterpriseId: team.enterpriseId,
    userId: team.currentMemberId,
    operator: input.operator,
    action: input.action || '更新审批状态',
    targetType: 'approval',
    targetId: input.targetId,
    before: { status: current[statusField] || 'draft' },
    after: { status: input.status }
  })
  return nextState
}

function getCustomerPortalState() {
  const emptyState = { customerFeedbacks: [], customerMessages: [], taskReminders: [] }
  try {
    const value = uni.getStorageSync(CUSTOMER_PORTAL_STORAGE_KEY)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState
    return {
      customerFeedbacks: Array.isArray(value.customerFeedbacks) ? value.customerFeedbacks : [],
      customerMessages: Array.isArray(value.customerMessages) ? value.customerMessages : [],
      taskReminders: Array.isArray(value.taskReminders) ? value.taskReminders : []
    }
  } catch (error) {
    return emptyState
  }
}

function updateCustomerMessageStatus(messageId = '', status = '待处理') {
  const state = getCustomerPortalState()
  const nextState = {
    ...state,
    customerMessages: state.customerMessages.map((item) => item.messageId === messageId ? { ...item, status } : item)
  }
  try {
    uni.setStorageSync(CUSTOMER_PORTAL_STORAGE_KEY, nextState)
  } catch (error) {
    // Customer collaboration status is display-only metadata.
  }
  return nextState
}

function getEnterpriseCommerceState() {
  return { quotes: getQuotes(), orders: getEnterpriseOrders(), schemaVersion: ENTERPRISE_SCHEMA_VERSION, dataSource: ENTERPRISE_DATA_SOURCE_LOCAL }
}

function updateEnterpriseQuoteStatus(quoteId = '', status = 'draft') {
  const team = getEnterpriseTeamState()
  transitionQuote(quoteId, status, { userId: team.currentMemberId })
  return getEnterpriseCommerceState()
}

function createEnterpriseOrderFromQuote(quote = {}) {
  const team = getEnterpriseTeamState()
  const order = createOrderFromQuote(quote, { enterpriseId: team.enterpriseId, userId: team.currentMemberId })
  return { state: getEnterpriseCommerceState(), order }
}

function updateEnterpriseOrderStatus(orderId = '', status = 'pending_payment') {
  const team = getEnterpriseTeamState()
  transitionOrder(orderId, status, { userId: team.currentMemberId })
  return getEnterpriseCommerceState()
}

function readEnterpriseProjectMetaMap() {
  return getProjectMetaMap()
}

function getEnterpriseProjectMeta(projectId = '') {
  return getProjectMeta(projectId) || {}
}

function saveEnterpriseProjectMeta(projectId = '', patch = {}) {
  if (!projectId) return {}
  const team = getEnterpriseTeamState()
  return updateProjectMeta(projectId, { ...patch, enterpriseId: team.enterpriseId, userId: team.currentMemberId, updatedBy: team.currentMemberId }) || {}
}

function readEnterpriseProductPackages() {
  return getProductPackageRepositoryList()
}

function readEnterpriseDeliveryPackages(projectId) {
  return getDeliveryPackages(projectId).map((item) => normalizeDeliveryRepositoryRecord(item))
}

function isCurrentMonth(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function getProductPackageAssetCount(productPackage = {}) {
  if (Array.isArray(productPackage.assets)) return productPackage.assets.length
  if (productPackage.assets && typeof productPackage.assets === 'object') {
    return Object.values(productPackage.assets).reduce((count, items) => (
      count + (Array.isArray(items) ? items.length : (items ? 1 : 0))
    ), 0)
  }
  return Array.isArray(productPackage.assetIds) ? productPackage.assetIds.length : 0
}

export default {
  data() {
    const roleOptions = getMockAdminUsers()
    const currentAdminUser = getCurrentAdminUser()
    const enterpriseTeam = getEnterpriseTeamState()
    return {
      platformAdminMode: false,
      platformAdminTab: 'overview',
      platformAdminSections: PLATFORM_ADMIN_SECTIONS,
      platformAdminKeyword: '',
      platformAdminEnvOptions: ['全部环境', 'production', 'staging', 'development'],
      platformAdminEnvIndex: 0,
      platformAdminCenter: loadPlatformAdminCenter(),
      platformContentCases: ENTERPRISE_CASES,
      platformContentArticles: WEBSITE_ARTICLES,
      leads: [],
      isLoadingLeads: false,
      leadLoadError: '',
      hasAttemptedLeadLoad: false,
      demoMode: getDemoMode(),
      demoEnterprise: null,
      demoNavigator: buildDemoNavigator({ currentScene: 'enterprise_overview' }),
      demoNavigatorSummary: buildDemoNavigatorSummary(),
      projects: [],
      adminProjectDetail: null,
      clientPortalView: null,
      clientFeedbackContent: '',
      apiEndpoints: ENTERPRISE_API_ENDPOINTS,
      enterpriseApis: [],
      brandApiApps: [],
      selectedApiDocAppId: '',
      apiDocs: [],
      selectedApiDoc: null,
      selectedApiSandboxAppId: '',
      apiSandboxActions: getApiSandboxActionOptions(),
      apiSandboxAction: 'image_generate',
      apiSandboxRequestText: JSON.stringify(getApiSandboxDefaultRequest('image_generate'), null, 2),
      apiSandboxRecords: [],
      apiSandboxResult: null,
      apiCredentials: [],
      apiPolicies: [],
      apiPolicyPermissions: API_POLICY_PERMISSIONS,
      apiPolicyEditorOpen: false,
      editingApiPolicyId: '',
      apiPolicyRestrictionsText: '{}',
      apiPolicyForm: {
        appId: '',
        credentialId: '',
        permissions: []
      },
      apiAuditRecords: [],
      apiAuditStats: {
        todayCount: 0,
        successCount: 0,
        failedCount: 0,
        totalCost: 0
      },
      apiAnalyticsPeriods: getApiAnalyticsPeriodOptions(),
      apiAnalyticsActions: API_ANALYTICS_ACTIONS,
      apiAnalyticsFilters: {
        brandId: '',
        appId: '',
        action: '',
        period: '7d'
      },
      apiAnalytics: {
        analyticsId: '',
        brandId: '',
        appId: '',
        period: '7d',
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        successRate: 0,
        totalCost: 0,
        topActions: [],
        failureAnalysis: [],
        createdAt: ''
      },
      apiBillingPeriodOptions: getApiBillingPeriodOptions(),
      apiBillingPeriodType: 'day',
      apiBillingPeriod: getCurrentApiBillingPeriod('day'),
      apiBillings: [],
      selectedApiBilling: null,
      brandOptions: [],
      brandApiPermissions: BRAND_API_APP_PERMISSIONS,
      apiPlans: getApiPlans(),
      brandApiEditorOpen: false,
      brandApiForm: {
        brandId: '',
        appName: '',
        planId: API_PLAN_IDS.BASIC,
        permissions: ['image_generate'],
        quota: 0
      },
      apiManagementMode: 'assets',
      apiUsageLogs: [],
      brandApiUsageRecords: [],
      brandApiUsageStats: {
        callCount: 0,
        successCount: 0,
        totalCost: 0
      },
      apiUsageStats: {
        todayCount: 0,
        successCount: 0,
        failedCount: 0,
        totalCost: 0
      },
      orders: [],
      orderManagementMode: 'orders',
      orderFulfillments: [],
      businessDashboardPeriods: BUSINESS_DASHBOARD_PERIODS,
      businessDashboardPeriod: '7d',
      businessDashboard: {
        dashboardId: 'business_dashboard_7d',
        period: '7d',
        leadCount: 0,
        pipelineAmount: 0,
        forecastAmount: 0,
        orderAmount: 0,
        projectCount: 0,
        deliveryCount: 0,
        apiUsage: {
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
          successRate: 0,
          totalCost: 0,
          topActions: []
        },
        pipelineStats: [],
        updatedAt: ''
      },
      businessReport: {
        reportId: 'business_report_7d',
        period: '7d',
        summary: '',
        leadSummary: {
          newLeadCount: 0,
          totalLeadCount: 0
        },
        salesSummary: {
          pipelineAmount: 0,
          forecastAmount: 0,
          wonAmount: 0,
          highRiskCount: 0,
          mediumRiskCount: 0,
          stageStats: []
        },
        projectSummary: {
          projectCount: 0,
          totalProjectCount: 0,
          statusCounts: {},
          activeCount: 0
        },
        deliverySummary: {
          deliveryCount: 0,
          pendingReviewCount: 0
        },
        riskSummary: {
          total: 0,
          high: 0,
          medium: 0,
          low: 0,
          open: 0,
          processing: 0,
          resolved: 0,
          ignored: 0,
          actionCount: 0
        },
        createdAt: ''
      },
      businessInsights: [],
      businessInsightSummary: {
        total: 0,
        opportunityCount: 0,
        riskCount: 0,
        actionCount: 0
      },
      businessAdvisors: [],
      businessAdvisorSummary: {
        total: 0,
        todayCount: 0,
        highCount: 0,
        riskActionCount: 0
      },
      businessAlerts: [],
      businessAlertSummary: {
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        open: 0
      },
      selectedBusinessAlertId: '',
      businessAlertActions: [],
      businessAlertActionStatuses: BUSINESS_ALERT_ACTION_STATUSES,
      businessAlertActionTypes: BUSINESS_ALERT_ACTION_TYPES,
      businessAlertActionForm: {
        operator: currentAdminUser.name,
        actionType: 'record',
        content: '',
        status: 'processing'
      },
      leadPipelineRows: [],
      leadPipelineStats: [],
      leadPipelineStages: LEAD_PIPELINE_STAGES,
      enterpriseLeadStatusOptions: ENTERPRISE_LEAD_STATUS_OPTIONS,
      enterpriseProjectMetaVersion: 0,
      enterpriseMemberRoles: ENTERPRISE_MEMBER_ROLES,
      enterpriseRoles: getRoles(enterpriseTeam.enterpriseId),
      enterpriseRolePermissionOptions: ROLE_PERMISSION_OPTIONS,
      enterpriseRoleScopes: ['all', 'project', 'own', 'custom'],
      editingEnterpriseRoleId: '',
      enterpriseRoleForm: {
        roleName: '',
        permissions: [],
        scope: 'own',
        projectIdsText: ''
      },
      enterpriseId: enterpriseTeam.enterpriseId,
      enterpriseName: enterpriseTeam.enterpriseName,
      cloudAlphaDevelopment: false,
      cloudAlphaConfiguredMode: getConfiguredDataSourceMode() || DATA_PROVIDER_LOCAL,
      cloudAlphaProviderMode: getDataProviderName(),
      cloudAlphaPreviousProvider: getDataProviderName(),
      cloudAlphaFunctionName: getCloudFunctionName(),
      cloudAlphaSessionEnabled: false,
      cloudAlphaEnterpriseId: '',
      cloudAlphaMemberId: '',
      cloudAlphaEnterpriseSource: '',
      cloudAlphaIdentityMessage: '',
      cloudAlphaRecoveryEnterpriseId: '',
      cloudAlphaProjectId: '',
      cloudAlphaRunning: '',
      cloudAlphaResults: [],
      enterprisePlanId: enterpriseTeam.planId,
      enterprisePlanOptions: ENTERPRISE_PLAN_OPTIONS,
      enterpriseMembers: enterpriseTeam.members,
      enterpriseCurrentMemberId: enterpriseTeam.currentMemberId,
      operationLogs: getEnterpriseOperationLogs(),
      auditLogs: getAuditLogs(),
      enterpriseApprovalState: getEnterpriseApprovalState(),
      enterpriseApprovalComment: '',
      customerPortalState: getCustomerPortalState(),
      enterpriseCommerceState: getEnterpriseCommerceState(),
      enterpriseQuoteItemOptions: ENTERPRISE_QUOTE_ITEM_OPTIONS,
      enterpriseMemberForm: {
        name: '',
        role: '设计师'
      },
      salesForecastRows: [],
      salesForecastSummary: {
        forecastCount: 0,
        expectedAmount: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        wonAmount: 0
      },
      leadFollowRows: [],
      leadFollowActionTypes: LEAD_FOLLOW_ACTION_TYPES,
      adminProjectStatusOptions: ADMIN_PROJECT_STATUS_OPTIONS,
      roleOptions,
      currentAdminUser,
      operationForm: {
        remark: ''
      },
      dashboardTab: hasAdminPermission(currentAdminUser, 'customer:view') ? 'customers' : 'projects',
      dashboard: {
        stats: {
          leadCount: 0,
          projectCount: 0,
          activeProjectCount: 0,
          pendingDeliveryCount: 0,
          completedDeliveryCount: 0,
          assetCount: 0,
          taskCount: 0
        },
        leads: [],
        projects: [],
        deliveries: []
      },
      projectStateMap: {},
      searchKeyword: '',
      filterStatus: 'all',
      filterDemandType: 'all',
      filterSourcePage: 'all',
      statusOptions: FOLLOW_STATUS_OPTIONS,
      statusIndexMap: FOLLOW_STATUS_OPTIONS.reduce((result, option, index) => {
        result[option.value] = index
        return result
      }, {})
    }
  },
  onLoad(query) {
    this.platformAdminMode = query && query.mode === 'platform'
    if (this.platformAdminMode) {
      this.platformAdminTab = query.tab || 'overview'
      this.loadPlatformAdmin()
      return
    }
    if (query && query.demo === 'enterprise') {
      this.handleAdminDemoQuery(query)
    }
  },
  onShow() {
    if (this.platformAdminMode) {
      this.loadPlatformAdmin()
      return
    }
    this.refreshCloudAlphaEnvironment()
    this.refreshEnterpriseTeam()
    this.enterpriseProjectMetaVersion += 1
    this.refreshDemoMode()
    this.loadDashboard()
    this.loadEnterpriseApis()
    this.loadBrandApiApps()
    this.loadApiUsage()
    this.loadOrders()
    this.loadOrderFulfillments()
    this.loadLeads()
    this.loadBusinessDashboard()
    this.loadLeadPipeline()
    this.loadLeadFollows()
  },
  onUnload() {
    this.resetCloudAlphaSession()
  },
  onBackPress() {
    if (this.clientPortalView) {
      this.closeClientPortal()
      return true
    }
    if (this.adminProjectDetail) {
      this.closeAdminProjectDetail()
      return true
    }
    return false
  },
  computed: {
    platformAdminOverviewCards() {
      const overview = this.platformAdminCenter.overview || {}
      return [
        { label: '新增用户', value: overview.newUsers || 0, desc: '按当前筛选周期统计' },
        { label: '活跃用户', value: overview.activeUsers || 0, desc: '来自真实行为事件或用户记录' },
        { label: '企业数量', value: overview.enterpriseCount || 0, desc: '来自企业仓库' },
        { label: '今日任务数', value: overview.todayTaskCount || 0, desc: '来自任务列表' },
        { label: '生成成功率', value: `${overview.successRate || 0}%`, desc: '成功任务 / 全部任务' },
        { label: '失败与超时', value: overview.failedAndTimeout || 0, desc: '失败、超时任务' },
        { label: '待审核', value: overview.pendingReview || 0, desc: '待审核任务' },
        { label: '待处理工单', value: overview.openTickets || 0, desc: '未关闭工单' },
        { label: '额度异常', value: overview.quotaAnomaly || 0, desc: '回滚候选与补偿申请' }
      ]
    },
    filteredPlatformUsers() {
      const keyword = this.platformAdminFilterKeyword()
      return this.platformAdminCenter.users.filter((item) => !keyword || `${item.userId}${item.name}${item.status}${item.role}`.toLowerCase().includes(keyword))
    },
    filteredPlatformEnterprises() {
      const keyword = this.platformAdminFilterKeyword()
      return this.platformAdminCenter.enterprises.filter((item) => !keyword || `${item.enterpriseId}${item.enterpriseName}${item.planId}${item.status}`.toLowerCase().includes(keyword))
    },
    filteredPlatformTasks() {
      const keyword = this.platformAdminFilterKeyword()
      return this.platformAdminCenter.tasks.filter((item) => !keyword || `${item.taskId}${item.userId}${item.enterpriseId}${item.type}${item.provider}${item.modelVersion}${item.status}`.toLowerCase().includes(keyword))
    },
    cloudAlphaCurrentEnterpriseId() {
      return this.cloudAlphaEnterpriseId || this.enterpriseId || getCloudSessionEnterpriseId()
    },
    enterpriseCurrentMember() {
      return this.enterpriseMembers.find((item) => item.memberId === this.enterpriseCurrentMemberId) ||
        this.enterpriseMembers[0] || { memberId: 'default_admin', name: '默认管理员', role: '管理员' }
    },
    enterpriseMemberLabels() {
      return this.enterpriseMembers.map((item) => `${item.name} · ${item.role}`)
    },
    enterpriseCurrentMemberIndex() {
      const index = this.enterpriseMembers.findIndex((item) => item.memberId === this.enterpriseCurrentMember.memberId)
      return index >= 0 ? index : 0
    },
    enterpriseMemberRoleIndex() {
      const index = this.enterpriseMemberRoles.indexOf(this.enterpriseMemberForm.role)
      return index >= 0 ? index : 0
    },
    enterpriseRoleScopeLabels() {
      return this.enterpriseRoleScopes.map((scope) => this.getEnterpriseRoleScopeLabel(scope))
    },
    enterpriseRoleScopeIndex() {
      const index = this.enterpriseRoleScopes.indexOf(this.enterpriseRoleForm.scope)
      return index >= 0 ? index : 0
    },
    enterprisePlanIndex() {
      const index = this.enterprisePlanOptions.findIndex((item) => item.planId === this.enterprisePlanId)
      return index >= 0 ? index : 0
    },
    enterprisePlanLabels() {
      return this.enterprisePlanOptions.map((item) => item.name)
    },
    enterpriseCurrentPermissions() {
      const context = this.getRbacContext()
      return Array.from(new Set([
        ...getLegacyRolePermissions(this.enterpriseCurrentMember.role),
        ...getRbacRolePermissions(this.enterpriseCurrentMember.role, context)
      ]))
    },
    enterpriseCurrentPlan() {
      return this.enterprisePlanOptions.find((item) => item.planId === this.enterprisePlanId) || this.enterprisePlanOptions[0]
    },
    enterpriseUsageSummary() {
      const productions = getWorkspaceProductions().filter((item) => isCurrentMonth(item.completedAt || item.updatedAt || item.createdAt))
      const products = readEnterpriseProductPackages().filter((item) => isCurrentMonth(item.createdAt || item.updatedAt))
      return {
        generationCount: productions.length,
        imageCount: products.reduce((count, item) => count + getProductPackageAssetCount(item), 0),
        productCount: products.length,
        projectCount: (this.dashboard.projects || []).length,
        memberUsage: this.enterpriseMembers.map((member) => ({
          memberId: member.memberId,
          name: member.name,
          role: member.role,
          usageCount: this.operationLogs.filter((log) => log.operator === member.name && isCurrentMonth(log.time)).length
        }))
      }
    },
    enterpriseDataCenter() {
      const products = readEnterpriseProductPackages()
      const deliveries = readEnterpriseDeliveryPackages()
      const assets = products.flatMap((product) => {
        if (Array.isArray(product.assets)) return product.assets
        return product.assets && typeof product.assets === 'object' ? Object.values(product.assets).flat() : []
      })
      const designIds = new Set([
        ...Object.keys(this.enterpriseApprovalState.designApprovals || {}),
        ...products.map((item) => item.sourceDesignId).filter(Boolean)
      ])
      const detailPageCount = products.filter((product) => {
        const productAssets = Array.isArray(product.assets)
          ? product.assets
          : (product.assets && typeof product.assets === 'object' ? Object.values(product.assets).flat() : [])
        return product.detailTemplate || product.marketingVersion || productAssets.some((asset) => ['detail_page', 'page_material'].includes(asset.assetType || asset.type))
      }).length
      const deliveryAssetCount = deliveries.reduce((count, item) => count + (Array.isArray(item.assetVersionIds) ? item.assetVersionIds.length : (Array.isArray(item.assetIds) ? item.assetIds.length : 0)), 0)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const week = new Date(today)
      week.setDate(today.getDate() - ((today.getDay() + 6) % 7))
      const month = new Date(now.getFullYear(), now.getMonth(), 1)
      const auditTrend = [
        { key: 'today', label: '今日', start: today },
        { key: 'week', label: '本周', start: week },
        { key: 'month', label: '本月', start: month }
      ].map((period) => {
        const records = this.auditLogs.filter((item) => {
          const time = new Date(item.createdAt)
          return !Number.isNaN(time.getTime()) && time >= period.start
        })
        const statusChanges = records.filter((item) => {
          const before = item.before?.status || item.before?.productStatus || ''
          const after = item.after?.status || item.after?.productStatus || ''
          return Boolean(after && before !== after)
        }).length
        return { ...period, operations: records.length, approvals: records.filter((item) => item.targetType === 'approval').length, statusChanges }
      })
      const imageCount = assets.length || products.reduce((count, item) => count + getProductPackageAssetCount(item), 0)
      return {
        overview: [
          { key: 'customers', label: '客户数', value: this.dashboard.stats.leadCount || this.leads.length },
          { key: 'projects', label: '项目数', value: this.dashboard.stats.projectCount || this.projects.length },
          { key: 'products', label: '商品数', value: products.length },
          { key: 'orders', label: '订单数', value: this.enterpriseOrders.length },
          { key: 'amount', label: '成交金额', value: `¥${Number(this.enterpriseCommerceStats.dealAmount || 0).toFixed(2)}` },
          { key: 'deliveries', label: '交付数量', value: deliveries.length }
        ],
        production: [
          { key: 'plans', label: '设计方案数量', value: designIds.size },
          { key: 'products', label: '商品生产数量', value: products.length },
          { key: 'images', label: '生成图片数量', value: imageCount },
          { key: 'details', label: '详情页数量', value: detailPageCount },
          { key: 'delivery-assets', label: '交付素材数量', value: deliveryAssetCount }
        ],
        team: [
          { key: 'sales', label: '销售 · 客户跟进', value: this.leadFollowRows.length },
          { key: 'designer', label: '设计师 · 方案', value: designIds.size },
          { key: 'operator', label: '运营 · 素材', value: imageCount },
          { key: 'manager', label: '项目经理 · 项目', value: this.dashboard.stats.projectCount || this.projects.length }
        ],
        auditTrend,
        aiUsage: [
          { key: 'generations', label: '生成次数', value: this.enterpriseUsageSummary.generationCount },
          { key: 'assets', label: '素材数量', value: this.enterpriseUsageSummary.imageCount },
          { key: 'estimate', label: '预计消耗', value: `约 ${this.enterpriseUsageSummary.generationCount * 2} 积分` }
        ]
      }
    },
    enterpriseQuotes() {
      return this.enterpriseCommerceState.quotes
    },
    enterpriseOrders() {
      return this.enterpriseCommerceState.orders
    },
    enterpriseCommerceStats() {
      return calculateOrderStatistics(this.enterpriseOrders)
    },
    enterpriseCustomerMessages() {
      return this.customerPortalState.customerMessages.slice(0, 20)
    },
    enterpriseRecentOperationLogs() {
      return this.operationLogs.slice(0, 10)
    },
    enterpriseApprovalItems() {
      const state = this.enterpriseApprovalState
      const items = Object.values(state.designApprovals).map((record) => ({
        ...record,
        targetType: 'design',
        status: record.designApprovalStatus || 'draft'
      }))
      readEnterpriseProductPackages().forEach((product) => {
        const targetId = product.productPackageId
        if (!targetId) return
        const record = state.productApprovals[targetId] || {}
        items.push({
          ...record,
          targetType: 'product', targetId,
          targetName: (product.productInfo && (product.productInfo.productTitle || product.productInfo.name)) || product.title || '商品资料包',
          projectId: product.projectId || (product.designParams && product.designParams.projectId) || record.projectId || '',
          status: record.publishStatus || 'draft'
        })
      })
      readEnterpriseDeliveryPackages().forEach((delivery) => {
        const targetId = delivery.deliveryPackageId
        if (!targetId) return
        const record = state.deliveryApprovals[targetId] || {}
        items.push({
          ...record,
          targetType: 'delivery', targetId,
          targetName: delivery.title || '项目交付包',
          projectId: delivery.projectId || record.projectId || '',
          status: record.deliveryApprovalStatus || 'preparing'
        })
      })
      return items
    },
    enterpriseApprovalLogs() {
      return this.enterpriseApprovalState.approvalLogs.slice(0, 20)
    },
    enterpriseApprovalTaskSummary() {
      const items = this.enterpriseApprovalItems
      const pendingReview = items.filter((item) => ['pending_review', 'pending_publish', 'waiting_confirm'].includes(item.status)).length
      const role = this.enterpriseCurrentMember.role
      if (role === '设计师') return { label: '待审核方案', value: items.filter((item) => item.targetType === 'design' && item.status === 'pending_review').length }
      if (role === '项目经理') return { label: '待审核项目', value: pendingReview }
      if (role === '运营') return { label: '待发布商品', value: items.filter((item) => item.targetType === 'product' && ['draft', 'approved'].includes(item.status)).length }
      if (['管理员', '老板'].includes(role)) return { label: '待审批事项', value: pendingReview }
      return { label: '当前暂无审批任务', value: 0 }
    },
    currentRoleLabel() {
      return getAdminRoleLabel(this.currentAdminUser.role)
    },
    roleOptionLabels() {
      return this.roleOptions.map((user) => `${getAdminRoleLabel(user.role)} · ${user.name}`)
    },
    currentRoleIndex() {
      const index = this.roleOptions.findIndex((user) => user.role === this.currentAdminUser.role)
      return index >= 0 ? index : 0
    },
    canViewDelivery() {
      return this.canPermission('delivery:view') || this.canPermission('delivery:update')
    },
    canManageApi() {
      return this.currentAdminUser.role === 'admin'
    },
    canManageOrders() {
      return this.currentAdminUser.role === 'admin'
    },
    selectedBrandApiPlan() {
      return getApiPlanById(this.brandApiForm.planId)
    },
    selectedApiDeveloperContext() {
      const context = getBrandApiDeveloperContext(this.selectedApiDocAppId)
      if (!context) return null
      return {
        ...context,
        maskedApiKey: this.getCredentialMask(this.getActiveAppCredential(context.appId))
      }
    },
    selectedApiSandboxContext() {
      const context = getBrandApiDeveloperContext(this.selectedApiSandboxAppId)
      if (!context) return null
      return {
        ...context,
        maskedApiKey: this.getCredentialMask(this.getActiveAppCredential(context.appId))
      }
    },
    analyticsAppOptions() {
      const brandId = this.apiAnalyticsFilters.brandId
      return this.brandApiApps.filter((app) => !brandId || app.brandId === brandId)
    },
    apiBillingSummary() {
      return this.apiBillings.reduce((summary, billing) => ({
        totalCalls: summary.totalCalls + billing.totalCalls,
        successCalls: summary.successCalls + billing.successCalls,
        failedCalls: summary.failedCalls + billing.failedCalls,
        quotaUsed: summary.quotaUsed + billing.quotaUsed,
        totalCost: summary.totalCost + billing.totalCost
      }), {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        quotaUsed: 0,
        totalCost: 0
      })
    },
    dashboardTabLabel() {
      const labels = {
        businessDashboard: '经营驾驶舱',
        businessAlerts: '经营预警',
        businessReport: '经营报告',
        businessInsights: '经营洞察',
        businessAdvisor: '经营助手',
        customers: '客户',
        leadPipeline: '销售漏斗',
        salesForecast: '销售预测',
        leadFollows: '客户跟进',
        projects: '项目',
        deliveries: '交付',
        apis: 'API',
        orders: '订单',
        auditCenter: '审计中心'
      }
      return labels[this.dashboardTab] || ''
    },
    selectedBusinessAlert() {
      return this.businessAlerts.find((alert) => alert.alertId === this.selectedBusinessAlertId) || this.businessAlerts[0] || null
    },
    businessAlertStatusLabels() {
      return this.businessAlertActionStatuses.map((item) => item.label)
    },
    businessAlertActionTypeLabels() {
      return this.businessAlertActionTypes.map((item) => item.label)
    },
    businessAlertActionStatusIndex() {
      const index = this.businessAlertActionStatuses.findIndex((item) => item.value === this.businessAlertActionForm.status)
      return index >= 0 ? index : 0
    },
    businessAlertActionTypeIndex() {
      const index = this.businessAlertActionTypes.findIndex((item) => item.value === this.businessAlertActionForm.actionType)
      return index >= 0 ? index : 1
    },
    growthBusinessInsights() {
      return this.businessInsights.filter((insight) => insight.type === 'growth')
    },
    opportunityBusinessInsights() {
      return this.businessInsights.filter((insight) => ['sales', 'project', 'delivery'].includes(insight.type))
    },
    riskBusinessInsights() {
      return this.businessInsights.filter((insight) => insight.type === 'risk')
    },
    suggestedBusinessInsights() {
      return this.businessInsights.filter((insight) => insight.suggestion)
    },
    todayBusinessAdvisors() {
      return this.businessAdvisors.filter((advisor) => ['high', 'medium'].includes(advisor.priority))
    },
    salesBusinessAdvisors() {
      return this.businessAdvisors.filter((advisor) => advisor.adviceType === 'sales_action')
    },
    projectBusinessAdvisors() {
      return this.businessAdvisors.filter((advisor) => advisor.adviceType === 'project_action')
    },
    riskBusinessAdvisors() {
      return this.businessAdvisors.filter((advisor) => advisor.adviceType === 'risk_action')
    },
    clientPortalDeliveryStatus() {
      const delivery = this.clientPortalView && this.clientPortalView.deliveries[0]
      return delivery ? this.getDashboardDeliveryStatus(delivery.status) : '待进入交付'
    },
    newLeadCount() {
      return this.leads.filter((lead) => lead.followStatus === LEAD_FOLLOW_STATUS.NEW).length
    },
    statusFilterOptions() {
      return [{ value: 'all', label: '全部' }, ...this.statusOptions]
    },
    statusFilterLabels() {
      return this.statusFilterOptions.map((item) => item.label)
    },
    statusOptionLabels() {
      return this.statusOptions.map((item) => item.label)
    },
    demandTypeOptions() {
      const options = Array.from(new Set(this.leads.map((lead) => String(lead.demandType || '').trim()).filter(Boolean)))
      return ['all', ...options]
    },
    sourcePageOptions() {
      const options = Array.from(new Set(this.leads.map((lead) => String(lead.sourcePage || '').trim()).filter(Boolean)))
      return ['all', ...options]
    },
    demandTypeLabels() {
      return this.demandTypeOptions.map((item) => this.getDemandTypeFilterLabel(item))
    },
    sourcePageLabels() {
      return this.sourcePageOptions.map((item) => this.getSourcePageFilterLabel(item))
    },
    leadPipelineStageLabels() {
      return this.leadPipelineStages.map((item) => item.label)
    },
    statusFilterIndex() {
      return this.getOptionIndex(this.statusFilterOptions, this.filterStatus)
    },
    demandTypeFilterIndex() {
      return this.getOptionIndex(this.demandTypeOptions, this.filterDemandType)
    },
    sourcePageFilterIndex() {
      return this.getOptionIndex(this.sourcePageOptions, this.filterSourcePage)
    },
    enterpriseProjectRows() {
      void this.enterpriseProjectMetaVersion
      return (this.dashboard.projects || []).map((dashboardProject) => {
        const storedProject = this.projects.find((item) => item.projectId === dashboardProject.projectId) || {}
        const project = { ...dashboardProject, ...storedProject }
        const lead = this.leads.find((item) => item.leadId === project.leadId) || project.leadSnapshot || {}
        const pipeline = this.leadPipelineRows.find((item) => (
          (project.leadId && item.leadId === project.leadId) || item.projectId === project.projectId
        )) || {}
        const meta = getEnterpriseProjectMeta(project.projectId)
        const follow = this.leadFollowRows.find((item) => (
          (project.leadId && item.leadId === project.leadId) || item.projectId === project.projectId
        )) || {}
        const projectDeliveries = (this.dashboard.deliveries || []).filter((item) => item.projectId === project.projectId)
        const hasDesign = !['pending', 'requirement_confirmation', 'requirement_confirmed'].includes(project.status)
        const hasProduction = Number(project.taskCount || 0) > 0 || Number(project.assetCount || 0) > 0 ||
          ['generating', 'pending_review', 'completed', 'delivered'].includes(project.status)
        const delivered = projectDeliveries.some((item) => ['delivered', 'confirmed', 'completed'].includes(item.status)) ||
          ['completed', 'delivered'].includes(project.status)
        const latestFollow = follow.latestFollow || {}
        const manualFollow = Array.isArray(meta.followUps) && meta.followUps.length ? meta.followUps[0] : null
        const leadStatus = meta.leadStatus || ENTERPRISE_LEAD_STATUS_LABELS[pipeline.stage] || (delivered ? '已成交' : '合作中')
        const expectedItems = []
        if (meta.monthlyStyleCount) expectedItems.push(`月产 ${meta.monthlyStyleCount} 款`)
        if (meta.expectedImageCount) expectedItems.push(`${meta.expectedImageCount} 张图片`)
        if (meta.deliveryCycle) expectedItems.push(`周期 ${meta.deliveryCycle}`)
        return {
          ...project,
          customerName: lead.customerName || lead.companyName || project.customerName || '未设置',
          contactName: lead.contactName || lead.customerContact || project.customerContact || '未设置',
          enterpriseType: lead.enterpriseType || lead.companyType || project.enterpriseType || '未设置',
          industry: lead.industry || lead.productCategory || lead.clothingCategory || project.industry || '未设置',
          contact: lead.mobile || lead.phone || lead.wechat || lead.email || lead.customerContact || project.customerContact || '未设置',
          leadStatus,
          leadStatusIndex: Math.max(0, this.enterpriseLeadStatusOptions.indexOf(leadStatus)),
          leadStatusUpdatedAt: meta.leadStatusUpdatedAt ? `更新于 ${this.formatDashboardDate(meta.leadStatusUpdatedAt)}` : '更新时间未设置',
          cooperationType: meta.cooperationType || project.cooperationType || project.projectType || lead.demandType || '未设置',
          expectedOutput: expectedItems.join(' · ') || project.expectedOutput || lead.quantity || (project.assetCount ? `${project.assetCount} 项资产` : '未设置'),
          projectGoal: meta.projectGoal || project.projectGoal || project.description || lead.requirementText || lead.description || '未设置',
          followContent: manualFollow ? `${manualFollow.followType}：${manualFollow.followUpContent}` : (follow.latestContent || '暂无跟进记录'),
          nextAction: manualFollow ? (manualFollow.nextAction || '持续跟进') : (latestFollow.nextFollowAt ? `按计划于 ${this.formatDashboardDate(latestFollow.nextFollowAt)} 跟进` : (delivered ? '维护客户合作关系' : '确认下一阶段计划')),
          timeline: [
            { key: 'requirement', label: '需求', completed: Boolean(project.leadId || lead.leadId), active: !hasDesign },
            { key: 'design', label: '设计', completed: hasDesign, active: hasDesign && !hasProduction },
            { key: 'production', label: '生产', completed: hasProduction, active: hasProduction && !delivered },
            { key: 'delivery', label: '交付', completed: delivered, active: projectDeliveries.length > 0 && !delivered }
          ]
        }
      })
    },
    enterpriseOperatingSnapshot() {
      void this.enterpriseProjectMetaVersion
      const projects = this.enterpriseProjectRows
      const productPackages = readEnterpriseProductPackages()
      const deliveryPackages = readEnterpriseDeliveryPackages()
      const productions = getWorkspaceProductions()
      const stageLabels = ENTERPRISE_LEAD_STATUS_OPTIONS
      const funnelMap = stageLabels.reduce((result, label) => {
        result[label] = 0
        return result
      }, {})

      this.leads.forEach((lead) => {
        const project = projects.find((item) => item.leadId && item.leadId === lead.leadId)
        const pipeline = this.leadPipelineRows.find((item) => item.leadId === lead.leadId) || {}
        const status = project
          ? project.leadStatus
          : (ENTERPRISE_LEAD_STATUS_LABELS[pipeline.stage] || '初次接触')
        funnelMap[status] = Number(funnelMap[status] || 0) + 1
      })

      const projectRisks = projects.map((project) => {
        const packages = productPackages.filter((item) => (
          item.projectId === project.projectId || (item.designParams && item.designParams.projectId === project.projectId)
        ))
        const deliveries = deliveryPackages.filter((item) => item.projectId === project.projectId)
        const assetCount = packages.reduce((count, item) => count + getProductPackageAssetCount(item), 0) + Number(project.assetCount || 0)
        const deadline = project.deadline ? new Date(project.deadline) : null
        const overdue = deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now() &&
          !deliveries.some((item) => ['delivered', 'confirmed'].includes(item.status))
        const reasons = []
        if (!packages.length) reasons.push('缺少商品')
        if (!assetCount) reasons.push('缺少素材')
        if (overdue) reasons.push('延期交付')
        if (deliveries.length && !deliveries.some((item) => item.status === 'confirmed')) reasons.push('客户未确认')
        const actionMap = {
          '缺少商品': '先建立商品资料包',
          '缺少素材': '补齐主图、详情页和细节素材',
          '延期交付': '立即调整排期并同步客户',
          '客户未确认': '跟进客户确认或修改意见'
        }
        return {
          projectId: project.projectId,
          projectName: project.projectName || '未命名项目',
          reasons,
          level: overdue || reasons.length >= 3 ? 'high' : (reasons.length >= 2 ? 'medium' : 'low'),
          suggestedAction: reasons.length ? actionMap[reasons[0]] : '按计划持续推进'
        }
      }).filter((item) => item.reasons.length)

      const customerMap = projects.reduce((result, project) => {
        const customerName = project.customerName || '未设置'
        if (!result[customerName]) {
          result[customerName] = { customerName, projectCount: 0, productCount: 0, deliveryCount: 0, confirmedCount: 0 }
        }
        const packages = productPackages.filter((item) => (
          item.projectId === project.projectId || (item.designParams && item.designParams.projectId === project.projectId)
        ))
        const deliveries = deliveryPackages.filter((item) => item.projectId === project.projectId)
        result[customerName].projectCount += 1
        result[customerName].productCount += packages.length
        result[customerName].deliveryCount += deliveries.length
        result[customerName].confirmedCount += deliveries.filter((item) => item.status === 'confirmed').length
        return result
      }, {})

      const monthlyProducts = productPackages.filter((item) => isCurrentMonth(item.createdAt))
      const monthlyDeliveries = deliveryPackages.filter((item) => isCurrentMonth(item.createdAt) && ['delivered', 'confirmed'].includes(item.status))
      const missingAssetProjects = projectRisks.filter((item) => item.reasons.includes('缺少素材'))
      const demoCustomers = projects.filter((item) => item.leadStatus === 'Demo演示')
      const overdueProjects = projectRisks.filter((item) => item.reasons.includes('延期交付'))
      const advice = []
      if (missingAssetProjects.length) advice.push(`${missingAssetProjects.length} 个项目缺少商品素材，建议优先补齐主图、详情页和细节图。`)
      if (demoCustomers.length) advice.push(`${demoCustomers[0].customerName} 已完成 Demo，建议推进需求确认与方案报价。`)
      if (overdueProjects.length) advice.push(`${overdueProjects[0].projectName} 已接近或超过交付周期，建议立即跟进确认。`)
      if (!advice.length) advice.push('当前项目推进平稳，建议持续关注新增客户转化和交付确认。')
      const maxFunnelCount = Math.max(1, ...stageLabels.map((label) => funnelMap[label] || 0))

      return {
        overview: [
          { key: 'customers', label: '客户数量', value: new Set(this.leads.map((item) => item.leadId || item.customerName).filter(Boolean)).size },
          { key: 'projects', label: '项目数量', value: projects.length },
          { key: 'products', label: '商品数量', value: productPackages.length },
          { key: 'productions', label: '生产数量', value: productions.length },
          { key: 'deliveries', label: '交付数量', value: deliveryPackages.length }
        ],
        funnel: stageLabels.map((label) => ({
          label,
          count: funnelMap[label] || 0,
          percent: Math.max(6, Math.round(((funnelMap[label] || 0) / maxFunnelCount) * 100))
        })),
        risks: projectRisks,
        efficiency: {
          generatedProducts: monthlyProducts.length,
          generatedAssets: monthlyProducts.reduce((count, item) => count + getProductPackageAssetCount(item), 0),
          completedDeliveries: monthlyDeliveries.length,
          newProducts: monthlyProducts.length,
          completedProducts: monthlyProducts.filter((item) => ['product_ready', 'ready_for_sale', 'published', 'delivered'].includes(item.status || item.productStatus)).length,
          deliveredProducts: monthlyDeliveries.length
        },
        keyCustomers: Object.values(customerMap)
          .sort((left, right) => (right.productCount + right.deliveryCount) - (left.productCount + left.deliveryCount))
          .slice(0, 5),
        advice
      }
    },
    filteredLeads() {
      const keyword = String(this.searchKeyword || '').trim().toLowerCase()
      return this.leads.filter((lead) => {
        if (this.filterStatus !== 'all' && lead.followStatus !== this.filterStatus) {
          return false
        }
        if (this.filterDemandType !== 'all' && lead.demandType !== this.filterDemandType) {
          return false
        }
        if (this.filterSourcePage !== 'all' && lead.sourcePage !== this.filterSourcePage) {
          return false
        }
        if (!keyword) {
          return true
        }

        const searchableFields = [
          lead.companyName,
          lead.brandName,
          lead.contactName,
          lead.mobile,
          lead.phone,
          lead.wechat,
          lead.requirementText,
          lead.description
        ]

        return searchableFields.some((field) => String(field || '').toLowerCase().includes(keyword))
      })
    }
  },
  methods: {
    platformAdminFilterKeyword() {
      return String(this.platformAdminKeyword || '').trim().toLowerCase()
    },
    loadPlatformAdmin() {
      this.platformAdminCenter = loadPlatformAdminCenter({
        keyword: this.platformAdminKeyword,
        env: this.platformAdminEnvOptions[this.platformAdminEnvIndex] || '全部环境'
      })
    },
    setPlatformAdminTab(tab = 'overview') {
      this.platformAdminTab = tab || 'overview'
      this.loadPlatformAdmin()
      uni.redirectTo({ url: `/pages/admin/admin?mode=platform&tab=${encodeURIComponent(this.platformAdminTab)}` })
    },
    changePlatformAdminEnv(event) {
      this.platformAdminEnvIndex = Number(event.detail && event.detail.value || 0)
      this.loadPlatformAdmin()
    },
    refreshCloudAlphaEnvironment() {
      const result = isDataProviderDevelopment()
      this.cloudAlphaDevelopment = Boolean(result)
      console.log('[cloud-alpha:environment-refresh]', {
        isDevelopment: this.cloudAlphaDevelopment
      })
      this.cloudAlphaConfiguredMode = getConfiguredDataSourceMode() || DATA_PROVIDER_LOCAL
      this.cloudAlphaProviderMode = getDataProviderName()
      return this.cloudAlphaDevelopment
    },
    isCloudAlphaEnterpriseId(value = '') {
      return /^alpha_enterprise_[A-Za-z0-9_-]+$/.test(String(value || '').trim())
    },
    readCloudAlphaCachedIdentity() {
      try {
        const identity = uni.getStorageSync(CLOUD_ALPHA_IDENTITY_STORAGE_KEY)
        if (!identity || typeof identity !== 'object' || !this.isCloudAlphaEnterpriseId(identity.enterpriseId)) return null
        return {
          enterpriseId: String(identity.enterpriseId),
          memberId: String(identity.memberId || ''),
          source: String(identity.source || 'restored_existing')
        }
      } catch {
        return null
      }
    },
    saveCloudAlphaIdentity(identity = {}) {
      if (!this.isCloudAlphaEnterpriseId(identity.enterpriseId) || !identity.memberId) return false
      try {
        uni.setStorageSync(CLOUD_ALPHA_IDENTITY_STORAGE_KEY, {
          enterpriseId: String(identity.enterpriseId),
          memberId: String(identity.memberId),
          source: String(identity.source || 'restored_existing'),
          updatedAt: new Date().toISOString()
        })
        return true
      } catch {
        return false
      }
    },
    getCloudAlphaRecoveryCandidates(explicitEnterpriseId = '') {
      const cachedIdentity = this.readCloudAlphaCachedIdentity()
      return [
        explicitEnterpriseId,
        cachedIdentity?.enterpriseId,
        this.cloudAlphaRecoveryEnterpriseId,
        this.enterpriseId
      ].reduce((candidates, value) => {
        const enterpriseId = String(value || '').trim()
        if (this.isCloudAlphaEnterpriseId(enterpriseId) && !candidates.includes(enterpriseId)) candidates.push(enterpriseId)
        return candidates
      }, [])
    },
    setCloudAlphaRestoredIdentity(enterpriseId, memberId, source = 'restored_existing') {
      this.cloudAlphaEnterpriseId = enterpriseId
      this.cloudAlphaMemberId = memberId
      this.cloudAlphaEnterpriseSource = source
      this.cloudAlphaRecoveryEnterpriseId = enterpriseId
      this.cloudAlphaIdentityMessage = source === 'newly_created'
        ? '已创建新的 Alpha 测试企业。'
        : '已恢复已有企业，可直接测试项目 CRUD。'
      setCloudSessionEnterpriseId(enterpriseId)
      this.saveCloudAlphaIdentity({ enterpriseId, memberId, source })
    },
    async restoreCloudAlphaIdentityCandidate(enterpriseId = '') {
      const candidate = String(enterpriseId || '').trim()
      if (!this.isCloudAlphaEnterpriseId(candidate)) {
        return {
          ok: false,
          status: 'invalid_params',
          data: null,
          errorCode: 'INVALID_ENTERPRISE_ID',
          message: 'A valid Alpha enterpriseId is required'
        }
      }
      const response = await restoreCloudSessionIdentity(candidate)
      if (response?.ok) this.setCloudAlphaRestoredIdentity(candidate, response.data?.memberId, 'restored_existing')
      return response
    },
    async tryRestoreCloudAlphaIdentity(explicitEnterpriseId = '') {
      const candidates = this.getCloudAlphaRecoveryCandidates(explicitEnterpriseId)
      let lastResponse = null
      for (const enterpriseId of candidates) {
        const response = await this.restoreCloudAlphaIdentityCandidate(enterpriseId)
        if (response?.ok) return response
        lastResponse = response
      }
      return lastResponse
    },
    async recoverCloudAlphaExistingEnterprise() {
      const candidate = this.cloudAlphaRecoveryEnterpriseId
      return this.runCloudAlphaOperation('恢复已有企业', async () => {
        const response = await this.restoreCloudAlphaIdentityCandidate(candidate)
        return { response, summary: response?.ok ? '已通过云端成员校验恢复 active Member。' : '未能恢复该企业身份。' }
      })
    },
    async enableCloudAlphaSession() {
      if (!this.cloudAlphaDevelopment || this.cloudAlphaSessionEnabled) return
      this.cloudAlphaPreviousProvider = getDataProviderName()
      useDataProvider(DATA_PROVIDER_CLOUD)
      this.cloudAlphaProviderMode = getDataProviderName()
      this.cloudAlphaSessionEnabled = true
      this.cloudAlphaResults = []
      this.cloudAlphaIdentityMessage = '正在检查当前账号已有的 Alpha 企业身份。'
      const startedAt = Date.now()
      const response = await this.tryRestoreCloudAlphaIdentity()
      if (response?.ok) {
        this.appendCloudAlphaResult('恢复已有企业', response, startedAt, '会话已复用云端验证通过的 active Member。')
      } else {
        this.cloudAlphaIdentityMessage = '未发现可安全恢复的本地企业标识；可创建新企业，或粘贴已有 enterpriseId 验证恢复。'
      }
    },
    disableCloudAlphaSession() {
      this.resetCloudAlphaSession()
      this.cloudAlphaResults = []
    },
    resetCloudAlphaSession() {
      clearCloudSessionEnterpriseId()
      if (this.cloudAlphaSessionEnabled) {
        useDataProvider(this.cloudAlphaPreviousProvider || DATA_PROVIDER_LOCAL)
      }
      this.cloudAlphaProviderMode = getDataProviderName()
      this.cloudAlphaSessionEnabled = false
      this.cloudAlphaEnterpriseId = ''
      this.cloudAlphaMemberId = ''
      this.cloudAlphaEnterpriseSource = ''
      this.cloudAlphaIdentityMessage = ''
      this.cloudAlphaRecoveryEnterpriseId = ''
      this.cloudAlphaProjectId = ''
      this.cloudAlphaRunning = ''
    },
    getSafeCloudAlphaDebug(debug = null) {
      if (!debug || typeof debug !== 'object') return null
      const safeKeys = [
        'providerMode',
        'action',
        'resourceType',
        'hasEnterpriseId',
        'hasRecordId',
        'cloudFunctionName',
        'elapsedMs'
      ]
      return safeKeys.reduce((output, key) => {
        if (Object.prototype.hasOwnProperty.call(debug, key)) output[key] = debug[key]
        return output
      }, {})
    },
    appendCloudAlphaResult(operation, response = {}, startedAt = Date.now(), summary = '') {
      const elapsedMs = Math.max(0, Date.now() - startedAt)
      this.cloudAlphaResults.unshift({
        resultId: `cloud_alpha_${Date.now()}_${this.cloudAlphaResults.length}`,
        operation,
        ok: response.ok === true,
        status: response.status || 'cloud_response_invalid',
        errorCode: response.errorCode || '',
        message: response.message || '',
        debug: this.getSafeCloudAlphaDebug(response.debug),
        elapsedMs: Number(response?.debug?.elapsedMs) >= 0 ? Number(response.debug.elapsedMs) : elapsedMs,
        summary
      })
    },
    async runCloudAlphaOperation(operation, handler) {
      if (!this.cloudAlphaDevelopment || !this.cloudAlphaSessionEnabled || this.cloudAlphaProviderMode !== DATA_PROVIDER_CLOUD) {
        uni.showToast({ title: '请先开启本次 Cloud 验收会话', icon: 'none' })
        return null
      }
      const startedAt = Date.now()
      this.cloudAlphaRunning = operation
      let output
      let response
      try {
        output = await handler()
        const candidate = output && typeof output === 'object' && output.response
          ? output.response
          : output
        response = candidate && typeof candidate === 'object' && typeof candidate.ok === 'boolean' && candidate.status
          ? candidate
          : {
              ok: false,
              status: 'cloud_response_invalid',
              data: null,
              errorCode: 'CLOUD_RESPONSE_INVALID',
              message: 'Cloud Alpha operation returned an invalid response'
            }
      } catch {
        response = {
          ok: false,
          status: 'cloud_call_failed',
          data: null,
          errorCode: 'CLOUD_CALL_FAILED',
          message: 'Cloud Alpha operation failed'
        }
      }

      try {
        this.appendCloudAlphaResult(operation, response, startedAt, output?.summary || '')
      } catch {
        // UI result recording must not replace a valid cloud business response.
      }
      this.cloudAlphaRunning = ''
      return response
    },
    async createCloudAlphaEnterprise() {
      if (this.cloudAlphaEnterpriseId && this.cloudAlphaMemberId) {
        return this.runCloudAlphaOperation('创建测试企业', async () => ({
          response: {
            ok: true,
            status: 'existing_enterprise_restored',
            data: {
              enterpriseId: this.cloudAlphaEnterpriseId,
              memberId: this.cloudAlphaMemberId
            },
            errorCode: '',
            message: 'Existing enterprise membership restored'
          },
          summary: '已恢复现有 active Member，本次未创建 Enterprise 或 Member。'
        }))
      }

      const enterpriseId = `alpha_enterprise_${Date.now()}`
      const response = await this.runCloudAlphaOperation('创建测试企业', async () => {
        setCloudSessionEnterpriseId(enterpriseId)
        const createResponse = await cloudProvider.set({ collection: 'enterprises' }, {
          enterpriseId,
          enterpriseName: 'Alpha测试企业'
        })
        if (createResponse?.errorCode === 'FIRST_ENTERPRISE_ALREADY_CREATED') {
          const restoredResponse = await this.tryRestoreCloudAlphaIdentity()
          if (restoredResponse?.ok) {
            return {
              response: restoredResponse,
              summary: '首次创建保护已生效，并已恢复当前账号已有企业。'
            }
          }
          this.cloudAlphaIdentityMessage = '当前云账号已存在企业；现有云函数未返回其 enterpriseId，请粘贴已有 enterpriseId 完成一次安全恢复。'
        }
        return createResponse
      })
      if (!response?.ok) return
      if (response.status === 'existing_enterprise_restored') return response
      const enterprise = response.data?.enterprise || response.data || {}
      const member = response.data?.member || {}
      if (member.status !== 'active' || !member.memberId) {
        this.cloudAlphaIdentityMessage = '企业已返回，但未获得可用的 active Member。'
        return response
      }
      this.setCloudAlphaRestoredIdentity(enterprise.enterpriseId || enterpriseId, member.memberId, 'newly_created')
      return response
    },
    async repeatCloudAlphaEnterprise() {
      if (this.cloudAlphaEnterpriseSource === 'restored_existing') {
        return this.runCloudAlphaOperation('重复创建', async () => ({
          response: {
            ok: true,
            status: 'existing_enterprise_idempotent',
            data: {
              enterpriseId: this.cloudAlphaEnterpriseId,
              memberId: this.cloudAlphaMemberId
            },
            errorCode: '',
            message: 'Existing enterprise is protected by FIRST_ENTERPRISE_ALREADY_CREATED'
          },
          summary: '当前为已存在企业，首次创建幂等已由 FIRST_ENTERPRISE_ALREADY_CREATED 保护。'
        }))
      }
      const enterpriseId = this.cloudAlphaEnterpriseId
      await this.runCloudAlphaOperation('重复创建', async () => {
        setCloudSessionEnterpriseId(enterpriseId)
        const before = await cloudProvider.query({ collection: 'members' })
        const response = await cloudProvider.set({ collection: 'enterprises' }, {
          enterpriseId,
          enterpriseName: 'Alpha测试企业'
        })
        const after = await cloudProvider.query({ collection: 'members' })
        const returnedEnterpriseId = response.data?.enterprise?.enterpriseId || response.data?.enterpriseId || ''
        const returnedMemberId = response.data?.member?.memberId || ''
        const beforeCount = Array.isArray(before.data) ? before.data.length : -1
        const afterCount = Array.isArray(after.data) ? after.data.length : -1
        const memberQueriesOk = before.ok && after.ok && beforeCount >= 0 && afterCount >= 0
        const idempotent = response.ok && returnedEnterpriseId === enterpriseId && memberQueriesOk && beforeCount === afterCount
        const sameMember = Boolean(this.cloudAlphaMemberId && returnedMemberId === this.cloudAlphaMemberId)
        return {
          response,
          summary: `幂等=${idempotent ? '是' : '否'}；同一企业=${returnedEnterpriseId === enterpriseId ? '是' : '否'}；同一成员=${sameMember ? '是' : '否'}；重复成员=${memberQueriesOk ? (afterCount > beforeCount ? '是' : '否') : '无法确认'}`
        }
      })
    },
    async createCloudAlphaProject() {
      if (!this.cloudAlphaEnterpriseId || !this.cloudAlphaMemberId) return null
      setCloudSessionEnterpriseId(this.cloudAlphaEnterpriseId)
      const projectId = `alpha_project_${Date.now()}`
      const response = await this.runCloudAlphaOperation('创建测试项目', async () => cloudProvider.set({ collection: 'projects' }, {
        enterpriseId: this.cloudAlphaEnterpriseId,
        projectId,
        projectName: 'Alpha测试项目'
      }))
      if (response?.ok) this.cloudAlphaProjectId = response.data?.projectId || projectId
    },
    async queryCloudAlphaProjects() {
      if (!this.cloudAlphaEnterpriseId || !this.cloudAlphaMemberId) return null
      setCloudSessionEnterpriseId(this.cloudAlphaEnterpriseId)
      await this.runCloudAlphaOperation('查询项目', async () => {
        const response = await cloudProvider.query({ collection: 'projects' })
        const count = Array.isArray(response.data) ? response.data.length : 0
        return { response, summary: `当前企业项目数=${count}；测试项目存在=${response.data?.some?.((item) => item.projectId === this.cloudAlphaProjectId) ? '是' : '否'}` }
      })
    },
    async updateCloudAlphaProject() {
      if (!this.cloudAlphaEnterpriseId || !this.cloudAlphaMemberId || !this.cloudAlphaProjectId) return null
      setCloudSessionEnterpriseId(this.cloudAlphaEnterpriseId)
      await this.runCloudAlphaOperation('更新项目', async () => cloudProvider.set({ collection: 'projects' }, {
        enterpriseId: this.cloudAlphaEnterpriseId,
        projectId: this.cloudAlphaProjectId,
        projectName: 'Alpha测试项目-已更新'
      }))
    },
    async removeCloudAlphaProject() {
      if (!this.cloudAlphaEnterpriseId || !this.cloudAlphaMemberId || !this.cloudAlphaProjectId) return null
      setCloudSessionEnterpriseId(this.cloudAlphaEnterpriseId)
      const response = await this.runCloudAlphaOperation('删除项目', async () => cloudProvider.remove({
        collection: 'projects',
        recordId: this.cloudAlphaProjectId
      }))
      if (response?.ok) this.cloudAlphaProjectId = ''
    },
    getRbacContext() {
      return {
        member: {
          ...this.enterpriseCurrentMember,
          userId: this.enterpriseCurrentMember.userId || this.enterpriseCurrentMember.memberId,
          status: this.enterpriseCurrentMember.status || 'active'
        }
      }
    },
    canRbacView(permission = '') {
      return guardCanView(permission, this.getRbacContext())
    },
    canRbacEdit(permission = '') {
      return guardCanEdit(permission, this.getRbacContext())
    },
    canRbacOperate(permission = '') {
      return guardCanOperate(permission, this.getRbacContext())
    },
    rejectRbacOperation() {
      uni.showToast({ title: '当前角色无操作权限', icon: 'none' })
      return false
    },
    canEnterpriseAccess(permission = '') {
      if (this.enterpriseCurrentMember.status && this.enterpriseCurrentMember.status !== 'active') return false
      return ['管理员', '老板'].includes(this.enterpriseCurrentMember.role) || this.enterpriseCurrentPermissions.includes(permission)
    },
    getEnterprisePermissionLabel(permission = '') {
      const labels = {
        business: '经营数据', customer: '客户', project: '项目', design: '设计方案', product: '商品生产',
        production: '生产', asset: '素材', marketing: '详情页', delivery: '交付', follow: '跟进',
        'enterprise.view': '查看企业', 'enterprise.manage': '管理企业', 'member.manage': '成员管理',
        'finance.view': '查看经营', 'finance.manage': '管理订单', 'customer.view': '查看客户',
        'customer.manage': '管理客户', 'quote.manage': '管理报价', 'project.view': '查看项目',
        'project.manage': '管理项目', 'project.approve': '项目审批', 'design.view': '查看方案',
        'design.edit': '编辑方案', 'product.view': '查看商品', 'product.edit': '编辑商品',
        'product.publish': '发布商品', 'asset.view': '查看素材', 'asset.manage': '管理素材',
        'marketing.manage': '营销素材', 'delivery.view': '查看交付', 'delivery.manage': '管理交付',
        'delivery.confirm': '确认交付'
      }
      return labels[permission] || permission
    },
    refreshEnterpriseTeam() {
      const state = getEnterpriseTeamState()
      this.enterpriseId = state.enterpriseId
      this.enterpriseName = state.enterpriseName
      this.enterprisePlanId = state.planId
      this.enterpriseMembers = state.members
      this.enterpriseCurrentMemberId = state.currentMemberId
      this.refreshEnterpriseRoles()
      this.operationLogs = getEnterpriseOperationLogs()
      this.enterpriseApprovalState = getEnterpriseApprovalState()
      this.customerPortalState = getCustomerPortalState()
      this.enterpriseCommerceState = getEnterpriseCommerceState()
      this.auditLogs = getAuditLogs()
    },
    changeEnterpriseMember(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      const member = this.enterpriseMembers[index] || this.enterpriseMembers[0]
      if (!member) return
      this.enterpriseCurrentMemberId = member.memberId
      saveEnterpriseTeamState({ members: this.enterpriseMembers, currentMemberId: member.memberId })
      appendEnterpriseOperationLog({ operator: member.name, action: '切换协作角色', target: member.role })
      this.operationLogs = getEnterpriseOperationLogs()
      const fallbackTab = member.status && member.status !== 'active'
        ? ''
        : (member.role === '销售' ? 'customers' : (['管理员', '老板'].includes(member.role) ? 'businessDashboard' : 'projects'))
      this.dashboardTab = fallbackTab
    },
    changeEnterpriseMemberRole(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      this.enterpriseMemberForm.role = this.enterpriseMemberRoles[index] || this.enterpriseMemberRoles[0]
    },
    refreshEnterpriseRoles() {
      this.enterpriseRoles = getRoles(this.enterpriseId)
      this.enterpriseMemberRoles = this.enterpriseRoles.map((item) => item.roleName)
      if (!this.enterpriseMemberRoles.includes(this.enterpriseMemberForm.role)) {
        this.enterpriseMemberForm.role = this.enterpriseMemberRoles[0] || '设计师'
      }
    },
    getEnterpriseRoleScopeLabel(scope = '') {
      return { all: '全部数据', project: '所属项目', own: '本人数据', custom: '指定项目' }[scope] || '本人数据'
    },
    changeEnterpriseRoleScope(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      this.enterpriseRoleForm.scope = this.enterpriseRoleScopes[index] || 'own'
      if (this.enterpriseRoleForm.scope !== 'custom') this.enterpriseRoleForm.projectIdsText = ''
    },
    toggleEnterpriseRolePermission(permission = '') {
      const permissions = this.enterpriseRoleForm.permissions
      this.enterpriseRoleForm.permissions = permissions.includes(permission)
        ? permissions.filter((item) => item !== permission)
        : [...permissions, permission]
    },
    editEnterpriseRole(role = {}) {
      if (role.builtin) return
      this.editingEnterpriseRoleId = role.roleId
      this.enterpriseRoleForm = {
        roleName: role.roleName,
        permissions: [...role.permissions],
        scope: role.scope,
        projectIdsText: (role.projectIds || []).join(', ')
      }
    },
    resetEnterpriseRoleForm() {
      this.editingEnterpriseRoleId = ''
      this.enterpriseRoleForm = { roleName: '', permissions: [], scope: 'own', projectIdsText: '' }
    },
    saveEnterpriseRole() {
      if (!this.canRbacOperate('member.manage')) return this.rejectRbacOperation()
      const roleName = String(this.enterpriseRoleForm.roleName || '').trim()
      if (!roleName) {
        uni.showToast({ title: '请填写角色名称', icon: 'none' })
        return
      }
      const projectIds = String(this.enterpriseRoleForm.projectIdsText || '')
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
      const input = {
        roleName,
        permissions: this.enterpriseRoleForm.permissions,
        scope: this.enterpriseRoleForm.scope,
        projectIds
      }
      const actor = {
        enterpriseId: this.enterpriseId,
        userId: this.enterpriseCurrentMember.userId || this.enterpriseCurrentMember.memberId,
        operator: this.enterpriseCurrentMember.name
      }
      const role = this.editingEnterpriseRoleId
        ? updateRole(this.editingEnterpriseRoleId, input, actor)
        : createRole({ ...input, enterpriseId: this.enterpriseId }, actor)
      if (!role) {
        uni.showToast({ title: '角色名称已存在', icon: 'none' })
        return
      }
      this.refreshEnterpriseRoles()
      this.auditLogs = getAuditLogs()
      this.recordEnterpriseAdminOperation(this.editingEnterpriseRoleId ? '修改企业角色' : '创建企业角色', role.roleName)
      this.resetEnterpriseRoleForm()
      uni.showToast({ title: '角色配置已保存', icon: 'success' })
    },
    removeEnterpriseRole(role = {}) {
      if (!this.canRbacOperate('member.manage')) return this.rejectRbacOperation()
      if (!role.roleId || role.builtin) return
      if (this.enterpriseMembers.some((member) => member.roleId === role.roleId || member.role === role.roleName)) {
        uni.showToast({ title: '请先调整使用该角色的成员', icon: 'none' })
        return
      }
      const removed = deleteRole(role.roleId, {
        enterpriseId: this.enterpriseId,
        userId: this.enterpriseCurrentMember.userId || this.enterpriseCurrentMember.memberId,
        operator: this.enterpriseCurrentMember.name
      })
      if (!removed) return
      this.refreshEnterpriseRoles()
      this.auditLogs = getAuditLogs()
      this.recordEnterpriseAdminOperation('删除企业角色', removed.roleName)
      this.resetEnterpriseRoleForm()
      uni.showToast({ title: '角色已删除', icon: 'success' })
    },
    changeEnterprisePlan(event) {
      if (!this.canRbacOperate('enterprise.manage')) return this.rejectRbacOperation()
      const index = Number(event && event.detail ? event.detail.value : 0)
      const plan = this.enterprisePlanOptions[index] || this.enterprisePlanOptions[0]
      this.enterprisePlanId = plan.planId
      saveEnterpriseTeamState({ planId: plan.planId })
      this.recordEnterpriseAdminOperation('更新企业套餐展示', plan.name)
    },
    addEnterpriseMember() {
      if (!this.canRbacOperate('member.manage')) return this.rejectRbacOperation()
      const name = String(this.enterpriseMemberForm.name || '').trim()
      if (!name) {
        uni.showToast({ title: '请填写成员姓名', icon: 'none' })
        return
      }
      const now = new Date().toISOString()
      const member = normalizeEnterpriseRecord({
        memberId: `enterprise_member_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        role: this.enterpriseMemberForm.role || '设计师',
        roleId: this.enterpriseRoles.find((item) => item.roleName === this.enterpriseMemberForm.role)?.roleId || '',
        createdAt: now,
        updatedAt: now
      }, {
        enterpriseId: this.enterpriseId,
        userId: this.enterpriseCurrentMemberId,
        createdBy: this.enterpriseCurrentMemberId
      })
      this.enterpriseMembers = [...this.enterpriseMembers, member]
      saveEnterpriseTeamState({ members: this.enterpriseMembers, currentMemberId: this.enterpriseCurrentMemberId })
      appendEnterpriseOperationLog({ operator: this.enterpriseCurrentMember.name, action: '新增企业成员', target: `${member.name} · ${member.role}` })
      this.operationLogs = getEnterpriseOperationLogs()
      this.enterpriseMemberForm = { name: '', role: '设计师' }
      uni.showToast({ title: '成员已添加', icon: 'success' })
    },
    recordEnterpriseAdminOperation(action, target, projectId = '') {
      appendEnterpriseOperationLog({ operator: this.enterpriseCurrentMember.name, action, target, projectId })
      this.operationLogs = getEnterpriseOperationLogs()
    },
    openAuditCenter() {
      this.auditLogs = getAuditLogs()
      this.dashboardTab = 'auditCenter'
    },
    getAuditTargetLabel(targetType = '') {
      return {
        quote: '报价', order: '订单', product: '商品资料包', delivery: '交付',
        customer_feedback: '客户反馈', project: '项目', approval: '审批'
      }[targetType] || '业务对象'
    },
    formatAuditChange(log = {}) {
      const format = (value = {}) => {
        const entries = Object.entries(value || {})
        return entries.length ? entries.map(([key, item]) => `${key}: ${item}`).join('，') : '无'
      }
      return `${format(log.before)} → ${format(log.after)}`
    },
    getEnterpriseApprovalTypeLabel(targetType = '') {
      return { design: '设计方案', product: '商品发布', delivery: '交付确认' }[targetType] || '审批事项'
    },
    getEnterpriseApprovalStatusLabel(status = '') {
      const labels = {
        draft: '草稿', pending_review: '待审核', approved: '已通过', rejected: '已驳回',
        pending_publish: '待发布审核', published: '已发布', preparing: '准备中',
        waiting_confirm: '待确认', confirmed: '已确认', revision_required: '需修改'
      }
      return labels[status] || '草稿'
    },
    canSubmitEnterpriseApproval(item = {}) {
      if (item.targetType === 'design') return this.canRbacEdit('design.edit') && ['draft', 'rejected'].includes(item.status)
      if (item.targetType === 'product') return this.canRbacOperate('product.publish') && item.status === 'draft'
      if (item.targetType === 'delivery') return this.canRbacOperate('delivery.manage') && ['preparing', 'revision_required'].includes(item.status)
      return false
    },
    canReviewEnterpriseApproval(item = {}) {
      return this.canRbacOperate('project.approve') &&
        ['pending_review', 'pending_publish', 'waiting_confirm'].includes(item.status)
    },
    canPublishEnterpriseProduct(item = {}) {
      return item.targetType === 'product' && item.status === 'approved' && this.canRbacOperate('product.publish')
    },
    submitEnterpriseApproval(item = {}) {
      if (!this.canSubmitEnterpriseApproval(item)) return this.rejectRbacOperation()
      const status = item.targetType === 'design' ? 'pending_review' : (item.targetType === 'product' ? 'pending_publish' : 'waiting_confirm')
      const action = item.targetType === 'design' ? '提交设计方案审核' : (item.targetType === 'product' ? '提交商品发布审核' : '提交交付确认')
      this.applyEnterpriseApproval(item, status, action)
    },
    reviewEnterpriseApproval(item = {}, approved = true) {
      if (!this.canReviewEnterpriseApproval(item)) return this.rejectRbacOperation()
      let status = approved ? 'approved' : 'rejected'
      if (item.targetType === 'product') status = approved ? 'approved' : 'draft'
      if (item.targetType === 'delivery') status = approved ? 'confirmed' : 'revision_required'
      this.applyEnterpriseApproval(item, status, approved ? '审批通过' : '审批驳回')
    },
    publishEnterpriseProduct(item = {}) {
      if (!this.canPublishEnterpriseProduct(item)) return this.rejectRbacOperation()
      this.applyEnterpriseApproval(item, 'published', '发布商品')
    },
    applyEnterpriseApproval(item = {}, status = '', action = '') {
      this.enterpriseApprovalState = updateEnterpriseApproval({
        ...item,
        status,
        action,
        operator: this.enterpriseCurrentMember.name,
        role: this.enterpriseCurrentMember.role,
        comment: String(this.enterpriseApprovalComment || '').trim()
      })
      this.enterpriseApprovalComment = ''
      this.recordEnterpriseAdminOperation(action, item.targetName, item.projectId)
      this.auditLogs = getAuditLogs()
      uni.showToast({ title: this.getEnterpriseApprovalStatusLabel(status), icon: 'none' })
    },
    changeCustomerMessageStatus(message = {}, status = '处理中') {
      if (!this.canRbacOperate('customer.manage')) return this.rejectRbacOperation()
      if (!message.messageId || !['待处理', '处理中', '已完成'].includes(status)) return
      const previousStatus = message.status || '待处理'
      this.customerPortalState = updateCustomerMessageStatus(message.messageId, status)
      recordAudit({
        enterpriseId: this.enterpriseId,
        userId: this.enterpriseCurrentMemberId,
        operator: this.enterpriseCurrentMember.name,
        action: '处理客户反馈',
        targetType: 'customer_feedback',
        targetId: message.messageId,
        before: { status: previousStatus },
        after: { status }
      })
      this.recordEnterpriseAdminOperation('更新客户消息', `${message.author} · ${status}`, message.projectId)
      this.auditLogs = getAuditLogs()
      uni.showToast({ title: status, icon: 'none' })
    },
    getEnterpriseQuoteStatusLabel(status = '') {
      return { draft: '草稿', sent: '已发送', confirmed: '已确认', rejected: '已拒绝' }[status] || '草稿'
    },
    getEnterpriseOrderStatusLabel(status = '') {
      return { pending_payment: '待收款', processing: '处理中', completed: '已完成', closed: '已关闭' }[status] || '待收款'
    },
    formatEnterpriseMoney(amount = 0) {
      return `¥${Number(amount || 0).toFixed(2)}`
    },
    changeEnterpriseQuoteStatus(quote = {}, status = 'draft') {
      if (!this.canRbacOperate('finance.manage')) return this.rejectRbacOperation()
      if (!quote.quoteId || !['draft', 'sent', 'confirmed', 'rejected'].includes(status)) return
      this.enterpriseCommerceState = updateEnterpriseQuoteStatus(quote.quoteId, status)
      this.auditLogs = getAuditLogs()
      this.recordEnterpriseAdminOperation('更新报价状态', `${quote.quoteId} · ${this.getEnterpriseQuoteStatusLabel(status)}`, quote.projectId)
    },
    createEnterpriseOrder(quote = {}) {
      if (!this.canRbacOperate('finance.manage')) return this.rejectRbacOperation()
      if (quote.status !== 'confirmed') return
      const result = createEnterpriseOrderFromQuote(quote)
      this.enterpriseCommerceState = result.state
      this.auditLogs = getAuditLogs()
      this.recordEnterpriseAdminOperation('创建企业订单', result.order.orderId, result.order.projectId)
      uni.showToast({ title: '订单已建立', icon: 'success' })
    },
    changeEnterpriseOrderStatus(order = {}, status = 'processing') {
      if (!this.canRbacOperate('finance.manage')) return this.rejectRbacOperation()
      if (!order.orderId || !['pending_payment', 'processing', 'completed', 'closed'].includes(status)) return
      this.enterpriseCommerceState = updateEnterpriseOrderStatus(order.orderId, status)
      this.auditLogs = getAuditLogs()
      this.recordEnterpriseAdminOperation('更新订单状态', `${order.orderId} · ${this.getEnterpriseOrderStatusLabel(status)}`, order.projectId)
    },
    canPermission(permission) {
      return hasAdminPermission(this.currentAdminUser, permission)
    },
    handleAdminDemoQuery(query = {}) {
      const result = this.ensureAdminDemoMode()
      const scene = query.scene || 'business'
      this.demoNavigator = buildDemoNavigator({
        demo: result.demo,
        mode: result.mode,
        currentScene: scene
      })
      if (scene === 'delivery') {
        this.dashboardTab = 'deliveries'
        return
      }
      this.dashboardTab = 'businessDashboard'
    },
    refreshDemoMode() {
      this.demoMode = getDemoMode()
      this.demoEnterprise = getDemoEnterpriseData()
      this.demoNavigator = buildDemoNavigator({
        demo: this.demoEnterprise,
        mode: this.demoMode,
        currentScene: this.demoNavigator.currentScene || 'enterprise_overview'
      })
      this.demoNavigatorSummary = buildDemoNavigatorSummary(this.demoEnterprise || {})
    },
    enterAdminDemoMode() {
      const result = enableDemoMode()
      this.demoMode = result.mode
      this.demoEnterprise = result.demo
      this.demoNavigator = buildDemoNavigator({
        demo: result.demo,
        mode: result.mode,
        currentScene: 'enterprise_overview'
      })
      this.demoNavigatorSummary = buildDemoNavigatorSummary(result.demo)
      this.dashboardTab = 'businessDashboard'
      uni.showToast({ title: 'Demo 已开启', icon: 'success' })
    },
    exitAdminDemoMode() {
      disableDemoMode()
      this.demoMode = getDemoMode()
      this.demoEnterprise = null
      this.demoNavigator = buildDemoNavigator({ currentScene: 'enterprise_overview' })
      this.demoNavigatorSummary = buildDemoNavigatorSummary()
      uni.showToast({ title: 'Demo 已退出', icon: 'success' })
    },
    ensureAdminDemoMode() {
      if (this.demoMode.demoEnabled) {
        return {
          mode: this.demoMode,
          demo: this.demoEnterprise || getDemoEnterpriseData()
        }
      }
      const result = enableDemoMode()
      this.demoMode = result.mode
      this.demoEnterprise = result.demo
      this.demoNavigatorSummary = buildDemoNavigatorSummary(result.demo)
      return result
    },
    navigateDemoScene(scene = 'enterprise_overview') {
      const result = this.ensureAdminDemoMode()
      this.demoNavigator = buildDemoNavigator({
        demo: result.demo,
        mode: result.mode,
        currentScene: scene
      })
      if (scene === 'business' || scene === 'enterprise_overview') {
        this.dashboardTab = 'businessDashboard'
        return
      }
      if (scene === 'delivery') {
        this.dashboardTab = 'deliveries'
        return
      }
      const targetMap = {
        brand_space: 'brand',
        project_space: 'project',
        workspace: 'workspace',
        production: 'production'
      }
      const target = targetMap[scene] || 'project'
      const productionQuery = scene === 'production' ? '&production=1' : ''
      uni.navigateTo({
        url: `/pages/workspace/workspace?demo=enterprise&demoId=${encodeURIComponent(result.mode.demoId)}&scene=${encodeURIComponent(scene)}&target=${encodeURIComponent(target)}${productionQuery}`
      })
    },
    startEnterpriseDemoPresentation() {
      let result = this.ensureAdminDemoMode()
      if (!result.demo) {
        result = enableDemoMode()
      }
      this.demoMode = result.mode
      this.demoEnterprise = result.demo
      this.demoNavigator = buildDemoNavigator({
        demo: result.demo,
        mode: result.mode,
        currentScene: 'project_space'
      })
      this.demoNavigatorSummary = buildDemoNavigatorSummary(result.demo)
      uni.navigateTo({
        url: `/pages/workspace/workspace?demo=enterprise&demoId=${encodeURIComponent(result.mode.demoId)}&scene=project_space&target=project`
      })
    },
    resetEnterpriseDemoPresentation() {
      const result = resetEnterpriseDemoMode()
      this.demoMode = result.mode
      this.demoEnterprise = result.demo
      this.demoNavigator = buildDemoNavigator({
        demo: result.demo,
        mode: result.mode,
        currentScene: 'project_space'
      })
      this.demoNavigatorSummary = buildDemoNavigatorSummary(result.demo)
      uni.navigateTo({
        url: `/pages/workspace/workspace?demo=enterprise&demoId=${encodeURIComponent(result.mode.demoId)}&scene=project_space&target=project`
      })
    },
    openDemoDashboard() {
      if (!this.demoMode.demoEnabled) {
        const result = enableDemoMode()
        this.demoMode = result.mode
        this.demoEnterprise = result.demo
      }
      this.dashboardTab = 'businessDashboard'
    },
    openDemoWorkspace(target = 'project') {
      let mode = this.demoMode
      if (!mode.demoEnabled) {
        const result = enableDemoMode()
        mode = result.mode
        this.demoMode = result.mode
        this.demoEnterprise = result.demo
      }
      uni.navigateTo({
        url: `/pages/workspace/workspace?demo=enterprise&demoId=${encodeURIComponent(mode.demoId)}&target=${encodeURIComponent(target)}`
      })
    },
    loadEnterpriseApis() {
      this.enterpriseApis = getEnterpriseApis()
    },
    loadBrandApiApps() {
      this.brandApiApps = getBrandApiApps()
      this.brandOptions = getBrands()
      if (!this.brandApiApps.some((app) => app.appId === this.selectedApiDocAppId)) {
        this.selectedApiDocAppId = this.brandApiApps.length ? this.brandApiApps[0].appId : ''
      }
      if (!this.brandApiApps.some((app) => app.appId === this.selectedApiSandboxAppId)) {
        this.selectedApiSandboxAppId = this.brandApiApps.length ? this.brandApiApps[0].appId : ''
      }
      this.loadApiDocs()
      this.loadApiSandboxRecords()
      this.loadApiCredentials()
      this.loadApiPolicies()
    },
    loadApiDocs() {
      this.apiDocs = this.selectedApiDocAppId ? getApiDocs(this.selectedApiDocAppId) : []
      const currentDocId = this.selectedApiDoc && this.selectedApiDoc.docId
      const current = this.apiDocs.find((doc) => doc.docId === currentDocId)
      this.selectedApiDoc = current || (this.apiDocs.length ? getApiDocById(this.apiDocs[0].docId) : null)
    },
    selectApiDocApp(appId) {
      this.selectedApiDocAppId = appId
      this.selectedApiDoc = null
      this.loadApiDocs()
    },
    openApiDoc(doc) {
      this.selectedApiDoc = getApiDocById(doc && doc.docId) || doc || null
    },
    formatApiDocValue(value) {
      try {
        return JSON.stringify(value || {}, null, 2)
      } catch (error) {
        return '{}'
      }
    },
    loadApiSandboxRecords() {
      this.apiSandboxRecords = getApiSandboxRecords(this.selectedApiSandboxAppId)
    },
    selectApiSandboxApp(appId) {
      this.selectedApiSandboxAppId = appId
      this.apiSandboxResult = null
      this.loadApiSandboxRecords()
    },
    selectApiSandboxAction(action) {
      this.apiSandboxAction = action
      this.apiSandboxRequestText = JSON.stringify(getApiSandboxDefaultRequest(action), null, 2)
      this.apiSandboxResult = null
    },
    submitApiSandboxTest() {
      let request = {}
      try {
        request = JSON.parse(this.apiSandboxRequestText || '{}')
      } catch (error) {
        uni.showToast({ title: '请输入合法的 JSON 参数', icon: 'none' })
        return
      }
      const credential = getActiveApiCredential(this.selectedApiSandboxAppId)
      const access = validateApiCredentialUsage({
        appId: this.selectedApiSandboxAppId,
        credentialId: credential && credential.credentialId,
        action: this.apiSandboxAction
      })
      if (!access.allowed) {
        this.recordApiAudit({
          appId: this.selectedApiSandboxAppId,
          credentialId: credential && credential.credentialId,
          action: this.apiSandboxAction,
          code: access.code
        })
        uni.showToast({ title: access.reason || 'API 凭证不可用', icon: 'none' })
        return
      }
      const record = executeApiSandboxTest({
        appId: this.selectedApiSandboxAppId,
        action: this.apiSandboxAction,
        request
      })
      if (record.status === 'SUCCESS') {
        markApiCredentialUsed(access.credential.credentialId)
      }
      this.recordApiAudit({
        appId: this.selectedApiSandboxAppId,
        credentialId: access.credential.credentialId,
        action: this.apiSandboxAction,
        code: record.status,
        success: record.status === 'SUCCESS',
        cost: record.cost
      })
      this.apiSandboxResult = record
      this.loadBrandApiApps()
      this.loadApiUsage()
      uni.showToast({
        title: record.status === 'SUCCESS' ? '沙箱调用成功' : getApiSandboxStatusLabel(record.status),
        icon: record.status === 'SUCCESS' ? 'success' : 'none'
      })
    },
    getSandboxStatus(status) {
      return getApiSandboxStatusLabel(status)
    },
    loadApiAudits() {
      this.apiAuditRecords = getApiAuditRecords()
      this.apiAuditStats = getApiAuditStats(this.apiAuditRecords)
      this.refreshApiAnalytics()
      this.loadApiBillings()
    },
    refreshApiAnalytics() {
      this.apiAnalytics = buildApiAnalytics(this.apiAnalyticsFilters)
      this.loadBusinessDashboard()
    },
    setApiAnalyticsPeriod(period) {
      this.apiAnalyticsFilters.period = period
      this.refreshApiAnalytics()
    },
    setApiAnalyticsBrand(brandId) {
      this.apiAnalyticsFilters.brandId = brandId
      const selectedApp = this.brandApiApps.find((app) => app.appId === this.apiAnalyticsFilters.appId)
      if (selectedApp && brandId && selectedApp.brandId !== brandId) {
        this.apiAnalyticsFilters.appId = ''
      }
      this.refreshApiAnalytics()
    },
    setApiAnalyticsApp(appId) {
      this.apiAnalyticsFilters.appId = appId
      this.refreshApiAnalytics()
    },
    setApiAnalyticsAction(action) {
      this.apiAnalyticsFilters.action = action
      this.refreshApiAnalytics()
    },
    getAnalyticsActionLabel(action) {
      const labels = {
        image_generate: '图片生成',
        batch_generate: '批量生成',
        asset_access: '资产读取',
        project_access: '项目读取'
      }
      return labels[action] || action || '未知接口'
    },
    getAnalyticsFailureLabel(code) {
      const labels = {
        APP_PAUSED: '应用暂停',
        PERMISSION_DENIED: '权限拒绝',
        QUOTA_NOT_ENOUGH: '额度不足'
      }
      return labels[code] || code || '其他失败'
    },
    loadApiBillings() {
      this.apiBillingPeriod = getCurrentApiBillingPeriod(this.apiBillingPeriodType)
      this.apiBillings = getApiBillings({
        periodType: this.apiBillingPeriodType,
        period: this.apiBillingPeriod
      })
      if (this.selectedApiBilling) {
        this.selectedApiBilling = this.apiBillings.find((billing) => billing.billingId === this.selectedApiBilling.billingId) || null
      }
    },
    setApiBillingPeriodType(periodType) {
      this.apiBillingPeriodType = periodType
      this.selectedApiBilling = null
      this.loadApiBillings()
    },
    openApiBillingDetail(billing) {
      this.selectedApiBilling = billing || null
    },
    closeApiBillingDetail() {
      this.selectedApiBilling = null
    },
    getApiBillingPeriodLabel(billing) {
      if (!billing) return ''
      return billing.periodType === 'month' ? `${billing.period} 月` : billing.period
    },
    recordApiAudit(input = {}) {
      const app = this.brandApiApps.find((item) => item.appId === input.appId)
      const audit = createApiAuditRecord({
        appId: input.appId,
        credentialId: input.credentialId || '',
        brandId: app ? app.brandId : '',
        action: input.action,
        status: getApiAuditStatusFromCode(input.code, Boolean(input.success)),
        cost: input.success ? Math.max(0, Number(input.cost) || 0) : 0
      })
      if (input.success) {
        linkBrandApiUsageAudit({
          usageId: input.usageId,
          appId: input.appId,
          credentialId: input.credentialId,
          action: input.action,
          auditId: audit.auditId
        })
      }
      this.loadApiAudits()
      return audit
    },
    getAuditBrandName(brandId) {
      return this.getBrandApiName(brandId)
    },
    getAuditCredentialName(credentialId) {
      const credential = this.apiCredentials.find((item) => item.credentialId === credentialId)
      return credential ? this.getCredentialMask(credential) : '无有效 Key'
    },
    getAuditStatus(status) {
      return getApiAuditStatusLabel(status)
    },
    loadApiCredentials() {
      this.apiCredentials = getApiCredentials()
    },
    getAppCredentials(appId) {
      return this.apiCredentials.filter((credential) => credential.appId === appId)
    },
    getActiveAppCredential(appId) {
      return this.apiCredentials.find((credential) => (
        credential.appId === appId && credential.status === API_CREDENTIAL_STATUS.ACTIVE
      )) || null
    },
    getCredentialMask(credential) {
      return formatApiCredentialMask(credential)
    },
    getCredentialStatus(status) {
      return status === API_CREDENTIAL_STATUS.ACTIVE ? '有效' : '已禁用'
    },
    getCredentialLastUsed(credential) {
      return credential && credential.lastUsedAt
        ? `最近使用 ${formatApiUsageTime(credential.lastUsedAt)}`
        : '尚未使用'
    },
    rotateAppCredential(app) {
      if (!this.canManageApi || !app || !app.appId) return
      try {
        if (getActiveApiCredential(app.appId)) {
          regenerateApiCredential(app.appId)
        } else {
          createApiCredential(app.appId)
        }
        this.loadApiCredentials()
        uni.showToast({ title: '测试 Key 已生成', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '凭证生成失败', icon: 'none' })
      }
    },
    disableAppCredential(app) {
      if (!this.canManageApi || !app) return
      const credential = getActiveApiCredential(app.appId)
      if (!credential) return
      try {
        disableApiCredential(credential.credentialId)
        this.loadApiCredentials()
        uni.showToast({ title: 'API Key 已禁用', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '凭证禁用失败', icon: 'none' })
      }
    },
    loadApiPolicies() {
      this.apiPolicies = getApiPolicies()
    },
    resetApiPolicyForm() {
      const app = this.brandApiApps[0] || null
      this.editingApiPolicyId = ''
      this.apiPolicyRestrictionsText = '{}'
      this.apiPolicyForm = {
        appId: app ? app.appId : '',
        credentialId: '',
        permissions: app ? [...app.permissions] : []
      }
    },
    openApiPolicyCreator() {
      if (!this.canManageApi) return
      if (!this.brandApiApps.length) {
        uni.showToast({ title: '请先创建 API 应用', icon: 'none' })
        return
      }
      this.resetApiPolicyForm()
      this.apiPolicyEditorOpen = true
    },
    closeApiPolicyEditor() {
      this.apiPolicyEditorOpen = false
      this.resetApiPolicyForm()
    },
    selectApiPolicyApp(appId) {
      const app = this.brandApiApps.find((item) => item.appId === appId)
      this.apiPolicyForm.appId = appId
      this.apiPolicyForm.credentialId = ''
      this.apiPolicyForm.permissions = app ? [...app.permissions] : []
    },
    toggleApiPolicyPermission(permission) {
      const permissions = this.apiPolicyForm.permissions
      this.apiPolicyForm.permissions = permissions.includes(permission)
        ? permissions.filter((item) => item !== permission)
        : [...permissions, permission]
    },
    saveApiPolicy() {
      let restrictions = {}
      try {
        restrictions = JSON.parse(this.apiPolicyRestrictionsText || '{}')
      } catch (error) {
        uni.showToast({ title: '请输入合法的限制条件 JSON', icon: 'none' })
        return
      }
      try {
        const input = {
          ...this.apiPolicyForm,
          restrictions
        }
        if (this.editingApiPolicyId) {
          updateApiPolicy(this.editingApiPolicyId, input)
        } else {
          createApiPolicy(input)
        }
        this.closeApiPolicyEditor()
        this.loadApiPolicies()
        uni.showToast({ title: '权限策略已保存', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '策略保存失败', icon: 'none' })
      }
    },
    editApiPolicy(policy) {
      if (!this.canManageApi || !policy) return
      this.editingApiPolicyId = policy.policyId
      this.apiPolicyForm = {
        appId: policy.appId,
        credentialId: policy.credentialId,
        permissions: [...policy.permissions]
      }
      this.apiPolicyRestrictionsText = JSON.stringify(policy.restrictions || {}, null, 2)
      this.apiPolicyEditorOpen = true
    },
    removeApiPolicy(policy) {
      if (!this.canManageApi || !policy) return
      uni.showModal({
        title: '删除权限策略',
        content: '删除后将恢复继承应用权限，确认继续？',
        success: (result) => {
          if (!result.confirm) return
          deleteApiPolicy(policy.policyId)
          this.loadApiPolicies()
          uni.showToast({ title: '策略已删除', icon: 'none' })
        }
      })
    },
    getPolicyAppName(appId) {
      const app = this.brandApiApps.find((item) => item.appId === appId)
      return app ? app.appName : appId
    },
    getPolicyCredential(policy) {
      return policy && policy.credentialId
        ? this.apiCredentials.find((credential) => credential.credentialId === policy.credentialId) || null
        : null
    },
    getPolicyCredentialName(policy) {
      if (!policy || !policy.credentialId) return '绑定整个应用'
      return this.getCredentialMask(this.getPolicyCredential(policy))
    },
    getPolicyStateClass(policy) {
      const app = this.brandApiApps.find((item) => item.appId === policy.appId)
      const credential = this.getPolicyCredential(policy)
      if (!app || app.status !== ENTERPRISE_API_STATUS.ENABLED) return 'paused'
      if (policy.credentialId && (!credential || credential.status !== API_CREDENTIAL_STATUS.ACTIVE)) return 'disabled'
      return 'enabled'
    },
    getPolicyStateLabel(policy) {
      const state = this.getPolicyStateClass(policy)
      if (state === 'paused') return '应用暂停'
      if (state === 'disabled') return 'Key 已禁用'
      return '策略生效'
    },
    resetBrandApiForm() {
      this.brandApiForm = {
        brandId: this.brandOptions.length ? this.brandOptions[0].brandId : '',
        appName: '',
        planId: API_PLAN_IDS.BASIC,
        permissions: [...getApiPlanById(API_PLAN_IDS.BASIC).permissions],
        quota: getApiPlanById(API_PLAN_IDS.BASIC).apiQuota
      }
    },
    openBrandApiCreator() {
      if (!this.canManageApi) return
      this.loadBrandApiApps()
      this.resetBrandApiForm()
      this.brandApiEditorOpen = true
    },
    closeBrandApiCreator() {
      this.brandApiEditorOpen = false
      this.resetBrandApiForm()
    },
    toggleBrandApiPermission(permission) {
      const permissions = this.brandApiForm.permissions
      this.brandApiForm.permissions = permissions.includes(permission)
        ? permissions.filter((item) => item !== permission)
        : [...permissions, permission]
    },
    selectBrandApiPlan(planId) {
      const plan = selectApiPlan(planId)
      this.brandApiForm.planId = plan.planId
      this.brandApiForm.permissions = [...plan.permissions]
      this.brandApiForm.quota = plan.apiQuota
    },
    saveBrandApiApp() {
      if (!this.canManageApi) return
      try {
        const app = createBrandApiApp(this.brandApiForm)
        createApiCredential(app.appId)
        const brand = this.brandOptions.find((item) => item.brandId === app.brandId)
        if (brand) {
          updateBrandWorkspaceRelations(brand.brandId, {
            apiAppIds: [...new Set([...(brand.apiAppIds || []), app.appId])]
          })
        }
        this.closeBrandApiCreator()
        this.loadBrandApiApps()
        uni.showToast({ title: 'API 应用已创建', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '创建失败', icon: 'none' })
      }
    },
    getBrandApiName(brandId) {
      const brand = this.brandOptions.find((item) => item.brandId === brandId)
      return brand ? brand.brandName : brandId || '未关联品牌'
    },
    getApiPlanName(planId) {
      return getApiPlanById(planId).name
    },
    toggleBrandApiStatus(app) {
      if (!this.canManageApi || !app || !app.appId) return
      const status = app.status === ENTERPRISE_API_STATUS.ENABLED
        ? ENTERPRISE_API_STATUS.PAUSED
        : ENTERPRISE_API_STATUS.ENABLED
      try {
        updateBrandApiAppStatus(app.appId, status)
        this.loadBrandApiApps()
        uni.showToast({ title: status === ENTERPRISE_API_STATUS.ENABLED ? '应用已启用' : '应用已暂停', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '状态更新失败', icon: 'none' })
      }
    },
    simulateBrandApiUsage(app) {
      if (!this.canManageApi || !app) return
      const action = app.permissions[0] || 'image_generate'
      const costMap = {
        image_generate: 5,
        batch_generate: 20,
        asset_access: 1,
        project_access: 1
      }
      const credential = getActiveApiCredential(app.appId)
      const access = validateApiCredentialUsage({
        appId: app.appId,
        credentialId: credential && credential.credentialId,
        action
      })
      if (!access.allowed) {
        this.recordApiAudit({
          appId: app.appId,
          credentialId: credential && credential.credentialId,
          action,
          code: access.code
        })
        uni.showToast({ title: access.reason || 'API 凭证不可用', icon: 'none' })
        return
      }
      try {
        const usageResult = consumeBrandApiUsage({ appId: app.appId, action, cost: costMap[action] || 1 })
        markApiCredentialUsed(access.credential.credentialId)
        this.recordApiAudit({
          appId: app.appId,
          credentialId: access.credential.credentialId,
          action,
          success: true,
          cost: usageResult.usage.cost,
          usageId: usageResult.usage.usageId
        })
        this.loadBrandApiApps()
        this.loadApiUsage()
        uni.showToast({ title: '模拟调用成功', icon: 'success' })
      } catch (error) {
        this.recordApiAudit({
          appId: app.appId,
          credentialId: access.credential.credentialId,
          action,
          code: error && error.code
        })
        uni.showToast({ title: (error && error.message) || '调用被拒绝', icon: 'none' })
      }
    },
    loadApiUsage() {
      this.apiUsageLogs = getApiUsageLogs()
      this.apiUsageStats = getApiUsageStats(this.apiUsageLogs)
      this.brandApiUsageRecords = getBrandApiUsageRecords()
      this.brandApiUsageStats = getBrandApiUsageStats(this.brandApiUsageRecords)
      this.loadApiAudits()
    },
    loadOrders() {
      this.orders = getOrders()
      this.loadBusinessDashboard()
    },
    loadOrderFulfillments() {
      this.orderFulfillments = getOrderFulfillments()
    },
    getApiName(api) {
      return getEnterpriseApiName(api)
    },
    getApiCompanyName(companyId) {
      return getEnterpriseApiCompanyName(companyId)
    },
    getApiStatus(status) {
      return getEnterpriseApiStatusLabel(status)
    },
    maskApiKey(apiKey) {
      return maskEnterpriseApiKey(apiKey)
    },
    getUsageApiName(log) {
      const api = this.enterpriseApis.find((item) => item.apiId === log.apiId)
      return api ? getEnterpriseApiName(api) : log.apiId
    },
    getBrandUsageAppName(appId) {
      const app = this.brandApiApps.find((item) => item.appId === appId)
      return app ? app.appName : appId
    },
    getUsageEndpoint(endpoint) {
      return getApiEndpointLabel(endpoint)
    },
    getUsageStatus(status) {
      return getApiCallStatusLabel(status)
    },
    formatUsageTime(value) {
      return formatApiUsageTime(value)
    },
    getOrderTypeName(orderType) {
      return getOrderTypeLabel(orderType)
    },
    getOrderStatusName(status) {
      return getOrderStatusLabel(status)
    },
    getOrderTargetName(targetType) {
      return getOrderTargetTypeLabel(targetType)
    },
    getOrderPlanName(order) {
      const planId = getOrderApiPlanId(order)
      return planId ? getApiPlanById(planId).name : order.targetId
    },
    getOrderCustomer(order) {
      return order.companyId ? getEnterpriseApiCompanyName(order.companyId) : getOrderCustomerLabel(order)
    },
    formatOrderAmount(amount) {
      return Number(amount || 0).toFixed(2)
    },
    formatOrderDate(value) {
      return formatOrderTime(value)
    },
    getOrderFulfillment(orderId) {
      return this.orderFulfillments.find((record) => record.orderId === orderId) || null
    },
    canStartFulfillment(order) {
      return this.canRbacOperate('finance.manage') && canFulfillOrder(order) && !this.getOrderFulfillment(order.orderId)
    },
    startOrderFulfillment(order) {
      if (!this.canRbacOperate('finance.manage')) return this.rejectRbacOperation()
      try {
        createMockOrderFulfillment(order)
        this.loadOrderFulfillments()
        uni.showToast({ title: '模拟履约已完成', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '履约失败', icon: 'none' })
      }
    },
    getFulfillmentActionName(action) {
      return getFulfillmentActionLabel(action)
    },
    getFulfillmentStatusName(status) {
      return getFulfillmentStatusLabel(status)
    },
    formatFulfillmentDate(value) {
      return formatFulfillmentTime(value)
    },
    toggleApiStatus(api) {
      if (!this.canManageApi || !api || !api.apiId) return
      const nextStatus = api.status === ENTERPRISE_API_STATUS.ENABLED
        ? ENTERPRISE_API_STATUS.PAUSED
        : ENTERPRISE_API_STATUS.ENABLED
      try {
        updateEnterpriseApiStatus(api.apiId, nextStatus)
        this.loadEnterpriseApis()
        uni.showToast({ title: nextStatus === ENTERPRISE_API_STATUS.ENABLED ? 'API 已启用' : 'API 已暂停', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || 'API 状态更新失败', icon: 'none' })
      }
    },
    onRoleChange(event) {
      const index = Number(event.detail.value)
      const selectedUser = this.roleOptions[index]
      if (!selectedUser) return
      this.currentAdminUser = setCurrentAdminRole(selectedUser.role)
      this.adminProjectDetail = null
      this.clientPortalView = null
      if (!this.canPermission('customer:view') && ['customers', 'leadPipeline', 'salesForecast', 'leadFollows'].includes(this.dashboardTab)) {
        this.dashboardTab = 'projects'
      }
      if (!this.canViewDelivery && this.dashboardTab === 'deliveries') {
        this.dashboardTab = 'projects'
      }
      if (!this.canManageApi && this.dashboardTab === 'apis') {
        this.dashboardTab = 'projects'
      }
      if (!this.canManageOrders && this.dashboardTab === 'orders') {
        this.dashboardTab = 'projects'
      }
      uni.showToast({ title: `已切换为${this.currentRoleLabel}`, icon: 'none' })
    },
    openAdminProjectDetail(project) {
      if (!this.canPermission('project:view')) {
        uni.showToast({ title: '当前角色无项目查看权限', icon: 'none' })
        return
      }
      if (!project || !project.projectId) return
      this.adminProjectDetail = getAdminProjectOperationDetail(project.projectId, project)
      this.operationForm = { remark: '' }
    },
    closeAdminProjectDetail() {
      this.adminProjectDetail = null
      this.loadDashboard()
    },
    openClientPortal() {
      const detail = this.adminProjectDetail
      if (!detail || !detail.project || !detail.project.projectId) return
      this.clientPortalView = getClientPortalView(detail.project.projectId, detail.project)
      this.clientFeedbackContent = ''
    },
    closeClientPortal() {
      this.clientPortalView = null
      this.clientFeedbackContent = ''
    },
    refreshClientPortal() {
      const portalView = this.clientPortalView
      if (!portalView) return
      this.clientPortalView = getClientPortalView(portalView.project.projectId, portalView.project)
    },
    confirmPortalProposal() {
      try {
        confirmClientProposal(this.clientPortalView.portal)
        this.refreshClientPortal()
        uni.showToast({ title: '方案已确认', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '确认失败', icon: 'none' })
      }
    },
    submitPortalFeedback() {
      try {
        submitClientFeedback({
          portal: this.clientPortalView.portal,
          content: this.clientFeedbackContent
        })
        this.clientFeedbackContent = ''
        this.refreshClientPortal()
        uni.showToast({ title: '修改意见已提交', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '提交失败', icon: 'none' })
      }
    },
    getClientStatusLabel(status) {
      return getClientProjectStatusLabel(status)
    },
    getClientVersionName(version) {
      return getClientVersionLabel(version)
    },
    getClientBatchStatus(status) {
      const labels = {
        pending: '等待生成',
        processing: '生成中',
        success: '已完成',
        completed: '已完成',
        failed: '生成失败'
      }
      return labels[status] || '处理中'
    },
    changeAdminProjectLifecycle(afterStatus) {
      const detail = this.adminProjectDetail
      if (!detail || detail.project.status === afterStatus) return
      if (!this.canPermission('project:update')) {
        uni.showToast({ title: '当前角色无项目修改权限', icon: 'none' })
        return
      }
      try {
        this.adminProjectDetail = updateAdminProjectLifecycle({
          projectId: detail.project.projectId,
          project: detail.project,
          afterStatus,
          operator: this.currentAdminUser.name,
          operatorUser: this.currentAdminUser,
          remark: this.operationForm.remark
        })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '状态更新失败', icon: 'none' })
        return
      }
      this.dashboard.projects = this.dashboard.projects.map((project) => (
        project.projectId === detail.project.projectId ? { ...project, status: afterStatus } : project
      ))
      this.operationForm.remark = ''
      uni.showToast({ title: '项目状态已更新', icon: 'success' })
    },
    openDeliveryOperation(delivery) {
      if (!this.canPermission('delivery:update')) {
        uni.showToast({ title: '当前角色无交付修改权限', icon: 'none' })
        return
      }
      const projectId = delivery && delivery.projectId
      if (!projectId) return
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(projectId)}`
      })
    },
    getOperationStatusLabel(status) {
      return getAdminProjectStatusLabel(status)
    },
    getOperationRoleLabel(role) {
      return role ? getAdminRoleLabel(role) : '历史记录'
    },
    formatOperationDate(value) {
      return formatProjectOperationTime(value)
    },
    loadDashboard() {
      this.dashboard = getAdminDashboardData({
        leads: this.leads,
        projects: this.projects
      })
      this.loadBusinessDashboard()
      this.loadLeadPipeline()
    },
    loadBusinessDashboard() {
      this.businessDashboard = buildBusinessDashboard({
        period: this.businessDashboardPeriod,
        leads: this.leads,
        projects: this.projects,
        orders: this.orders,
        apiUsage: this.apiAnalytics
      })
      this.loadBusinessAlerts()
    },
    loadBusinessAlerts() {
      const alerts = buildBusinessAlerts({
        period: this.businessDashboardPeriod,
        leads: this.leads,
        projects: this.projects,
        pipelines: listLeadPipelines(),
        apiUsage: this.apiAnalytics
      }).map((alert) => this.mergeBusinessAlertActionState(alert))
      this.businessAlerts = alerts
      this.businessAlertSummary = buildBusinessAlertSummary(this.businessAlerts)
      if (!this.selectedBusinessAlertId && this.businessAlerts.length) {
        this.selectedBusinessAlertId = this.businessAlerts[0].alertId
      }
      if (this.selectedBusinessAlertId && !this.businessAlerts.some((alert) => alert.alertId === this.selectedBusinessAlertId)) {
        this.selectedBusinessAlertId = this.businessAlerts.length ? this.businessAlerts[0].alertId : ''
      }
      this.loadBusinessAlertActions()
      this.loadBusinessReport()
    },
    loadBusinessReport() {
      this.businessReport = buildBusinessReport({
        period: this.businessDashboardPeriod,
        leads: this.leads,
        projects: this.projects,
        pipelines: listLeadPipelines(),
        dashboard: this.businessDashboard,
        alerts: this.businessAlerts,
        apiUsage: this.apiAnalytics
      })
      this.loadBusinessInsights()
    },
    loadBusinessInsights() {
      this.businessInsights = buildBusinessInsights({
        period: this.businessDashboardPeriod,
        leads: this.leads,
        projects: this.projects,
        pipelines: listLeadPipelines(),
        report: this.businessReport,
        alerts: this.businessAlerts,
        apiUsage: this.apiAnalytics
      })
      this.businessInsightSummary = buildBusinessInsightSummary(this.businessInsights)
      this.loadBusinessAdvisors()
    },
    loadBusinessAdvisors() {
      this.businessAdvisors = buildBusinessAdvisors({
        period: this.businessDashboardPeriod,
        leads: this.leads,
        projects: this.projects,
        pipelines: listLeadPipelines(),
        report: this.businessReport,
        insights: this.businessInsights,
        alerts: this.businessAlerts,
        apiUsage: this.apiAnalytics
      })
      this.businessAdvisorSummary = buildBusinessAdvisorSummary(this.businessAdvisors)
    },
    setBusinessDashboardPeriod(period) {
      this.businessDashboardPeriod = period || '7d'
      this.loadBusinessDashboard()
    },
    loadLeadPipeline() {
      const pipelines = listLeadPipelines()
      this.leadPipelineRows = buildLeadPipelineRows(this.leads, this.projects, pipelines)
      this.leadPipelineStats = buildLeadPipelineStats(this.leadPipelineRows)
      this.loadSalesForecast(pipelines)
    },
    loadSalesForecast(pipelines = listLeadPipelines()) {
      this.salesForecastRows = buildSalesForecastRows(this.leads, this.projects, pipelines)
      this.salesForecastSummary = buildSalesForecastSummary(this.salesForecastRows)
    },
    loadLeadFollows() {
      this.leadFollowRows = buildLeadFollowRows(this.leads, this.projects, listLeadFollows())
    },
    getLeadPipelineStageName(stage) {
      return getLeadPipelineStageLabel(stage)
    },
    getLeadPipelineStageIndex(stage) {
      const index = this.leadPipelineStages.findIndex((item) => item.value === stage)
      return index >= 0 ? index : 0
    },
    formatPipelineAmount(amount) {
      return `¥${Number(amount || 0).toFixed(0)}`
    },
    getSalesForecastStageName(stage) {
      return getSalesForecastStageLabel(stage)
    },
    getSalesForecastRiskLabel(riskLevel) {
      const labels = {
        high: '高风险',
        medium: '中风险',
        low: '低风险'
      }
      return labels[riskLevel] || '低风险'
    },
    changeLeadPipelineStage(row = {}, event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      const stage = this.leadPipelineStages[index] || this.leadPipelineStages[0]
      updateLeadPipeline({
        leadId: row.leadId,
        projectId: row.projectId,
        stage: stage.value,
        amount: row.amount
      }, {
        operator: this.currentAdminUser.name
      })
      this.loadLeadPipeline()
      this.loadLeadFollows()
      this.loadBusinessAlerts()
      uni.showToast({ title: '销售阶段已更新', icon: 'success' })
    },
    getBusinessAlertTypeLabel(type) {
      const labels = {
        sales: '销售',
        project: '项目',
        delivery: '交付',
        api: 'API'
      }
      return labels[type] || type || '业务'
    },
    getBusinessAlertStatusLabel(status) {
      return getBusinessAlertActionStatusLabel(status)
    },
    getBusinessAlertActionTypeName(actionType) {
      return getBusinessAlertActionTypeLabel(actionType)
    },
    getBusinessInsightTypeLabel(type) {
      const labels = {
        sales: '销售洞察',
        project: '项目洞察',
        delivery: '交付洞察',
        risk: '风险洞察',
        growth: '增长洞察'
      }
      return labels[type] || '经营洞察'
    },
    getBusinessAdvisorTypeLabel(type) {
      const labels = {
        sales_action: '销售行动',
        project_action: '项目行动',
        delivery_action: '交付行动',
        growth_action: '增长行动',
        risk_action: '风险行动'
      }
      return labels[type] || '经营建议'
    },
    getBusinessAdvisorPriorityLabel(priority) {
      const labels = {
        high: '高优先级',
        medium: '中优先级',
        low: '低优先级'
      }
      return labels[priority] || '中优先级'
    },
    mergeBusinessAlertActionState(alert = {}) {
      const actionState = getBusinessAlertActionState(alert.alertId)
      return {
        ...alert,
        status: actionState.status || alert.status || 'open',
        operator: actionState.operator || '',
        latestAction: actionState.latestAction,
        actionCount: actionState.actionCount
      }
    },
    selectBusinessAlert(alert = {}) {
      if (!alert.alertId) {
        return
      }
      this.selectedBusinessAlertId = alert.alertId
      this.businessAlertActionForm = {
        ...this.businessAlertActionForm,
        operator: alert.operator || this.currentAdminUser.name,
        actionType: 'record',
        content: '',
        status: alert.status || 'processing'
      }
      this.loadBusinessAlertActions()
    },
    loadBusinessAlertActions() {
      const alert = this.selectedBusinessAlert
      this.businessAlertActions = alert ? getBusinessAlertActions(alert.alertId) : []
    },
    onBusinessAlertStatusChange(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      const status = this.businessAlertActionStatuses[index] || this.businessAlertActionStatuses[0]
      this.businessAlertActionForm.status = status.value
    },
    onBusinessAlertActionTypeChange(event) {
      const index = Number(event && event.detail ? event.detail.value : 1)
      const actionType = this.businessAlertActionTypes[index] || this.businessAlertActionTypes[1]
      this.businessAlertActionForm.actionType = actionType.value
    },
    assignSelectedBusinessAlert() {
      const alert = this.selectedBusinessAlert
      if (!alert) {
        return
      }
      const operator = this.businessAlertActionForm.operator || this.currentAdminUser.name
      assignBusinessAlert(alert.alertId, operator, `分配给 ${operator}`)
      this.loadBusinessAlerts()
      uni.showToast({ title: '处理人已分配', icon: 'success' })
    },
    submitBusinessAlertAction() {
      const alert = this.selectedBusinessAlert
      if (!alert) {
        return
      }
      const operator = this.businessAlertActionForm.operator || this.currentAdminUser.name
      const content = this.businessAlertActionForm.content || '已记录处理进展'
      const status = this.businessAlertActionForm.status || alert.status || 'processing'
      if (this.businessAlertActionForm.actionType === 'status_change') {
        updateBusinessAlertStatus(alert.alertId, status, operator, content)
      } else {
        createBusinessAlertAction({
          alertId: alert.alertId,
          operator,
          actionType: this.businessAlertActionForm.actionType,
          content,
          status
        })
      }
      this.businessAlertActionForm.content = ''
      this.loadBusinessAlerts()
      uni.showToast({ title: '处理记录已保存', icon: 'success' })
    },
    getLeadFollowSourceLabel(sourceType) {
      const labels = {
        article: '知识中心文章',
        case: '企业案例中心',
        service_plan: '企业服务方案',
        enterprise_solution: '企业解决方案',
        trust: '企业信任流程',
        website: '官网入口'
      }
      return labels[sourceType] || sourceType || '官网入口'
    },
    getLeadFollowInterestLabel(row = {}) {
      const snapshot = row.interestSnapshot || {}
      return snapshot.title || snapshot.name || row.interestType || row.sourceId || '待确认'
    },
    formatLeadFollowDate(value) {
      return value ? formatDashboardTime(value) : '待安排'
    },
    changeEnterpriseProjectLeadStatus(project = {}, event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      const leadStatus = this.enterpriseLeadStatusOptions[index] || this.enterpriseLeadStatusOptions[0]
      const current = getEnterpriseProjectMeta(project.projectId)
      const now = new Date().toISOString()
      const followUps = Array.isArray(current.followUps) ? current.followUps : []
      saveEnterpriseProjectMeta(project.projectId, {
        leadStatus,
        leadStatusUpdatedAt: now,
        followUps: [{
          followUpId: `admin_project_stage_${Date.now()}`,
          followUpTime: now,
          followType: '项目变化',
          followUpContent: `商机阶段调整为${leadStatus}`,
          nextAction: leadStatus === '已成交' ? '进入客户持续服务' : '推进下一商业阶段'
        }, ...followUps]
      })
      this.recordEnterpriseAdminOperation('更新商机阶段', `${project.projectName || project.projectId} → ${leadStatus}`, project.projectId)
      this.enterpriseProjectMetaVersion += 1
      uni.showToast({ title: '商机阶段已更新', icon: 'success' })
    },
    quickCreateLeadFollow(row = {}, actionType = '') {
      if (!row.leadId) {
        return
      }
      const nextDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      createLeadFollow({
        leadId: row.leadId,
        projectId: row.projectId,
        actionType,
        content: `${actionType}：${this.getLeadFollowInterestLabel(row)}`,
        operator: this.currentAdminUser.name,
        nextFollowAt: ['成交', '流失'].includes(actionType) ? '' : nextDate
      })
      this.recordEnterpriseAdminOperation('新增销售跟进', `${row.customerName || row.leadId} · ${actionType}`, row.projectId)
      this.loadLeadFollows()
      uni.showToast({ title: '跟进记录已保存', icon: 'success' })
    },
    getDashboardProjectStatus(status) {
      return getDashboardProjectStatusLabel(status)
    },
    getDashboardDeliveryStatus(status) {
      return getDashboardDeliveryStatusLabel(status)
    },
    getDashboardVersion(version) {
      return getDashboardVersionLabel(version)
    },
    formatDashboardDate(value) {
      return formatDashboardTime(value)
    },
    async loadLeads() {
      if (!this.leads.length) {
        this.isLoadingLeads = true
      }
      this.leadLoadError = ''

      try {
        const enterpriseTeam = getEnterpriseTeamState()
        this.leads = (await getAdminLeadList({ preferCloud: true })).map((lead) => normalizeCustomerRepositoryRecord(lead, {
          enterpriseId: enterpriseTeam.enterpriseId,
          userId: enterpriseTeam.currentMemberId
        }))
        const localProjects = getAdminProjectList().map((project) => normalizeProjectRepositoryRecord(project, {
          enterpriseId: enterpriseTeam.enterpriseId,
          userId: enterpriseTeam.currentMemberId
        }))
        this.projectStateMap = await getAdminLeadProjectStateMap(
          this.leads.map((lead) => lead.leadId),
          { preferCloud: true }
        )
        const mergedProjects = [...localProjects]
        Object.values(this.projectStateMap)
          .map((state) => state && state.project)
          .filter(Boolean)
          .forEach((project) => {
            if (!mergedProjects.some((item) => item.projectId === project.projectId)) {
              mergedProjects.unshift(project)
            }
          })
        this.projects = mergedProjects.map((project) => normalizeProjectRepositoryRecord(project, {
          enterpriseId: enterpriseTeam.enterpriseId,
          userId: enterpriseTeam.currentMemberId
        }))
      } catch (error) {
        this.leadLoadError = (error && error.message) || 'unknown'
      } finally {
        this.isLoadingLeads = false
        this.hasAttemptedLeadLoad = true
        this.loadDashboard()
        this.loadLeadFollows()
      }
    },
    getLeadProjectState(lead) {
      if (!lead || !lead.leadId) {
        return {
          hasProject: false,
          project: null,
          projectId: ''
        }
      }
      return this.projectStateMap[lead.leadId] || {
        hasProject: false,
        project: null,
        projectId: ''
      }
    },
    getLeadProject(lead) {
      const state = this.getLeadProjectState(lead)
      return state.project || this.projects.find((project) => project.leadId === (lead && lead.leadId)) || null
    },
    formatLeadProject(lead) {
      const state = this.getLeadProjectState(lead)
      return state.hasProject ? `已转项目：${state.projectId}` : '未转项目'
    },
    formatScope(scope) {
      if (!Array.isArray(scope) || !scope.length) {
        return '暂无'
      }
      return scope.join('、')
    },
    formatAttachmentFileIds(fileIds) {
      if (!Array.isArray(fileIds) || !fileIds.length) {
        return '暂无'
      }
      return `${fileIds.length} 个文件`
    },
    formatReferenceImages(images) {
      if (!Array.isArray(images) || !images.length) {
        return '暂无'
      }
      return `${images.length} 张图片`
    },
    getOptionIndex(options, value) {
      const index = options.findIndex((item) => item.value === value)
      return index >= 0 ? index : 0
    },
    getFollowStatusLabel,
    getProjectStatusLabel,
    getProjectStageLabel,
    getFollowStatusFilterLabel(value) {
      if (value === 'all') {
        return '全部'
      }
      return this.getFollowStatusLabel(value)
    },
    getDemandTypeFilterLabel(value) {
      const labelMap = {
        all: '全部',
        design_service: '人工设计服务',
        ai_listing: 'AI 商品图升级',
        batch_generation: '批量视觉出图',
        enterprise_cooperation: '企业长期合作'
      }
      return labelMap[value] || value
    },
    getSourcePageFilterLabel(value) {
      const labelMap = {
        all: '全部',
        'website-demand': '官网提交需求',
        'service-request': '小程序提交需求',
        index: '官网首页',
        services: '服务页',
        pricing: '价格页',
        enterprise: '企业合作页',
        'case-detail': '案例详情页',
        'pro-design': '专业设计页'
      }
      return labelMap[value] || value
    },
    onStatusFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterStatus = (this.statusFilterOptions[index] && this.statusFilterOptions[index].value) || 'all'
    },
    onDemandTypeFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterDemandType = this.demandTypeOptions[index] || 'all'
    },
    onSourcePageFilterChange(event) {
      const index = Number(event.detail.value)
      this.filterSourcePage = this.sourcePageOptions[index] || 'all'
    },
    goToTaskAdmin() {
      uni.navigateTo({
        url: '/pages/task-admin/task-admin'
      })
    },
    goToOrderAdmin() {
      uni.navigateTo({
        url: '/pages/order-admin/order-admin'
      })
    },
    goToProjectAdmin() {
      uni.navigateTo({
        url: '/pages/project-admin/project-admin'
      })
    },
    goToLeadDetail(lead) {
      if (!lead || !lead.leadId) {
        return
      }
      uni.navigateTo({
        url: `/pages/lead-detail/lead-detail?leadId=${encodeURIComponent(lead.leadId)}`
      })
    },
    async onStatusChange(lead, event) {
      const index = Number(event.detail.value)
      const followStatus = (this.statusOptions[index] && this.statusOptions[index].value) || LEAD_FOLLOW_STATUS.NEW
      try {
        await updateAdminLeadFollowStatus(lead.leadId, followStatus, { preferCloud: true })
        await this.loadLeads()
        uni.showToast({
          title: '线索状态已更新',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '更新失败',
          icon: 'none'
        })
      }
    },
    async createProjectForLead(lead) {
      try {
        const result = await convertAdminLeadToProject(lead.leadId, { preferCloud: true })
        await this.loadLeads()

        if (result && result.project && result.project.projectId) {
          const nextProjects = this.projects.filter((project) => project.projectId !== result.project.projectId)
          this.projects = [result.project, ...nextProjects]
        }

        if (result && result.duplicated) {
          uni.showToast({
            title: '项目已存在',
            icon: 'none'
          })
          return
        }

        uni.showToast({
          title: '项目已创建',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '创建项目失败',
          icon: 'none'
        })
      }
    },
    async onProjectActionForLead(lead) {
      const project = this.getLeadProject(lead)
      if (project) {
        this.goToProjectDetail(project)
        return
      }
      await this.createProjectForLead(lead)
    },
    goToProjectDetail(project) {
      if (!project || !project.projectId) {
        return
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(project.projectId)}`
      })
    }
  }
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f6f7fb;
}

.client-portal-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f6f7fb;
  box-sizing: border-box;
}

.client-portal-header {
  padding: 8rpx 4rpx 22rpx;
}

.client-portal-badge,
.client-portal-title,
.client-portal-subtitle,
.client-portal-section-title,
.client-demand-content text,
.client-feedback-list text {
  display: block;
}

.client-portal-badge {
  width: fit-content;
  margin-top: 14rpx;
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  background: #ecfdf5;
  color: #047857;
  font-size: 18rpx;
  font-weight: 800;
}

.client-portal-title {
  margin-top: 16rpx;
  color: #111827;
  font-size: 38rpx;
  font-weight: 900;
}

.client-portal-subtitle {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 21rpx;
  line-height: 1.55;
}

.client-portal-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.client-portal-summary > view,
.client-portal-card {
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.client-portal-summary > view {
  padding: 18rpx;
}

.client-portal-summary text {
  display: block;
  color: #94a3b8;
  font-size: 18rpx;
}

.client-portal-summary text:last-child {
  margin-top: 7rpx;
  color: #111827;
  font-size: 23rpx;
  font-weight: 850;
}

.client-portal-card {
  margin-top: 18rpx;
  padding: 22rpx;
}

.client-portal-section-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.client-demand-content {
  margin-top: 14rpx;
  color: #475569;
  font-size: 21rpx;
  line-height: 1.65;
}

.client-demand-content text + text {
  margin-top: 8rpx;
}

.client-work-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.client-work-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border-radius: 18rpx;
  background: #eef2f7;
}

.client-work-card image {
  width: 100%;
  height: 100%;
}

.client-work-card text {
  position: absolute;
  right: 8rpx;
  bottom: 8rpx;
  padding: 5rpx 9rpx;
  border-radius: 999rpx;
  background: rgba(17, 24, 39, 0.7);
  color: #ffffff;
  font-size: 16rpx;
}

.client-work-empty {
  margin-top: 14rpx;
  padding: 48rpx 20rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  color: #94a3b8;
  text-align: center;
  font-size: 20rpx;
}

.client-progress-list,
.client-feedback-list {
  margin-top: 14rpx;
}

.client-progress-row,
.client-feedback-list > view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #eef2f7;
  color: #475569;
  font-size: 19rpx;
}

.client-progress-row:last-child,
.client-feedback-list > view:last-child {
  border-bottom: 0;
}

.client-progress-row > view {
  min-width: 0;
}

.client-progress-row > view text {
  display: block;
}

.client-progress-row > view text:last-child,
.client-feedback-list text:last-child {
  margin-top: 4rpx;
  color: #94a3b8;
  font-size: 17rpx;
}

.client-feedback-input {
  width: 100%;
  height: 150rpx;
  margin-top: 14rpx;
  padding: 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 18rpx;
  background: #f8fafc;
  color: #111827;
  font-size: 21rpx;
  box-sizing: border-box;
}

.client-feedback-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.client-feedback-button,
.client-portal-entry {
  margin: 0;
  border: 0;
  border-radius: 16rpx;
  font-size: 21rpx;
  font-weight: 850;
}

.client-feedback-button::after,
.client-portal-entry::after {
  border: 0;
}

.client-feedback-button.primary {
  background: #4f46e5;
  color: #ffffff;
}

.client-feedback-button.secondary {
  background: #eef2ff;
  color: #4338ca;
}

.client-portal-entry {
  margin-top: 16rpx;
  background: #eef2ff;
  color: #4338ca;
}

.project-operation-page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

.operation-header {
  padding: 8rpx 4rpx 22rpx;
}

.operation-back,
.operation-title,
.operation-subtitle,
.operation-section-title,
.operation-label,
.operation-value,
.demand-snapshot text,
.operation-empty,
.operation-log-title,
.operation-log-meta {
  display: block;
}

.operation-back {
  color: #2563eb;
  font-size: 23rpx;
  font-weight: 850;
}

.current-role-chip {
  display: inline-block;
  margin-top: 14rpx;
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 18rpx;
  font-weight: 800;
}

.operation-title {
  margin-top: 16rpx;
  color: #111827;
  font-size: 38rpx;
  font-weight: 900;
}

.operation-subtitle {
  margin-top: 7rpx;
  color: #64748b;
  font-size: 21rpx;
}

.operation-card {
  padding: 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.05);
}

.operation-card + .operation-card,
.operation-resource-grid,
.operation-resource-grid + .operation-card {
  margin-top: 18rpx;
}

.operation-section-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.operation-info-grid,
.operation-resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.operation-info-grid {
  margin-top: 16rpx;
}

.operation-info-grid > view {
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.operation-label {
  color: #94a3b8;
  font-size: 18rpx;
}

.operation-value {
  margin-top: 6rpx;
  overflow: hidden;
  color: #334155;
  font-size: 21rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demand-snapshot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx 18rpx;
  margin-top: 16rpx;
  color: #475569;
  font-size: 20rpx;
}

.demand-description {
  grid-column: span 2;
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  line-height: 1.6;
}

.operation-status-flow {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7rpx;
  margin-top: 16rpx;
}

.operation-status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7rpx;
  padding: 14rpx 4rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  color: #64748b;
  text-align: center;
  font-size: 18rpx;
}

.operation-status-item.active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 900;
}

.operation-status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: #cbd5e1;
}

.operation-status-item.active .operation-status-dot {
  background: #4f46e5;
}

.operation-status-flow.readonly .operation-status-item {
  opacity: 0.72;
}

.permission-readonly {
  display: block;
  margin-top: 10rpx;
  color: #94a3b8;
  font-size: 19rpx;
}

.operation-form-row {
  display: grid;
  grid-template-columns: 0.4fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.operation-input {
  width: 100%;
  height: 68rpx;
  padding: 0 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 16rpx;
  background: #f8fafc;
  color: #111827;
  font-size: 20rpx;
  box-sizing: border-box;
}

.operation-mini-list,
.operation-log-list {
  display: flex;
  flex-direction: column;
  margin-top: 14rpx;
}

.operation-mini-row,
.operation-log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 13rpx 0;
  border-bottom: 1rpx solid #eef2f7;
  color: #475569;
  font-size: 18rpx;
}

.operation-mini-row:last-child,
.operation-log-row:last-child {
  border-bottom: none;
}

.operation-mini-row text:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delivery-operation-side {
  display: flex;
  align-items: center;
  gap: 9rpx;
  flex-shrink: 0;
}

.delivery-operation-button {
  min-width: 0;
  margin: 0;
  padding: 0 12rpx;
  height: 48rpx;
  border: 0;
  border-radius: 12rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 17rpx;
  line-height: 48rpx;
}

.delivery-operation-button::after {
  border: 0;
}

.delivery-readonly-label {
  color: #94a3b8;
  font-size: 17rpx;
}

.operation-empty {
  margin-top: 16rpx;
  color: #94a3b8;
  font-size: 20rpx;
}

.operation-log-row > view {
  min-width: 0;
  flex: 1;
}

.operation-log-title {
  color: #334155;
  font-size: 20rpx;
  font-weight: 850;
}

.operation-log-meta {
  margin-top: 5rpx;
  color: #94a3b8;
  font-size: 17rpx;
}

.operation-log-remark {
  max-width: 42%;
  color: #64748b;
  font-size: 18rpx;
  text-align: right;
}

.dashboard-row.clickable:active {
  background: #f8fafc;
}

.container {
  min-height: 100vh;
  background: #f6f6f9;
  padding: 24rpx;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.header > view:first-child {
  min-width: 0;
  flex: 1;
}

.role-switcher {
  min-width: 150rpx;
  padding: 12rpx 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 16rpx;
  background: #ffffff;
  text-align: right;
}

.role-switcher-label,
.role-switcher-value {
  display: block;
}

.role-switcher-label {
  color: #94a3b8;
  font-size: 17rpx;
}

.role-switcher-value {
  margin-top: 4rpx;
  color: #111827;
  font-size: 21rpx;
  font-weight: 850;
}

.enterprise-team-admin-card {
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.04);
}

.enterprise-team-admin-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.enterprise-team-picker {
  min-height: 60rpx;
  padding: 0 16rpx;
  border-radius: 14rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 60rpx;
}

.enterprise-plan-overview {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.enterprise-plan-overview > view,
.enterprise-usage-grid > view {
  padding: 14rpx 8rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  text-align: center;
}

.enterprise-plan-overview text,
.enterprise-usage-grid text {
  display: block;
  color: #64748b;
  font-size: 17rpx;
}

.enterprise-plan-overview text:first-child,
.enterprise-usage-grid text:first-child {
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
}

.enterprise-plan-picker {
  margin-top: 12rpx;
  padding: 12rpx 14rpx;
  border-radius: 14rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 19rpx;
  font-weight: 800;
  text-align: center;
}

.enterprise-usage-center {
  margin-top: 18rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8f9ff;
}

.enterprise-usage-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 12rpx;
}

.enterprise-member-usage {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.enterprise-member-usage text {
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #64748b;
  font-size: 17rpx;
}

.enterprise-team-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.enterprise-team-permissions text {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #64748b;
  font-size: 17rpx;
}

.enterprise-member-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160rpx, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.enterprise-member-list view {
  padding: 13rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.enterprise-member-list text {
  display: block;
  color: #64748b;
  font-size: 18rpx;
}

.enterprise-member-list text:first-child {
  color: #111827;
  font-size: 21rpx;
  font-weight: 850;
}

.enterprise-member-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180rpx 150rpx;
  gap: 10rpx;
  margin-top: 16rpx;
}

.enterprise-member-form input {
  height: 60rpx;
  padding: 0 16rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  font-size: 20rpx;
  box-sizing: border-box;
}

.enterprise-member-form button {
  height: 60rpx;
  margin: 0;
  border-radius: 14rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 20rpx;
  line-height: 60rpx;
}

.enterprise-member-form button::after {
  border: 0;
}

.enterprise-operation-log-panel {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #eef2f7;
}

.enterprise-operation-log-row {
  display: grid;
  grid-template-columns: 130rpx 190rpx minmax(0, 1fr);
  gap: 12rpx;
  margin-top: 10rpx;
  color: #64748b;
  font-size: 18rpx;
}

.enterprise-operation-log-row text:first-child {
  color: #111827;
  font-weight: 800;
}

.enterprise-customer-message-panel {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #eef2f7;
}

.enterprise-customer-message-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160rpx;
  gap: 8rpx 14rpx;
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  color: #64748b;
  font-size: 18rpx;
}

.enterprise-customer-message-row > view:first-child {
  display: flex;
  justify-content: space-between;
  gap: 10rpx;
  color: #111827;
  font-weight: 850;
}

.enterprise-customer-message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8rpx;
}

.enterprise-customer-message-actions text {
  padding: 7rpx 10rpx;
  border-radius: 10rpx;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 800;
}

.enterprise-approval-admin-card {
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.04);
}

.enterprise-approval-count {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 18rpx;
  font-weight: 800;
}

.enterprise-approval-admin-card > textarea {
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  margin-top: 14rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #f8fafc;
  font-size: 20rpx;
}

.enterprise-approval-admin-list {
  display: grid;
  gap: 10rpx;
  margin-top: 14rpx;
}

.enterprise-approval-admin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.enterprise-approval-admin-row > view:first-child text {
  display: block;
  color: #64748b;
  font-size: 18rpx;
}

.enterprise-approval-admin-row > view:first-child text:first-child {
  color: #111827;
  font-size: 21rpx;
  font-weight: 850;
}

.enterprise-approval-admin-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
}

.enterprise-approval-admin-actions text {
  padding: 8rpx 13rpx;
  border-radius: 11rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 18rpx;
  font-weight: 800;
}

.enterprise-approval-admin-actions text.danger {
  background: #fef2f2;
  color: #dc2626;
}

.enterprise-approval-admin-timeline {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #eef2f7;
}

.enterprise-approval-admin-timeline > view > view {
  display: grid;
  grid-template-columns: 150rpx 190rpx minmax(0, 1fr);
  gap: 10rpx;
  margin-top: 10rpx;
  color: #64748b;
  font-size: 18rpx;
}

.enterprise-approval-admin-timeline > view > view text:nth-child(4) {
  grid-column: 1 / -1;
  color: #475569;
}

.demo-mode-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 18rpx;
  border: 1rpx solid #dbeafe;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
  box-sizing: border-box;
}

.demo-mode-card > view:first-child {
  min-width: 0;
  flex: 1;
}

.demo-mode-title,
.demo-mode-desc {
  display: block;
}

.demo-mode-title {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.demo-mode-desc {
  margin-top: 6rpx;
  color: #475569;
  font-size: 19rpx;
  line-height: 1.45;
}

.demo-navigator-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 10rpx;
}

.demo-navigator-meta text {
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.78);
  color: #334155;
  font-size: 17rpx;
  font-weight: 800;
}

.demo-mode-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
  max-width: 620rpx;
}

.demo-mode-btn {
  width: auto;
  min-width: 132rpx;
  height: 52rpx;
  line-height: 52rpx;
  margin: 0;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #334155;
  font-size: 18rpx;
  font-weight: 850;
}

.demo-mode-btn.primary {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: #ffffff;
}

.demo-mode-btn.warning {
  background: #fff7ed;
  color: #c2410c;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.dashboard-stat-card {
  min-width: 0;
  padding: 20rpx 14rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.dashboard-stat-card.warning {
  background: #fff7ed;
}

.dashboard-stat-card.success {
  background: #ecfdf5;
}

.dashboard-stat-value,
.dashboard-stat-label,
.dashboard-row-title,
.dashboard-row-subtitle,
.dashboard-row-status,
.dashboard-row-time {
  display: block;
}

.dashboard-stat-value {
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}

.dashboard-stat-label {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 19rpx;
}

.dashboard-source-meta {
  display: flex;
  gap: 18rpx;
  margin-bottom: 18rpx;
  color: #94a3b8;
  font-size: 19rpx;
}

.dashboard-card {
  margin-bottom: 22rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.05);
}

.dashboard-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110rpx, 1fr));
  gap: 8rpx;
  padding: 6rpx;
  border-radius: 18rpx;
  background: #f1f5f9;
}

.dashboard-tab {
  min-height: 58rpx;
  line-height: 58rpx;
  border-radius: 14rpx;
  color: #64748b;
  text-align: center;
  font-size: 22rpx;
  font-weight: 800;
}

.dashboard-tab.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.08);
}

.dashboard-list {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
}

.enterprise-project-list {
  display: grid;
  gap: 18rpx;
  margin-top: 18rpx;
}

.enterprise-project-card {
  padding: 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.enterprise-project-card:active {
  border-color: #a5b4fc;
  background: #fafaff;
}

.enterprise-project-head,
.enterprise-project-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.enterprise-lead-status {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 19rpx;
  font-weight: 850;
}

.enterprise-stage-control {
  flex-shrink: 0;
  text-align: right;
}

.enterprise-stage-control > text {
  display: block;
  margin-top: 8rpx;
  color: #94a3b8;
  font-size: 17rpx;
}

.enterprise-project-value-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.enterprise-project-value-grid view {
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.enterprise-project-value-grid .wide {
  grid-column: 1 / -1;
}

.enterprise-project-value-grid text {
  display: block;
  color: #64748b;
  font-size: 19rpx;
}

.enterprise-project-value-grid text:last-child {
  margin-top: 6rpx;
  color: #111827;
  font-size: 22rpx;
  font-weight: 800;
}

.enterprise-project-timeline {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 22rpx;
}

.enterprise-project-timeline view {
  position: relative;
  color: #9ca3af;
  font-size: 19rpx;
  text-align: center;
}

.enterprise-project-timeline view::before {
  position: absolute;
  top: 8rpx;
  right: 50%;
  left: -50%;
  height: 3rpx;
  background: #e5e7eb;
  content: '';
}

.enterprise-project-timeline view:first-child::before {
  display: none;
}

.enterprise-project-timeline view > text:first-child {
  position: relative;
  z-index: 1;
  display: block;
  width: 16rpx;
  height: 16rpx;
  margin: 0 auto 8rpx;
  border: 3rpx solid #ffffff;
  border-radius: 50%;
  background: #d1d5db;
}

.enterprise-project-timeline view.completed::before,
.enterprise-project-timeline view.completed > text:first-child,
.enterprise-project-timeline view.active > text:first-child {
  background: #4f46e5;
}

.enterprise-project-timeline view.completed,
.enterprise-project-timeline view.active {
  color: #312e81;
  font-weight: 800;
}

.enterprise-project-follow {
  display: grid;
  grid-template-columns: 110rpx minmax(0, 1fr);
  gap: 8rpx 14rpx;
  margin-top: 20rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  color: #475569;
  font-size: 20rpx;
}

.enterprise-project-follow text:first-child {
  color: #111827;
  font-weight: 850;
}

.enterprise-project-follow text:last-child {
  grid-column: 2;
  color: #6366f1;
}

.enterprise-project-footer {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #eef2f7;
  color: #64748b;
  font-size: 19rpx;
}

.dashboard-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 8rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.dashboard-row:last-child {
  border-bottom: none;
}

.dashboard-row-main {
  min-width: 0;
  flex: 1;
}

.dashboard-row-side {
  max-width: 44%;
  flex-shrink: 0;
  text-align: right;
}

.dashboard-row-title {
  overflow: hidden;
  color: #111827;
  font-size: 24rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-row-subtitle {
  margin-top: 6rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-row-status {
  color: #2563eb;
  font-size: 19rpx;
  font-weight: 850;
}

.dashboard-row-status.project {
  color: #7c3aed;
}

.dashboard-row-status.delivery {
  color: #059669;
}

.dashboard-row-time {
  margin-top: 6rpx;
  color: #94a3b8;
  font-size: 17rpx;
}

.business-dashboard-view {
  margin-top: 18rpx;
}

.business-period-switch {
  display: inline-flex;
  gap: 8rpx;
  padding: 6rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
}

.business-period-switch text {
  min-width: 96rpx;
  height: 48rpx;
  line-height: 48rpx;
  border-radius: 999rpx;
  color: #64748b;
  text-align: center;
  font-size: 19rpx;
  font-weight: 850;
}

.business-period-switch text.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.08);
}

.business-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.business-metric-grid view,
.business-section-card {
  min-width: 0;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.business-metric-grid text,
.business-section-title,
.business-stage-row text,
.business-api-summary text {
  display: block;
}

.business-metric-grid text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-metric-grid text:last-child {
  margin-top: 8rpx;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.business-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 16rpx;
}

.business-section-title {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.business-stage-row {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 12rpx;
  padding-bottom: 10rpx;
  border-bottom: 1rpx solid #e2e8f0;
}

.business-stage-row:last-child {
  border-bottom: 0;
}

.business-stage-row text:first-child {
  color: #475569;
  font-size: 19rpx;
}

.business-stage-row text:last-child {
  color: #111827;
  font-size: 19rpx;
  font-weight: 850;
  text-align: right;
}

.boss-dashboard-panel {
  margin-top: 22rpx;
  padding: 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #f8f9ff;
}

.boss-dashboard-head,
.boss-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.boss-dashboard-head > view > text:last-child,
.boss-dashboard-head > text,
.boss-section-head > text:last-child {
  display: block;
  color: #64748b;
  font-size: 19rpx;
}

.boss-dashboard-head > view > text:last-child {
  margin-top: 6rpx;
}

.boss-dashboard-head > text {
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  background: #e0e7ff;
  color: #4338ca;
  font-weight: 800;
}

.boss-overview-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}

.boss-overview-grid view,
.boss-section-card {
  min-width: 0;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.boss-overview-grid text {
  display: block;
  text-align: center;
}

.boss-overview-grid text:first-child {
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.boss-overview-grid text:last-child {
  margin-top: 5rpx;
  color: #64748b;
  font-size: 18rpx;
}

.boss-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 14rpx;
}

.boss-full-section {
  margin-top: 14rpx;
}

.boss-funnel-row {
  display: grid;
  grid-template-columns: 100rpx minmax(0, 1fr) 40rpx;
  gap: 12rpx;
  align-items: center;
  margin-top: 14rpx;
  color: #475569;
  font-size: 19rpx;
}

.boss-funnel-row > view {
  overflow: hidden;
  height: 12rpx;
  border-radius: 999rpx;
  background: #e5e7eb;
}

.boss-funnel-row > view > view {
  height: 100%;
  border-radius: inherit;
  background: #6366f1;
}

.boss-funnel-row > text:last-child {
  color: #111827;
  text-align: right;
  font-weight: 800;
}

.boss-efficiency-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.boss-efficiency-grid view {
  padding: 14rpx 8rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  text-align: center;
}

.boss-efficiency-grid text {
  display: block;
  color: #64748b;
  font-size: 17rpx;
}

.boss-efficiency-grid text:first-child {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.boss-trend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 16rpx;
}

.boss-trend-row text {
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 17rpx;
}

.boss-risk-list,
.boss-advice-list {
  display: grid;
  gap: 10rpx;
  margin-top: 14rpx;
}

.boss-risk-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 90rpx minmax(0, 1fr);
  gap: 14rpx;
  align-items: center;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.boss-risk-row text {
  display: block;
  color: #475569;
  font-size: 19rpx;
}

.boss-risk-row view text:first-child {
  color: #111827;
  font-size: 21rpx;
  font-weight: 850;
}

.boss-risk-row view text:last-child {
  margin-top: 5rpx;
  color: #dc2626;
}

.boss-risk-row > text:nth-child(2) {
  padding: 6rpx 8rpx;
  border-radius: 999rpx;
  text-align: center;
  font-weight: 800;
}

.boss-risk-row > text.high {
  background: #fee2e2;
  color: #b91c1c;
}

.boss-risk-row > text.medium {
  background: #fef3c7;
  color: #b45309;
}

.boss-risk-row > text.low {
  background: #dcfce7;
  color: #15803d;
}

.boss-customer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12rpx;
  margin-top: 12rpx;
  padding-bottom: 10rpx;
  border-bottom: 1rpx solid #eef2f7;
  color: #64748b;
  font-size: 18rpx;
}

.boss-customer-row text:first-child {
  color: #111827;
  font-weight: 850;
}

.boss-advice-list text {
  padding: 14rpx;
  border-radius: 14rpx;
  background: #eef2ff;
  color: #3730a3;
  font-size: 19rpx;
  line-height: 1.5;
}

.boss-empty {
  display: block;
  margin-top: 14rpx;
  color: #94a3b8;
  font-size: 19rpx;
}

.business-api-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.business-api-summary view {
  min-width: 0;
  padding: 12rpx;
  border-radius: 14rpx;
  background: #ffffff;
}

.business-api-summary text:first-child {
  color: #2563eb;
  font-size: 26rpx;
  font-weight: 900;
}

.business-api-summary text:last-child {
  margin-top: 4rpx;
  color: #64748b;
  font-size: 17rpx;
}

.business-alert-view {
  margin-top: 18rpx;
}

.business-alert-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.business-alert-summary view {
  min-width: 0;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.business-alert-summary text,
.business-alert-title,
.business-alert-desc,
.business-alert-target,
.business-alert-side text {
  display: block;
}

.business-alert-summary text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-alert-summary text:last-child {
  margin-top: 8rpx;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.business-alert-list {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
}

.business-alert-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 18rpx 8rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.business-alert-row.active {
  border-radius: 18rpx;
  border-bottom-color: transparent;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1rpx #dbeafe;
}

.business-alert-row:last-child {
  border-bottom: 0;
}

.business-alert-main {
  min-width: 0;
  flex: 1;
}

.business-alert-side {
  flex-shrink: 0;
  min-width: 170rpx;
  text-align: right;
}

.business-alert-title {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.business-alert-desc,
.business-alert-target {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
  line-height: 1.45;
}

.business-alert-type,
.business-alert-level {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  box-sizing: border-box;
}

.business-alert-type {
  background: #eef2ff;
  color: #2563eb;
  font-size: 18rpx;
  font-weight: 850;
}

.business-alert-side text {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
}

.business-alert-level.low {
  background: #ecfdf5;
  color: #059669;
}

.business-alert-level.medium {
  background: #fffbeb;
  color: #d97706;
}

.business-alert-level.high {
  background: #fef2f2;
  color: #dc2626;
}

.business-alert-detail {
  margin-top: 18rpx;
  padding: 20rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.05);
}

.business-alert-detail-head,
.business-alert-action-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.business-alert-detail-title,
.business-alert-detail-subtitle,
.business-alert-detail-grid text,
.business-alert-reason text,
.business-alert-action-title,
.business-alert-action-row text {
  display: block;
}

.business-alert-detail-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.business-alert-detail-subtitle {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 19rpx;
}

.business-alert-status-pill {
  flex-shrink: 0;
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #2563eb;
  font-size: 18rpx;
  font-weight: 850;
}

.business-alert-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.business-alert-detail-grid view {
  min-width: 0;
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.business-alert-detail-grid text:first-child,
.business-alert-reason text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-alert-detail-grid text:last-child,
.business-alert-reason text:last-child {
  margin-top: 6rpx;
  overflow: hidden;
  color: #111827;
  font-size: 20rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.business-alert-reason {
  margin-top: 14rpx;
  padding: 14rpx;
  border-left: 4rpx solid #2563eb;
  border-radius: 16rpx;
  background: #f8fafc;
}

.business-alert-reason text:last-child {
  white-space: normal;
}

.business-alert-action-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 10rpx;
  margin-top: 16rpx;
}

.business-alert-input,
.business-alert-picker,
.business-alert-textarea {
  width: 100%;
  min-width: 0;
  border: 1rpx solid #e2e8f0;
  border-radius: 16rpx;
  background: #ffffff;
  color: #111827;
  font-size: 20rpx;
  box-sizing: border-box;
}

.business-alert-input,
.business-alert-picker {
  height: 58rpx;
  line-height: 58rpx;
  padding: 0 16rpx;
}

.business-alert-textarea {
  grid-column: 1 / -1;
  min-height: 112rpx;
  padding: 14rpx 16rpx;
  line-height: 1.5;
}

.business-alert-action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10rpx;
  grid-column: 1 / -1;
}

.business-alert-action-button {
  width: auto;
  min-width: 160rpx;
  height: 56rpx;
  line-height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 850;
}

.business-alert-action-button.ghost {
  background: #f1f5f9;
  color: #334155;
}

.business-alert-action-button.primary {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: #ffffff;
}

.business-alert-action-list {
  margin-top: 18rpx;
}

.business-alert-action-title {
  margin-bottom: 10rpx;
  color: #111827;
  font-size: 22rpx;
  font-weight: 900;
}

.business-alert-action-row {
  padding: 14rpx 0;
  border-top: 1rpx solid #eef2f7;
}

.business-alert-action-row > view:first-child {
  min-width: 0;
  flex: 1;
}

.business-alert-action-row > view:last-child {
  flex-shrink: 0;
  min-width: 170rpx;
  text-align: right;
}

.business-alert-action-row text:first-child {
  color: #111827;
  font-size: 20rpx;
  font-weight: 850;
}

.business-alert-action-row text:last-child,
.business-alert-action-empty {
  margin-top: 5rpx;
  color: #64748b;
  font-size: 18rpx;
  line-height: 1.45;
}

.business-report-view {
  margin-top: 18rpx;
}

.business-report-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
  box-sizing: border-box;
}

.business-report-hero > view:first-child {
  min-width: 0;
  flex: 1;
}

.business-report-hero > view:last-child {
  flex-shrink: 0;
  min-width: 160rpx;
  text-align: right;
}

.business-report-title,
.business-report-summary,
.business-report-hero text,
.business-report-card text,
.business-report-risk-grid text {
  display: block;
}

.business-report-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.business-report-summary {
  margin-top: 8rpx;
  color: #475569;
  font-size: 20rpx;
  line-height: 1.55;
}

.business-report-hero > view:last-child text:first-child {
  color: #2563eb;
  font-size: 24rpx;
  font-weight: 900;
}

.business-report-hero > view:last-child text:last-child {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
}

.business-report-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.business-report-card {
  min-width: 0;
  padding: 16rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 18rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.business-report-card text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-report-card text:nth-child(2) {
  margin-top: 8rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.business-report-card text:last-child {
  margin-top: 6rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.business-report-section {
  margin-top: 16rpx;
  padding: 18rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 20rpx;
  background: #ffffff;
}

.business-report-risk-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.business-report-risk-grid view {
  min-width: 0;
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.business-report-risk-grid text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-report-risk-grid text:last-child {
  margin-top: 6rpx;
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.business-insight-view {
  margin-top: 18rpx;
}

.business-insight-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #f0f9ff 0%, #eef2ff 100%);
  box-sizing: border-box;
}

.business-insight-hero > view:first-child {
  min-width: 0;
  flex: 1;
}

.business-insight-hero > view:last-child {
  flex-shrink: 0;
  min-width: 150rpx;
  text-align: right;
}

.business-insight-title,
.business-insight-summary,
.business-insight-hero text,
.business-insight-summary-grid text,
.business-insight-card text,
.business-insight-action-row text {
  display: block;
}

.business-insight-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.business-insight-summary {
  margin-top: 8rpx;
  color: #475569;
  font-size: 20rpx;
  line-height: 1.55;
}

.business-insight-hero > view:last-child text:first-child {
  color: #2563eb;
  font-size: 34rpx;
  font-weight: 900;
}

.business-insight-hero > view:last-child text:last-child {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
}

.business-insight-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.business-insight-summary-grid view {
  min-width: 0;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: inset 0 0 0 1rpx #eef2f7;
  box-sizing: border-box;
}

.business-insight-summary-grid text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-insight-summary-grid text:last-child {
  margin-top: 8rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.business-insight-section {
  margin-top: 16rpx;
  padding: 18rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 20rpx;
  background: #ffffff;
}

.business-insight-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.business-insight-card {
  min-width: 0;
  margin-top: 14rpx;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.business-insight-list .business-insight-card {
  margin-top: 0;
}

.business-insight-card.growth {
  background: #eff6ff;
}

.business-insight-card.risk {
  background: #fff7ed;
}

.business-insight-card text:first-child {
  color: #2563eb;
  font-size: 18rpx;
  font-weight: 850;
}

.business-insight-card.risk text:first-child {
  color: #ea580c;
}

.business-insight-card text:nth-child(2) {
  margin-top: 8rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.business-insight-card text:nth-child(3),
.business-insight-card text:last-child {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 18rpx;
  line-height: 1.5;
}

.business-insight-card text:last-child {
  color: #334155;
  font-weight: 750;
}

.business-insight-action-list {
  margin-top: 12rpx;
}

.business-insight-action-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 13rpx 0;
  border-top: 1rpx solid #eef2f7;
}

.business-insight-action-row text:first-child {
  flex-shrink: 0;
  min-width: 120rpx;
  color: #2563eb;
  font-size: 18rpx;
  font-weight: 850;
}

.business-insight-action-row text:last-child {
  min-width: 0;
  flex: 1;
  color: #334155;
  font-size: 19rpx;
  line-height: 1.5;
}

.business-advisor-view {
  margin-top: 18rpx;
}

.business-advisor-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%);
  box-sizing: border-box;
}

.business-advisor-hero > view:first-child {
  min-width: 0;
  flex: 1;
}

.business-advisor-hero > view:last-child {
  flex-shrink: 0;
  min-width: 150rpx;
  text-align: right;
}

.business-advisor-title,
.business-advisor-summary,
.business-advisor-hero text,
.business-advisor-summary-grid text,
.business-advisor-card text,
.business-advisor-row text {
  display: block;
}

.business-advisor-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.business-advisor-summary {
  margin-top: 8rpx;
  color: #475569;
  font-size: 20rpx;
  line-height: 1.55;
}

.business-advisor-hero > view:last-child text:first-child {
  color: #7c3aed;
  font-size: 34rpx;
  font-weight: 900;
}

.business-advisor-hero > view:last-child text:last-child {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
}

.business-advisor-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.business-advisor-summary-grid view {
  min-width: 0;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: inset 0 0 0 1rpx #eef2f7;
  box-sizing: border-box;
}

.business-advisor-summary-grid text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.business-advisor-summary-grid text:last-child {
  margin-top: 8rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.business-advisor-section {
  margin-top: 16rpx;
  padding: 18rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 20rpx;
  background: #ffffff;
}

.business-advisor-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.business-advisor-card,
.business-advisor-row {
  min-width: 0;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.business-advisor-row {
  margin-top: 12rpx;
}

.business-advisor-card.high,
.business-advisor-row.risk {
  background: #fff7ed;
}

.business-advisor-card > view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.business-advisor-card > view text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #2563eb;
  font-size: 17rpx;
  font-weight: 850;
}

.business-advisor-card.high > view text:last-child {
  background: #fef2f2;
  color: #dc2626;
}

.business-advisor-card.medium > view text:last-child {
  background: #fffbeb;
  color: #d97706;
}

.business-advisor-card.low > view text:last-child {
  background: #ecfdf5;
  color: #059669;
}

.business-advisor-card > text:nth-child(2),
.business-advisor-row text:first-child {
  margin-top: 10rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.business-advisor-card > text:nth-child(3),
.business-advisor-row text:nth-child(2) {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 18rpx;
  line-height: 1.5;
}

.business-advisor-card > text:last-child,
.business-advisor-row text:last-child {
  margin-top: 8rpx;
  color: #334155;
  font-size: 19rpx;
  font-weight: 750;
  line-height: 1.5;
}

.lead-pipeline-view {
  margin-top: 18rpx;
}

.lead-pipeline-stats {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10rpx;
}

.lead-pipeline-stat {
  min-width: 0;
  padding: 14rpx 10rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.lead-pipeline-stat text,
.lead-pipeline-customer,
.lead-pipeline-company,
.lead-pipeline-project,
.lead-pipeline-side text {
  display: block;
}

.lead-pipeline-stat text:first-child {
  overflow: hidden;
  color: #64748b;
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-pipeline-stat text:nth-child(2) {
  margin-top: 6rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.lead-pipeline-stat text:last-child {
  margin-top: 4rpx;
  color: #2563eb;
  font-size: 18rpx;
  font-weight: 800;
}

.lead-pipeline-list {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
}

.lead-pipeline-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 8rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.lead-pipeline-row:last-child {
  border-bottom: 0;
}

.lead-pipeline-main {
  min-width: 0;
  flex: 1;
}

.lead-pipeline-side {
  flex-shrink: 0;
  min-width: 190rpx;
  text-align: right;
}

.lead-pipeline-customer {
  overflow: hidden;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-pipeline-company,
.lead-pipeline-project {
  margin-top: 6rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-pipeline-stage {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 142rpx;
  height: 46rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #2563eb;
  font-size: 19rpx;
  font-weight: 850;
  box-sizing: border-box;
}

.lead-pipeline-side text {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
}

.sales-forecast-view {
  margin-top: 18rpx;
}

.sales-forecast-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.sales-forecast-summary view {
  min-width: 0;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.sales-forecast-summary text,
.sales-forecast-customer,
.sales-forecast-company,
.sales-forecast-project,
.sales-forecast-side text {
  display: block;
}

.sales-forecast-summary text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.sales-forecast-summary text:last-child {
  margin-top: 8rpx;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.sales-forecast-list {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
}

.sales-forecast-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 8rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.sales-forecast-row:last-child {
  border-bottom: 0;
}

.sales-forecast-main {
  min-width: 0;
  flex: 1;
}

.sales-forecast-side {
  flex-shrink: 0;
  min-width: 230rpx;
  text-align: right;
}

.sales-forecast-customer {
  overflow: hidden;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sales-forecast-company,
.sales-forecast-project {
  margin-top: 6rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sales-forecast-stage,
.sales-forecast-risk {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 126rpx;
  height: 42rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  box-sizing: border-box;
}

.sales-forecast-stage {
  background: #eef2ff;
  color: #2563eb;
  font-size: 18rpx;
  font-weight: 850;
}

.sales-forecast-side text {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 18rpx;
}

.sales-forecast-risk.low {
  background: #ecfdf5;
  color: #059669;
}

.sales-forecast-risk.medium {
  background: #fffbeb;
  color: #d97706;
}

.sales-forecast-risk.high {
  background: #fef2f2;
  color: #dc2626;
}

.lead-follow-center {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.lead-follow-card {
  min-width: 0;
  padding: 18rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.04);
  box-sizing: border-box;
}

.lead-follow-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.lead-follow-head > view {
  min-width: 0;
}

.lead-follow-customer,
.lead-follow-company,
.lead-follow-status,
.lead-follow-latest text {
  display: block;
}

.lead-follow-customer {
  overflow: hidden;
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-follow-company {
  margin-top: 6rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-follow-status {
  flex-shrink: 0;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #2563eb;
  font-size: 19rpx;
  font-weight: 850;
}

.lead-follow-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.lead-follow-grid view {
  min-width: 0;
  padding: 12rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.lead-follow-grid text {
  display: block;
  overflow: hidden;
  color: #64748b;
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-follow-grid text:last-child {
  margin-top: 5rpx;
  color: #111827;
  font-size: 20rpx;
  font-weight: 800;
}

.lead-follow-latest {
  margin-top: 14rpx;
  padding: 14rpx;
  border-left: 4rpx solid #2563eb;
  border-radius: 14rpx;
  background: #f8fafc;
}

.lead-follow-latest text:first-child {
  color: #64748b;
  font-size: 18rpx;
}

.lead-follow-latest text:last-child {
  margin-top: 5rpx;
  color: #111827;
  font-size: 20rpx;
  line-height: 1.45;
}

.lead-follow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.lead-follow-action {
  min-width: 116rpx;
  height: 48rpx;
  line-height: 48rpx;
  margin: 0;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #334155;
  font-size: 18rpx;
  font-weight: 800;
}

.dashboard-empty {
  padding: 54rpx 20rpx;
  color: #94a3b8;
  text-align: center;
  font-size: 22rpx;
}

.api-management-view {
  margin-top: 18rpx;
}

.api-view-switch,
.order-view-switch {
  display: grid;
  gap: 8rpx;
  margin-bottom: 14rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: #f1f5f9;
}

.api-view-switch {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.order-view-switch {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.brand-api-create {
  width: 100%;
  height: 62rpx;
  margin: 0;
  border-radius: 14rpx;
  background: #4338ca;
  color: #ffffff;
  font-size: 19rpx;
  font-weight: 850;
  line-height: 62rpx;
}

.api-plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-bottom: 14rpx;
}

.api-plan-card {
  min-width: 0;
  padding: 14rpx;
  border: 1rpx solid #e8eaf2;
  border-radius: 16rpx;
  background: #ffffff;
}

.api-plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  color: #111827;
  font-size: 18rpx;
  font-weight: 900;
}

.api-plan-head text:last-child {
  color: #4338ca;
}

.api-plan-meta,
.brand-api-plan-summary {
  display: block;
  margin-top: 8rpx;
  color: #64748b;
  font-size: 16rpx;
  line-height: 1.5;
}

.brand-api-editor {
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.brand-api-input {
  width: 100%;
  height: 62rpx;
  margin-top: 12rpx;
  padding: 0 14rpx;
  border-radius: 13rpx;
  background: #ffffff;
  color: #111827;
  font-size: 20rpx;
  box-sizing: border-box;
}

.brand-api-field-title {
  display: block;
  margin-top: 16rpx;
  color: #475569;
  font-size: 18rpx;
  font-weight: 850;
}

.brand-api-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 9rpx;
}

.brand-api-chip {
  padding: 7rpx 11rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #64748b;
  font-size: 16rpx;
  font-weight: 800;
}

.brand-api-chip.active {
  background: #4338ca;
  color: #ffffff;
}

.brand-api-editor-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.brand-api-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8rpx;
}

.credential-title {
  margin-top: 12rpx;
}

.api-credential-list {
  display: flex;
  flex-direction: column;
  gap: 7rpx;
  margin-top: 8rpx;
}

.api-credential-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  background: #f8fafc;
}

.api-credential-row > view,
.api-credential-row text {
  min-width: 0;
}

.api-credential-row > view:last-child {
  flex-shrink: 0;
  text-align: right;
}

.api-credential-row text {
  display: block;
  overflow: hidden;
  color: #111827;
  font-family: monospace;
  font-size: 16rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-credential-row text:last-child {
  margin-top: 4rpx;
  color: #64748b;
  font-family: inherit;
  font-size: 14rpx;
}

.api-credential-status.active {
  color: #047857;
}

.api-credential-status.disabled {
  color: #dc2626;
}

.api-status.disabled {
  background: #fef2f2;
  color: #dc2626;
}

.api-policy-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.api-policy-card {
  margin-bottom: 0;
}

.api-policy-restrictions {
  min-height: 130rpx;
}

.brand-usage-stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 12rpx;
}

.brand-api-call-list {
  margin-bottom: 18rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.api-doc-apps {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 12rpx;
}

.api-doc-key-card,
.api-doc-detail {
  padding: 18rpx;
  border: 1rpx solid #e8eaf2;
  border-radius: 18rpx;
  background: #ffffff;
}

.api-doc-key {
  display: block;
  margin-top: 10rpx;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  color: #4338ca;
  font-family: monospace;
  font-size: 18rpx;
}

.api-doc-layout {
  display: grid;
  grid-template-columns: minmax(180rpx, 0.7fr) minmax(0, 1.3fr);
  gap: 12rpx;
  margin-top: 14rpx;
}

.api-doc-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.api-doc-list-item {
  padding: 13rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 14rpx;
  background: #ffffff;
}

.api-doc-list-item.active {
  border-color: #a5b4fc;
  background: #eef2ff;
}

.api-doc-list-item text {
  display: block;
  color: #111827;
  font-size: 18rpx;
  font-weight: 850;
}

.api-doc-list-item text:last-child {
  overflow: hidden;
  margin-top: 5rpx;
  color: #64748b;
  font-size: 15rpx;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-doc-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.api-doc-method {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  background: #ecfdf5;
  color: #047857;
  font-size: 16rpx;
  font-weight: 900;
}

.api-doc-path {
  display: block;
  margin-top: 9rpx;
  color: #4338ca;
  font-family: monospace;
  font-size: 17rpx;
}

.api-doc-param {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 7rpx;
  padding: 9rpx 11rpx;
  border-radius: 11rpx;
  background: #f8fafc;
  color: #64748b;
  font-size: 16rpx;
}

.api-doc-param text:first-child {
  flex-shrink: 0;
  color: #111827;
  font-weight: 850;
}

.api-doc-code {
  display: block;
  margin-top: 8rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background: #111827;
  color: #e5e7eb;
  font-family: monospace;
  font-size: 15rpx;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}

.api-sandbox-form,
.api-sandbox-result {
  margin-top: 12rpx;
  padding: 18rpx;
  border: 1rpx solid #e8eaf2;
  border-radius: 18rpx;
  background: #ffffff;
}

.api-sandbox-summary,
.api-sandbox-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  color: #111827;
  font-size: 19rpx;
  font-weight: 850;
}

.api-sandbox-summary text:last-child {
  color: #64748b;
  font-size: 16rpx;
  font-weight: 600;
}

.api-sandbox-request {
  width: 100%;
  min-height: 190rpx;
  margin-top: 8rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background: #111827;
  color: #e5e7eb;
  font-family: monospace;
  font-size: 16rpx;
  line-height: 1.55;
  box-sizing: border-box;
}

.api-sandbox-run {
  margin-top: 14rpx;
}

.api-sandbox-status {
  color: #b45309;
  font-size: 16rpx;
  font-weight: 850;
}

.api-sandbox-status.SUCCESS {
  color: #047857;
}

.api-sandbox-status.APP_PAUSED,
.api-sandbox-status.PERMISSION_DENIED,
.api-sandbox-status.QUOTA_NOT_ENOUGH {
  color: #dc2626;
}

.api-audit-list {
  margin-top: 14rpx;
  overflow: hidden;
  border: 1rpx solid #e8eaf2;
  border-radius: 16rpx;
  background: #ffffff;
}

.api-audit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 14rpx 16rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.api-audit-row:last-child {
  border-bottom: 0;
}

.api-audit-main,
.api-audit-side {
  min-width: 0;
}

.api-audit-main text,
.api-audit-side text {
  display: block;
  overflow: hidden;
  color: #111827;
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-audit-main text:not(:first-child),
.api-audit-side text:last-child {
  margin-top: 4rpx;
  color: #64748b;
  font-size: 15rpx;
}

.api-audit-side {
  flex-shrink: 0;
  text-align: right;
}

.api-audit-status {
  font-weight: 850;
}

.api-audit-status.success {
  color: #047857;
}

.api-audit-status.failed,
.api-audit-status.app_paused,
.api-audit-status.quota_not_enough,
.api-audit-status.permission_denied {
  color: #dc2626;
}

.api-analytics-filter-card,
.api-analytics-section {
  padding: 18rpx;
  border: 1rpx solid #e8eaf2;
  border-radius: 16rpx;
  background: #ffffff;
}

.api-analytics-section {
  margin-top: 14rpx;
}

.api-analytics-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.api-analytics-metrics view {
  min-width: 0;
  padding: 16rpx 10rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  text-align: center;
}

.api-analytics-metrics text {
  display: block;
  color: #64748b;
  font-size: 15rpx;
}

.api-analytics-metrics text:first-child {
  margin-bottom: 5rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 850;
}

.api-analytics-list {
  margin-top: 12rpx;
  overflow: hidden;
  border: 1rpx solid #eef2f7;
  border-radius: 14rpx;
}

.api-analytics-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 14rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.api-analytics-row:last-child {
  border-bottom: 0;
}

.api-analytics-row view {
  min-width: 0;
}

.api-analytics-row view:last-child {
  flex-shrink: 0;
  text-align: right;
}

.api-analytics-row text {
  display: block;
  color: #111827;
  font-size: 17rpx;
}

.api-analytics-row view text:last-child {
  margin-top: 4rpx;
  color: #64748b;
  font-size: 15rpx;
}

.api-analytics-row.failure > text {
  flex-shrink: 0;
  color: #dc2626;
  font-weight: 850;
}

.api-billing-toolbar,
.api-billing-detail-head,
.api-billing-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.api-billing-toolbar {
  padding: 14rpx 18rpx;
  border: 1rpx solid #e8eaf2;
  border-radius: 16rpx;
  background: #ffffff;
  color: #64748b;
  font-size: 17rpx;
  font-weight: 800;
}

.api-billing-toolbar .brand-api-chip-list {
  margin-top: 0;
}

.api-billing-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.api-billing-summary view,
.api-billing-card,
.api-billing-detail {
  border: 1rpx solid #e8eaf2;
  border-radius: 16rpx;
  background: #ffffff;
}

.api-billing-summary view {
  padding: 15rpx 10rpx;
  text-align: center;
}

.api-billing-summary text,
.api-billing-card-grid text,
.api-billing-detail-grid text {
  display: block;
  color: #64748b;
  font-size: 15rpx;
}

.api-billing-summary text:first-child {
  margin-bottom: 5rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 850;
}

.api-billing-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.api-billing-card,
.api-billing-detail {
  padding: 18rpx;
}

.api-billing-card-head > view text,
.api-billing-detail-head > view text {
  display: block;
  color: #111827;
  font-size: 19rpx;
  font-weight: 850;
}

.api-billing-card-head > view text:last-child,
.api-billing-detail-head > view text:last-child {
  overflow: hidden;
  margin-top: 4rpx;
  color: #64748b;
  font-size: 15rpx;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-billing-card-head > text {
  flex-shrink: 0;
  color: #4338ca;
  font-size: 16rpx;
  font-weight: 850;
}

.api-billing-card-grid,
.api-billing-detail-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 14rpx;
}

.api-billing-card-grid view,
.api-billing-detail-grid view {
  min-width: 0;
  padding: 10rpx;
  border-radius: 12rpx;
  background: #f8fafc;
}

.api-billing-card-grid text:last-child,
.api-billing-detail-grid text:last-child {
  overflow: hidden;
  margin-top: 4rpx;
  color: #111827;
  font-size: 18rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-billing-detail-link {
  display: block;
  margin-top: 13rpx;
  color: #4338ca;
  font-size: 16rpx;
  font-weight: 850;
  text-align: right;
}

.api-billing-detail-head .api-status-action {
  width: auto;
  min-width: 120rpx;
  margin: 0;
  padding: 0 14rpx;
}

.api-billing-detail-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.api-billing-source {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
  color: #64748b;
  font-size: 16rpx;
}

.api-view-switch text,
.order-view-switch text {
  min-height: 52rpx;
  border-radius: 12rpx;
  color: #64748b;
  text-align: center;
  font-size: 19rpx;
  font-weight: 800;
  line-height: 52rpx;
}

.api-view-switch text.active,
.order-view-switch text.active {
  background: #ffffff;
  color: #4338ca;
  box-shadow: 0 5rpx 14rpx rgba(15, 23, 42, 0.06);
}

.api-endpoint-section {
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.api-section-title,
.api-card-title,
.api-company-name,
.api-usage-grid text,
.api-key-row text {
  display: block;
}

.api-section-title {
  color: #111827;
  font-size: 22rpx;
  font-weight: 850;
}

.api-endpoint-list,
.api-permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.api-endpoint-list text,
.api-permission-list text {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 16rpx;
}

.api-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.api-card {
  min-width: 0;
  padding: 18rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 18rpx;
  background: #ffffff;
}

.api-card-header,
.api-key-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.api-card-header > view {
  min-width: 0;
  flex: 1;
}

.api-card-title {
  overflow: hidden;
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-company-name {
  margin-top: 5rpx;
  color: #64748b;
  font-size: 18rpx;
}

.api-status {
  flex-shrink: 0;
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  font-size: 17rpx;
  font-weight: 800;
}

.api-status.enabled {
  background: #ecfdf5;
  color: #047857;
}

.api-status.paused {
  background: #f1f5f9;
  color: #64748b;
}

.api-usage-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.api-usage-grid > view {
  padding: 12rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.api-usage-grid text:first-child {
  color: #94a3b8;
  font-size: 16rpx;
}

.api-usage-grid text:last-child {
  margin-top: 5rpx;
  color: #111827;
  font-size: 23rpx;
  font-weight: 850;
}

.api-key-row {
  margin-top: 13rpx;
  color: #64748b;
  font-size: 16rpx;
}

.api-key-row text:first-child {
  font-family: monospace;
}

.api-status-action {
  margin: 14rpx 0 0;
  height: 54rpx;
  border: 0;
  border-radius: 14rpx;
  background: #f1f5f9;
  color: #475569;
  font-size: 18rpx;
  line-height: 54rpx;
}

.api-status-action.paused {
  background: #eef2ff;
  color: #4338ca;
}

.api-status-action::after {
  border: 0;
}

.api-usage-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
}

.api-usage-stats > view {
  min-width: 0;
  padding: 16rpx 12rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.api-usage-stats text {
  display: block;
}

.api-usage-stats text:first-child {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.api-usage-stats text:last-child {
  margin-top: 5rpx;
  color: #64748b;
  font-size: 16rpx;
}

.api-call-list {
  margin-top: 14rpx;
}

.api-call-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 4rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.api-call-row:last-child {
  border-bottom: 0;
}

.api-call-main {
  min-width: 0;
  flex: 1;
}

.api-call-main text,
.api-call-side text {
  display: block;
}

.api-call-main text:first-child {
  color: #111827;
  font-size: 21rpx;
  font-weight: 850;
}

.api-call-main text:last-child,
.api-call-side text:last-child {
  margin-top: 5rpx;
  color: #64748b;
  font-size: 16rpx;
}

.api-call-side {
  flex-shrink: 0;
  text-align: right;
}

.api-call-status {
  font-size: 18rpx;
  font-weight: 850;
}

.api-call-status.success {
  color: #059669;
}

.api-call-status.failed {
  color: #dc2626;
}

.api-call-status.pending {
  color: #2563eb;
}

.order-management-view {
  margin-top: 18rpx;
}

.order-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.order-summary-row text:first-child {
  color: #111827;
  font-size: 22rpx;
  font-weight: 900;
}

.order-summary-row text:last-child {
  color: #64748b;
  font-size: 17rpx;
}

.order-view-switch {
  margin-top: 14rpx;
}

.order-list {
  margin-top: 12rpx;
}

.order-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 4rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.order-row:last-child {
  border-bottom: 0;
}

.order-main {
  min-width: 0;
}

.order-title-row {
  display: flex;
  align-items: center;
  gap: 9rpx;
}

.order-title-row text:first-child {
  overflow: hidden;
  color: #111827;
  font-size: 21rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-title-row text:last-child {
  flex-shrink: 0;
  padding: 4rpx 8rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 15rpx;
}

.order-id,
.order-customer,
.order-target,
.order-value-group text,
.order-status-group text {
  display: block;
}

.order-id,
.order-customer,
.order-target,
.order-value-group text:last-child,
.order-status-group text:last-child {
  margin-top: 5rpx;
  color: #94a3b8;
  font-size: 16rpx;
}

.order-value-group,
.order-status-group {
  flex-shrink: 0;
  text-align: right;
}

.order-amount {
  color: #111827;
  font-size: 22rpx;
  font-weight: 900;
}

.order-status {
  font-size: 18rpx;
  font-weight: 850;
}

.order-status.pending {
  color: #d97706;
}

.order-status.paid,
.order-status.processing {
  color: #2563eb;
}

.order-status.completed {
  color: #059669;
}

.order-status.cancelled {
  color: #94a3b8;
}

.order-fulfill-button {
  min-width: 0;
  height: 48rpx;
  margin: 8rpx 0 0;
  padding: 0 12rpx;
  border: 0;
  border-radius: 12rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 16rpx;
  line-height: 48rpx;
}

.order-fulfill-button::after {
  border: 0;
}

.order-fulfilled-label {
  margin-top: 7rpx;
  color: #059669;
  font-size: 16rpx;
  font-weight: 800;
}

.fulfillment-list {
  margin-top: 12rpx;
}

.fulfillment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 18rpx 4rpx;
  border-bottom: 1rpx solid #eef2f7;
}

.fulfillment-row:last-child {
  border-bottom: 0;
}

.fulfillment-main {
  min-width: 0;
  flex: 1;
}

.fulfillment-main text,
.fulfillment-side text {
  display: block;
}

.fulfillment-main text:first-child {
  color: #111827;
  font-size: 21rpx;
  font-weight: 900;
}

.fulfillment-main text:nth-child(2) {
  margin-top: 5rpx;
  color: #475569;
  font-size: 18rpx;
}

.fulfillment-main text:last-child,
.fulfillment-side text:last-child {
  margin-top: 5rpx;
  color: #94a3b8;
  font-size: 16rpx;
}

.fulfillment-side {
  flex-shrink: 0;
  text-align: right;
}

.fulfillment-status {
  font-size: 18rpx;
  font-weight: 850;
}

.fulfillment-status.pending,
.fulfillment-status.processing {
  color: #2563eb;
}

.fulfillment-status.completed {
  color: #059669;
}

.fulfillment-status.failed {
  color: #dc2626;
}

.lead-section-title {
  margin: 28rpx 0 16rpx;
}

.lead-section-title text:first-child,
.lead-section-title text:last-child {
  display: block;
}

.lead-section-title text:first-child {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.lead-section-title text:last-child {
  margin-top: 6rpx;
  color: #64748b;
  font-size: 20rpx;
}

@media screen and (max-width: 720px) {
  .client-portal-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .client-work-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lead-follow-center,
  .lead-pipeline-stats,
  .sales-forecast-summary,
  .business-metric-grid,
  .business-section-grid,
  .boss-dashboard-grid,
  .business-api-summary,
  .business-alert-summary,
  .business-alert-detail-grid,
  .business-alert-action-form,
  .business-report-grid,
  .business-report-risk-grid,
  .business-insight-summary-grid,
  .business-insight-list,
  .business-advisor-summary-grid,
  .business-advisor-list,
  .lead-follow-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .boss-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .boss-risk-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .boss-risk-row > text:last-child {
    grid-column: 1 / -1;
  }

  .enterprise-member-form,
  .enterprise-operation-log-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .sales-forecast-row,
  .lead-pipeline-row,
  .business-alert-row,
  .business-alert-detail-head,
  .business-report-hero,
  .business-insight-hero,
  .business-insight-action-row,
  .business-advisor-hero,
  .business-alert-action-row,
  .business-alert-action-buttons {
    align-items: flex-start;
    flex-direction: column;
  }

  .lead-pipeline-side,
  .sales-forecast-side,
  .business-alert-side,
  .business-alert-action-row > view:last-child {
    width: 100%;
    min-width: 0;
    text-align: left;
  }

  .business-alert-action-button {
    width: 100%;
  }

  .business-report-hero > view:last-child,
  .business-insight-hero > view:last-child,
  .business-advisor-hero > view:last-child {
    min-width: 0;
    text-align: left;
  }

  .demo-mode-card,
  .demo-mode-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .demo-mode-actions,
  .demo-mode-btn {
    width: 100%;
    max-width: none;
  }

  .api-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .api-plan-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .api-policy-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .api-doc-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .api-usage-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .api-analytics-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .api-billing-summary,
  .api-billing-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .api-billing-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .order-status-group {
    grid-column: span 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }

  .order-status-group text:last-child {
    margin-top: 0;
  }

  .dashboard-stat-card:first-child {
    grid-column: span 2;
  }
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #222;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #888;
}

.summary-card,
.admin-nav-card,
.filter-card,
.lead-card,
.empty-state {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.admin-nav-card {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.nav-btn {
  flex: 1;
  min-width: 180rpx;
  border-radius: 16rpx;
  background: #fff1f0;
  color: #ff4d4f;
  font-size: 24rpx;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  color: #333;
  font-size: 26rpx;
}

.search-input {
  width: 100%;
  background: #f5f7fa;
  border-radius: 16rpx;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
  font-size: 24rpx;
  margin-bottom: 14rpx;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.filter-chip {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #eef5ff;
  color: #1677ff;
  font-size: 22rpx;
}

.lead-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.lead-top {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.lead-company {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.lead-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
}

.status-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.lead-line,
.lead-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #444;
  word-break: break-all;
}

.card-actions {
  margin-top: 18rpx;
  display: flex;
  gap: 12rpx;
}

.detail-btn,
.project-btn {
  flex: 1;
  border-radius: 16rpx;
  font-size: 24rpx;
}

.detail-btn {
  background: #f0f5ff;
  color: #2f54eb;
}

.project-btn {
  background: #1677ff;
  color: #fff;
}

.empty-state {
  text-align: center;
}

.loading-state {
  padding: 32rpx 24rpx;
  text-align: center;
  color: #666;
  font-size: 24rpx;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.empty-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #888;
}

.retry-btn {
  margin-top: 20rpx;
  background: #f5f5f5;
  color: #333;
  border-radius: 999rpx;
}
.enterprise-commerce-admin-card {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 14rpx 36rpx rgba(15, 23, 42, 0.06);
}

.enterprise-commerce-admin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.enterprise-commerce-admin-grid > view {
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.enterprise-commerce-admin-list > view {
  margin-top: 14rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background: #ffffff;
}

.enterprise-commerce-admin-list text {
  display: block;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.6;
}

.enterprise-commerce-admin-list > view > text:first-child {
  color: #111827;
  font-size: 24rpx;
  font-weight: 700;
}

.enterprise-commerce-admin-list > view > view {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.enterprise-commerce-admin-list > view > view text {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
}

@media (max-width: 720px) {
  .enterprise-commerce-admin-grid {
    grid-template-columns: 1fr;
  }
}

.enterprise-data-center {
  margin: 24rpx 0;
  padding: 28rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.1);
  border-radius: 24rpx;
  background: #f7f8fc;
}

.enterprise-data-center-head,
.enterprise-data-center-list > view {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.enterprise-data-center-source {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 20rpx;
}

.enterprise-data-center-section {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.05);
}

.enterprise-data-center-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.enterprise-data-center-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.enterprise-data-center-grid > view {
  padding: 18rpx;
  border-radius: 16rpx;
  background: #f6f7fb;
}

.enterprise-data-center-grid text,
.enterprise-audit-trend text {
  display: block;
}

.enterprise-data-center-grid text:first-child {
  color: #111827;
  font-size: 30rpx;
  font-weight: 700;
}

.enterprise-data-center-grid text:last-child,
.enterprise-data-center-list text:first-child,
.enterprise-audit-trend text {
  color: #6b7280;
  font-size: 22rpx;
}

.enterprise-data-center-list > view {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eef0f4;
}

.enterprise-data-center-list text:last-child {
  color: #111827;
  font-weight: 700;
}

.enterprise-audit-trend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.enterprise-audit-trend > view {
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.enterprise-audit-trend text:first-child {
  color: #111827;
  font-weight: 700;
}

.enterprise-data-center-note {
  display: block;
  margin-top: 14rpx;
  color: #9ca3af;
  font-size: 20rpx;
}

.cloud-alpha-panel {
  margin-top: 28rpx;
  padding: 28rpx;
  border: 1rpx solid #dbe4ff;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.06);
}

.cloud-alpha-head,
.cloud-alpha-result-head,
.cloud-alpha-session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.cloud-alpha-title,
.cloud-alpha-desc,
.cloud-alpha-result-message,
.cloud-alpha-running,
.cloud-alpha-empty,
.cloud-alpha-session text,
.cloud-alpha-debug text {
  display: block;
}

.cloud-alpha-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 800;
}

.cloud-alpha-desc,
.cloud-alpha-session text,
.cloud-alpha-empty {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 21rpx;
}

.cloud-alpha-badge {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #fff7ed;
  color: #c2410c;
  font-size: 18rpx;
  font-weight: 800;
}

.cloud-alpha-context,
.cloud-alpha-actions,
.cloud-alpha-result-grid {
  display: grid;
  gap: 12rpx;
}

.cloud-alpha-context {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20rpx;
}

.cloud-alpha-context > view {
  min-width: 0;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f7f8fc;
}

.cloud-alpha-context text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-alpha-context text:first-child {
  color: #6b7280;
  font-size: 19rpx;
}

.cloud-alpha-context text:last-child {
  margin-top: 5rpx;
  color: #111827;
  font-size: 21rpx;
  font-weight: 700;
}

.cloud-alpha-session {
  margin-top: 18rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.cloud-alpha-identity-message {
  display: block;
  margin-top: 14rpx;
  color: #475569;
  font-size: 21rpx;
  line-height: 1.55;
}

.cloud-alpha-recovery {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx;
  margin-top: 14rpx;
}

.cloud-alpha-recovery input {
  min-width: 0;
  height: 72rpx;
  padding: 0 18rpx;
  border: 1rpx solid #dbe4ff;
  border-radius: 14rpx;
  background: #f8faff;
  color: #111827;
  font-size: 21rpx;
}

.cloud-alpha-recovery button {
  width: auto;
  min-width: 190rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 1rpx solid #c7d2fe;
  background: #eef2ff;
  color: #4338ca;
  font-size: 21rpx;
}

.cloud-alpha-session-button {
  flex-shrink: 0;
  width: auto;
  min-width: 230rpx;
  margin: 0;
  padding: 0 20rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 21rpx;
}

.cloud-alpha-session-button.primary {
  background: #4f46e5;
  color: #ffffff;
}

.cloud-alpha-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18rpx;
}

.cloud-alpha-actions button {
  width: 100%;
  margin: 0;
  padding: 0 12rpx;
  border: 1rpx solid #dbe4ff;
  background: #f8faff;
  color: #3730a3;
  font-size: 21rpx;
}

.cloud-alpha-actions button[disabled] {
  border-color: #e5e7eb;
  background: #f3f4f6;
  color: #9ca3af;
}

.cloud-alpha-running {
  margin-top: 16rpx;
  color: #4f46e5;
  font-size: 21rpx;
}

.cloud-alpha-results {
  display: grid;
  gap: 14rpx;
  margin-top: 18rpx;
}

.cloud-alpha-result {
  padding: 18rpx;
  border-left: 6rpx solid #ef4444;
  border-radius: 16rpx;
  background: #f8fafc;
}

.cloud-alpha-result.success {
  border-left-color: #10b981;
}

.cloud-alpha-result-head text:first-child {
  color: #111827;
  font-size: 22rpx;
  font-weight: 800;
}

.cloud-alpha-result-head text:last-child {
  color: #dc2626;
  font-size: 19rpx;
  font-weight: 800;
}

.cloud-alpha-result.success .cloud-alpha-result-head text:last-child {
  color: #059669;
}

.cloud-alpha-result-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12rpx;
  color: #4b5563;
  font-size: 19rpx;
}

.cloud-alpha-result-message {
  margin-top: 9rpx;
  color: #4b5563;
  font-size: 19rpx;
  word-break: break-all;
}

.cloud-alpha-debug {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: 12rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 18rpx;
}

.cloud-alpha-debug text:first-child {
  grid-column: 1 / -1;
  font-weight: 800;
}

.enterprise-role-manager {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  background: #f8fafc;
}

.enterprise-role-manager-head,
.enterprise-role-card,
.enterprise-role-editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.enterprise-role-manager-desc,
.enterprise-role-name,
.enterprise-role-meta,
.enterprise-role-editor-label {
  display: block;
}

.enterprise-role-manager-desc,
.enterprise-role-meta {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 19rpx;
}

.enterprise-role-reset {
  width: auto;
  min-width: 128rpx;
  margin: 0;
  padding: 0 18rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 20rpx;
}

.enterprise-role-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.enterprise-role-card {
  min-width: 0;
  padding: 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
}

.enterprise-role-card > view:first-child {
  min-width: 0;
  flex: 1;
}

.enterprise-role-name {
  overflow: hidden;
  color: #111827;
  font-size: 22rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-role-builtin,
.enterprise-role-actions text {
  flex-shrink: 0;
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 17rpx;
}

.enterprise-role-actions {
  display: flex;
  gap: 6rpx;
}

.enterprise-role-actions text {
  background: #eef2ff;
  color: #4338ca;
}

.enterprise-role-actions text.danger {
  background: #fef2f2;
  color: #dc2626;
}

.enterprise-role-editor {
  display: grid;
  gap: 12rpx;
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background: #ffffff;
}

.enterprise-role-editor input {
  min-height: 64rpx;
  padding: 0 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.enterprise-role-editor-label {
  color: #374151;
  font-size: 20rpx;
  font-weight: 800;
}

.enterprise-role-permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.enterprise-role-permission-list text {
  padding: 8rpx 12rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  background: #ffffff;
  color: #6b7280;
  font-size: 18rpx;
}

.enterprise-role-permission-list text.active {
  border-color: #6366f1;
  background: #eef2ff;
  color: #4338ca;
}

.enterprise-role-editor-actions {
  justify-content: flex-end;
}

.enterprise-role-editor-actions button {
  width: auto;
  min-width: 130rpx;
  margin: 0;
  font-size: 20rpx;
}

.enterprise-role-editor-actions button.primary {
  background: #4f46e5;
  color: #ffffff;
}

.platform-admin-page {
  min-height: 100vh;
  background: #f6f8fb;
  color: #111827;
}

.platform-admin-shell {
  display: grid;
  grid-template-columns: 220rpx minmax(0, 1fr);
  min-height: 100vh;
}

.platform-admin-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 28rpx 18rpx;
  border-right: 1rpx solid #e5e7eb;
  background: #ffffff;
  box-sizing: border-box;
}

.platform-admin-brand {
  display: grid;
  gap: 6rpx;
  margin-bottom: 22rpx;
  color: #111827;
  font-weight: 900;
}

.platform-admin-brand text:last-child {
  color: #6b7280;
  font-size: 20rpx;
  font-weight: 600;
}

.platform-admin-sidebar > text {
  display: block;
  margin-bottom: 8rpx;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  color: #4b5563;
  font-size: 22rpx;
}

.platform-admin-sidebar > text.active {
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 900;
}

.platform-admin-main {
  padding: 28rpx;
  box-sizing: border-box;
}

.platform-admin-header,
.platform-admin-panel {
  margin-bottom: 20rpx;
  padding: 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
}

.platform-admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.platform-admin-title {
  display: block;
  color: #111827;
  font-size: 34rpx;
  font-weight: 950;
}

.platform-admin-desc,
.platform-admin-muted {
  display: block;
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.6;
}

.platform-admin-filters {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.platform-admin-filters input,
.platform-admin-filters picker > view {
  min-width: 220rpx;
  min-height: 64rpx;
  padding: 0 18rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 12rpx;
  background: #fff;
  box-sizing: border-box;
  font-size: 22rpx;
  line-height: 64rpx;
}

.platform-admin-filters button {
  width: auto;
  min-width: 110rpx;
  margin: 0;
  border-radius: 12rpx;
  background: #4f46e5;
  color: #fff;
  font-size: 22rpx;
}

.platform-admin-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.platform-admin-card {
  display: grid;
  gap: 8rpx;
  padding: 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
}

.platform-admin-card text:first-child {
  color: #111827;
  font-size: 34rpx;
  font-weight: 950;
}

.platform-admin-card text:nth-child(2) {
  color: #374151;
  font-weight: 850;
}

.platform-admin-card text:last-child {
  color: #6b7280;
  font-size: 20rpx;
}

.platform-admin-panel-title {
  display: block;
  margin-bottom: 14rpx;
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.platform-admin-table {
  display: grid;
  gap: 8rpx;
  overflow-x: auto;
}

.platform-admin-row {
  min-width: 760rpx;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: #f9fafb;
  color: #374151;
  font-size: 21rpx;
}

.platform-admin-table.wide .platform-admin-row {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.platform-admin-row.head {
  background: #eef2ff;
  color: #3730a3;
  font-weight: 900;
}

.platform-admin-config-list {
  display: grid;
  gap: 12rpx;
  color: #374151;
  font-size: 22rpx;
}

.platform-admin-forbidden {
  display: grid;
  align-content: center;
  min-height: 100vh;
  max-width: 720rpx;
  margin: 0 auto;
  padding: 60rpx 28rpx;
  box-sizing: border-box;
}

.platform-admin-deny {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  background: #fef2f2;
  color: #b91c1c;
  font-weight: 900;
}

@media (max-width: 720px) {
  .cloud-alpha-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cloud-alpha-session {
    align-items: flex-start;
    flex-direction: column;
  }

  .enterprise-role-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .enterprise-data-center-columns {
    grid-template-columns: 1fr;
  }

  .enterprise-data-center-grid.overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .platform-admin-shell {
    grid-template-columns: 1fr;
  }

  .platform-admin-sidebar {
    position: static;
    height: auto;
    display: flex;
    overflow-x: auto;
  }

  .platform-admin-brand {
    min-width: 180rpx;
  }

  .platform-admin-sidebar > text {
    white-space: nowrap;
  }

  .platform-admin-header,
  .platform-admin-filters {
    align-items: stretch;
    flex-direction: column;
  }

  .platform-admin-grid {
    grid-template-columns: 1fr;
  }
}
</style>
