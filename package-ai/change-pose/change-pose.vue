<template>
  <view class="pose-page">
    <view class="intro">
      <text class="intro-title">AI换姿势</text>
      <text class="intro-subtitle">只调整人物动作，保留身份、服装和原始场景。</text>
    </view>

    <scroll-view class="step-bar" scroll-x :show-scrollbar="false">
      <view class="step-track">
        <view v-for="step in steps" :key="step.value" :class="['step-item', { active: currentStep === step.value, done: currentStep > step.value }]">
          <text class="step-index">{{ currentStep > step.value ? '✓' : step.value }}</text>
          <text class="step-label">{{ step.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="content">
      <view v-if="currentStep === 1" class="section-card">
        <view class="section-head">
          <view><text class="section-title">上传人物图片</text><text class="required">必填</text></view>
          <text class="section-desc">建议人物完整、动作和服装区域清晰。</text>
        </view>
        <view v-if="!baseImage.localPath" class="upload-card" @click="chooseImage('base')">
          <text class="upload-icon">＋</text>
          <text class="upload-title">选择人物图片</text>
          <text class="upload-desc">支持从相册选择或拍摄</text>
        </view>
        <view v-else class="image-preview">
          <image :src="baseImage.localPath" mode="aspectFit" @click="previewImage(baseImage.localPath)" />
          <view class="preview-actions">
            <text @click="chooseImage('base')">更换</text>
            <text class="danger" @click="removeImage('base')">删除</text>
          </view>
          <text :class="['upload-status', baseImage.status]">{{ uploadStatusText(baseImage) }}</text>
        </view>
      </view>

      <view v-if="currentStep === 2" class="section-card">
        <view class="section-head">
          <text class="section-title">选择姿势来源</text>
          <text class="section-desc">模板直接指定动作；参考图只提取身体姿势。</text>
        </view>
        <view class="segment">
          <view :class="['segment-item', { active: poseSource === 'preset' }]" @tap="selectPoseSource('preset')">姿势模板</view>
          <view :class="['segment-item', { active: poseSource === 'reference' }]" @tap="selectPoseSource('reference')">上传参考图</view>
        </view>

        <view v-if="poseSource === 'preset'" class="preset-grid">
          <view v-for="item in posePresets" :key="item.value" :class="['preset-item', { active: posePreset === item.value }]" @tap="posePreset = item.value; saveDraft()">
            <text>{{ item.label }}</text><text v-if="posePreset === item.value" class="check">✓</text>
          </view>
        </view>

        <view v-else>
          <view v-if="!poseReferenceImage.localPath" class="upload-card compact" @click="chooseImage('reference')">
            <text class="upload-icon">＋</text>
            <text class="upload-title">上传目标动作图片</text>
            <text class="upload-desc">不会使用参考图的人脸、服装和背景</text>
          </view>
          <view v-else class="image-preview reference">
            <image :src="poseReferenceImage.localPath" mode="aspectFit" @click="previewImage(poseReferenceImage.localPath)" />
            <view class="preview-actions">
              <text @click="chooseImage('reference')">更换</text>
              <text class="danger" @click="removeImage('reference')">删除</text>
            </view>
            <text :class="['upload-status', poseReferenceImage.status]">{{ uploadStatusText(poseReferenceImage) }}</text>
            <text v-if="poseReferenceImage.status === 'ready'" class="reference-ready">姿势参考图已加入本次配置，提交时将进入任务。</text>
          </view>
        </view>
      </view>

      <view v-if="currentStep === 3" class="section-card">
        <view class="section-head">
          <text class="section-title">保留要求</text>
          <text class="section-desc">以下内容默认强制保留，不能关闭。</text>
        </view>
        <view class="preserve-list">
          <view v-for="item in preserveRules" :key="item" class="preserve-item"><text class="preserve-check">✓</text><text>{{ item }}</text></view>
        </view>
        <view class="notice">姿势变化需要扩展构图时，只允许补全必要区域，不得随机换人、换衣或换背景。</view>
      </view>

      <view v-if="currentStep === 4" class="section-card">
        <view class="section-head">
          <text class="section-title">确认生成</text>
          <text class="section-desc">请确认人物图、姿势来源和保留规则。</text>
        </view>
        <view class="summary-row"><text>人物图片</text><text>{{ baseImage.status === 'ready' ? '已上传' : '未完成' }}</text></view>
        <view class="summary-row"><text>姿势来源</text><text>{{ poseSourceLabel }}</text></view>
        <view class="summary-row"><text>目标姿势</text><text>{{ poseTargetLabel }}</text></view>
        <view class="summary-row"><text>保留内容</text><text>人物、服装、背景、比例</text></view>
        <view class="provider-warning" v-if="!poseRuntimeConfig.realProviderTest">
          <text class="provider-warning-title">UI 可测试</text>
          <text>{{ poseRuntimeConfig.disabledReason || providerCapability.message }}。未进入真实 Provider 前不会创建任务或扣除额度。</text>
        </view>
      </view>
    </view>

    <view class="bottom-bar">
      <view v-if="currentStep > 1" class="secondary-button" @click="previousStep">上一步</view>
      <button v-if="currentStep < 4" class="primary-button" :disabled="!canContinue" @click="nextStep">下一步</button>
      <button v-else class="primary-button" :disabled="isSubmitting" @click="submitPoseTask">生成换姿势效果</button>
    </view>
  </view>
</template>

<script>
import { uploadImage } from '../../utils/api/upload'
import { createInternalRealGenerationTask } from '../../utils/task/generationExecution'
import { getRuntimeGenerationConfig, refreshFeatureRuntimeBackendState } from '../../utils/runtime/appRuntimeConfig'
import {
  POSE_PRESETS,
  POSE_REPLACE_DRAFT_KEY,
  buildPoseReplaceTaskPayload,
  getPoseProviderCapability
} from '../../utils/task/poseReplaceContract'

const EMPTY_IMAGE = () => ({ localPath: '', remoteUrl: '', status: 'idle', error: '' })

export default {
  data() {
    return {
      steps: [
        { value: 1, label: '上传人物' },
        { value: 2, label: '选择姿势' },
        { value: 3, label: '保留要求' },
        { value: 4, label: '确认生成' }
      ],
      currentStep: 1,
      baseImage: EMPTY_IMAGE(),
      poseReferenceImage: EMPTY_IMAGE(),
      poseSource: 'preset',
      posePreset: '',
      posePresets: POSE_PRESETS,
      preserveRules: [
        '保留原人物身份、脸部和表情特征',
        '保留发型',
        '保留服装款式、颜色、图案和材质',
        '保留原始背景和场景',
        '保留画面比例'
      ],
      providerCapability: getPoseProviderCapability(),
      isSubmitting: false,
      runtimeConfigRevision: 0
    }
  },
  computed: {
    poseRuntimeConfig() {
      this.runtimeConfigRevision
      return getRuntimeGenerationConfig({
        providerSupported: this.providerCapability.supported === true,
        experimentalProviderSupported: this.providerCapability.experimentalSupported === true,
        provider: this.providerCapability.provider,
        modelName: this.providerCapability.model,
        taskType: 'pose_replace'
      })
    },
    canContinue() {
      if (this.currentStep === 1) return this.baseImage.status === 'ready'
      if (this.currentStep === 2) {
        return this.poseSource === 'preset'
          ? Boolean(this.posePreset)
          : this.poseReferenceImage.status === 'ready'
      }
      return true
    },
    poseSourceLabel() {
      return this.poseSource === 'reference' ? '姿势参考图' : '姿势模板'
    },
    poseTargetLabel() {
      if (this.poseSource === 'reference') return this.poseReferenceImage.status === 'ready' ? '参考图已准备' : '未上传'
      const item = this.posePresets.find((preset) => preset.value === this.posePreset)
      return item ? item.label : '未选择'
    }
  },
  onLoad() {
    this.restoreDraft()
  },
  onShow() {
    this.runtimeConfigRevision += 1
    refreshFeatureRuntimeBackendState().then(() => {
      this.runtimeConfigRevision += 1
    })
  },
  onHide() {
    this.saveDraft()
  },
  methods: {
    selectPoseSource(source) {
      if (!['preset', 'reference'].includes(source)) return
      this.poseSource = source
      this.saveDraft()
    },
    chooseImage(role) {
      const target = role === 'reference' ? 'poseReferenceImage' : 'baseImage'
      if (this[target].status === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async ({ tempFilePaths = [] } = {}) => {
          const localPath = tempFilePaths[0] || ''
          if (!localPath) return
          this[target] = { localPath, remoteUrl: '', status: 'uploading', error: '' }
          try {
            const uploaded = await uploadImage({
              filePath: localPath,
              assetType: role === 'reference' ? 'pose_reference_image' : 'person_image',
              scene: role === 'reference' ? 'pose_replace_reference' : 'pose_replace_base'
            })
            const remoteUrl = uploaded.fileId || uploaded.fileID || uploaded.fileUrl || uploaded.imageUrl || uploaded.url || ''
            if (!/^(cloud:\/\/|https:\/\/)/i.test(remoteUrl)) throw new Error('UPLOAD_STABLE_URL_REQUIRED')
            this[target] = { localPath, remoteUrl, status: 'ready', error: '' }
            this.saveDraft()
          } catch (error) {
            this[target] = { localPath, remoteUrl: '', status: 'failed', error: '上传失败，请重试' }
            uni.showToast({ title: '图片上传失败，请重试', icon: 'none' })
          }
        }
      })
    },
    removeImage(role) {
      const target = role === 'reference' ? 'poseReferenceImage' : 'baseImage'
      this[target] = EMPTY_IMAGE()
      this.saveDraft()
    },
    previewImage(url) {
      if (!url) return
      uni.previewImage({ current: url, urls: [url] })
    },
    uploadStatusText(image = {}) {
      if (image.status === 'uploading') return '正在上传…'
      if (image.status === 'ready') return '上传成功'
      if (image.status === 'failed') return image.error || '上传失败，请重试'
      return ''
    },
    nextStep() {
      if (!this.canContinue) {
        const message = this.currentStep === 1
          ? '请先上传人物图片'
          : (this.poseSource === 'reference' ? '请上传姿势参考图' : '请选择目标姿势')
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      this.currentStep = Math.min(4, this.currentStep + 1)
      this.saveDraft()
    },
    previousStep() {
      this.currentStep = Math.max(1, this.currentStep - 1)
      this.saveDraft()
    },
    async submitPoseTask() {
      if (this.isSubmitting) return
      const payload = buildPoseReplaceTaskPayload({
        baseImage: this.baseImage.remoteUrl,
        poseSource: this.poseSource,
        posePreset: this.posePreset,
        poseReferenceImage: this.poseReferenceImage.remoteUrl
      })
      if (!payload.ok) {
        uni.showToast({ title: payload.message, icon: 'none' })
        return
      }
      if (!this.poseRuntimeConfig.realProviderTest) {
        uni.showModal({
          title: '真实任务尚不可提交',
          content: `${this.poseRuntimeConfig.disabledReason || this.providerCapability.message}。本次不会创建任务或扣除额度。`,
          showCancel: false
        })
        return
      }
      this.isSubmitting = true
      try {
        const task = await createInternalRealGenerationTask(payload, this.poseRuntimeConfig)
        this.saveDraft()
        uni.navigateTo({ url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}` })
      } catch (error) {
        uni.showToast({ title: (error && error.message) || '真实 API 测试提交失败', icon: 'none' })
      } finally {
        this.isSubmitting = false
      }
    },
    saveDraft() {
      try {
        const stable = (image) => image && /^(cloud:\/\/|https:\/\/)/i.test(image.remoteUrl || '')
        const hasContent = stable(this.baseImage) || stable(this.poseReferenceImage) || Boolean(this.posePreset)
        if (!hasContent) {
          uni.removeStorageSync(POSE_REPLACE_DRAFT_KEY)
          return
        }
        uni.setStorageSync(POSE_REPLACE_DRAFT_KEY, {
          version: 1,
          updatedAt: Date.now(),
          currentStep: this.currentStep,
          poseSource: this.poseSource,
          posePreset: this.posePreset,
          baseImage: stable(this.baseImage) ? { localPath: this.baseImage.remoteUrl, remoteUrl: this.baseImage.remoteUrl, status: 'ready', error: '' } : EMPTY_IMAGE(),
          poseReferenceImage: stable(this.poseReferenceImage) ? { localPath: this.poseReferenceImage.remoteUrl, remoteUrl: this.poseReferenceImage.remoteUrl, status: 'ready', error: '' } : EMPTY_IMAGE()
        })
      } catch (error) {
        // Draft persistence is optional and must not block image selection.
      }
    },
    restoreDraft() {
      try {
        const draft = uni.getStorageSync(POSE_REPLACE_DRAFT_KEY)
        if (!draft || draft.version !== 1) return
        this.currentStep = Math.min(4, Math.max(1, Number(draft.currentStep || 1)))
        this.poseSource = ['preset', 'reference'].includes(draft.poseSource) ? draft.poseSource : 'preset'
        this.posePreset = this.posePresets.some((item) => item.value === draft.posePreset) ? draft.posePreset : ''
        if (draft.baseImage && draft.baseImage.remoteUrl) this.baseImage = draft.baseImage
        if (draft.poseReferenceImage && draft.poseReferenceImage.remoteUrl) this.poseReferenceImage = draft.poseReferenceImage
      } catch (error) {
        // Invalid local drafts are ignored without affecting the page.
      }
    }
  }
}
</script>

<style scoped>
.pose-page { min-height: 100vh; padding: 24rpx 24rpx calc(150rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #f5f6fa; color: #172033; }
.intro { padding: 8rpx 4rpx 22rpx; }
.intro-title { display: block; font-size: 40rpx; line-height: 1.25; font-weight: 700; }
.intro-subtitle { display: block; margin-top: 10rpx; font-size: 24rpx; line-height: 1.5; color: #667085; }
.step-bar { margin-bottom: 20rpx; white-space: nowrap; }
.step-track { display: inline-flex; min-width: 100%; gap: 10rpx; }
.step-item { display: flex; align-items: center; gap: 8rpx; padding: 14rpx 16rpx; border-radius: 8rpx; background: #e9edf4; color: #7b8496; }
.step-item.active { background: #e8f1ff; color: #1677ff; }
.step-item.done { color: #1677ff; background: #f0f6ff; }
.step-index { width: 30rpx; height: 30rpx; line-height: 30rpx; text-align: center; border-radius: 50%; background: rgba(255,255,255,.8); font-size: 20rpx; }
.step-label { font-size: 22rpx; }
.section-card { padding: 28rpx; border: 1rpx solid #e7eaf0; border-radius: 16rpx; background: #fff; }
.section-head { margin-bottom: 24rpx; }
.section-title { font-size: 30rpx; line-height: 1.4; font-weight: 650; }
.required { margin-left: 10rpx; font-size: 20rpx; color: #e5484d; }
.section-desc { display: block; margin-top: 8rpx; font-size: 23rpx; line-height: 1.5; color: #667085; }
.upload-card { min-height: 280rpx; border: 2rpx dashed #b9c8e4; border-radius: 12rpx; background: #f8fbff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.upload-card.compact { min-height: 220rpx; }
.upload-icon { font-size: 52rpx; line-height: 1; color: #1677ff; }
.upload-title { margin-top: 12rpx; font-size: 27rpx; font-weight: 600; }
.upload-desc { margin-top: 8rpx; font-size: 21rpx; color: #7b8496; }
.image-preview { position: relative; }
.image-preview image { display: block; width: 100%; height: 520rpx; border-radius: 12rpx; background: #eef1f5; }
.image-preview.reference image { height: 400rpx; }
.preview-actions { display: flex; justify-content: flex-end; gap: 28rpx; padding-top: 18rpx; font-size: 24rpx; color: #1677ff; }
.preview-actions .danger { color: #d92d20; }
.upload-status { display: block; margin-top: 10rpx; font-size: 22rpx; color: #667085; }
.upload-status.ready { color: #168a5b; }
.upload-status.failed { color: #d92d20; }
.reference-ready { display: block; margin-top: 8rpx; font-size: 22rpx; color: #168a5b; }
.segment { display: grid; grid-template-columns: 1fr 1fr; padding: 6rpx; border-radius: 10rpx; background: #f0f2f6; margin-bottom: 24rpx; }
.segment-item { min-height: 76rpx; display: flex; align-items: center; justify-content: center; border-radius: 8rpx; font-size: 25rpx; color: #667085; }
.segment-item.active { background: #fff; color: #1677ff; font-weight: 600; box-shadow: 0 2rpx 8rpx rgba(23,32,51,.08); }
.preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; }
.preset-item { min-height: 84rpx; padding: 0 20rpx; border: 1rpx solid #dfe4ec; border-radius: 10rpx; display: flex; align-items: center; justify-content: space-between; font-size: 25rpx; }
.preset-item.active { border-color: #1677ff; color: #1677ff; background: #edf5ff; }
.check { font-weight: 700; }
.preserve-list { display: flex; flex-direction: column; gap: 18rpx; }
.preserve-item { display: flex; align-items: flex-start; gap: 14rpx; font-size: 25rpx; line-height: 1.5; }
.preserve-check { flex: 0 0 32rpx; width: 32rpx; height: 32rpx; line-height: 32rpx; border-radius: 50%; text-align: center; color: #fff; background: #1677ff; font-size: 20rpx; }
.notice, .provider-warning { margin-top: 24rpx; padding: 20rpx; border-radius: 10rpx; font-size: 23rpx; line-height: 1.55; }
.notice { color: #5d6575; background: #f5f7fa; }
.summary-row { min-height: 82rpx; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; border-bottom: 1rpx solid #eef0f4; font-size: 24rpx; }
.summary-row text:last-child { color: #4f5b70; text-align: right; }
.provider-warning { color: #8a5200; background: #fff7e8; }
.provider-warning-title { display: block; margin-bottom: 6rpx; font-size: 25rpx; font-weight: 650; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; gap: 16rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e5e8ee; background: rgba(255,255,255,.96); }
.secondary-button, .primary-button { min-height: 88rpx; border-radius: 10rpx; display: flex; align-items: center; justify-content: center; font-size: 27rpx; font-weight: 600; box-sizing: border-box; }
.secondary-button { flex: 0 0 190rpx; border: 1rpx solid #cfd6e2; color: #4f5b70; background: #fff; }
.primary-button { flex: 1; margin: 0; color: #fff; background: #1677ff; border: 0; }
.primary-button::after { border: 0; }
.primary-button[disabled] { color: #929bad; background: #dce2eb; }
</style>
