<template>
  <view class="container">
    <view v-if="isLoadingProject && !project" class="loading-state">
      <text>加载项目数据中...</text>
    </view>

    <view v-if="project && customerView" class="customer-portal">
      <view v-if="customerPortalHasCustomer">
        <view class="customer-portal-hero">
          <text class="customer-portal-kicker">客户项目门户</text>
          <text class="customer-portal-title">{{ customerPortalSummary.projectName }}</text>
          <text class="customer-portal-subtitle">查看项目成果、交付进度并提交反馈</text>
          <view class="customer-portal-metrics">
            <view><text>{{ customerPortalSummary.progress }}%</text><text>项目进度</text></view>
            <view><text>{{ customerPortalSummary.productCount }}</text><text>商品数量</text></view>
            <view><text>{{ customerPortalSummary.deliveryStatus }}</text><text>交付状态</text></view>
          </view>
        </view>

        <view class="customer-portal-section">
          <view class="customer-portal-section-head">
            <text>商品资料</text>
            <text>{{ customerPortalProducts.length }} 个资料包</text>
          </view>
          <view v-if="customerPortalProducts.length" class="customer-product-list">
            <view v-for="product in customerPortalProducts" :key="product.productPackageId" class="customer-product-card">
              <text class="customer-product-title">{{ product.productName }}</text>
              <view v-if="product.assets.length" class="customer-asset-grid">
                <view v-for="asset in product.assets" :key="asset.assetId" class="customer-asset-item">
                  <image v-if="asset.url" :src="asset.url" mode="aspectFill" />
                  <view v-else class="customer-asset-placeholder">暂无预览</view>
                  <text>{{ asset.label }}</text>
                </view>
              </view>
              <view v-else class="customer-product-empty">资料正在整理中</view>
              <view class="customer-product-types">
                <text>AI模特图</text><text>平铺细节图</text><text>详情页素材</text>
                <text>海报</text><text>系列图</text>
              </view>
            </view>
          </view>
          <text v-else class="customer-portal-empty">商品资料正在准备中</text>
        </view>

        <view class="customer-portal-section">
          <view class="customer-portal-section-head">
            <text>交付确认</text>
            <text>{{ customerPortalSummary.deliveryStatus }}</text>
          </view>
          <view class="customer-feedback-types">
            <text :class="{ active: customerFeedbackType === '满意' }" @click="setCustomerFeedbackType('满意')">满意</text>
            <text :class="{ active: customerFeedbackType === '修改建议' }" @click="setCustomerFeedbackType('修改建议')">修改建议</text>
          </view>
          <textarea
            v-model.trim="customerFeedbackContent"
            maxlength="300"
            :placeholder="customerFeedbackType === '满意' ? '可填写本次交付评价（选填）' : '请说明需要修改的内容'"
          />
          <view class="customer-feedback-actions">
            <button class="secondary" @click="submitCustomerPortalFeedback('修改建议')">需要修改</button>
            <button @click="submitCustomerPortalFeedback('满意')">确认交付</button>
          </view>
        </view>

        <view class="customer-portal-section">
          <text class="customer-portal-section-title">反馈记录</text>
          <view v-if="customerProjectFeedbacks.length" class="customer-feedback-history">
            <view v-for="feedback in customerProjectFeedbacks" :key="feedback.feedbackId">
              <view><text>{{ feedback.customer }}</text><text>{{ feedback.type }}</text></view>
              <text>{{ feedback.content }}</text>
              <text>{{ formatEnterpriseOperationTime(feedback.time) }}</text>
            </view>
          </view>
          <text v-else class="customer-portal-empty">暂无反馈记录</text>
        </view>
      </view>
      <view v-else class="customer-portal-unavailable">
        <text>暂无客户门户</text>
        <text>当前项目尚未绑定客户信息。</text>
      </view>
    </view>

    <view v-if="project && !customerView" class="content">
      <view class="section-card">
        <text class="section-title">项目概览</text>
        <text class="source-badge">
          {{ projectDataSource === 'cloud' ? '☁ 云端数据' : '⬡ 本地缓存' }}
        </text>
        <text v-if="entryContextHint" class="entry-context-hint">{{ entryContextHint }}</text>
        <text class="info-line">项目编号：{{ projectOverview.projectId || '暂无' }}</text>
        <text class="info-line">项目名称：{{ projectOverview.projectName || '暂无' }}</text>
        <text class="info-line">线索编号：{{ projectOverview.leadId || '暂无' }}</text>
        <text class="info-line">项目类型：{{ projectOverview.projectType || '暂无' }}</text>
        <text class="info-line">状态：{{ getProjectStatusLabel(projectOverview.status) }}</text>
        <text class="info-line">阶段：{{ getProjectStageLabel(projectOverview.stage) }}</text>
        <text class="info-line">服务范围：{{ formatScope(projectOverview.serviceScope) }}</text>
        <text class="info-line">创建时间：{{ projectOverview.createdAt || '暂无' }}</text>
        <text class="info-line">更新时间：{{ projectOverview.updatedAt || '暂无' }}</text>
        <text class="info-line">开始时间：{{ projectOverview.startedAt || '暂无' }}</text>
        <text class="info-line">完成时间：{{ projectOverview.completedAt || '暂无' }}</text>

        <view v-if="canRbacEdit('project.edit')" class="project-basic-edit-row">
          <input
            v-model.trim="projectNameInput"
            class="project-name-input"
            placeholder="更新项目名称"
          />
          <button class="create-task-btn project-basic-save-btn" @click="saveProjectName">
            保存项目名称
          </button>
        </view>
      </view>

      <view class="section-card project-team-card">
        <view class="project-team-head">
          <view>
            <text class="section-title">企业团队协作</text>
            <text class="info-desc">{{ enterpriseName }} · {{ enterpriseCurrentMember.name }} · {{ enterpriseCurrentMember.role }}</text>
          </view>
          <picker :range="enterpriseMemberLabels" :value="enterpriseCurrentMemberIndex" @change="changeProjectEnterpriseMember">
            <view class="enterprise-picker-value project-team-picker">切换成员 ▾</view>
          </picker>
        </view>
        <view class="project-enterprise-plan">
          <view><text>{{ enterpriseCurrentPlan.name }}</text><text>当前套餐</text></view>
          <view><text>{{ enterpriseMembers.length }}/{{ enterpriseCurrentPlan.memberLimit }}</text><text>成员</text></view>
          <view><text>{{ enterpriseCurrentPlan.aiQuota }}</text><text>AI额度</text></view>
          <view><text>{{ enterpriseCurrentPlan.storageSpace }}</text><text>存储</text></view>
        </view>
        <view class="project-enterprise-usage">
          <text class="link-title">当前项目用量</text>
          <view>
            <text>生成 {{ enterpriseUsageSummary.generationCount }}</text>
            <text>图片 {{ enterpriseUsageSummary.imageCount }}</text>
            <text>商品 {{ enterpriseUsageSummary.productCount }}</text>
            <text>项目 {{ enterpriseUsageSummary.projectCount }}</text>
          </view>
        </view>
        <view class="project-team-members">
          <view v-for="member in enterpriseMembers" :key="member.memberId" :class="{ active: member.memberId === enterpriseCurrentMember.memberId }">
            <text>{{ member.name }}</text>
            <text>{{ member.role }}</text>
          </view>
        </view>
        <view class="project-team-permissions">
          <text v-for="permission in enterpriseCurrentPermissions" :key="permission">{{ getEnterprisePermissionLabel(permission) }}</text>
        </view>
        <view class="project-team-logs">
          <text class="link-title">项目操作日志</text>
          <view v-if="projectEnterpriseOperationLogs.length">
            <view v-for="log in projectEnterpriseOperationLogs" :key="log.logId">
              <text>{{ log.operator }}</text>
              <text>{{ formatEnterpriseOperationTime(log.time) }}</text>
              <text>{{ log.action }} · {{ log.target }}</text>
            </view>
          </view>
          <text v-else class="info-desc">暂无记录</text>
        </view>
        <view class="project-customer-message-panel">
          <text class="link-title">客户消息</text>
          <view v-if="customerProjectMessages.length">
            <view v-for="message in customerProjectMessages" :key="message.messageId" class="project-customer-message-row">
              <view><text>{{ message.author }}</text><text>{{ message.status }}</text></view>
              <text>{{ message.content }}</text>
              <text>{{ formatEnterpriseOperationTime(message.time) }}</text>
              <view v-if="canRbacOperate('customer.manage')" class="project-customer-message-actions">
                <text v-if="message.status === '待处理'" @click="changeCustomerMessageStatus(message, '处理中')">开始处理</text>
                <text v-if="message.status !== '已完成'" @click="changeCustomerMessageStatus(message, '已完成')">完成</text>
              </view>
            </view>
          </view>
          <text v-else class="info-desc">暂无客户消息</text>
        </view>
      </view>

      <view v-if="canRbacView('design.view') || canRbacView('project.view') || canRbacView('delivery.view')" class="section-card project-approval-card">
        <view class="project-team-head">
          <view>
            <text class="section-title">企业协作审批</text>
            <text class="info-desc">{{ projectEnterpriseApprovalTaskSummary.label }}：{{ projectEnterpriseApprovalTaskSummary.value }}</text>
          </view>
          <text class="project-approval-count">{{ projectEnterpriseApprovalItems.length }} 项</text>
        </view>
        <textarea v-if="canRbacOperate('project.approve') || canRbacEdit('design.edit') || canRbacOperate('product.publish')" v-model.trim="enterpriseApprovalComment" maxlength="120" placeholder="填写审批意见（可选）" />
        <view v-if="projectEnterpriseApprovalItems.length" class="project-approval-list">
          <view v-for="item in projectEnterpriseApprovalItems" :key="`${item.targetType}_${item.targetId}`" class="project-approval-item">
            <view>
              <text>{{ getEnterpriseApprovalTypeLabel(item.targetType) }} · {{ item.targetName }}</text>
              <text>{{ getEnterpriseApprovalStatusLabel(item.status) }}</text>
            </view>
            <view class="project-approval-actions">
              <text v-if="canSubmitEnterpriseApproval(item)" @click="submitEnterpriseApproval(item)">提交</text>
              <text v-if="canReviewEnterpriseApproval(item)" @click="reviewEnterpriseApproval(item, true)">通过</text>
              <text v-if="canReviewEnterpriseApproval(item)" class="danger" @click="reviewEnterpriseApproval(item, false)">驳回</text>
              <text v-if="canPublishEnterpriseProduct(item)" @click="publishEnterpriseProduct(item)">发布</text>
            </view>
          </view>
        </view>
        <text v-else class="info-desc">暂无审批事项</text>
        <view class="project-approval-timeline">
          <text class="link-title">审批时间线</text>
          <view v-if="projectEnterpriseApprovalLogs.length">
            <view v-for="log in projectEnterpriseApprovalLogs" :key="log.approvalLogId">
              <text>{{ log.operator }} · {{ log.role }}</text>
              <text>{{ formatEnterpriseOperationTime(log.time) }}</text>
              <text>{{ log.action }} · {{ log.target }}</text>
              <text v-if="log.comment">意见：{{ log.comment }}</text>
            </view>
          </view>
          <text v-else class="info-desc">暂无审批记录</text>
        </view>
      </view>

      <view v-if="canRbacView('finance.view') || canRbacView('quote.view')" class="section-card project-commerce-card">
        <view class="project-team-head">
          <view>
            <text class="section-title">报价、订单与交付</text>
            <text class="info-desc">客户 → 项目 → 报价 → 订单 → 交付</text>
          </view>
          <text class="project-approval-count">订单 {{ projectEnterpriseOrders.length }}</text>
        </view>
        <view class="project-commerce-stats">
          <view><text>{{ projectEnterpriseCommerceStats.orderCount }}</text><text>订单数量</text></view>
          <view><text>{{ formatEnterpriseMoney(projectEnterpriseCommerceStats.dealAmount) }}</text><text>成交金额</text></view>
          <view><text>{{ formatEnterpriseMoney(projectEnterpriseCommerceStats.pendingAmount) }}</text><text>待收金额</text></view>
          <view><text>{{ projectEnterpriseCommerceStats.completedCount }}</text><text>完成订单</text></view>
        </view>
        <view v-if="canRbacOperate('quote.manage')" class="project-quote-form">
          <view class="project-quote-items">
            <text
              v-for="item in enterpriseQuoteItemOptions"
              :key="item"
              :class="{ active: enterpriseQuoteForm.items.includes(item) }"
              @click="toggleEnterpriseQuoteItem(item)"
            >{{ item }}</text>
          </view>
          <input v-model="enterpriseQuoteForm.amount" type="digit" placeholder="报价金额" />
          <button @click="createProjectEnterpriseQuote">创建报价单</button>
        </view>
        <view class="project-commerce-columns">
          <view>
            <text class="link-title">报价</text>
            <view v-if="projectEnterpriseQuotes.length" class="project-commerce-list">
              <view v-for="quote in projectEnterpriseQuotes" :key="quote.quoteId">
                <text>{{ quote.customer }} · {{ formatEnterpriseMoney(quote.amount) }}</text>
                <text>{{ quote.items.join('、') }} · {{ getEnterpriseQuoteStatusLabel(quote.status) }}</text>
                <view v-if="canRbacOperate('quote.manage')">
                  <text v-if="quote.status === 'draft'" @click="changeEnterpriseQuoteStatus(quote, 'sent')">发送</text>
                  <text v-if="quote.status === 'sent'" @click="changeEnterpriseQuoteStatus(quote, 'confirmed')">确认</text>
                  <text v-if="quote.status === 'sent'" class="danger" @click="changeEnterpriseQuoteStatus(quote, 'rejected')">拒绝</text>
                  <text v-if="quote.status === 'confirmed'" @click="createEnterpriseOrder(quote)">生成订单</text>
                </view>
              </view>
            </view>
            <text v-else class="info-desc">暂无报价</text>
          </view>
          <view>
            <text class="link-title">订单与交付</text>
            <view v-if="projectEnterpriseOrders.length" class="project-commerce-list">
              <view v-for="order in projectEnterpriseOrders" :key="order.orderId">
                <text>{{ order.customer }} · {{ formatEnterpriseMoney(order.amount) }}</text>
                <text>{{ getEnterpriseOrderStatusLabel(order.status) }} · 交付 {{ customerPortalDeliveries.length }} 项</text>
                <view v-if="canRbacOperate('finance.manage')">
                  <text v-if="order.status === 'pending_payment'" @click="changeEnterpriseOrderStatus(order, 'processing')">标记处理中</text>
                  <text v-if="order.status === 'processing'" @click="changeEnterpriseOrderStatus(order, 'completed')">完成</text>
                  <text v-if="!['completed', 'closed'].includes(order.status)" class="danger" @click="changeEnterpriseOrderStatus(order, 'closed')">关闭</text>
                </view>
              </view>
            </view>
            <text v-else class="info-desc">暂无订单</text>
          </view>
        </view>
      </view>

      <view v-if="canEnterpriseCollaborate('customer') || canEnterpriseCollaborate('project')" class="section-card enterprise-closure-card">
        <view class="enterprise-closure-head">
          <view>
            <text class="section-title">客户与项目驾驶舱</text>
            <text class="info-desc">销售线索 → 客户 → 项目 → 商品 → 生产 → 交付</text>
          </view>
          <view v-if="canEnterpriseCollaborate('follow') || canEnterpriseCollaborate('project')" class="enterprise-stage-control">
            <picker :range="enterpriseLeadStatusOptions" :value="enterpriseLeadStatusIndex" @change="changeEnterpriseLeadStatus">
              <text class="enterprise-lead-status">{{ enterpriseLeadStatus }} ▾</text>
            </picker>
            <text>更新于 {{ enterpriseLeadStatusUpdatedAt }}</text>
          </view>
        </view>

        <view class="enterprise-customer-grid">
          <view>
            <text>客户名称</text>
            <text>{{ projectCustomerSummary.customerName }}</text>
          </view>
          <view>
            <text>联系人</text>
            <text>{{ projectCustomerSummary.contactName }}</text>
          </view>
          <view>
            <text>企业类型</text>
            <text>{{ projectCustomerSummary.enterpriseType }}</text>
          </view>
          <view>
            <text>行业分类</text>
            <text>{{ projectCustomerSummary.industry }}</text>
          </view>
          <view>
            <text>联系方式</text>
            <text>{{ projectCustomerSummary.contact }}</text>
          </view>
        </view>

        <view class="enterprise-value-panel">
          <view>
            <text>合作类型</text>
            <text>{{ projectValueSummary.cooperationType }}</text>
          </view>
          <view>
            <text>预计产出</text>
            <text>{{ projectValueSummary.expectedOutput }}</text>
          </view>
          <view class="wide">
            <text>项目目标</text>
            <text>{{ projectValueSummary.projectGoal }}</text>
          </view>
        </view>

        <view v-if="canRbacEdit('project.edit')" class="enterprise-value-editor">
          <input v-model.trim="enterpriseProjectForm.projectGoal" placeholder="项目目标，如完成秋季新品上新" />
          <picker :range="enterpriseCooperationTypes" :value="enterpriseCooperationTypeIndex" @change="changeEnterpriseCooperationType">
            <view class="enterprise-picker-value">合作类型：{{ enterpriseProjectForm.cooperationType || '未设置' }} ▾</view>
          </picker>
          <view class="enterprise-value-inputs">
            <input v-model.trim="enterpriseProjectForm.monthlyStyleCount" type="number" placeholder="月产款数" />
            <input v-model.trim="enterpriseProjectForm.expectedImageCount" type="number" placeholder="预计图片数量" />
            <input v-model.trim="enterpriseProjectForm.deliveryCycle" placeholder="交付周期" />
          </view>
          <button class="enterprise-save-btn" @click="saveEnterpriseProjectValue">保存项目价值</button>
        </view>

        <view class="enterprise-event-timeline">
          <view
            v-for="event in projectLifecycleEvents"
            :key="event.key"
            class="enterprise-event-item"
            :class="{ completed: event.completed }"
          >
            <text class="timeline-dot"></text>
            <text class="enterprise-event-time">{{ event.time }}</text>
            <view>
              <text>{{ event.title }}</text>
              <text>{{ event.description }}</text>
            </view>
          </view>
        </view>

        <view class="enterprise-follow-list">
          <text class="link-title">销售跟进记录</text>
          <view v-if="projectSalesFollowRecords.length">
            <view v-for="record in projectSalesFollowRecords" :key="record.id" class="enterprise-follow-item">
              <text>{{ record.time }}</text>
              <view>
                <text>{{ record.content }}</text>
                <text>下一步：{{ record.nextAction }}</text>
              </view>
            </view>
          </view>
          <text v-else class="info-desc">暂无销售跟进或客户反馈记录。</text>
          <view v-if="canRbacOperate('customer.manage')" class="enterprise-follow-editor">
            <picker :range="enterpriseFollowTypes" :value="enterpriseFollowTypeIndex" @change="changeEnterpriseFollowType">
              <view class="enterprise-picker-value">跟进类型：{{ enterpriseFollowForm.followType }} ▾</view>
            </picker>
            <textarea v-model.trim="enterpriseFollowForm.followUpContent" maxlength="240" placeholder="记录本次沟通、客户需求或反馈" />
            <input v-model.trim="enterpriseFollowForm.nextAction" maxlength="80" placeholder="下一步动作" />
            <button class="enterprise-save-btn" @click="addEnterpriseFollowUp">新增跟进记录</button>
          </view>
        </view>
      </view>

      <view v-if="lead && canEnterpriseCollaborate('customer')" class="section-card">
        <text class="section-title">关联线索</text>
        <text class="info-line">线索数据来源：{{ leadDataSourceLabel }}</text>
        <text class="info-line">公司/店铺：{{ lead.companyName || '暂无' }}</text>
        <text class="info-line">品牌：{{ lead.brandName || '暂无' }}</text>
        <text class="info-line">联系人：{{ lead.contactName || '暂无' }}</text>
        <text class="info-line">手机号：{{ lead.mobile || lead.phone || '暂无' }}</text>
        <text class="info-line">微信：{{ lead.wechat || '暂无' }}</text>
        <text class="info-line">来源：{{ lead.source || '暂无' }}</text>
        <text class="info-line">需求类型：{{ lead.demandType || '暂无' }}</text>
        <text class="info-line">跟进状态：{{ getLeadFollowStatusLabel(lead.followStatus) }}</text>
        <text class="info-line">预算范围：{{ lead.budgetRange || '暂无' }}</text>
        <text class="info-line">期望交付：{{ lead.expectedDeliveryDate || lead.expectedDeliveryTime || '暂无' }}</text>
        <text class="info-line">附件：{{ formatAttachmentFileIds(lead.attachmentFileIds) }}</text>
        <text class="info-line">品类：{{ lead.productCategory || '暂无' }}</text>
        <text class="info-desc">需求说明：{{ lead.requirementText || lead.description || '暂无需求说明' }}</text>
      </view>

      <view class="section-card">
        <text class="section-title">项目关联</text>
        <text class="info-line">任务数量：{{ taskCount }}</text>
        <text class="info-line">批次数量：{{ batchCount }}</text>

        <view class="link-block">
          <text class="link-title">最新任务</text>
          <text v-if="latestTask" class="info-line">任务编号：{{ latestTask.taskId || '暂无' }}</text>
          <text v-if="latestTask" class="info-line">状态：{{ latestTask.status || '暂无' }}</text>
          <text v-if="latestTask" class="info-line">时间：{{ latestTaskTime }}</text>
          <button
            v-if="latestTask"
            class="create-task-btn quick-link-btn"
            @click="goToTaskDetail(latestTask)"
          >
            查看最新任务
          </button>
          <text v-else class="info-desc">暂无关联任务。</text>
        </view>

        <view class="link-block">
          <text class="link-title">最新批次</text>
          <text v-if="latestBatch" class="info-line">批次编号：{{ latestBatch.batchId || '暂无' }}</text>
          <text v-if="latestBatch" class="info-line">状态：{{ latestBatch.status || '暂无' }}</text>
          <text v-if="latestBatch" class="info-line">时间：{{ latestBatch.updatedAt || latestBatch.createdAt || '暂无' }}</text>
          <button
            v-if="latestBatch"
            class="create-task-btn quick-link-btn"
            @click="goToBatchDetail(latestBatch)"
          >
            查看最新批次
          </button>
          <text v-else class="info-desc">暂无关联批次。</text>
        </view>
      </view>

      <view class="section-card">
        <text class="section-title">执行摘要</text>
        <view class="summary-grid">
          <view class="summary-item">
            <text class="summary-label">任务总数</text>
            <text class="summary-value">{{ taskCount }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">成功</text>
            <text class="summary-value success">{{ successTaskCount }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">处理中</text>
            <text class="summary-value processing">{{ processingTaskCount }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">失败</text>
            <text class="summary-value failed">{{ failedTaskCount }}</text>
          </view>
        </view>
        <text class="info-line">项目汇总状态：{{ projectExecutionStatus }}</text>
        <text class="info-line">最新任务时间：{{ latestTaskTime }}</text>
        <text class="info-line">是否可交付：{{ hasDeliverableResult ? '是' : '否' }}</text>
      </view>

      <view v-if="canRbacView('delivery.view')" id="section-delivery-ops" class="section-card">
        <text class="section-title">交付运营摘要</text>
        <text v-if="deliveryOpsContextHint" class="entry-context-hint">{{ deliveryOpsContextHint }}</text>
        <text class="info-line">可交付批次数：{{ deliverableBatchCount }}</text>
        <text class="info-line">待审核批次数：{{ pendingReviewBatchCount }}</text>
        <text class="info-line">需修订批次数：{{ needsRevisionBatchCount }}</text>
        <text class="info-line">下一步：{{ deliveryOpsNextStep }}</text>
        <text class="info-desc">{{ deliveryOpsNextStepDetail }}</text>

        <view class="quick-actions-block">
          <text class="group-title">项目批次优先级建议</text>
          <text class="info-line">优先批次分组：{{ priorityBatchGroupLabel }}</text>
          <text class="info-line">优先批次原因：{{ priorityBatchReason }}</text>
          <text class="info-line">优先批次动作：{{ priorityBatchActionLabel }}</text>
          <view class="quick-actions-row">
            <button
              class="create-task-btn quick-action-btn"
              :class="{ warning: priorityBatchGroup === 'needs_revision', success: priorityBatchGroup === 'deliverable' }"
              :disabled="!priorityBatchActionEnabled"
              @click="triggerPriorityBatchAction"
            >
              {{ priorityBatchActionLabel }}
            </button>
          </view>
          <view v-if="priorityRecommendedBatch" class="link-block">
            <text class="link-title">推荐批次快照</text>
            <text class="info-line">批次编号：{{ priorityRecommendedBatch.batchId || '暂无' }}</text>
            <text class="info-line">状态：{{ priorityRecommendedBatch.status || '暂无' }}</text>
            <text class="info-line">待审核数量：{{ priorityRecommendedBatchCounts.pendingReviewCount }}</text>
            <text class="info-line">需修订数量：{{ priorityRecommendedBatchCounts.needsRevisionCount }}</text>
            <text class="info-line">结果就绪数量：{{ priorityRecommendedBatchCounts.readyCount }}</text>
            <text class="info-line">时间：{{ priorityRecommendedBatchTime }}</text>
            <button
              class="create-task-btn quick-link-btn"
              @click="openPriorityBatchSnapshot"
            >
              打开推荐批次
            </button>
          </view>
        </view>

        <view class="quick-actions-block">
          <text class="group-title">项目审核操作</text>
          <view class="quick-actions-row">
            <button
              class="create-task-btn quick-action-btn"
              :disabled="!topPendingReviewBatch"
              @click="goToBatchDetailWithContext(topPendingReviewBatch, 'delivery-review', 'pending_review')"
            >
              审核最高优先级待审核批次
            </button>
            <button
              class="create-task-btn quick-action-btn warning"
              :disabled="!topNeedsRevisionBatch"
              @click="goToBatchDetailWithContext(topNeedsRevisionBatch, 'delivery-review', 'needs_revision')"
            >
              修订最高优先级需修订批次
            </button>
            <button
              class="create-task-btn quick-action-btn success"
              :disabled="!topDeliverableBatch"
              @click="goToBatchDetailWithContext(topDeliverableBatch, 'delivery-view', '')"
            >
              交付最高优先级可交付批次
            </button>
          </view>
        </view>

        <view class="quick-actions-block">
          <text class="group-title">项目下一步操作</text>
          <view class="quick-actions-row">
            <button
              class="create-task-btn quick-action-btn"
              :disabled="!nextPendingReviewBatch"
              @click="goToBatchDetailWithContext(nextPendingReviewBatch, 'delivery-review', 'pending_review')"
            >
              下一个待审核批次
            </button>
            <button
              class="create-task-btn quick-action-btn warning"
              :disabled="!nextNeedsRevisionBatch"
              @click="goToBatchDetailWithContext(nextNeedsRevisionBatch, 'delivery-review', 'needs_revision')"
            >
              下一个需修订批次
            </button>
            <button
              class="create-task-btn quick-action-btn success"
              :disabled="!nextDeliverableBatch"
              @click="goToBatchDetailWithContext(nextDeliverableBatch, 'delivery-view', '')"
            >
              下一个可交付批次
            </button>
          </view>
        </view>

        <view class="quick-actions-block">
          <text class="group-title">项目批次操作</text>
          <text class="info-line">聚焦分组：{{ deliveryContextFocusLabel }}</text>
          <text class="info-line">推荐批次：{{ focusedTopBatch ? (focusedTopBatch.batchId || '暂无') : '暂无' }}</text>
          <view class="quick-actions-row">
            <button
              class="create-task-btn quick-action-btn"
              :disabled="!sortedPendingReviewBatches.length"
              @click="focusBatchGroup('pending_review')"
            >
              打开全部待审核批次
            </button>
            <button
              class="create-task-btn quick-action-btn warning"
              :disabled="!sortedNeedsRevisionBatches.length"
              @click="focusBatchGroup('needs_revision')"
            >
              打开全部需修订批次
            </button>
            <button
              class="create-task-btn quick-action-btn success"
              :disabled="!sortedDeliverableBatches.length"
              @click="focusBatchGroup('deliverable')"
            >
              打开全部可交付批次
            </button>
          </view>
        </view>

        <view class="quick-actions-block">
          <text class="group-title">项目批次审核操作</text>
          <view class="quick-actions-row">
            <button
              id="e2e-approve-deliverable-batches-in-project-btn"
              class="create-task-btn quick-action-btn success"
              :disabled="isProjectBatchReviewing || !sortedDeliverableBatches.length"
              @click="approveDeliverableBatchesInProject"
            >
              确认项目内可交付批次
            </button>
            <button
              id="e2e-mark-pending-review-batches-as-needs-revision-in-project-btn"
              class="create-task-btn quick-action-btn warning"
              :disabled="isProjectBatchReviewing || !sortedPendingReviewBatches.length"
              @click="markPendingReviewBatchesAsNeedsRevisionInProject"
            >
              将待审核批次标记为需修订
            </button>
          </view>
          <text v-if="isProjectBatchReviewing" class="info-line">项目批次审核操作执行中...</text>
          <view
            v-if="hasProjectBatchReviewSummary"
            id="e2e-project-batch-review-summary"
            class="link-block review-summary-block"
            :class="{
              'review-summary-success': projectBatchReviewActionTone === 'success',
              'review-summary-warning': projectBatchReviewActionTone === 'warning'
            }"
          >
            <text class="link-title">项目批次审核摘要</text>
            <text class="info-line review-summary-last-action">最近操作：{{ projectBatchReviewActionLabel }}</text>
            <text class="info-line">操作来源：<text class="review-summary-source-badge">{{ projectBatchReviewActionSourceLabel }}</text></text>
            <text class="info-line">操作类型：{{ projectBatchReviewActionTypeLabel }}</text>
            <text class="info-line">触发位置：{{ projectBatchReviewTriggeredFrom }}</text>
            <button
              class="create-task-btn quick-link-btn"
              :disabled="!latestProjectReviewActionTarget"
              @click="openLatestProjectReviewAction"
            >
              打开关联批次
            </button>
            <view class="summary-grid review-summary-grid">
              <view class="summary-item review-summary-item">
                <text class="summary-label">已处理数量</text>
                <text class="summary-value review-summary-value">{{ projectBatchReviewSummary.processedBatchCount }}</text>
              </view>
              <view class="summary-item review-summary-item">
                <text class="summary-label">成功数量</text>
                <text class="summary-value success review-summary-value">{{ projectBatchReviewSummary.successBatchCount }}</text>
              </view>
              <view class="summary-item review-summary-item">
                <text class="summary-label">跳过数量</text>
                <text class="summary-value review-summary-value skipped">{{ projectBatchReviewSummary.skippedBatchCount }}</text>
              </view>
              <view class="summary-item review-summary-item">
                <text class="summary-label">失败数量</text>
                <text class="summary-value failed review-summary-value">{{ projectBatchReviewSummary.failedBatchCount }}</text>
              </view>
              <view class="summary-item review-summary-item">
                <text class="summary-label">同步失败任务数</text>
                <text class="summary-value failed review-summary-value">{{ projectBatchReviewSummary.syncFailedTaskCount }}</text>
              </view>
            </view>
            <text class="info-line review-summary-time">最近操作时间：{{ projectBatchReviewSummary.updatedAt || '暂无' }}</text>
          </view>
          <view v-else class="link-block review-summary-empty">
            <text class="link-title">项目批次审核摘要</text>
            <text class="info-desc">暂无项目级批次审核操作。</text>
          </view>
          <view id="e2e-recent-project-review-actions" class="link-block review-history-block">
            <text class="link-title">最近项目审核操作</text>
            <view v-if="recentProjectReviewActions.length" class="review-history-list">
              <view
                v-for="(item, index) in recentProjectReviewActions"
                :key="`${item.actionType}-${item.createdAt || item.time}-${index}`"
                class="review-history-item"
              >
                <text class="info-line">操作类型：{{ item.actionType }}</text>
                <text class="info-line">操作来源：<text class="review-summary-source-badge">{{ item.actionSource }}</text></text>
                <text class="info-line">触发位置：{{ item.triggeredFrom }}</text>
                <text class="info-line">时间：{{ item.createdAt || item.time || '暂无' }}</text>
                <button
                  class="create-task-btn quick-link-btn"
                  :disabled="!item.resolvedTarget || !item.resolvedTarget.batch || !item.resolvedTarget.batch.batchId"
                  @click="openProjectReviewAction(item)"
                >
                  打开关联批次
                </button>
              </view>
            </view>
            <text v-else class="info-desc">暂无最近项目审核操作。</text>
          </view>
        </view>

        <view id="section-deliverable-batch" class="link-block">
          <text class="link-title">最近可交付批次</text>
          <text v-if="latestDeliverableBatch" class="info-line">批次 ID：{{ latestDeliverableBatch.batchId || '暂无' }}</text>
          <text v-if="latestDeliverableBatch" class="info-line">状态：{{ latestDeliverableBatch.status || '暂无' }}</text>
          <text v-if="latestDeliverableBatch" class="info-line">时间：{{ latestDeliverableBatch.updatedAt || latestDeliverableBatch.createdAt || '暂无' }}</text>
          <button
            v-if="latestDeliverableBatch"
            class="create-task-btn quick-link-btn"
            @click="goToBatchDetailWithContext(latestDeliverableBatch, 'delivery-view', '')"
          >
            打开可交付批次
          </button>
          <text v-else class="info-desc">暂无可交付批次。</text>
        </view>

        <view id="section-pending-review-batch" class="link-block">
          <text class="link-title">最近待审核批次</text>
          <text v-if="latestPendingReviewBatch" class="info-line">批次 ID：{{ latestPendingReviewBatch.batchId || '暂无' }}</text>
          <text v-if="latestPendingReviewBatch" class="info-line">状态：{{ latestPendingReviewBatch.status || '暂无' }}</text>
          <text v-if="latestPendingReviewBatch" class="info-line">时间：{{ latestPendingReviewBatch.updatedAt || latestPendingReviewBatch.createdAt || '暂无' }}</text>
          <button
            v-if="latestPendingReviewBatch"
            class="create-task-btn quick-link-btn"
            @click="goToBatchDetailWithContext(latestPendingReviewBatch, 'delivery-review', 'pending_review')"
          >
            审核待审核批次
          </button>
          <text v-else class="info-desc">暂无待审核批次。</text>
        </view>

        <view id="section-needs-revision-batch" class="link-block">
          <text class="link-title">最近需修订批次</text>
          <text v-if="latestNeedsRevisionBatch" class="info-line">批次 ID：{{ latestNeedsRevisionBatch.batchId || '暂无' }}</text>
          <text v-if="latestNeedsRevisionBatch" class="info-line">状态：{{ latestNeedsRevisionBatch.status || '暂无' }}</text>
          <text v-if="latestNeedsRevisionBatch" class="info-line">时间：{{ latestNeedsRevisionBatch.updatedAt || latestNeedsRevisionBatch.createdAt || '暂无' }}</text>
          <button
            v-if="latestNeedsRevisionBatch"
            class="create-task-btn quick-link-btn"
            @click="goToBatchDetailWithContext(latestNeedsRevisionBatch, 'delivery-review', 'needs_revision')"
          >
            处理需修订批次
          </button>
          <text v-else class="info-desc">暂无需修订批次。</text>
        </view>

        <view id="section-delivery-groups" class="delivery-batch-groups">
          <text class="group-title">面向交付的批次分组</text>
          <text v-if="hasDeliveryEntryContext" class="info-desc">
            Context focus: {{ deliveryContextFocusLabel }} (non-focus groups are shown in compact mode)
          </text>

          <view
            v-for="group in deliveryBatchGroups"
            :key="group.key"
            class="group-card"
            :class="{ focused: isFocusedDeliveryGroup(group.key), muted: hasDeliveryEntryContext && !isFocusedDeliveryGroup(group.key) }"
          >
            <view class="group-head">
              <text class="group-name">{{ group.title }}</text>
              <text class="group-count">数量：{{ group.batches.length }}</text>
            </view>

            <view v-if="getVisibleGroupBatches(group).length" class="group-list">
              <view
                v-for="batch in getVisibleGroupBatches(group)"
                :key="`${group.key}-${batch.batchId}`"
                class="group-item"
                :class="{ recommended: isRecommendedBatch(group.key, batch) }"
                @click="goToBatchDetailWithContext(batch, group.mode, group.reviewContext)"
              >
                <text class="group-item-line">批次 ID：{{ batch.batchId || '暂无' }}</text>
                <text class="group-item-line">状态：{{ batch.status || '暂无' }}</text>
                <text class="group-item-line">时间：{{ batch.updatedAt || batch.createdAt || '暂无' }}</text>
              </view>
            </view>

            <text v-else class="info-desc">该分组暂无批次。</text>
            <text
              v-if="hasDeliveryEntryContext && !isFocusedDeliveryGroup(group.key) && group.batches.length > compactGroupLimit"
              class="info-desc"
            >
              Showing {{ compactGroupLimit }} of {{ group.batches.length }} batches.
            </text>
          </view>
        </view>
      </view>

      <view class="section-card">
        <text class="section-title">项目交付处理进度</text>
        <text v-if="deliveryProgressContextHint" class="entry-context-hint">{{ deliveryProgressContextHint }}</text>
        <text class="info-line">待审核批次总数：{{ pendingReviewBatchCount }}</text>
        <text class="info-line">需修订批次总数：{{ needsRevisionBatchCount }}</text>
        <text class="info-line">可交付批次总数：{{ deliverableBatchCount }}</text>
        <text class="info-line">结果就绪任务总数：{{ readyResultTaskTotal }}</text>
        <text class="info-line">剩余审核批次：{{ remainingReviewBatches }}</text>
        <text class="info-line">Remaining Revision Batches: {{ remainingRevisionBatches }}</text>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">批次摘要</text>
          <button class="create-task-btn" size="mini" @click="createBatchForProject">创建批次</button>
        </view>
        <text class="info-line">批次数量：{{ batchCount }}</text>
        <text v-if="latestBatch" class="info-line">最近批次 ID：{{ latestBatch.batchId || '暂无' }}</text>
        <text v-if="latestBatch" class="info-line">最近批次状态：{{ latestBatch.status || '暂无' }}</text>
        <text v-if="latestBatch" class="info-line">最近批次时间：{{ latestBatch.updatedAt || latestBatch.createdAt || '暂无' }}</text>
        <text v-if="batchCount" class="info-line">关联批次 ID：{{ formatBatchIds(project.batchIds) }}</text>
        <text v-else class="info-desc">暂无关联批次，批次执行流程预留到下一阶段。</text>
        <view v-if="relatedBatches.length" class="batch-list">
          <view
            v-for="batch in relatedBatches"
            :key="batch.batchId"
            class="batch-card"
            @click="goToBatchDetail(batch)"
          >
            <view class="task-head">
              <view>
                <text class="task-id">批次 ID：{{ batch.batchId || '暂无' }}</text>
                <text class="task-time">{{ batch.updatedAt || batch.createdAt || '暂无' }}</text>
              </view>
              <text class="task-status">{{ batch.status || '暂无' }}</text>
            </view>
            <text class="task-line">批次名称：{{ batch.batchName || '暂无' }}</text>
            <text class="task-line">任务数量：{{ Array.isArray(batch.taskIds) ? batch.taskIds.length : 0 }}</text>
          </view>
        </view>
      </view>

      <view class="section-card">
        <text class="section-title">项目可交付结果</text>
        <view v-if="projectDeliverableBatches.length" class="batch-list">
          <view
            v-for="item in projectDeliverableBatches"
            :key="item.batch.batchId"
            class="batch-card"
          >
            <view class="task-head">
              <view>
                <text class="task-id">{{ item.batch.batchName || item.batch.batchId || '未命名批次' }}</text>
                <text class="task-time">{{ item.batch.updatedAt || item.batch.completedAt || item.batch.createdAt || '刚刚' }}</text>
              </view>
              <text class="task-status">{{ item.batch.status || '暂无状态' }}</text>
            </view>
            <text class="task-line">可交付结果数：{{ item.deliverableResultCount }}</text>
            <view class="quick-actions-row deliverable-actions-row">
              <button class="create-task-btn quick-link-btn" @click="goToBatchDetail(item.batch)">查看批次</button>
              <button
                class="create-task-btn quick-link-btn"
                :disabled="!item.firstResultTask"
                @click="goToTaskDetail(item.firstResultTask)"
              >
                查看结果
              </button>
            </view>
          </view>
        </view>
        <text v-else class="info-desc">暂无可交付结果。批次完成并生成结果后会显示在这里。</text>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">关联任务</text>
          <button class="create-task-btn" size="mini" @click="goToCreateTask">创建任务</button>
        </view>
        <text class="info-line">任务数量：{{ taskCount }}</text>
        <view v-if="relatedTasks.length" class="task-list">
          <view v-for="task in relatedTasks" :key="task.taskId" class="task-card" @click="goToTaskDetail(task)">
            <view class="task-head">
              <view>
                <text class="task-id">任务 ID：{{ task.taskId || '暂无' }}</text>
                <text class="task-time">{{ getTaskTime(task) }}</text>
              </view>
              <text class="task-status">{{ task.status || '暂无' }}</text>
            </view>
            <text class="task-line">阶段：{{ task.stage || '暂无' }}</text>
            <text class="task-line">Progress: {{ formatProgress(task.progress) }}</text>
            <text class="task-line">状态文案：{{ task.statusText || '暂无' }}</text>
            <text class="task-line">结果：{{ hasTaskResult(task) ? '已就绪' : '待处理' }}</text>
            <text class="task-line">原创保护材料包：{{ getOriginalProtectionPackageActionText(task) }}</text>
            <image
              v-if="task.result && task.result.coverUrl"
              :src="task.result.coverUrl"
              class="task-thumb"
              mode="aspectFill"
            ></image>
            <button
              class="create-task-btn original-protection-btn"
              @click.stop="createOriginalProtectionPackageForTask(task)"
            >
              生成原创保护材料包
            </button>
          </view>
        </view>
        <text v-else class="info-desc">暂无关联任务，可从该项目创建第一个任务。</text>
      </view>

      <view class="section-card">
        <text class="section-title">项目跟进记录</text>
        <textarea
          v-model.trim="projectNoteInput"
          class="note-input"
          placeholder="Record project progress, client feedback, next action..."
        />
        <button class="create-task-btn note-btn" @click="addProjectNote">添加备注</button>

        <view v-if="projectNotes.length" class="note-list">
          <view v-for="note in projectNotes" :key="note.noteId" class="note-item">
            <text class="note-content">{{ note.content }}</text>
            <text class="note-time">{{ note.createdAt }}</text>
          </view>
        </view>
        <text v-else class="info-desc">暂无跟进记录。</text>
      </view>
    </view>

    <view v-else-if="hasAttemptedLoad && !project" class="empty-state">
      <text class="empty-title">未找到项目</text>
      <text class="empty-desc">请返回项目列表并选择其他项目。</text>
      <text v-if="projectLoadError" class="empty-desc">加载失败：{{ projectLoadError }}</text>
      <button class="retry-btn" @click="loadProjectDetail">重试</button>
      <button class="back-btn" @click="goToProjectList">返回项目列表</button>
    </view>
  </view>
</template>

<script>
import { createBatch, getBatchesByProjectId } from '../../utils/service/batchStore'
import {
  getLeadFollowStatusLabel,
  getProjectStageLabel,
  getProjectStatusLabel
} from '../../utils/constants'
import {
  createOriginalProtectionPackageDraftFromTask,
  getAdminBatchList,
  getAdminLeadById,
  getAdminProjectById,
  syncAdminBatchToCloud,
  updateAdminProject
} from '../../utils/service/adminRepository'
import { canCreateOriginalProtectionPackage } from '../../utils/constants/originalProtectionPackage'
import { appendBatchToProject, appendProjectNote, getProjectById, getProjectNotes } from '../../utils/service/projectStore'
import { getMainChainState, patchMainChainState } from '../../utils/mainChainState'
import { appendDeliveryAudits, createDeliveryAudit } from '../../utils/task/taskDeliveryAudit'
import { appendDeliveryQueueItems } from '../../utils/task/taskDeliveryQueue'
import { getProjectRecentDeliveryActions } from '../../utils/task/deliveryActionHistory'
import { syncTaskDeliveryStatus } from '../../utils/api/task'
import { listLeadPipelines } from '../../utils/admin/leadPipelineRepository'
import { listLeadFollows } from '../../utils/admin/leadFollowRepository'
import { getDeliveryFeedbacks } from '../../utils/workspace/deliveryFeedback'
import {
  ENTERPRISE_DATA_SOURCE_LOCAL,
  ENTERPRISE_SCHEMA_VERSION,
  getList as getEnterpriseRepositoryList,
  update as updateEnterpriseRepository
} from '../../utils/repository/enterpriseRepository'
import { normalize as normalizeCustomerRepositoryRecord } from '../../utils/repository/customerRepository'
import { getProjectMeta, getProjectMetaMap, normalize as normalizeProjectRepositoryRecord, updateProjectMeta } from '../../utils/repository/projectRepository'
import { getList as getProductPackageRepositoryList } from '../../utils/repository/productPackageRepository'
import { getRolePermissions } from '../../utils/service/enterpriseService'
import { canEdit as guardCanEdit, canOperate as guardCanOperate, canView as guardCanView } from '../../utils/auth/permissionGuard'
import { calculateProjectProgress } from '../../utils/service/projectService'
import { createQuote, getQuotes, transitionQuote } from '../../utils/service/quoteService'
import { calculateOrderStatistics, createOrderFromQuote, getOrders, transitionOrder } from '../../utils/service/orderService'
import { getDeliveries } from '../../utils/service/deliveryService'
import { recordAudit } from '../../utils/audit/auditService'

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
const ENTERPRISE_COOPERATION_TYPES = Object.freeze([
  'AI设计服务',
  '企业版',
  '定制生产',
  '视觉外包'
])
const ENTERPRISE_FOLLOW_TYPES = Object.freeze([
  '电话沟通',
  '客户需求',
  'Demo反馈',
  '报价沟通',
  '项目变化'
])
const ENTERPRISE_OPERATION_LOG_STORAGE_KEY = 'diebiandesign_enterprise_operation_logs_v1'
const ENTERPRISE_APPROVAL_STORAGE_KEY = 'diebiandesign_enterprise_approvals_v1'
const CUSTOMER_PORTAL_STORAGE_KEY = 'diebiandesign_customer_portal_v1'
const ENTERPRISE_QUOTE_ITEM_OPTIONS = Object.freeze(['AI设计服务', '商品视觉生产', '详情页制作', '企业服务'])
const ENTERPRISE_PLAN_OPTIONS = Object.freeze([
  { planId: 'basic', name: '基础版', memberLimit: 5, projectLimit: 3, aiQuota: 500, storageSpace: '10 GB' },
  { planId: 'professional', name: '专业版', memberLimit: 20, projectLimit: 20, aiQuota: 3000, storageSpace: '100 GB' },
  { planId: 'enterprise', name: '企业版', memberLimit: '不限', projectLimit: '不限', aiQuota: '按需配置', storageSpace: '1 TB' }
])
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
    target: input.target || '项目详情',
    time: input.time || new Date().toISOString(),
    projectId: input.projectId || ''
  }
  try {
    uni.setStorageSync(ENTERPRISE_OPERATION_LOG_STORAGE_KEY, [log, ...logs].slice(0, 100))
  } catch (error) {
    // Logs must not block project operations.
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
    // Approval metadata must never block existing project flows.
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

function appendCustomerPortalFeedback(input = {}) {
  const state = getCustomerPortalState()
  const time = new Date().toISOString()
  const feedback = {
    feedbackId: `customer_feedback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    customer: input.customer || '企业客户',
    content: input.content || '',
    type: input.type || '修改建议',
    time,
    projectId: input.projectId || '',
    deliveryId: input.deliveryId || ''
  }
  const reminder = {
    reminderId: `customer_reminder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    projectId: feedback.projectId,
    customer: feedback.customer,
    title: feedback.type === '满意' ? '客户已确认交付' : '客户提交修改建议',
    content: feedback.content,
    status: 'pending',
    time
  }
  const message = {
    messageId: `customer_message_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    content: feedback.content,
    author: feedback.customer,
    time,
    status: '待处理',
    projectId: feedback.projectId,
    deliveryId: feedback.deliveryId
  }
  const nextState = {
    customerFeedbacks: [feedback, ...state.customerFeedbacks].slice(0, 200),
    customerMessages: [message, ...state.customerMessages].slice(0, 200),
    taskReminders: [reminder, ...state.taskReminders].slice(0, 200)
  }
  try {
    uni.setStorageSync(CUSTOMER_PORTAL_STORAGE_KEY, nextState)
  } catch (error) {
    // Customer portal metadata must not block project views.
  }
  return { state: nextState, feedback, reminder }
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
  return { quotes: getQuotes(), orders: getOrders(), schemaVersion: ENTERPRISE_SCHEMA_VERSION, dataSource: ENTERPRISE_DATA_SOURCE_LOCAL }
}

function createEnterpriseQuote(input = {}) {
  const team = getEnterpriseTeamState()
  const quote = createQuote(input, { enterpriseId: team.enterpriseId, userId: team.currentMemberId })
  return { state: getEnterpriseCommerceState(), quote }
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

function readProductPackages() {
  return getProductPackageRepositoryList()
}

function readEnterpriseWorkspaceDeliveries(projectId = '') {
  return getDeliveries(projectId ? { projectId } : {})
}

function formatEnterpriseTime(value = '') {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default {
  data() {
    const enterpriseTeam = getEnterpriseTeamState()
    return {
      projectId: '',
      entryMode: '',
      reviewContext: '',
      customerView: false,
      customerFeedbackType: '满意',
      customerFeedbackContent: '',
      customerPortalState: getCustomerPortalState(),
      enterpriseCommerceState: getEnterpriseCommerceState(),
      enterpriseQuoteItemOptions: ENTERPRISE_QUOTE_ITEM_OPTIONS,
      enterpriseQuoteForm: { items: ['AI设计服务'], amount: '' },
      project: null,
      projectDataSource: 'local',
      projectDataFallbackReason: '',
      isLoadingProject: false,
      projectLoadError: '',
      hasAttemptedLoad: false,
      projectNameInput: '',
      enterpriseProjectMetaVersion: 0,
      enterpriseId: enterpriseTeam.enterpriseId,
      enterpriseName: enterpriseTeam.enterpriseName,
      enterprisePlanId: enterpriseTeam.planId,
      enterprisePlanOptions: ENTERPRISE_PLAN_OPTIONS,
      enterpriseMembers: enterpriseTeam.members,
      enterpriseCurrentMemberId: enterpriseTeam.currentMemberId,
      operationLogs: getEnterpriseOperationLogs(),
      enterpriseApprovalState: getEnterpriseApprovalState(),
      enterpriseApprovalComment: '',
      enterpriseLeadStatusOptions: ENTERPRISE_LEAD_STATUS_OPTIONS,
      enterpriseCooperationTypes: ENTERPRISE_COOPERATION_TYPES,
      enterpriseFollowTypes: ENTERPRISE_FOLLOW_TYPES,
      enterpriseProjectForm: {
        projectGoal: '',
        cooperationType: '',
        monthlyStyleCount: '',
        expectedImageCount: '',
        deliveryCycle: ''
      },
      enterpriseFollowForm: {
        followType: ENTERPRISE_FOLLOW_TYPES[0],
        followUpContent: '',
        nextAction: ''
      },
      cloudBatches: [],
      lead: null,
      leadDataSource: 'live',
      chainState: getMainChainState(),
      projectNoteInput: '',
      projectNotes: [],
      contextTargetSectionId: '',
      hasAutoPositionedByContext: false,
      compactGroupLimit: 2,
      deliveryManualFocusGroup: '',
      isProjectBatchReviewing: false,
      projectBatchReviewSummary: {
        action: '',
        processedBatchCount: 0,
        successBatchCount: 0,
        skippedBatchCount: 0,
        failedBatchCount: 0,
        syncFailedTaskCount: 0,
        updatedAt: ''
      }
    }
  },
  onLoad(options) {
    this.projectId = (options && options.projectId) || ''
    this.entryMode = options && options.mode ? decodeURIComponent(options.mode) : ''
    this.reviewContext = options && options.reviewContext ? decodeURIComponent(options.reviewContext) : ''
    this.customerView = Boolean(options && (options.customerView === '1' || options.mode === 'customer'))
    this.contextTargetSectionId = this.resolveContextTargetSectionId(this.entryMode, this.reviewContext)
    this.hasAutoPositionedByContext = false
    this.loadProjectDetail()
    this.scheduleContextAutoPosition()
  },
  onShow() {
    this.refreshProjectEnterpriseCollaboration()
    this.customerPortalState = getCustomerPortalState()
    this.chainState = getMainChainState()
    this.loadProjectDetail()
    this.scheduleContextAutoPosition()
  },
  computed: {
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
    enterpriseCurrentPermissions() {
      return getRolePermissions(this.enterpriseCurrentMember.role)
    },
    enterpriseCurrentPlan() {
      return this.enterprisePlanOptions.find((item) => item.planId === this.enterprisePlanId) || this.enterprisePlanOptions[0]
    },
    enterpriseUsageSummary() {
      const products = this.customerPortalProducts
      return {
        generationCount: this.taskCount,
        imageCount: products.reduce((count, item) => count + item.assets.length, 0),
        productCount: products.length,
        projectCount: this.projectId ? 1 : 0,
        memberUsage: this.enterpriseMembers.map((member) => ({
          memberId: member.memberId,
          name: member.name,
          role: member.role,
          usageCount: this.operationLogs.filter((log) => log.operator === member.name && (!log.projectId || log.projectId === this.projectId)).length
        }))
      }
    },
    projectEnterpriseQuotes() {
      return this.enterpriseCommerceState.quotes.filter((item) => item.projectId === this.projectId)
    },
    projectEnterpriseOrders() {
      return this.enterpriseCommerceState.orders.filter((item) => item.projectId === this.projectId)
    },
    projectEnterpriseCommerceStats() {
      return calculateOrderStatistics(this.projectEnterpriseOrders)
    },
    projectEnterpriseOperationLogs() {
      return this.operationLogs.filter((item) => !item.projectId || item.projectId === this.projectId).slice(0, 12)
    },
    projectEnterpriseApprovalItems() {
      const state = this.enterpriseApprovalState
      const projectId = this.projectId
      const items = Object.values(state.designApprovals)
        .filter((record) => record.projectId === projectId)
        .map((record) => ({ ...record, targetType: 'design', status: record.designApprovalStatus || 'draft' }))
      readProductPackages()
        .filter((product) => product.projectId === projectId || (product.designParams && product.designParams.projectId === projectId))
        .forEach((product) => {
          const targetId = product.productPackageId
          if (!targetId) return
          const record = state.productApprovals[targetId] || {}
          items.push({
            ...record,
            targetType: 'product', targetId,
            targetName: (product.productInfo && (product.productInfo.productTitle || product.productInfo.name)) || product.title || '商品资料包',
            projectId,
            status: record.publishStatus || 'draft'
          })
        })
      readEnterpriseWorkspaceDeliveries(projectId).forEach((delivery) => {
        const targetId = delivery.deliveryId
        if (!targetId) return
        const record = state.deliveryApprovals[targetId] || {}
        items.push({
          ...record,
          targetType: 'delivery', targetId,
          targetName: delivery.title || `交付 ${targetId}`,
          projectId,
          status: record.deliveryApprovalStatus || 'preparing'
        })
      })
      Object.values(state.deliveryApprovals)
        .filter((record) => record.projectId === projectId && !items.some((item) => item.targetType === 'delivery' && item.targetId === record.targetId))
        .forEach((record) => items.push({ ...record, targetType: 'delivery', status: record.deliveryApprovalStatus || 'preparing' }))
      return items
    },
    projectEnterpriseApprovalLogs() {
      return this.enterpriseApprovalState.approvalLogs.filter((item) => !item.projectId || item.projectId === this.projectId).slice(0, 20)
    },
    projectEnterpriseApprovalTaskSummary() {
      const items = this.projectEnterpriseApprovalItems
      const pendingReview = items.filter((item) => ['pending_review', 'pending_publish', 'waiting_confirm'].includes(item.status)).length
      const role = this.enterpriseCurrentMember.role
      if (role === '设计师') return { label: '待审核方案', value: items.filter((item) => item.targetType === 'design' && item.status === 'pending_review').length }
      if (role === '项目经理') return { label: '待审核项目', value: pendingReview }
      if (role === '运营') return { label: '待发布商品', value: items.filter((item) => item.targetType === 'product' && ['draft', 'approved'].includes(item.status)).length }
      if (['管理员', '老板'].includes(role)) return { label: '待审批事项', value: pendingReview }
      return { label: '当前暂无审批任务', value: 0 }
    },
    entryContextHint() {
      if (this.entryMode === 'delivery-view') {
        return 'Context: opened from project list delivery shortcut.'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return 'Context: opened for project revision handling. Focus on revision-required batches/tasks.'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return 'Context: opened for project delivery review. Focus on pending review batches/tasks.'
      }
      return ''
    },
    deliveryOpsContextHint() {
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return '交付上下文：优先处理该项目中需要修订的批次。'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return '交付上下文：优先处理该项目中待审核的批次。'
      }
      if (this.entryMode === 'delivery-view') {
        return '交付上下文：聚焦可交付批次，推进最终交付。'
      }
      return ''
    },
    hasProjectBatchReviewSummary() {
      return !!(this.projectBatchReviewSummary && this.projectBatchReviewSummary.updatedAt)
    },
    projectBatchReviewActionLabel() {
      const action = this.projectBatchReviewSummary && this.projectBatchReviewSummary.action
      if (action === 'approve_deliverable_batches_in_project') {
        return '确认项目内可交付批次'
      }
      if (action === 'mark_pending_review_batches_as_needs_revision_in_project') {
        return '标记项目内待审核批次为需修订'
      }
      return action || '暂无'
    },
    projectBatchReviewActionTone() {
      const action = this.projectBatchReviewSummary && this.projectBatchReviewSummary.action
      if (action === 'approve_deliverable_batches_in_project') {
        return 'success'
      }
      if (action === 'mark_pending_review_batches_as_needs_revision_in_project') {
        return 'warning'
      }
      return 'default'
    },
    projectBatchReviewActionSourceLabel() {
      return this.hasProjectBatchReviewSummary ? '项目详情快捷操作' : '暂无'
    },
    projectBatchReviewActionTypeLabel() {
      const action = this.projectBatchReviewSummary && this.projectBatchReviewSummary.action
      if (action === 'approve_deliverable_batches_in_project') {
        return '确认项目内可交付批次'
      }
      if (action === 'mark_pending_review_batches_as_needs_revision_in_project') {
        return '标记项目内待审核批次为需修订'
      }
      return '暂无'
    },
    projectBatchReviewTriggeredFrom() {
      if (!this.hasProjectBatchReviewSummary) {
        return '暂无'
      }
      return '项目详情 / 项目批次审核操作'
    },
    recentProjectReviewActions() {
      if (!this.project || !this.project.projectId) {
        return []
      }
      const list = getProjectRecentDeliveryActions(this.project.projectId, 5)
      return list.map((item) => {
        const exactBatch = item.batchId
          ? (this.relatedBatches.find((batch) => batch && batch.batchId === item.batchId) || { batchId: item.batchId })
          : null
        const fallbackTarget = !exactBatch ? this.resolveProjectReviewActionTarget(item.actionType || '') : null
        const resolvedTarget = exactBatch
          ? {
              batch: exactBatch,
              mode: item.targetMode || '',
              reviewContext: item.targetReviewContext || ''
            }
          : fallbackTarget
        return {
          ...item,
          actionType: item.actionType || '暂无',
          actionSource: item.actionSource || '暂无',
          triggeredFrom: item.triggeredFrom || '暂无',
          createdAt: item.createdAt || item.time || '',
          time: item.createdAt || item.time || '',
          targetBatch: exactBatch,
          fallbackTarget,
          resolvedTarget,
          targetMode: item.targetMode || '',
          targetReviewContext: item.targetReviewContext || ''
        }
      })
    },
    latestProjectReviewActionTarget() {
      const first = this.recentProjectReviewActions.length ? this.recentProjectReviewActions[0] : null
      if (!first || !first.resolvedTarget || !first.resolvedTarget.batch || !first.resolvedTarget.batch.batchId) {
        return null
      }
      return {
        batch: first.resolvedTarget.batch,
        mode: first.resolvedTarget.mode || '',
        reviewContext: first.resolvedTarget.reviewContext || ''
      }
    },
    taskCount() {
      return Array.isArray(this.project && this.project.taskIds) ? this.project.taskIds.length : 0
    },
    batchCount() {
      return Array.isArray(this.project && this.project.batchIds) ? this.project.batchIds.length : 0
    },
    relatedBatches() {
      if (!this.project || !this.project.projectId) {
        return []
      }

      const projectBatchIds = Array.isArray(this.project.batchIds) ? this.project.batchIds : []
      const localBatches = getBatchesByProjectId(this.project.projectId)
      const batchMap = {}

      this.cloudBatches.forEach((batch) => {
        if (!batch || !batch.batchId) {
          return
        }
        batchMap[batch.batchId] = batch
      })

      localBatches.forEach((batch) => {
        if (!batch || !batch.batchId || batchMap[batch.batchId]) {
          return
        }
        batchMap[batch.batchId] = batch
      })

      const mergedBatches = Object.values(batchMap)

      if (!projectBatchIds.length) {
        return mergedBatches
      }

      const orderedBatchMap = mergedBatches.reduce((acc, batch) => {
        acc[batch.batchId] = batch
        return acc
      }, {})

      return projectBatchIds
        .map((batchId) => orderedBatchMap[batchId])
        .filter(Boolean)
    },
    latestBatch() {
      if (!this.relatedBatches.length) {
        return null
      }

      return [...this.relatedBatches].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime() || 0
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime() || 0
        return rightTime - leftTime
      })[0]
    },
    relatedTasks() {
      if (!this.project || !Array.isArray(this.project.taskIds) || !this.project.taskIds.length) {
        return []
      }

      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      return this.project.taskIds
        .map((taskId) => byId[taskId])
        .filter(Boolean)
    },
    successTaskCount() {
      return this.relatedTasks.filter((task) => this.isSuccessTask(task)).length
    },
    processingTaskCount() {
      return this.relatedTasks.filter((task) => this.isProcessingTask(task)).length
    },
    failedTaskCount() {
      return this.relatedTasks.filter((task) => this.isFailedTask(task)).length
    },
    latestTask() {
      if (!this.relatedTasks.length) {
        return null
      }

      return [...this.relatedTasks].sort((left, right) => {
        const leftTime = new Date(this.getTaskTimeValue(left)).getTime() || 0
        const rightTime = new Date(this.getTaskTimeValue(right)).getTime() || 0
        return rightTime - leftTime
      })[0]
    },
    latestTaskTime() {
      return this.latestTask ? this.getTaskTime(this.latestTask) : '暂无'
    },
    hasDeliverableResult() {
      return this.relatedTasks.some((task) => this.hasTaskResult(task))
    },
    projectExecutionStatus() {
      if (!this.relatedTasks.length) {
        return 'idle'
      }

      if (this.processingTaskCount > 0 && this.successTaskCount === 0 && this.failedTaskCount === 0) {
        return 'in_progress'
      }

      if (this.successTaskCount > 0 && this.processingTaskCount === 0 && this.failedTaskCount === 0 && this.successTaskCount === this.taskCount) {
        return 'completed'
      }

      if (this.failedTaskCount > 0 && this.successTaskCount === 0 && this.processingTaskCount === 0) {
        return 'blocked'
      }

      if (this.successTaskCount > 0 || this.processingTaskCount > 0 || this.failedTaskCount > 0) {
        return 'partially_done'
      }

      return 'idle'
    },
    deliverableBatchCount() {
      return this.relatedBatches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'ready_to_deliver').length
    },
    pendingReviewBatchCount() {
      return this.relatedBatches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'pending_review').length
    },
    needsRevisionBatchCount() {
      return this.relatedBatches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === 'revision_required').length
    },
    sortedDeliverableBatches() {
      return this.getSortedBatchesForGroup('deliverable')
    },
    projectDeliverableBatches() {
      return this.relatedBatches
        .map((batch) => {
          const resultTasks = this.getBatchReviewableTasks(batch)
          return {
            batch,
            deliverableResultCount: resultTasks.length,
            firstResultTask: resultTasks.length ? resultTasks[0] : null
          }
        })
        .filter((item) => {
          const status = String((item.batch && item.batch.status) || '').toLowerCase()
          const isCompletedBatch = ['completed', 'success', 'done'].includes(status)
          return item.deliverableResultCount > 0 && (isCompletedBatch || this.getBatchDeliveryReviewLabel(item.batch) === 'ready_to_deliver')
        })
        .sort((left, right) => {
          const leftTime = new Date(left.batch.updatedAt || left.batch.completedAt || left.batch.createdAt || '').getTime() || 0
          const rightTime = new Date(right.batch.updatedAt || right.batch.completedAt || right.batch.createdAt || '').getTime() || 0
          return rightTime - leftTime
        })
    },
    sortedPendingReviewBatches() {
      return this.getSortedBatchesForGroup('pending_review')
    },
    sortedNeedsRevisionBatches() {
      return this.getSortedBatchesForGroup('needs_revision')
    },
    topDeliverableBatch() {
      return this.sortedDeliverableBatches.length ? this.sortedDeliverableBatches[0] : null
    },
    topPendingReviewBatch() {
      return this.sortedPendingReviewBatches.length ? this.sortedPendingReviewBatches[0] : null
    },
    topNeedsRevisionBatch() {
      return this.sortedNeedsRevisionBatches.length ? this.sortedNeedsRevisionBatches[0] : null
    },
    priorityBatchGroup() {
      if (this.needsRevisionBatchCount > 0) {
        return 'needs_revision'
      }
      if (this.pendingReviewBatchCount > 0) {
        return 'pending_review'
      }
      if (this.deliverableBatchCount > 0) {
        return 'deliverable'
      }
      return 'none'
    },
    priorityBatchGroupLabel() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return '需修订批次'
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return '待审核批次'
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return '可交付批次'
      }
      return '暂无'
    },
    priorityBatchReason() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return `当前项目仍有 ${this.needsRevisionBatchCount} 个待修批次，优先处理修订可降低交付阻塞。`
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return `当前项目有 ${this.pendingReviewBatchCount} 个待审核批次，优先审核可推进交付。`
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return `当前项目有 ${this.deliverableBatchCount} 个可交付批次，可优先进入交付。`
      }
      return '当前项目暂无可优先处理批次，可继续观察执行进展。'
    },
    priorityBatchActionLabel() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return '修订最高优先级需修订批次'
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return '审核最高优先级待审核批次'
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return '交付最高优先级可交付批次'
      }
      return '暂无优先批次操作'
    },
    priorityBatchActionEnabled() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return !!this.topNeedsRevisionBatch
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return !!this.topPendingReviewBatch
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return !!this.topDeliverableBatch
      }
      return false
    },
    priorityRecommendedBatch() {
      if (this.priorityBatchGroup === 'needs_revision') {
        return this.topNeedsRevisionBatch
      }
      if (this.priorityBatchGroup === 'pending_review') {
        return this.topPendingReviewBatch
      }
      if (this.priorityBatchGroup === 'deliverable') {
        return this.topDeliverableBatch
      }
      return null
    },
    priorityRecommendedBatchCounts() {
      return this.priorityRecommendedBatch ? this.getBatchDeliveryCounts(this.priorityRecommendedBatch) : {
        readyCount: 0,
        approvedCount: 0,
        needsRevisionCount: 0,
        pendingReviewCount: 0
      }
    },
    priorityRecommendedBatchTime() {
      if (!this.priorityRecommendedBatch) {
        return '暂无'
      }
      return this.priorityRecommendedBatch.updatedAt || this.priorityRecommendedBatch.createdAt || '暂无'
    },
    nextDeliverableBatch() {
      return this.sortedDeliverableBatches.length > 1 ? this.sortedDeliverableBatches[1] : null
    },
    nextPendingReviewBatch() {
      return this.sortedPendingReviewBatches.length > 1 ? this.sortedPendingReviewBatches[1] : null
    },
    nextNeedsRevisionBatch() {
      return this.sortedNeedsRevisionBatches.length > 1 ? this.sortedNeedsRevisionBatches[1] : null
    },
    latestDeliverableBatch() {
      return this.getLatestBatchByLabel('ready_to_deliver')
    },
    latestPendingReviewBatch() {
      const matched = this.getPendingReviewGroupBatches()
      if (!matched.length) {
        return null
      }
      return [...matched].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime() || 0
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime() || 0
        return rightTime - leftTime
      })[0]
    },
    latestNeedsRevisionBatch() {
      return this.getLatestBatchByLabel('revision_required')
    },
    deliveryOpsNextStep() {
      if (this.needsRevisionBatchCount > 0) {
        return 'Handle revision batches first'
      }
      if (this.pendingReviewBatchCount > 0) {
        return '审核待交付批次'
      }
      if (this.deliverableBatchCount > 0) {
        return '打开可交付批次并推进交付'
      }
      return 'Continue execution and monitor batch progress'
    },
    deliveryOpsNextStepDetail() {
      if (this.needsRevisionBatchCount > 0) {
        return `${this.needsRevisionBatchCount} 个批次需要修订，请打开最近需修订批次并优先处理。`
      }
      if (this.pendingReviewBatchCount > 0) {
        return `${this.pendingReviewBatchCount} batch(es) are waiting for review. Check outputs and confirm delivery status.`
      }
      if (this.deliverableBatchCount > 0) {
        return `${this.deliverableBatchCount} batch(es) are ready to deliver. You can proceed with result review and delivery handoff.`
      }
      return '当前暂无交付关键批次，请继续执行任务并观察状态变化。'
    },
    deliveryProgressContextHint() {
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return `聚焦：待审核。剩余审核批次：${this.remainingReviewBatches}`
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return `Focus: Needs Revision. Remaining Revision Batches: ${this.remainingRevisionBatches}`
      }
      if (this.entryMode === 'delivery-view') {
        return `聚焦：交付视图。可交付批次总数：${this.deliverableBatchCount}`
      }
      return ''
    },
    readyResultTaskTotal() {
      return this.relatedTasks.filter((task) => this.hasTaskResult(task)).length
    },
    remainingReviewBatches() {
      return this.pendingReviewBatchCount
    },
    remainingRevisionBatches() {
      return this.needsRevisionBatchCount
    },
    hasDeliveryEntryContext() {
      return !!this.effectiveDeliveryFocusKey
    },
    deliveryContextFocusKey() {
      if (this.entryMode === 'delivery-view') {
        return 'deliverable'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'pending_review') {
        return 'pending_review'
      }
      if (this.entryMode === 'delivery-review' && this.reviewContext === 'needs_revision') {
        return 'needs_revision'
      }
      return ''
    },
    effectiveDeliveryFocusKey() {
      return this.deliveryManualFocusGroup || this.deliveryContextFocusKey
    },
    deliveryContextFocusLabel() {
      if (this.effectiveDeliveryFocusKey === 'deliverable') {
        return 'Deliverable Batches'
      }
      if (this.effectiveDeliveryFocusKey === 'pending_review') {
        return '待审核批次'
      }
      if (this.effectiveDeliveryFocusKey === 'needs_revision') {
        return 'Needs Revision Batches'
      }
      return 'All Batches'
    },
    focusedTopBatch() {
      if (this.effectiveDeliveryFocusKey === 'pending_review') {
        return this.sortedPendingReviewBatches.length ? this.sortedPendingReviewBatches[0] : null
      }
      if (this.effectiveDeliveryFocusKey === 'needs_revision') {
        return this.sortedNeedsRevisionBatches.length ? this.sortedNeedsRevisionBatches[0] : null
      }
      if (this.effectiveDeliveryFocusKey === 'deliverable') {
        return this.sortedDeliverableBatches.length ? this.sortedDeliverableBatches[0] : null
      }
      return null
    },
    deliveryBatchGroups() {
      return [
        {
          key: 'deliverable',
          title: 'Deliverable Batches',
          mode: 'delivery-view',
          reviewContext: '',
          batches: this.sortedDeliverableBatches
        },
        {
          key: 'pending_review',
          title: '待审核批次',
          mode: 'delivery-review',
          reviewContext: 'pending_review',
          batches: this.sortedPendingReviewBatches
        },
        {
          key: 'needs_revision',
          title: 'Needs Revision Batches',
          mode: 'delivery-review',
          reviewContext: 'needs_revision',
          batches: this.sortedNeedsRevisionBatches
        }
      ]
    },
    leadDataSourceLabel() {
      return this.leadDataSource === 'snapshot' ? '项目快照' : '线索仓储'
    },
    projectOverview() {
      const project = this.project && typeof this.project === 'object' ? this.project : {}
      const snapshot = project.leadSnapshot && typeof project.leadSnapshot === 'object' ? project.leadSnapshot : {}
      const serviceScope = Array.isArray(project.serviceScope)
        ? project.serviceScope
        : Array.isArray(snapshot.serviceScope)
          ? snapshot.serviceScope
          : []

      return normalizeProjectRepositoryRecord({
        ...project,
        projectId: project.projectId || '',
        projectName: project.projectName || '',
        leadId: project.leadId || snapshot.leadId || '',
        projectType: project.projectType || '',
        status: project.status || 'pending',
        stage: project.stage || 'requirement_confirmed',
        serviceScope,
        createdAt: project.createdAt || '',
        updatedAt: project.updatedAt || '',
        startedAt: project.startedAt || '',
        completedAt: project.completedAt || ''
      }, { enterpriseId: this.enterpriseId, userId: this.enterpriseCurrentMember.memberId })
    },
    projectCustomerSummary() {
      const project = this.projectOverview
      const lead = this.lead || project.leadSnapshot || {}
      return normalizeCustomerRepositoryRecord({
        customerId: project.customerId || lead.customerId || lead.leadId || '',
        customerName: lead.customerName || lead.companyName || project.customerName || '未设置',
        contactName: lead.contactName || lead.customerContact || project.customerContact || '未设置',
        enterpriseType: lead.enterpriseType || lead.companyType || project.enterpriseType || '未设置',
        industry: lead.industry || lead.productCategory || lead.clothingCategory || project.industry || '未设置',
        contact: lead.mobile || lead.phone || lead.wechat || lead.email || lead.customerContact || project.customerContact || '未设置'
      }, { enterpriseId: project.enterpriseId || this.enterpriseId, userId: this.enterpriseCurrentMember.memberId })
    },
    customerPortalHasCustomer() {
      const project = this.projectOverview
      const lead = this.lead || project.leadSnapshot || {}
      return Boolean(project.customerId || project.customerName || lead.customerName || lead.companyName)
    },
    customerPortalProducts() {
      return readProductPackages()
        .filter((product) => product.projectId === this.projectId || (product.designParams && product.designParams.projectId === this.projectId))
        .map((product) => {
          const sourceAssets = Array.isArray(product.assets)
            ? product.assets
            : (product.assets && typeof product.assets === 'object' ? Object.values(product.assets).flat() : [])
          const assets = sourceAssets.map((asset, index) => {
            const assetType = asset.assetType || asset.type || asset.outputType || 'image'
            return {
              assetId: asset.assetId || asset.id || `${product.productPackageId}_asset_${index}`,
              assetType,
              label: this.getCustomerAssetTypeLabel(assetType),
              url: asset.coverUrl || asset.imageUrl || asset.url || asset.resultImage || ''
            }
          })
          return {
            ...product,
            productName: (product.productInfo && (product.productInfo.productTitle || product.productInfo.name)) || product.title || '未命名商品',
            assets
          }
        })
    },
    customerPortalDeliveries() {
      return this.projectEnterpriseApprovalItems.filter((item) => item.targetType === 'delivery')
    },
    customerPortalSummary() {
      const progress = calculateProjectProgress(this.projectOverview, { lifecycleEvents: this.projectLifecycleEvents })
      const latestDelivery = this.customerPortalDeliveries[0]
      return {
        projectName: this.projectOverview.projectName || '企业项目',
        progress,
        productCount: this.customerPortalProducts.length,
        deliveryStatus: latestDelivery ? this.getEnterpriseApprovalStatusLabel(latestDelivery.status) : '准备中'
      }
    },
    customerProjectFeedbacks() {
      return this.customerPortalState.customerFeedbacks.filter((item) => item.projectId === this.projectId).slice(0, 20)
    },
    customerProjectMessages() {
      return this.customerPortalState.customerMessages.filter((item) => item.projectId === this.projectId).slice(0, 20)
    },
    enterpriseProjectMeta() {
      void this.enterpriseProjectMetaVersion
      return getEnterpriseProjectMeta(this.projectOverview.projectId)
    },
    enterpriseLeadStatus() {
      if (this.enterpriseProjectMeta.leadStatus) return this.enterpriseProjectMeta.leadStatus
      const project = this.projectOverview
      const pipeline = listLeadPipelines().find((item) => (
        (project.leadId && item.leadId === project.leadId) || item.projectId === project.projectId
      )) || {}
      if (ENTERPRISE_LEAD_STATUS_LABELS[pipeline.stage]) return ENTERPRISE_LEAD_STATUS_LABELS[pipeline.stage]
      if (['delivered', 'completed'].includes(project.status)) return '已成交'
      if (['designing', 'generating', 'pending_review'].includes(project.status)) return '合作中'
      return project.leadId ? '需求确认' : '初次接触'
    },
    enterpriseLeadStatusIndex() {
      const index = this.enterpriseLeadStatusOptions.indexOf(this.enterpriseLeadStatus)
      return index >= 0 ? index : 0
    },
    enterpriseLeadStatusUpdatedAt() {
      return this.enterpriseProjectMeta.leadStatusUpdatedAt
        ? formatEnterpriseTime(this.enterpriseProjectMeta.leadStatusUpdatedAt)
        : '未设置'
    },
    enterpriseCooperationTypeIndex() {
      const index = this.enterpriseCooperationTypes.indexOf(this.enterpriseProjectForm.cooperationType)
      return index >= 0 ? index : 0
    },
    enterpriseFollowTypeIndex() {
      const index = this.enterpriseFollowTypes.indexOf(this.enterpriseFollowForm.followType)
      return index >= 0 ? index : 0
    },
    projectValueSummary() {
      const project = this.projectOverview
      const lead = this.lead || project.leadSnapshot || {}
      const meta = this.enterpriseProjectMeta
      const expectedItems = []
      if (meta.monthlyStyleCount) expectedItems.push(`月产 ${meta.monthlyStyleCount} 款`)
      if (meta.expectedImageCount) expectedItems.push(`${meta.expectedImageCount} 张图片`)
      if (meta.deliveryCycle) expectedItems.push(`周期 ${meta.deliveryCycle}`)
      return {
        cooperationType: meta.cooperationType || project.cooperationType || project.projectType || lead.demandType || '未设置',
        expectedOutput: expectedItems.join(' · ') || project.expectedOutput || lead.quantity || (this.taskCount ? `${this.taskCount} 个生产任务` : '未设置'),
        projectGoal: meta.projectGoal || project.projectGoal || project.description || lead.requirementText || lead.description || '未设置'
      }
    },
    projectLifecycleEvents() {
      const project = this.projectOverview
      const lead = this.lead || project.leadSnapshot || {}
      const deliveries = readEnterpriseWorkspaceDeliveries(project.projectId)
      const productPackages = readProductPackages().filter((item) => (
        item.projectId === project.projectId || (item.designParams && item.designParams.projectId === project.projectId)
      ))
      const deliveryStarted = deliveries[deliveries.length - 1] || null
      const deliveryConfirmed = deliveries.find((item) => item.status === 'confirmed') || null
      const statusIndex = this.enterpriseLeadStatusOptions.indexOf(this.enterpriseLeadStatus)
      const productCreatedAt = productPackages.length ? productPackages[0].createdAt : ''
      return [
        { key: 'requirement', title: '客户提交需求', time: formatEnterpriseTime(lead.createdAt || project.createdAt), description: lead.requirementText || lead.description || '已建立客户需求记录', completed: Boolean(project.leadId || lead.leadId) },
        { key: 'demo', title: '完成 Demo', time: statusIndex >= 1 ? formatEnterpriseTime(this.enterpriseProjectMeta.leadStatusUpdatedAt || project.updatedAt) : '待发生', description: statusIndex >= 1 ? '已完成产品能力演示与方向沟通' : '等待安排 Demo 演示', completed: statusIndex >= 1 },
        { key: 'project', title: '创建项目', time: formatEnterpriseTime(project.createdAt), description: project.projectName || '企业项目已创建', completed: Boolean(project.projectId) },
        { key: 'product', title: '生成商品', time: productCreatedAt ? formatEnterpriseTime(productCreatedAt) : '待发生', description: productPackages.length ? `已形成 ${productPackages.length} 个商品资料包` : '等待生成商品资料', completed: productPackages.length > 0 },
        { key: 'design', title: '完成设计', time: this.taskCount ? formatEnterpriseTime(project.updatedAt) : '待发生', description: this.taskCount ? `已有 ${this.taskCount} 个生产任务` : '等待设计方案进入生产', completed: this.taskCount > 0 },
        { key: 'delivery', title: '开始交付', time: deliveryStarted ? formatEnterpriseTime(deliveryStarted.createdAt) : '待发生', description: deliveries.length ? `已有 ${deliveries.length} 个交付记录` : '等待创建交付', completed: deliveries.length > 0 },
        { key: 'confirmed', title: '客户确认', time: deliveryConfirmed ? formatEnterpriseTime(deliveryConfirmed.completedAt || deliveryConfirmed.createdAt) : '待发生', description: deliveryConfirmed ? '客户已确认本次交付' : '等待客户确认', completed: Boolean(deliveryConfirmed) }
      ]
    },
    projectSalesFollowRecords() {
      const project = this.projectOverview
      const salesRecords = listLeadFollows()
        .filter((item) => item.projectId === project.projectId || (project.leadId && item.leadId === project.leadId))
        .map((item) => ({
          id: item.followId,
          rawTime: item.createdAt || '',
          time: formatEnterpriseTime(item.createdAt),
          content: item.content || item.actionType,
          nextAction: item.nextFollowAt ? `${item.actionType} · ${formatEnterpriseTime(item.nextFollowAt)}` : '持续跟进'
        }))
      const feedbackRecords = readEnterpriseWorkspaceDeliveries(project.projectId)
        .reduce((records, delivery) => records.concat(getDeliveryFeedbacks(delivery.deliveryId)), [])
        .map((item) => ({
          id: item.feedbackId,
          rawTime: item.createdAt || '',
          time: formatEnterpriseTime(item.createdAt),
          content: item.content || (item.status === 'accepted' ? '客户已确认交付' : '客户提交交付反馈'),
          nextAction: item.status === 'revision_required' ? '安排修改并反馈客户' : '完成交付确认'
        }))
      const manualRecords = (Array.isArray(this.enterpriseProjectMeta.followUps) ? this.enterpriseProjectMeta.followUps : [])
        .map((item) => ({
          id: item.followUpId,
          rawTime: item.followUpTime || '',
          time: formatEnterpriseTime(item.followUpTime),
          content: `${item.followType || '项目跟进'}：${item.followUpContent || '未填写内容'}`,
          nextAction: item.nextAction || '持续跟进'
        }))
      return [...manualRecords, ...salesRecords, ...feedbackRecords]
        .sort((left, right) => String(right.rawTime).localeCompare(String(left.rawTime)))
        .slice(0, 8)
    }
  },
  methods: {
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
    canEnterpriseCollaborate(permission = '') {
      if (this.enterpriseCurrentMember.status && this.enterpriseCurrentMember.status !== 'active') return false
      return ['管理员', '老板'].includes(this.enterpriseCurrentMember.role) || this.enterpriseCurrentPermissions.includes(permission)
    },
    getEnterprisePermissionLabel(permission = '') {
      const labels = {
        business: '经营数据', customer: '客户', project: '项目', design: '设计方案', product: '商品生产',
        production: '生产', asset: '素材', marketing: '详情页', delivery: '交付', follow: '跟进'
      }
      return labels[permission] || permission
    },
    formatEnterpriseOperationTime(value) {
      return formatEnterpriseTime(value)
    },
    changeProjectEnterpriseMember(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      const member = this.enterpriseMembers[index] || this.enterpriseMembers[0]
      if (!member) return
      this.enterpriseCurrentMemberId = member.memberId
      saveEnterpriseTeamState({ members: this.enterpriseMembers, currentMemberId: member.memberId })
      this.recordProjectEnterpriseOperation('进入项目', `${member.role}视图`)
    },
    refreshProjectEnterpriseCollaboration() {
      const state = getEnterpriseTeamState()
      this.enterpriseId = state.enterpriseId
      this.enterpriseName = state.enterpriseName
      this.enterprisePlanId = state.planId
      this.enterpriseMembers = state.members
      this.enterpriseCurrentMemberId = state.currentMemberId
      this.operationLogs = getEnterpriseOperationLogs()
      this.enterpriseApprovalState = getEnterpriseApprovalState()
      this.customerPortalState = getCustomerPortalState()
      this.enterpriseCommerceState = getEnterpriseCommerceState()
    },
    recordProjectEnterpriseOperation(action, target) {
      appendEnterpriseOperationLog({
        operator: this.enterpriseCurrentMember.name,
        action,
        target,
        projectId: this.projectId
      })
      this.operationLogs = getEnterpriseOperationLogs()
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
    getCustomerAssetTypeLabel(assetType = '') {
      const labels = {
        ai_model: 'AI模特图', model: 'AI模特图', model_image: 'AI模特图',
        flat_lay: '平铺细节图', detail: '平铺细节图', detail_photo: '平铺细节图',
        detail_page: '详情页素材', page: '详情页素材', page_material: '详情页素材',
        poster: '海报', series: '系列图', series_image: '系列图', image: '商品图片'
      }
      return labels[assetType] || '商品素材'
    },
    setCustomerFeedbackType(type = '满意') {
      this.customerFeedbackType = type
    },
    submitCustomerPortalFeedback(type = this.customerFeedbackType) {
      if (!this.customerPortalHasCustomer) {
        uni.showToast({ title: '暂无客户门户', icon: 'none' })
        return
      }
      const content = String(this.customerFeedbackContent || '').trim()
      if (type === '修改建议' && !content) {
        uni.showToast({ title: '请填写修改建议', icon: 'none' })
        return
      }
      const delivery = this.customerPortalDeliveries[0]
      const customer = this.projectCustomerSummary.customerName
      const result = appendCustomerPortalFeedback({
        customer,
        content: content || '客户确认当前交付成果',
        type,
        projectId: this.projectId,
        deliveryId: delivery ? delivery.targetId : ''
      })
      this.customerPortalState = result.state
      recordAudit({
        enterpriseId: this.enterpriseId,
        userId: this.projectCustomerSummary.customerId || 'customer',
        operator: customer,
        action: '提交客户反馈',
        targetType: 'customer_feedback',
        targetId: result.feedback.feedbackId,
        before: {},
        after: { type, status: type === '满意' ? 'confirmed' : 'revision_required' }
      })
      const target = delivery || {
        targetType: 'delivery',
        targetId: `${this.projectId}_customer_confirmation`,
        targetName: `${this.customerPortalSummary.projectName} 客户确认`,
        projectId: this.projectId
      }
      const status = type === '满意' ? 'confirmed' : 'revision_required'
      this.enterpriseApprovalState = updateEnterpriseApproval({
        ...target,
        status,
        operator: customer,
        role: '客户',
        action: type === '满意' ? '客户确认交付' : '客户要求修改',
        comment: result.feedback.content
      })
      appendEnterpriseOperationLog({
        operator: customer,
        action: type === '满意' ? '确认交付' : '提交修改建议',
        target: this.customerPortalSummary.projectName,
        projectId: this.projectId
      })
      this.operationLogs = getEnterpriseOperationLogs()
      this.customerFeedbackContent = ''
      this.customerFeedbackType = type
      uni.showToast({ title: type === '满意' ? '已确认交付' : '修改建议已提交', icon: 'success' })
    },
    changeCustomerMessageStatus(message = {}, status = '处理中') {
      if (!this.canRbacOperate('customer.manage')) return this.rejectRbacOperation()
      if (!message.messageId || !['待处理', '处理中', '已完成'].includes(status)) return
      const previousStatus = message.status || '待处理'
      this.customerPortalState = updateCustomerMessageStatus(message.messageId, status)
      recordAudit({
        enterpriseId: this.enterpriseId,
        userId: this.enterpriseCurrentMember.memberId,
        operator: this.enterpriseCurrentMember.name,
        action: '处理客户反馈',
        targetType: 'customer_feedback',
        targetId: message.messageId,
        before: { status: previousStatus },
        after: { status }
      })
      this.recordProjectEnterpriseOperation('更新客户消息', `${message.author} · ${status}`)
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
    toggleEnterpriseQuoteItem(item = '') {
      const items = this.enterpriseQuoteForm.items
      this.enterpriseQuoteForm.items = items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
    },
    createProjectEnterpriseQuote() {
      if (!this.canRbacOperate('quote.manage')) return this.rejectRbacOperation()
      if (!this.enterpriseQuoteForm.items.length || Number(this.enterpriseQuoteForm.amount || 0) <= 0) {
        uni.showToast({ title: '请选择服务并填写金额', icon: 'none' })
        return
      }
      const result = createEnterpriseQuote({
        customer: this.projectCustomerSummary.customerName,
        projectId: this.projectId,
        items: this.enterpriseQuoteForm.items,
        amount: this.enterpriseQuoteForm.amount
      })
      this.enterpriseCommerceState = result.state
      this.enterpriseQuoteForm = { items: ['AI设计服务'], amount: '' }
      this.recordProjectEnterpriseOperation('创建报价单', result.quote.quoteId)
      uni.showToast({ title: '报价单已创建', icon: 'success' })
    },
    changeEnterpriseQuoteStatus(quote = {}, status = 'draft') {
      if (!this.canRbacOperate('quote.manage')) return this.rejectRbacOperation()
      if (!quote.quoteId || !['draft', 'sent', 'confirmed', 'rejected'].includes(status)) return
      this.enterpriseCommerceState = updateEnterpriseQuoteStatus(quote.quoteId, status)
      this.recordProjectEnterpriseOperation('更新报价状态', `${quote.quoteId} · ${this.getEnterpriseQuoteStatusLabel(status)}`)
    },
    createEnterpriseOrder(quote = {}) {
      if (!this.canRbacOperate('quote.manage')) return this.rejectRbacOperation()
      if (quote.status !== 'confirmed') return
      const result = createEnterpriseOrderFromQuote(quote)
      this.enterpriseCommerceState = result.state
      this.recordProjectEnterpriseOperation('创建企业订单', result.order.orderId)
      uni.showToast({ title: '订单已建立', icon: 'success' })
    },
    changeEnterpriseOrderStatus(order = {}, status = 'processing') {
      if (!this.canRbacOperate('finance.manage')) return this.rejectRbacOperation()
      if (!order.orderId || !['pending_payment', 'processing', 'completed', 'closed'].includes(status)) return
      this.enterpriseCommerceState = updateEnterpriseOrderStatus(order.orderId, status)
      this.recordProjectEnterpriseOperation('更新订单状态', `${order.orderId} · ${this.getEnterpriseOrderStatusLabel(status)}`)
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
      this.recordProjectEnterpriseOperation(action, item.targetName)
      uni.showToast({ title: this.getEnterpriseApprovalStatusLabel(status), icon: 'none' })
    },
    refreshEnterpriseProjectForm() {
      const meta = getEnterpriseProjectMeta(this.projectId)
      this.enterpriseProjectMetaVersion += 1
      this.enterpriseProjectForm = {
        projectGoal: meta.projectGoal || '',
        cooperationType: meta.cooperationType || '',
        monthlyStyleCount: meta.monthlyStyleCount || '',
        expectedImageCount: meta.expectedImageCount || '',
        deliveryCycle: meta.deliveryCycle || ''
      }
    },
    changeEnterpriseLeadStatus(event) {
      if (!this.canRbacOperate('customer.manage') && !this.canRbacOperate('project.manage')) return this.rejectRbacOperation()
      const index = Number(event && event.detail ? event.detail.value : 0)
      const leadStatus = this.enterpriseLeadStatusOptions[index] || this.enterpriseLeadStatusOptions[0]
      const current = getEnterpriseProjectMeta(this.projectId)
      const now = new Date().toISOString()
      const followUps = Array.isArray(current.followUps) ? current.followUps : []
      saveEnterpriseProjectMeta(this.projectId, {
        leadStatus,
        leadStatusUpdatedAt: now,
        followUps: [{
          followUpId: `project_stage_${Date.now()}`,
          followUpTime: now,
          followType: '项目变化',
          followUpContent: `商机阶段调整为${leadStatus}`,
          nextAction: leadStatus === '已成交' ? '进入客户持续服务' : '推进下一商业阶段'
        }, ...followUps]
      })
      this.recordProjectEnterpriseOperation('更新商机阶段', leadStatus)
      this.enterpriseProjectMetaVersion += 1
      uni.showToast({ title: '商机阶段已更新', icon: 'success' })
    },
    changeEnterpriseCooperationType(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      this.enterpriseProjectForm.cooperationType = this.enterpriseCooperationTypes[index] || this.enterpriseCooperationTypes[0]
    },
    changeEnterpriseFollowType(event) {
      const index = Number(event && event.detail ? event.detail.value : 0)
      this.enterpriseFollowForm.followType = this.enterpriseFollowTypes[index] || this.enterpriseFollowTypes[0]
    },
    saveEnterpriseProjectValue() {
      if (!this.canRbacEdit('project.edit')) return this.rejectRbacOperation()
      saveEnterpriseProjectMeta(this.projectId, {
        projectGoal: this.enterpriseProjectForm.projectGoal,
        cooperationType: this.enterpriseProjectForm.cooperationType,
        monthlyStyleCount: this.enterpriseProjectForm.monthlyStyleCount,
        expectedImageCount: this.enterpriseProjectForm.expectedImageCount,
        deliveryCycle: this.enterpriseProjectForm.deliveryCycle
      })
      this.recordProjectEnterpriseOperation('更新项目价值', this.enterpriseProjectForm.projectGoal || '项目价值信息')
      this.enterpriseProjectMetaVersion += 1
      uni.showToast({ title: '项目价值已保存', icon: 'success' })
    },
    addEnterpriseFollowUp() {
      if (!this.canRbacOperate('customer.manage')) return this.rejectRbacOperation()
      const content = String(this.enterpriseFollowForm.followUpContent || '').trim()
      if (!content) {
        uni.showToast({ title: '请填写跟进内容', icon: 'none' })
        return
      }
      const current = getEnterpriseProjectMeta(this.projectId)
      const followUps = Array.isArray(current.followUps) ? current.followUps : []
      saveEnterpriseProjectMeta(this.projectId, {
        followUps: [{
          followUpId: `project_follow_${Date.now()}`,
          followUpTime: new Date().toISOString(),
          followType: this.enterpriseFollowForm.followType,
          followUpContent: content,
          nextAction: String(this.enterpriseFollowForm.nextAction || '').trim() || '持续跟进'
        }, ...followUps]
      })
      this.recordProjectEnterpriseOperation('新增销售跟进', `${this.enterpriseFollowForm.followType} · ${content}`)
      this.enterpriseFollowForm = {
        followType: this.enterpriseFollowForm.followType,
        followUpContent: '',
        nextAction: ''
      }
      this.enterpriseProjectMetaVersion += 1
      uni.showToast({ title: '跟进记录已保存', icon: 'success' })
    },
    buildProjectLeadView(lead = null, snapshot = null) {
      const snapshotData = snapshot && typeof snapshot === 'object' ? snapshot : {}
      const liveLead = lead && typeof lead === 'object' ? lead : {}
      const mobile = liveLead.mobile || liveLead.phone || snapshotData.mobile || snapshotData.phone || ''
      const expectedDeliveryDate =
        liveLead.expectedDeliveryDate ||
        liveLead.expectedDeliveryTime ||
        snapshotData.expectedDeliveryDate ||
        snapshotData.expectedDeliveryTime ||
        ''
      const requirementText =
        liveLead.requirementText ||
        liveLead.description ||
        snapshotData.requirementText ||
        snapshotData.description ||
        ''

      if (!Object.keys(liveLead).length && !Object.keys(snapshotData).length) {
        return null
      }

      return {
        ...snapshotData,
        ...liveLead,
        mobile,
        phone: mobile,
        expectedDeliveryDate,
        expectedDeliveryTime: expectedDeliveryDate,
        requirementText,
        description: requirementText,
        attachmentFileIds: Array.isArray(liveLead.attachmentFileIds)
          ? liveLead.attachmentFileIds
          : Array.isArray(snapshotData.attachmentFileIds)
            ? snapshotData.attachmentFileIds
            : [],
        followStatus: liveLead.followStatus || snapshotData.followStatus || 'converted'
      }
    },
    async loadProjectDetail() {
      if (!this.project) {
        this.isLoadingProject = true
      }
      this.projectLoadError = ''

      try {
        let project = null
        this.projectDataSource = 'local'
        this.projectDataFallbackReason = ''

        try {
          project = await getAdminProjectById(this.projectId, { preferCloud: true })
          if (project) {
            this.projectDataSource = 'cloud'
          } else {
            project = getProjectById(this.projectId)
            this.projectDataFallbackReason = 'cloud returned empty project'
          }
        } catch (error) {
          project = getProjectById(this.projectId)
          this.projectDataFallbackReason = (error && error.message) || 'cloud project read failed'
        }

        const enterpriseTeam = getEnterpriseTeamState()
        this.project = project ? normalizeProjectRepositoryRecord(project, {
          enterpriseId: enterpriseTeam.enterpriseId,
          userId: enterpriseTeam.currentMemberId
        }) : project
        this.projectNameInput = project && project.projectName ? project.projectName : ''
        this.refreshEnterpriseProjectForm()
        this.cloudBatches = project && project.projectId
          ? await getAdminBatchList({ projectId: project.projectId, preferCloud: true })
          : []
        this.projectNotes = getProjectNotes(this.projectId)

        if (!project || !project.leadId) {
          this.lead = null
          this.leadDataSource = 'live'
          return
        }

        const liveLead = await getAdminLeadById(project.leadId, { preferCloud: true }) || null
        this.lead = normalizeCustomerRepositoryRecord(this.buildProjectLeadView(liveLead, project.leadSnapshot), {
          enterpriseId: enterpriseTeam.enterpriseId,
          userId: enterpriseTeam.currentMemberId
        })
        this.leadDataSource = liveLead ? 'live' : 'snapshot'
      } catch (error) {
        this.projectLoadError = (error && error.message) || 'unknown'
      } finally {
        this.isLoadingProject = false
        this.hasAttemptedLoad = true
      }
    },
    resolveContextTargetSectionId(mode, reviewContext) {
      if (mode === 'delivery-view') {
        return 'section-deliverable-batch'
      }
      if (mode === 'delivery-review' && reviewContext === 'pending_review') {
        return 'section-pending-review-batch'
      }
      if (mode === 'delivery-review' && reviewContext === 'needs_revision') {
        return 'section-needs-revision-batch'
      }
      return ''
    },
    scheduleContextAutoPosition() {
      if (this.hasAutoPositionedByContext || !this.contextTargetSectionId) {
        return
      }
      this.$nextTick(() => {
        setTimeout(() => {
          this.scrollToSection(this.contextTargetSectionId)
        }, 120)
      })
    },
    scrollToSection(sectionId) {
      if (!sectionId) {
        return
      }
      uni.pageScrollTo({
        selector: `#${sectionId}`,
        duration: 280,
        fail: () => {
          uni.pageScrollTo({
            selector: '#section-delivery-ops',
            duration: 220
          })
        },
        complete: () => {
          this.hasAutoPositionedByContext = true
        }
      })
    },
    formatScope(scope) {
      if (!Array.isArray(scope) || !scope.length) {
        return '暂无'
      }
      return scope.join(', ')
    },
    formatAttachmentFileIds(fileIds) {
      if (!Array.isArray(fileIds) || !fileIds.length) {
        return 'None'
      }
      return `${fileIds.length} file(s)`
    },
    async saveProjectName() {
      if (!this.canRbacEdit('project.edit')) return this.rejectRbacOperation()
      if (!this.project || !this.project.projectId) {
        return
      }

      const projectName = String(this.projectNameInput || '').trim()
      if (!projectName) {
        uni.showToast({
          title: '请输入项目名称',
          icon: 'none'
        })
        return
      }

      try {
        const updatedProject = await updateAdminProject(this.project.projectId, { projectName }, { preferCloud: true })
        if (updatedProject) {
          this.project = {
            ...this.project,
            ...updatedProject
          }
          this.projectNameInput = updatedProject.projectName || projectName
        }
        uni.showToast({
          title: '项目名称已更新',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '更新项目名称失败',
          icon: 'none'
        })
      }
    },
    getLeadFollowStatusLabel,
    getProjectStatusLabel,
    getProjectStageLabel,
    formatBatchIds(batchIds) {
      if (!Array.isArray(batchIds) || !batchIds.length) {
        return '暂无'
      }
      return batchIds.join(', ')
    },
    formatProgress(progress) {
      if (typeof progress !== 'number') {
        return '暂无'
      }
      return `${progress}%`
    },
    getTaskTimeValue(task) {
      return (task && (task.completedAt || task.updatedAt || task.submittedAt || task.createdAt)) || ''
    },
    getTaskTime(task) {
      return this.getTaskTimeValue(task) || '暂无'
    },
    hasTaskResult(task) {
      return !!(
        (task && task.result && task.result.coverUrl) ||
        (task && task.result && Array.isArray(task.result.items) && task.result.items.length)
      )
    },
    getOriginalProtectionPackageActionText(task) {
      const validation = canCreateOriginalProtectionPackage(task)
      return validation.ok ? '可生成草稿' : validation.reasonText
    },
    createOriginalProtectionPackageForTask(task) {
      const validation = canCreateOriginalProtectionPackage(task)
      const taskId = task && (task.taskId || task.id || task.clientTaskId)
      if (!validation.ok) {
        console.warn('[original-protection] blocked', {
          taskId: taskId || '',
          reason: validation.reason,
          reasonText: validation.reasonText
        })
        uni.showToast({
          title: validation.reasonText || '暂不可生成材料包',
          icon: 'none'
        })
        return
      }

      const result = createOriginalProtectionPackageDraftFromTask(task, this.project || {}, {})
      if (!result || !result.ok) {
        console.warn('[original-protection] blocked', {
          taskId: taskId || '',
          reason: (result && result.reason) || '',
          reasonText: (result && result.reasonText) || ''
        })
        uni.showToast({
          title: (result && result.reasonText) || '暂不可生成材料包',
          icon: 'none'
        })
        return
      }

      const draft = result.package || {}
      console.log('[original-protection] draft created', {
        packageId: draft.packageId || '',
        taskId: taskId || '',
        projectId: (draft.project && draft.project.projectId) || '',
        status: draft.status || ''
      })
      uni.showToast({
        title: '原创保护材料包草稿已生成',
        icon: 'none'
      })
    },
    getBatchReviewableTasks(batch) {
      const byId = (this.chainState.tasks && this.chainState.tasks.byId) || {}
      const taskIds = Array.isArray(batch && batch.taskIds) ? batch.taskIds : []
      return taskIds
        .map((taskId) => byId[taskId])
        .filter((task) => task && this.hasTaskResult(task))
    },
    getBatchDeliveryReviewLabel(batch) {
      const reviewableTasks = this.getBatchReviewableTasks(batch)
      const readyCount = reviewableTasks.length
      const approvedCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'approved').length
      const needsRevisionCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision').length
      const pendingReviewCount = readyCount - approvedCount - needsRevisionCount

      if (readyCount === 0) {
        return 'pending_review'
      }
      if (needsRevisionCount > 0) {
        return 'revision_required'
      }
      if (approvedCount === readyCount && readyCount > 0) {
        return 'ready_to_deliver'
      }
      if (approvedCount > 0 && pendingReviewCount > 0) {
        return 'partially_reviewed'
      }
      return 'pending_review'
    },
    getBatchDeliveryCounts(batch) {
      const reviewableTasks = this.getBatchReviewableTasks(batch)
      const readyCount = reviewableTasks.length
      const approvedCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'approved').length
      const needsRevisionCount = reviewableTasks.filter((task) => (task.deliveryStatus || 'pending_review') === 'needs_revision').length
      const pendingReviewCount = Math.max(0, readyCount - approvedCount - needsRevisionCount)
      return {
        readyCount,
        approvedCount,
        needsRevisionCount,
        pendingReviewCount
      }
    },
    getBatchSortTime(batch) {
      return new Date((batch && (batch.updatedAt || batch.createdAt)) || '').getTime() || 0
    },
    getSortedBatchesForGroup(groupKey = '') {
      let base = []
      if (groupKey === 'deliverable') {
        base = this.getBatchesByDeliveryLabel('ready_to_deliver')
      } else if (groupKey === 'pending_review') {
        base = this.getPendingReviewGroupBatches()
      } else if (groupKey === 'needs_revision') {
        base = this.getBatchesByDeliveryLabel('revision_required')
      }

      return [...base].sort((left, right) => {
        const leftCounts = this.getBatchDeliveryCounts(left)
        const rightCounts = this.getBatchDeliveryCounts(right)

        if (groupKey === 'pending_review') {
          if (rightCounts.pendingReviewCount !== leftCounts.pendingReviewCount) {
            return rightCounts.pendingReviewCount - leftCounts.pendingReviewCount
          }
        } else if (groupKey === 'needs_revision') {
          if (rightCounts.needsRevisionCount !== leftCounts.needsRevisionCount) {
            return rightCounts.needsRevisionCount - leftCounts.needsRevisionCount
          }
        } else if (groupKey === 'deliverable') {
          if (rightCounts.readyCount !== leftCounts.readyCount) {
            return rightCounts.readyCount - leftCounts.readyCount
          }
        }

        return this.getBatchSortTime(right) - this.getBatchSortTime(left)
      })
    },
    getLatestBatchByLabel(label) {
      const matched = this.getBatchesByDeliveryLabel(label)
      if (!matched.length) {
        return null
      }
      return [...matched].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime() || 0
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime() || 0
        return rightTime - leftTime
      })[0]
    },
    getBatchesByDeliveryLabel(label) {
      return this.relatedBatches.filter((batch) => this.getBatchDeliveryReviewLabel(batch) === label)
    },
    getPendingReviewGroupBatches() {
      return this.relatedBatches.filter((batch) => {
        const label = this.getBatchDeliveryReviewLabel(batch)
        return label === 'pending_review' || label === 'partially_reviewed'
      })
    },
    isFocusedDeliveryGroup(groupKey) {
      if (!this.hasDeliveryEntryContext) {
        return false
      }
      return this.effectiveDeliveryFocusKey === groupKey
    },
    getVisibleGroupBatches(group) {
      const batches = Array.isArray(group && group.batches) ? group.batches : []
      if (!this.hasDeliveryEntryContext) {
        return batches
      }
      if (this.isFocusedDeliveryGroup(group.key)) {
        return batches
      }
      return batches.slice(0, this.compactGroupLimit)
    },
    isRecommendedBatch(groupKey, batch) {
      if (!batch || !batch.batchId || !this.focusedTopBatch) {
        return false
      }
      if (groupKey !== this.effectiveDeliveryFocusKey) {
        return false
      }
      return batch.batchId === this.focusedTopBatch.batchId
    },
    focusBatchGroup(groupKey) {
      this.deliveryManualFocusGroup = groupKey || ''
      this.$nextTick(() => {
        this.scrollToSection('section-delivery-groups')
      })
    },
    resolveProjectReviewActionTarget(actionType = '') {
      if (actionType === 'approve_deliverable_batches_in_project') {
        return {
          batch: this.topDeliverableBatch || this.latestDeliverableBatch || this.latestBatch || null,
          mode: 'delivery-view',
          reviewContext: ''
        }
      }
      if (actionType === 'mark_pending_review_batches_as_needs_revision_in_project') {
        return {
          batch: this.topNeedsRevisionBatch || this.latestNeedsRevisionBatch || this.topPendingReviewBatch || this.latestPendingReviewBatch || this.latestBatch || null,
          mode: 'delivery-review',
          reviewContext: 'needs_revision'
        }
      }
      return {
        batch: this.latestBatch || null,
        mode: '',
        reviewContext: ''
      }
    },
    openLatestProjectReviewAction() {
      if (!this.latestProjectReviewActionTarget || !this.latestProjectReviewActionTarget.batch) {
        uni.showToast({
          title: '暂无关联批次',
          icon: 'none'
        })
        return
      }
      this.goToBatchDetailWithContext(
        this.latestProjectReviewActionTarget.batch,
        this.latestProjectReviewActionTarget.mode,
        this.latestProjectReviewActionTarget.reviewContext
      )
    },
    openProjectReviewAction(item) {
      const target = item && item.resolvedTarget
      if (!target || !target.batch || !target.batch.batchId) {
        uni.showToast({
          title: '暂无关联批次',
          icon: 'none'
        })
        return
      }
      this.goToBatchDetailWithContext(target.batch, target.mode || '', target.reviewContext || '')
    },
    isSuccessTask(task) {
      return !!task && task.status === 'success'
    },
    isProcessingTask(task) {
      return !!task && ['submitted', 'queued', 'processing'].includes(task.status)
    },
    isFailedTask(task) {
      return !!task && ['failed', 'error', 'timeout'].includes(task.status)
    },
    async approveDeliverableBatchesInProject() {
      await this.runProjectBatchReviewAction('approve_deliverable_batches_in_project')
    },
    async markPendingReviewBatchesAsNeedsRevisionInProject() {
      await this.runProjectBatchReviewAction('mark_pending_review_batches_as_needs_revision_in_project')
    },
    async runProjectBatchReviewAction(actionKey = '') {
      if (!this.canRbacOperate('delivery.manage')) return this.rejectRbacOperation()
      if (!this.project || !this.project.projectId) {
        uni.showToast({
          title: '未找到项目',
          icon: 'none'
        })
        return
      }
      if (this.isProjectBatchReviewing) {
        return
      }

      const isApproveAction = actionKey === 'approve_deliverable_batches_in_project'
      const isMarkNeedsRevisionAction = actionKey === 'mark_pending_review_batches_as_needs_revision_in_project'
      const targetBatches = isApproveAction ? this.sortedDeliverableBatches : (isMarkNeedsRevisionAction ? this.sortedPendingReviewBatches : [])

      if (!targetBatches.length) {
        uni.showToast({
          title: '暂无目标批次',
          icon: 'none'
        })
        return
      }

      this.isProjectBatchReviewing = true
      try {
        let successBatchCount = 0
        let skippedBatchCount = 0
        let failedBatchCount = 0
        let syncFailedTaskCount = 0

        for (const batch of targetBatches) {
          // eslint-disable-next-line no-await-in-loop
          const result = await this.runProjectBatchReviewActionForBatch(batch, actionKey)
          if (result.batchStatus === 'success') {
            successBatchCount += 1
          } else if (result.batchStatus === 'skipped') {
            skippedBatchCount += 1
          } else {
            failedBatchCount += 1
          }
          syncFailedTaskCount += Number(result.syncFailedTaskCount || 0)
        }

        this.chainState = getMainChainState()
        this.loadProjectDetail()

        const now = new Date().toISOString()
        this.projectBatchReviewSummary = {
          action: actionKey,
          processedBatchCount: targetBatches.length,
          successBatchCount,
          skippedBatchCount,
          failedBatchCount,
          syncFailedTaskCount,
          updatedAt: now
        }

        try {
          appendProjectNote(
            this.project.projectId,
            `[${actionKey}] processed=${targetBatches.length}, success=${successBatchCount}, skipped=${skippedBatchCount}, failed=${failedBatchCount}, syncFailedTasks=${syncFailedTaskCount}`
          )
          this.projectNotes = getProjectNotes(this.project.projectId)
        } catch (error) {
          // keep minimal and do not block main workflow when note append fails
        }

        uni.showToast({
          title: `已处理 ${targetBatches.length}，成功 ${successBatchCount}，跳过 ${skippedBatchCount}，失败 ${failedBatchCount}`,
          icon: 'none'
        })
      } finally {
        this.isProjectBatchReviewing = false
      }
    },
    async runProjectBatchReviewActionForBatch(batch, actionKey = '') {
      if (!batch || !batch.batchId) {
        return {
          batchStatus: 'failed',
          syncFailedTaskCount: 0
        }
      }

      try {
        const state = getMainChainState()
        const tasks = state.tasks || {}
        const byId = tasks.byId || {}
        const now = new Date().toISOString()

        const nextById = {
          ...byId
        }
        const changedTasks = []
        const changedTaskIds = []

        const taskIds = Array.isArray(batch.taskIds) ? batch.taskIds : []
        taskIds.forEach((taskId) => {
          const currentTask = byId[taskId]
          if (!currentTask || !currentTask.taskId) {
            return
          }

          const hasResult = this.hasTaskResult(currentTask)
          const deliveryStatus = (currentTask.deliveryStatus || 'pending_review')

          if (actionKey === 'approve_deliverable_batches_in_project') {
            const isDeliverable = this.isSuccessTask(currentTask) && hasResult
            if (!isDeliverable || deliveryStatus !== 'pending_review') {
              return
            }
            nextById[currentTask.taskId] = {
              ...currentTask,
              deliveryStatus: 'approved',
              deliveryConfirmedAt: now,
              deliveryNote: 'Approved in project quick action'
            }
          } else if (actionKey === 'mark_pending_review_batches_as_needs_revision_in_project') {
            if (!hasResult || deliveryStatus !== 'pending_review') {
              return
            }
            nextById[currentTask.taskId] = {
              ...currentTask,
              deliveryStatus: 'needs_revision',
              deliveryConfirmedAt: now,
              deliveryNote: 'Marked as needs revision in project quick action'
            }
          } else {
            return
          }

          changedTasks.push(nextById[currentTask.taskId])
          changedTaskIds.push(currentTask.taskId)
        })

        if (!changedTaskIds.length) {
          return {
            batchStatus: 'skipped',
            syncFailedTaskCount: 0
          }
        }

        patchMainChainState({
          tasks: {
            ...tasks,
            byId: nextById
          }
        })

        appendDeliveryAudits(
          changedTaskIds.map((taskId) =>
            createDeliveryAudit(
              actionKey,
              taskId,
              `项目 ${this.project.projectId} 对批次 ${batch.batchId} 执行快捷操作`,
              {
                createdAt: now,
                batchId: batch.batchId || '',
                projectId: this.project.projectId || ''
              }
            )
          )
        )

        const syncResults = await Promise.allSettled(
          changedTasks.map((task) =>
            syncTaskDeliveryStatus({
              taskId: task.taskId,
              deliveryStatus: task.deliveryStatus || 'pending_review',
              deliveryConfirmedAt: task.deliveryConfirmedAt || now,
              deliveryNote: task.deliveryNote || ''
            })
          )
        )

        const syncFailedPairs = syncResults
          .map((item, index) => ({
            item,
            task: changedTasks[index]
          }))
          .filter((pair) => pair.item.status === 'rejected' && pair.task && pair.task.taskId)

        if (syncFailedPairs.length) {
          appendDeliveryQueueItems(
            syncFailedPairs.map((pair) => ({
              taskId: pair.task.taskId,
              type: 'sync',
              payload: {
                taskId: pair.task.taskId,
                deliveryStatus: pair.task.deliveryStatus || 'pending_review',
                deliveryConfirmedAt: pair.task.deliveryConfirmedAt || now,
                deliveryNote: pair.task.deliveryNote || '',
                batchId: batch.batchId || '',
                projectId: this.project.projectId || '',
                reason: (pair.item.reason && pair.item.reason.message) || 'delivery sync failed'
              },
              status: 'pending'
            }))
          )
        }

        return {
          batchStatus: 'success',
          syncFailedTaskCount: syncFailedPairs.length
        }
      } catch (error) {
        return {
          batchStatus: 'failed',
          syncFailedTaskCount: 0
        }
      }
    },
    goToProjectList() {
      uni.navigateBack({
        delta: 1
      })
    },
    goToCreateTask() {
      if (!this.project || !this.project.projectId) {
        uni.showToast({
          title: '未找到项目',
          icon: 'none'
        })
        return
      }

      uni.navigateTo({
        url: `/package-ai/upload/upload?projectId=${encodeURIComponent(this.project.projectId)}`
      })
    },
    async createBatchForProject() {
      if (!this.project || !this.project.projectId) {
        uni.showToast({
          title: '未找到项目',
          icon: 'none'
        })
        return
      }

      const batch = createBatch({
        projectId: this.project.projectId,
        batchName: `${this.project.projectName || '项目'} 批次`,
        status: 'draft',
        taskIds: []
      })

      appendBatchToProject(this.project.projectId, batch.batchId)
      console.log('[project-detail:create-batch] created', {
        projectId: this.project.projectId,
        batchId: batch.batchId,
        taskIdsCount: Array.isArray(batch.taskIds) ? batch.taskIds.length : 0
      })

      try {
        console.log('[project-detail:create-batch] sync start', {
          batchId: batch.batchId,
          projectId: this.project.projectId
        })
        const result = await syncAdminBatchToCloud(batch.batchId)
        console.log('[project-detail:create-batch] sync done', {
          batchId: batch.batchId,
          success: !!result,
          result
        })
      } catch (error) {
        console.error('[project-detail:create-batch] sync failed', {
          batchId: batch.batchId,
          message: (error && error.message) || 'unknown'
        })
      }

      this.loadProjectDetail()

      uni.showToast({
        title: '批次已创建',
        icon: 'success'
      })
    },
    goToBatchDetail(batch) {
      if (!batch || !batch.batchId) {
        uni.showToast({
          title: '未找到批次',
          icon: 'none'
        })
        return
      }

      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?batchId=${encodeURIComponent(batch.batchId)}`
      })
    },
    goToBatchDetailWithContext(batch, mode = '', reviewContext = '') {
      if (mode === 'delivery-review' && !this.canRbacOperate('delivery.manage')) return this.rejectRbacOperation()
      if (mode === 'delivery-view' && !this.canRbacView('delivery.view')) return this.rejectRbacOperation()
      if (!batch || !batch.batchId) {
        uni.showToast({
          title: '未找到批次',
          icon: 'none'
        })
        return
      }
      const query = [`batchId=${encodeURIComponent(batch.batchId)}`]
      if (mode) {
        query.push(`mode=${encodeURIComponent(mode)}`)
      }
      if (reviewContext) {
        query.push(`reviewContext=${encodeURIComponent(reviewContext)}`)
      }
      uni.navigateTo({
        url: `/package-mobile-enterprise/batch-detail/batch-detail?${query.join('&')}`
      })
    },
    triggerPriorityBatchAction() {
      if (this.priorityBatchGroup === 'needs_revision' && this.topNeedsRevisionBatch) {
        this.goToBatchDetailWithContext(this.topNeedsRevisionBatch, 'delivery-review', 'needs_revision')
        return
      }
      if (this.priorityBatchGroup === 'pending_review' && this.topPendingReviewBatch) {
        this.goToBatchDetailWithContext(this.topPendingReviewBatch, 'delivery-review', 'pending_review')
        return
      }
      if (this.priorityBatchGroup === 'deliverable' && this.topDeliverableBatch) {
        this.goToBatchDetailWithContext(this.topDeliverableBatch, 'delivery-view', '')
        return
      }
      uni.showToast({
        title: '暂无可处理的优先批次',
        icon: 'none'
      })
    },
    openPriorityBatchSnapshot() {
      if (!this.priorityRecommendedBatch) {
        return
      }
      if (this.priorityBatchGroup === 'needs_revision') {
        this.goToBatchDetailWithContext(this.priorityRecommendedBatch, 'delivery-review', 'needs_revision')
        return
      }
      if (this.priorityBatchGroup === 'pending_review') {
        this.goToBatchDetailWithContext(this.priorityRecommendedBatch, 'delivery-review', 'pending_review')
        return
      }
      if (this.priorityBatchGroup === 'deliverable') {
        this.goToBatchDetailWithContext(this.priorityRecommendedBatch, 'delivery-view', '')
        return
      }
      this.goToBatchDetail(this.priorityRecommendedBatch)
    },
    goToTaskDetail(task) {
      if (!task || !task.taskId) {
        uni.showToast({
          title: '未找到任务',
          icon: 'none'
        })
        return
      }

      patchMainChainState({
        currentTaskId: task.taskId
      })

      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}`
      })
    },
    addProjectNote() {
      if (!this.projectId) {
        return
      }

      const content = String(this.projectNoteInput || '').trim()
      if (!content) {
        uni.showToast({
          title: 'Note content is required',
          icon: 'none'
        })
        return
      }

      try {
        appendProjectNote(this.projectId, content)
        this.projectNoteInput = ''
        this.projectNotes = getProjectNotes(this.projectId)
        uni.showToast({
          title: 'Note added',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : 'Add note failed',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f6f6f9;
  padding: 24rpx;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.customer-portal {
  display: grid;
  gap: 20rpx;
  color: #111827;
}

.customer-portal-hero {
  padding: 28rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
  box-shadow: 0 18rpx 48rpx rgba(15, 23, 42, 0.07);
}

.customer-portal-kicker,
.customer-portal-title,
.customer-portal-subtitle,
.customer-portal-section-title {
  display: block;
}

.customer-portal-kicker {
  color: #4f46e5;
  font-size: 20rpx;
  font-weight: 800;
}

.customer-portal-title {
  margin-top: 8rpx;
  font-size: 38rpx;
  font-weight: 900;
}

.customer-portal-subtitle {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.customer-portal-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 24rpx;
}

.customer-portal-metrics view {
  padding: 16rpx 10rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.78);
  text-align: center;
}

.customer-portal-metrics text {
  display: block;
  color: #6b7280;
  font-size: 19rpx;
}

.customer-portal-metrics text:first-child {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.customer-portal-section {
  padding: 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 14rpx 38rpx rgba(15, 23, 42, 0.05);
}

.customer-portal-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.customer-portal-section-head text:first-child,
.customer-portal-section-title {
  font-size: 27rpx;
  font-weight: 900;
}

.customer-portal-section-head text:last-child {
  color: #4f46e5;
  font-size: 20rpx;
  font-weight: 800;
}

.customer-product-list {
  display: grid;
  gap: 16rpx;
}

.customer-product-card {
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.customer-product-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 24rpx;
  font-weight: 850;
}

.customer-asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.customer-asset-item {
  overflow: hidden;
  border-radius: 14rpx;
  background: #ffffff;
}

.customer-asset-item image,
.customer-asset-placeholder {
  width: 100%;
  height: 210rpx;
}

.customer-asset-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f1f5f9, #eef2ff);
  color: #94a3b8;
  font-size: 20rpx;
}

.customer-asset-item > text {
  display: block;
  padding: 10rpx 12rpx;
  font-size: 19rpx;
  font-weight: 750;
}

.customer-product-types,
.customer-feedback-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.customer-product-types text,
.customer-feedback-types text {
  padding: 7rpx 11rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #64748b;
  font-size: 18rpx;
}

.customer-feedback-types text.active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 800;
}

.customer-portal-section > textarea {
  box-sizing: border-box;
  width: 100%;
  height: 150rpx;
  margin-top: 14rpx;
  padding: 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #f8fafc;
  font-size: 21rpx;
}

.customer-feedback-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.customer-feedback-actions button {
  margin: 0;
  border-radius: 15rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 21rpx;
}

.customer-feedback-actions button.secondary {
  background: #ffffff;
  color: #4338ca;
  border: 1rpx solid #c7d2fe;
}

.customer-feedback-history {
  display: grid;
  gap: 12rpx;
  margin-top: 16rpx;
}

.customer-feedback-history > view {
  padding: 15rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.customer-feedback-history text {
  display: block;
  color: #64748b;
  font-size: 19rpx;
}

.customer-feedback-history > view > view {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  color: #111827;
  font-weight: 850;
}

.customer-portal-empty,
.customer-product-empty,
.customer-portal-unavailable {
  color: #94a3b8;
  font-size: 21rpx;
}

.customer-portal-unavailable {
  display: grid;
  gap: 10rpx;
  padding: 80rpx 30rpx;
  border-radius: 24rpx;
  background: #ffffff;
  text-align: center;
}

.customer-portal-unavailable text:first-child {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.section-card,
.empty-state {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
  margin-bottom: 12rpx;
}

.enterprise-closure-card {
  border: 1rpx solid #e5e7eb;
  box-shadow: 0 12rpx 34rpx rgba(15, 23, 42, 0.05);
}

.project-team-card {
  border: 1rpx solid #e5e7eb;
}

.project-team-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.project-team-picker {
  width: auto;
  min-width: 160rpx;
}

.project-enterprise-plan {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}

.project-enterprise-plan > view {
  padding: 14rpx 8rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  text-align: center;
}

.project-enterprise-plan text {
  display: block;
  color: #64748b;
  font-size: 17rpx;
}

.project-enterprise-plan text:first-child {
  color: #111827;
  font-size: 22rpx;
  font-weight: 900;
}

.project-enterprise-usage {
  margin-top: 16rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8f9ff;
}

.project-enterprise-usage > view {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
}

.project-enterprise-usage > view text {
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #475569;
  font-size: 18rpx;
}

.project-team-members {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150rpx, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.project-team-members view {
  padding: 14rpx;
  border: 1rpx solid transparent;
  border-radius: 14rpx;
  background: #f8fafc;
}

.project-team-members view.active {
  border-color: #a5b4fc;
  background: #eef2ff;
}

.project-team-members text {
  display: block;
  color: #64748b;
  font-size: 19rpx;
}

.project-team-members text:first-child {
  color: #111827;
  font-size: 22rpx;
  font-weight: 850;
}

.project-team-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.project-team-permissions text {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #64748b;
  font-size: 18rpx;
}

.project-team-logs {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #eef2f7;
}

.project-team-logs > view > view {
  display: grid;
  grid-template-columns: 130rpx 210rpx minmax(0, 1fr);
  gap: 12rpx;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 19rpx;
}

.project-team-logs > view > view text:first-child {
  color: #111827;
  font-weight: 800;
}

.project-customer-message-panel {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #eef2f7;
}

.project-customer-message-row {
  display: grid;
  gap: 8rpx;
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  color: #64748b;
  font-size: 18rpx;
}

.project-customer-message-row > view:first-child {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  color: #111827;
  font-weight: 850;
}

.project-customer-message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8rpx;
}

.project-customer-message-actions text {
  padding: 7rpx 10rpx;
  border-radius: 10rpx;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 800;
}

.project-approval-card {
  border: 1rpx solid #e5e7eb;
}

.project-approval-count {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 18rpx;
  font-weight: 800;
}

.project-approval-card > textarea {
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  margin-top: 16rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #f8fafc;
  font-size: 20rpx;
}

.project-approval-list {
  display: grid;
  gap: 10rpx;
  margin-top: 14rpx;
}

.project-approval-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
}

.project-approval-item > view:first-child text {
  display: block;
  color: #64748b;
  font-size: 19rpx;
}

.project-approval-item > view:first-child text:first-child {
  color: #111827;
  font-size: 22rpx;
  font-weight: 850;
}

.project-approval-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
}

.project-approval-actions text {
  padding: 8rpx 13rpx;
  border-radius: 11rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 18rpx;
  font-weight: 800;
}

.project-approval-actions text.danger {
  background: #fef2f2;
  color: #dc2626;
}

.project-approval-timeline {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #eef2f7;
}

.project-approval-timeline > view > view {
  display: grid;
  grid-template-columns: 150rpx 210rpx minmax(0, 1fr);
  gap: 10rpx;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 19rpx;
}

.project-approval-timeline > view > view text:nth-child(4) {
  grid-column: 1 / -1;
  color: #475569;
}

.enterprise-closure-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.enterprise-lead-status {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 20rpx;
  font-weight: 800;
}

.enterprise-stage-control {
  flex-shrink: 0;
  text-align: right;
}

.enterprise-stage-control > text {
  display: block;
  margin-top: 8rpx;
  color: #94a3b8;
  font-size: 18rpx;
}

.enterprise-customer-grid,
.enterprise-value-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 22rpx;
}

.enterprise-customer-grid view,
.enterprise-value-panel view {
  min-width: 0;
  padding: 18rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.enterprise-value-panel .wide {
  grid-column: 1 / -1;
}

.enterprise-value-editor,
.enterprise-follow-editor {
  display: grid;
  gap: 14rpx;
  margin-top: 20rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
}

.enterprise-value-editor input,
.enterprise-follow-editor input,
.enterprise-follow-editor textarea,
.enterprise-picker-value {
  width: 100%;
  min-height: 72rpx;
  padding: 16rpx 18rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  color: #334155;
  font-size: 22rpx;
  box-sizing: border-box;
}

.enterprise-follow-editor textarea {
  min-height: 140rpx;
}

.enterprise-value-inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.enterprise-save-btn {
  min-height: 72rpx;
  margin: 0;
  border-radius: 14rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 23rpx;
  font-weight: 800;
  line-height: 72rpx;
}

.enterprise-save-btn::after {
  border: 0;
}

.enterprise-event-timeline {
  margin-top: 26rpx;
  padding: 4rpx 0;
}

.enterprise-event-item {
  position: relative;
  display: grid;
  grid-template-columns: 22rpx 180rpx minmax(0, 1fr);
  gap: 14rpx;
  min-height: 84rpx;
  color: #94a3b8;
}

.enterprise-event-item::before {
  position: absolute;
  top: 22rpx;
  bottom: -8rpx;
  left: 9rpx;
  width: 3rpx;
  background: #e5e7eb;
  content: '';
}

.enterprise-event-item:last-child::before {
  display: none;
}

.enterprise-event-item .timeline-dot {
  position: relative;
  z-index: 1;
  width: 20rpx;
  height: 20rpx;
  margin-top: 4rpx;
  border: 4rpx solid #ffffff;
  border-radius: 50%;
  background: #d1d5db;
  box-sizing: border-box;
}

.enterprise-event-item.completed .timeline-dot {
  background: #4f46e5;
}

.enterprise-event-time {
  font-size: 19rpx;
  line-height: 28rpx;
}

.enterprise-event-item view text {
  display: block;
  color: #111827;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 28rpx;
}

.enterprise-event-item view text:last-child {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 20rpx;
  font-weight: 400;
  line-height: 1.45;
}

.enterprise-customer-grid text,
.enterprise-value-panel text {
  display: block;
  color: #6b7280;
  font-size: 21rpx;
}

.enterprise-customer-grid text:last-child,
.enterprise-value-panel text:last-child {
  overflow: hidden;
  margin-top: 8rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 800;
  line-height: 1.4;
  text-overflow: ellipsis;
}

.enterprise-project-timeline {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 28rpx;
}

.enterprise-project-timeline > view {
  position: relative;
  min-width: 0;
  color: #9ca3af;
  text-align: center;
}

.enterprise-project-timeline > view::before {
  position: absolute;
  top: 10rpx;
  right: 50%;
  left: -50%;
  height: 3rpx;
  background: #e5e7eb;
  content: '';
}

.enterprise-project-timeline > view:first-child::before {
  display: none;
}

.enterprise-project-timeline .timeline-dot {
  position: relative;
  z-index: 1;
  display: block;
  width: 18rpx;
  height: 18rpx;
  margin: 0 auto 10rpx;
  border: 4rpx solid #ffffff;
  border-radius: 50%;
  background: #d1d5db;
}

.enterprise-project-timeline > view.completed::before,
.enterprise-project-timeline > view.completed .timeline-dot,
.enterprise-project-timeline > view.active .timeline-dot {
  background: #4f46e5;
}

.enterprise-project-timeline > view > text:nth-child(2) {
  display: block;
  color: #374151;
  font-size: 22rpx;
  font-weight: 800;
}

.enterprise-project-timeline > view > text:last-child {
  display: block;
  margin-top: 6rpx;
  padding: 0 4rpx;
  font-size: 18rpx;
  line-height: 1.35;
}

.enterprise-follow-list {
  margin-top: 26rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid #eef2f7;
}

.enterprise-follow-item {
  display: grid;
  grid-template-columns: 190rpx minmax(0, 1fr);
  gap: 16rpx;
  margin-top: 16rpx;
  color: #94a3b8;
  font-size: 20rpx;
}

.enterprise-follow-item view text {
  display: block;
  color: #334155;
  line-height: 1.45;
}

.enterprise-follow-item view text:last-child {
  margin-top: 6rpx;
  color: #6366f1;
}

.entry-context-hint {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: #1677ff;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.create-task-btn {
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
  padding: 0 20rpx;
}

.create-task-btn[disabled],
.back-btn[disabled] {
  opacity: 0.55;
}

.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 12rpx;
}

.summary-item {
  min-width: 200rpx;
  flex: 1;
  background: #f8fafc;
  border-radius: 20rpx;
  padding: 20rpx;
}

.summary-label {
  display: block;
  font-size: 22rpx;
  color: #888;
}

.summary-value {
  display: block;
  margin-top: 10rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #222;
}

.summary-value.success {
  color: #16a34a;
}

.summary-value.processing {
  color: #1677ff;
}

.summary-value.failed {
  color: #ff4d4f;
}

.delivery-batch-groups {
  margin-top: 16rpx;
}

.group-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
  margin-bottom: 10rpx;
}

