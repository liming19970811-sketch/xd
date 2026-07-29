<template>
  <view class="schema-page">
    <aside class="schema-sidebar">
      <view class="brand">
        <text class="brand-mark">DB</text>
        <view>
          <text class="brand-title">结构与迁移治理</text>
          <text class="brand-sub">Schema Governance</text>
        </view>
      </view>
      <button
        v-for="item in tabs"
        :key="item.key"
        class="nav-item"
        :class="{ active: currentTab === item.key }"
        @click="currentTab = item.key"
      >
        {{ item.label }}
      </button>
    </aside>

    <main class="schema-main">
      <view v-if="!center.canAccess" class="state-card">
        <text class="page-title">无权限访问结构治理中心</text>
        <text class="page-desc">仅平台最高权限管理员可查看数据库结构、索引和迁移治理。</text>
      </view>

      <template v-else>
        <view class="page-head">
          <view>
            <text class="eyebrow">Database Governance V1</text>
            <text class="page-title">{{ pageTitle }}</text>
            <text class="page-desc">统一数据模型、状态枚举、索引场景、分页规则和版本化迁移计划。页面不会在加载时静默修改历史数据。</text>
          </view>
          <button class="outline-btn" @click="reload">刷新</button>
        </view>

        <view class="metric-grid">
          <view class="metric-card"><text>核心集合</text><strong>{{ center.dictionary.models.length }}</strong></view>
          <view class="metric-card"><text>索引计划</text><strong>{{ center.dictionary.indexes.length }}</strong></view>
          <view class="metric-card"><text>迁移脚本</text><strong>{{ center.migrations.length }}</strong></view>
          <view class="metric-card"><text>完整性问题</text><strong>{{ center.integrity.issues.length }}</strong></view>
        </view>

        <view v-if="currentTab === 'dictionary'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">正式数据字典</text>
              <text class="section-desc">公共字段统一包含 id、ownerId、enterpriseId、createdBy、createdAt、updatedAt、status 和 schemaVersion。</text>
            </view>
          </view>
          <view class="model-list">
            <view v-for="model in center.dictionary.models" :key="model.collection" class="model-card">
              <view class="card-head">
                <view>
                  <text class="card-title">{{ model.collection }}</text>
                  <text class="row-meta">主键 {{ model.idField }} · {{ model.softDelete ? '支持软删除' : '不可软删除' }}</text>
                </view>
                <text class="status">schema v{{ center.dictionary.schemaVersion }}</text>
              </view>
              <view class="field-grid">
                <view v-for="field in model.fields.slice(0, 12)" :key="field.key">
                  <text>{{ field.key }}</text>
                  <strong>{{ field.type }}{{ field.required ? ' · 必填' : '' }}</strong>
                </view>
              </view>
              <text class="relation">关联：{{ model.relations.join('、') || '无直接关联' }}</text>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'status'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">标准状态枚举</text>
              <text class="section-desc">页面只展示标准状态；历史状态在数据层统一转换。</text>
            </view>
          </view>
          <view class="status-grid">
            <view v-for="(items, domain) in center.dictionary.statusEnums" :key="domain" class="status-card">
              <text class="card-title">{{ domain }}</text>
              <view class="chips">
                <text v-for="item in items" :key="item">{{ item }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="currentTab === 'indexes'" class="section">
          <view class="section-head">
            <view>
              <text class="section-title">索引与分页设计</text>
              <text class="section-desc">每个索引都有明确查询场景，不盲目建立重复索引。</text>
            </view>
          </view>
          <view class="table">
            <view class="table-row head"><text>集合</text><text>索引字段</text><text>场景</text></view>
            <view v-for="item in center.dictionary.indexes" :key="`${item.collection}_${item.fields.join('_')}`" class="table-row">
              <text>{{ item.collection }}</text>
              <text>{{ item.fields.join(' + ') }}{{ item.unique ? ' · unique' : '' }}</text>
              <text>{{ item.scenario }}</text>
            </view>
          </view>
          <view class="pagination-grid">
            <view v-for="rule in center.dictionary.paginationRules" :key="rule.collection" class="status-card">
              <text class="card-title">{{ rule.collection }}</text>
              <text class="row-meta">默认 {{ rule.defaultPageSize }} / 最大 {{ rule.maxPageSize }}</text>
              <text class="relation">排序：{{ rule.orderBy.join(' + ') }}；游标：{{ rule.cursor }}</text>
            </view>
          </view>
        </view>

        <view v-else class="section">
          <view class="section-head">
            <view>
              <text class="section-title">版本化迁移</text>
              <text class="section-desc">支持 dry-run、影响数量、分批计划、安全重跑和人工处理清单。执行前会创建备份，V1 不在页面中直接批量改写历史数据。</text>
            </view>
          </view>
          <view class="migration-list">
            <view v-for="migration in center.migrations" :key="migration.migrationId" class="model-card">
              <view class="card-head">
                <view>
                  <text class="card-title">{{ migration.title }}</text>
                  <text class="row-meta">{{ migration.migrationId }} · batch {{ migration.batchSize }}</text>
                </view>
                <button class="primary-btn" @click="previewMigrationRun(migration)">Dry-run</button>
              </view>
              <view class="chips">
                <text v-for="collection in migration.targetCollections" :key="collection">{{ collection }}</text>
              </view>
            </view>
          </view>

          <view class="section-head compact">
            <view>
              <text class="section-title">完整性检查</text>
              <text class="section-desc">覆盖重复 ID、重复幂等键、非法状态、缺少企业字段、临时 URL、版型版本冲突等。</text>
            </view>
            <button class="outline-btn" @click="runIntegrity">重新检查</button>
          </view>
          <view class="issue-list">
            <view v-for="issue in center.integrity.issues" :key="issue.issueId" class="issue-row" :class="issue.level">
              <text>{{ issue.collection }} · {{ issue.type }}</text>
              <text>{{ issue.targetId || '-' }}</text>
              <text>{{ issue.suggestion }}</text>
            </view>
            <view v-if="!center.integrity.issues.length" class="state-card">未发现结构治理阻断问题。</view>
          </view>

          <view class="section-head compact">
            <view>
              <text class="section-title">迁移运行记录</text>
              <text class="section-desc">记录成功、失败、跳过和人工处理数量，支持安全重跑。</text>
            </view>
          </view>
          <view class="table">
            <view class="table-row head"><text>脚本</text><text>状态</text><text>影响 / 人工</text></view>
            <view v-for="run in center.runs" :key="run.runId" class="table-row">
              <text>{{ run.migrationId }}</text>
              <text>{{ run.status }}{{ run.dryRun ? ' · dry-run' : '' }}</text>
              <text>{{ run.estimatedCount }} / 跳过 {{ run.skippedCount }} / 人工 {{ run.manualCount }}</text>
            </view>
          </view>
        </view>

        <view class="policy-panel">
          <text>禁止在页面加载时静默批量修改历史数据。</text>
          <text>大列表必须分页，搜索条件必须受权限范围约束，统计使用聚合或汇总记录。</text>
          <text>无法自动迁移的数据进入人工处理清单，不伪造默认业务结果。</text>
        </view>
      </template>
    </main>
  </view>
</template>

<script>
import {
  loadSchemaGovernanceCenter,
  previewMigration,
  runMigrationBatch,
  runSchemaIntegrityCheck
} from '../../utils/schema/migrationGovernance'

export default {
  data() {
    return {
      currentTab: 'dictionary',
      tabs: [
        { key: 'dictionary', label: '数据字典' },
        { key: 'status', label: '状态枚举' },
        { key: 'indexes', label: '索引分页' },
        { key: 'migrations', label: '迁移治理' }
      ],
      center: loadSchemaGovernanceCenter()
    }
  },
  computed: {
    pageTitle() {
      const tab = this.tabs.find((item) => item.key === this.currentTab)
      return tab ? tab.label : '结构与迁移治理'
    }
  },
  onLoad(query = {}) {
    this.currentTab = ['dictionary', 'status', 'indexes', 'migrations'].includes(query.tab) ? query.tab : 'dictionary'
    this.reload()
  },
  methods: {
    reload() {
      this.center = loadSchemaGovernanceCenter()
    },
    previewMigrationRun(migration) {
      const preview = previewMigration(migration.migrationId)
      if (!preview.success) {
        uni.showToast({ title: preview.message || '预览失败', icon: 'none' })
        return
      }
      const result = runMigrationBatch({ migrationId: migration.migrationId, dryRun: true, batchSize: migration.batchSize })
      this.reload()
      uni.showToast({
        title: result.success ? `预计影响 ${preview.estimatedCount} 条` : result.message || 'Dry-run 失败',
        icon: 'none'
      })
    },
    runIntegrity() {
      const integrity = runSchemaIntegrityCheck()
      this.center = { ...this.center, integrity }
      uni.showToast({ title: integrity.canAccess ? '检查完成' : '无权限检查', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.schema-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  background: #f5f7fb;
  color: #111827;
}
.schema-sidebar {
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
  align-items: center;
  gap: 12px;
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
.row-meta,
.relation {
  display: block;
}
.brand-title,
.card-title,
.section-title {
  font-weight: 900;
}
.brand-sub,
.row-meta,
.page-desc,
.section-desc,
.relation {
  color: #64748b;
}
.nav-item {
  width: 100%;
  height: 42px;
  margin: 0 0 8px;
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
  font-weight: 850;
}
.schema-main {
  min-width: 0;
  padding: 28px;
}
.page-head,
.section-head,
.card-head {
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
}
.page-title {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 950;
}
.page-desc {
  max-width: 860px;
  margin-top: 8px;
  line-height: 1.7;
  font-size: 14px;
}
.metric-grid,
.model-list,
.status-grid,
.pagination-grid,
.migration-list,
.issue-list {
  display: grid;
  gap: 14px;
}
.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 18px;
}
.metric-card,
.section,
.model-card,
.status-card,
.state-card,
.policy-panel {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 40px rgba(15, 23, 42, .05);
  box-sizing: border-box;
}
.metric-card {
  padding: 18px;
}
.metric-card text {
  display: block;
  color: #64748b;
  font-size: 13px;
}
.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
}
.section {
  padding: 20px;
}
.section-head {
  margin-bottom: 16px;
}
.section-head.compact {
  margin-top: 24px;
}
.model-card,
.status-card,
.state-card {
  padding: 16px;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}
.field-grid view {
  padding: 10px;
  border-radius: 10px;
  background: #f8fafc;
}
.field-grid text,
.field-grid strong {
  display: block;
}
.field-grid text {
  color: #64748b;
  font-size: 12px;
}
.field-grid strong {
  margin-top: 4px;
  font-size: 13px;
}
.status-grid,
.pagination-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.chips text,
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
.table {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
}
.table-row {
  min-width: 760px;
  display: grid;
  grid-template-columns: 160px 240px minmax(0, 1fr);
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid #edf2f7;
  background: #fff;
  font-size: 13px;
}
.table-row.head {
  background: #f8fafc;
  color: #475569;
  font-weight: 900;
}
.table-row:last-child {
  border-bottom: 0;
}
.issue-row {
  display: grid;
  grid-template-columns: 220px 180px minmax(0, 1fr);
  gap: 12px;
  padding: 13px 14px;
  border-radius: 12px;
  background: #f8fafc;
  font-size: 13px;
}
.issue-row.high {
  background: #fff7f7;
  color: #991b1b;
}
.issue-row.medium {
  background: #fffaf3;
  color: #9a3412;
}
.outline-btn,
.primary-btn {
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
.policy-panel {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  padding: 16px;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}
@media screen and (max-width: 900px) {
  .schema-page {
    grid-template-columns: 1fr;
  }
  .schema-sidebar {
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
  .schema-main {
    padding: 18px;
  }
  .page-head,
  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .metric-grid,
  .field-grid,
  .status-grid,
  .pagination-grid {
    grid-template-columns: 1fr;
  }
  .issue-row {
    grid-template-columns: 1fr;
  }
}
</style>
