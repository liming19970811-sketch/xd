<template>
  <view class="developer-app">
    <aside class="developer-side">
      <view class="brand">
        <text class="brand-title">蝶变开放平台</text>
        <text class="brand-sub">Enterprise API Console</text>
      </view>
      <view class="side-nav">
        <text
          v-for="item in tabs"
          :key="item.key"
          :class="{ active: activeTab === item.key }"
          @click="goTab(item)"
        >
          {{ item.label }}
        </text>
      </view>
      <view class="access-card" :class="{ disabled: !apiAccess.enabled }">
        <text>{{ apiAccess.enabled ? '企业 API 已开通' : '企业 API 未开通' }}</text>
        <text>{{ apiAccess.message }}</text>
      </view>
    </aside>

    <main class="developer-main">
      <header class="topbar">
        <view>
          <text class="breadcrumb">企业工作台 / 开放平台 / {{ currentTab.label }}</text>
          <text class="page-title">{{ currentTitle }}</text>
        </view>
        <view class="top-actions">
          <button class="secondary-btn" @click="reload">刷新</button>
          <button class="primary-btn" @click="openCreateApp">创建 API 应用</button>
        </view>
      </header>

      <view v-if="pageState === 'loading'" class="state-card">加载企业 API 数据中...</view>
      <view v-else-if="pageState === 'forbidden'" class="state-card forbidden">
        <text>当前账号不可使用企业 API 开放平台</text>
        <text>{{ apiAccess.message || errorMessage }}</text>
      </view>
      <view v-else-if="pageState === 'error'" class="state-card error">
        <text>加载失败</text>
        <text>{{ errorMessage }}</text>
      </view>

      <template v-else>
        <view v-if="activeTab === 'overview'" class="dashboard">
          <view class="hero-card">
            <view>
              <text class="hero-kicker">企业 API 开放平台 V1</text>
              <text class="hero-title">为内部系统和批量 SKU 接入提供安全任务入口。</text>
              <text class="hero-desc">只开放稳定 AI 出图任务、批量任务、状态查询、结果读取和额度查询。AI 制版、模型管理和训练数据默认不开放。</text>
            </view>
            <button class="primary-btn" @click="openCreateApp">创建应用</button>
          </view>
          <view class="metric-grid">
            <view v-for="item in metrics" :key="item.label">
              <text>{{ item.value }}</text>
              <text>{{ item.label }}</text>
            </view>
          </view>
          <view class="content-grid">
            <view class="panel">
              <view class="panel-head">
                <text class="panel-title">首批 API 范围</text>
              </view>
              <view class="scope-list">
                <text v-for="scope in stableScopes" :key="scope.value">{{ scope.label }}</text>
              </view>
            </view>
            <view class="panel">
              <view class="panel-head">
                <text class="panel-title">默认不开放</text>
              </view>
              <view class="scope-list muted">
                <text v-for="scope in lockedScopes" :key="scope.value">{{ scope.label }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="activeTab === 'apps'" class="panel">
          <view class="panel-head">
            <text class="panel-title">企业应用</text>
            <button class="primary-small" @click="openCreateApp">创建应用</button>
          </view>
          <view v-if="apps.length" class="app-list">
            <view v-for="app in apps" :key="app.appId" class="app-card">
              <view>
                <text class="card-title">{{ app.name }}</text>
                <text class="card-meta">{{ app.scene || '未填写场景' }} · 负责人：{{ app.owner || '未设置' }}</text>
                <text class="card-meta">回调：{{ app.callbackUrl || '未配置' }}</text>
              </view>
              <view class="app-side">
                <text class="status" :class="app.status">{{ getAppStatusLabel(app.status) }}</text>
                <text>{{ formatDate(app.createdAt) }}</text>
              </view>
              <view class="app-actions">
                <button class="secondary-small" @click="setAppStatus(app, app.status === 'active' ? 'suspended' : 'active')">
                  {{ app.status === 'active' ? '暂停' : '启用' }}
                </button>
                <button class="danger-small" @click="setAppStatus(app, 'revoked')">撤销</button>
              </view>
            </view>
          </view>
          <view v-else class="empty-card">
            <text>暂无 API 应用</text>
            <button class="primary-small" @click="openCreateApp">创建第一个应用</button>
          </view>
        </view>

        <view v-else-if="activeTab === 'api-keys'" class="panel">
          <view class="panel-head">
            <text class="panel-title">密钥管理</text>
            <button class="primary-small" @click="createKeyForSelected">生成密钥</button>
          </view>
          <view class="select-row">
            <picker :range="appNames" :value="selectedAppIndex" @change="onSelectApp">
              <view class="picker-box">当前应用：{{ selectedApp ? selectedApp.name : '请选择应用' }}</view>
            </picker>
          </view>
          <view v-if="newPlainKey" class="secret-once">
            <text>密钥只显示一次，请立即保存到企业密钥系统。</text>
            <code>{{ newPlainKey }}</code>
            <text>请勿通过聊天、工单或 URL 传递密钥。</text>
          </view>
          <view v-if="keys.length" class="key-list">
            <view v-for="key in keys" :key="key.keyId" class="key-row">
              <view>
                <text class="card-title">{{ key.keyPrefix }}********</text>
                <text class="card-meta">创建：{{ formatDate(key.createdAt) }} · 最近使用：{{ formatDate(key.lastUsedAt) }}</text>
              </view>
              <text class="status" :class="key.status">{{ getKeyStatusLabel(key.status) }}</text>
              <view class="app-actions">
                <button class="secondary-small" @click="rotateKey(key)">轮换</button>
                <button class="secondary-small" @click="setKeyStatus(key, 'suspended')">暂停</button>
                <button class="danger-small" @click="setKeyStatus(key, 'revoked')">撤销</button>
              </view>
            </view>
          </view>
          <view v-else class="empty-card">
            <text>当前应用暂无密钥</text>
          </view>
        </view>

        <view v-else-if="activeTab === 'usage'" class="panel">
          <view class="panel-head">
            <text class="panel-title">调用用量</text>
          </view>
          <view class="metric-grid compact">
            <view v-for="item in usageMetrics" :key="item.label">
              <text>{{ item.value }}</text>
              <text>{{ item.label }}</text>
            </view>
          </view>
          <view class="limit-list">
            <view v-for="app in apps" :key="app.appId">
              <text>{{ app.name }}</text>
              <text>每分钟 {{ app.limits.perMinute }} 次 · 每日任务 {{ app.limits.dailyTasks }} · 并发 {{ app.limits.concurrentTasks }} · 单批 {{ app.limits.batchLimit }}</text>
            </view>
          </view>
        </view>

        <view v-else-if="activeTab === 'logs'" class="panel">
          <view class="panel-head">
            <text class="panel-title">调用日志</text>
          </view>
          <view v-if="logs.length" class="log-list">
            <view v-for="log in logs" :key="log.requestId" class="log-row">
              <view>
                <text class="card-title">{{ log.endpoint }}</text>
                <text class="card-meta">{{ log.requestId }} · {{ log.taskId || log.batchId || '未关联任务' }}</text>
              </view>
              <text class="status" :class="log.success ? 'active' : 'revoked'">{{ log.statusCode || log.code }}</text>
              <text>{{ log.durationMs }} ms</text>
              <text>{{ formatDate(log.createdAt) }}</text>
            </view>
          </view>
          <view v-else class="empty-card">暂无调用日志</view>
        </view>

        <view v-else class="docs-layout">
          <view class="doc-list">
            <text
              v-for="doc in docs"
              :key="doc.key"
              :class="{ active: selectedDocKey === doc.key }"
              @click="selectedDocKey = doc.key"
            >
              {{ doc.title }}
            </text>
          </view>
          <view class="panel doc-panel">
            <text class="panel-title">{{ selectedDoc.title }}</text>
            <text class="section-desc">{{ selectedDoc.summary }}</text>
            <pre>{{ selectedDoc.code }}</pre>
          </view>
        </view>
      </template>

      <view v-if="createAppOpen" class="modal-mask" @click="createAppOpen = false">
        <view class="modal" @click.stop>
          <view class="panel-head">
            <text class="panel-title">创建 API 应用</text>
            <button class="secondary-small" @click="createAppOpen = false">关闭</button>
          </view>
          <view class="form-grid">
            <label>
              <text>应用名称</text>
              <input v-model.trim="appForm.name" placeholder="例如：ERP 批量上新接入" />
            </label>
            <label>
              <text>使用场景</text>
              <input v-model.trim="appForm.scene" placeholder="例如：批量 SKU 商品图生产" />
            </label>
            <label>
              <text>回调地址</text>
              <input v-model.trim="appForm.callbackUrl" placeholder="https://example.com/api/callback" />
            </label>
            <label>
              <text>负责人</text>
              <input v-model.trim="appForm.owner" placeholder="负责人姓名" />
            </label>
          </view>
          <view class="scope-checks">
            <text
              v-for="scope in stableScopes"
              :key="scope.value"
              :class="{ checked: appForm.scopes.includes(scope.value) }"
              @click="toggleScope(scope.value)"
            >
              {{ scope.label }}
            </text>
          </view>
          <button class="primary-btn full" :disabled="submitting" @click="submitCreateApp">
            {{ submitting ? '创建中...' : '创建应用' }}
          </button>
        </view>
      </view>
    </main>
  </view>
</template>

<script>
import {
  API_APP_STATUSES,
  API_DOCS,
  API_KEY_STATUSES,
  API_SCOPES,
  DEFAULT_API_LIMITS,
  DEVELOPER_TABS,
  STABLE_API_SCOPES,
  getStatusLabel
} from '../../utils/developer/developerApiConfig.js'
import { callDeveloperApi } from '../../utils/developer/developerApiTransport.js'

export default {
  props: {
    initialTab: {
      type: String,
      default: 'overview'
    }
  },
  data() {
    return {
      tabs: DEVELOPER_TABS,
      docs: API_DOCS,
      activeTab: this.initialTab || 'overview',
      pageState: 'loading',
      errorMessage: '',
      apiAccess: { enabled: false, message: '' },
      apps: [],
      keys: [],
      logs: [],
      usage: { callCount: 0, taskCount: 0, failedCount: 0, quotaRecordCount: 0 },
      selectedAppId: '',
      selectedDocKey: 'auth',
      createAppOpen: false,
      submitting: false,
      newPlainKey: '',
      appForm: {
        name: '',
        scene: '',
        callbackUrl: '',
        owner: '',
        scopes: [...STABLE_API_SCOPES]
      }
    }
  },
  computed: {
    currentTab() {
      return this.tabs.find((item) => item.key === this.activeTab) || this.tabs[0]
    },
    currentTitle() {
      const titles = {
        overview: '企业 API 开放平台',
        apps: '企业应用',
        'api-keys': '密钥管理',
        usage: '调用用量',
        logs: '调用日志',
        docs: '开发文档'
      }
      return titles[this.activeTab] || '企业 API 开放平台'
    },
    stableScopes() {
      return API_SCOPES.filter((item) => item.stable)
    },
    lockedScopes() {
      return API_SCOPES.filter((item) => !item.stable)
    },
    metrics() {
      return [
        { label: '应用数量', value: this.apps.length },
        { label: '有效密钥', value: this.keys.filter((item) => item.status === 'active').length },
        { label: '今日调用', value: this.usage.callCount || 0 },
        { label: '失败调用', value: this.usage.failedCount || 0 }
      ]
    },
    usageMetrics() {
      return [
        { label: '调用次数', value: this.usage.callCount || 0 },
        { label: '任务数量', value: this.usage.taskCount || 0 },
        { label: '失败次数', value: this.usage.failedCount || 0 },
        { label: '额度记录', value: this.usage.quotaRecordCount || 0 }
      ]
    },
    appNames() {
      return this.apps.map((item) => item.name)
    },
    selectedApp() {
      return this.apps.find((item) => item.appId === this.selectedAppId) || this.apps[0] || null
    },
    selectedAppIndex() {
      const index = this.apps.findIndex((item) => item.appId === this.selectedAppId)
      return index >= 0 ? index : 0
    },
    selectedDoc() {
      return this.docs.find((item) => item.key === this.selectedDocKey) || this.docs[0]
    }
  },
  mounted() {
    this.reload()
  },
  methods: {
    async reload() {
      this.pageState = 'loading'
      this.errorMessage = ''
      const result = await callDeveloperApi('getConsoleData')
      if (!result.success) {
        this.apiAccess = { enabled: false, message: result.message || '企业 API 未开通' }
        this.pageState = result.errorCode === 'api_access_required' || result.errorCode === 'permission_denied' ? 'forbidden' : 'error'
        this.errorMessage = result.message || '企业 API 数据加载失败'
        return
      }
      this.apiAccess = result.data.apiAccess || { enabled: true, message: '已开通' }
      this.apps = result.data.apps || []
      this.keys = result.data.keys || []
      this.logs = result.data.logs || []
      this.usage = result.data.usage || {}
      this.selectedAppId = this.selectedAppId || (this.apps[0] && this.apps[0].appId) || ''
      this.pageState = 'ready'
    },
    goTab(item = {}) {
      if (!item.path) return
      uni.navigateTo({ url: `/pages/developer/${item.key === 'overview' ? 'developer' : item.key}` })
    },
    openCreateApp() {
      this.newPlainKey = ''
      this.createAppOpen = true
    },
    toggleScope(scope = '') {
      if (!STABLE_API_SCOPES.includes(scope)) return
      this.appForm.scopes = this.appForm.scopes.includes(scope)
        ? this.appForm.scopes.filter((item) => item !== scope)
        : [...this.appForm.scopes, scope]
    },
    async submitCreateApp() {
      if (this.submitting) return
      this.submitting = true
      const result = await callDeveloperApi('createApp', {
        app: {
          ...this.appForm,
          limits: DEFAULT_API_LIMITS
        }
      })
      this.submitting = false
      if (!result.success) {
        uni.showToast({ title: result.message || '创建失败', icon: 'none' })
        return
      }
      this.createAppOpen = false
      this.appForm = { name: '', scene: '', callbackUrl: '', owner: '', scopes: [...STABLE_API_SCOPES] }
      await this.reload()
      uni.showToast({ title: '应用已创建', icon: 'success' })
    },
    async setAppStatus(app = {}, status = '') {
      const result = await callDeveloperApi('updateAppStatus', { appId: app.appId, status })
      if (!result.success) {
        uni.showToast({ title: result.message || '更新失败', icon: 'none' })
        return
      }
      await this.reload()
    },
    onSelectApp(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.selectedAppId = this.apps[index] ? this.apps[index].appId : ''
      this.newPlainKey = ''
    },
    async createKeyForSelected() {
      if (!this.selectedApp) {
        uni.showToast({ title: '请先创建应用', icon: 'none' })
        return
      }
      const result = await callDeveloperApi('createApiKey', { appId: this.selectedApp.appId })
      if (!result.success) {
        uni.showToast({ title: result.message || '密钥生成失败', icon: 'none' })
        return
      }
      this.newPlainKey = result.data && result.data.plainTextKey ? result.data.plainTextKey : ''
      await this.reload()
    },
    async rotateKey(key = {}) {
      const result = await callDeveloperApi('rotateApiKey', { keyId: key.keyId })
      if (!result.success) {
        uni.showToast({ title: result.message || '密钥轮换失败', icon: 'none' })
        return
      }
      this.selectedAppId = key.appId
      this.newPlainKey = result.data && result.data.plainTextKey ? result.data.plainTextKey : ''
      await this.reload()
    },
    async setKeyStatus(key = {}, status = '') {
      const result = await callDeveloperApi('updateApiKeyStatus', { keyId: key.keyId, status })
      if (!result.success) {
        uni.showToast({ title: result.message || '密钥状态更新失败', icon: 'none' })
        return
      }
      await this.reload()
    },
    getAppStatusLabel(status = '') {
      return getStatusLabel(status, API_APP_STATUSES)
    },
    getKeyStatusLabel(status = '') {
      return getStatusLabel(status, API_KEY_STATUSES)
    },
    formatDate(value = '') {
      if (!value) return '未记录'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
      const pad = (number) => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
  }
}
</script>

<style scoped>
.developer-app { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; background: #f4f6fb; color: #0f172a; }
.developer-side { position: sticky; top: 0; height: 100vh; padding: 22px 16px; background: #0f172a; box-sizing: border-box; color: #fff; }
.brand-title, .brand-sub, .breadcrumb, .page-title, .hero-kicker, .hero-title, .hero-desc, .panel-title, .section-desc, .card-title, .card-meta { display: block; }
.brand-title { font-size: 20px; font-weight: 950; }
.brand-sub { margin-top: 4px; color: #94a3b8; font-size: 12px; }
.side-nav { display: grid; gap: 6px; margin-top: 24px; }
.side-nav text { padding: 12px; border-radius: 13px; color: #cbd5e1; font-size: 14px; font-weight: 850; cursor: pointer; }
.side-nav text.active { background: #eef2ff; color: #4338ca; }
.access-card { margin-top: 22px; padding: 14px; border-radius: 16px; background: rgba(79,70,229,.2); }
.access-card.disabled { background: rgba(248,113,113,.16); }
.access-card text:first-child { display: block; font-weight: 920; }
.access-card text:last-child { display: block; margin-top: 7px; color: #cbd5e1; font-size: 12px; line-height: 1.45; }
.developer-main { min-width: 0; padding: 24px; box-sizing: border-box; }
.topbar, .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.breadcrumb { color: #64748b; font-size: 12px; }
.page-title { margin-top: 6px; font-size: 30px; font-weight: 950; }
.top-actions { display: flex; gap: 10px; }
.primary-btn, .secondary-btn, .primary-small, .secondary-small, .danger-small { margin: 0; border-radius: 999px; font-weight: 900; }
.primary-btn, .secondary-btn { height: 40px; line-height: 40px; padding: 0 16px; font-size: 14px; }
.primary-btn { background: #4f46e5; color: #fff; }
.secondary-btn { background: #fff; color: #4338ca; border: 1px solid #c7d2fe; }
.primary-small, .secondary-small, .danger-small { height: 32px; line-height: 32px; padding: 0 12px; font-size: 12px; }
.primary-small { background: #4f46e5; color: #fff; }
.secondary-small { background: #fff; color: #4338ca; border: 1px solid #c7d2fe; }
.danger-small { background: #fff1f2; color: #be123c; }
.state-card, .hero-card, .panel, .modal { margin-top: 18px; padding: 20px; border: 1px solid rgba(15,23,42,.08); border-radius: 18px; background: #fff; box-shadow: 0 12px 34px rgba(15,23,42,.05); box-sizing: border-box; }
.state-card { color: #64748b; }
.state-card text { display: block; margin-top: 6px; }
.state-card.forbidden { background: #fff7ed; color: #9a3412; }
.state-card.error { background: #fff1f2; color: #be123c; }
.hero-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; background: #111827; color: #fff; }
.hero-kicker { color: #c7d2fe; font-size: 13px; font-weight: 900; }
.hero-title { margin-top: 8px; font-size: 29px; line-height: 1.16; font-weight: 950; }
.hero-desc { max-width: 760px; margin-top: 8px; color: #cbd5e1; font-size: 14px; line-height: 1.65; }
.metric-grid, .content-grid, .form-grid { display: grid; gap: 14px; }
.metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 16px; }
.metric-grid.compact { margin-bottom: 16px; }
.metric-grid view { padding: 16px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
.metric-grid text:first-child { display: block; color: #4f46e5; font-size: 28px; font-weight: 950; }
.metric-grid text:last-child { display: block; margin-top: 5px; color: #64748b; font-size: 13px; }
.content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
.scope-list { display: flex; flex-wrap: wrap; gap: 9px; }
.scope-list text, .scope-checks text { padding: 8px 10px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: 850; }
.scope-list.muted text { background: #f1f5f9; color: #64748b; }
.app-list, .key-list, .log-list, .limit-list { display: grid; gap: 10px; }
.app-card, .key-row, .log-row, .limit-list view { display: grid; align-items: center; gap: 12px; padding: 14px; border-radius: 15px; background: #f8fafc; box-sizing: border-box; }
.app-card { grid-template-columns: minmax(0, 1fr) 128px 168px; }
.key-row { grid-template-columns: minmax(0, 1fr) 90px 210px; }
.log-row { grid-template-columns: minmax(0, 1fr) 110px 80px 100px; }
.card-title { color: #0f172a; font-size: 15px; font-weight: 920; }
.card-meta { margin-top: 5px; color: #64748b; font-size: 12px; line-height: 1.45; }
.app-side text { display: block; margin-bottom: 5px; color: #64748b; font-size: 12px; }
.app-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.status { display: inline-flex; align-items: center; justify-content: center; min-height: 26px; padding: 0 9px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: 900; }
.status.active { background: #dcfce7; color: #166534; }
.status.suspended, .status.draft { background: #fff7ed; color: #9a3412; }
.status.revoked { background: #fee2e2; color: #991b1b; }
.empty-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-radius: 15px; background: #f8fafc; color: #64748b; }
.select-row { margin: 12px 0; }
.picker-box { display: inline-flex; min-height: 38px; align-items: center; padding: 0 14px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 13px; font-weight: 900; }
.secret-once { display: grid; gap: 8px; margin: 12px 0; padding: 14px; border-radius: 15px; background: #fff7ed; color: #9a3412; }
.secret-once code, .doc-panel pre { display: block; overflow: auto; padding: 12px; border-radius: 12px; background: #0f172a; color: #e2e8f0; font-size: 12px; line-height: 1.6; }
.docs-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; margin-top: 18px; }
.doc-list { display: grid; gap: 8px; align-content: start; }
.doc-list text { padding: 12px; border-radius: 14px; background: #fff; color: #475569; cursor: pointer; }
.doc-list text.active { background: #4f46e5; color: #fff; }
.section-desc { margin-top: 8px; color: #64748b; font-size: 14px; line-height: 1.65; }
.modal-mask { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-start; justify-content: center; padding-top: 8vh; background: rgba(15,23,42,.42); }
.modal { width: min(720px, calc(100vw - 28px)); margin: 0; }
.form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px; }
.form-grid label { display: grid; gap: 7px; color: #475569; font-size: 13px; }
.form-grid input { height: 40px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; color: #0f172a; box-sizing: border-box; }
.scope-checks { display: flex; flex-wrap: wrap; gap: 9px; margin: 14px 0; }
.scope-checks text { background: #f1f5f9; color: #64748b; cursor: pointer; }
.scope-checks text.checked { background: #eef2ff; color: #4338ca; }
.primary-btn.full { width: 100%; }
@media screen and (max-width: 900px) {
  .developer-app { display: block; }
  .developer-side { position: relative; height: auto; }
  .side-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .developer-main { padding: 16px; }
  .topbar, .hero-card { display: block; }
  .top-actions { margin-top: 12px; }
  .metric-grid, .content-grid, .form-grid, .docs-layout { grid-template-columns: 1fr; }
  .app-card, .key-row, .log-row { grid-template-columns: 1fr; }
  .app-actions { justify-content: flex-start; }
}
</style>
