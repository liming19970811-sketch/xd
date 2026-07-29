<template>
  <view class="container">
    <view class="nav-bar">
      <text class="back" @click="goBack">返回</text>
      <text class="title">生成结果</text>
      <view class="placeholder"></view>
    </view>

    <view class="result-area">
      <image v-if="displayImageUrl" class="result-img" :src="displayImageUrl" mode="aspectFit"></image>
      <view v-else class="empty-state">
        <text>暂无结果图片</text>
      </view>
    </view>

    <view class="info-box">
      <text class="info-item">服装图：{{ clothImageValue.fileId ? '已上传' : '未上传' }}</text>
      <text class="info-item">参考图：{{ styleImageValue.fileId ? '已上传' : '未上传' }}</text>
      <text class="info-item">服装图文件ID：{{ clothImageValue.fileId || '暂无' }}</text>
      <text class="info-item">参考图文件ID：{{ styleImageValue.fileId || '暂无' }}</text>
      <text class="info-item">生成任务ID：{{ currentTaskIdValue || '暂无' }}</text>
      <text class="info-item">任务状态：{{ taskStatusValue || '暂无' }}</text>
      <text class="info-item">任务阶段：{{ taskStageValue || '暂无' }}</text>
      <text class="info-item">任务进度：{{ taskProgressValue || 0 }}%</text>
      <text class="info-item" v-if="statusTextValue">状态文案：{{ statusTextValue }}</text>
      <text class="info-item" v-if="errorMessageValue">错误信息：{{ errorMessageValue }}</text>
      <text class="info-item">模特类型：{{ modelTypeName }}</text>
      <text class="info-item">身材：{{ bodyName }}</text>
      <text class="info-item">童装年龄：{{ kidsAgeName }}</text>
      <text class="info-item">风格：{{ styleTagName }}</text>
      <text class="info-item">场景：{{ sceneName }}</text>
      <text class="info-item">领口：{{ neckName }}</text>
      <text class="info-item">袖型：{{ sleeveName }}</text>
      <text class="info-item">版型：{{ fitName }}</text>
      <text class="info-item">背景：{{ bgName }}</text>
      <text class="info-item">输出：{{ outputName }}</text>
    </view>

    <view class="action-group">
      <button class="action-btn save" @click="saveImage">保存图片</button>
      <button class="action-btn share" @click="openShare">分享</button>
    </view>

    <view class="status-box" v-if="statusMessage">
      <text class="status-text">{{ statusMessage }}</text>
    </view>

    <view class="action-group action-group-secondary" v-if="canRetryGenerate || canContinueQuery || !displayImageUrl">
      <button v-if="canRetryGenerate" class="action-btn retry" :disabled="queryingTask" @click="retryGenerate">
        {{ queryingTask ? '处理中...' : '重新生成' }}
      </button>
      <button v-if="canContinueQuery" class="action-btn polling" :disabled="queryingTask" @click="continueQueryTask">
        {{ queryingTask ? '查询中...' : '继续查询任务' }}
      </button>
      <button class="action-btn back-upload" :disabled="queryingTask" @click="goToUploadPage">返回上传页</button>
    </view>

    <view class="share-platform" v-if="showShare">
      <view class="item" @click="shareTo('淘宝')">
        <text>淘宝</text>
      </view>
      <view class="item" @click="shareTo('拼多多')">
        <text>拼多多</text>
      </view>
      <view class="item" @click="shareTo('抖音')">
        <text>抖音</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getMainChainState } from '../../utils/mainChainState'
import { continuePollingTask } from '../../utils/task/taskPolling'
import { retryTask } from '../../utils/task/taskRetry'

const DEFAULT_LABEL = '未选择'

const STYLE_NAME_MAP = {
  korean: '韩系',
  ins: 'INS',
  simple: '简约',
  japanese: '日系',
  sweet: '甜美',
  gentle: '温柔',
  yujie: '御姐',
  cool: '甜酷',
  yan: '盐系',
  college: '学院',
  office: '通勤',
  casual: '休闲'
}

const SCENE_NAME_MAP = {
  white: '纯白背景',
  gray: '浅灰背景',
  blue: '浅蓝背景',
  beige: '米色背景',
  black: '纯黑背景',
  warm: '暖光室内',
  cold: '冷光室内',
  living: '客厅',
  studio: '摄影棚',
  park: '公园',
  street: '街道'
}

const MODEL_TYPE_NAME_MAP = {
  female: '女模特',
  male: '男模特',
  kids: '童装'
}

const FIT_NAME_MAP = {
  tight: '修身',
  normal: '标准',
  loose: '宽松',
  oversize: '超大'
}

const OUTPUT_NAME_MAP = {
  main: '主图',
  detail: '详情页'
}

