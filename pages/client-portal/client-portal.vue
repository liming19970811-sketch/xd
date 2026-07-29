<template>
  <view class="client-page">
    <view class="client-nav">
      <view>
        <text class="brand-title">蝶变客户门户</text>
        <text class="brand-sub">查看需求、项目进度、确认记录和交付文件</text>
      </view>
      <view class="nav-actions">
        <button class="ghost-btn" @click="goRequest">提交新需求</button>
        <button class="primary-btn" @click="contactOwner">联系项目负责人</button>
      </view>
    </view>

    <view class="client-shell">
      <view class="portal-tabs">
        <text v-for="item in tabs" :key="item.key" :class="{ active: activeTab === item.key }" @click="setTab(item.key)">{{ item.label }}</text>
      </view>

      <view v-if="activeTab === 'overview'" class="portal-section">
        <view class="summary-grid">
          <view><text>{{ center.summary.activeRequests }}</text><text>进行中的需求</text></view>
          <view><text>{{ center.summary.activeProjects }}</text><text>进行中的项目</text></view>
          <view><text>{{ center.summary.pendingConfirmations }}</text><text>待确认方案</text></view>
          <view><text>{{ center.summary.pendingWorks }}</text><text>待审核作品</text></view>
          <view><text>{{ center.summary.recentDeliveries }}</text><text>最近交付</text></view>
          <view><text>{{ center.summary.unreadMessages }}</text><text>未读消息</text></view>
        </view>

        <view class="content-grid">
          <view class="panel">
            <text class="panel-title">最近通知</text>
            <view v-if="center.notifications.length" class="notice-list">
              <view v-for="item in center.notifications" :key="item.type + item.targetId" @click="jumpByNotice(item)">
                <text>{{ item.title }}</text>
                <text>{{ item.desc }}</text>
              </view>
            </view>
            <view v-else class="empty">暂无通知</view>
          </view>

          <view class="panel">
            <text class="panel-title">下一步</text>
            <view class="next-list">
              <text>需求已提交后，可用需求编号查看处理状态。</text>
              <text>项目进入执行后，可在项目页确认方案、初稿、修订稿和最终交付。</text>
              <text>正式交付文件只展示授权下载信息，过期后需要重新授权。</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="activeTab === 'requests'" class="portal-section">
        <view class="section-head">
          <text class="section-title">需求进度</text>
          <input v-model.trim="keyword" placeholder="输入需求编号或公司名称查询" />
        </view>
        <view v-if="filteredRequests.length" class="card-list">
          <view v-for="item in filteredRequests" :key="item.leadId" class="request-card">
            <view class="card-head">
              <view><text>{{ item.companyName || '企业需求' }}</text><text>需求编号：{{ item.leadId }}</text></view>
              <text class="status-badge">{{ item.statusLabel }}</text>
            </view>
            <view class="progress-line">
              <text v-for="step in requestSteps" :key="step" :class="{ active: isRequestStepActive(item, step) }">{{ step }}</text>
            </view>
            <view class="info-grid">
              <view><text>负责人</text><text>{{ item.ownerName }}</text></view>
              <view><text>最近更新</text><text>{{ formatTime(item.updatedAt) }}</text></view>
              <view><text>下一步</text><text>{{ item.nextStep }}</text></view>
              <view><text>附件</text><text>{{ item.attachmentCount }} 个</text></view>
            </view>
            <button v-if="item.projectId" class="outline-btn" @click="openProject(item.projectId)">查看项目</button>
          </view>
        </view>
        <view v-else class="empty">暂无可查看需求。请确认需求编号或联系项目负责人。</view>
      </view>

      <view v-else-if="activeTab === 'projects'" class="portal-section">
        <view class="section-head">
          <text class="section-title">项目进度</text>
          <input v-model.trim="keyword" placeholder="搜索项目名称" />
        </view>
        <view v-if="selectedProject" class="project-detail">
          <text class="back-link" @click="selectedProjectId = ''">← 返回项目列表</text>
          <view class="detail-hero">
            <view>
              <text class="section-title">{{ selectedProject.projectName }}</text>
              <text class="muted">{{ selectedProject.statusLabel }} · 当前版本 {{ selectedProject.versionLabel }}</text>
            </view>
            <button class="ghost-btn" @click="contactOwner">联系负责人</button>
          </view>
          <view class="progress-line large">
            <text v-for="step in selectedProject.progress" :key="step.label" :class="{ active: step.active, done: step.completed }">{{ step.label }}</text>
          </view>

          <view class="detail-grid">
            <view class="panel">
              <text class="panel-title">需求与方案</text>
              <text class="muted">{{ (selectedProject.demand && selectedProject.demand.description) || '需求已进入项目流程，详细方案由负责人沟通确认。' }}</text>
            </view>
            <view class="panel">
              <text class="panel-title">待客户确认</text>
              <view v-if="selectedProject.pendingConfirmations.length" class="confirm-list">
                <view v-for="item in selectedProject.pendingConfirmations" :key="item.key">
                  <text>{{ item.label }}</text>
                  <button class="primary-btn small" @click="confirmProject(item.key)">确认</button>
                </view>
              </view>
              <view v-else class="empty compact">暂无待确认事项</view>
            </view>
          </view>

          <view class="panel">
            <text class="panel-title">作品预览</text>
            <view v-if="selectedProject.works.length" class="work-grid">
              <view v-for="work in selectedProject.works" :key="work.sourceId" class="work-card">
                <image v-if="work.url" :src="work.url" mode="aspectFill" />
                <view v-else>预览</view>
                <text>{{ work.status }}</text>
              </view>
            </view>
            <view v-else class="empty compact">内部审核通过后，作品预览会显示在这里。</view>
            <textarea v-model.trim="revisionContent" class="textarea" placeholder="需要修改时填写文字意见；问题区域标注将在后续版本接入。" />
            <button class="outline-btn" @click="requestRevision">需要修改</button>
          </view>

          <view class="detail-grid">
            <view class="panel">
              <text class="panel-title">交付文件</text>
              <view v-if="selectedProjectDeliveries.length" class="mini-list">
                <view v-for="item in selectedProjectDeliveries" :key="item.deliveryId + item.deliveryPackageId">
                  <text>{{ item.title }}</text>
                  <text>{{ item.fileCount }} 个文件 · {{ item.statusLabel }}</text>
                </view>
              </view>
              <view v-else class="empty compact">暂无正式交付</view>
            </view>
            <view class="panel">
              <text class="panel-title">沟通记录</text>
              <view v-if="selectedProject.feedbacks.length || selectedProject.confirmations.length" class="mini-list">
                <view v-for="item in selectedProject.confirmations" :key="item.confirmationId">
                  <text>{{ item.confirmLabel }}</text>
                  <text>{{ item.version }} · {{ formatTime(item.createdAt) }}</text>
                </view>
                <view v-for="item in selectedProject.feedbacks" :key="item.feedbackId">
                  <text>{{ item.content }}</text>
                  <text>{{ formatTime(item.createdAt) }}</text>
                </view>
              </view>
              <view v-else class="empty compact">暂无沟通记录</view>
            </view>
          </view>
        </view>

        <view v-else-if="filteredProjects.length" class="card-list">
          <view v-for="item in filteredProjects" :key="item.projectId" class="request-card" @click="openProject(item.projectId)">
            <view class="card-head">
              <view><text>{{ item.projectName }}</text><text>{{ item.customerName || '企业客户' }}</text></view>
              <text class="status-badge">{{ item.statusLabel }}</text>
            </view>
            <view class="info-grid">
              <view><text>负责人</text><text>{{ item.ownerName }}</text></view>
              <view><text>更新</text><text>{{ formatTime(item.updatedAt) }}</text></view>
              <view><text>待确认</text><text>{{ item.pendingConfirmations.length }}</text></view>
              <view><text>交付</text><text>{{ item.deliveries.length }}</text></view>
            </view>
          </view>
        </view>
        <view v-else class="empty">暂无可查看项目。</view>
      </view>

      <view v-else class="portal-section">
        <view class="section-head">
          <text class="section-title">交付文件</text>
          <input v-model.trim="keyword" placeholder="搜索交付批次或项目" />
        </view>
        <view v-if="filteredDeliveries.length" class="card-list">
          <view v-for="item in filteredDeliveries" :key="item.deliveryId + item.deliveryPackageId" class="request-card">
            <view class="card-head">
              <view><text>{{ item.title }}</text><text>{{ item.projectName }}</text></view>
              <text class="status-badge">{{ item.statusLabel }}</text>
            </view>
            <view class="info-grid">
              <view><text>文件数量</text><text>{{ item.fileCount }}</text></view>
              <view><text>文件类型</text><text>{{ item.fileTypes }}</text></view>
              <view><text>版本号</text><text>{{ item.version }}</text></view>
              <view><text>下载有效期</text><text>{{ item.expiresAt || '需负责人授权' }}</text></view>
            </view>
            <text class="muted">{{ item.usageNote }}</text>
            <button class="outline-btn" :disabled="!item.downloadAuthorized" @click="recordDownload(item)">{{ item.downloadAuthorized ? '记录下载' : '等待正式交付' }}</button>
          </view>
        </view>
        <view v-else class="empty">暂无正式交付文件。</view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  CLIENT_PORTAL_TABS,
  buildClientPortalCenter,
  confirmClientVersion,
  recordClientDownload,
  requestClientRevision
} from '../../utils/client/clientPortalCenter'

