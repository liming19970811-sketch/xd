<template>
  <view class="enterprise-page">
    <!-- #ifdef H5 -->
    <view class="shell">
      <view class="sidebar">
        <view class="brand"><text class="brand-title">蝶变</text><text class="brand-desc">企业协作中心</text></view>
        <view class="menu">
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === 'factories' ? 'active' : '']" @click="goTo(item)">
            <text class="menu-icon">{{ item.icon }}</text><text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="main">
        <view class="topbar">
          <view><text class="page-title">工厂协作中心</text><text class="page-desc">管理工厂能力、认证、询报价和生产履约，不公开完整联系方式。</text></view>
          <button v-if="canManage" class="primary-btn" @click="showCreateForm = true">新增工厂</button>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">加载工厂数据中...</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">工厂数据加载失败</view>
        <view v-else>
          <view class="summary-grid">
            <view><text>工厂数量</text><strong>{{ factories.length }}</strong></view>
            <view><text>已认证</text><strong>{{ verifiedCount }}</strong></view>
            <view><text>待认证</text><strong>{{ pendingCount }}</strong></view>
            <view><text>履约中</text><strong>{{ activeOrderCount }}</strong></view>
            <view><text>开放异常</text><strong>{{ openAnomalyCount }}</strong></view>
          </view>

          <view class="filterbar">
            <input v-model="keyword" class="filter-input" placeholder="搜索工厂名称、地区或能力" />
            <picker :range="verificationOptions" range-key="label" @change="selectVerification">
              <view class="filter-select">{{ currentVerificationLabel }}</view>
            </picker>
          </view>

          <view class="table-card">
            <view class="table-head row">
              <text>工厂</text><text>地区</text><text>能力标签</text><text>起订量</text><text>月产能</text><text>交期</text><text>认证</text><text>协作表现</text><text>操作</text>
            </view>
            <view v-if="filteredFactories.length">
              <view v-for="factory in filteredFactories" :key="factory.factoryId" class="row data-row">
                <view><text class="strong">{{ factory.shortName }}</text><text class="muted">{{ factory.factoryNo }}</text></view>
                <text>{{ factory.region || '未设置' }}</text>
                <view class="tag-list"><text v-for="tag in factory.capabilities.slice(0, 3)" :key="tag" class="tag">{{ tag }}</text><text v-if="!factory.capabilities.length" class="muted">未设置</text></view>
                <text>{{ factory.minimumOrderQuantity || '未设置' }}</text>
                <text>{{ factory.monthlyCapacity || '未设置' }}</text>
                <text>{{ formatLeadTime(factory.leadTimeRange) }}</text>
                <text><text :class="['status-tag', factory.verificationStatus]">{{ verificationLabel(factory.verificationStatus) }}</text></text>
                <text>{{ performanceText(factory.factoryId) }}</text>
                <view class="actions"><button class="mini-btn" @click="openFactory(factory)">查看</button><button v-if="canManage && factory.verificationStatus === 'pending'" class="mini-btn" @click="verify(factory)">认证</button></view>
              </view>
            </view>
            <view v-else class="empty">暂无符合条件的工厂。新增档案后才可发起认证和询价。</view>
          </view>
        </view>
      </view>

      <view v-if="showCreateForm" class="modal-mask" @click.self="showCreateForm = false">
        <view class="modal-card">
          <view class="modal-head"><text>新增工厂档案</text><text class="close" @click="showCreateForm = false">关闭</text></view>
          <view class="form-grid">
            <label><text>工厂名称 *</text><input v-model="form.name" placeholder="请输入工商或常用名称" /></label>
            <label><text>简称</text><input v-model="form.shortName" placeholder="列表展示名称" /></label>
            <label><text>地区</text><input v-model="form.region" placeholder="例如：广东广州" /></label>
            <label><text>能力标签</text><input v-model="form.capabilities" placeholder="针织, 小单快反, 女装" /></label>
            <label><text>支持品类</text><input v-model="form.supportedCategories" placeholder="女装, 连衣裙, 针织衫" /></label>
            <label><text>支持面料</text><input v-model="form.supportedMaterials" placeholder="棉, 针织, 牛仔" /></label>
            <label><text>支持工艺</text><input v-model="form.supportedProcesses" placeholder="印花, 刺绣, 水洗" /></label>
            <label><text>质检能力</text><input v-model="form.qualityCapabilities" placeholder="首件检验, 出货抽检" /></label>
            <label><text>起订量</text><input v-model="form.minimumOrderQuantity" type="number" placeholder="件" /></label>
            <label><text>月产能</text><input v-model="form.monthlyCapacity" type="number" placeholder="件" /></label>
            <label><text>最短交期</text><input v-model="form.minDays" type="number" placeholder="天" /></label>
            <label><text>最长交期</text><input v-model="form.maxDays" type="number" placeholder="天" /></label>
            <label class="wide"><text>联系摘要</text><input v-model="form.contactSummary" placeholder="例如：已由平台招商经理对接；不填写公开电话" /></label>
          </view>
          <view class="modal-actions"><button class="ghost-btn" @click="showCreateForm = false">取消</button><button class="primary-btn" :disabled="saving" @click="saveFactory">{{ saving ? '保存中...' : '保存档案' }}</button></view>
        </view>
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 --><view class="platform-tip">工厂协作中心仅在企业网页版显示。</view><!-- #endif -->
  </view>
