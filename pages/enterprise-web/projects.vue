<template>
  <view class="enterprise-page">
    <!-- #ifdef H5 -->
    <view class="shell">
      <view class="sidebar">
        <view class="brand">
          <text class="brand-title">{{ labels.brand }}</text>
          <text class="brand-desc">{{ labels.brandDesc }}</text>
        </view>
        <view class="menu">
          <view
            v-for="item in menu"
            :key="item.key"
            :class="['menu-item', item.key === 'projects' ? 'active' : '']"
            @click="goTo(item)"
          >
            <text class="menu-icon">{{ item.icon }}</text>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="main">
        <view class="topbar">
          <view>
            <text class="page-title">{{ labels.pageTitle }}</text>
            <text class="page-desc">{{ labels.pageDesc }}</text>
          </view>
          <view class="meta">
            <text>{{ guard.currentEnterprise.enterpriseName || labels.emptyEnterprise }}</text>
            <text>{{ guard.currentUser.name || labels.emptyUser }} / {{ guard.currentRole || '--' }}</text>
          </view>
        </view>

        <view v-if="pageState === 'loading'" class="state-card">{{ labels.loading }}</view>
        <view v-else-if="pageState === 'forbidden'" class="state-card denied">{{ guardMessage }}</view>
        <view v-else-if="pageState === 'error'" class="state-card denied">{{ errorMessage || labels.error }}</view>
        <view v-else>
          <view class="filterbar">
            <input v-model="keyword" class="filter-input" :placeholder="labels.searchPlaceholder" />
            <picker :range="statusOptions" range-key="label" @change="handleStatusChange">
              <view class="filter-select">{{ currentStatusLabel }}</view>
            </picker>
          </view>

          <view class="table-card">
            <view class="table-head row">
              <text>{{ labels.projectName }}</text>
              <text>{{ labels.customerName }}</text>
              <text>{{ labels.stage }}</text>
              <text>{{ labels.status }}</text>
              <text>{{ labels.owner }}</text>
              <text>{{ labels.updatedAt }}</text>
              <text>{{ labels.action }}</text>
            </view>
            <view v-if="filteredProjects.length">
              <view
                v-for="project in filteredProjects"
                :key="project.projectId"
                class="row data-row"
                @click="openProject(project)"
              >
                <text class="strong">{{ getProjectName(project) }}</text>
                <text>{{ project.customerName || project.clientName || '--' }}</text>
                <text><text class="stage-tag">{{ getStageLabel(project) }}</text></text>
                <text><text class="status-tag">{{ getStatusLabel(project) }}</text></text>
                <text>{{ project.owner || project.ownerName || project.managerName || project.updatedBy || '--' }}</text>
                <text>{{ formatTime(project.updatedAt || project.createdAt) }}</text>
                <view class="actions" @click.stop>
                  <button v-if="canManageProject" class="mini-btn" @click="openProject(project)">{{ labels.edit }}</button>
                  <button v-if="canDeleteProject" class="mini-btn danger" @click="confirmDeleteProject(project)">{{ labels.delete }}</button>
                  <button v-if="!canManageProject && !canDeleteProject" class="mini-btn ghost" @click="openProject(project)">{{ labels.view }}</button>
                </view>
              </view>
            </view>
            <view v-else class="empty">{{ labels.empty }}</view>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="platform-tip">{{ labels.h5Only }}</view>
    <!-- #endif -->
  </view>
</template>

<script>
import { deleteProject, getProjects } from '../../utils/project/projectService.js'
import { getEnterpriseGuardMessage, requirePermission } from '../../utils/enterprise-web/enterpriseWebGuard.js'
import { getEnterpriseWebMenu } from '../../utils/enterprise-web/enterpriseWebMenu.js'
import { buildEnterpriseWebUrl } from '../../utils/enterprise-web/enterpriseWebRoutes.js'
import { PERMISSION_KEYS } from '../../utils/permission/permissionCatalog.js'
import { getProjectStageLabel, getProjectStatusLabel, normalizeProjectStage } from '../../utils/project/projectStage.js'

