<template>
  <view class="release-page">
    <aside class="release-sidebar">
      <view class="brand">
        <text class="brand-mark">REL</text>
        <view>
          <text class="brand-title">发布与灰度中心</text>
          <text class="brand-sub">Release Control V1</text>
        </view>
      </view>
      <button
        v-for="item in tabs"
        :key="item.key"
        class="nav-item"
        :class="{ active: currentTab === item.key }"
        @click="switchTab(item.key)"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="release-main">
      <view v-if="!center.canAccess" class="state-card">
        <text class="page-title">无权限访问发布管控中心</text>
        <text class="page-desc">仅平台管理员和授权发布人员可查看版本、功能开关和灰度配置。</text>
      </view>

      <template v-else>
        <view class="page-head">
          <view>
            <text class="eyebrow">Release Governance</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">统一控制官网、小程序、后台和 AI 能力的上线范围，阻止高风险配置组合进入发布流程。</text>
          </view>
          <view class="head-actions">
            <button class="outline-btn" @click="reload">刷新</button>
            <button class="primary-btn" @click="createDraft">创建发布草稿</button>
          </view>
        </view>

        <view class="metric-grid">
          <view class="metric-card"><text>发布记录</text><strong>{{ center.stats.releaseCount || 0 }}</strong></view>
          <view class="metric-card"><text>功能开关</text><strong>{{ center.stats.flagCount || 0 }}</strong></view>
          <view class="metric-card"><text>灰度中</text><strong>{{ center.stats.grayCount || 0 }}</strong></view>
          <view class="metric-card"><text>已关闭</text><strong>{{ center.stats.disabledCount || 0 }}</strong></view>
        </view>

        <view class="filter-bar">
          <input v-model.trim="filters.keyword" placeholder="搜索版本、Git提交、功能或原因" />
          <picker :range="environmentOptions" :value="environmentIndex" @change="changeEnvironment">
            <view class="picker-value">{{ environmentOptions[environmentIndex] }}</view>
          </picker>
          <button class="outline-btn" @click="applyFilters">筛选</button>
        </view>

        <view v-if="currentTab === 'releases'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">版本记录</text>
              <text class="section-desc">发布流程从草稿、测试、预发布验证、人工批准到灰度和正式发布，回滚不删除任务、额度和资产。</text>
            </view>
          </view>
          <view class="release-flow">
            <text v-for="step in center.flow" :key="step">{{ step }}</text>
          </view>
          <view class="table">
            <view class="table-row head"><text>版本</text><text>环境 / 模块</text><text>Git提交</text><text>状态</text><text>操作</text></view>
            <view v-for="item in center.releases" :key="item.releaseId" class="table-row">
              <view>
                <text class="row-title">{{ item.version }}</text>
                <text class="row-meta">{{ item.releaseId }}</text>
              </view>
              <view>
                <text>{{ item.environment }}</text>
                <text class="row-meta">{{ item.modules.join('、') }}</text>
              </view>
              <text>{{ item.gitCommit || '-' }}</text>
              <text :class="['status', item.status]">{{ getReleaseStatusLabel(item.status) }}</text>
              <view class="row-actions">
                <button class="outline-small" @click="advance(item, 'gray_running')">小范围灰度</button>
                <button class="solid-small" @click="advance(item, 'released')">正式发布</button>
                <button class="outline-small danger" @click="rollback(item)">回滚</button>
              </view>
            </view>
          </view>
          <view v-if="!center.releases.length" class="state-card">暂无发布记录，可先创建发布草稿。</view>
        </view>

        <view v-else-if="currentTab === 'flags'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">功能开关</text>
              <text class="section-desc">关闭后前端展示明确提示，业务调用侧应统一读取同一套受控配置，不保留隐藏可调用入口。</text>
            </view>
          </view>
          <view class="flag-grid">
            <view v-for="flag in center.flags" :key="flag.flagKey" class="flag-card">
              <view class="flag-head">
                <view>
                  <text class="row-title">{{ flag.name }}</text>
                  <text class="row-meta">{{ flag.flagKey }} · {{ flag.module }}</text>
                </view>
                <text :class="['status', flag.emergencyOff ? 'disabled' : flag.status]">{{ flag.emergencyOff ? '紧急关闭' : getFlagStatusLabel(flag.status) }}</text>
              </view>
              <view class="flag-detail">
                <text>默认：{{ flag.defaultEnabled ? '开启' : '关闭' }}</text>
                <text>灰度比例：{{ flag.grayScope.trafficRatio }}%</text>
                <text>环境：{{ flag.grayScope.environments.join('、') || '未限定' }}</text>
                <text>原因：{{ flag.reason || '-' }}</text>
              </view>
              <view class="flag-actions">
                <button class="outline-small" @click="setFlag(flag, 'gray')">设为灰度</button>
                <button class="solid-small" @click="setFlag(flag, 'enabled')">开启</button>
                <button class="outline-small danger" @click="setFlag(flag, 'disabled')">关闭</button>
                <button class="outline-small danger" @click="emergencyClose(flag)">紧急关闭</button>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'environments'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">环境与生效结果</text>
              <text class="section-desc">配置优先级：紧急全局关闭 → 环境配置 → 企业配置 → 用户灰度 → 默认配置。</text>
            </view>
          </view>
          <view class="priority-strip">
            <text v-for="item in center.priority" :key="item">{{ item }}</text>
          </view>
          <view class="env-grid">
            <view v-for="env in center.environments" :key="env.environmentId" class="env-card">
              <text class="row-title">{{ env.label }}</text>
              <text class="row-meta">{{ env.name }} · {{ env.configVersion }}</text>
              <view class="flag-detail">
                <text>云环境：{{ env.cloudEnvId }}</text>
                <text>Mock：{{ env.mockAllowed ? '允许' : '禁止' }}</text>
                <text>真实 Provider：{{ env.realProviderAllowed ? '允许' : '禁止' }}</text>
              </view>
            </view>
          </view>
          <view class="table">
            <view class="table-row head"><text>功能</text><text>是否生效</text><text>命中来源</text><text>命中原因</text><text>提示</text></view>
            <view v-for="item in center.effectiveResults" :key="item.flagKey" class="table-row">
              <text>{{ item.name }}</text>
              <text :class="['status', item.enabled ? 'enabled' : 'disabled']">{{ item.enabled ? '可用' : '不可用' }}</text>
              <text>{{ item.source }}</text>
              <text>{{ item.reason }}</text>
              <text>{{ item.message || '-' }}</text>
            </view>
          </view>
        </view>

        <view v-else class="section">
          <view class="section-head">
            <view>
              <text class="section-title">风险组合与审计</text>
              <text class="section-desc">高风险组合会阻止保存或发布，所有开关和发布操作都会记录操作人、前后值、生效范围和原因。</text>
            </view>
          </view>
          <view class="policy-grid">
            <view class="policy-card">
              <text class="card-title">禁止组合</text>
              <view v-for="rule in center.forbiddenRules" :key="rule.comboId" class="policy-row">
                <text>{{ rule.title }}</text>
                <text :class="['status', rule.severity]">{{ rule.severity }}</text>
              </view>
            </view>
            <view class="policy-card">
              <text class="card-title">回滚能力</text>
              <view class="chips"><text v-for="item in center.rollbackOptions" :key="item">{{ item }}</text></view>
            </view>
          </view>
          <view class="table">
            <view class="table-row head"><text>时间</text><text>操作</text><text>资源</text><text>操作人</text><text>原因</text></view>
            <view v-for="item in center.audits" :key="item.auditId" class="table-row">
              <text>{{ formatDate(item.createdAt) }}</text>
              <text>{{ item.action }}</text>
              <text>{{ item.resourceId }}</text>
              <text>{{ item.operatorName }}</text>
              <text>{{ item.reason || '-' }}</text>
            </view>
          </view>
        </view>
      </template>
    </main>
  </view>
