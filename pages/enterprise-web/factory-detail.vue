<template>
  <view class="enterprise-page">
    <!-- #ifdef H5 -->
    <view class="shell">
      <view class="sidebar">
        <view class="brand"><text class="brand-title">蝶变</text><text class="brand-desc">工厂协作中心</text></view>
        <view class="menu"><view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'factories' ? 'active' : '']" @click="goTo(item)"><text class="menu-icon">{{ item.icon }}</text><text>{{ item.label }}</text></view></view>
      </view>

      <view class="main">
        <view class="topbar">
          <view><text class="back" @click="back">← 返回工厂列表</text><text class="page-title">{{ factory ? factory.name : '工厂详情' }}</text><text class="page-desc">档案、成员、询报价、生产协作、交期和履约表现统一留痕。</text></view>
          <view v-if="factory" class="top-actions"><button v-if="canManage && factory.verificationStatus !== 'verified'" class="ghost-btn" @click="setVerification('verified')">认证通过</button><button v-if="canManage && factory.verificationStatus === 'pending'" class="ghost-btn danger-btn" @click="setVerification('rejected')">认证驳回</button><button v-if="canInvite" class="primary-btn" @click="openQuoteForm">发起询价</button></view>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">加载工厂详情中...</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ errorMessage || '当前成员无权访问该工厂' }}</view>
        <view v-else-if="pageState === 'not_found'" class="state-card denied">工厂不存在或已被当前企业隔离。</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ errorMessage || '工厂详情加载失败' }}</view>
        <view v-else-if="factory">
          <view class="summary-grid">
            <view><text>认证状态</text><strong>{{ verificationLabel(factory.verificationStatus) }}</strong></view>
            <view><text>询价响应</text><strong>{{ metric(performance.quoteResponseRate) }}</strong></view>
            <view><text>完成订单</text><strong>{{ performance.completedOrderCount }}</strong></view>
            <view><text>准时交付</text><strong>{{ metric(performance.onTimeDeliveryRate) }}</strong></view>
            <view><text>质检通过</text><strong>{{ metric(performance.qualityPassRate) }}</strong></view>
            <view><text>开放异常</text><strong :class="{ danger: performance.openAnomalyCount }">{{ performance.openAnomalyCount }}</strong></view>
          </view>

          <view class="content-grid">
            <view class="panel wide">
              <view class="panel-head"><view><text class="panel-title">工厂档案</text><text class="panel-desc">能力、产能和联系摘要可持续维护。</text></view><view class="actions"><text class="status-tag">{{ factory.factoryNo }}</text><button v-if="canManage" class="mini-btn" @click="openProfileForm">编辑档案</button></view></view>
              <view class="info-grid">
                <view><text>简称</text><strong>{{ factory.shortName }}</strong></view><view><text>地区</text><strong>{{ factory.region || '未设置' }}</strong></view><view><text>起订量</text><strong>{{ factory.minimumOrderQuantity || '未设置' }}</strong></view><view><text>月产能</text><strong>{{ factory.monthlyCapacity || '未设置' }}</strong></view><view><text>交期范围</text><strong>{{ leadTimeText }}</strong></view><view><text>联系状态</text><strong>{{ factory.contactSummary || '未设置' }}</strong></view>
              </view>
              <view class="tag-section"><text class="sub-title">能力标签</text><view class="tags"><text v-for="tag in allCapabilityTags" :key="tag" class="tag">{{ tag }}</text><text v-if="!allCapabilityTags.length" class="muted">未设置能力标签</text></view></view>
            </view>

            <view class="panel wide">
              <view class="panel-head"><view><text class="panel-title">工厂成员</text><text class="panel-desc">只有 active 成员可提交报价、反馈交期和更新生产状态。</text></view><button v-if="canManage" class="mini-btn" @click="showMemberForm = true">添加成员</button></view>
              <view v-if="factory.members.length" class="member-list"><view v-for="member in factory.members" :key="member.memberId" class="member-row"><view><strong>{{ member.name }}</strong><text>{{ member.role }}</text></view><text :class="['status-tag', member.status]">{{ memberStatusLabel(member.status) }}</text><view v-if="canManage" class="actions"><button class="mini-btn" @click="toggleMember(member)">{{ member.status === 'active' ? '停用' : '启用' }}</button></view></view></view>
              <view v-else class="empty">暂无工厂成员。成员未激活前不能参与协作。</view>
            </view>

            <view class="panel wide">
              <view class="panel-head"><view><text class="panel-title">询价与报价</text><text class="panel-desc">只有已认证工厂可收到新询价，接受报价不会触发支付。</text></view><button v-if="canInvite" class="mini-btn" @click="openQuoteForm">发起询价</button></view>
              <view v-if="quotes.length" class="table-wrap"><view class="quote-row quote-head"><text>询价</text><text>项目</text><text>状态</text><text>报价</text><text>周期</text><text>预计交期</text><text>操作</text></view><view v-for="quote in quotes" :key="quote.quoteId" class="quote-row"><view><strong>{{ quote.inquiryTitle }}</strong><text class="muted">{{ formatTime(quote.createdAt) }}</text></view><text>{{ projectName(quote.projectId) }}</text><text><text class="status-tag">{{ quoteStatusLabel(quote.status) }}</text></text><text>{{ quote.amount ? money(quote.amount) : '待报价' }}</text><text>{{ quote.leadTimeDays ? `${quote.leadTimeDays} 天` : '--' }}</text><text>{{ quote.estimatedDeliveryAt || '--' }}</text><view class="actions"><button v-if="canSubmitQuote && ['invited','viewed','submitted'].includes(quote.status)" class="mini-btn" @click="openSubmitQuote(quote)">提交报价</button><button v-if="canManage && quote.status === 'submitted'" class="mini-btn" @click="acceptQuote(quote)">确认报价</button></view></view></view>
              <view v-else class="empty">暂无询价记录。</view>
            </view>

            <view class="panel wide">
              <view class="panel-head"><view><text class="panel-title">生产订单协作</text><text class="panel-desc">生产协作单关联现有项目与商业订单，不创建支付订单。</text></view></view>
              <view v-if="orders.length" class="order-list"><view v-for="order in orders" :key="order.productionOrderId" class="order-card"><view class="order-head"><view><strong>{{ order.productionOrderNo }}</strong><text>{{ projectName(order.projectId) }} · {{ orderStatusLabel(order.status) }}</text></view><text :class="['risk', order.deliveryRisk]">{{ riskLabel(order.deliveryRisk) }}</text></view><view class="order-info"><text>承诺交期：{{ order.promisedDeliveryAt || '未设置' }}</text><text>最新预计：{{ order.latestEstimatedDeliveryAt || '未反馈' }}</text><text>质检：{{ qualityLabel(order.qualityStatus) }}</text><text>异常：{{ openOrderAnomalies(order).length }}</text></view><view class="actions action-line"><button v-if="canCollaborate && nextOrderStatus(order)" class="mini-btn" @click="advanceOrder(order)">{{ nextOrderAction(order) }}</button><button v-if="canCollaborate" class="mini-btn" @click="openLeadTime(order)">反馈交期</button><button v-if="canCollaborate && order.status === 'quality_check'" class="mini-btn" @click="quality(order, 'passed')">质检通过</button><button v-if="canCollaborate" class="mini-btn danger-btn" @click="openAnomaly(order)">记录异常</button></view><view v-if="openOrderAnomalies(order).length" class="anomaly-list"><view v-for="anomaly in openOrderAnomalies(order)" :key="anomaly.anomalyId" class="anomaly-row"><text>{{ anomaly.level === 'high' ? '高' : anomaly.level === 'low' ? '低' : '中' }}风险：{{ anomaly.content }}</text><button v-if="canCollaborate" class="text-btn" @click="resolveAnomaly(order, anomaly)">标记解决</button></view></view></view></view>
              <view v-else class="empty">暂无生产协作单。管理员确认工厂报价后才会创建。</view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="showMemberForm" class="modal-mask" @click.self="showMemberForm = false"><view class="modal-card small"><view class="modal-head"><text>添加工厂成员</text><text @click="showMemberForm = false">关闭</text></view><label><text>成员名称</text><input v-model="memberForm.name" placeholder="请输入名称" /></label><label><text>用户 ID（可后续绑定）</text><input v-model="memberForm.userId" placeholder="未绑定时保持 pending" /></label><picker :range="memberRoles" range-key="label" @change="selectMemberRole"><view class="picker-value">{{ memberRoleLabel }}</view></picker><button class="primary-btn full" @click="saveMember">保存成员</button></view></view>

      <view v-if="showProfileForm" class="modal-mask" @click.self="showProfileForm = false"><view class="modal-card"><view class="modal-head"><text>编辑工厂档案</text><text @click="showProfileForm = false">关闭</text></view><view class="form-grid"><label><text>工厂名称 *</text><input v-model="profileForm.name" /></label><label><text>简称</text><input v-model="profileForm.shortName" /></label><label><text>地区</text><input v-model="profileForm.region" /></label><label><text>能力标签</text><input v-model="profileForm.capabilities" placeholder="小单快反, 针织" /></label><label><text>支持品类</text><input v-model="profileForm.supportedCategories" /></label><label><text>支持面料</text><input v-model="profileForm.supportedMaterials" /></label><label><text>支持工艺</text><input v-model="profileForm.supportedProcesses" /></label><label><text>质检能力</text><input v-model="profileForm.qualityCapabilities" /></label><label><text>起订量</text><input v-model="profileForm.minimumOrderQuantity" type="number" /></label><label><text>月产能</text><input v-model="profileForm.monthlyCapacity" type="number" /></label><label><text>最短交期（天）</text><input v-model="profileForm.minDays" type="number" /></label><label><text>最长交期（天）</text><input v-model="profileForm.maxDays" type="number" /></label><label class="wide"><text>联系摘要</text><input v-model="profileForm.contactSummary" placeholder="仅填写对接状态，不公开完整联系方式" /></label></view><button class="primary-btn full" @click="saveProfile">保存档案</button></view></view>

      <view v-if="showQuoteForm" class="modal-mask" @click.self="showQuoteForm = false"><view class="modal-card"><view class="modal-head"><text>发起询价邀请</text><text @click="showQuoteForm = false">关闭</text></view><view class="form-grid"><label><text>询价标题</text><input v-model="quoteForm.inquiryTitle" /></label><label><text>关联项目 *</text><picker :range="projects" range-key="projectName" @change="selectProject"><view class="picker-value">{{ selectedProjectName }}</view></picker></label><label><text>生产数量</text><input v-model="quoteForm.quantity" type="number" placeholder="件" /></label><label><text>期望交期</text><input v-model="quoteForm.requestedDeliveryAt" placeholder="YYYY-MM-DD" /></label><label><text>面料要求</text><input v-model="quoteForm.material" /></label><label><text>工艺要求</text><input v-model="quoteForm.process" /></label></view><button class="primary-btn full" @click="sendQuote">发送询价</button></view></view>

      <view v-if="showSubmitForm" class="modal-mask" @click.self="showSubmitForm = false"><view class="modal-card small"><view class="modal-head"><text>提交工厂报价</text><text @click="showSubmitForm = false">关闭</text></view><label><text>报价金额 *</text><input v-model="submitForm.amount" type="number" /></label><label><text>生产周期（天）*</text><input v-model="submitForm.leadTimeDays" type="number" /></label><label><text>预计交期</text><input v-model="submitForm.estimatedDeliveryAt" placeholder="YYYY-MM-DD" /></label><label><text>报价说明</text><textarea v-model="submitForm.factoryComment" maxlength="300" /></label><button class="primary-btn full" @click="submitQuote">确认提交</button></view></view>

      <view v-if="showLeadTimeForm" class="modal-mask" @click.self="showLeadTimeForm = false"><view class="modal-card small"><view class="modal-head"><text>反馈交期</text><text @click="showLeadTimeForm = false">关闭</text></view><label><text>最新预计交期 *</text><input v-model="leadTimeForm.estimatedDeliveryAt" placeholder="YYYY-MM-DD" /></label><picker :range="riskOptions" range-key="label" @change="selectRisk"><view class="picker-value">{{ riskFormLabel }}</view></picker><label><text>说明</text><textarea v-model="leadTimeForm.content" maxlength="300" /></label><button class="primary-btn full" @click="saveLeadTime">保存反馈</button></view></view>

      <view v-if="showAnomalyForm" class="modal-mask" @click.self="showAnomalyForm = false"><view class="modal-card small"><view class="modal-head"><text>记录生产异常</text><text @click="showAnomalyForm = false">关闭</text></view><picker :range="anomalyLevels" range-key="label" @change="selectAnomalyLevel"><view class="picker-value">{{ anomalyLevelLabel }}</view></picker><label><text>异常说明 *</text><textarea v-model="anomalyForm.content" maxlength="300" /></label><button class="primary-btn full" @click="saveAnomaly">保存异常</button></view></view>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 --><view class="platform-tip">工厂协作中心仅在企业网页版显示。</view><!-- #endif -->
  </view>
