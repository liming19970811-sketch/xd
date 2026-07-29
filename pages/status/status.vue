<template>
  <view class="status-page">
    <view class="hero">
      <view>
        <text class="eyebrow">Diebian Status</text>
        <text class="title">系统状态</text>
        <text class="desc">公开状态页仅展示用户可理解的服务状态，不展示内部供应商、服务器地址或安全细节。</text>
      </view>
      <view :class="['overall', status.overallStatus]">
        <text>{{ getStatusLabel(status.overallStatus) }}</text>
        <text class="time">更新：{{ formatDate(status.updatedAt) }}</text>
      </view>
    </view>

    <view class="component-grid">
      <view v-for="item in status.components" :key="item.key" class="component-card">
        <view class="component-head">
          <text class="component-title">{{ item.label }}</text>
          <text :class="['status-pill', item.status]">{{ item.statusLabel }}</text>
        </view>
        <text class="component-desc">{{ getComponentDesc(item.status) }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">当前故障</text>
        <text class="section-desc">只展示受影响功能和用户下一步，不展示内部错误堆栈。</text>
      </view>
      <view v-if="!status.activeIncidents.length" class="empty-card">
        <text class="empty-title">暂无进行中的故障</text>
        <text class="empty-desc">如遇到任务或交付异常，请保留任务编号并联系支持。</text>
      </view>
      <view v-for="incident in status.activeIncidents" :key="incident.incidentId" class="incident-card">
        <view>
          <text class="incident-title">{{ incident.title }}</text>
          <text class="incident-meta">{{ incident.level }} · {{ incident.status }} · {{ formatDate(incident.updatedAt || incident.startedAt) }}</text>
        </view>
        <text class="incident-scope">影响：{{ incident.affectedComponents.join('、') || '部分功能' }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">故障期间说明</text>
        <text class="section-desc">发生异常时，我们优先保护任务、额度、资产和正式交付的一致性。</text>
      </view>
      <view class="notice-list">
        <text v-for="item in status.userNoticeRules" :key="item">{{ item }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { loadPublicStatusPage } from '../../utils/admin/incidentContinuityCenter'

export default {
  data() {
    return {
      status: loadPublicStatusPage()
    }
  },
  onShow() {
    this.reload()
  },
  methods: {
    reload() {
      this.status = loadPublicStatusPage()
    },
    getStatusLabel(status = '') {
      const map = {
        operational: '全部服务正常',
        degraded: '部分服务性能下降',
        partial_outage: '部分服务中断',
        major_outage: '重大故障处理中',
        maintenance: '维护中'
      }
      return map[status] || '状态未知'
    },
    getComponentDesc(status = '') {
      const map = {
        operational: '当前可正常使用。',
        degraded: '可能出现速度变慢或少量失败。',
        partial_outage: '部分用户或功能暂不可用。',
        major_outage: '高风险功能已暂停，等待恢复确认。',
        maintenance: '已临时暂停，数据会保留。'
      }
      return map[status] || '请稍后重试。'
    },
    formatDate(value = '') {
      if (!value) return '-'
      return String(value).replace('T', ' ').slice(0, 16)
    }
  }
}
</script>

<style scoped>
.status-page {
  min-height: 100vh;
  padding: 32px;
  background: #f6f8fc;
  color: #0f172a;
  box-sizing: border-box;
}
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  max-width: 1120px;
  margin: 0 auto 22px;
  padding: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 18px 50px rgba(15, 23, 42, .08);
}
.eyebrow,
.title,
.desc,
.component-title,
.component-desc,
.section-title,
.section-desc,
.empty-title,
.empty-desc,
.incident-title,
.incident-meta,
.incident-scope,
.time {
  display: block;
}
.eyebrow {
  color: #4f46e5;
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
}
.title {
  margin-top: 8px;
  font-size: 34px;
  font-weight: 950;
}
.desc {
  max-width: 680px;
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.7;
}
.overall {
  min-width: 190px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #eef2ff;
  color: #3730a3;
  font-weight: 900;
  text-align: right;
}
.overall.operational {
  background: #ecfdf5;
  color: #047857;
}
.overall.degraded,
.overall.maintenance {
  background: #fffbeb;
  color: #b45309;
}
.overall.partial_outage,
.overall.major_outage {
  background: #fef2f2;
  color: #b91c1c;
}
.time {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  opacity: .74;
}
.component-grid,
.section {
  max-width: 1120px;
  margin: 0 auto 18px;
}
.component-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.component-card,
.section,
.empty-card,
.incident-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(15, 23, 42, .05);
}
.component-card {
  padding: 18px;
}
.component-head,
.incident-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.component-title,
.section-title,
.empty-title,
.incident-title {
  font-size: 16px;
  font-weight: 900;
}
.component-desc,
.section-desc,
.empty-desc,
.incident-meta,
.incident-scope {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
}
.status-pill {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 900;
  line-height: 24px;
  white-space: nowrap;
}
.status-pill.operational {
  background: #dcfce7;
  color: #047857;
}
.status-pill.degraded,
.status-pill.maintenance {
  background: #fef3c7;
  color: #b45309;
}
.status-pill.partial_outage,
.status-pill.major_outage {
  background: #fee2e2;
  color: #b91c1c;
}
.section {
  padding: 20px;
  box-sizing: border-box;
}
.section-head {
  margin-bottom: 14px;
}
.empty-card,
.incident-card {
  padding: 16px;
}
.incident-card {
  align-items: flex-start;
  margin-top: 10px;
}
.incident-scope {
  text-align: right;
}
.notice-list {
  display: grid;
  gap: 10px;
}
.notice-list text {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}
@media (max-width: 860px) {
  .status-page {
    padding: 16px;
  }
  .hero,
  .component-head,
  .incident-card {
    flex-direction: column;
  }
  .overall,
  .incident-scope {
    width: 100%;
    text-align: left;
    box-sizing: border-box;
  }
  .component-grid {
    grid-template-columns: 1fr;
  }
}
</style>