</template>

<script>
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import {
  createFactory,
  getFactoryPerformance,
  getProductionOrders,
  listFactories,
  setFactoryVerification
} from '../../utils/service/factoryService.js'

const VERIFICATION_OPTIONS = Object.freeze([
  { label: '全部认证状态', value: '' },
  { label: '未认证', value: 'unverified' },
  { label: '待认证', value: 'pending' },
  { label: '已认证', value: 'verified' },
  { label: '认证未通过', value: 'rejected' }
])

export default {
  data() {
    return {
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.FACTORY_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.FACTORY_MANAGE),
      pageState: 'loading',
      factories: [],
      orders: [],
      performance: {},
      keyword: '',
      verificationStatus: '',
      verificationOptions: VERIFICATION_OPTIONS,
      showCreateForm: false,
      saving: false,
      form: this.emptyFactoryForm()
    }
  },
  computed: {
    guardMessage() { return getEnterpriseGuardMessage(this.guard.reason) },
    canManage() { return this.manageGuard.allowed },
    verifiedCount() { return this.factories.filter((item) => item.verificationStatus === 'verified').length },
    pendingCount() { return this.factories.filter((item) => item.verificationStatus === 'pending').length },
    activeOrderCount() { return this.orders.filter((item) => !['completed', 'cancelled'].includes(item.status)).length },
    openAnomalyCount() { return this.orders.flatMap((item) => item.anomalies || []).filter((item) => item.status !== 'resolved').length },
    currentVerificationLabel() { return (this.verificationOptions.find((item) => item.value === this.verificationStatus) || this.verificationOptions[0]).label },
    filteredFactories() {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      return this.factories.filter((factory) => {
        const haystack = [factory.name, factory.shortName, factory.factoryNo, factory.region, ...(factory.capabilities || [])].join(' ').toLowerCase()
        return (!keyword || haystack.includes(keyword)) && (!this.verificationStatus || factory.verificationStatus === this.verificationStatus)
      })
    }
  },
  onShow() { this.refresh() },
  methods: {
    emptyFactoryForm() {
      return { name: '', shortName: '', region: '', capabilities: '', supportedCategories: '', supportedMaterials: '', supportedProcesses: '', qualityCapabilities: '', minimumOrderQuantity: '', monthlyCapacity: '', minDays: '', maxDays: '', contactSummary: '' }
    },
    splitTags(value = '') { return String(value || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean) },
    refresh() {
      if (!this.guard.allowed) { this.pageState = 'forbidden'; return }
      try {
        this.factories = listFactories()
        this.orders = getProductionOrders()
        this.performance = this.factories.reduce((result, item) => { result[item.factoryId] = getFactoryPerformance(item.factoryId); return result }, {})
        this.pageState = 'ready'
      } catch (error) { this.pageState = 'error' }
    },
    goTo(item = {}) { if (item.route) uni.navigateTo({ url: item.route }) },
    openFactory(factory = {}) { uni.navigateTo({ url: buildEnterpriseWebUrl('factoryDetail', { factoryId: factory.factoryId }) }) },
    selectVerification(event = {}) { this.verificationStatus = (this.verificationOptions[Number(event.detail?.value || 0)] || this.verificationOptions[0]).value },
    verificationLabel(status = '') { return { unverified: '未认证', pending: '待认证', verified: '已认证', rejected: '未通过' }[status] || '未认证' },
    formatLeadTime(range = {}) { return range.minDays || range.maxDays ? `${range.minDays || 0}-${range.maxDays || 0} 天` : '未设置' },
    performanceText(factoryId = '') {
      const item = this.performance[factoryId] || {}
      return item.completedOrderCount ? `完成 ${item.completedOrderCount} 单 · 准时 ${item.onTimeDeliveryRate ?? '--'}%` : '暂无履约数据'
    },
    verify(factory = {}) {
      const result = setFactoryVerification(factory.factoryId, 'verified')
      uni.showToast({ title: result.success ? '工厂已认证' : result.message, icon: result.success ? 'success' : 'none' })
      if (result.success) this.refresh()
    },
    async saveFactory() {
      if (this.saving) return
      this.saving = true
      const values = this.form
      const result = createFactory({
        name: values.name,
        shortName: values.shortName || values.name,
        region: values.region,
        capabilities: this.splitTags(values.capabilities),
        supportedCategories: this.splitTags(values.supportedCategories),
        supportedMaterials: this.splitTags(values.supportedMaterials),
        supportedProcesses: this.splitTags(values.supportedProcesses),
        qualityCapabilities: this.splitTags(values.qualityCapabilities),
        minimumOrderQuantity: Number(values.minimumOrderQuantity || 0),
        monthlyCapacity: Number(values.monthlyCapacity || 0),
        leadTimeRange: { minDays: Number(values.minDays || 0), maxDays: Number(values.maxDays || 0) },
        contactSummary: values.contactSummary,
        verificationStatus: 'pending'
      })
      this.saving = false
      if (!result.success) { uni.showToast({ title: result.message, icon: 'none' }); return }
      this.showCreateForm = false
      this.form = this.emptyFactoryForm()
      uni.showToast({ title: '工厂档案已创建', icon: 'success' })
      this.refresh()
    }
  }
}
</script>

