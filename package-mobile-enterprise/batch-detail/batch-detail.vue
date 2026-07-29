<template>
  <view class="batch-page">
    <view v-if="!batchId" class="empty-state">
      <text class="empty-title">未找到批次</text>
      <text class="empty-desc">请从批量生成入口或任务列表进入批量详情。</text>
    </view>

    <view v-else class="batch-content">
      <view class="summary-card">
        <view class="summary-head">
          <view>
            <text class="kicker">批量生成</text>
            <text class="title">批量结果管理</text>
          </view>
          <text class="status-badge" :class="batchStatusClass">{{ batchStatusText }}</text>
        </view>

        <view class="batch-id-box">
          <text class="label">批次编号</text>
          <text class="value">{{ batch.batchId || batchId }}</text>
        </view>

        <view class="summary-grid">
          <view class="summary-item">
            <text class="summary-label">创建时间</text>
            <text class="summary-value small">{{ formatTime(batch.createdAt) }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">总任务数</text>
            <text class="summary-value">{{ batch.totalCount || taskCards.length }}</text>
          </view>
          <view class="summary-item success">
            <text class="summary-label">已完成</text>
            <text class="summary-value">{{ batch.completedCount || 0 }}</text>
          </view>
          <view class="summary-item failed">
            <text class="summary-label">失败</text>
            <text class="summary-value">{{ batch.failedCount || 0 }}</text>
          </view>
        </view>
      </view>

      <view class="action-card">
        <view class="export-summary">
          <view class="export-head">
            <text class="export-title">{{ exportPackage.batchName }}</text>
            <text class="export-status" :class="`export-${exportStatus}`">{{ exportStatusText }}</text>
          </view>
          <view class="export-meta-grid">
            <text>生成时间：{{ formatTime(exportPackage.createdAt) }}</text>
            <text>图片数量：{{ exportPackage.imageCount }} 张</text>
            <text>模特：{{ formatExportInfo(exportPackage.modelInfo) }}</text>
            <text>颜色：{{ formatExportInfo(exportPackage.colorInfo) }}</text>
            <text>场景：{{ formatExportInfo(exportPackage.sceneInfo) }}</text>
          </view>
          <text v-if="exportResultText" class="export-result">{{ exportResultText }}</text>
        </view>
        <view class="batch-actions">
          <button class="batch-action primary" :loading="exportStatus === 'exporting'" :disabled="!exportPackage.imageCount || exportStatus === 'exporting'" @click="downloadAllImages">下载全部图片</button>
          <button class="batch-action" :disabled="!failedTasks.length || exportStatus === 'exporting'" @click="retryFailedTasks">重新生成失败任务</button>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">子任务列表</text>
        <text class="section-subtitle">{{ taskCards.length }} 个任务</text>
      </view>

      <view v-if="taskCards.length" class="task-list">
        <view v-for="task in taskCards" :key="task.taskId" class="task-card">
          <image v-if="task.thumbnail" class="task-thumb" :src="task.thumbnail" mode="aspectFill"></image>
          <view v-else class="task-thumb placeholder">
            <text>{{ task.statusText }}</text>
          </view>

          <view class="task-body">
            <view class="task-top">
              <text class="task-id">{{ task.taskId }}</text>
              <text class="task-status" :class="task.statusClass">{{ task.statusText }}</text>
            </view>
            <view class="task-meta-grid">
              <text>模特：{{ task.modelName }}</text>
              <text>颜色：{{ task.colorName }}</text>
              <text>场景：{{ task.sceneName }}</text>
              <text>时间：{{ task.timeText }}</text>
            </view>
            <view class="task-actions">
              <button v-if="task.isSuccess" class="task-action primary" @click="openResult(task)">查看结果</button>
              <button v-if="task.isFailed" class="task-action warning" @click="retryOneTask(task)">重新生成</button>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-title">暂无子任务</text>
        <text class="empty-desc">当前批次还没有关联生成任务。</text>
      </view>
    </view>
  </view>
</template>

<script>
import {
  formatBatchTime,
  getBatchDetail,
  getBatchStatusText,
  getTaskResultImageUrl,
  getTaskStatusText,
  retryBatchTask,
  retryFailedBatchTasks
} from '../../utils/task/batchRepository'
import {
  BATCH_EXPORT_STATUS,
  buildBatchExportPackage
} from '../../utils/task/batchExport'

export default {
  data() {
    return {
      batchId: '',
      batch: null,
      tasks: [],
      exportStatus: BATCH_EXPORT_STATUS.IDLE,
      exportResult: null
    }
  },
  computed: {
    batchStatusText() {
      return getBatchStatusText((this.batch && this.batch.status) || 'pending')
    },
    batchStatusClass() {
      const status = (this.batch && this.batch.status) || 'pending'
      return `status-${status}`
    },
    taskCards() {
      return this.tasks.map((task) => {
        const params = (task.input && task.input.params) || {}
        const status = task.status || 'pending'
        return {
          ...task,
          taskId: task.taskId || '',
          thumbnail: getTaskResultImageUrl(task),
          modelName: params.modelName || params.modelType || '未选择',
          colorName: params.targetColorName || params.colorName || params.colorHex || '默认',
          sceneName: params.sceneTypeLabel || params.sceneType || params.outputUsage || '默认场景',
          timeText: this.formatTime(task.completedAt || task.updatedAt || task.createdAt || task.submittedAt),
          statusText: getTaskStatusText(status),
          statusClass: `status-${status}`,
          isSuccess: status === 'success',
          isFailed: status === 'failed' || status === 'timeout'
        }
      })
    },
    failedTasks() {
      return this.taskCards.filter((task) => task.isFailed)
    },
    exportPackage() {
      return buildBatchExportPackage(this.batch || { batchId: this.batchId }, this.tasks)
    },
    exportStatusText() {
      const statusTextMap = {
        [BATCH_EXPORT_STATUS.IDLE]: '未导出',
        [BATCH_EXPORT_STATUS.EXPORTING]: '导出中',
        [BATCH_EXPORT_STATUS.COMPLETED]: '导出完成',
        [BATCH_EXPORT_STATUS.FAILED]: '导出失败'
      }
      return statusTextMap[this.exportStatus] || '未导出'
    },
    exportResultText() {
      if (!this.exportResult) {
        return ''
      }
      return `成功 ${this.exportResult.successCount} 张，失败 ${this.exportResult.failedCount} 张`
    }
  },
  onLoad(query = {}) {
    this.batchId = query.batchId ? decodeURIComponent(query.batchId) : ''
    this.loadBatchDetail()
  },
  onShow() {
    this.loadBatchDetail()
  },
  methods: {
    loadBatchDetail() {
      if (!this.batchId) {
        return
      }
      const detail = getBatchDetail(this.batchId)
      this.batch = detail.batch
      this.tasks = detail.tasks
    },
    formatTime(value) {
      return formatBatchTime(value)
    },
    formatExportInfo(values) {
      return Array.isArray(values) && values.length ? values.join('、') : '默认'
    },
    openResult(task) {
      if (!task || !task.taskId) {
        uni.showToast({
          title: '未找到任务',
          icon: 'none'
        })
        return
      }
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}&batchId=${encodeURIComponent(this.batchId)}`
      })
    },
    retryFailedTasks() {
      const result = retryFailedBatchTasks(this.batchId)
      uni.showToast({
        title: `已重试 ${result.taskIds.length} 个任务`,
        icon: 'none'
      })
      this.loadBatchDetail()
    },
    retryOneTask(task) {
      if (!task || !task.taskId) {
        return
      }
      const result = retryBatchTask(this.batchId, task.taskId)
      uni.showToast({
        title: result.taskIds.length ? '已重新生成失败任务' : '暂无失败任务',
        icon: 'none'
      })
      this.loadBatchDetail()
    },
    downloadAndSaveImage(imageUrl) {
      return new Promise((resolve) => {
        uni.downloadFile({
          url: imageUrl,
          success: (downloadResult) => {
            if (downloadResult.statusCode !== 200 || !downloadResult.tempFilePath) {
              resolve(false)
              return
            }
            uni.saveImageToPhotosAlbum({
              filePath: downloadResult.tempFilePath,
              success: () => resolve(true),
              fail: () => resolve(false)
            })
          },
          fail: () => resolve(false)
        })
      })
    },
    async downloadAllImages() {
      const exportPackage = this.exportPackage
      if (!exportPackage.imageCount) {
        uni.showToast({
          title: '暂无可下载图片',
          icon: 'none'
        })
        return
      }
      console.info('[batch:export]', {
        batchId: this.batchId,
        exportCount: exportPackage.imageCount,
        skipFailedCount: exportPackage.skipFailedCount
      })

      this.exportStatus = BATCH_EXPORT_STATUS.EXPORTING
      this.exportResult = null

      if (typeof uni.saveImageToPhotosAlbum !== 'function' || typeof uni.downloadFile !== 'function') {
        uni.previewImage({
          urls: exportPackage.exportItems.map((item) => item.imageUrl)
        })
        this.exportStatus = BATCH_EXPORT_STATUS.COMPLETED
        this.exportResult = {
          successCount: exportPackage.imageCount,
          failedCount: exportPackage.skipFailedCount + exportPackage.skipUnavailableCount
        }
        return
      }

      let savedCount = 0
      for (const item of exportPackage.exportItems) {
        const saved = await this.downloadAndSaveImage(item.imageUrl)
        if (saved) {
          savedCount += 1
        }
      }

      const runtimeFailedCount = exportPackage.imageCount - savedCount
      const failedCount = runtimeFailedCount + exportPackage.skipFailedCount + exportPackage.skipUnavailableCount
      this.exportStatus = savedCount ? BATCH_EXPORT_STATUS.COMPLETED : BATCH_EXPORT_STATUS.FAILED
      this.exportResult = {
        successCount: savedCount,
        failedCount
      }
      uni.showModal({
        title: this.exportStatus === BATCH_EXPORT_STATUS.COMPLETED ? '导出完成' : '导出失败',
        content: `成功 ${savedCount} 张，失败 ${failedCount} 张`,
        showCancel: false
      })
    }
  }
}
</script>

<style scoped>
.batch-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f6f7fb;
  box-sizing: border-box;
}

.batch-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.summary-card,
.action-card,
.empty-state {
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(15, 23, 42, 0.06);
  padding: 24rpx;
}

.summary-head,
.task-top,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.kicker,
.label,
.summary-label,
.section-subtitle {
  display: block;
  color: #6b7280;
  font-size: 22rpx;
}

.title {
  display: block;
  margin-top: 8rpx;
  color: #111827;
  font-size: 38rpx;
  font-weight: 900;
}

.status-badge,
.task-status {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 800;
}

.status-success,
.status-completed {
  background: #ecfdf5;
  color: #059669;
}

.status-processing,
.status-submitted,
.status-queued {
  background: #eff6ff;
  color: #2563eb;
}

.status-failed,
.status-timeout {
  background: #fef2f2;
  color: #dc2626;
}

.batch-id-box {
  margin-top: 24rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: #f8fafc;
}

.value {
  display: block;
  margin-top: 8rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 800;
  word-break: break-all;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}

.summary-item {
  padding: 18rpx;
  border-radius: 20rpx;
  background: #f8fafc;
}

.summary-item.success {
  background: #ecfdf5;
}

.summary-item.failed {
  background: #fef2f2;
}

.summary-value {
  display: block;
  margin-top: 8rpx;
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}

.summary-value.small {
  font-size: 24rpx;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.export-summary {
  padding: 18rpx;
  border-radius: 20rpx;
  background: #f8fafc;
}

.export-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.export-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.export-status {
  flex-shrink: 0;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #64748b;
  font-size: 20rpx;
  font-weight: 800;
}

.export-exporting {
  background: #eff6ff;
  color: #2563eb;
}

.export-completed {
  background: #ecfdf5;
  color: #059669;
}

.export-failed {
  background: #fef2f2;
  color: #dc2626;
}

.export-meta-grid {
  display: grid;
  gap: 6rpx;
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.export-result {
  display: block;
  margin-top: 12rpx;
  color: #111827;
  font-size: 22rpx;
  font-weight: 800;
}

.batch-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.batch-action,
.task-action {
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 800;
}

.batch-action.primary,
.task-action.primary {
  background: #4f46e5;
  color: #ffffff;
}

.task-action.warning {
  background: #fee2e2;
  color: #dc2626;
}

.batch-action[disabled],
.task-action[disabled] {
  opacity: 0.55;
}

.section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.task-card {
  display: grid;
  grid-template-columns: 172rpx minmax(0, 1fr);
  gap: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.05);
}

.task-thumb {
  width: 172rpx;
  height: 172rpx;
  border-radius: 20rpx;
  background: #eef2ff;
}

.task-thumb.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 22rpx;
  font-weight: 800;
}

.task-body {
  min-width: 0;
}

.task-id {
  max-width: 330rpx;
  overflow: hidden;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta-grid {
  display: grid;
  gap: 6rpx;
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.task-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
}

.task-action {
  min-width: 160rpx;
}

.empty-state {
  align-items: center;
  text-align: center;
}

.empty-title {
  display: block;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-desc {
  display: block;
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.6;
}
</style>
