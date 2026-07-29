<template>
  <view class="request-page">
    <view v-if="!center.canAccess" class="state-card">
      <text class="state-title">无权限查看需求池</text>
      <text class="state-desc">仅平台管理员和授权产品人员可查看、确认需求优先级。</text>
    </view>

    <template v-else>
      <view class="page-head">
        <view>
          <text class="eyebrow">Feature Requests</text>
          <text class="page-title">需求优先级中心</text>
          <text class="page-desc">将用户反馈、客服工单、企业需求、搜索无结果、任务失败、版师修订和成本信号合并为可评估的需求事项。</text>
        </view>
        <button class="primary-btn" @click="reload">刷新</button>
      </view>

      <view class="filter-bar">
        <input v-model="filters.keyword" placeholder="搜索需求、分类或说明" @input="reload" />
        <picker mode="selector" :range="categoryLabels" :value="categoryIndex" @change="onCategoryChange">
          <view class="select-pill">{{ currentCategoryLabel }}</view>
        </picker>
        <picker mode="selector" :range="priorityLabels" :value="priorityIndex" @change="onPriorityChange">
          <view class="select-pill">{{ currentPriorityLabel }}</view>
        </picker>
      </view>

      <view class="request-list">
        <view v-for="item in center.requests" :key="item.requestId" class="request-card">
          <view class="card-head">
            <view>
              <text class="card-title">{{ item.title }}</text>
              <text class="muted">{{ item.categoryLabel }} · {{ item.platformAllocation.label }} · 来源 {{ item.sources.length }} 条</text>
            </view>
            <view class="score-box">
              <strong>{{ item.score.total }}</strong>
              <text>{{ item.score.finalPriority }}</text>
            </view>
          </view>

          <text class="description">{{ item.description || '暂无补充说明' }}</text>

          <view class="score-grid">
            <view><text>用户影响</text><strong>{{ item.score.userImpact }}</strong></view>
            <view><text>企业价值</text><strong>{{ item.score.enterpriseValue }}</strong></view>
            <view><text>使用频率</text><strong>{{ item.score.usageFrequency }}</strong></view>
            <view><text>业务紧急</text><strong>{{ item.score.businessUrgency }}</strong></view>
            <view><text>技术风险</text><strong>{{ item.score.technicalRisk }}</strong></view>
            <view><text>开发成本</text><strong>{{ item.score.developmentCost }}</strong></view>
            <view><text>运营成本</text><strong>{{ item.score.operatingCost }}</strong></view>
            <view><text>核心链路</text><strong>{{ item.score.coreChainImpact }}</strong></view>
          </view>

          <view class="meta-row">
            <text>建议：{{ item.score.suggestedPriorityLabel }}</text>
            <text>最终：{{ item.score.manuallyConfirmed ? '人工确认' : '使用建议' }}</text>
            <text>路线图：{{ item.roadmapStatus }}</text>
          </view>

          <view class="chips">
            <text v-for="source in item.sourceTypes" :key="source">{{ source }}</text>
            <text v-for="signal in item.stopSignals" :key="signal" class="danger">{{ signal }}</text>
          </view>

          <view class="source-panel">
            <text class="sub-title">关联来源</text>
            <view v-for="source in item.sources.slice(0, 4)" :key="source.sourceId" class="source-item">
              <text>{{ source.sourceType }}</text>
              <text>{{ source.title }}</text>
            </view>
          </view>

          <view class="actions">
            <button class="outline-btn" @click="confirmPriority(item, 'P1')">确认 P1</button>
            <button class="outline-btn" @click="confirmPriority(item, 'P2')">确认 P2</button>
            <button class="outline-btn" @click="confirmPriority(item, 'P3')">确认 P3</button>
            <button class="outline-btn" @click="moveToRoadmap(item, 'planned')">进入规划</button>
            <button class="outline-btn danger" @click="moveToRoadmap(item, 'paused')">暂停</button>
          </view>
        </view>
        <view v-if="!center.requests.length" class="empty-state">暂无匹配需求。</view>
      </view>
    </template>
  </view>
</template>

<script>
import {
  FEATURE_REQUEST_CATEGORIES,
  confirmFeatureRequestPriority,
  loadFeatureRequestCenter,
  updateRoadmapItem
} from '../../utils/admin/productRoadmapCenter'

const PRIORITIES = [
  { key: '', label: '全部优先级' },
  { key: 'P0', label: 'P0' },
  { key: 'P1', label: 'P1' },
  { key: 'P2', label: 'P2' },
  { key: 'P3', label: 'P3' }
]

