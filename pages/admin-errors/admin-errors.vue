<template>
  <view class="error-page">
    <aside class="error-sidebar">
      <view class="brand">
        <text class="brand-mark">LOG</text>
        <view>
          <text class="brand-title">错误与告警中心</text>
          <text class="brand-sub">Trace & Alert Center</text>
        </view>
      </view>
      <button
        v-for="item in tabs"
        :key="item.key"
        class="nav-item"
        :class="{ active: currentTab === item.key }"
        @click="currentTab = item.key"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="error-main">
      <view v-if="!center.canAccess" class="state-card">
        <text class="page-title">无权限访问错误中心</text>
        <text class="page-desc">仅平台管理员和授权技术人员可查看系统错误、链路追踪和告警。</text>
      </view>

      <template v-else>
        <view class="page-head">
          <view>
            <text class="eyebrow">Observability V1</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">按 requestId、traceId、taskId、projectId 和 batchId 追踪生成、额度、资产、审核与交付链路。所有敏感字段在进入页面前已脱敏。</text>
          </view>
          <button class="outline-btn" @click="reload">刷新</button>
        </view>

        <view class="metric-grid">
          <view class="metric-card"><text>日志数量</text><strong>{{ center.metrics.logCount || 0 }}</strong></view>
          <view class="metric-card"><text>错误日志</text><strong>{{ center.metrics.errorCount || 0 }}</strong></view>
          <view class="metric-card"><text>严重错误</text><strong>{{ center.metrics.criticalCount || 0 }}</strong></view>
          <view class="metric-card"><text>开放告警</text><strong>{{ center.metrics.openAlertCount || 0 }}</strong></view>
        </view>

        <view class="filter-bar">
          <input v-model.trim="filters.traceId" placeholder="traceId / requestId / taskId" />
          <input v-model.trim="filters.errorCode" placeholder="错误码" />
          <input v-model.trim="filters.provider" placeholder="provider" />
          <button class="primary-btn" @click="applyFilters">筛选</button>
        </view>

        <view v-if="currentTab === 'errors'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">错误日志</text>
              <text class="section-desc">展示 error 与 critical 级别日志，支持按错误码、provider、模型和任务筛选。</text>
            </view>
          </view>
          <view class="table">
            <view class="table-row head"><text>时间</text><text>模块 / 操作</text><text>对象</text><text>错误码</text><text>状态</text></view>
            <view v-for="log in errorLogs" :key="log.logId" class="table-row">
              <text>{{ formatDate(log.createdAt) }}</text>
              <text>{{ log.module }} / {{ log.action }}</text>
              <text>{{ log.taskId || log.projectId || log.batchId || log.traceId }}</text>
              <text>{{ log.errorCode || '-' }}</text>
              <text :class="['level', log.level]">{{ log.level }}</text>
            </view>
          </view>
          <view v-if="!errorLogs.length" class="state-card">暂无错误日志。</view>
        </view>

        <view v-else-if="currentTab === 'alerts'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">系统告警</text>
              <text class="section-desc">重复扣费、错误交付、越权访问、provider 超时和备份失败等会进入告警队列。</text>
            </view>
          </view>
          <view class="alert-list">
            <view v-for="alert in center.alerts" :key="alert.alertId" class="alert-card" :class="alert.level">
              <view>
                <text class="card-title">{{ alert.title || alert.type }}</text>
                <text class="row-meta">{{ alert.errorCode || alert.type }} · {{ alert.impactScope || 'system' }} · {{ formatDate(alert.createdAt) }}</text>
                <text class="relation">{{ alert.description }}</text>
              </view>
              <view class="alert-actions">
                <text :class="['status', alert.status]">{{ alert.status }}</text>
                <button v-if="alert.status !== 'resolved'" class="outline-btn small" @click="resolveAlert(alert)">标记解决</button>
              </view>
            </view>
          </view>
          <view v-if="!center.alerts.length" class="state-card">暂无开放告警。</view>
        </view>

        <view v-else-if="currentTab === 'trace'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">链路时间线</text>
              <text class="section-desc">输入 taskId、requestId 或 traceId 后可查看完整链路节点。</text>
            </view>
          </view>
          <view class="timeline">
            <view v-for="log in center.traceTimeline" :key="log.logId" class="timeline-row">
              <text class="dot"></text>
              <view>
                <text class="card-title">{{ log.module }} / {{ log.action }}</text>
                <text class="row-meta">{{ formatDate(log.createdAt) }} · {{ log.status || log.level }} · {{ log.durationMs }}ms</text>
                <text class="relation">requestId {{ log.requestId }} · traceId {{ log.traceId }}</text>
              </view>
            </view>
          </view>
          <view v-if="!center.traceTimeline.length" class="state-card">输入 taskId、requestId 或 traceId 后查看链路。</view>
        </view>

        <view v-else class="section">
          <view class="section-head">
            <view>
              <text class="section-title">治理策略</text>
              <text class="section-desc">统一关键链路、日志级别、告警状态和保留周期。</text>
            </view>
          </view>
          <view class="policy-grid">
            <view class="policy-card">
              <text class="card-title">关键链路日志</text>
              <view class="chips"><text v-for="item in center.coveragePlan" :key="item">{{ item }}</text></view>
            </view>
            <view class="policy-card">
              <text class="card-title">日志保留周期</text>
              <view v-for="item in center.retentionPolicies" :key="item.type" class="policy-row">
                <text>{{ item.label }}</text>
                <text>{{ item.retentionDays }} 天{{ item.protected ? ' · 受保护' : '' }}</text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </main>
  </view>
