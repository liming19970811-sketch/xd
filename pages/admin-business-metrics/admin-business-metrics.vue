<template>
  <view class="metrics-page">
    <view v-if="!center.canAccess" class="state-card">
      <text class="state-title">无权限查看经营效益中心</text>
      <text class="state-desc">仅平台管理员和授权经营分析人员可查看全局成本、收入与模型效益数据。</text>
    </view>

    <template v-else>
      <view class="page-head">
        <view>
          <text class="eyebrow">Business Metrics</text>
          <text class="page-title">成本、效率与经营效益中心</text>
          <text class="page-desc">用真实任务、成本、审核与交付数据判断 AI 功能是否节省时间、降低成本并产生商业价值。</text>
        </view>
        <view class="head-actions">
          <picker mode="selector" :range="periodLabels" :value="periodIndex" @change="onPeriodChange">
            <view class="select-pill">{{ currentPeriodLabel }}</view>
          </picker>
          <button class="primary-btn" @click="reload">刷新</button>
        </view>
      </view>

      <view class="policy-strip">
        <text>{{ center.dataPolicy.message }}</text>
        <text>mock、fallback、开发测试和内部自动任务已排除。</text>
      </view>

      <view class="stat-grid">
        <view class="stat-card">
          <text>真实任务</text>
          <strong>{{ center.summary.taskCount }}</strong>
          <small>功能 {{ center.summary.featureCount }} 项</small>
        </view>
        <view class="stat-card">
          <text>AI 调用成本</text>
          <strong>{{ formatMoney(center.summary.aiCost) }}</strong>
          <small>来自 provider 成本记录</small>
        </view>
        <view class="stat-card">
          <text>用户额度收入</text>
          <strong>{{ center.summary.quotaIncome }}</strong>
          <small>按任务额度记录汇总</small>
        </view>
        <view class="stat-card">
          <text>生成成功率</text>
          <strong>{{ center.summary.successRate }}%</strong>
          <small>审核通过率 {{ center.summary.approvalRate }}%</small>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">功能效益矩阵</text>
          <text class="section-desc">按使用量和通过率分组，辅助判断继续投入、优化、限制开放或暂停投入。</text>
        </view>
        <view class="segment-grid">
          <view v-for="segment in center.valueSegments" :key="segment.key" class="segment-card">
            <text class="segment-title">{{ segment.label }}</text>
            <text class="segment-action">{{ segment.action }}</text>
            <view class="chips">
              <text v-for="feature in segment.features" :key="feature.functionType">{{ feature.functionType }}</text>
              <text v-if="!segment.features.length">暂无</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">功能成本与效率</text>
          <text class="section-desc">成本数据仅授权角色可见；没有真实成本记录时不推算采购价。</text>
        </view>
        <scroll-view scroll-x class="table-scroll">
          <view class="data-table">
            <view class="table-row head">
              <text>功能</text>
              <text>任务</text>
              <text>成本</text>
              <text>单任务成本</text>
              <text>有效图成本</text>
              <text>成功率</text>
              <text>通过率</text>
              <text>修订率</text>
              <text>重复生成</text>
              <text>建议</text>
            </view>
            <view v-for="item in center.featureMetrics" :key="item.functionType" class="table-row">
              <text>{{ item.functionType }}</text>
              <text>{{ item.taskCount }}</text>
              <text>{{ formatMoney(item.aiCost) }}</text>
              <text>{{ formatMoney(item.averageTaskCost) }}</text>
              <text>{{ formatMoney(item.effectiveImageCost) }}</text>
              <text>{{ item.successRate }}%</text>
              <text>{{ item.approvalRate }}%</text>
              <text>{{ item.revisionRate }}%</text>
              <text>{{ item.repeatGenerateCount }}</text>
              <text>{{ item.recommendedAction }}</text>
            </view>
          </view>
        </scroll-view>
        <view v-if="!center.featureMetrics.length" class="empty-state">暂无真实功能使用数据。</view>
      </view>

      <view class="two-col">
        <view class="section">
          <view class="section-head">
            <text class="section-title">项目效益</text>
            <text class="section-desc">不编造传统成本或节省百分比；缺少真实基准时只显示当前项目周期。</text>
          </view>
          <view class="project-list">
            <view v-for="project in center.projectMetrics" :key="project.projectId" class="project-card">
              <view>
                <text class="card-title">{{ project.projectName }}</text>
                <text class="muted">{{ project.status }} · {{ project.owner }}</text>
              </view>
              <view class="mini-grid">
                <text>任务 {{ project.taskCount }}</text>
                <text>生成 {{ project.generatedImageCount }}</text>
                <text>通过 {{ project.approvedImageCount }}</text>
                <text>交付 {{ project.deliveryCount }}</text>
              </view>
              <text class="notice">{{ project.timeComparisonLabel }}</text>
            </view>
            <view v-if="!center.projectMetrics.length" class="empty-state">暂无项目效益数据。</view>
          </view>
        </view>

        <view class="section">
          <view class="section-head">
            <text class="section-title">异常成本</text>
            <text class="section-desc">识别重复生成、高频失败、空结果、超时、回滚异常和成本突增。</text>
          </view>
          <view class="anomaly-list">
            <view v-for="item in center.anomalies" :key="item.anomalyId" class="anomaly-card" :class="item.level">
              <text class="card-title">{{ item.title }}</text>
              <text class="muted">{{ item.type }} · {{ item.level }}</text>
              <text class="notice">目标：{{ item.targetId || '全局' }}</text>
            </view>
            <view v-if="!center.anomalies.length" class="empty-state">暂无异常成本信号。</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">AI 制版效益</text>
          <text class="section-desc">统计初稿到审核通过时间、版师修改量、版型复用和模型版本对人工修改量的影响。</text>
        </view>
        <view class="stat-grid compact">
          <view class="stat-card"><text>制版任务</text><strong>{{ center.patternMetrics.patternTaskCount }}</strong><small>真实任务</small></view>
          <view class="stat-card"><text>审核耗时</text><strong>{{ center.patternMetrics.aiDraftToApprovalHours }}h</strong><small>AI 初稿到通过</small></view>
          <view class="stat-card"><text>平均修改项</text><strong>{{ center.patternMetrics.averageRevisionItems }}</strong><small>版师结构化修订</small></view>
          <view class="stat-card"><text>版型复用</text><strong>{{ center.patternMetrics.patternReuseCount }}</strong><small>从版型库创建</small></view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { BUSINESS_METRIC_PERIODS, loadBusinessMetricsCenter } from '../../utils/admin/businessMetricsCenter'