</template>

<script>
import { getList as getProjects } from '../../utils/repository/projectRepository.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { requireActiveMember, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { getById as getFactoryById } from '../../utils/repository/factoryRepository.js'
import {
  acceptFactoryQuote,
  addFactoryMember,
  canAccessFactory,
  getFactoryPerformance,
  getFactoryQuotes,
  getProductionOrders,
  inviteFactoryQuote,
  recordProductionAnomaly,
  recordQualityResult,
  resolveProductionAnomaly,
  setFactoryVerification,
  submitFactoryQuote,
  submitLeadTimeFeedback,
  transitionProductionOrder,
  updateFactory,
  updateFactoryMember
} from '../../utils/service/factoryService.js'

const MEMBER_ROLES = Object.freeze([{ label: '工厂管理员', value: 'factory_admin' }, { label: '跟单员', value: 'factory_merchandiser' }, { label: '生产协调', value: 'production_coordinator' }, { label: '质检员', value: 'quality_inspector' }])
const RISK_OPTIONS = Object.freeze([{ label: '无风险', value: 'none' }, { label: '低风险', value: 'low' }, { label: '中风险', value: 'medium' }, { label: '高风险', value: 'high' }])
const ANOMALY_LEVELS = Object.freeze(RISK_OPTIONS.slice(1))

