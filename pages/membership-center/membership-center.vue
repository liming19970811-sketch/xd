<template>
  <view class="membership-page">
    <view class="membership-shell">
      <aside class="membership-sidebar">
        <view class="brand">
          <text class="brand-mark">D</text>
          <view>
            <text class="brand-title">会员与额度中心</text>
            <text class="brand-sub">权益、消费、订单统一查看</text>
          </view>
        </view>
        <text
          v-for="item in tabs"
          :key="item.key"
          class="nav-item"
          :class="{ active: currentTab === item.key }"
          @click="switchTab(item.key)"
        >
          {{ item.label }}
        </text>
      </aside>

      <main class="membership-main">
        <view class="page-head">
          <view>
            <text class="eyebrow">Diebian Membership</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">网站、小程序和企业 API 共用同一套会员、额度和消费记录。本阶段不模拟支付成功。</text>
          </view>
          <button class="primary-btn" @click="refreshCenter">刷新记录</button>
        </view>

        <view class="summary-grid">
          <view class="summary-card">
            <text>当前账户</text>
            <strong>{{ center.account.accountTypeLabel }}</strong>
            <small>{{ center.account.planName }}</small>
          </view>
          <view class="summary-card">
            <text>权益状态</text>
            <strong>{{ center.account.paymentStatus === 'contact_required' ? '联系开通' : center.account.paymentStatus }}</strong>
            <small>{{ center.account.expiresAt || '暂无到期时间' }}</small>
          </view>
          <view class="summary-card">
            <text>本月已使用</text>
            <strong>{{ totalUsed }}</strong>
            <small>来自不可变额度记录</small>
          </view>
          <view class="summary-card">
            <text>异常/回滚</text>
            <strong>{{ center.enterpriseUsage.abnormalRecords.length }}</strong>
            <small>失败、回滚和补偿需留痕</small>
          </view>
        </view>

        <view v-if="currentTab === 'membership'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">套餐权益</text>
              <text class="section-desc">套餐价格和权益从配置读取；未配置项显示 0 或待配置，不展示无法兑现的承诺。</text>
            </view>
          </view>
          <view class="plan-grid">
            <view v-for="plan in center.plans" :key="plan.planId" class="plan-card" :class="{ current: plan.planId === center.account.planId }">
              <view class="plan-head">
                <view>
                  <text class="plan-name">{{ plan.name }}</text>
                  <text class="plan-price">{{ plan.priceText }}</text>
                </view>
                <text class="status">{{ plan.status }}</text>
              </view>
              <view class="benefit-grid">
                <view><text>AI出图</text><strong>{{ plan.benefits.aiImage }}</strong></view>
                <view><text>AI制版</text><strong>{{ plan.benefits.aiPattern }}</strong></view>
                <view><text>人工精修</text><strong>{{ plan.benefits.manualRefine }}</strong></view>
                <view><text>批量上限</text><strong>{{ plan.benefits.batchLimit }}</strong></view>
                <view><text>云存储</text><strong>{{ plan.benefits.storageSpace }}</strong></view>
                <view><text>团队成员</text><strong>{{ plan.benefits.memberLimit }}</strong></view>
                <view><text>企业项目</text><strong>{{ plan.benefits.projectLimit }}</strong></view>
                <view><text>API额度</text><strong>{{ plan.benefits.apiQuota }}</strong></view>
              </view>
              <view class="notes">
                <text v-for="note in plan.notes" :key="note">{{ note }}</text>
              </view>
              <button class="outline-btn" @click="contactPlan(plan)">联系开通</button>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'usage'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">额度账户</text>
              <text class="section-desc">按 AI出图、AI制版、人工服务、API调用和赠送额度分账展示。</text>
            </view>
          </view>
          <view class="quota-grid">
            <view v-for="quota in center.quotaAccounts" :key="quota.quotaType" class="quota-card">
              <text>{{ quota.label }}</text>
              <strong>{{ quota.remaining }}</strong>
              <small>总额 {{ quota.total }} · 已用 {{ quota.used }} · 即将过期 {{ quota.expiring }}</small>
            </view>
          </view>
          <view class="table-card">
            <view class="table-head"><text>消费与回滚明细</text><text>{{ filteredRecords.length }} 条</text></view>
            <view class="filters">
              <input v-model.trim="recordKeyword" placeholder="按任务、订单或幂等键筛选" />
              <picker :range="quotaFilterLabels" :value="quotaFilterIndex" @change="onQuotaFilterChange">
                <view>{{ quotaFilterLabels[quotaFilterIndex] }}</view>
              </picker>
            </view>
            <view class="data-table">
              <view class="data-row head"><text>记录</text><text>类型</text><text>变动</text><text>关联</text><text>状态</text><text>时间</text></view>
              <view v-for="record in filteredRecords" :key="record.recordId" class="data-row">
                <text>{{ record.recordId }}</text>
                <text>{{ getQuotaLabel(record.quotaType) }} / {{ getActionLabel(record.actionType) }}</text>
                <text>{{ record.before }} → {{ record.after }}（{{ record.amount }}）</text>
                <text>{{ record.taskId || record.orderId || record.idempotencyKey || '-' }}</text>
                <text>{{ record.status }}</text>
                <text>{{ formatDate(record.createdAt) }}</text>
              </view>
            </view>
            <view v-if="!filteredRecords.length" class="empty-state">暂无额度记录。真实消费、回滚、赠送与补偿记录出现后会在这里展示。</view>
          </view>

          <view class="table-card enterprise-quota">
            <view class="table-head">
              <text>企业额度与成员上限</text>
              <text>{{ center.enterpriseUsage.canManage ? '管理员视图' : '个人可见范围' }}</text>
            </view>
            <view v-if="center.enterpriseUsage.canManage" class="limit-form">
              <input v-model.trim="memberLimitForm.memberId" placeholder="成员 memberId" />
              <input v-model.number="memberLimitForm.aiImageLimit" type="number" placeholder="AI出图上限" />
              <input v-model.number="memberLimitForm.apiCallLimit" type="number" placeholder="API调用上限" />
              <button class="primary-btn" @click="saveLimit">保存成员上限</button>
            </view>
            <view v-if="center.enterpriseUsage.memberLimits.length" class="data-table">
              <view class="data-row head compact"><text>成员</text><text>AI出图上限</text><text>API上限</text><text>更新时间</text></view>
              <view v-for="limit in center.enterpriseUsage.memberLimits" :key="limit.memberId" class="data-row compact">
                <text>{{ limit.memberId }}</text>
                <text>{{ limit.aiImageLimit }}</text>
                <text>{{ limit.apiCallLimit }}</text>
                <text>{{ formatDate(limit.updatedAt) }}</text>
              </view>
            </view>
            <view v-else class="empty-state">暂无成员上限记录。普通成员只能查看本人被授权范围。</view>
          </view>
        </view>

        <view v-else class="section">
          <view class="section-head">
            <view>
              <text class="section-title">订单管理</text>
              <text class="section-desc">支付成功必须由服务端回调激活权益；当前尚未接入真实支付，因此仅支持联系开通和订单记录查看。</text>
            </view>
          </view>
          <view class="data-table orders">
            <view class="data-row head"><text>订单</text><text>套餐/商品</text><text>状态</text><text>金额</text><text>时间</text></view>
            <view v-for="order in center.orders" :key="order.orderId" class="data-row">
              <text>{{ order.orderId }}</text>
              <text>{{ order.productName }}</text>
              <text>{{ getOrderLabel(order.status) }}</text>
              <text>{{ order.amount > 0 ? order.amount : '联系开通' }}</text>
              <text>{{ formatDate(order.createdAt) }}</text>
            </view>
          </view>
          <view v-if="!center.orders.length" class="empty-state">暂无订单。选择套餐后会创建待处理联系记录，但不会模拟支付成功。</view>
        </view>

        <view class="notice-panel">
          <text v-for="notice in center.notices" :key="notice">{{ notice }}</text>
        </view>
      </main>
    </view>
  </view>
