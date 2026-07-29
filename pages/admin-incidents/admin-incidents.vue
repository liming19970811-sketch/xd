<template>
  <view class="incident-page">
    <aside class="sidebar">
      <view class="brand">
        <text class="brand-mark">BCP</text>
        <view>
          <text class="brand-title">故障应急中心</text>
          <text class="brand-sub">Business Continuity V1</text>
        </view>
      </view>
      <button
        v-for="item in tabs"
        :key="item.key"
        :class="['nav-item', { active: currentTab === item.key }]"
        @click="currentTab = item.key"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="main">
      <view v-if="!center.canAccess" class="state-card">
        <text class="page-title">无权限访问故障应急中心</text>
        <text class="page-desc">仅平台管理员和授权值班人员可查看、暂停和恢复高风险功能。</text>
      </view>

      <template v-else>
        <view class="page-head">
          <view>
            <text class="eyebrow">Incident Response</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">故障期间优先保护数据隔离、额度一致性和正式交付安全。紧急开关只暂停入口，不删除已创建数据。</text>
          </view>
          <button class="primary-btn" @click="createP1Incident">创建 P1 演练故障</button>
        </view>

        <view class="metric-grid">
          <view class="metric-card"><text>进行中故障</text><strong>{{ center.stats.openCount || 0 }}</strong></view>
          <view class="metric-card"><text>P0/P1</text><strong>{{ center.stats.p0p1Count || 0 }}</strong></view>
          <view class="metric-card"><text>已暂停开关</text><strong>{{ center.stats.pausedSwitchCount || 0 }}</strong></view>
          <view class="metric-card"><text>恢复验收</text><strong>{{ center.stats.recoveryCount || 0 }}</strong></view>
        </view>

        <view v-if="currentTab === 'incidents'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">故障记录</text>
              <text class="section-desc">记录级别、影响范围、临时措施、根因、数据修复、负责人和后续改进。</text>
            </view>
          </view>
          <view v-for="incident in center.incidents" :key="incident.incidentId" class="incident-card">
            <view class="incident-main">
              <text :class="['level', incident.level]">{{ incident.level }}</text>
              <view>
                <text class="card-title">{{ incident.title }}</text>
                <text class="row-meta">{{ incident.status }} · {{ formatDate(incident.startedAt) }} · 负责人：{{ incident.owner }}</text>
                <text class="relation">影响功能：{{ getComponentLabels(incident.affectedComponents) }}</text>
                <text class="relation">影响用户 {{ incident.affectedUserCount }} · 影响任务 {{ incident.affectedTaskCount }}</text>
              </view>
            </view>
            <view class="row-actions">
              <button class="outline-small" @click="setIncidentStatus(incident, 'mitigating')">处理中</button>
              <button class="outline-small" @click="setIncidentStatus(incident, 'recovering')">恢复验收</button>
              <button class="solid-small" @click="passRecovery(incident)">恢复通过</button>
            </view>
          </view>
          <view v-if="!center.incidents.length" class="state-card">暂无故障记录。</view>
        </view>

        <view v-else-if="currentTab === 'switches'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">紧急开关</text>
              <text class="section-desc">支持不重新部署就暂停新任务、AI功能、provider、批量任务、正式交付、API、训练和文件下载。</text>
            </view>
          </view>
          <view class="switch-grid">
            <view v-for="item in center.switches" :key="item.switchKey" class="switch-card">
              <view>
                <text class="card-title">{{ item.label }}</text>
                <text class="row-meta">{{ item.switchKey }} · {{ getComponentLabels([item.component]) }}</text>
                <text class="relation">{{ item.reason || '暂无暂停原因' }}</text>
              </view>
              <view class="switch-actions">
                <text :class="['status-pill', item.paused ? 'paused' : 'active']">{{ item.paused ? '已暂停' : '可用' }}</text>
                <button v-if="!item.paused" class="outline-small danger" @click="pauseSwitch(item)">暂停</button>
                <button v-else class="solid-small" @click="resumeSwitch(item)">恢复</button>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'recovery'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">任务恢复与额度保护</text>
              <text class="section-desc">状态未知任务先查询供应商，禁止重复提交；额度记录以幂等键和终态保护为准。</text>
            </view>
          </view>
          <view class="table">
            <view class="table-row head"><text>状态</text><text>恢复动作</text><text>保护规则</text></view>
            <view v-for="item in center.taskRecoveryRules" :key="item.state" class="table-row">
              <text>{{ item.label }}</text>
              <text>{{ item.action }}</text>
              <text>{{ item.guardrail }}</text>
            </view>
          </view>
          <view class="policy-grid">
            <view class="policy-card">
              <text class="card-title">额度保护</text>
              <text v-for="item in center.quotaGuardrails" :key="item" class="policy-line">{{ item }}</text>
            </view>
            <view class="policy-card">
              <text class="card-title">交付自动暂停条件</text>
              <text v-for="item in center.deliveryBlockers" :key="item" class="policy-line">{{ item }}</text>
            </view>
          </view>
        </view>

        <view v-else class="section">
          <view class="section-head">
            <view>
              <text class="section-title">故障分级与恢复验收</text>
              <text class="section-desc">P0/P1 必须复盘并补充回归用例，恢复前完成主链、额度、审核红线和权限隔离检查。</text>
            </view>
          </view>
          <view class="level-list">
            <view v-for="level in center.levels" :key="level.key" class="level-card">
              <text :class="['level', level.key]">{{ level.label }}</text>
              <view>
                <text class="card-title">{{ level.title }}</text>
                <text class="row-meta">负责人：{{ level.owner }}</text>
                <text class="relation">响应：{{ level.response }}</text>
                <text class="relation">恢复：{{ level.recovery }}</text>
              </view>
            </view>
          </view>
          <view class="check-grid">
            <text v-for="item in center.recoveryChecklist" :key="item">{{ item }}</text>
          </view>
        </view>
      </template>
    </main>
  </view>