const REQUEST_STEPS = ['已提交', '已受理', '需求确认中', '方案准备中', '已转项目', '已关闭']

export default {
  data() {
    return {
      activeTab: 'overview',
      query: {},
      keyword: '',
      selectedProjectId: '',
      revisionContent: '',
      tabs: CLIENT_PORTAL_TABS,
      requestSteps: REQUEST_STEPS,
      center: buildClientPortalCenter()
    }
  },
  computed: {
    filteredRequests() {
      const keyword = this.keyword.toLowerCase()
      return this.center.requests.filter((item) => !keyword || [item.leadId, item.companyName, item.statusLabel].join(' ').toLowerCase().includes(keyword))
    },
    filteredProjects() {
      const keyword = this.keyword.toLowerCase()
      return this.center.projects.filter((item) => !keyword || [item.projectId, item.projectName, item.customerName].join(' ').toLowerCase().includes(keyword))
    },
    filteredDeliveries() {
      const keyword = this.keyword.toLowerCase()
      return this.center.deliveries.filter((item) => !keyword || [item.deliveryId, item.title, item.projectName].join(' ').toLowerCase().includes(keyword))
    },
    selectedProject() {
      return this.center.projects.find((item) => item.projectId === this.selectedProjectId) || null
    },
    selectedProjectDeliveries() {
      if (!this.selectedProjectId) return []
      return this.center.deliveries.filter((item) => item.projectId === this.selectedProjectId)
    }
  },
  onLoad(options = {}) {
    this.query = options || {}
    this.activeTab = options.tab || 'overview'
    this.selectedProjectId = options.projectId || ''
    if (options.leadId) {
      this.keyword = decodeURIComponent(options.leadId)
      this.activeTab = 'requests'
    }
    this.reload()
  },
  methods: {
    reload() {
      this.center = buildClientPortalCenter(this.query)
    },
    setTab(tab) {
      this.activeTab = tab
      this.keyword = ''
      if (tab !== 'projects') this.selectedProjectId = ''
    },
    goRequest() {
      uni.navigateTo({ url: '/pages/enterprise-request/enterprise-request?sourceType=client_portal' })
    },
    contactOwner() {
      uni.showToast({ title: '请联系项目负责人或等待跟进通知', icon: 'none' })
    },
    jumpByNotice(item = {}) {
      if (item.type === 'request') {
        this.activeTab = 'requests'
        this.keyword = item.targetId || ''
      } else if (item.type === 'project') {
        this.openProject(item.targetId)
      } else {
        this.activeTab = 'deliveries'
        this.keyword = item.targetId || ''
      }
    },
    openProject(projectId) {
      this.activeTab = 'projects'
      this.selectedProjectId = projectId
      this.revisionContent = ''
    },
    confirmProject(confirmType) {
      if (!this.selectedProject) return
      try {
        confirmClientVersion({
          projectId: this.selectedProject.projectId,
          confirmType,
          version: this.selectedProject.versionLabel,
          confirmedBy: this.selectedProject.customerName || '企业客户',
          content: '客户在门户确认'
        })
        this.reload()
        uni.showToast({ title: '已确认', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '确认失败', icon: 'none' })
      }
    },
    requestRevision() {
      if (!this.selectedProject) return
      try {
        requestClientRevision({
          projectId: this.selectedProject.projectId,
          content: this.revisionContent
        })
        this.revisionContent = ''
        this.reload()
        uni.showToast({ title: '修改意见已提交', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '提交失败', icon: 'none' })
      }
    },
    recordDownload(delivery) {
      recordClientDownload(delivery)
      uni.showToast({ title: '下载行为已记录', icon: 'success' })
    },
    isRequestStepActive(item, step) {
      return item.statusLabel === step
    },
    formatTime(value = '') {
      return value ? String(value).slice(0, 16).replace('T', ' ') : '暂无'
    }
  }
}
</script>