export default {
  data() {
    return {
      categories: [{ key: '', label: '全部分类' }, ...FEATURE_REQUEST_CATEGORIES],
      priorities: PRIORITIES,
      filters: {
        keyword: '',
        category: '',
        priority: ''
      },
      center: loadFeatureRequestCenter()
    }
  },
  computed: {
    categoryLabels() {
      return this.categories.map((item) => item.label)
    },
    priorityLabels() {
      return this.priorities.map((item) => item.label)
    },
    categoryIndex() {
      return Math.max(0, this.categories.findIndex((item) => item.key === this.filters.category))
    },
    priorityIndex() {
      return Math.max(0, this.priorities.findIndex((item) => item.key === this.filters.priority))
    },
    currentCategoryLabel() {
      return this.categories[this.categoryIndex].label
    },
    currentPriorityLabel() {
      return this.priorities[this.priorityIndex].label
    }
  },
  onLoad() {
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadFeatureRequestCenter(this.filters)
    },
    onCategoryChange(event) {
      this.filters.category = this.categories[Number(event.detail.value) || 0].key
      this.reload()
    },
    onPriorityChange(event) {
      this.filters.priority = this.priorities[Number(event.detail.value) || 0].key
      this.reload()
    },
    confirmPriority(item, priority) {
      const result = confirmFeatureRequestPriority(item.requestId, priority, {
        acceptanceCriteria: item.acceptanceCriteria,
        targetVersion: item.targetVersion
      })
      if (!result.success) {
        uni.showToast({ title: '确认失败', icon: 'none' })
        return
      }
      this.reload()
    },
    moveToRoadmap(item, status) {
      const result = updateRoadmapItem(item.requestId, {
        status,
        acceptanceCriteria: item.acceptanceCriteria,
        targetVersion: item.targetVersion
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
.request-page { min-height: 100vh; padding: 28px; background: #f6f7fb; color: #111827; }
.page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
.eyebrow { display: block; font-size: 12px; color: #4f46e5; font-weight: 800; text-transform: uppercase; }
.page-title { display: block; margin-top: 6px; font-size: 28px; font-weight: 800; }
.page-desc { display: block; margin-top: 8px; max-width: 820px; color: #64748b; line-height: 1.7; }
.primary-btn, .outline-btn, .select-pill { height: 38px; padding: 0 14px; border-radius: 8px; font-size: 14px; }
.primary-btn { border: 0; background: #4f46e5; color: #fff; }
.outline-btn, .select-pill { border: 1px solid #cbd5e1; background: #fff; color: #334155; line-height: 38px; }
.outline-btn.danger { border-color: #fecaca; color: #b91c1c; }
.filter-bar { display: grid; grid-template-columns: 1fr 180px 150px; gap: 10px; margin-bottom: 16px; }
.filter-bar input { min-height: 38px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.request-list { display: flex; flex-direction: column; gap: 14px; }
.request-card, .state-card { padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04); }
.card-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
.card-title { display: block; font-weight: 800; font-size: 17px; line-height: 1.5; }
.muted, .description { color: #64748b; font-size: 13px; line-height: 1.7; }
.description { display: block; margin: 10px 0; }
.score-box { min-width: 70px; padding: 8px; border-radius: 10px; background: #eef2ff; text-align: center; color: #3730a3; }
.score-box strong, .score-box text { display: block; }
.score-box strong { font-size: 24px; }
.score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
.score-grid view { padding: 8px; border-radius: 8px; background: #f8fafc; }
.score-grid text { display: block; color: #64748b; font-size: 12px; }
.score-grid strong { display: block; margin-top: 4px; font-size: 15px; }
.meta-row { display: flex; flex-wrap: wrap; gap: 10px; color: #475569; font-size: 13px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.chips text { padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; }
.chips .danger { background: #fff1f2; color: #be123c; }
.source-panel { padding: 12px; border-radius: 8px; background: #f8fafc; }
.sub-title { display: block; margin-bottom: 8px; font-weight: 800; }
.source-item { display: grid; grid-template-columns: 150px 1fr; gap: 10px; padding: 6px 0; border-top: 1px solid #e5e7eb; font-size: 13px; color: #475569; }
.source-item:first-of-type { border-top: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.empty-state, .state-card { padding: 18px; color: #64748b; text-align: center; }
.state-title { display: block; font-size: 22px; color: #111827; font-weight: 800; }
.state-desc { display: block; margin-top: 8px; }
@media (max-width: 900px) {
  .request-page { padding: 16px; }
  .page-head { flex-direction: column; }
  .filter-bar, .score-grid { grid-template-columns: 1fr; }
  .source-item { grid-template-columns: 1fr; }
}
</style>
