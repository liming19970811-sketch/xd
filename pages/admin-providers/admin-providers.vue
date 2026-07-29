<template>
  <view class="provider-page">
    <view class="provider-shell">
      <aside class="provider-sidebar">
        <view class="brand">
          <text class="brand-mark">AI</text>
          <view>
            <text class="brand-title">供应商与成本控制</text>
            <text class="brand-sub">Provider Cost Center</text>
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

      <main class="provider-main">
        <view v-if="!center.canAccess" class="empty-state">
          <text class="page-title">无权限访问供应商中心</text>
          <text class="page-desc">仅平台管理员和授权技术人员可访问。普通工作台不会暴露供应商成本和内部模型配置。</text>
        </view>

        <template v-else>
          <view class="page-head">
            <view>
              <text class="eyebrow">AI Provider Operations</text>
              <text class="page-title">{{ pageTitle }}</text>
              <text class="page-desc">统一管理模型能力、任务路由、超时重试、成本记录和异常告警。API 密钥只允许存储在服务端安全环境变量。</text>
            </view>
            <button class="primary-btn" @click="reload">刷新</button>
          </view>

          <view class="stat-grid">
            <view class="stat-card"><text>供应商</text><strong>{{ center.providers.length }}</strong><small>暂停/禁用 {{ center.monitoring.providerPausedCount }}</small></view>
            <view class="stat-card"><text>成功率</text><strong>{{ center.monitoring.successRate }}%</strong><small>来自真实任务/成本记录</small></view>
            <view class="stat-card"><text>超时率</text><strong>{{ center.monitoring.timeoutRate }}%</strong><small>重试 {{ center.monitoring.retryCount }} 次</small></view>
            <view class="stat-card"><text>总成本</text><strong>{{ center.monitoring.totalCost }}</strong><small>仅管理员可见</small></view>
          </view>

          <view v-if="currentTab === 'providers'" class="section">
            <view class="section-head">
              <view>
                <text class="section-title">供应商配置</text>
                <text class="section-desc">前端只展示密钥环境变量名称，不返回密钥值。</text>
              </view>
            </view>
            <view class="provider-grid">
              <view v-for="provider in center.providers" :key="provider.providerId" class="provider-card">
                <view class="card-head">
                  <view>
                    <text class="card-title">{{ provider.name }}</text>
                    <text class="row-meta">{{ provider.providerId }} · {{ provider.environments.join(' / ') }}</text>
                  </view>
                  <text class="status" :class="provider.status">{{ provider.status }}</text>
                </view>
                <view class="detail-grid">
                  <view><text>支持输入</text><strong>{{ provider.supportedInputTypes.join('、') || '-' }}</strong></view>
                  <view><text>参考图上限</text><strong>{{ provider.maxReferenceImages }}</strong></view>
                  <view><text>异步任务</text><strong>{{ provider.asyncTask ? '支持' : '不支持' }}</strong></view>
                  <view><text>超时时间</text><strong>{{ provider.timeoutMs }}ms</strong></view>
                  <view><text>重试</text><strong>{{ provider.retryRule.maxRetries }} 次 · {{ provider.retryRule.retryOn.join('/') || '不重试' }}</strong></view>
                  <view><text>密钥来源</text><strong>{{ provider.secretStorage }} · {{ provider.secretEnvNames.join(' / ') || '无' }}</strong></view>
                </view>
                <view class="chips">
                  <text v-for="capability in provider.supportedFunctions" :key="capability">{{ getCapabilityLabel(capability) }}</text>
                </view>
                <view class="actions">
                  <button class="outline-btn" @click="setProviderStatus(provider, provider.status === 'active' ? 'paused' : 'active')">{{ provider.status === 'active' ? '暂停' : '启用' }}</button>
                  <button class="outline-btn danger" @click="setProviderStatus(provider, 'disabled')">禁用</button>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentTab === 'models'" class="section">
            <view class="section-head">
              <view>
                <text class="section-title">能力矩阵</text>
                <text class="section-desc">不支持的能力必须在任务创建前阻止，不得由前端伪装成已支持。</text>
              </view>
            </view>
            <view class="matrix-table">
              <view class="matrix-row head">
                <text>能力</text>
                <text v-for="provider in center.providers" :key="provider.providerId">{{ provider.name }}</text>
              </view>
              <view v-for="capability in center.capabilityMatrix" :key="capability.key" class="matrix-row">
                <text>{{ capability.label }}</text>
                <text v-for="provider in capability.providers" :key="provider.providerId" :class="provider.supported ? 'yes' : 'no'">
                  {{ provider.supported ? `支持 ${provider.models.length} 个模型` : '不支持' }}
                </text>
              </view>
            </view>
            <view class="model-grid">
              <view v-for="model in center.models" :key="model.modelId" class="provider-card">
                <view class="card-head">
                  <view>
                    <text class="card-title">{{ model.name }}</text>
                    <text class="row-meta">{{ model.modelId }} · {{ model.modelVersion }}</text>
                  </view>
                  <text class="status">{{ model.status }}</text>
                </view>
                <view class="chips">
                  <text v-for="capability in model.capabilities" :key="capability">{{ getCapabilityLabel(capability) }}</text>
                </view>
                <view class="detail-grid two">
                  <view><text>输入成本估算</text><strong>{{ model.cost.estimatePerInput }}</strong></view>
                  <view><text>输出成本估算</text><strong>{{ model.cost.estimatePerOutput }}</strong></view>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentTab === 'routing'" class="section">
            <view class="section-head">
              <view>
                <text class="section-title">任务路由</text>
                <text class="section-desc">路由基于功能、图片数量、质量、企业等级、灰度和成本上限选择供应商。异步 taskId 返回后进入轮询，不降级提交 mock。</text>
              </view>
            </view>
            <view class="routing-list">
              <view v-for="rule in center.routes" :key="rule.ruleId" class="route-card">
                <view class="card-head">
                  <view>
                    <text class="card-title">{{ rule.name }}</text>
                    <text class="row-meta">{{ rule.ruleId }} · v{{ rule.version }}</text>
                  </view>
                  <text class="status">{{ rule.status }}</text>
                </view>
                <view class="detail-grid">
                  <view><text>功能</text><strong>{{ rule.functionTypes.map(getCapabilityLabel).join('、') }}</strong></view>
                  <view><text>图片上限</text><strong>{{ rule.maxReferenceImages }}</strong></view>
                  <view><text>企业等级</text><strong>{{ rule.enterpriseTiers.join('、') }}</strong></view>
                  <view><text>成本上限</text><strong>{{ rule.costCeiling }}</strong></view>
                  <view><text>供应商/模型</text><strong>{{ rule.providerId }} / {{ rule.modelId }}</strong></view>
                  <view><text>灰度</text><strong>{{ rule.grayScope.enabled ? `${rule.grayScope.percent}%` : '关闭' }}</strong></view>
                </view>
                <text class="route-reason">{{ rule.reason }}</text>
                <view class="actions">
                  <button class="outline-btn" @click="setRouteStatus(rule, rule.status === 'active' ? 'paused' : 'active')">{{ rule.status === 'active' ? '暂停路由' : '启用路由' }}</button>
                  <button class="outline-btn danger" @click="setRouteStatus(rule, 'archived')">归档</button>
                </view>
              </view>
            </view>
          </view>

          <view v-else class="section">
            <view class="section-head">
              <view>
                <text class="section-title">成本与告警</text>
                <text class="section-desc">成本数据仅管理员可见，不直接向普通用户暴露内部采购价。</text>
              </view>
            </view>
            <view class="alert-list">
              <view v-for="alert in center.alerts" :key="alert.alertId" class="alert-card" :class="alert.level">
                <view>
                  <text class="card-title">{{ alert.title }}</text>
                  <text class="row-meta">{{ alert.type }} · {{ alert.level }} · {{ formatDate(alert.createdAt) }}</text>
                  <text class="route-reason">{{ alert.description }}</text>
                </view>
                <button class="outline-btn" @click="resolveAlert(alert)">标记已处理</button>
              </view>
              <view v-if="!center.alerts.length" class="empty-state">暂无供应商告警。</view>
            </view>
            <view class="cost-table">
              <view class="table-row head"><text>任务</text><text>供应商/模型</text><text>功能</text><text>输入/输出</text><text>成本</text><text>状态</text><text>时间</text></view>
              <view v-for="record in center.costs" :key="record.costRecordId" class="table-row">
                <text>{{ record.taskId || record.costRecordId }}</text>
                <text>{{ record.providerId || '-' }} / {{ record.modelId || '-' }}</text>
                <text>{{ getCapabilityLabel(record.functionType) }}</text>
                <text>{{ record.inputCount }} / {{ record.outputCount }}</text>
                <text>{{ record.estimatedCost }} → {{ record.actualCost }}</text>
                <text>{{ record.status }}</text>
                <text>{{ formatDate(record.createdAt) }}</text>
              </view>
              <view v-if="!center.costs.length" class="empty-state">暂无真实供应商成本记录。未接真实 provider 的任务不会生成内部成本。</view>
            </view>
          </view>

          <view class="policy-panel">
            <text>生产环境默认禁止 mock 与 fallback 进入用户正式结果。</text>
            <text>供应商不可用时返回明确错误或排队状态，未经用户确认不得自动切换为质量明显不同的模型。</text>
            <text>超时与重试必须受最大次数和总耗时限制，不确定供应商是否接受任务时不得重新扣费提交。</text>
          </view>
        </template>
      </main>
    </view>
  </view>
