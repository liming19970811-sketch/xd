<template>
  <view class="roadmap-page">
    <view v-if="!center.canAccess" class="state-card">
      <text class="state-title">无权限查看产品路线图</text>
      <text class="state-desc">仅平台管理员和授权发布/产品人员可查看内部路线图。</text>
    </view>

    <template v-else>
      <view class="page-head">
        <view>
          <text class="eyebrow">Product Roadmap</text>
          <text class="page-title">产品路线图与需求优先级中心</text>
          <text class="page-desc">汇总真实反馈、工单、企业需求、搜索无结果、使用数据、任务失败和成本信号，辅助决定后续开发顺序。</text>
        </view>
        <button class="primary-btn" @click="reload">刷新</button>
      </view>

      <view class="policy-card">
        <text>评分只提供建议，最终优先级必须人工确认。</text>
        <text>公开路线图不得承诺未经确认的上线日期。</text>
        <text>暂停或下线功能不得删除用户历史数据。</text>
      </view>

      <view class="stat-grid">
        <view class="stat-card"><text>需求事项</text><strong>{{ center.summary.requestCount }}</strong><small>去重后</small></view>
        <view class="stat-card"><text>关联来源</text><strong>{{ center.summary.linkedSourceCount }}</strong><small>真实数据依据</small></view>
        <view class="stat-card"><text>高优先级</text><strong>{{ center.summary.highPriorityCount }}</strong><small>P0 / P1</small></view>
        <view class="stat-card"><text>暂停候选</text><strong>{{ center.summary.pausedCandidateCount }}</strong><small>触发停止规则</small></view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">平台分配原则</text>
          <text class="section-desc">新增功能前必须评估微信小程序包体积；过大的专业功能转移到网站。</text>
        </view>
        <view class="platform-grid">
          <view v-for="item in center.platformAllocation" :key="item.platform" class="platform-card">
            <text class="card-title">{{ item.label }}</text>
            <text class="muted">{{ item.principle }}</text>
          </view>
        </view>
      </view>

      <view class="roadmap-board">
        <view v-for="view in center.roadmapViews" :key="view.key" class="roadmap-column">
          <view class="column-head">
            <text>{{ view.label }}</text>
            <strong>{{ view.items.length }}</strong>
          </view>
          <view v-for="item in view.items" :key="item.roadmapId" class="roadmap-card">
            <view class="card-head">
              <text class="card-title">{{ item.title }}</text>
              <text class="priority">{{ item.finalPriority }}</text>
            </view>
            <text class="muted">{{ item.categoryLabel }} · {{ item.platformAllocation.label }}</text>
            <view class="mini-grid">
              <text>分数 {{ item.score }}</text>
              <text>负责人 {{ item.owner }}</text>
              <text>版本 {{ item.targetVersion }}</text>
            </view>
            <text class="notice">验收：{{ item.acceptanceCriteria }}</text>
            <view v-if="item.risks.length" class="chips">
              <text v-for="risk in item.risks" :key="risk">{{ risk }}</text>
            </view>
            <view class="actions">
              <button class="outline-btn" @click="moveRoadmap(item, 'planned')">规划</button>
              <button class="outline-btn" @click="moveRoadmap(item, 'in_progress')">开发</button>
              <button class="outline-btn" @click="moveRoadmap(item, 'paused')">暂停</button>
            </view>
          </view>
          <view v-if="!view.items.length" class="empty-state">暂无事项</view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">来源分布</text>
          <text class="section-desc">每个需求都保留来源，不再只靠主观判断排优先级。</text>
        </view>
        <view class="source-list">
          <view v-for="source in center.sourceStats" :key="source.sourceType" class="source-row">
            <text>{{ source.sourceType }}</text>
            <strong>{{ source.count }}</strong>
          </view>
          <view v-if="!center.sourceStats.length" class="empty-state">暂无来源数据。</view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { loadProductRoadmapCenter, updateRoadmapItem } from '../../utils/admin/productRoadmapCenter'

export default {
  data() {
    return {
      center: loadProductRoadmapCenter()
    }
  },
  onLoad() {
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadProductRoadmapCenter()
    },
    moveRoadmap(item, status) {
      const result = updateRoadmapItem(item.requestId, {
        status,
        owner: item.owner === '未指定' ? '' : item.owner,
        targetVersion: item.targetVersion === '待确认' ? '' : item.targetVersion,
        acceptanceCriteria: item.acceptanceCriteria
      })
      if (!result.success) {
        uni.showToast({ title: '更新失败', icon: 'none' })
        return
      }
      this.reload()
    }
  }
}
</script>

<style scoped>
.roadmap-page { min-height: 100vh; padding: 28px; background: #f6f7fb; color: #111827; }
.page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
.eyebrow { display: block; font-size: 12px; color: #4f46e5; font-weight: 800; text-transform: uppercase; }
.page-title { display: block; margin-top: 6px; font-size: 28px; font-weight: 800; }
.page-desc { display: block; margin-top: 8px; max-width: 820px; color: #64748b; line-height: 1.7; }
.primary-btn, .outline-btn { height: 38px; padding: 0 14px; border-radius: 8px; font-size: 14px; }
.primary-btn { border: 0; background: #4f46e5; color: #fff; }
.outline-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
.policy-card, .section, .stat-card, .platform-card, .roadmap-card, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04); }
.policy-card { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 14px; margin-bottom: 18px; color: #334155; font-size: 13px; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.stat-card { padding: 16px; }
.stat-card text, .stat-card small { display: block; color: #64748b; font-size: 13px; }
.stat-card strong { display: block; margin: 8px 0; font-size: 24px; }
.section { padding: 18px; margin-bottom: 18px; }
.section-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.section-title { font-size: 18px; font-weight: 800; }
.section-desc, .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
.platform-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.platform-card { padding: 14px; box-shadow: none; }
.card-title { display: block; font-weight: 800; line-height: 1.5; }
.roadmap-board { display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr)); gap: 12px; margin-bottom: 18px; overflow-x: auto; }
.roadmap-column { min-width: 220px; }
.column-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; margin-bottom: 10px; border-radius: 8px; background: #111827; color: #fff; font-weight: 800; }
.roadmap-card { padding: 13px; margin-bottom: 10px; box-shadow: none; }
.card-head { display: flex; justify-content: space-between; gap: 10px; }
.priority { padding: 3px 7px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; white-space: nowrap; }
.mini-grid { display: grid; grid-template-columns: 1fr; gap: 6px; margin: 10px 0; }
.mini-grid text { padding: 6px 8px; border-radius: 7px; background: #f8fafc; color: #475569; font-size: 12px; }
.notice { display: block; color: #475569; font-size: 12px; line-height: 1.6; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chips text { padding: 4px 8px; border-radius: 999px; background: #fff7ed; color: #9a3412; font-size: 12px; }
.actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.source-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.source-row { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: #f8fafc; color: #334155; }
.empty-state, .state-card { padding: 18px; color: #64748b; text-align: center; }
.state-title { display: block; font-size: 22px; color: #111827; font-weight: 800; }
.state-desc { display: block; margin-top: 8px; }
@media (max-width: 900px) {
  .roadmap-page { padding: 16px; }
  .page-head { flex-direction: column; }
  .stat-grid, .platform-grid, .source-list { grid-template-columns: 1fr; }
}
</style>