export default {
  data() {
    return {
      periods: BUSINESS_METRIC_PERIODS,
      period: '30d',
      center: loadBusinessMetricsCenter({ period: '30d' })
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
      this.center = loadBusinessMetricsCenter({ period: this.period })
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
.metrics-page { min-height: 100vh; padding: 28px; background: #f6f7fb; color: #111827; }
.page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
.eyebrow { display: block; font-size: 12px; color: #635bff; font-weight: 700; text-transform: uppercase; }
.page-title { display: block; margin-top: 6px; font-size: 28px; font-weight: 800; }
.page-desc { display: block; margin-top: 8px; max-width: 780px; color: #64748b; line-height: 1.7; }
.head-actions { display: flex; gap: 10px; align-items: center; }
.primary-btn, .select-pill { height: 40px; padding: 0 16px; border-radius: 8px; border: 0; background: #4f46e5; color: #fff; line-height: 40px; font-size: 14px; }
.select-pill { background: #fff; color: #111827; border: 1px solid #dbe3ef; }
.policy-strip { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 14px; margin-bottom: 18px; border: 1px solid #c7d2fe; border-radius: 8px; background: #eef2ff; color: #3730a3; font-size: 13px; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.stat-grid.compact { margin-bottom: 0; }
.stat-card, .section, .state-card, .segment-card, .project-card, .anomaly-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04); }
.stat-card { padding: 16px; }
.stat-card text, .stat-card small { display: block; color: #64748b; font-size: 13px; }
.stat-card strong { display: block; margin: 8px 0; font-size: 24px; }
.section { padding: 18px; margin-bottom: 18px; }
.section-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.section-title { font-size: 18px; font-weight: 800; }
.section-desc, .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
.segment-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.segment-card { padding: 14px; }
.segment-title, .card-title { display: block; font-weight: 800; }
.segment-action { display: block; margin-top: 6px; color: #4f46e5; font-size: 13px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.chips text { padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; }
.table-scroll { width: 100%; }
.data-table { min-width: 980px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.table-row { display: grid; grid-template-columns: 1.2fr .6fr .8fr .9fr .9fr .7fr .7fr .7fr .8fr 1.2fr; align-items: center; border-top: 1px solid #e5e7eb; }
.table-row:first-child { border-top: 0; }
.table-row text { padding: 10px; font-size: 13px; }
.table-row.head { background: #f8fafc; font-weight: 800; }
.empty-state, .state-card { padding: 18px; color: #64748b; text-align: center; }
.state-title { display: block; font-size: 22px; font-weight: 800; color: #111827; }
.state-desc { display: block; margin-top: 8px; color: #64748b; }
.two-col { display: grid; grid-template-columns: 1.2fr .8fr; gap: 18px; }
.project-list, .anomaly-list { display: flex; flex-direction: column; gap: 10px; }
.project-card, .anomaly-card { padding: 14px; box-shadow: none; }
.mini-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
.mini-grid text { padding: 8px; border-radius: 8px; background: #f8fafc; font-size: 12px; color: #334155; }
.notice { display: block; color: #475569; font-size: 13px; line-height: 1.6; }
.anomaly-card.high { border-color: #fecaca; background: #fff7f7; }
.anomaly-card.medium { border-color: #fde68a; background: #fffbeb; }
@media (max-width: 900px) {
  .metrics-page { padding: 16px; }
  .page-head, .head-actions { flex-direction: column; width: 100%; }
  .stat-grid, .segment-grid, .two-col { grid-template-columns: 1fr; }
}
</style>