<style scoped>
.client-page { min-height:100vh; padding:28rpx; background:#f8fafc; color:#0f172a; box-sizing:border-box; }
.client-nav, .client-shell { max-width:1200rpx; margin:0 auto; }
.client-nav { display:flex; justify-content:space-between; align-items:center; gap:18rpx; padding:20rpx 24rpx; border:1rpx solid #e2e8f0; border-radius:26rpx; background:#fff; box-shadow:0 18rpx 54rpx rgba(15,23,42,.06); }
.brand-title, .brand-sub, .section-title, .panel-title, .muted { display:block; }
.brand-title { font-size:30rpx; font-weight:950; }
.brand-sub, .muted { margin-top:6rpx; color:#64748b; font-size:21rpx; line-height:1.5; }
.nav-actions, .form-actions { display:flex; gap:12rpx; }
.primary-btn, .ghost-btn, .outline-btn { min-width:150rpx; height:58rpx; line-height:58rpx; margin:0; border-radius:999rpx; font-size:21rpx; font-weight:850; }
.primary-btn { background:#4f46e5; color:#fff; }
.ghost-btn, .outline-btn { border:1rpx solid #c7d2fe; background:#fff; color:#4338ca; }
.primary-btn.small { min-width:110rpx; height:48rpx; line-height:48rpx; font-size:20rpx; }
.client-shell { padding:34rpx 0 60rpx; }
.portal-tabs { display:flex; flex-wrap:wrap; gap:12rpx; margin-bottom:22rpx; }
.portal-tabs text { padding:12rpx 18rpx; border-radius:999rpx; background:#fff; color:#475569; font-size:22rpx; font-weight:850; }
.portal-tabs text.active { background:#4f46e5; color:#fff; }
.summary-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:14rpx; }
.summary-grid view, .panel, .request-card { border:1rpx solid rgba(15,23,42,.08); border-radius:24rpx; background:#fff; box-shadow:0 18rpx 52rpx rgba(15,23,42,.06); box-sizing:border-box; }
.summary-grid view { padding:20rpx; }
.summary-grid text { display:block; color:#64748b; font-size:20rpx; }
.summary-grid text:first-child { color:#111827; font-size:36rpx; font-weight:950; }
.content-grid, .detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18rpx; margin-top:20rpx; }
.panel { padding:22rpx; }
.panel-title { margin-bottom:14rpx; font-size:27rpx; font-weight:930; }
.notice-list, .next-list, .mini-list, .confirm-list { display:grid; gap:12rpx; }
.notice-list view, .next-list text, .mini-list view, .confirm-list view { padding:14rpx; border-radius:16rpx; background:#f8fafc; }
.notice-list text, .mini-list text, .confirm-list text { display:block; color:#475569; font-size:21rpx; line-height:1.45; }
.notice-list text:first-child, .mini-list text:first-child, .confirm-list text:first-child { color:#111827; font-weight:900; }
.confirm-list view { display:flex; align-items:center; justify-content:space-between; gap:12rpx; }
.section-head { display:flex; justify-content:space-between; align-items:center; gap:18rpx; margin-bottom:18rpx; }
.section-title { font-size:34rpx; font-weight:950; }
.section-head input { width:420rpx; height:58rpx; padding:0 18rpx; border-radius:16rpx; background:#fff; border:1rpx solid #e2e8f0; font-size:22rpx; box-sizing:border-box; }
.card-list { display:grid; gap:16rpx; }
.request-card { padding:22rpx; }
.card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18rpx; }
.card-head text { display:block; color:#64748b; font-size:21rpx; }
.card-head text:first-child { color:#111827; font-size:28rpx; font-weight:930; }
.status-badge { padding:8rpx 13rpx; border-radius:999rpx; background:#eef2ff; color:#4338ca !important; font-weight:900; white-space:nowrap; }
.progress-line { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8rpx; margin-top:18rpx; }
.progress-line text { padding:10rpx 8rpx; border-radius:14rpx; background:#f1f5f9; color:#64748b; font-size:19rpx; text-align:center; }
.progress-line text.active, .progress-line text.done { background:#eef2ff; color:#4338ca; font-weight:900; }
.progress-line.large text { padding:14rpx 10rpx; }
.info-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10rpx; margin-top:16rpx; }
.info-grid view { padding:13rpx; border-radius:15rpx; background:#f8fafc; }
.info-grid text { display:block; color:#334155; font-size:20rpx; line-height:1.45; }
.info-grid text:first-child { color:#64748b; font-size:18rpx; font-weight:850; }
.outline-btn { margin-top:16rpx; }
.empty { padding:34rpx; border-radius:22rpx; background:#fff; color:#64748b; font-size:23rpx; text-align:center; }
.empty.compact { padding:18rpx; background:#f8fafc; font-size:21rpx; }
.back-link { display:block; margin-bottom:16rpx; color:#4f46e5; font-size:23rpx; font-weight:850; }
.detail-hero { display:flex; justify-content:space-between; align-items:flex-start; gap:18rpx; padding:22rpx; border-radius:24rpx; background:#fff; border:1rpx solid #e2e8f0; }
.work-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12rpx; }
.work-card { padding:10rpx; border-radius:18rpx; background:#f8fafc; }
.work-card image, .work-card view { width:100%; height:170rpx; border-radius:14rpx; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; }
.work-card text { display:block; margin-top:8rpx; color:#475569; font-size:19rpx; }
.textarea { width:100%; min-height:120rpx; margin-top:16rpx; padding:18rpx; border:1rpx solid #e2e8f0; border-radius:18rpx; background:#f8fafc; font-size:22rpx; box-sizing:border-box; }
@media screen and (max-width:900px) {
  .client-page { padding:18rpx; }
  .client-nav, .section-head, .detail-hero { display:block; }
  .nav-actions { margin-top:16rpx; flex-wrap:wrap; }
  .summary-grid, .content-grid, .detail-grid, .info-grid, .work-grid { grid-template-columns:1fr; }
  .progress-line { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .section-head input { width:100%; margin-top:14rpx; }
}
</style>
