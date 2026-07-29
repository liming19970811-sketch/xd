<template>
  <view class="data-health-page">
    <aside class="side-nav">
      <view class="brand">
        <text class="brand-mark">DR</text>
        <view>
          <text class="brand-title">数据容灾中心</text>
          <text class="brand-sub">Backup & Recovery</text>
        </view>
      </view>
      <button
        v-for="item in tabs"
        :key="item.key"
        class="nav-item"
        :class="{ active: currentTab === item.key }"
        @click="switchTab(item.key)"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="main">
      <view v-if="!center.canAccess" class="state-card forbidden">
        <text class="page-title">无权限访问数据容灾中心</text>
        <text class="page-desc">仅平台最高权限管理员可查看备份、恢复和一致性检查。恢复操作还需要二次确认。</text>
      </view>

      <template v-else>
        <view class="page-head">
          <view>
            <text class="eyebrow">Data Health</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">保护用户项目、任务、作品、版型、企业数据和关键配置。云存储文件与数据库记录分开治理，恢复默认按范围执行。</text>
          </view>
          <view class="head-actions">
            <button class="outline-btn" @click="reload">刷新</button>
            <button class="primary-btn" @click="createBackup('manual_checkpoint')">手动备份</button>
          </view>
        </view>

        <view class="metric-grid">
          <view class="metric-card">
            <text>备份数量</text>
            <strong>{{ center.backups.length }}</strong>
            <small>已完成 {{ completedBackupCount }}</small>
          </view>
          <view class="metric-card">
            <text>恢复记录</text>
            <strong>{{ center.recoveries.length }}</strong>
            <small>范围恢复，不默认整库覆盖</small>
          </view>
          <view class="metric-card">
            <text>一致性问题</text>
            <strong>{{ center.consistency.issues.length }}</strong>
            <small>高风险 {{ center.consistency.issueSummary.high || 0 }}</small>
          </view>
          <view class="metric-card">
            <text>回收站</text>
            <strong>{{ center.recycleBin.length }}</strong>
            <small>软删除与延迟清理</small>
          </view>
        </view>

        <view v-if="currentTab === 'health'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">一致性检查</text>
              <text class="section-desc">只生成修复建议，不自动删除数据。</text>
            </view>
            <button class="outline-btn" @click="runConsistencyCheck">重新检查</button>
          </view>
          <view class="health-grid">
            <view v-for="(value, key) in center.consistency.metrics" :key="key" class="mini-card">
              <text>{{ getMetricLabel(key) }}</text>
              <strong>{{ value }}</strong>
            </view>
          </view>
          <view class="issue-list">
            <view v-for="issue in center.consistency.issues" :key="issue.issueId" class="issue-card" :class="issue.level">
              <view>
                <text class="card-title">{{ issue.title }}</text>
                <text class="row-meta">{{ issue.type }} · {{ issue.level }} · {{ issue.targetId || '-' }}</text>
                <text class="card-desc">{{ issue.description }}</text>
                <text class="suggestion">建议：{{ issue.suggestion }}</text>
              </view>
            </view>
            <view v-if="!center.consistency.issues.length" class="state-card">
              <text>当前未发现阻断级数据一致性问题。</text>
            </view>
          </view>

          <view class="section-head compact">
            <view>
              <text class="section-title">核心数据范围</text>
              <text class="section-desc">备份范围覆盖数据库记录；云存储文件按 fileId、引用关系和生命周期策略独立治理。</text>
            </view>
          </view>
          <view class="scope-grid">
            <view v-for="scope in center.scopes" :key="scope.scopeId" class="scope-card">
              <text class="card-title">{{ scope.label }}</text>
              <text class="row-meta">{{ scope.storageKeyCount }} 个存储键 · {{ scope.recordCount }} 条记录</text>
              <text class="checksum">{{ scope.checksum }}</text>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'backups'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">备份策略</text>
              <text class="section-desc">支持定期自动、发布前、结构升级前和手动关键节点备份。V1 先记录可验证快照，生产环境需接入云端备份存储。</text>
            </view>
            <view class="head-actions">
              <button class="outline-btn" @click="createBackup('before_release')">发布前备份</button>
              <button class="outline-btn" @click="createBackup('before_schema_upgrade')">升级前备份</button>
            </view>
          </view>
          <view class="backup-list">
            <view v-for="backup in center.backups" :key="backup.backupId" class="backup-card">
              <view class="card-head">
                <view>
                  <text class="card-title">{{ backup.backupId }}</text>
                  <text class="row-meta">{{ getReasonLabel(backup.reason) }} · {{ formatDate(backup.startedAt) }}</text>
                </view>
                <text class="status" :class="backup.status">{{ backup.status }}</text>
              </view>
              <view class="detail-grid">
                <view><text>数据版本</text><strong>{{ backup.dataVersion }}</strong></view>
                <view><text>记录数量</text><strong>{{ backup.recordCount }}</strong></view>
                <view><text>文件数量</text><strong>{{ backup.fileCount }}</strong></view>
                <view><text>校验</text><strong>{{ backup.checkResult.ok ? '通过' : '需复核' }}</strong></view>
              </view>
              <view class="scope-tags">
                <text v-for="scope in backup.scopes" :key="scope.scopeId">{{ scope.label }}</text>
              </view>
              <view class="actions">
                <button class="outline-btn" @click="selectBackup(backup)">选择用于恢复</button>
              </view>
            </view>
            <view v-if="!center.backups.length" class="state-card">
              <text>暂无备份记录。建议在发布前或数据结构升级前创建备份。</text>
            </view>
          </view>
        </view>

        <view v-else class="section recovery-grid">
          <view class="recovery-panel">
            <view class="section-head">
              <view>
                <text class="section-title">范围恢复</text>
                <text class="section-desc">恢复前会先创建当前状态快照，并要求输入原因和二次确认。</text>
              </view>
            </view>
            <label class="field">
              <text>备份 ID</text>
              <input v-model.trim="recoveryForm.backupId" placeholder="请选择或输入 backupId" />
            </label>
            <label class="field">
              <text>恢复范围</text>
              <picker mode="selector" :range="scopeLabels" :value="selectedScopeIndex" @change="selectScope">
                <view class="picker-value">{{ selectedScopeLabel }}</view>
              </picker>
            </label>
            <label class="field">
              <text>恢复原因</text>
              <textarea v-model.trim="recoveryForm.reason" placeholder="请说明恢复原因、影响范围和审批信息" />
            </label>
            <label class="field">
              <text>二次确认</text>
              <input v-model.trim="recoveryForm.confirmText" placeholder="输入：确认恢复" />
            </label>
            <view class="actions">
              <button class="outline-btn" @click="previewRecovery">查看影响预估</button>
              <button class="danger-btn" :disabled="recovering" @click="executeRecovery">{{ recovering ? '恢复中...' : '执行恢复' }}</button>
            </view>
            <view v-if="recoveryPreview" class="preview-card">
              <text class="card-title">影响预估</text>
              <text>记录数量：{{ recoveryPreview.estimatedRecordCount }}</text>
              <text>存储键：{{ recoveryPreview.affectedStorageKeys.join('、') || '-' }}</text>
              <text>{{ recoveryPreview.warning }}</text>
            </view>
          </view>

          <view class="recovery-panel">
            <view class="section-head">
              <view>
                <text class="section-title">恢复记录与演练</text>
                <text class="section-desc">至少在非生产环境完成一次恢复演练，再扩大生产恢复范围。</text>
              </view>
              <button class="outline-btn" @click="recordDrill">记录演练</button>
            </view>
            <view class="record-list">
              <view v-for="record in center.recoveries" :key="record.recoveryId" class="record-row">
                <text>{{ record.recoveryId }}</text>
                <text>{{ record.status }} · {{ formatDate(record.createdAt) }}</text>
                <text>{{ record.scopeIds.join('、') || '-' }}</text>
              </view>
              <view v-if="!center.recoveries.length" class="state-card">暂无恢复记录。</view>
            </view>
            <view class="recycle-list">
              <text class="section-title">软删除与回收站</text>
              <view v-for="item in center.recycleBin" :key="item.recycleId" class="record-row">
                <text>{{ item.title }}</text>
                <text>{{ item.resourceType }} · {{ item.status }}</text>
                <text>{{ item.plannedCleanupAt }}</text>
              </view>
              <view v-if="!center.recycleBin.length" class="state-card">暂无待恢复或待清理资源。</view>
            </view>
          </view>
        </view>

        <view class="policy-panel">
          <text v-for="item in center.policies" :key="item">{{ item }}</text>
        </view>
      </template>
    </main>
  </view>