.quick-actions-block {
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f5f7fa;
}

.quick-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.quick-action-btn {
  min-width: 250rpx;
  font-size: 22rpx;
}

.quick-action-btn.warning {
  background: #ff4d4f;
  color: #fff;
}

.quick-action-btn.success {
  background: #16a34a;
  color: #fff;
}

.group-card {
  margin-top: 12rpx;
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 16rpx;
}

.group-card.focused {
  border: 1rpx solid #1677ff;
}

.group-card.muted {
  opacity: 0.78;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.group-name {
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
}

.group-count {
  font-size: 22rpx;
  color: #666;
}

.group-list {
  margin-top: 10rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.group-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 12rpx;
}

.group-item.recommended {
  border: 1rpx solid #16a34a;
  box-shadow: 0 0 0 1rpx rgba(22, 163, 74, 0.1);
}

.group-item-line {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #444;
  word-break: break-all;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 12rpx;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}

.task-card {
  background: #f8fafc;
  border-radius: 20rpx;
  padding: 20rpx;
}

.batch-card {
  background: #f8fafc;
  border-radius: 20rpx;
  padding: 20rpx;
}

.task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.task-id {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
  word-break: break-all;
}

.task-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #888;
}

.task-status {
  padding: 8rpx 16rpx;
  background: #e6f4ff;
  border-radius: 999rpx;
  color: #1677ff;
  font-size: 22rpx;
}