export default {
  data() {
    return {
      menu: getEnterpriseWebMenu(), factoryId: '', factory: null, projects: [], quotes: [], orders: [], performance: {}, pageState: 'loading', errorMessage: '',
      activeGuard: requireActiveMember(), manageGuard: requirePermission(PERMISSION_KEYS.FACTORY_MANAGE), quoteGuard: requirePermission(PERMISSION_KEYS.FACTORY_QUOTE), collaborateGuard: requirePermission(PERMISSION_KEYS.FACTORY_COLLABORATE),
      showMemberForm: false, showProfileForm: false, showQuoteForm: false, showSubmitForm: false, showLeadTimeForm: false, showAnomalyForm: false,
      activeQuoteId: '', activeOrderId: '', memberRoles: MEMBER_ROLES, riskOptions: RISK_OPTIONS, anomalyLevels: ANOMALY_LEVELS,
      memberForm: { name: '', userId: '', role: 'factory_merchandiser' },
      profileForm: {},
      quoteForm: { inquiryTitle: '小单快反生产询价', projectId: '', quantity: '', requestedDeliveryAt: '', material: '', process: '' },
      submitForm: { amount: '', leadTimeDays: '', estimatedDeliveryAt: '', factoryComment: '' },
      leadTimeForm: { estimatedDeliveryAt: '', risk: 'none', content: '' }, anomalyForm: { level: 'medium', content: '' }
    }
  },
  computed: {
    canManage() { return this.factory && (this.manageGuard.allowed || canAccessFactory(this.factory, 'manage')) },
    canInvite() { return this.factory && this.quoteGuard.allowed && this.factory.verificationStatus === 'verified' },
    canSubmitQuote() { return this.factory && canAccessFactory(this.factory, 'quote') },
    canCollaborate() { return this.factory && (this.collaborateGuard.allowed || canAccessFactory(this.factory, 'collaborate')) },
    allCapabilityTags() { const factory = this.factory || {}; return [...new Set([...(factory.capabilities || []), ...(factory.supportedCategories || []), ...(factory.supportedMaterials || []), ...(factory.supportedProcesses || [])])] },
    leadTimeText() { const range = this.factory?.leadTimeRange || {}; return range.minDays || range.maxDays ? `${range.minDays || 0}-${range.maxDays || 0} 天` : '未设置' },
    memberRoleLabel() { return (this.memberRoles.find((item) => item.value === this.memberForm.role) || this.memberRoles[0]).label },
    selectedProjectName() { return (this.projects.find((item) => item.projectId === this.quoteForm.projectId) || {}).projectName || '请选择项目' },
    riskFormLabel() { return (this.riskOptions.find((item) => item.value === this.leadTimeForm.risk) || this.riskOptions[0]).label },
    anomalyLevelLabel() { return (this.anomalyLevels.find((item) => item.value === this.anomalyForm.level) || this.anomalyLevels[1]).label }
  },
  onLoad(options = {}) { this.factoryId = String(options.factoryId || '') },
  onShow() { this.refresh() },
  methods: {
    refresh() {
      if (!this.activeGuard.allowed) { this.pageState = 'forbidden'; this.errorMessage = '当前成员未激活'; return }
      const factory = getFactoryById(this.factoryId)
      if (!factory) { this.pageState = 'not_found'; return }
      if (!canAccessFactory(factory, 'view')) { this.pageState = 'forbidden'; return }
      try { this.factory = factory; this.projects = getProjects(); this.quotes = getFactoryQuotes({ factoryId: this.factoryId }); this.orders = getProductionOrders({ factoryId: this.factoryId }); this.performance = getFactoryPerformance(this.factoryId); this.pageState = 'ready' } catch (error) { this.errorMessage = error?.message || ''; this.pageState = 'error' }
    },
    goTo(item = {}) { if (item.route) uni.navigateTo({ url: item.route }) }, back() { uni.navigateTo({ url: buildEnterpriseWebUrl('factories') }) },
    metric(value) { return value === null || value === undefined ? '暂无数据' : `${value}%` }, money(value) { return `¥${Number(value || 0).toFixed(0)}` }, formatTime(value = '') { return value ? String(value).slice(0, 16).replace('T', ' ') : '--' }, projectName(id = '') { return (this.projects.find((item) => item.projectId === id) || {}).projectName || id || '未关联项目' },
    verificationLabel(value) { return { unverified: '未认证', pending: '待认证', verified: '已认证', rejected: '未通过' }[value] || '未认证' }, memberStatusLabel(value) { return { pending: '待激活', active: '已启用', disabled: '已停用' }[value] || '待激活' }, quoteStatusLabel(value) { return { draft: '草稿', invited: '已邀请', viewed: '已查看', submitted: '已报价', accepted: '已确认', rejected: '已拒绝', expired: '已过期' }[value] || value }, orderStatusLabel(value) { return { pending_confirmation: '待确认', confirmed: '已确认', in_production: '生产中', quality_check: '质检中', ready_to_ship: '待发货', shipped: '已发货', completed: '已完成', cancelled: '已取消' }[value] || value }, qualityLabel(value) { return { pending: '待质检', passed: '已通过', failed: '未通过' }[value] || '待质检' }, riskLabel(value) { return { none: '交期正常', low: '低风险', medium: '中风险', high: '高风险' }[value] || '交期正常' },
    setVerification(status) { const result = setFactoryVerification(this.factoryId, status); this.toast(result, '认证状态已更新') },
    splitTags(value = '') { return String(value || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean) },
    openProfileForm() {
      const factory = this.factory || {}
      this.profileForm = {
        name: factory.name || '', shortName: factory.shortName || '', region: factory.region || '',
        capabilities: (factory.capabilities || []).join(', '), supportedCategories: (factory.supportedCategories || []).join(', '),
        supportedMaterials: (factory.supportedMaterials || []).join(', '), supportedProcesses: (factory.supportedProcesses || []).join(', '),
        qualityCapabilities: (factory.qualityCapabilities || []).join(', '), minimumOrderQuantity: factory.minimumOrderQuantity || '',
        monthlyCapacity: factory.monthlyCapacity || '', minDays: factory.leadTimeRange?.minDays || '', maxDays: factory.leadTimeRange?.maxDays || '',
        contactSummary: factory.contactSummary || ''
      }
      this.showProfileForm = true
    },
    saveProfile() {
      const form = this.profileForm
      const result = updateFactory(this.factoryId, {
        name: form.name, shortName: form.shortName || form.name, region: form.region,
        capabilities: this.splitTags(form.capabilities), supportedCategories: this.splitTags(form.supportedCategories),
        supportedMaterials: this.splitTags(form.supportedMaterials), supportedProcesses: this.splitTags(form.supportedProcesses),
        qualityCapabilities: this.splitTags(form.qualityCapabilities), minimumOrderQuantity: Number(form.minimumOrderQuantity || 0),
        monthlyCapacity: Number(form.monthlyCapacity || 0), leadTimeRange: { minDays: Number(form.minDays || 0), maxDays: Number(form.maxDays || 0) },
        contactSummary: form.contactSummary
      })
      if (result.success) this.showProfileForm = false
      this.toast(result, '工厂档案已更新')
    },
    selectMemberRole(event) { this.memberForm.role = this.memberRoles[Number(event.detail.value)].value }, selectProject(event) { this.quoteForm.projectId = (this.projects[Number(event.detail.value)] || {}).projectId || '' }, selectRisk(event) { this.leadTimeForm.risk = this.riskOptions[Number(event.detail.value)].value }, selectAnomalyLevel(event) { this.anomalyForm.level = this.anomalyLevels[Number(event.detail.value)].value },
    saveMember() { const result = addFactoryMember(this.factoryId, { ...this.memberForm, status: this.memberForm.userId ? 'active' : 'pending' }); if (result.success) { this.showMemberForm = false; this.memberForm = { name: '', userId: '', role: 'factory_merchandiser' } } this.toast(result, '工厂成员已添加') },
    toggleMember(member) { this.toast(updateFactoryMember(this.factoryId, member.memberId, { status: member.status === 'active' ? 'disabled' : 'active' }), '成员状态已更新') },
    openQuoteForm() { this.showQuoteForm = true },
    sendQuote() { const form = this.quoteForm; const result = inviteFactoryQuote({ factoryId: this.factoryId, projectId: form.projectId, inquiryTitle: form.inquiryTitle, requestedDeliveryAt: form.requestedDeliveryAt, items: [{ name: form.inquiryTitle, quantity: Number(form.quantity || 0), material: form.material, process: form.process }] }); if (result.success) this.showQuoteForm = false; this.toast(result, '询价邀请已发送') },
    openSubmitQuote(quote) { this.activeQuoteId = quote.quoteId; this.submitForm = { amount: quote.amount || '', leadTimeDays: quote.leadTimeDays || '', estimatedDeliveryAt: quote.estimatedDeliveryAt || '', factoryComment: quote.factoryComment || '' }; this.showSubmitForm = true },
    submitQuote() { const result = submitFactoryQuote(this.activeQuoteId, this.submitForm); if (result.success) this.showSubmitForm = false; this.toast(result, '报价已提交') }, acceptQuote(quote) { this.toast(acceptFactoryQuote(quote.quoteId), '报价已确认，生产协作单已创建') },
    nextOrderStatus(order) { return { pending_confirmation: 'confirmed', confirmed: 'in_production', in_production: 'quality_check', quality_check: order.qualityStatus === 'passed' ? 'ready_to_ship' : '', ready_to_ship: 'shipped', shipped: 'completed' }[order.status] || '' }, nextOrderAction(order) { return { pending_confirmation: '确认接单', confirmed: '开始生产', in_production: '进入质检', quality_check: '准备发货', ready_to_ship: '确认发货', shipped: '完成订单' }[order.status] || '' }, advanceOrder(order) { this.toast(transitionProductionOrder(order.productionOrderId, this.nextOrderStatus(order)), '生产状态已更新') },
    quality(order, status) { this.toast(recordQualityResult(order.productionOrderId, status), status === 'passed' ? '质检已通过' : '质检结果已记录') }, openLeadTime(order) { this.activeOrderId = order.productionOrderId; this.leadTimeForm = { estimatedDeliveryAt: order.latestEstimatedDeliveryAt || '', risk: order.deliveryRisk || 'none', content: '' }; this.showLeadTimeForm = true }, saveLeadTime() { const result = submitLeadTimeFeedback(this.activeOrderId, this.leadTimeForm); if (result.success) this.showLeadTimeForm = false; this.toast(result, '交期反馈已保存') },
    openAnomaly(order) { this.activeOrderId = order.productionOrderId; this.anomalyForm = { level: 'medium', content: '' }; this.showAnomalyForm = true }, saveAnomaly() { const result = recordProductionAnomaly(this.activeOrderId, this.anomalyForm); if (result.success) this.showAnomalyForm = false; this.toast(result, '生产异常已记录') }, resolveAnomaly(order, anomaly) { this.toast(resolveProductionAnomaly(order.productionOrderId, anomaly.anomalyId), '异常已关闭') }, openOrderAnomalies(order) { return (order.anomalies || []).filter((item) => item.status !== 'resolved') },
    toast(result, successTitle) { uni.showToast({ title: result.success ? successTitle : result.message, icon: result.success ? 'success' : 'none' }); if (result.success) this.refresh() }
  }
}
</script>

