<template>
  <view class="admin-plans-page">
    <view class="admin-shell">
      <aside class="admin-sidebar">
        <text class="admin-title">平台套餐配置</text>
        <text class="admin-desc">仅配置展示与权益参数，不直接激活支付权益。</text>
        <button class="back-btn" @click="goPlatformAdmin">返回运营后台</button>
      </aside>

      <main class="admin-main">
        <view v-if="!canAccess" class="forbidden">
          <text class="page-title">无权限访问套餐配置</text>
          <text class="page-desc">只有平台管理员或具备配置权限的账号可以进入 `/admin/plans`。</text>
        </view>

        <template v-else>
          <view class="page-head">
            <view>
              <text class="eyebrow">Admin Plans</text>
              <text class="page-title">会员、套餐与额度权益配置</text>
              <text class="page-desc">后台可配置 AI 出图、AI 制版、人工精修、批量上限、存储、团队、项目和 API 调用额度。支付激活仍必须依赖服务端回调。</text>
            </view>
            <button class="primary-btn" @click="saveCurrentPlan">保存配置</button>
          </view>

          <view class="layout">
            <view class="plan-list">
              <view
                v-for="plan in plans"
                :key="plan.planId"
                class="plan-item"
                :class="{ active: selectedPlanId === plan.planId }"
                @click="selectPlan(plan.planId)"
              >
                <text>{{ plan.name }}</text>
                <small>{{ plan.priceText }} · {{ plan.status }}</small>
              </view>
            </view>

            <view class="editor-card">
              <view class="form-grid">
                <label>
                  <text>套餐名称</text>
                  <input v-model.trim="form.name" />
                </label>
                <label>
                  <text>账户类型</text>
                  <picker :range="accountTypeLabels" :value="accountTypeIndex" @change="onAccountTypeChange">
                    <view>{{ accountTypeLabels[accountTypeIndex] }}</view>
                  </picker>
                </label>
                <label>
                  <text>价格文案</text>
                  <input v-model.trim="form.priceText" placeholder="例如：联系开通" />
                </label>
                <label>
                  <text>状态</text>
                  <picker :range="statusOptions" :value="statusIndex" @change="onStatusChange">
                    <view>{{ statusOptions[statusIndex] }}</view>
                  </picker>
                </label>
              </view>

              <view class="benefit-editor">
                <label><text>AI出图额度</text><input v-model.number="form.benefits.aiImage" type="number" /></label>
                <label><text>AI制版额度</text><input v-model.number="form.benefits.aiPattern" type="number" /></label>
                <label><text>人工精修次数</text><input v-model.number="form.benefits.manualRefine" type="number" /></label>
                <label><text>批量任务上限</text><input v-model.number="form.benefits.batchLimit" type="number" /></label>
                <label><text>云存储空间</text><input v-model.trim="form.benefits.storageSpace" /></label>
                <label><text>团队成员数量</text><input v-model.number="form.benefits.memberLimit" type="number" /></label>
                <label><text>企业项目数量</text><input v-model.number="form.benefits.projectLimit" type="number" /></label>
                <label><text>API调用额度</text><input v-model.number="form.benefits.apiQuota" type="number" /></label>
                <label><text>权益有效期（天）</text><input v-model.number="form.benefits.validDays" type="number" /></label>
              </view>

              <view class="warning">
                <text>权益判断必须由服务端执行。本页保存配置，不修改用户余额，不模拟支付成功，不触发真实扣点。</text>
              </view>
            </view>
          </view>
        </template>
      </main>
    </view>
  </view>
</template>

<script>
import {
  ACCOUNT_TYPES,
  getMembershipPlans,
  saveMembershipPlan
} from '../../utils/membership/membershipCenter'
import { requirePlatformAdmin } from '../../utils/admin/platformAdminRepository'

const STATUS_OPTIONS = ['draft', 'active', 'suspended', 'archived']

function clonePlan(plan = {}) {
  return JSON.parse(JSON.stringify(plan || {}))
}