export default {
  data() {
    return {
      chainState: getMainChainState(),
      showShare: false,
      queryingTask: false
    }
  },
  computed: {
    currentTaskIdValue() {
      return this.chainState.currentTaskId || this.chainState.taskId || this.chainState.lastTaskId || ''
    },
    currentTaskValue() {
      const taskId = this.currentTaskIdValue
      return (taskId && this.chainState.tasks && this.chainState.tasks.byId && this.chainState.tasks.byId[taskId]) || null
    },
    taskInputValue() {
      return (this.currentTaskValue && this.currentTaskValue.input) || {}
    },
    taskAssetsValue() {
      return this.taskInputValue.assets || {}
    },
    taskParamsValue() {
      return this.taskInputValue.params || {}
    },
    taskOptionsValue() {
      return this.taskInputValue.options || {}
    },
    taskResultValue() {
      return (this.currentTaskValue && this.currentTaskValue.result) || {}
    },
    taskErrorValue() {
      return (this.currentTaskValue && this.currentTaskValue.error) || {}
    },
    taskControlValue() {
      return (this.currentTaskValue && this.currentTaskValue.control) || {}
    },
    clothImageValue() {
      return this.taskAssetsValue.clothImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    styleImageValue() {
      return this.taskAssetsValue.styleImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    displayImageUrl() {
      const resultItems = Array.isArray(this.taskResultValue.items) ? this.taskResultValue.items : []
      const firstResultItem = resultItems[0] || {}
      return (
        this.taskResultValue.coverUrl ||
        firstResultItem.fileUrl ||
        this.clothImageValue.fileUrl ||
        this.styleImageValue.fileUrl ||
        this.clothImageValue.localPath ||
        this.styleImageValue.localPath ||
        ''
      )
    },
    modelTypeName() {
      return MODEL_TYPE_NAME_MAP[this.taskParamsValue.modelType] || DEFAULT_LABEL
    },
    bodyName() {
      const map = {
        slim: '偏瘦',
        normal: '标准',
        curvy: '微胖'
      }
      return map[this.taskParamsValue.bodyType] || DEFAULT_LABEL
    },
    kidsAgeName() {
      const map = {
        toddler: '小童',
        middle: '中童',
        big: '大童'
      }
      const modelType = this.taskParamsValue.modelType
      const kidsAgeGroup = this.taskParamsValue.kidsAgeGroup
      return modelType === 'kids' ? map[kidsAgeGroup] || DEFAULT_LABEL : '不适用'
    },
    styleTagName() {
      return STYLE_NAME_MAP[this.taskParamsValue.styleTag] || DEFAULT_LABEL
    },
    sceneName() {
      return SCENE_NAME_MAP[this.taskParamsValue.sceneType] || DEFAULT_LABEL
    },
    neckName() {
      const map = {
        round: '圆领',
        v: 'V领',
        polo: 'POLO'
      }
      return map[this.taskParamsValue.neckType] || DEFAULT_LABEL
    },
    sleeveName() {
      const map = {
        short: '短袖',
        long: '长袖',
        sleeveless: '无袖'
      }
      return map[this.taskParamsValue.sleeveType] || DEFAULT_LABEL
    },
    fitName() {
      return FIT_NAME_MAP[this.taskParamsValue.fitType] || DEFAULT_LABEL
    },
    bgName() {
      const map = {
        normal: '普通背景',
        transparent: '透明底'
      }
      return map[this.taskOptionsValue.backgroundType] || DEFAULT_LABEL
    },
    outputName() {
      return OUTPUT_NAME_MAP[this.taskOptionsValue.outputType] || DEFAULT_LABEL
    },
    taskStatusValue() {
      return (this.currentTaskValue && this.currentTaskValue.status) || ''
    },
    taskStageValue() {
      return (this.currentTaskValue && this.currentTaskValue.stage) || ''
    },
    taskProgressValue() {
      return (this.currentTaskValue && this.currentTaskValue.progress) || 0
    },
    statusTextValue() {
      return (this.currentTaskValue && this.currentTaskValue.statusText) || ''
    },
    errorTypeValue() {
      return this.taskErrorValue.type || ''
    },
    errorMessageValue() {
      return this.taskErrorValue.message || ''
    },
    statusMessage() {
      if (this.taskStatusValue === 'failed' || this.taskStatusValue === 'error') {
        return this.errorMessageValue || '生成失败，请重新发起生成。'
      }
      if (this.taskStatusValue === 'timeout') {
        return this.errorMessageValue || '任务查询超时，可继续查询任务。'
      }
      if (this.taskControlValue.canContinuePolling) {
        return this.errorMessageValue || '任务已提交，正在等待结果。'
      }
      if (!this.displayImageUrl) {
        return '当前还没有可展示的生成结果。'
      }
      return ''
    },
    canRetryGenerate() {
      return !!(this.taskControlValue && this.taskControlValue.canRetry)
    },
    canContinueQuery() {
      return !!(this.taskControlValue && this.taskControlValue.canContinuePolling)
    }
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    saveImage() {
      if (!this.displayImageUrl) {
        uni.showToast({
          title: '暂无可保存图片',
          icon: 'none'
        })
        return
      }

      uni.saveImageToPhotosAlbum({
        filePath: this.displayImageUrl,
        success: () => {
          uni.showToast({
            title: '图片已保存',
            icon: 'success'
          })
        },
        fail: () => {
          uni.showToast({
            title: '保存失败',
            icon: 'none'
          })
        }
      })
    },
    openShare() {
      this.showShare = true
    },
    goToUploadPage() {
      uni.navigateBack({
        fail: () => {
          uni.redirectTo({
            url: '/pages/upload/upload'
          })
        }
      })
    },
    retryGenerate() {
      this.runRetryGenerate()
    },
    buildGeneratePayload() {
      return {
        cloth_image: {
          file_id: this.clothImageValue.fileId || '',
          file_url: this.clothImageValue.fileUrl || ''
        },
        style_image: {
          file_id: this.styleImageValue.fileId || '',
          file_url: this.styleImageValue.fileUrl || ''
        },
        modelType: this.taskParamsValue.modelType,
        body: this.taskParamsValue.bodyType,
        kidsAge: this.taskParamsValue.kidsAgeGroup,
        styleTag: this.taskParamsValue.styleTag,
        scene: this.taskParamsValue.sceneType,
        neck: this.taskParamsValue.neckType,
        sleeve: this.taskParamsValue.sleeveType,
        fit: this.taskParamsValue.fitType,
        bg: this.taskOptionsValue.backgroundType,
        output: this.taskOptionsValue.outputType
      }
    },
    async runRetryGenerate() {
      if (this.queryingTask) {
        return
      }

      this.queryingTask = true
      try {
        const taskResponse = await retryTask(this.buildGeneratePayload())

        if (taskResponse.mode === 'direct_success') {
          uni.showToast({
            title: '已重新生成',
            icon: 'success'
          })
          return
        }

        const pollResult = await continuePollingTask(taskResponse.taskId, {
          statusText: '任务已提交，等待结果...'
        })

        if (pollResult.reason === 'query_error') {
          uni.showToast({
            title: '任务查询失败',
            icon: 'none'
          })
        } else if (pollResult.reason === 'task_failed') {
          uni.showToast({
            title: '生成任务失败',
            icon: 'none'
          })
        } else if (pollResult.reason === 'timeout') {
          uni.showToast({
            title: '生成超时',
            icon: 'none'
          })
        }
      } catch (error) {
        uni.showToast({
          title: '重新生成失败',
          icon: 'none'
        })
      } finally {
        this.queryingTask = false
      }
    },
    async continueQueryTask() {
      const taskId = this.currentTaskIdValue || this.chainState.taskId || this.chainState.lastTaskId
      if (!taskId || this.queryingTask) {
        return
      }

      this.queryingTask = true

      try {
        const pollResult = await continuePollingTask(taskId)

        if (pollResult.reason === 'query_error') {
          uni.showToast({
            title: '任务查询失败',
            icon: 'none'
          })
        } else if (pollResult.reason === 'task_failed') {
          uni.showToast({
            title: '生成任务失败',
            icon: 'none'
          })
        } else if (pollResult.reason === 'timeout') {
          uni.showToast({
            title: '生成超时',
            icon: 'none'
          })
        }
      } catch (error) {
        uni.showToast({
          title: '继续查询失败',
          icon: 'none'
        })
      } finally {
        this.queryingTask = false
      }
    },
    shareTo(platform) {
      uni.showModal({
        title: '分享提示',
        content: `当前为演示页面，请手动分享到${platform}`,
        showCancel: false
      })
      this.showShare = false
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 0 20rpx 80rpx;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 0;
}

.back {
  color: #1890ff;
  font-size: 28rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
}

.placeholder {
  width: 56rpx;
}

.result-area {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.result-img {
  width: 100%;
  height: 500rpx;
  border-radius: 16rpx;
}

.empty-state {
  height: 500rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.info-box {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.info-item {
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  color: #333;
}

.action-group {
  display: flex;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.action-group-secondary {
  margin-top: -10rpx;
}

.action-btn {
  flex: 1;
  height: 90rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  border: none;
}

.action-btn[disabled] {
  opacity: 0.6;
}

.save {
  background: #1890ff;
  color: #fff;
}

.share {
  background: #fff;
  color: #1890ff;
  border: 2rpx solid #1890ff;
}

.retry {
  background: #fff7e6;
  color: #d46b08;
  border: 2rpx solid #ffd591;
}

.polling {
  background: #e6f4ff;
  color: #1677ff;
  border: 2rpx solid #91caff;
}

.back-upload {
  background: #f5f5f5;
  color: #333;
  border: 2rpx solid #d9d9d9;
}

.status-box {
  background: #fff7e6;
  border: 2rpx solid #ffd591;
  border-radius: 20rpx;
  padding: 24rpx 30rpx;
  margin-bottom: 30rpx;
}

.status-text {
  display: block;
  color: #ad4e00;
  font-size: 26rpx;
  line-height: 1.6;
}

.share-platform {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  justify-content: space-around;
}

.item {
  font-size: 28rpx;
  padding: 20rpx;
}
</style>