</template>

<script>
import {
  createIncident,
  createRecoveryChecklist,
  loadIncidentAdminCenter,
  setEmergencySwitch,
  updateIncidentStatus
} from '../../utils/admin/incidentContinuityCenter'

export default {
  data() {
    return {
      currentTab: 'incidents',
      tabs: [
        { key: 'incidents', label: '故障记录' },
        { key: 'switches', label: '紧急开关' },
        { key: 'recovery', label: '恢复策略' },
        { key: 'levels', label: '分级与验收' }
      ],
      center: loadIncidentAdminCenter()
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '故障应急中心'
    }
  },
  onLoad(query = {}) {
    if (query.tab && this.tabs.some((item) => item.key === query.tab)) this.currentTab = query.tab
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadIncidentAdminCenter()
    },
    createP1Incident() {
      const result = createIncident({
        level: 'P1',
        title: '主链故障演练',
        description: '用于验证暂停、恢复和复盘流程。',
        affectedComponents: ['ai_output', 'task_query'],
        temporaryActions: ['暂停新任务创建', '保留已创建任务']
      })
      uni.showToast({ title: result.success ? '已创建故障' : '无权限或创建失败', icon: 'none' })
      this.reload()
    },
    setIncidentStatus(incident, status) {
      const result = updateIncidentStatus(incident.incidentId, status)
      uni.showToast({ title: result.success ? '状态已更新' : '更新失败', icon: 'none' })
      this.reload()
    },
    passRecovery(incident) {
      const checklist = (this.center.recoveryChecklist || []).map((label) => ({ label, passed: true, note: '恢复前验收通过' }))
      const recovery = createRecoveryChecklist(incident.incidentId, checklist)
      if (recovery.success) updateIncidentStatus(incident.incidentId, 'resolved')
      uni.showToast({ title: recovery.success ? '恢复验收通过' : '恢复验收失败', icon: 'none' })
      this.reload()
    },
    pauseSwitch(item) {
      const result = setEmergencySwitch(item.switchKey, true, { reason: '故障应急暂停' })
      uni.showToast({ title: result.success ? '已暂停' : '操作失败', icon: 'none' })
      this.reload()
    },
    resumeSwitch(item) {
      const result = setEmergencySwitch(item.switchKey, false, { reason: '恢复验收通过' })
      uni.showToast({ title: result.success ? '已恢复' : '操作失败', icon: 'none' })
      this.reload()
    },
    getComponentLabels(keys = []) {
      const map = {
        website: '网站',
        login: '登录',
        upload: '文件上传',
        ai_output: 'AI出图',
        pattern_making: 'AI制版',
        task_query: '任务查询',
        download_delivery: '下载与交付'
      }
      return keys.map((key) => map[key] || key).join('、') || '-'
    },
    formatDate(value = '') {
      if (!value) return '-'
      return String(value).replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.incident-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  background: #f5f7fb;
  color: #0f172a;
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 22px 16px;
  border-right: 1px solid #e2e8f0;
  background: #fff;
  box-sizing: border-box;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}
.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #4f46e5;
  color: #fff;
  font-weight: 950;
}
.brand-title,
.brand-sub,
.eyebrow,
.page-title,
.page-desc,
.section-title,
.section-desc,
.card-title,
.row-meta,
.relation,
.policy-line {
  display: block;
}
.brand-title,
.page-title,
.section-title,
.card-title {
  font-weight: 950;
}
.brand-sub,
.page-desc,
.section-desc,
.row-meta,
.relation {
  color: #64748b;
}
.nav-item {
  width: 100%;
  height: 42px;
  margin-bottom: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #475569;
  font-size: 14px;
  font-weight: 800;
  text-align: left;
}
.nav-item.active {
  background: #eef2ff;
  color: #4338ca;
}
.main {
  min-width: 0;
  padding: 24px;
  box-sizing: border-box;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}