</template>

<script>
import {
  CORE_DATA_SCOPES,
  buildRecoveryPreview,
  createDataBackup,
  executeScopedRecovery,
  loadDataRecoveryCenter,
  recordRecoveryDrill,
  runDataConsistencyCheck
} from '../../utils/admin/dataRecoveryCenter'

const TAB_ROUTES = {
  health: '/admin/data-health',
  backups: '/admin/backups',
  recovery: '/admin/recovery'
}

export default {
  data() {
    return {
      currentTab: 'health',
      tabs: [
        { key: 'health', label: '数据健康' },
        { key: 'backups', label: '备份管理' },
        { key: 'recovery', label: '恢复中心' }
      ],
      center: loadDataRecoveryCenter(),
      recoveryForm: {
        backupId: '',
        scopeId: '',
        reason: '',
        confirmText: ''
      },
      selectedScopeIndex: 0,
      recoveryPreview: null,
      recovering: false
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '数据容灾中心'
    },
    completedBackupCount() {
      return this.center.backups.filter((item) => item.status === 'completed').length
    },
    scopeLabels() {
      return ['全部核心数据', ...CORE_DATA_SCOPES.map((item) => item.label)]
    },
    selectedScopeLabel() {
      return this.scopeLabels[this.selectedScopeIndex] || '全部核心数据'
    }
  },
  onLoad(query = {}) {
    this.currentTab = ['health', 'backups', 'recovery'].includes(query.tab) ? query.tab : 'health'
    if (query.backupId) this.recoveryForm.backupId = decodeURIComponent(query.backupId)
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadDataRecoveryCenter()
    },
    switchTab(tab) {
      this.currentTab = tab
      const route = TAB_ROUTES[tab] || TAB_ROUTES.health
      if (typeof window !== 'undefined') {
        window.location.hash = route
      } else {
        uni.redirectTo({ url: `/pages/admin-data-health/admin-data-health?tab=${encodeURIComponent(tab)}` })
      }
    },
    getMetricLabel(key) {
      const map = {
        projectCount: '项目',
        taskCount: '任务',
        fileCount: '文件记录',
        fileReferenceCount: '文件引用',
        patternMasterCount: '版型主体',
        patternVersionCount: '版型版本',
        deliveryCount: '交付记录'
      }
      return map[key] || key
    },
    getReasonLabel(reason) {
      const map = {
        scheduled: '定期自动',
        before_release: '发布前',
        before_schema_upgrade: '结构升级前',
        manual_checkpoint: '手动关键节点'
      }
      return map[reason] || reason
    },
    formatDate(value) {
      if (!value) return '-'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    },
    createBackup(reason) {
      const result = createDataBackup({ reason })
      this.reload()
      uni.showToast({ title: result.success ? '备份已完成' : result.message || '备份失败', icon: 'none' })
    },
    runConsistencyCheck() {
      const result = runDataConsistencyCheck()
      this.center = { ...this.center, consistency: result }
      uni.showToast({ title: result.canAccess ? '检查已完成' : '无权限检查', icon: 'none' })
    },
    selectBackup(backup) {
      this.recoveryForm.backupId = backup.backupId
      this.currentTab = 'recovery'
      this.recoveryPreview = null
    },
    selectScope(event) {
      const index = Number(event.detail.value) || 0
      this.selectedScopeIndex = index
      this.recoveryForm.scopeId = index > 0 ? CORE_DATA_SCOPES[index - 1].scopeId : ''
    },
    getSelectedScopeIds() {
      return this.recoveryForm.scopeId ? [this.recoveryForm.scopeId] : CORE_DATA_SCOPES.map((item) => item.scopeId)
    },
    previewRecovery() {
      const result = buildRecoveryPreview(this.recoveryForm.backupId, this.getSelectedScopeIds())
      this.recoveryPreview = result.success ? result : null
      uni.showToast({ title: result.success ? '已生成影响预估' : result.message || '预估失败', icon: 'none' })
    },
    executeRecovery() {
      if (this.recovering) return
      this.recovering = true
      try {
        const result = executeScopedRecovery({
          backupId: this.recoveryForm.backupId,
          scopeIds: this.getSelectedScopeIds(),
          reason: this.recoveryForm.reason,
          confirmText: this.recoveryForm.confirmText
        })
        this.reload()
        uni.showToast({ title: result.success ? '恢复已完成' : result.message || '恢复失败', icon: 'none' })
      } finally {
        this.recovering = false
      }
    },
    recordDrill() {
      const result = recordRecoveryDrill({
        backupId: this.recoveryForm.backupId,
        environment: 'staging',
        status: 'completed',
        recordCheck: 'passed',
        fileAccessCheck: 'pending',
        authPermissionCheck: 'pending',
        quotaDeliveryCheck: 'pending',
        durationMinutes: 0
      })
      this.reload()
      uni.showToast({ title: result.success ? '演练记录已保存' : result.message || '保存失败', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.data-health-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  background: #f5f7fb;
  color: #111827;
}
.side-nav {
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
  gap: 12px;
  align-items: center;
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
.card-desc,
.row-meta,
.suggestion,
.checksum {
  display: block;
}
.brand-title {
  font-weight: 900;
  font-size: 15px;
}
.brand-sub,
.row-meta,
.page-desc,
.section-desc,
.checksum {
  color: #64748b;
}
.nav-item {
  width: 100%;
  height: 42px;
  margin: 0 0 8px;
  padding: 0 14px;
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
  font-weight: 800;
}
.main {
  min-width: 0;
  padding: 28px;
}
.page-head,
.section-head,
.card-head,
.head-actions,
.actions {
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
  text-transform: uppercase;
}
.page-title {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 950;
}
.page-desc {
  margin-top: 8px;
  max-width: 860px;
  font-size: 14px;
  line-height: 1.7;
}
.metric-grid,
.health-grid,
.scope-grid {
  display: grid;
  gap: 14px;
}
.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 18px;
}
.metric-card,
.section,
.state-card,
.scope-card,
.backup-card,
.recovery-panel,
.preview-card,
.policy-panel,
.mini-card,
.issue-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 40px rgba(15, 23, 42, .05);
  box-sizing: border-box;
}
.metric-card {
  padding: 18px;
}
.metric-card text,
.metric-card small,
.mini-card text {
  display: block;
  color: #64748b;
  font-size: 13px;
}
.metric-card strong {
  display: block;
  margin: 8px 0 4px;
  font-size: 28px;
}
.section,
.recovery-panel {
  padding: 20px;
}
.section-head {
  margin-bottom: 16px;
}
.section-head.compact {
  margin-top: 24px;
}
.section-title {
  font-size: 18px;
  font-weight: 900;
}
.health-grid {
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-bottom: 16px;
}
.mini-card {
  padding: 12px;
}
.mini-card strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
}
.issue-list,
.backup-list,
.record-list,
.recycle-list {
  display: grid;
  gap: 12px;
}
.issue-card,
.backup-card,
.preview-card,
.state-card {
  padding: 16px;
}
.issue-card.high {
  border-color: #fecaca;
  background: #fff7f7;
}
.issue-card.medium {
  border-color: #fed7aa;
  background: #fffaf3;
}
.issue-card.low {
  border-color: #bae6fd;
  background: #f0f9ff;
}
.card-title {
  font-size: 15px;
  font-weight: 900;
}
.card-desc,
.suggestion {
  margin-top: 8px;
  color: #475569;
  line-height: 1.6;
  font-size: 13px;
}
.scope-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.scope-card {
  padding: 15px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.detail-grid view {
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
}
.detail-grid text,
.detail-grid strong {
  display: block;
}
.detail-grid text {
  color: #64748b;
  font-size: 12px;
}
.detail-grid strong {
  margin-top: 5px;
  font-size: 14px;
}
.scope-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.scope-tags text,
.status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 800;
}
.status.completed {
  background: #ecfdf5;
  color: #047857;
}
.status.failed {
  background: #fef2f2;
  color: #b91c1c;
}
.outline-btn,
.primary-btn,
.danger-btn {
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
.primary-btn {
  border: 0;
  background: #4f46e5;
  color: #fff;
}
.danger-btn {
  border: 0;
  background: #dc2626;
  color: #fff;
}
.danger-btn[disabled] {
  opacity: .55;
}
.recovery-grid {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 16px;
  padding: 0;
  border: 0;
  box-shadow: none;
  background: transparent;
}
.field {
  display: block;
  margin-bottom: 14px;
}
.field text {
  display: block;
  margin-bottom: 8px;
  color: #334155;
  font-weight: 850;
}
.field input,
.field textarea,
.picker-value {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f8fafc;
  box-sizing: border-box;
  color: #111827;
}
.field textarea {
  min-height: 92px;
}
.preview-card {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  color: #475569;
  font-size: 13px;
}
.record-row {
  display: grid;
  grid-template-columns: 1.3fr .9fr 1fr;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  font-size: 13px;
}
.recycle-list {
  margin-top: 20px;
}
.policy-panel {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  padding: 16px;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}
.forbidden {
  max-width: 640px;
}
@media screen and (max-width: 900px) {
  .data-health-page {
    grid-template-columns: 1fr;
  }
  .side-nav {
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
  .main {
    padding: 18px;
  }
  .page-head,
  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .metric-grid,
  .health-grid,
  .scope-grid,
  .detail-grid,
  .recovery-grid {
    grid-template-columns: 1fr;
  }
  .record-row {
    grid-template-columns: 1fr;
  }
}
</style>
