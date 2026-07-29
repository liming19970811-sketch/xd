<template>
  <view class="file-page">
    <view class="file-shell">
      <aside class="file-sidebar">
        <text class="brand-title">文件治理中心</text>
        <text class="brand-sub">云存储、权限、生命周期</text>
        <text
          v-for="item in statusTabs"
          :key="item.key"
          class="nav-item"
          :class="{ active: statusFilter === item.key }"
          @click="setStatus(item.key)"
        >
          {{ item.label }}
        </text>
      </aside>

      <main class="file-main">
        <view class="page-head">
          <view>
            <text class="eyebrow">File Governance</text>
            <text class="page-title">素材上传、云存储与文件治理</text>
            <text class="page-desc">业务数据保存稳定 fileId，临时 HTTPS 地址只用于短期预览、AI 调用或下载授权。</text>
          </view>
          <button class="primary-btn" @click="reload">刷新</button>
        </view>

        <view class="summary-grid">
          <view class="summary-card"><text>文件总数</text><strong>{{ center.summary.total }}</strong><small>统一文件记录</small></view>
          <view class="summary-card"><text>可用文件</text><strong>{{ center.summary.active }}</strong><small>active</small></view>
          <view class="summary-card"><text>隔离文件</text><strong>{{ center.summary.quarantined }}</strong><small>quarantined</small></view>
          <view class="summary-card"><text>待清理</text><strong>{{ center.summary.pendingDelete }}</strong><small>pending_delete</small></view>
        </view>

        <view class="policy-panel">
          <text>本地临时路径、http://tmp、wxfile:// 不得直接传给 AI 供应商。</text>
          <text>私有文件默认不可公开访问；AI 调用和下载需生成短期临时 URL。</text>
          <text>已交付资产、已批准版型和审计附件不得被普通用户直接删除。</text>
        </view>

        <view class="toolbar">
          <input v-model.trim="keyword" placeholder="搜索 fileId、文件名、摘要或存储路径" @input="reload" />
          <picker :range="assetTypeLabels" :value="assetTypeIndex" @change="onAssetTypeChange">
            <view>{{ assetTypeLabels[assetTypeIndex] }}</view>
          </picker>
        </view>

        <view class="file-table">
          <view class="file-row head">
            <text>文件</text>
            <text>类型</text>
            <text>权限</text>
            <text>大小/MIME</text>
            <text>摘要</text>
            <text>状态</text>
            <text>操作</text>
          </view>
          <view v-for="file in center.records" :key="file.fileId" class="file-row">
            <view>
              <text class="file-name">{{ file.fileName }}</text>
              <text class="file-meta">{{ file.fileId }}</text>
              <text class="file-meta">{{ file.storagePath }}</text>
            </view>
            <text>{{ getAssetTypeLabel(file.assetType) }}</text>
            <text>{{ file.permissionScope }} · {{ file.enterpriseId }}</text>
            <text>{{ formatSize(file.fileSize) }} · {{ file.mimeType }}</text>
            <text>{{ shortDigest(file.fileDigest) }}</text>
            <text class="status" :class="file.status">{{ file.status }}</text>
            <view class="actions">
              <button class="outline-btn" @click="auditDownload(file)">记录下载</button>
              <button class="outline-btn danger" @click="requestDelete(file)">申请删除</button>
            </view>
          </view>
        </view>

        <view v-if="!center.records.length" class="empty-state">
          暂无文件记录。通过统一上传服务上传后会在这里展示。
        </view>
      </main>
    </view>
  </view>
</template>

<script>
import { FILE_ASSET_TYPES, requestFileDelete } from '../../utils/upload/fileRepository'
import { auditFileDownload, loadFileGovernanceCenter } from '../../utils/upload/unifiedUploadService'

const STATUS_TABS = [
  { key: 'all', label: '全部文件' },
  { key: 'active', label: '可用' },
  { key: 'quarantined', label: '隔离' },
  { key: 'archived', label: '归档' },
  { key: 'pending_delete', label: '待删除' },
  { key: 'deleted', label: '已删除' }
]

