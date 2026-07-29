<template>
  <view class="pattern-center-page">
    <!-- #ifdef H5 -->
    <view class="enterprise-shell">
      <view class="enterprise-sidebar">
        <view class="brand-block">
          <text class="brand-name">蝶变</text>
          <text class="brand-subtitle">企业工作台</text>
        </view>
        <view class="menu-list">
          <view v-for="item in menu" :key="item.key" :class="['menu-item', item.key === activeKey ? 'active' : '']" @click="goToMenu(item)">
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="enterprise-main">
        <view class="topbar">
          <view>
            <text class="page-title">版型与 AI 训练中心</text>
            <text class="page-subtitle">管理版型、人工复核、训练数据和固定评测，所有数据来自当前企业云端。</text>
          </view>
          <view class="enterprise-meta">
            <text class="enterprise-name">{{ enterpriseName }}</text>
            <text class="user-name">{{ userName }}</text>
            <text class="user-role">{{ roleName }}</text>
          </view>
        </view>

        <view v-if="loading" class="state-band">正在读取当前企业的版型与训练数据...</view>
        <view v-else-if="errorMessage" class="state-band error">
          <text>{{ errorMessage }}</text>
          <button @click="loadOverview">重新加载</button>
        </view>

        <template v-else>
          <view class="metric-band">
            <view v-for="item in metrics" :key="item.label" class="metric-item">
              <text class="metric-value">{{ item.value }}</text>
              <text class="metric-label">{{ item.label }}</text>
            </view>
          </view>

          <view class="module-section">
            <view class="section-heading">
              <text class="section-title">专业工作区</text>
              <text class="section-subtitle">按职责进入对应工作区，网页端负责完整管理，小程序仅保留入口与摘要。</text>
            </view>
            <view class="module-grid">
              <button class="module-entry" @click="openModule('library')">
                <view class="entry-icon blue">版</view>
                <view class="entry-copy"><text class="entry-title">版型库</text><text class="entry-desc">检索版型、查看详情与版本，并从已批准版型派生新款。</text></view>
                <text class="entry-arrow">›</text>
              </button>
              <button class="module-entry" :disabled="!canReview" @click="openModule('review')">
                <view class="entry-icon green">核</view>
                <view class="entry-copy"><text class="entry-title">打版师复核</text><text class="entry-desc">复核尺寸和纸样部件，保存修订并执行受控状态流转。</text></view>
                <text class="entry-arrow">{{ canReview ? '›' : '无权限' }}</text>
              </button>
              <button class="module-entry" :disabled="!canUseTraining" @click="openModule('training')">
                <view class="entry-icon amber">数</view>
                <view class="entry-copy"><text class="entry-title">训练数据与数据集</text><text class="entry-desc">管理授权样本、训练集和冻结评测集，不自动启动模型训练。</text></view>
                <text class="entry-arrow">{{ canUseTraining ? '›' : '无权限' }}</text>
              </button>
              <button class="module-entry" :disabled="!canUseTraining" @click="openModule('evaluation')">
                <view class="entry-icon violet">评</view>
                <view class="entry-copy"><text class="entry-title">模型评测与版本</text><text class="entry-desc">登记模型、提示词和解析器版本，汇总真实评测及盲评结果。</text></view>
                <text class="entry-arrow">{{ canUseTraining ? '›' : '无权限' }}</text>
              </button>
            </view>
          </view>

          <view class="boundary-section">
            <view class="section-heading">
              <text class="section-title">质量与安全边界</text>
              <text class="section-subtitle">批准不等于可直接生产，训练授权、复核结论和模型候选状态分别管理。</text>
            </view>
            <view class="boundary-grid">
              <view><text>数据范围</text><text>仅当前企业及当前成员有权访问的数据</text></view>
              <view><text>训练授权</text><text>{{ consentText }}</text></view>
              <view><text>生产状态</text><text>AI 初稿和已复核版型均不自动标记为生产级纸样</text></view>
              <view><text>模型发布</text><text>评测候选不会自动部署，Provider 密钥不进入网站前端</text></view>
            </view>
          </view>
        </template>
      </view>
    </view>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <view class="platform-tip">版型与 AI 训练中心仅在企业网页版提供。</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { getCurrentContext } from '../../utils/auth/authRepository.js'
import { getCurrentSession, restoreSession } from '../../utils/auth/authSessionService.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { navigateEnterpriseWeb } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { searchApprovedPatternLibrary } from '../../utils/pattern/patternLibraryRepository.js'
import { getPatternReviewQueue } from '../../utils/pattern/patternReviewRepository.js'
import { getPatternTrainingSummary } from '../../utils/pattern/patternTrainingRepository.js'