</template>

<script>
import {
  advanceReleaseStatus,
  createReleaseDraft,
  emergencyCloseFeature,
  loadReleaseControlCenter,
  rollbackRelease,
  updateFeatureFlag
} from '../../utils/admin/releaseControlCenter'

export default {
  data() {
    return {
      currentTab: 'releases',
      filters: {
        keyword: '',
        environment: 'production'
      },
      environmentOptions: ['production', 'staging', 'development'],
      environmentIndex: 0,
      tabs: [
        { key: 'releases', label: '版本发布' },
        { key: 'flags', label: '功能开关' },
        { key: 'environments', label: '环境与灰度' },
        { key: 'audit', label: '风险与审计' }
      ],
      center: loadReleaseControlCenter({ environment: 'production' })
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '发布与灰度中心'
    }
  },
  onLoad(query = {}) {
    this.currentTab = ['releases', 'flags', 'environments', 'audit'].includes(query.tab) ? query.tab : 'releases'
    if (query.environment && this.environmentOptions.includes(query.environment)) {
      this.filters.environment = query.environment
      this.environmentIndex = this.environmentOptions.indexOf(query.environment)
    }
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadReleaseControlCenter(this.filters)
    },
    switchTab(tab) {
      this.currentTab = tab
      uni.redirectTo({ url: `/pages/admin-release-control/admin-release-control?tab=${encodeURIComponent(tab)}&environment=${encodeURIComponent(this.filters.environment)}` })
    },
    applyFilters() {
      this.reload()
    },
    changeEnvironment(event) {
      this.environmentIndex = Number(event.detail && event.detail.value || 0)
      this.filters.environment = this.environmentOptions[this.environmentIndex] || 'production'
      this.reload()
    },
    createDraft() {
      const result = createReleaseDraft({
        version: `v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}`,
        gitCommit: 'manual-check-required',
        environment: this.filters.environment,
        modules: ['website', 'admin'],
        summary: '发布草稿：等待自动测试、迁移预检和人工批准。',
        migrationVersion: 'pending',
        configVersion: 'pending',
        acceptanceReport: 'pending',
        rollbackVersion: 'previous_stable',
        grayScope: { environments: [this.filters.environment], trafficRatio: 1 },
        safetyConfig: {
          realQuota: false,
          mockGeneration: false,
          formalDelivery: false,
          fallbackResult: false,
          patternProductionReady: false,
          patternReviewed: false,
          trainingEnabled: false,
          trainingAuthorized: false,
          realProviderCall: false,
          quotaIdempotency: true,
          adminOpen: true,
          permissionGuard: true
        },
        reason: '后台创建发布草稿'
      })
      uni.showToast({ title: result.success ? '已创建草稿' : this.getErrorLabel(result.errorCode), icon: 'none' })
      this.reload()
    },
    advance(item, status) {
      const result = advanceReleaseStatus(item.releaseId, status, status === 'released' ? '人工批准后发布' : '进入小范围灰度')
      uni.showToast({ title: result.success ? '状态已更新' : this.getErrorLabel(result.errorCode), icon: 'none' })
      this.reload()
    },
    rollback(item) {
      const result = rollbackRelease(item.releaseId, '后台紧急回滚')
      uni.showToast({ title: result.success ? '已回滚' : this.getErrorLabel(result.errorCode), icon: 'none' })
      this.reload()
    },
    setFlag(flag, status) {
      const result = updateFeatureFlag(flag.flagKey, {
        status,
        emergencyOff: false,
        defaultEnabled: status === 'enabled',
        reason: `后台设置为 ${status}`
      })
      uni.showToast({ title: result.success ? '开关已更新' : this.getErrorLabel(result.errorCode), icon: 'none' })
      this.reload()
    },
    emergencyClose(flag) {
      const result = emergencyCloseFeature(flag.flagKey, '后台紧急关闭单一功能')
      uni.showToast({ title: result.success ? '已紧急关闭' : this.getErrorLabel(result.errorCode), icon: 'none' })
      this.reload()
    },
    getReleaseStatusLabel(status) {
      const map = {
        draft: '草稿',
        testing: '测试中',
        staging_verified: '预发布通过',
        approved: '已批准',
        gray_running: '灰度中',
        released: '已发布',
        rolled_back: '已回滚'
      }
      return map[status] || status
    },
    getFlagStatusLabel(status) {
      const map = { enabled: '开启', disabled: '关闭', gray: '灰度' }
      return map[status] || status
    },
    getErrorLabel(errorCode) {
      const map = {
        platform_admin_required: '无权限',
        forbidden_combination: '存在禁止组合',
        flag_not_found: '功能不存在',
        release_not_found: '发布不存在'
      }
      return map[errorCode] || '操作失败'
    },
    formatDate(value) {
      if (!value) return '-'
      return String(value).replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.release-page { min-height: 100vh; display: grid; grid-template-columns: 236px minmax(0, 1fr); background: #f5f7fb; color: #111827; }
.release-sidebar { position: sticky; top: 0; height: 100vh; padding: 22px 16px; background: #fff; border-right: 1px solid #e5e7eb; box-sizing: border-box; }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
.brand-mark { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #4f46e5; color: #fff; font-weight: 900; }
.brand-title, .brand-sub, .eyebrow, .page-title, .page-desc, .section-title, .section-desc, .row-title, .row-meta, .card-title { display: block; }
.brand-title, .page-title, .section-title, .row-title, .card-title { font-weight: 900; }
.brand-sub, .page-desc, .section-desc, .row-meta { color: #64748b; }
.nav-item { width: 100%; height: 42px; margin: 0 0 8px; border: 0; border-radius: 10px; background: transparent; color: #475569; text-align: left; font-weight: 800; }
.nav-item.active { background: #eef2ff; color: #4f46e5; }
.release-main { min-width: 0; padding: 28px; box-sizing: border-box; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.head-actions, .row-actions, .flag-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; text-transform: uppercase; }
.page-title { margin-top: 6px; color: #0f172a; font-size: 28px; }
.page-desc { max-width: 780px; margin-top: 8px; line-height: 1.6; }
.metric-grid, .flag-grid, .env-grid, .policy-grid { display: grid; gap: 14px; }
.metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px; }
.metric-card, .state-card, .section, .flag-card, .env-card, .policy-card { border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, .05); box-sizing: border-box; }
.metric-card { padding: 16px; }
.metric-card text { display: block; color: #64748b; font-size: 13px; }
.metric-card strong { display: block; margin-top: 6px; color: #0f172a; font-size: 26px; }
.state-card { padding: 22px; color: #64748b; }
.filter-bar { display: grid; grid-template-columns: minmax(260px, 1fr) 180px 100px; gap: 10px; margin-bottom: 14px; }
.filter-bar input, .picker-value { height: 42px; padding: 0 12px; border: 1px solid #dbe3ef; border-radius: 10px; background: #fff; box-sizing: border-box; color: #0f172a; }
.picker-value { display: flex; align-items: center; }
.section { padding: 18px; }
.section-head { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.section-title { color: #0f172a; font-size: 20px; }
.section-desc { margin-top: 5px; font-size: 13px; line-height: 1.55; }
.release-flow, .priority-strip, .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.release-flow text, .priority-strip text, .chips text { padding: 7px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 12px; font-weight: 850; }
.table { width: 100%; overflow-x: auto; }
.table-row { min-width: 920px; display: grid; grid-template-columns: 1.2fr 1.2fr 1fr .8fr 1.6fr; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid #eef2f7; }
.table-row.head { color: #64748b; font-size: 12px; font-weight: 900; border-top: 0; }
.status { display: inline-flex; width: fit-content; align-items: center; padding: 5px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 900; }
.status.enabled, .status.released, .status.approved { background: #ecfdf5; color: #047857; }
.status.gray, .status.gray_running, .status.medium { background: #fff7ed; color: #c2410c; }
.status.disabled, .status.rolled_back, .status.high, .status.critical { background: #fef2f2; color: #dc2626; }
.flag-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.flag-card, .env-card, .policy-card { padding: 16px; }
.flag-head { display: flex; justify-content: space-between; gap: 10px; }
.flag-detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0; color: #475569; font-size: 13px; }
.env-grid, .policy-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 14px; }
.policy-row { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid #eef2f7; color: #475569; }
.primary-btn, .outline-btn, .solid-small, .outline-small { border-radius: 10px; font-weight: 900; }
.primary-btn, .solid-small { border: 0; background: #4f46e5; color: #fff; }
.outline-btn, .outline-small { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
.primary-btn, .outline-btn { height: 42px; padding: 0 14px; }
.solid-small, .outline-small { min-height: 32px; padding: 0 10px; font-size: 12px; }
.outline-small.danger { border-color: #fecaca; color: #dc2626; }
@media (max-width: 900px) {
  .release-page { grid-template-columns: 1fr; }
  .release-sidebar { position: static; height: auto; display: flex; gap: 8px; overflow-x: auto; }
  .brand { min-width: 180px; margin-bottom: 0; }
  .nav-item { min-width: 110px; text-align: center; }
  .release-main { padding: 18px; }
  .page-head { flex-direction: column; }
  .metric-grid, .flag-grid, .env-grid, .policy-grid, .filter-bar { grid-template-columns: 1fr; }
  .flag-detail { grid-template-columns: 1fr; }
}
</style>