</template>

<script>
import { loadErrorAlertCenter, updateAlertStatus } from '../../utils/admin/errorAlertCenter'

export default {
  data() {
    return {
      currentTab: 'errors',
      filters: {
        traceId: '',
        errorCode: '',
        provider: ''
      },
      tabs: [
        { key: 'errors', label: '错误日志' },
        { key: 'alerts', label: '系统告警' },
        { key: 'trace', label: '链路追踪' },
        { key: 'policy', label: '治理策略' }
      ],
      center: loadErrorAlertCenter()
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '错误与告警中心'
    },
    errorLogs() {
      return (this.center.logs || []).filter((log) => ['error', 'critical'].includes(log.level))
    }
  },
  onLoad(query = {}) {
    this.currentTab = ['errors', 'alerts', 'trace', 'policy'].includes(query.tab) ? query.tab : 'errors'
    this.filters.traceId = query.traceId || query.taskId || ''
    this.filters.errorCode = query.errorCode || ''
    this.filters.provider = query.provider || ''
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadErrorAlertCenter(this.filters)
    },
    applyFilters() {
      this.reload()
      if (this.filters.traceId) this.currentTab = 'trace'
    },
    resolveAlert(alert) {
      const result = updateAlertStatus(alert.alertId, 'resolved', { content: '后台标记解决' })
      uni.showToast({ title: result.success ? '已标记解决' : '操作失败', icon: 'none' })
      this.reload()
    },
    formatDate(value) {
      if (!value) return '-'
      return String(value).replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  background: #f5f7fb;
  color: #111827;
}
.error-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 22px 16px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  box-sizing: border-box;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}
.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #4f46e5;
  color: #fff;
  font-weight: 900;
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
.relation {
  display: block;
}
.brand-title,
.card-title,
.section-title {
  font-weight: 900;
}
.brand-sub,
.row-meta,
.page-desc,
.section-desc,
.relation {
  color: #64748b;
}
.nav-item {
  width: 100%;
  height: 42px;
  margin: 0 0 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  text-align: left;
  font-size: 14px;
}
.nav-item.active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 850;
}
.error-main {
  min-width: 0;
  padding: 28px;
}
.page-head,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.page-head {
  margin-bottom: 20px;
}
.eyebrow {
  color: #4f46e5;
  font-size: 12px;
  font-weight: 900;
}
.page-title {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 950;
}
.page-desc {
  max-width: 880px;
  margin-top: 8px;
  line-height: 1.7;
  font-size: 14px;
}
.metric-grid,
.alert-list,
.policy-grid,
.timeline {
  display: grid;
  gap: 14px;
}
.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
}
.metric-card,
.section,
.state-card,
.alert-card,
.policy-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 40px rgba(15, 23, 42, .05);
  box-sizing: border-box;
}
.metric-card,
.state-card,
.alert-card,
.policy-card {
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
  font-size: 28px;
}
.filter-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 10px;
  margin-bottom: 16px;
}
.filter-bar input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #fff;
  box-sizing: border-box;
}
.section {
  padding: 20px;
}
.section-head {
  margin-bottom: 16px;
}
.table {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
}
.table-row {
  min-width: 900px;
  display: grid;
  grid-template-columns: 150px 180px 220px 180px 110px;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid #edf2f7;
  background: #fff;
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
.level,
.status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 800;
}
.level.error,
.level.critical,
.alert-card.critical {
  color: #991b1b;
  background: #fff7f7;
}
.alert-card.high {
  background: #fffaf3;
}
.alert-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.alert-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timeline-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #edf2f7;
}
.dot {
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 999px;
  background: #4f46e5;
}
.policy-grid {
  grid-template-columns: 1.2fr .8fr;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.chips text {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 800;
}
.policy-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #edf2f7;
}
.policy-row:last-child {
  border-bottom: 0;
}
.outline-btn,
.primary-btn {
  min-height: 38px;
  margin: 0;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 850;
}
.outline-btn {
  border: 1px solid #c7d2fe;
  background: #fff;
  color: #4338ca;
}
.outline-btn.small {
  min-height: 32px;
  font-size: 12px;
}
.primary-btn {
  border: 0;
  background: #4f46e5;
  color: #fff;
}
@media screen and (max-width: 900px) {
  .error-page {
    grid-template-columns: 1fr;
  }
  .error-sidebar {
    position: static;
    height: auto;
    display: flex;
    overflow-x: auto;
    gap: 8px;
  }
  .brand {
    min-width: 190px;
    margin-bottom: 0;
  }
  .nav-item {
    min-width: 96px;
    text-align: center;
  }
  .error-main {
    padding: 18px;
  }
  .page-head,
  .section-head,
  .alert-card {
    align-items: flex-start;
    flex-direction: column;
  }
  .metric-grid,
  .filter-bar,
  .policy-grid {
    grid-template-columns: 1fr;
  }
}
</style>
