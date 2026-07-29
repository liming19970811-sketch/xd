<template>
  <view class="container">
    <view class="top-bar">
      <view class="left-info">
        <text v-if="!isVip">免费次数：{{ leftCount }} 次</text>
        <text v-else class="vip-text">会员无限生成</text>
      </view>
      <view class="right-btns">
        <button class="btn-share" @click="showShare = true">邀请送次数</button>
        <button class="btn-vip" @click="showPayModal = true" :class="{ hot: !isVip }">
          {{ isVip ? '管理会员' : '开通会员' }}
        </button>
      </view>
    </view>

    <view class="step-nav">
      <text class="step" :class="{ active: currentStepValue >= 1 }">1. 服装图</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 2 }">2. 参考图</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 3 }">3. 模特类型</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 4 }">4. 风格场景</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 5 }">5. 版型细节</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 6 }">6. 输出设置</text>
    </view>

    <view class="step-page" v-show="currentStepValue === 1">
      <view class="upload-box" @click="handleChooseClothImage" v-if="!clothImageValue.localPath">
        <view class="icon">上传</view>
        <text>上传服装正面图</text>
      </view>
      <view class="preview" v-else>
        <image :src="clothImageValue.localPath" class="img" mode="aspectFit"></image>
        <text class="upload-status">
          {{ clothUploadingValue ? '上传中...' : clothImageValue.fileId ? '已上传到服务端' : '待上传' }}
        </text>
        <text v-if="clothUploadErrorValue" class="error-text">{{ clothUploadErrorValue }}</text>
        <button v-if="clothRetryableValue" size="mini" type="warn" :disabled="clothUploadingValue" @click="retryClothUpload">
          {{ clothUploadingValue ? '上传中...' : '重试上传' }}
        </button>
        <button class="next-btn" @click="goStep(2)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 2">
      <view class="card">
        <view class="card-title">上传参考图</view>
        <view class="style-ref-box" @click="handleChooseStyleImage" v-if="!styleImageValue.localPath">
          <text>上传想参考的风格图</text>
        </view>
        <view class="style-preview" v-else>
          <image :src="styleImageValue.localPath" class="style-image" mode="aspectFit"></image>
          <text>{{ styleUploadingValue ? '参考图上传中...' : styleImageValue.fileId ? '参考图已上传到服务端' : '已选择参考图' }}</text>
          <text v-if="styleUploadErrorValue" class="error-text">{{ styleUploadErrorValue }}</text>
          <button v-if="styleRetryableValue" size="mini" type="warn" :disabled="styleUploadingValue" @click="retryStyleUpload">
            {{ styleUploadingValue ? '上传中...' : '重试上传' }}
          </button>
          <button size="mini" type="warn" :disabled="styleUploadingValue" @click="resetStyleImage">重选</button>
        </view>
      </view>
      <view class="btns">
        <button class="prev" @click="goStep(1)">上一步</button>
        <button class="next" @click="goStep(3)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 3">
      <view class="card">
        <view class="card-title">适用人群</view>
        <view class="grid">
          <view class="item" :class="{ on: modelTypeValue === 'female' }" @click="updateChainState({ modelType: 'female' })">女模特</view>
          <view class="item" :class="{ on: modelTypeValue === 'male' }" @click="updateChainState({ modelType: 'male' })">男模特</view>
          <view class="item" :class="{ on: modelTypeValue === 'kids' }" @click="updateChainState({ modelType: 'kids' })">童装</view>
        </view>
      </view>

      <view class="card" v-if="modelTypeValue !== 'kids'">
        <view class="card-title">身材类型</view>
        <view class="grid">
          <view class="item" :class="{ on: bodyValue === 'slim' }" @click="updateChainState({ body: 'slim' })">偏瘦</view>
          <view class="item" :class="{ on: bodyValue === 'normal' }" @click="updateChainState({ body: 'normal' })">标准</view>
          <view class="item" :class="{ on: bodyValue === 'curvy' }" @click="updateChainState({ body: 'curvy' })">微胖</view>
        </view>
      </view>

      <view class="card" v-if="modelTypeValue === 'kids'">
        <view class="card-title">童装年龄段</view>
        <view class="grid">
          <view class="item" :class="{ on: kidsAgeValue === 'toddler' }" @click="updateChainState({ kidsAge: 'toddler' })">小童</view>
          <view class="item" :class="{ on: kidsAgeValue === 'middle' }" @click="updateChainState({ kidsAge: 'middle' })">中童</view>
          <view class="item" :class="{ on: kidsAgeValue === 'big' }" @click="updateChainState({ kidsAge: 'big' })">大童</view>
        </view>
      </view>

      <view class="btns">
        <button class="prev" @click="goStep(2)">上一步</button>
        <button class="next" @click="goStep(4)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 4">
      <view class="card">
        <view class="card-title">风格</view>
        <view class="grid">
          <view class="item" :class="{ on: styleTagValue === item.id }" v-for="item in styleList" :key="item.id" @click="updateChainState({ styleTag: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">场景</view>
        <view class="grid">
          <view class="item" :class="{ on: sceneValue === item.id }" v-for="item in sceneList" :key="item.id" @click="updateChainState({ scene: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="btns">
        <button class="prev" @click="goStep(3)">上一步</button>
        <button class="next" @click="goStep(5)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 5">
      <view class="card">
        <view class="card-title">领口</view>
        <view class="grid">
          <view class="item" :class="{ on: neckValue === item.id }" v-for="item in neckList" :key="item.id" @click="updateChainState({ neck: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">袖型</view>
        <view class="grid">
          <view class="item" :class="{ on: sleeveValue === item.id }" v-for="item in sleeveList" :key="item.id" @click="updateChainState({ sleeve: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">版型</view>
        <view class="grid">
          <view class="item" :class="{ on: fitValue === item.id }" v-for="item in fitList" :key="item.id" @click="updateChainState({ fit: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="btns">
        <button class="prev" @click="goStep(4)">上一步</button>
        <button class="next" @click="goStep(6)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 6">
      <view class="card">
        <view class="card-title">输出设置</view>
        <view class="grid">
          <view class="item" :class="{ on: backgroundTypeValue === 'normal' }" @click="updateChainState({ bg: 'normal' })">普通背景</view>
          <view class="item" :class="{ on: backgroundTypeValue === 'transparent' }" @click="updateChainState({ bg: 'transparent' })">透明底</view>
        </view>
        <view class="grid grid-top">
          <view class="item" :class="{ on: outputTypeValue === 'main' }" @click="updateChainState({ output: 'main' })">主图</view>
          <view class="item" :class="{ on: outputTypeValue === 'detail' }" @click="updateChainState({ output: 'detail' })">详情页</view>
        </view>
      </view>

      <view class="quick-group">
        <button class="quick-btn single" :disabled="isGeneratingValue" @click="startGenerate">
          {{ isGeneratingValue ? '生成中...' : '一键生成' }}
        </button>
        <button v-if="generateRetryableValue" class="quick-btn retry" :disabled="isGeneratingValue" @click="retryGenerate">
          {{ isGeneratingValue ? '处理中...' : '重新生成' }}
        </button>
        <button v-if="canContinuePollingValue" class="quick-btn retry" :disabled="isGeneratingValue" @click="continuePolling">
          {{ isGeneratingValue ? '查询中...' : '继续查询任务' }}
        </button>
        <text v-if="generateErrorValue" class="error-text">{{ generateErrorValue }}</text>
        <text v-if="pollingErrorValue" class="error-text">{{ pollingErrorValue }}</text>
      </view>
    </view>

    <view class="generating" v-show="isGeneratingValue">
      <text>{{ runtimeTaskStatusTextValue }}</text>
      <view class="progress">
        <view class="bar" :style="{ width: runtimeTaskProgressValue + '%' }"></view>
      </view>
    </view>

    <view class="modal" v-show="showPayModal" @click="showPayModal = false">
      <view class="modal-card" @click.stop>
        <view class="close" @click="showPayModal = false">×</view>
        <view class="modal-title">开通会员</view>
        <view class="vip-item">月卡 39 元</view>
        <view class="vip-item hot">季卡 89 元</view>
        <view class="vip-item">年卡 199 元</view>
        <button class="pay-btn" @click="showPayModal = false">微信支付</button>
      </view>
    </view>

    <view class="modal" v-show="showShare" @click="showShare = false">
      <view class="modal-card" @click.stop>
        <view class="close" @click="showShare = false">×</view>
        <view class="modal-title">邀请好友送次数</view>
        <view class="share-info">
          <text>当前为演示流程，分享功能暂未接入。</text>
        </view>
        <button class="share-btn" @click="showShare = false">我知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getMainChainState } from '../../utils/mainChainState'