<style scoped>
.enterprise-page { min-height: 100vh; background: #f4f6fb; color: #172033; }.shell { display: flex; min-height: 100vh; }.sidebar { position: fixed; inset: 0 auto 0 0; width: 216px; padding: 24px 16px; overflow-y: auto; background: #101828; color: #fff; box-sizing: border-box; }.brand { margin-bottom: 28px; }.brand-title { display: block; font-size: 22px; font-weight: 800; }.brand-desc { display: block; margin-top: 6px; color: #a9b4ca; font-size: 12px; }.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 8px; color: #cbd5e1; font-size: 14px; cursor: pointer; }.menu-item.active,.menu-item:hover { color: #4f46e5; background: #eef2ff; }.menu-icon { width: 24px; height: 24px; border-radius: 7px; background: rgba(255,255,255,.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }.topbar,.panel,.state-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; }.back { display: block; margin-bottom: 8px; color: #4f46e5; font-size: 12px; cursor: pointer; }.page-title { display: block; font-size: 24px; font-weight: 800; }.page-desc,.panel-desc { display: block; margin-top: 5px; color: #64748b; font-size: 13px; }.top-actions,.actions { display: flex; flex-wrap: wrap; gap: 8px; }.primary-btn,.ghost-btn,.mini-btn,.text-btn { height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; line-height: 36px; }.primary-btn { background: #4f46e5; color: #fff; }.ghost-btn,.mini-btn { background: #eef2ff; color: #4f46e5; }.danger-btn { background: #fff1f2; color: #b42318; }
.summary-grid { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 12px; margin: 18px 0; }.summary-grid view { padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }.summary-grid text,.summary-grid strong { display: block; }.summary-grid text { color: #64748b; font-size: 12px; }.summary-grid strong { margin-top: 8px; font-size: 19px; }.danger { color: #b42318; }.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }.panel { padding: 20px; }.wide { grid-column: 1/-1; }.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.panel-title,.sub-title { display: block; font-size: 17px; font-weight: 800; }.info-grid { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 10px; margin-top: 16px; }.info-grid view { padding: 12px; border-radius: 8px; background: #f8fafc; }.info-grid text,.info-grid strong { display: block; }.info-grid text { color: #64748b; font-size: 11px; }.info-grid strong { margin-top: 7px; font-size: 13px; }.tag-section { margin-top: 16px; }.tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }.tag,.status-tag,.risk { display: inline-block; padding: 4px 9px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 11px; }.status-tag.active { background: #ecfdf3; color: #027a48; }.status-tag.pending { background: #fff7e8; color: #b54708; }.status-tag.disabled,.risk.high { background: #fff1f2; color: #b42318; }.risk.medium { background: #fff7e8; color: #b54708; }.risk.none,.risk.low { background: #ecfdf3; color: #027a48; }.muted { color: #94a3b8; font-size: 11px; }
.member-list,.order-list { margin-top: 14px; }.member-row { display: grid; grid-template-columns: 1fr .5fr .7fr; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid #eef2f7; }.member-row strong,.member-row text { display: block; }.member-row text { margin-top: 4px; color: #64748b; font-size: 12px; }.table-wrap { margin-top: 14px; overflow-x: auto; }.quote-row { display: grid; grid-template-columns: 1.3fr 1fr .7fr .7fr .6fr .9fr 1fr; min-width: 880px; align-items: center; gap: 8px; padding: 12px 8px; border-top: 1px solid #eef2f7; font-size: 12px; }.quote-head { color: #64748b; background: #f8fafc; font-weight: 700; }.order-card { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }.order-card + .order-card { margin-top: 10px; }.order-head { display: flex; justify-content: space-between; gap: 12px; }.order-head strong,.order-head text { display: block; }.order-head text { margin-top: 5px; color: #64748b; font-size: 12px; }.order-info { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 13px; padding: 11px; border-radius: 8px; background: #f8fafc; color: #475467; font-size: 12px; }.action-line { margin-top: 12px; }.anomaly-list { margin-top: 12px; }.anomaly-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; border-radius: 8px; background: #fff7ed; color: #9a3412; font-size: 12px; }.anomaly-row + .anomaly-row { margin-top: 6px; }.text-btn { height: 28px; padding: 0; background: transparent; color: #4f46e5; line-height: 28px; }.empty,.state-card,.platform-tip { padding: 24px; color: #64748b; }.denied { color: #b42318; }
.modal-mask { position: fixed; z-index: 40; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,42,.45); }.modal-card { width: min(680px,100%); max-height: 90vh; overflow-y: auto; padding: 22px; border-radius: 8px; background: #fff; box-sizing: border-box; }.modal-card.small { width: min(460px,100%); }.modal-head { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 18px; font-weight: 800; }.modal-head text:last-child { color: #64748b; font-size: 12px; cursor: pointer; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.modal-card label { display: block; margin-top: 12px; }.modal-card label > text { display: block; margin-bottom: 7px; color: #475467; font-size: 12px; }.modal-card input,.modal-card textarea,.picker-value { width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid #dbe1ea; border-radius: 8px; background: #fff; font-size: 13px; box-sizing: border-box; }.modal-card textarea { height: 92px; }.picker-value { margin-top: 12px; }.full { width: 100%; margin-top: 18px; }
@media (max-width: 900px) { .shell { display: block; }.sidebar { position: static; width: auto; }.main { margin-left: 0; padding: 16px; }.summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.content-grid,.info-grid,.order-info,.form-grid { grid-template-columns: 1fr; }.wide { grid-column: auto; } }
</style>