const LABELS = Object.freeze({
  brand: '\u8776\u53d8',
  brandDesc: '\u670d\u88c5\u4f01\u4e1a\u5de5\u4f5c\u53f0',
  pageTitle: '\u9879\u76ee\u7ba1\u7406',
  pageDesc: '\u67e5\u770b\u5f53\u524d\u4f01\u4e1a\u7684\u9879\u76ee\u3001\u9636\u6bb5\u548c\u8d1f\u8d23\u4eba\u3002',
  loading: '\u52a0\u8f7d\u9879\u76ee\u4e2d...',
  empty: '\u6682\u65e0\u9879\u76ee',
  forbidden: '\u65e0\u6743\u9650\u67e5\u770b',
  error: '\u52a0\u8f7d\u5931\u8d25',
  h5Only: '\u4f01\u4e1a\u7f51\u9875\u7248\u4ec5\u5728 H5 \u5e73\u53f0\u663e\u793a\u3002',
  searchPlaceholder: '\u641c\u7d22\u9879\u76ee\u540d\u79f0\u3001\u5ba2\u6237\u6216\u8d1f\u8d23\u4eba',
  allStatuses: '\u5168\u90e8\u9636\u6bb5',
  projectName: '\u9879\u76ee\u540d\u79f0',
  customerName: '\u5ba2\u6237\u540d\u79f0',
  stage: '\u9879\u76ee\u9636\u6bb5',
  status: '\u72b6\u6001',
  owner: '\u8d1f\u8d23\u4eba',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  action: '\u64cd\u4f5c',
  view: '\u67e5\u770b',
  edit: '\u7f16\u8f91',
  delete: '\u5220\u9664',
  deleteConfirm: '\u786e\u8ba4\u5220\u9664\u8be5\u9879\u76ee\uff1f',
  deleteSuccess: '\u9879\u76ee\u5df2\u5220\u9664',
  deleteFailed: '\u9879\u76ee\u5220\u9664\u5931\u8d25',
  emptyEnterprise: '\u672a\u9009\u62e9\u4f01\u4e1a',
  emptyUser: '\u672a\u767b\u5f55\u7528\u6237'
})

const STATUS_OPTIONS = Object.freeze([
  { label: LABELS.allStatuses, value: '' },
  { label: '\u9700\u6c42\u9636\u6bb5', value: 'draft' },
  { label: '\u8bbe\u8ba1\u9636\u6bb5', value: 'design' },
  { label: '\u751f\u4ea7\u9636\u6bb5', value: 'production' },
  { label: '\u5ba1\u6838\u9636\u6bb5', value: 'review' },
  { label: '\u4ea4\u4ed8\u9636\u6bb5', value: 'delivery' },
  { label: '\u5b8c\u6210\u9636\u6bb5', value: 'completed' }
])

export default {
  data() {
    return {
      labels: LABELS,
      menu: getEnterpriseWebMenu(),
      guard: requirePermission(PERMISSION_KEYS.PROJECT_VIEW),
      manageGuard: requirePermission(PERMISSION_KEYS.PROJECT_MANAGE),
      deleteGuard: requirePermission(PERMISSION_KEYS.PROJECT_DELETE),
      pageState: 'loading',
      errorMessage: '',
      projects: [],
      keyword: '',
      stageFilter: '',
      statusOptions: STATUS_OPTIONS
    }
  },
  computed: {
    guardMessage() {
      return getEnterpriseGuardMessage(this.guard.reason) || this.labels.forbidden
    },
    currentStatusLabel() {
      return (this.statusOptions.find((item) => item.value === this.stageFilter) || this.statusOptions[0]).label
    },
    canManageProject() {
      return this.manageGuard.allowed
    },
    canDeleteProject() {
      return this.deleteGuard.allowed
    },
    filteredProjects() {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      return this.projects
        .filter((project) => !this.stageFilter || normalizeProjectStage(project.stage || project.status) === this.stageFilter)
        .filter((project) => {
          if (!keyword) return true
          return [
            project.name,
            project.title,
            project.projectName,
            project.customerName,
            project.clientName,
            project.owner,
            project.ownerName,
            project.managerName
          ].some((value) => String(value || '').toLowerCase().includes(keyword))
        })
    }
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async refresh() {
      this.guard = requirePermission(PERMISSION_KEYS.PROJECT_VIEW)
      this.manageGuard = requirePermission(PERMISSION_KEYS.PROJECT_MANAGE)
      this.deleteGuard = requirePermission(PERMISSION_KEYS.PROJECT_DELETE)
      if (!this.guard.allowed) {
        this.pageState = 'forbidden'
        return
      }
      try {
        this.pageState = 'loading'
        this.errorMessage = ''
        const result = await getProjects()
        this.projects = result.projects || []
        this.pageState = 'ready'
        this.logProjectLoad(true)
      } catch (error) {
        this.projects = []
        this.pageState = 'error'
        this.errorMessage = error && error.message ? error.message : this.labels.error
        this.logProjectLoad(false, error && error.code)
      }
    },
    logProjectLoad(success, errorCode = '') {
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
      console.log('[enterprise-project:list]', {
        count: this.projects.length,
        success: Boolean(success),
        errorCode: errorCode || ''
      })
    },
    goTo(item = {}) {
      if (item.route && item.key !== 'projects') uni.navigateTo({ url: item.route })
    },
    handleStatusChange(event) {
      const index = Number(event.detail.value) || 0
      this.stageFilter = this.statusOptions[index].value
    },
    openProject(project = {}) {
      if (!project.projectId) return
      uni.navigateTo({ url: buildEnterpriseWebUrl('projectDetail', { projectId: project.projectId }) })
    },
    confirmDeleteProject(project = {}) {
      if (!this.canDeleteProject || !project.projectId) return
      uni.showModal({
        title: this.labels.delete,
        content: this.labels.deleteConfirm,
        success: async (res) => {
          if (!res.confirm) return
          const result = await deleteProject(project.projectId, Number(project.version || 0))
          if (!result || !result.success) {
            uni.showToast({ title: result?.message || this.labels.deleteFailed, icon: 'none' })
            return
          }
          uni.showToast({ title: this.labels.deleteSuccess, icon: 'none' })
          await this.refresh()
        }
      })
    },
    getProjectName(project = {}) {
      return project.name || project.title || project.projectName || '\u672a\u547d\u540d\u9879\u76ee'
    },
    getStageLabel(project = {}) {
      return getProjectStageLabel(project.stage || project.status)
    },
    getStatusLabel(project = {}) {
      return getProjectStatusLabel(project.status || project.stage)
    },
    formatTime(value = '') {
      return value ? String(value).slice(0, 16).replace('T', ' ') : '--'
    }
  }
}
</script>