.task-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #444;
  word-break: break-all;
}

.link-block {
  margin-top: 14rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.link-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
  margin-bottom: 8rpx;
}

.quick-link-btn {
  margin-top: 10rpx;
}

.deliverable-actions-row {
  margin-top: 12rpx;
}

.review-summary-block {
  border: 1rpx solid #dbeafe;
  background: #f8fbff;
}

.review-summary-block.review-summary-success {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.review-summary-block.review-summary-warning {
  border-color: #fed7aa;
  background: #fff7ed;
}

.review-summary-last-action {
  font-weight: 600;
}

.review-summary-source-badge {
  display: inline-block;
  margin-left: 6rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: #1677ff;
  background: #e6f4ff;
}

.review-summary-grid {
  margin-top: 8rpx;
}

.review-summary-item {
  min-width: 180rpx;
}

.review-summary-value.skipped {
  color: #d97706;
}

.review-summary-time {
  margin-top: 14rpx;
}

.review-summary-empty {
  border: 1rpx dashed #d0d7de;
  background: #fafafa;
}

.review-history-block {
  margin-top: 12rpx;
}

.review-history-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.review-history-item {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #fff;
}

.note-input {
  width: 100%;
  min-height: 140rpx;
  margin-top: 12rpx;
  padding: 16rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #f8fafc;
  font-size: 24rpx;
  color: #333;
}

.note-btn {
  margin-top: 12rpx;
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.note-item {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 16rpx;
}

.note-content {
  display: block;
  font-size: 24rpx;
  color: #333;
  line-height: 1.6;
}

.note-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #888;
}

.task-thumb {
  width: 160rpx;
  height: 160rpx;
  margin-top: 16rpx;
  border-radius: 16rpx;
}

.info-line,
.info-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #444;
  word-break: break-all;
  line-height: 1.6;
}

