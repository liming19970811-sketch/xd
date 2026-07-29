<template>
  <view class="efficiency-page">
    <view v-if="!center.canAccess" class="state-card">
      <text class="state-title">无权限查看项目效益</text>
      <text class="state-desc">请确认当前企业成员状态有效，并具备 analytics.view 权限。</text>
    </view>

    <template v-else>
      <view class="page-head">
        <view>
          <text class="eyebrow">Project Efficiency</text>
          <text class="page-title">项目效益中心</text>
          <text class="page-desc">面向企业管理员查看本企业 AI 出图、AI 制版、审核与交付效率，所有数据按当前企业隔离。</text>
        </view>
        <view class="head-actions">
          <picker mode="selector" :range="periodLabels" :value="periodIndex" @change="onPeriodChange">
            <view class="select-pill">{{ currentPeriodLabel }}</view>
          </picker>
          <button class="primary-btn" @click="reload">刷新</button>
        </view>
      </view>

      <view class="policy-card">
        <text>{{ center.dataPolicy.message }}</text>
        <text>当前企业：{{ center.enterpriseId || '未选择' }}</text>
      </view>

      <view class="quick-grid">
        <view class="quick-card">
          <text>真实任务</text>
          <strong>{{ center.summary.taskCount }}</strong>
          <small>成功率 {{ center.summary.successRate }}%</small>
        </view>
        <view class="quick-card">
          <text>交付数量</text>
          <strong>{{ center.summary.deliveryCount }}</strong>
          <small>审核通过率 {{ center.summary.approvalRate }}%</small>
        </view>
        <view class="quick-card">
          <text>AI 成本</text>
          <strong>{{ formatMoney(center.summary.aiCost) }}</strong>
          <small>仅真实成本记录</small>
        </view>
        <view class="quick-card">
          <text>额度收入</text>
          <strong>{{ center.summary.quotaIncome }}</strong>
          <small>不含 mock / fallback</small>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">项目效益列表</text>
          <text class="section-desc">每个项目展示任务、图片、审核、修订、交付和成本；无传统基准时不显示虚假节省比例。</text>
        </view>
        <view class="project-grid">
          <view v-for="project in center.projectMetrics" :key="project.projectId" class="project-card">
            <view class="card-head">
              <view>
                <text class="card-title">{{ project.projectName }}</text>
                <text class="muted">{{ project.status }} · {{ project.owner }}</text>
              </view>
              <text class="status">{{ project.deliveryCount ? '有交付' : '未交付' }}</text>
            </view>
            <view class="metric-grid">
              <view><text>任务</text><strong>{{ project.taskCount }}</strong></view>
              <view><text>生成图片</text><strong>{{ project.generatedImageCount }}</strong></view>
              <view><text>通过图片</text><strong>{{ project.approvedImageCount }}</strong></view>
              <view><text>修订次数</text><strong>{{ project.revisionCount }}</strong></view>
              <view><text>AI 成本</text><strong>{{ formatMoney(project.aiCost) }}</strong></view>
              <view><text>单交付成本</text><strong>{{ formatMoney(project.costPerDeliveredAsset) }}</strong></view>
            </view>
            <text class="baseline">{{ project.timeComparisonLabel }}</text>
          </view>
          <view v-if="!center.projectMetrics.length" class="empty-state">暂无项目数据。创建项目并产生真实任务后会在这里展示效益。</view>
        </view>
      </view>

      <view class="two-col">
        <view class="section">
          <view class="section-head">
            <text class="section-title">功能价值判断</text>
            <text class="section-desc">用于判断下一阶段功能优先级，不使用虚假 ROI。</text>
          </view>
          <view class="segment-list">
            <view v-for="segment in center.valueSegments" :key="segment.key" class="segment-row">
              <view>
                <text class="card-title">{{ segment.label }}</text>
                <text class="muted">{{ segment.action }}</text>
              </view>
              <view class="chips">
                <text v-for="feature in segment.features" :key="feature.functionType">{{ feature.functionType }}</text>
                <text v-if="!segment.features.length">暂无</text>
              </view>
            </view>
          </view>
        </view>

        <view class="section">
          <view class="section-head">
            <text class="section-title">异常成本</text>
            <text class="section-desc">发现重复生成、超时、空结果和回滚异常后应优先排查。</text>
          </view>
          <view class="anomaly-list">
            <view v-for="item in center.anomalies" :key="item.anomalyId" class="anomaly-row" :class="item.level">
              <text class="card-title">{{ item.title }}</text>
              <text class="muted">{{ item.type }} · {{ item.targetId || '全局' }}</text>
            </view>
            <view v-if="!center.anomalies.length" class="empty-state">暂无异常成本信号。</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">AI 制版效益</text>
          <text class="section-desc">关注版师修改量、审核通过、版型复用和模型版本影响。</text>
        </view>
        <view class="quick-grid compact">
          <view class="quick-card"><text>制版任务</text><strong>{{ center.patternMetrics.patternTaskCount }}</strong><small>真实任务</small></view>
          <view class="quick-card"><text>审核耗时</text><strong>{{ center.patternMetrics.aiDraftToApprovalHours }}h</strong><small>初稿到通过</small></view>
          <view class="quick-card"><text>平均修改项</text><strong>{{ center.patternMetrics.averageRevisionItems }}</strong><small>版师修订</small></view>
          <view class="quick-card"><text>版型库复用</text><strong>{{ center.patternMetrics.patternReuseCount }}</strong><small>复用次数</small></view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { BUSINESS_METRIC_PERIODS, loadProjectEfficiencyCenter } from '../../utils/admin/businessMetricsCenter'