<style scoped>
.enterprise-page { min-height: 100vh; background: #f4f6fb; color: #172033; }
.shell { display: flex; min-height: 100vh; }
.sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 216px; padding: 24px 16px; background: #101828; color: #fff; box-sizing: border-box; }
.brand { margin-bottom: 28px; }
.brand-title { display: block; font-size: 22px; font-weight: 800; }
.brand-desc { display: block; margin-top: 6px; color: #a9b4ca; font-size: 12px; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; color: #cbd5e1; font-size: 14px; cursor: pointer; }
.menu-item.active, .menu-item:hover { background: #eef2ff; color: #4f46e5; }
.menu-icon { width: 24px; height: 24px; border-radius: 8px; background: rgba(255,255,255,0.1); text-align: center; line-height: 24px; font-size: 12px; }
.main { flex: 1; margin-left: 216px; padding: 24px; box-sizing: border-box; min-width: 0; }
.topbar, .filterbar, .table-card, .state-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
.topbar { display: flex; justify-content: space-between; gap: 16px; padding: 20px 24px; margin-bottom: 18px; }
.page-title { display: block; font-size: 24px; font-weight: 800; }
.page-desc, .meta text { display: block; margin-top: 6px; color: #64748b; font-size: 13px; }
.meta { text-align: right; }
.filterbar { display: flex; gap: 12px; padding: 14px; margin-bottom: 14px; }
.filter-input, .filter-select { height: 38px; padding: 0 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 14px; box-sizing: border-box; }
.filter-input { flex: 1; }
.table-card { overflow-x: auto; }
.row { display: grid; grid-template-columns: 1.25fr 1fr 0.9fr 0.8fr 0.9fr 1fr 1fr; gap: 12px; align-items: center; min-width: 920px; padding: 14px 18px; font-size: 13px; box-sizing: border-box; }
.table-head { color: #64748b; background: #f8fafc; font-weight: 700; }
.data-row { border-top: 1px solid #eef2f7; cursor: pointer; }
.data-row:hover { background: #fbfdff; }
.strong { font-weight: 800; color: #111827; }
.stage-tag, .status-tag { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; }
.status-tag { background: #ecfeff; color: #0e7490; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mini-btn { min-width: 54px; height: 30px; line-height: 30px; padding: 0 10px; border-radius: 8px; background: #eef2ff; color: #4f46e5; font-size: 12px; }
.mini-btn.danger { background: #fff1f2; color: #e11d48; }
.mini-btn.ghost { background: #f8fafc; color: #475569; }
.empty, .state-card, .platform-tip { padding: 24px; color: #64748b; }
.denied { color: #b42318; }
@media (max-width: 900px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; }
  .main { margin-left: 0; padding: 16px; }
  .topbar, .filterbar { display: block; }
  .meta { text-align: left; margin-top: 12px; }
  .filter-input, .filter-select { width: 100%; margin-top: 10px; }
}
</style>