.eyebrow {
  color: #4f46e5;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
}
.page-title {
  margin-top: 6px;
  font-size: 28px;
}
.page-desc {
  max-width: 760px;
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.65;
}
.primary-btn,
.solid-small,
.outline-small {
  border-radius: 10px;
  font-weight: 900;
}
.primary-btn,
.solid-small {
  border: 0;
  background: #4f46e5;
  color: #fff;
}
.primary-btn {
  padding: 0 18px;
  height: 42px;
}
.outline-small {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  font-size: 12px;
}
.outline-small.danger {
  border-color: #fecaca;
  color: #b91c1c;
}
.solid-small {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
}
.metric-grid,
.switch-grid,
.policy-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.metric-card,
.section,
.incident-card,
.switch-card,
.policy-card,
.level-card,
.state-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(15, 23, 42, .05);
}
.metric-card {
  padding: 16px;
}
.metric-card text {
  display: block;
  color: #64748b;
  font-size: 13px;
}
.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 26px;
}
.section,
.state-card {
  padding: 20px;
}
.section-head {
  margin-bottom: 14px;
}
.incident-card,
.switch-card,
.level-card {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  margin-top: 10px;
}
.incident-main,
.level-card {
  align-items: flex-start;
}
.incident-main {
  display: flex;
  gap: 12px;
}
.level {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 950;
}
.level.P0 {
  background: #fee2e2;
  color: #991b1b;
}
.level.P1 {
  background: #ffedd5;
  color: #9a3412;
}
.level.P2 {
  background: #fef3c7;
  color: #92400e;
}
.level.P3 {
  background: #dcfce7;
  color: #047857;
}
.row-actions,
.switch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.status-pill {
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 950;
  line-height: 26px;
}
.status-pill.active {
  background: #dcfce7;
  color: #047857;
}
.status-pill.paused {
  background: #fee2e2;
  color: #b91c1c;
}
.switch-grid,
.policy-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.switch-card {
  align-items: center;
}
.table {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}
.table-row {
  display: grid;
  grid-template-columns: 160px 180px minmax(320px, 1fr);
  min-width: 720px;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}
.table-row.head {
  background: #f8fafc;
  color: #475569;
  font-weight: 900;
}
.table-row:last-child {
  border-bottom: 0;
}
.policy-card {
  padding: 16px;
}
.policy-line {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
}
.level-list {
  display: grid;
  gap: 10px;
}
.check-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.check-grid text {
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  color: #334155;
  font-size: 13px;
}
@media (max-width: 900px) {
  .incident-page {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: static;
    height: auto;
  }
  .page-head,
  .incident-card,
  .switch-card {
    flex-direction: column;
  }
  .metric-grid,
  .switch-grid,
  .policy-grid,
  .check-grid {
    grid-template-columns: 1fr;
  }
  .row-actions,
  .switch-actions {
    justify-content: flex-start;
  }
}
</style>