const MODULE_ROUTES = Object.freeze({
  library: '/package-ai/pattern-library/pattern-library?source=web-center',
  review: '/package-ai/pattern-review-queue/pattern-review-queue',
  training: '/package-ai/pattern-training-center/pattern-training-center?section=data',
  evaluation: '/package-ai/pattern-training-center/pattern-training-center?section=evaluation'
})

export default {
  data() {
    return {
      activeKey: 'patternCenter', context: getCurrentContext(), menu: getEnterpriseWebMenu(), loading: true, errorMessage: '',
      libraryTotal: 0, reviewTotal: 0, trainingSummary: {}, navigationLocked: false, initialTab: ''
    }
  },
  computed: {
    enterpriseName() { return this.context.currentEnterprise.enterpriseName || '未选择企业' },
    userName() { return this.context.currentUser.name || '当前用户' },
    roleName() { return this.context.currentRole || this.context.currentMember.role || '成员' },
    canReview() { return requirePermission('pattern_making.approve').allowed },
    canUseTraining() {
      const capabilities = this.trainingSummary.capabilities || {}
      return Boolean(capabilities.canManage || capabilities.canReview || capabilities.canConfigureEvaluation)
    },
    consentText() {
      return this.trainingSummary.consent && this.trainingSummary.consent.status === 'granted'
        ? '已授权的批准版型可进入候选样本'
        : '未授权数据不会进入训练或评测数据集'
    },
    metrics() {
      const stats = this.trainingSummary.stats || {}
      return [
        { label: '可访问优质版型', value: this.libraryTotal }, { label: '待复核版本', value: this.canReview ? this.reviewTotal : '—' },
        { label: '合规训练样本', value: stats.eligibleSampleCount ?? '—' }, { label: '数据集版本', value: stats.datasetCount ?? '—' },
        { label: '模型版本', value: stats.modelCount ?? '—' }, { label: '评测运行', value: stats.evaluationCount ?? '—' }
      ]
    }
  },
  onLoad(options = {}) { this.initialTab = String(options.tab || '') },
  async onShow() { await this.initialize() },
  onUnload() { if (this._navigationTimer) clearTimeout(this._navigationTimer) },
  methods: {
    async initialize() {
      await restoreSession()
      this.context = getCurrentContext()
      this.menu = getEnterpriseWebMenu()
      const session = getCurrentSession()
      const access = requirePermission('pattern_library.view')
      if (!session || session.authSource !== 'cloud_authenticated') {
        this.loading = false
        this.errorMessage = '请先使用企业云端账号登录后访问版型中心。'
        navigateEnterpriseWeb('login')
        return
      }
      if (!access.allowed) {
        this.loading = false
        this.errorMessage = getEnterpriseGuardMessage(access.reason)
        return
      }
      await this.loadOverview()
      if (this.initialTab && MODULE_ROUTES[this.initialTab]) {
        const target = this.initialTab
        this.initialTab = ''
        this.openModule(target)
      }
    },
    async loadOverview() {
      if (this._loadingOverview) return
      this.loading = true
      this._loadingOverview = true
      this.errorMessage = ''
      try {
        const [library, review, training] = await Promise.all([
          searchApprovedPatternLibrary({ scope: 'personal', status: 'quality', page: 1, pageSize: 1 }),
          this.canReview ? getPatternReviewQueue({ status: 'under_review', page: 1, pageSize: 1 }) : Promise.resolve(null),
          getPatternTrainingSummary()
        ])
        if (!library || !library.ok) throw new Error((library && library.message) || '版型库暂时无法读取。')
        this.libraryTotal = Number(library.total || 0)
        if (review && review.ok) this.reviewTotal = Number((review.data && review.data.total) || ((review.data && review.data.items) || []).length)
        this.trainingSummary = training && training.ok ? (training.data || {}) : {}
      } catch (error) {
        this.errorMessage = error.message || '版型与训练数据暂时无法读取。'
      } finally {
        this.loading = false
        this._loadingOverview = false
      }
    },
    openModule(key = '') {
      if (this.navigationLocked || !MODULE_ROUTES[key]) return
      if (key === 'review' && !this.canReview) return
      if (['training', 'evaluation'].includes(key) && !this.canUseTraining) return
      this.navigate(MODULE_ROUTES[key])
    },
    goToMenu(item = {}) { if (item.route && item.key !== this.activeKey) this.navigate(item.route) },
    navigate(url = '') {
      this.navigationLocked = true
      uni.navigateTo({
        url,
        fail: () => uni.showToast({ title: '页面暂时无法打开', icon: 'none' }),
        complete: () => { this._navigationTimer = setTimeout(() => { this.navigationLocked = false }, 600) }
      })
    }
  }
}
</script>