</template>

<script>
import {
  QUOTA_TYPES,
  createContactOrder,
  getOrderStatusLabel,
  getQuotaActionLabel,
  loadMembershipCenter,
  saveMemberQuotaLimit
} from '../../utils/membership/membershipCenter'

const TAB_MAP = {
  membership: 'membership',
  usage: 'usage',
  orders: 'orders'
}

export default {
  data() {
    return {
      currentTab: 'membership',
      tabs: [
        { key: 'membership', label: '会员套餐' },
        { key: 'usage', label: '额度明细' },
        { key: 'orders', label: '订单记录' }
      ],
      center: loadMembershipCenter(),
      recordKeyword: '',
      quotaFilterIndex: 0,
      quotaFilterLabels: ['全部额度', ...QUOTA_TYPES.map((item) => item.label)],
      memberLimitForm: {
        memberId: '',
        aiImageLimit: '',
        apiCallLimit: ''
      }
    }
  },
  computed: {
    pageTitle() {
      const item = this.tabs.find((tab) => tab.key === this.currentTab)
      return item ? item.label : '会员与额度中心'
    },
    totalUsed() {
      return this.center.quotaAccounts.reduce((sum, item) => sum + item.used, 0)
    },
    filteredRecords() {
      const keyword = this.recordKeyword.toLowerCase()
      const quotaType = this.quotaFilterIndex > 0 ? QUOTA_TYPES[this.quotaFilterIndex - 1].key : ''
      return this.center.records.filter((record) => {
        const matchesType = !quotaType || record.quotaType === quotaType
        const haystack = `${record.recordId} ${record.taskId} ${record.orderId} ${record.idempotencyKey}`.toLowerCase()
        const matchesKeyword = !keyword || haystack.includes(keyword)
        return matchesType && matchesKeyword
      })
    }
  },
  onLoad(query = {}) {
    this.currentTab = TAB_MAP[query.tab] || TAB_MAP[query.module] || 'membership'
    this.refreshCenter()
  },
  methods: {
    refreshCenter() {
      this.center = loadMembershipCenter()
    },
    switchTab(tab) {
      this.currentTab = tab
      uni.redirectTo({ url: `/pages/membership-center/membership-center?tab=${encodeURIComponent(tab)}` })
    },
    onQuotaFilterChange(event) {
      this.quotaFilterIndex = Number(event.detail.value) || 0
    },
    getQuotaLabel(type) {
      const item = QUOTA_TYPES.find((option) => option.key === type)
      return item ? item.label : type
    },
    getActionLabel(action) {
      return getQuotaActionLabel(action)
    },
    getOrderLabel(status) {
      return getOrderStatusLabel(status)
    },
    contactPlan(plan) {
      const result = createContactOrder(plan.planId)
      this.refreshCenter()
      uni.showToast({
        title: result.success ? (result.idempotent ? '已有待处理记录' : '已提交开通意向') : '提交失败',
        icon: 'none'
      })
      this.currentTab = 'orders'
    },
    saveLimit() {
      if (!this.memberLimitForm.memberId) {
        uni.showToast({ title: '请填写成员 memberId', icon: 'none' })
        return
      }
      const result = saveMemberQuotaLimit(this.memberLimitForm.memberId, this.memberLimitForm)
      this.refreshCenter()
      uni.showToast({ title: result.success ? '成员上限已保存' : '保存失败', icon: 'none' })
    },
    formatDate(value) {
      if (!value) return '-'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      const pad = (number) => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.membership-page { min-height: 100vh; background: #f5f7fb; color: #101828; }
.membership-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
.membership-sidebar { position: sticky; top: 0; height: 100vh; padding: 20px 14px; background: #111827; color: #d1d5db; box-sizing: border-box; }
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
.brand-mark { width: 36px; height: 36px; border-radius: 10px; background: #6d5dfc; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; }
.brand-title, .brand-sub, .nav-item, .page-title, .page-desc, .eyebrow, .section-title, .section-desc, .plan-name, .plan-price, .status, .empty-state { display: block; }
.brand-title { color: #fff; font-size: 15px; font-weight: 800; }
.brand-sub { color: #9ca3af; font-size: 12px; margin-top: 3px; }
.nav-item { padding: 11px 12px; border-radius: 10px; font-size: 14px; margin-bottom: 8px; cursor: pointer; }
.nav-item.active { background: #eef2ff; color: #4f46e5; font-weight: 800; }
.membership-main { padding: 24px; min-width: 0; }
.page-head, .section-head, .plan-head, .table-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eyebrow { color: #635bff; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.page-title { font-size: 28px; font-weight: 900; margin-top: 6px; }
.page-desc, .section-desc { color: #667085; font-size: 14px; line-height: 1.7; margin-top: 6px; }
.primary-btn, .outline-btn { border: 0; border-radius: 10px; padding: 0 18px; height: 40px; font-size: 14px; }
.primary-btn { background: #4f46e5; color: #fff; }
.outline-btn { background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; margin-top: 14px; }
.primary-btn::after, .outline-btn::after { border: 0; }
.summary-grid, .plan-grid, .quota-grid { display: grid; gap: 14px; margin-top: 18px; }
.summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.quota-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.summary-card, .plan-card, .quota-card, .table-card, .notice-panel { background: #fff; border: 1px solid #e4e7ec; border-radius: 14px; padding: 16px; box-shadow: 0 10px 24px rgba(16, 24, 40, .04); }
.summary-card text, .quota-card text { color: #667085; font-size: 13px; }
.summary-card strong, .quota-card strong { display: block; font-size: 26px; margin-top: 8px; }
.summary-card small, .quota-card small { color: #98a2b3; display: block; margin-top: 6px; }
.section { margin-top: 22px; }
.section-title { font-size: 20px; font-weight: 900; }
.plan-card.current { border-color: #818cf8; box-shadow: 0 16px 32px rgba(79, 70, 229, .12); }
.plan-name { font-size: 18px; font-weight: 900; }
.plan-price { color: #4f46e5; margin-top: 5px; }
.status { color: #667085; background: #f2f4f7; border-radius: 999px; padding: 4px 10px; font-size: 12px; }
.benefit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.benefit-grid view { background: #f8fafc; border-radius: 10px; padding: 10px; }
.benefit-grid text { color: #667085; font-size: 12px; display: block; }
.benefit-grid strong { display: block; margin-top: 4px; font-size: 16px; }
.notes { display: grid; gap: 5px; margin-top: 12px; color: #667085; font-size: 13px; }
.filters { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 10px; margin: 14px 0; }
.filters input, .filters picker > view, .limit-form input { height: 38px; border: 1px solid #d0d5dd; border-radius: 10px; padding: 0 12px; background: #fff; box-sizing: border-box; }
.enterprise-quota { margin-top: 16px; }
.limit-form { display: grid; grid-template-columns: minmax(0, 1fr) 140px 140px 140px; gap: 10px; margin-top: 14px; }
.data-table { overflow-x: auto; }
.data-row { min-width: 900px; display: grid; grid-template-columns: 1.4fr 1.4fr 1.2fr 1.4fr .8fr 1fr; gap: 10px; padding: 12px 0; border-bottom: 1px solid #eef2f6; font-size: 13px; align-items: center; }
.data-row.head { color: #667085; font-weight: 800; }
.data-row.compact { min-width: 560px; grid-template-columns: 1.4fr 1fr 1fr 1fr; }
.orders .data-row { grid-template-columns: 1.3fr 1.4fr 1fr 1fr 1fr; }
.empty-state { padding: 24px; text-align: center; color: #667085; background: #fff; border: 1px dashed #d0d5dd; border-radius: 14px; margin-top: 14px; }
.notice-panel { display: grid; gap: 8px; margin-top: 22px; color: #667085; font-size: 13px; }
@media (max-width: 900px) {
  .membership-shell { display: block; }
  .membership-sidebar { position: static; height: auto; display: flex; overflow-x: auto; gap: 8px; }
  .brand { min-width: 180px; margin-bottom: 0; }
  .nav-item { min-width: 92px; text-align: center; }
  .membership-main { padding: 14px; }
  .page-head, .section-head { display: block; }
  .summary-grid, .plan-grid, .quota-grid { grid-template-columns: 1fr; }
  .filters, .limit-form { grid-template-columns: 1fr; }
}
</style>