export default {
  data() {
    return {
      periods: BUSINESS_METRIC_PERIODS,
      period: '30d',
      center: loadProjectEfficiencyCenter({ period: '30d' })
    }
  },
  computed: {
    periodLabels() {
      return this.periods.map((item) => item.label)
    },
    periodIndex() {
      return Math.max(0, this.periods.findIndex((item) => item.key === this.period))
    },
    currentPeriodLabel() {
      return (this.periods.find((item) => item.key === this.period) || this.periods[1]).label
    }
  },
  onLoad() {
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadProjectEfficiencyCenter({ period: this.period })
    },
    onPeriodChange(event) {
      const index = Number(event.detail.value) || 0
      this.period = this.periods[index].key
      this.reload()
    },
    formatMoney(value) {
      return `¥${Number(value || 0).toFixed(2)}`
    }
  }
}
</script>

<style scoped>
.efficiency-page { min-height: 100vh; padding: 24px; background: #f7f8fb; color: #111827; }
.page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
.eyebrow { display: block; color: #4f46e5; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.page-title { display: block; margin-top: 6px; font-size: 26px; font-weight: 800; }
.page-desc { display: block; margin-top: 8px; max-width: 720px; color: #64748b; line-height: 1.7; }
.head-actions { display: flex; gap: 10px; }
.primary-btn, .select-pill { height: 40px; padding: 0 16px; border-radius: 8px; border: 0; background: #4f46e5; color: #fff; line-height: 40px; font-size: 14px; }
.select-pill { background: #fff; color: #111827; border: 1px solid #dbe3ef; }
.policy-card, .section, .quick-card, .project-card, .state-card, .segment-row, .anomaly-row { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 26px rgba(15, 23, 42, 0.04); }
.policy-card { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 14px; margin-bottom: 16px; color: #334155; font-size: 13px; }
.quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
.quick-grid.compact { margin-bottom: 0; }
.quick-card { padding: 15px; }
.quick-card text, .quick-card small { display: block; color: #64748b; font-size: 13px; }
.quick-card strong { display: block; margin: 8px 0; font-size: 24px; }
.section { padding: 18px; margin-bottom: 16px; }
.section-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.section-title { font-size: 18px; font-weight: 800; }
.section-desc, .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.project-card { padding: 15px; box-shadow: none; }
.card-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
.card-title { display: block; font-weight: 800; }
.status { padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; white-space: nowrap; }
.metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.metric-grid view { padding: 9px; border-radius: 8px; background: #f8fafc; }
.metric-grid text { display: block; color: #64748b; font-size: 12px; }
.metric-grid strong { display: block; margin-top: 4px; font-size: 16px; }
.baseline { display: block; margin-top: 12px; color: #475569; font-size: 13px; line-height: 1.6; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.segment-list, .anomaly-list { display: flex; flex-direction: column; gap: 10px; }
.segment-row, .anomaly-row { padding: 13px; box-shadow: none; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chips text { padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; }
.anomaly-row.high { border-color: #fecaca; background: #fff7f7; }
.anomaly-row.medium { border-color: #fde68a; background: #fffbeb; }
.empty-state, .state-card { padding: 18px; color: #64748b; text-align: center; }
.state-title { display: block; font-size: 22px; color: #111827; font-weight: 800; }
.state-desc { display: block; margin-top: 8px; }
@media (max-width: 900px) {
  .efficiency-page { padding: 16px; }
  .page-head, .head-actions { flex-direction: column; width: 100%; }
  .quick-grid, .project-grid, .two-col { grid-template-columns: 1fr; }
}
</style>