.project-basic-edit-row {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
  align-items: center;
}

.project-name-input {
  flex: 1;
  min-width: 0;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: #f5f7fa;
  font-size: 24rpx;
  color: #333;
  box-sizing: border-box;
}

.project-basic-save-btn {
  flex-shrink: 0;
}

.source-badge {
  display: inline-block;
  margin-top: 8rpx;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f4f6f8;
  color: #666;
  font-size: 22rpx;
}

.loading-state {
  padding: 32rpx 24rpx;
  text-align: center;
  color: #666;
  font-size: 24rpx;
}

.empty-state {
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #222;
}

.empty-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #888;
}

.back-btn {
  margin-top: 24rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}

.retry-btn {
  margin-top: 20rpx;
  background: #f5f5f5;
  color: #333;
  border-radius: 999rpx;
}
.project-commerce-card {
  border: 1rpx solid rgba(79, 70, 229, 0.1);
  box-shadow: 0 14rpx 36rpx rgba(15, 23, 42, 0.06);
}

.project-commerce-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 20rpx;
}

.project-commerce-stats > view {
  padding: 18rpx;
  border-radius: 16rpx;
  background: #f6f7fb;
}

.project-commerce-stats text {
  display: block;
}

.project-commerce-stats text:first-child {
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.project-commerce-stats text:last-child {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.project-quote-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200rpx 180rpx;
  gap: 12rpx;
  align-items: center;
  margin-top: 20rpx;
}

.project-quote-items,
.project-commerce-list > view > view {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.project-quote-items text,
.project-commerce-list > view > view text {
  padding: 9rpx 15rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 22rpx;
}

.project-quote-items text.active,
.project-commerce-list > view > view text:not(.danger) {
  background: #eef2ff;
  color: #4f46e5;
}

.project-commerce-list > view > view text.danger {
  color: #dc2626;
}

.project-quote-form input {
  box-sizing: border-box;
  height: 72rpx;
  padding: 0 18rpx;
  border-radius: 16rpx;
  background: #f6f7fb;
  font-size: 24rpx;
}

.project-quote-form button {
  width: 100%;
  margin: 0;
  border-radius: 16rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 24rpx;
}

.project-commerce-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 22rpx;
}

.project-commerce-columns > view {
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.project-commerce-list > view {
  margin-top: 14rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background: #ffffff;
}

.project-commerce-list > view > text {
  display: block;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.6;
}

.project-commerce-list > view > text:first-child {
  color: #111827;
  font-size: 24rpx;
  font-weight: 700;
}

.project-commerce-list > view > view {
  margin-top: 12rpx;
}

@media (max-width: 720px) {
  .project-commerce-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-quote-form,
  .project-commerce-columns {
    grid-template-columns: 1fr;
  }
}
</style>