export default {
  data() {
    const guard = requirePlatformAdmin()
    const plans = getMembershipPlans()
    return {
      canAccess: guard.allowed,
      plans,
      selectedPlanId: plans[0] ? plans[0].planId : '',
      form: clonePlan(plans[0] || {}),
      accountTypeLabels: ACCOUNT_TYPES.map((item) => item.label),
      statusOptions: STATUS_OPTIONS
    }
  },
  computed: {
    accountTypeIndex() {
      const index = ACCOUNT_TYPES.findIndex((item) => item.key === this.form.accountType)
      return index >= 0 ? index : 0
    },
    statusIndex() {
      const index = STATUS_OPTIONS.indexOf(this.form.status)
      return index >= 0 ? index : 0
    }
  },
  methods: {
    selectPlan(planId) {
      const plan = this.plans.find((item) => item.planId === planId)
      if (!plan) return
      this.selectedPlanId = planId
      this.form = clonePlan(plan)
    },
    onAccountTypeChange(event) {
      const index = Number(event.detail.value) || 0
      this.form.accountType = ACCOUNT_TYPES[index].key
    },
    onStatusChange(event) {
      const index = Number(event.detail.value) || 0
      this.form.status = STATUS_OPTIONS[index]
    },
    saveCurrentPlan() {
      const result = saveMembershipPlan(this.form)
      this.plans = getMembershipPlans()
      if (result.success) {
        this.selectPlan(result.plan.planId)
        uni.showToast({ title: '套餐配置已保存', icon: 'none' })
      } else {
        uni.showToast({ title: '保存失败', icon: 'none' })
      }
    },
    goPlatformAdmin() {
      uni.navigateTo({ url: '/pages/admin/admin?mode=platform&tab=quota' })
    }
  }
}
</script>

<style scoped>
.admin-plans-page { min-height: 100vh; background: #f6f7fb; color: #101828; }
.admin-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
.admin-sidebar { background: #101828; color: #d0d5dd; padding: 22px 16px; box-sizing: border-box; }
.admin-title, .admin-desc, .page-title, .page-desc, .eyebrow, .plan-item text, .plan-item small, .warning text { display: block; }
.admin-title { color: #fff; font-size: 18px; font-weight: 900; }
.admin-desc { font-size: 13px; line-height: 1.6; margin-top: 8px; }
.back-btn, .primary-btn { border: 0; border-radius: 10px; height: 40px; padding: 0 16px; font-size: 14px; }
.back-btn { margin-top: 18px; background: #1f2937; color: #fff; }
.primary-btn { background: #4f46e5; color: #fff; }
.back-btn::after, .primary-btn::after { border: 0; }
.admin-main { padding: 24px; min-width: 0; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 800; }
.page-title { font-size: 28px; font-weight: 900; margin-top: 6px; }
.page-desc { color: #667085; line-height: 1.7; margin-top: 6px; }
.layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; }
.plan-list, .editor-card, .forbidden { background: #fff; border: 1px solid #e4e7ec; border-radius: 14px; padding: 16px; box-shadow: 0 10px 24px rgba(16, 24, 40, .04); }
.plan-item { padding: 12px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; }
.plan-item.active { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }
.plan-item text { font-weight: 800; }
.plan-item small { color: #667085; margin-top: 4px; }
.form-grid, .benefit-editor { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.benefit-editor { margin-top: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
label text { color: #475467; font-size: 13px; display: block; margin-bottom: 6px; }
input, picker > view { height: 40px; border: 1px solid #d0d5dd; border-radius: 10px; padding: 0 12px; box-sizing: border-box; background: #fff; }
.warning { margin-top: 16px; padding: 12px; border-radius: 12px; background: #fffbeb; color: #92400e; }
@media (max-width: 900px) {
  .admin-shell, .layout { display: block; }
  .admin-sidebar { position: static; }
  .admin-main { padding: 14px; }
  .page-head { display: block; }
  .plan-list { margin-bottom: 14px; }
  .form-grid, .benefit-editor { grid-template-columns: 1fr; }
}
</style>