</template>

<script>
import {
  PROVIDER_CAPABILITIES,
  loadProviderCostCenter,
  resolveProviderAlert,
  saveProviderStatus,
  saveRouteStatus
} from '../../utils/admin/providerCostCenter'

const TAB_MAP = {
  providers: 'providers',
  models: 'models',
  routing: 'routing',
  costs: 'costs'
}

export default {
  data() {
    return {
      currentTab: 'providers',
      tabs: [
        { key: 'providers', label: '供应商配置' },
        { key: 'models', label: '模型与能力' },
        { key: 'routing', label: '任务路由' },
        { key: 'costs', label: '成本与告警' }
      ],
      center: loadProviderCostCenter()
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '供应商与成本控制'
    }
  },
  onLoad(query = {}) {
    this.currentTab = TAB_MAP[query.tab] || 'providers'
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadProviderCostCenter()
    },
    switchTab(tab) {
      this.currentTab = tab
      uni.redirectTo({ url: `/pages/admin-providers/admin-providers?tab=${encodeURIComponent(tab)}` })
    },
    getCapabilityLabel(key) {
      const item = PROVIDER_CAPABILITIES.find((capability) => capability.key === key)
      return item ? item.label : key || '-'
    },
    setProviderStatus(provider, status) {
      const result = saveProviderStatus(provider.providerId, status)
      this.reload()
      uni.showToast({ title: result.success ? '供应商状态已更新' : '更新失败', icon: 'none' })
    },
    setRouteStatus(rule, status) {
      const result = saveRouteStatus(rule.ruleId, status)
      this.reload()
      uni.showToast({ title: result.success ? '路由状态已更新' : '更新失败', icon: 'none' })
    },
    resolveAlert(alert) {
      const result = resolveProviderAlert(alert.alertId)
      this.reload()
      uni.showToast({ title: result.success ? '告警已处理' : '处理失败', icon: 'none' })
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
.provider-page { min-height: 100vh; background: #f5f7fb; color: #101828; }
.provider-shell { display: grid; grid-template-columns: 250px minmax(0, 1fr); min-height: 100vh; }
.provider-sidebar { position: sticky; top: 0; height: 100vh; padding: 20px 14px; background: #101828; color: #d0d5dd; box-sizing: border-box; }
.brand { display: flex; gap: 10px; align-items: center; margin-bottom: 22px; }
.brand-mark { width: 38px; height: 38px; border-radius: 12px; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.brand-title, .brand-sub, .nav-item, .eyebrow, .page-title, .page-desc, .section-title, .section-desc, .card-title, .row-meta, .route-reason { display: block; }
.brand-title { color: #fff; font-weight: 900; }
.brand-sub { color: #9ca3af; font-size: 12px; margin-top: 3px; }
.nav-item { padding: 11px 12px; border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
.nav-item.active { background: #eef2ff; color: #4f46e5; font-weight: 900; }
.provider-main { padding: 24px; min-width: 0; }
.page-head, .section-head, .card-head, .actions, .alert-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; text-transform: uppercase; }
.page-title { font-size: 28px; font-weight: 900; margin-top: 6px; }
.page-desc, .section-desc, .row-meta, .route-reason { color: #667085; line-height: 1.65; margin-top: 5px; }
.primary-btn, .outline-btn { border: 0; border-radius: 10px; height: 38px; padding: 0 14px; font-size: 13px; }
.primary-btn { background: #4f46e5; color: #fff; }
.outline-btn { background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; }
.outline-btn.danger { color: #b42318; border-color: #fecaca; }
.primary-btn::after, .outline-btn::after { border: 0; }
.stat-grid, .provider-grid, .model-grid { display: grid; gap: 14px; margin-top: 18px; }
.stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.provider-grid, .model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.stat-card, .provider-card, .route-card, .policy-panel, .empty-state, .matrix-table, .cost-table, .alert-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 14px; padding: 16px; box-shadow: 0 10px 24px rgba(16, 24, 40, .04); }
.stat-card text { color: #667085; }
.stat-card strong { display: block; font-size: 26px; margin-top: 8px; }
.stat-card small { color: #98a2b3; display: block; margin-top: 5px; }
.section { margin-top: 22px; }
.section-title { font-size: 20px; font-weight: 900; }
.card-title { font-size: 17px; font-weight: 900; }
.status { border-radius: 999px; padding: 4px 10px; background: #f2f4f7; color: #475467; font-size: 12px; }
.status.active { background: #dcfce7; color: #15803d; }
.status.paused, .status.degraded { background: #fef3c7; color: #92400e; }
.status.disabled { background: #fee2e2; color: #b42318; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.detail-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.detail-grid view { background: #f8fafc; border-radius: 10px; padding: 10px; }
.detail-grid text { display: block; color: #667085; font-size: 12px; }
.detail-grid strong { display: block; margin-top: 5px; font-size: 13px; word-break: break-all; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.chips text { background: #eef2ff; color: #4f46e5; border-radius: 999px; padding: 4px 9px; font-size: 12px; }
.actions { justify-content: flex-start; margin-top: 14px; }
.matrix-table, .cost-table, .routing-list, .alert-list { display: grid; gap: 10px; margin-top: 16px; overflow-x: auto; }
.matrix-row, .table-row { min-width: 860px; display: grid; gap: 10px; align-items: center; border-bottom: 1px solid #eef2f6; padding: 10px 0; font-size: 13px; }
.matrix-row { grid-template-columns: 1.2fr repeat(2, minmax(160px, 1fr)); }
.table-row { grid-template-columns: 1.2fr 1.5fr 1fr .8fr .8fr .8fr 1fr; }
.matrix-row.head, .table-row.head { color: #667085; font-weight: 900; }
.yes { color: #15803d; font-weight: 800; }
.no { color: #b42318; }
.route-card { margin-top: 12px; }
.alert-card { margin-bottom: 10px; align-items: flex-start; }
.alert-card.high { border-color: #fecaca; }
.alert-card.medium { border-color: #fde68a; }
.policy-panel { display: grid; gap: 8px; margin-top: 22px; color: #667085; font-size: 13px; }
.empty-state { color: #667085; text-align: center; }
@media (max-width: 900px) {
  .provider-shell { display: block; }
  .provider-sidebar { position: static; height: auto; display: flex; overflow-x: auto; gap: 8px; }
  .brand { min-width: 190px; margin-bottom: 0; }
  .nav-item { min-width: 100px; text-align: center; }
  .provider-main { padding: 14px; }
  .page-head, .section-head, .card-head, .alert-card { display: block; }
  .stat-grid, .provider-grid, .model-grid, .detail-grid { grid-template-columns: 1fr; }
}
</style>