<style scoped>
.pattern-center-page{min-height:100vh;background:#f4f6fb;color:#172033}.enterprise-shell{display:flex;min-height:100vh}.enterprise-sidebar{position:fixed;inset:0 auto 0 0;width:216px;padding:24px 16px;background:#101828;color:#fff;box-sizing:border-box;overflow-y:auto}.brand-block{margin-bottom:28px}.brand-name,.brand-subtitle{display:block}.brand-name{font-size:22px;font-weight:700}.brand-subtitle{margin-top:6px;color:#a9b4ca;font-size:12px}.menu-item{display:flex;align-items:center;gap:10px;padding:12px;border-radius:8px;color:#cbd5e1;font-size:14px;cursor:pointer}.menu-item.active,.menu-item:hover{background:#eef2ff;color:#4f46e5}.menu-icon{width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,.1);font-size:12px;line-height:24px;text-align:center}.enterprise-main{min-width:0;flex:1;margin-left:216px;padding:24px}.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:1px solid #dfe4ec}.page-title,.page-subtitle,.enterprise-name,.user-name,.user-role{display:block}.page-title{font-size:26px;font-weight:700}.page-subtitle{max-width:720px;margin-top:7px;color:#64748b;font-size:13px;line-height:1.6}.enterprise-meta{text-align:right}.enterprise-name{font-size:14px;font-weight:700}.user-name,.user-role{margin-top:4px;color:#64748b;font-size:12px}.state-band{display:flex;align-items:center;justify-content:center;min-height:180px;margin-top:20px;border:1px solid #e2e8f0;background:#fff;color:#64748b}.state-band.error{flex-direction:column;color:#b42318}.state-band button{height:36px;margin-top:16px;padding:0 18px;border:0;border-radius:6px;background:#4f46e5;color:#fff;line-height:36px}.metric-band{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));margin-top:22px;border:1px solid #e2e8f0;background:#fff}.metric-item{padding:20px;border-right:1px solid #edf0f4}.metric-item:last-child{border-right:0}.metric-value,.metric-label{display:block}.metric-value{font-size:26px;font-weight:700}.metric-label{margin-top:7px;color:#64748b;font-size:12px}.module-section,.boundary-section{margin-top:24px}.section-heading{margin-bottom:12px}.section-title,.section-subtitle{display:block}.section-title{font-size:18px;font-weight:700}.section-subtitle{margin-top:5px;color:#64748b;font-size:12px}.module-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.module-entry{display:flex;align-items:center;gap:14px;min-height:112px;margin:0;padding:18px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#172033;text-align:left;cursor:pointer}.module-entry::after{border:0}.module-entry:hover{border-color:#a5b4fc}.module-entry[disabled]{opacity:.58;cursor:not-allowed}.entry-icon{display:flex;align-items:center;justify-content:center;flex:0 0 44px;height:44px;border-radius:8px;font-weight:700}.entry-icon.blue{background:#eaf2ff;color:#2563eb}.entry-icon.green{background:#eaf8f1;color:#16805c}.entry-icon.amber{background:#fff5dc;color:#a15c00}.entry-icon.violet{background:#f2edff;color:#6d44cf}.entry-copy{min-width:0;flex:1}.entry-title,.entry-desc{display:block}.entry-title{font-size:16px;font-weight:700}.entry-desc{margin-top:6px;color:#64748b;font-size:12px;line-height:1.55}.entry-arrow{flex:0 0 auto;color:#64748b;font-size:20px}.boundary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid #e2e8f0;background:#fff}.boundary-grid view{padding:18px;border-right:1px solid #edf0f4;border-bottom:1px solid #edf0f4}.boundary-grid view:nth-child(2n){border-right:0}.boundary-grid view:nth-last-child(-n+2){border-bottom:0}.boundary-grid text{display:block}.boundary-grid text:first-child{font-size:13px;font-weight:700}.boundary-grid text:last-child{margin-top:7px;color:#64748b;font-size:12px;line-height:1.55}.platform-tip{padding:48px 24px;color:#64748b}.pattern-center-page button{font-family:inherit;letter-spacing:0}
@media(max-width:1000px){.metric-band{grid-template-columns:repeat(3,1fr)}.metric-item:nth-child(3){border-right:0}.metric-item:nth-child(-n+3){border-bottom:1px solid #edf0f4}}
@media(max-width:760px){.enterprise-shell{display:block}.enterprise-sidebar{position:static;width:auto}.enterprise-main{margin-left:0;padding:16px}.topbar{display:block}.enterprise-meta{margin-top:14px;text-align:left}.metric-band{grid-template-columns:repeat(2,1fr)}.metric-item:nth-child(odd){border-right:1px solid #edf0f4}.metric-item:nth-child(even){border-right:0}.metric-item:nth-child(-n+4){border-bottom:1px solid #edf0f4}.module-grid,.boundary-grid{grid-template-columns:1fr}.boundary-grid view,.boundary-grid view:nth-child(2n){border-right:0;border-bottom:1px solid #edf0f4}.boundary-grid view:last-child{border-bottom:0}}
</style>