import { submitTask, syncDraftTaskToState } from '../../utils/task/taskActions'
import { continuePollingTask } from '../../utils/task/taskPolling'
import { retryTask, retryUploadAsset } from '../../utils/task/taskRetry'

export default {
  data() {
    return {
      chainState: getMainChainState(),
      isVip: false,
      leftCount: 2,
      showPayModal: false,
      showShare: false,
      styleList: [
        { id: 'korean', name: '韩系' },
        { id: 'ins', name: 'INS' },
        { id: 'simple', name: '简约' },
        { id: 'japanese', name: '日系' },
        { id: 'sweet', name: '甜美' },
        { id: 'casual', name: '休闲' }
      ],
      sceneList: [
        { id: 'white', name: '纯白背景' },
        { id: 'gray', name: '浅灰背景' },
        { id: 'blue', name: '浅蓝背景' },
        { id: 'living', name: '客厅' },
        { id: 'studio', name: '摄影棚' },
        { id: 'street', name: '街道' }
      ],
      neckList: [
        { id: 'round', name: '圆领' },
        { id: 'v', name: 'V领' },
        { id: 'polo', name: 'POLO' }
      ],
      sleeveList: [
        { id: 'short', name: '短袖' },
        { id: 'long', name: '长袖' },
        { id: 'sleeveless', name: '无袖' }
      ],
      fitList: [
        { id: 'tight', name: '修身' },
        { id: 'normal', name: '标准' },
        { id: 'loose', name: '宽松' },
        { id: 'oversize', name: '超大' }
      ]
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
    currentStepValue() {
      return (this.chainState.uiState && this.chainState.uiState.currentStep) || 1
    },
    draftTaskValue() {
      return this.chainState.draftTask || {}
    },
    draftInputValue() {
      return this.draftTaskValue.input || {}
    },
    draftAssetsValue() {
      return this.draftInputValue.assets || {}
    },
    draftParamsValue() {
      return this.draftInputValue.params || {}
    },
    draftOptionsValue() {
      return this.draftInputValue.options || {}
    },
    draftErrorValue() {
      return this.draftTaskValue.error || {}
    },
    draftErrorDetailsValue() {
      return this.draftErrorValue.details || {}
    },
    draftUploadErrorValue() {
      return this.draftErrorDetailsValue.upload || {}
    },
    draftControlValue() {
      return this.draftTaskValue.control || {}
    },
    draftRetryStateValue() {
      return this.draftControlValue.retryState || {}
    },
    draftUploadingStateValue() {
      return this.draftControlValue.uploading || {}
    },
    runtimeTaskValue() {
      return this.currentTaskValue || this.draftTaskValue || {}
    },
    runtimeTaskStatusValue() {
      return this.runtimeTaskValue.status || ''
    },
    runtimeTaskProgressValue() {
      return this.runtimeTaskValue.progress || 0
    },
    runtimeTaskStatusTextValue() {
      return this.runtimeTaskValue.statusText || ''
    },
    runtimeTaskErrorValue() {
      return this.runtimeTaskValue.error || this.draftErrorValue || {}
    },
    runtimeTaskControlValue() {
      return this.runtimeTaskValue.control || this.draftControlValue || {}
    },
    clothUploadErrorValue() {
      return this.draftUploadErrorValue.clothImage || ''
    },
    styleUploadErrorValue() {
      return this.draftUploadErrorValue.styleImage || ''
    },
    clothUploadingValue() {
      return !!(this.runtimeTaskControlValue.uploading && this.runtimeTaskControlValue.uploading.clothImage)
    },
    styleUploadingValue() {
      return !!(this.runtimeTaskControlValue.uploading && this.runtimeTaskControlValue.uploading.styleImage)
    },
    clothRetryableValue() {
      return !!(this.runtimeTaskControlValue.retryState && this.runtimeTaskControlValue.retryState.clothImage)
    },
    styleRetryableValue() {
      return !!(this.runtimeTaskControlValue.retryState && this.runtimeTaskControlValue.retryState.styleImage)
    },
    generateRetryableValue() {
      return !!(this.runtimeTaskControlValue.retryState && this.runtimeTaskControlValue.retryState.generate)
    },
    canContinuePollingValue() {
      return !!this.runtimeTaskControlValue.canContinuePolling
    },
    generateErrorValue() {
      return (this.runtimeTaskErrorValue.details && this.runtimeTaskErrorValue.details.generate) || ''
    },
    pollingErrorValue() {
      return (this.runtimeTaskErrorValue.details && this.runtimeTaskErrorValue.details.polling) || ''
    },
    isGeneratingValue() {
      return this.runtimeTaskStatusValue === 'processing' || this.runtimeTaskStatusValue === 'queued' || this.runtimeTaskStatusValue === 'submitted'
    },
    clothImageValue() {
      return this.draftAssetsValue.clothImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    styleImageValue() {
      return this.draftAssetsValue.styleImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    modelTypeValue() {
      return this.draftParamsValue.modelType || 'female'
    },
    bodyValue() {
      return this.draftParamsValue.bodyType || 'normal'
    },
    kidsAgeValue() {
      return this.draftParamsValue.kidsAgeGroup || 'middle'
    },
    styleTagValue() {
      return this.draftParamsValue.styleTag || 'simple'
    },
    sceneValue() {
      return this.draftParamsValue.sceneType || 'white'
    },
    neckValue() {
      return this.draftParamsValue.neckType || 'round'
    },
    sleeveValue() {
      return this.draftParamsValue.sleeveType || 'long'
    },
    fitValue() {
      return this.draftParamsValue.fitType || 'loose'
    },
    backgroundTypeValue() {
      return this.draftOptionsValue.backgroundType || 'normal'
    },
    outputTypeValue() {
      return this.draftOptionsValue.outputType || 'main'
    }
  },
  methods: {
    updateChainState(patch) {
      syncDraftTaskToState(patch)
    },
    handleChooseClothImage() {
      if (this.clothUploadingValue) {
        return
      }
      this.chooseClothImage()
    },
    handleChooseStyleImage() {
      if (this.styleUploadingValue) {
        return
      }
      this.chooseStyleImage()
    },
    goStep(step) {
      syncDraftTaskToState({ currentStep: step })
    },
    chooseClothImage() {
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const localPath = res.tempFilePaths[0]
          syncDraftTaskToState({
            clothImage: {
              localPath,
              fileId: '',
              fileUrl: ''
            },
            resultImageUrl: '',
            uploadError: {
              ...(this.draftUploadErrorValue || {}),
              clothImage: ''
            },
            retryable: {
              ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
              clothImage: false
            },
            uploading: {
              ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.uploading) || {}),
              clothImage: true
            }
          })

          try {
            await retryUploadAsset('clothImage', localPath, 'cloth_image')
          } catch (error) {
            uni.showToast({
              title: '服装图上传失败',
              icon: 'none'
            })
          }
        }
      })
    },
    chooseStyleImage() {
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const localPath = res.tempFilePaths[0]
          syncDraftTaskToState({
            styleImage: {
              localPath,
              fileId: '',
              fileUrl: ''
            },
            uploadError: {
              ...(this.draftUploadErrorValue || {}),
              styleImage: ''
            },
            retryable: {
              ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
              styleImage: false
            },
            uploading: {
              ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.uploading) || {}),
              styleImage: true
            }
          })

          try {
            await retryUploadAsset('styleImage', localPath, 'style_image')
          } catch (error) {
            uni.showToast({
              title: '参考图上传失败',
              icon: 'none'
            })
          }
        }
      })
    },
    resetStyleImage() {
      syncDraftTaskToState({
        styleImage: {
          localPath: '',
          fileId: '',
          fileUrl: ''
        },
        uploadError: {
          ...(this.draftUploadErrorValue || {}),
          styleImage: ''
        },
        retryable: {
          ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
          styleImage: false
        }
      })
    },
    retryClothUpload() {
      if (!this.clothImageValue.localPath || this.clothUploadingValue) {
        return
      }
      this.uploadSelectedImage('clothImage', this.clothImageValue.localPath, 'cloth_image')
    },
    retryStyleUpload() {
      if (!this.styleImageValue.localPath || this.styleUploadingValue) {
        return
      }
      this.uploadSelectedImage('styleImage', this.styleImageValue.localPath, 'style_image')
    },
    async uploadSelectedImage(field, localPath, scene) {
      try {
        await retryUploadAsset(field, localPath, scene)
      } catch (error) {
        uni.showToast({
          title: field === 'clothImage' ? '服装图上传失败' : '参考图上传失败',
          icon: 'none'
        })
      }
    },
    checkCount() {
      if (!this.isVip && this.leftCount <= 0) {
        uni.showModal({
          title: '次数已用完',
          content: '请先开通会员',
          showCancel: false
        })
        return false
      }
      return true
    },
    startGenerate() {
      if (this.isGeneratingValue) {
        return
      }
      if (!this.clothImageValue.fileId || !this.clothImageValue.fileUrl) {
        uni.showToast({
          title: '请先完成服装图上传',
          icon: 'none'
        })
        return
      }

      if (!this.checkCount()) {
        return
      }

      this.runGenerate()
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
        modelType: this.modelTypeValue,
        body: this.bodyValue,
        kidsAge: this.kidsAgeValue,
        styleTag: this.styleTagValue,
        scene: this.sceneValue,
        neck: this.neckValue,
        sleeve: this.sleeveValue,
        fit: this.fitValue,
        bg: this.backgroundTypeValue,
        output: this.outputTypeValue
      }
    },
    async runGenerate() {
      try {
        const taskResponse = await submitTask(this.buildGeneratePayload())

        if (taskResponse.mode === 'direct_success') {
          if (!this.isVip && this.leftCount > 0) {
            this.leftCount -= 1
          }

          uni.navigateTo({
            url: '/pages/result/result'
          })
          return
        }

        const pollResult = await continuePollingTask(taskResponse.taskId, {
          statusText: '任务已提交，等待结果...'
        })
        this.handlePollingResult(pollResult)
      } catch (error) {
        uni.showToast({
          title: '生成请求失败',
          icon: 'none'
        })
      }
    },
    handlePollingResult(pollResult) {
      if (!pollResult) {
        return
      }

      if (pollResult.status === 'success') {
        if (!this.isVip && this.leftCount > 0) {
          this.leftCount -= 1
        }

        uni.navigateTo({
          url: '/pages/result/result'
        })
        return
      }

      if (pollResult.reason === 'query_error') {
        uni.showToast({
          title: '任务查询失败',
          icon: 'none'
        })
        return
      }

      if (pollResult.reason === 'task_failed') {
        uni.showToast({
          title: '生成任务失败',
          icon: 'none'
        })
        return
      }

      if (pollResult.reason === 'timeout') {
        uni.showToast({
          title: '生成超时',
          icon: 'none'
        })
      }
    },
    retryGenerate() {
      if (this.isGeneratingValue) {
        return
      }
      this.runRetryGenerate()
    },
    async runRetryGenerate() {
      try {
        const taskResponse = await retryTask(this.buildGeneratePayload())

        if (taskResponse.mode === 'direct_success') {
          if (!this.isVip && this.leftCount > 0) {
            this.leftCount -= 1
          }

          uni.navigateTo({
            url: '/pages/result/result'
          })
          return
        }

        const pollResult = await continuePollingTask(taskResponse.taskId, {
          statusText: '任务已提交，等待结果...'
        })
        this.handlePollingResult(pollResult)
      } catch (error) {
        uni.showToast({
          title: '重新生成失败',
          icon: 'none'
        })
      }
    },
    async continuePolling() {
      if (this.isGeneratingValue) {
        return
      }
      const taskId = this.currentTaskIdValue || (this.runtimeTaskControlValue && this.runtimeTaskControlValue.lastTaskId) || this.chainState.taskId || this.chainState.lastTaskId
      if (!taskId) {
        uni.showToast({
          title: '暂无可继续查询的任务',
          icon: 'none'
        })
        return
      }

      try {
        const pollResult = await continuePollingTask(taskId)
        this.handlePollingResult(pollResult)
      } catch (error) {
        uni.showToast({
          title: '继续查询失败',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style scoped>
.container {
  padding: 20rpx;
  background: #f6f6f9;
  min-height: 100vh;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.left-info {
  font-size: 26rpx;
}

.vip-text {
  color: #ff7d00;
  font-weight: bold;
}

.right-btns {
  display: flex;
  gap: 12rpx;
}

.btn-share {
  background: #f0f8ff;
  color: #0099ff;
  border-radius: 50rpx;
  padding: 0 20rpx;
}

.btn-vip {
  background: #0099ff;
  color: #fff;
  border-radius: 50rpx;
  padding: 0 20rpx;
}

.btn-vip.hot {
  background: #ff4d4f;
}

.step-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20rpx 0;
  flex-wrap: wrap;
}

.step {
  color: #888;
  padding: 0 10rpx;
  font-size: 24rpx;
}

.step.active {
  color: #0099ff;
  font-weight: bold;
}

.arrow {
  color: #ccc;
}

.upload-box {
  background: #fff;
  border-radius: 20rpx;
  padding: 60rpx 0;
  text-align: center;
}

.icon {
  font-size: 40rpx;
  font-weight: bold;
  color: #0099ff;
  margin-bottom: 16rpx;
}

.preview {
  position: relative;
}

.img {
  width: 100%;
  height: 500rpx;
  border-radius: 20rpx;
}

.next-btn {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  background: #0099ff;
  color: #fff;
  border-radius: 50rpx;
}

.upload-status {
  display: block;
  margin-top: 16rpx;
  color: #666;
  font-size: 24rpx;
  text-align: center;
}

.error-text {
  display: block;
  margin-top: 12rpx;
  color: #ff4d4f;
  font-size: 24rpx;
  text-align: center;
}

.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.style-ref-box {
  border: 2rpx dashed #ccc;
  border-radius: 16rpx;
  padding: 40rpx;
  text-align: center;
}

.style-preview {
  text-align: center;
}

.style-image {
  width: 300rpx;
  height: 300rpx;
  border-radius: 16rpx;
  margin: 10rpx 0;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.grid-top {
  margin-top: 20rpx;
}

.item {
  flex: 1;
  min-width: 120rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  text-align: center;
  border: 2rpx solid #f0f0f0;
}

.item.on {
  background: #e6f7ff;
  border-color: #0099ff;
}

.btns {
  display: flex;
  gap: 20rpx;
  margin: 30rpx 0;
}

.prev {
  flex: 1;
  background: #f1f1f1;
  border-radius: 50rpx;
  height: 88rpx;
}

.next {
  flex: 1;
  background: #0099ff;
  color: #fff;
  border-radius: 50rpx;
  height: 88rpx;
}

.quick-group {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.quick-btn {
  border-radius: 50rpx;
  height: 88rpx;
}

.single {
  background: #0099ff;
  color: #fff;
}

.quick-btn[disabled],
.next-btn[disabled] {
  opacity: 0.6;
}

.retry {
  background: #fff7e6;
  color: #d46b08;
  border: 2rpx solid #ffd591;
}

.generating {
  text-align: center;
  padding: 40rpx;
}

.progress {
  width: 80%;
  height: 16rpx;
  background: #eee;
  border-radius: 10rpx;
  margin: 20rpx auto;
}

.bar {
  height: 100%;
  background: #0099ff;
  border-radius: 10rpx;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: #fff;
  width: 80%;
  border-radius: 30rpx;
  padding: 40rpx;
  position: relative;
}

.close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 40rpx;
}

.modal-title {
  text-align: center;
  font-weight: bold;
  margin-bottom: 30rpx;
}

.vip-item {
  padding: 24rpx;
  background: #f7f8fa;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  text-align: center;
}

.vip-item.hot {
  background: #fff1f0;
  border: 2rpx solid #ff4d4f;
}

.pay-btn,
.share-btn {
  width: 100%;
  background: #0099ff;
  color: #fff;
  border-radius: 50rpx;
  height: 88rpx;
  margin-top: 20rpx;
}

.share-info {
  text-align: center;
  color: #666;
  margin-bottom: 20rpx;
}
</style>