export default {
  data() {
    return {
      statusTabs: STATUS_TABS,
      statusFilter: 'all',
      keyword: '',
      assetTypeIndex: 0,
      assetTypeLabels: ['全部类型', ...FILE_ASSET_TYPES.map((item) => item.label)],
      center: loadFileGovernanceCenter()
    }
  },
  onLoad(query = {}) {
    this.statusFilter = query.status || 'all'
    this.reload()
  },
  methods: {
    reload() {
      const assetType = this.assetTypeIndex > 0 ? FILE_ASSET_TYPES[this.assetTypeIndex - 1].key : 'all'
      this.center = loadFileGovernanceCenter({
        keyword: this.keyword,
        status: this.statusFilter,
        assetType
      })
    },
    setStatus(status) {
      this.statusFilter = status
      this.reload()
    },
    onAssetTypeChange(event) {
      this.assetTypeIndex = Number(event.detail.value) || 0
      this.reload()
    },
    getAssetTypeLabel(type) {
      const item = FILE_ASSET_TYPES.find((option) => option.key === type)
      return item ? item.label : type || '-'
    },
    shortDigest(value) {
      const text = String(value || '')
      return text ? `${text.slice(0, 10)}...` : '-'
    },
    formatSize(size) {
      const value = Number(size || 0)
      if (!value) return '未知'
      if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`
      return `${(value / 1024 / 1024).toFixed(1)}MB`
    },
    auditDownload(file) {
      auditFileDownload(file.fileId, { projectId: file.projectId })
      uni.showToast({ title: '已记录下载审计', icon: 'none' })
    },
    requestDelete(file) {
      const result = requestFileDelete(file.fileId)
      this.reload()
      const message = result.success ? '已进入延迟清理流程' : (result.errorCode === 'protected_file' ? '受保护文件不可直接删除' : '申请失败')
      uni.showToast({ title: message, icon: 'none' })
    }
  }
}
</script>

<style scoped>
.file-page { min-height: 100vh; background: #f6f7fb; color: #101828; }
.file-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
.file-sidebar { position: sticky; top: 0; height: 100vh; background: #101828; color: #d0d5dd; padding: 20px 14px; box-sizing: border-box; }
.brand-title, .brand-sub, .nav-item, .eyebrow, .page-title, .page-desc, .policy-panel text, .file-name, .file-meta { display: block; }
.brand-title { color: #fff; font-weight: 900; font-size: 18px; }
.brand-sub { color: #9ca3af; margin: 6px 0 20px; font-size: 12px; }
.nav-item { padding: 11px 12px; border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
.nav-item.active { background: #eef2ff; color: #4f46e5; font-weight: 900; }
.file-main { padding: 24px; min-width: 0; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; text-transform: uppercase; }
.page-title { font-size: 28px; font-weight: 900; margin-top: 6px; }
.page-desc { color: #667085; line-height: 1.7; margin-top: 6px; }
.primary-btn, .outline-btn { border: 0; border-radius: 10px; height: 38px; padding: 0 14px; font-size: 13px; }
.primary-btn { background: #4f46e5; color: #fff; }
.outline-btn { background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; }
.outline-btn.danger { color: #b42318; border-color: #fecaca; }
.primary-btn::after, .outline-btn::after { border: 0; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.summary-card, .policy-panel, .file-table, .empty-state { background: #fff; border: 1px solid #e4e7ec; border-radius: 14px; padding: 16px; box-shadow: 0 10px 24px rgba(16, 24, 40, .04); }
.summary-card text { color: #667085; }
.summary-card strong { display: block; font-size: 26px; margin-top: 8px; }
.summary-card small { color: #98a2b3; display: block; margin-top: 5px; }
.policy-panel { display: grid; gap: 8px; color: #667085; margin-top: 18px; }
.toolbar { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 10px; margin: 18px 0; }
.toolbar input, .toolbar picker > view { height: 40px; border: 1px solid #d0d5dd; border-radius: 10px; padding: 0 12px; box-sizing: border-box; background: #fff; }
.file-table { overflow-x: auto; }
.file-row { min-width: 1080px; display: grid; grid-template-columns: 2fr 1fr 1.2fr 1.2fr 1fr .8fr 1.2fr; gap: 10px; padding: 12px 0; border-bottom: 1px solid #eef2f6; align-items: center; font-size: 13px; }
.file-row.head { color: #667085; font-weight: 900; }
.file-name { font-weight: 900; }
.file-meta { color: #667085; margin-top: 4px; word-break: break-all; }
.status { border-radius: 999px; background: #f2f4f7; padding: 4px 8px; text-align: center; }
.status.active { background: #dcfce7; color: #15803d; }
.status.quarantined { background: #fee2e2; color: #b42318; }
.status.pending_delete { background: #fef3c7; color: #92400e; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.empty-state { color: #667085; text-align: center; }
@media (max-width: 900px) {
  .file-shell { display: block; }
  .file-sidebar { position: static; height: auto; display: flex; gap: 8px; overflow-x: auto; }
  .brand-title { min-width: 110px; }
  .brand-sub { display: none; }
  .nav-item { min-width: 92px; text-align: center; }
  .file-main { padding: 14px; }
  .page-head { display: block; }
  .summary-grid, .toolbar { grid-template-columns: 1fr; }
}
</style>
