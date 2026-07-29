<template>
  <view class="readiness-page">
    <view v-if="!center.canAccess" class="state-card">
      <text class="state-title">无权限查看 V1 完成度</text>
      <text class="state-desc">仅平台管理员可查看 V1 范围冻结、上线红线和核心功能完成度。</text>
    </view>

    <template v-else>
      <view class="page-head">
        <view>
          <text class="eyebrow">V1 Scope Freeze</text>
          <text class="page-title">V1 版本范围收敛与核心功能冻结</text>
          <text class="page-desc">停止继续堆新模块，优先把 AI 出图、AI 制版、项目资产交付和基础系统做成可验证闭环。</text>
        </view>
        <button class="primary-btn" @click="reload">刷新</button>
      </view>

      <view class="gate-card" :class="{ blocked: !center.releaseGate.canRelease }">
        <text class="gate-title">{{ center.releaseGate.message }}</text>
        <text>未收口项：{{ center.releaseGate.unresolvedCount }}</text>
      </view>

      <view class="stat-grid">
        <view class="stat-card"><text>核心项</text><strong>{{ center.summary.total }}</strong><small>V1 范围</small></view>
        <view class="stat-card"><text>可测试</text><strong>{{ center.summary.testable }}</strong><small>仍需验收</small></view>
        <view class="stat-card"><text>被阻塞</text><strong>{{ center.summary.blocked }}</strong><small>需先解除</small></view>
        <view class="stat-card"><text>平均完成度</text><strong>{{ center.summary.averageCompletion }}%</strong><small>按九项标准</small></view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">V1 必须完成</text>
          <text class="section-desc">只有同时满足页面、接口、权限、状态、额度、错误、保存、结果和测试，才允许标记已完成。</text>
        </view>
        <view class="item-list">
          <view v-for="item in center.items" :key="item.featureId" class="item-card" :class="item.status">
            <view class="card-head">
              <view>
                <text class="card-title">{{ item.executionOrder }}. {{ item.title }}</text>
                <text class="muted">{{ item.area }} · 负责人：{{ item.owner }}</text>
              </view>
              <view class="status-pill">
                <strong>{{ item.completionRate }}%</strong>
                <text>{{ item.statusLabel }}</text>
              </view>
            </view>

            <view class="requirement-grid">
              <view
                v-for="requirement in center.completionRequirements"
                :key="requirement.key"
                class="requirement"
                :class="{ done: item.evidence[requirement.key] }"
              >
                <text>{{ requirement.label }}</text>
              </view>
            </view>

            <view class="detail-grid">
              <view>
                <text class="sub-title">修改文件</text>
                <text v-for="file in item.files" :key="file" class="line">{{ file }}</text>
              </view>
              <view>
                <text class="sub-title">测试证据</text>
                <text v-for="test in item.tests" :key="test" class="line">{{ test }}</text>
              </view>
              <view>
                <text class="sub-title">阻塞原因</text>
                <text v-for="blocker in item.blockers" :key="blocker" class="line danger">{{ blocker }}</text>
                <text v-if="!item.blockers.length" class="line">暂无</text>
              </view>
            </view>

            <view v-if="!item.completedAllowed" class="warning-row">
              <text>不可标记已完成，缺少：{{ item.missingRequirements.map((entry) => entry.label).join('、') || '人工验证状态' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="two-col">
        <view class="section">
          <view class="section-head">
            <text class="section-title">执行顺序</text>
            <text class="section-desc">先稳定核心链路，再启动灰度，不再并行扩张低优先级模块。</text>
          </view>
          <view class="order-list">
            <view v-for="step in center.executionOrder" :key="step.order" class="order-row">
              <strong>{{ step.order }}</strong>
              <text>{{ step.title }}</text>
            </view>
          </view>
        </view>

        <view class="section">
          <view class="section-head">
            <text class="section-title">上线红线</text>
            <text class="section-desc">任一红线未解决，都不得上线或扩大灰度。</text>
          </view>
          <view class="blocker-list">
            <text v-for="item in center.releaseBlockers" :key="item">{{ item }}</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">暂缓功能</text>
          <text class="section-desc">保留规划文档，不制作空页面和假入口，不干扰当前工作台。</text>
        </view>
        <view class="deferred-grid">
          <view v-for="item in center.deferredFeatures" :key="item.key" class="deferred-card">
            <text class="card-title">{{ item.title }}</text>
            <text class="muted">{{ item.reason }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { loadV1ReadinessCenter } from '../../utils/admin/v1ReadinessCenter'

export default {
  data() {
    return {
      center: loadV1ReadinessCenter()
    }
  },
  onLoad() {
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadV1ReadinessCenter()
    }
  }
}
</script>

<style scoped>
.readiness-page { min-height: 100vh; padding: 28px; background: #f6f7fb; color: #111827; }
.page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
.eyebrow { display: block; font-size: 12px; color: #4f46e5; font-weight: 800; text-transform: uppercase; }
.page-title { display: block; margin-top: 6px; font-size: 28px; font-weight: 800; }
.page-desc { display: block; margin-top: 8px; max-width: 820px; color: #64748b; line-height: 1.7; }
.primary-btn { height: 38px; padding: 0 14px; border: 0; border-radius: 8px; background: #4f46e5; color: #fff; font-size: 14px; }
.gate-card, .section, .stat-card, .item-card, .state-card, .deferred-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04); }
.gate-card { display: flex; justify-content: space-between; gap: 12px; padding: 14px 16px; margin-bottom: 18px; color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.gate-card.blocked { color: #991b1b; background: #fff1f2; border-color: #fecdd3; }
.gate-title { font-weight: 800; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.stat-card { padding: 16px; }
.stat-card text, .stat-card small { display: block; color: #64748b; font-size: 13px; }
.stat-card strong { display: block; margin: 8px 0; font-size: 24px; }
.section { padding: 18px; margin-bottom: 18px; }
.section-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.section-title { font-size: 18px; font-weight: 800; }
.section-desc, .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
.item-list { display: flex; flex-direction: column; gap: 12px; }
.item-card { padding: 16px; box-shadow: none; }
.item-card.blocked { border-color: #fecaca; }
.card-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.card-title { display: block; font-weight: 800; line-height: 1.5; }
.status-pill { min-width: 86px; padding: 8px; border-radius: 10px; background: #eef2ff; color: #3730a3; text-align: center; }
.status-pill strong, .status-pill text { display: block; }
.status-pill strong { font-size: 22px; }
.requirement-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
.requirement { padding: 8px; border-radius: 8px; background: #f8fafc; color: #64748b; font-size: 12px; text-align: center; }
.requirement.done { color: #047857; background: #ecfdf5; }
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.sub-title { display: block; margin-bottom: 8px; font-weight: 800; }
.line { display: block; color: #475569; font-size: 12px; line-height: 1.7; word-break: break-all; }
.danger { color: #b91c1c; }
.warning-row { margin-top: 12px; padding: 10px; border-radius: 8px; background: #fffbeb; color: #92400e; font-size: 13px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.order-list { display: flex; flex-direction: column; gap: 8px; }
.order-row { display: grid; grid-template-columns: 42px 1fr; gap: 10px; align-items: center; padding: 10px; border-radius: 8px; background: #f8fafc; }
.order-row strong { width: 28px; height: 28px; border-radius: 999px; background: #4f46e5; color: #fff; text-align: center; line-height: 28px; }
.blocker-list { display: flex; flex-wrap: wrap; gap: 8px; }
.blocker-list text { padding: 6px 10px; border-radius: 999px; background: #fff1f2; color: #be123c; font-size: 13px; }
.deferred-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.deferred-card { padding: 14px; box-shadow: none; }
.empty-state, .state-card { padding: 18px; color: #64748b; text-align: center; }
.state-title { display: block; font-size: 22px; color: #111827; font-weight: 800; }
.state-desc { display: block; margin-top: 8px; }
@media (max-width: 900px) {
  .readiness-page { padding: 16px; }
  .page-head, .gate-card { flex-direction: column; }
  .stat-grid, .detail-grid, .two-col, .deferred-grid, .requirement-grid { grid-template-columns: 1fr; }
}
</style>