<style scoped>
.enterprise-page { min-height: 100vh; background: #f4f6fb; color: #172033; }
.shell { display: flex; min-height: 100vh; }
.sidebar { position: fixed; inset: 0 auto 0 0; width: 216px; padding: 24px 16px; background: #101828; color: #fff; box-sizing: border-box; overflow-y: auto; }
.brand { margin-bottom: 28px; }.brand-title { display: block; font-size: 22px; font-weight: 800; }.brand-desc { display: block; margin-top: 6px; color: #a9b4ca; font-size: 12px; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 8px; color: #cbd5e1; font-size: 14px; cursor: pointer; }.menu-item.active,.menu-item:hover { background: #eef2ff; color: #4f46e5; }.menu-icon { width: 24px; height: 24px; border-radius: 7px; background: rgba(255,255,255,.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; }.topbar,.table-card,.state-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; }.page-title { display: block; font-size: 24px; font-weight: 800; }.page-desc { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.primary-btn,.ghost-btn,.mini-btn { height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; line-height: 36px; }.primary-btn { background: #4f46e5; color: #fff; }.ghost-btn,.mini-btn { background: #eef2ff; color: #4f46e5; }
.summary-grid { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 12px; margin: 18px 0; }.summary-grid view { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }.summary-grid text,.summary-grid strong { display: block; }.summary-grid text { color: #64748b; font-size: 12px; }.summary-grid strong { margin-top: 8px; font-size: 24px; }
.filterbar { display: flex; gap: 12px; margin-bottom: 14px; }.filter-input,.filter-select { height: 40px; padding: 0 12px; border: 1px solid #dbe1ea; border-radius: 8px; background: #fff; font-size: 13px; box-sizing: border-box; }.filter-input { flex: 1; }.filter-select { min-width: 150px; line-height: 40px; }
.table-card { overflow-x: auto; }.row { display: grid; grid-template-columns: 1.2fr .8fr 1.5fr .65fr .65fr .75fr .8fr 1.15fr 1fr; min-width: 1120px; align-items: center; gap: 10px; padding: 13px 16px; box-sizing: border-box; }.table-head { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 700; }.data-row { border-top: 1px solid #eef2f7; font-size: 13px; }.strong,.muted { display: block; }.strong { font-weight: 700; }.muted { margin-top: 4px; color: #94a3b8; font-size: 11px; }.tag-list,.actions { display: flex; flex-wrap: wrap; gap: 6px; }.tag,.status-tag { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 11px; }.status-tag.pending { background: #fff7e8; color: #b54708; }.status-tag.verified { background: #ecfdf3; color: #027a48; }.status-tag.rejected { background: #fff1f2; color: #b42318; }.empty,.state-card,.platform-tip { padding: 28px; color: #64748b; }.denied { color: #b42318; }
.modal-mask { position: fixed; z-index: 30; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,42,.45); }.modal-card { width: min(760px,100%); max-height: 90vh; overflow-y: auto; padding: 22px; border-radius: 8px; background: #fff; box-sizing: border-box; }.modal-head { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; }.close { color: #64748b; font-size: 13px; cursor: pointer; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 20px; }.form-grid label text { display: block; margin-bottom: 7px; color: #475467; font-size: 12px; }.form-grid input { height: 42px; padding: 0 12px; border: 1px solid #dbe1ea; border-radius: 8px; box-sizing: border-box; }.wide { grid-column: 1/-1; }.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
@media (max-width: 900px) { .shell { display: block; }.sidebar { position: static; width: auto; }.main { margin-left: 0; padding: 16px; }.summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.form-grid { grid-template-columns: 1fr; }.wide { grid-column: auto; } }
</style>
