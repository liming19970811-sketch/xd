<template>
  <view class="marketing-page">
    <AiFeatureHeader
      title="营销素材"
      description="上传一件服装，生成适合电商宣传的系列图、海报和详情页素材。"
    />

    <view class="section-card upload-card">
      <view class="section-head">
        <text class="section-title">上传服装图</text>
        <text class="section-note">建议使用清晰、无遮挡的服装图片</text>
      </view>
      <view v-if="clothImagePath" class="upload-preview">
        <image class="preview-image" :src="clothImagePath" mode="aspectFill" />
        <view class="preview-mask" @click="removeClothImage">重新上传</view>
      </view>
      <view v-else class="upload-placeholder" @click="chooseClothImage">
        <text class="upload-plus">+</text>
        <text class="upload-title">添加服装图片</text>
        <text class="upload-desc">支持平铺图、人台图、真人图</text>
      </view>
      <text v-if="uploadError" class="upload-error">{{ uploadError }}</text>
    </view>

    <view class="section-card">
      <view class="section-head">
        <text class="section-title">素材类型选择</text>
        <text class="section-note">选择这次要生成的宣传素材</text>
      </view>
      <view class="type-grid">
        <view
          v-for="item in materialTypes"
          :key="item.value"
          class="type-card"
          :class="{ active: materialType === item.value }"
          @click="selectMaterialType(item.value)"
        >
          <text class="type-title">{{ item.label }}</text>
          <text class="type-desc">{{ item.desc }}</text>
        </view>
      </view>

      <view class="option-panel">
        <text class="option-title">{{ currentConfig.label }}配置</text>
        <view class="option-grid">
          <view
            v-for="option in currentConfig.options"
            :key="option.value"
            class="choice-pill"
            :class="{ active: currentOptionValue === option.value }"
            @click="selectCurrentOption(option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>
    </view>

    <view class="section-card">
      <view class="section-head">
        <text class="section-title">风格选择</text>
        <text class="section-note">统一图片的视觉调性</text>
      </view>
      <view class="style-grid">
        <view
          v-for="style in styleOptions"
          :key="style.value"
          class="choice-pill style-pill"
          :class="{ active: styleType === style.value }"
          @click="selectStyle(style.value)"
        >
          {{ style.label }}
        </view>
      </view>
    </view>

    <view class="section-card">
      <view class="section-head">
        <text class="section-title">生成数量</text>
        <text class="section-note">按当前素材类型批量生成</text>
      </view>
      <view class="count-row">
        <view
          v-for="count in countOptions"
          :key="count"
          class="count-card"
          :class="{ active: generateCount === count }"
          @click="selectCount(count)"
        >
          <text class="count-num">{{ count }}</text>
          <text class="count-unit">张</text>
        </view>
      </view>
    </view>

    <GenerationActionBar
      :summary="marketingGenerationSummary"
      :reason="marketingGenerateDisabledReason"
      :button-text="marketingGenerateButtonText"
      loading-text="正在创建任务…"
      :disabled="!canGenerateMarketing"
      :loading="isGenerating"
      @generate="startGenerate"
    />
  </view>
</template>

<script>
import AiFeatureHeader from '../../components/ai-generation/ai-feature-header.vue'
import GenerationActionBar from '../../components/ai-generation/generation-action-bar.vue'
import { createGenerationTaskAndRun } from '../../utils/task/generationExecution'
import { uploadImage } from '../../utils/api/upload'

const MATERIAL_TYPES = [
  {
    label: '系列图',
    value: 'series',
    desc: '统一风格成组出图'
  },
  {
    label: '海报',
    value: 'poster',
    desc: '活动与社媒宣传'
  },
  {
    label: '详情页素材',
    value: 'detail',
    desc: '补齐商品卖点图'
  }
]

const MATERIAL_CONFIGS = {
  series: {
    label: '系列图',
    key: 'seriesType',
    taskType: 'marketing_series',
    outputType: 'marketing_series_image',
    options: [
      { label: '新品发布', value: 'new_arrival' },
      { label: '模特大片', value: 'model_editorial' },
      { label: '电商套图', value: 'ecommerce_set' },
      { label: '品牌系列', value: 'brand_series' }
    ]
  },
  poster: {
    label: '海报',
    key: 'posterType',
    taskType: 'marketing_poster',
    outputType: 'marketing_poster_image',
    options: [
      { label: '新品上市', value: 'new_launch' },
      { label: '活动促销', value: 'promotion' },
      { label: '品牌宣传', value: 'brand_campaign' },
      { label: '小红书种草', value: 'xiaohongshu_seed' }
    ]
  },
  detail: {
    label: '详情页素材',
    key: 'detailType',
    taskType: 'marketing_detail_asset',
    outputType: 'marketing_detail_image',
    options: [
      { label: '商品主图', value: 'main_image' },
      { label: '卖点图', value: 'selling_point' },
      { label: '尺寸图', value: 'size_chart' },
      { label: '面料图', value: 'fabric_detail' },
      { label: '细节图', value: 'detail_closeup' }
    ]
  }
}

const STYLE_OPTIONS = [
  { label: '高级感', value: 'premium' },
  { label: '商业摄影', value: 'commercial_photo' },
  { label: '极简', value: 'minimal' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: '品牌视觉', value: 'brand_visual' }
]

export default {
  components: {
    AiFeatureHeader,
    GenerationActionBar
  },
  data() {
    return {
      clothImagePath: '',
      materialType: 'series',
      seriesType: 'new_arrival',
      posterType: 'new_launch',
      detailType: 'main_image',
      styleType: 'premium',
      generateCount: 3,
      isGenerating: false,
      uploadStatus: 'idle',
      uploadError: '',
      createdTaskId: '',
      submissionState: 'idle',
      materialTypes: MATERIAL_TYPES,
      styleOptions: STYLE_OPTIONS,
      countOptions: [3, 6, 9]
    }
  },
  computed: {
    currentConfig() {
      return MATERIAL_CONFIGS[this.materialType] || MATERIAL_CONFIGS.series
    },
    currentOptionValue() {
      return this[this.currentConfig.key]
    },
    selectedMaterialOption() {
      return this.currentConfig.options.find((item) => item.value === this.currentOptionValue) || this.currentConfig.options[0]
    },
    selectedStyle() {
      return this.styleOptions.find((item) => item.value === this.styleType) || this.styleOptions[0]
    },
    marketingGenerationSummary() {
      if (this.createdTaskId) return '任务已创建，不会重复提交'
      return `${this.currentConfig.label} · ${this.selectedMaterialOption.label} · ${this.generateCount} 张`
    },
    marketingGenerateDisabledReason() {
      if (this.createdTaskId) return ''
      if (this.isGenerating || this.uploadStatus === 'uploading') return '正在准备图片并创建任务，请勿重复操作'
      if (!this.clothImagePath) return '请先上传服装图片'
      return ''
    },
    canGenerateMarketing() {
      if (this.createdTaskId) return !this.isGenerating
      return !this.marketingGenerateDisabledReason
    },
    marketingGenerateButtonText() {
      if (this.createdTaskId) return '查看已创建任务'
      return '生成营销素材'
    }
  },
  methods: {
    chooseClothImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.clothImagePath = res.tempFilePaths && res.tempFilePaths[0] ? res.tempFilePaths[0] : ''
          this.uploadStatus = 'selected'
          this.uploadError = ''
          this.createdTaskId = ''
          this.submissionState = 'idle'
        }
      })
    },
    removeClothImage() {
      this.clothImagePath = ''
      this.uploadStatus = 'idle'
      this.uploadError = ''
      this.createdTaskId = ''
      this.submissionState = 'idle'
    },
    selectMaterialType(value) {
      this.materialType = value
    },
    selectCurrentOption(value) {
      this[this.currentConfig.key] = value
    },
    selectStyle(value) {
      this.styleType = value
    },
    selectCount(count) {
      this.generateCount = count
    },
    buildPromptDraft() {
      return [
        this.currentConfig.label,
        this.selectedMaterialOption.label,
        this.selectedStyle.label,
        `${this.generateCount}张`,
        '保持服装主体清晰，适合电商宣传使用'
      ].join('，')
    },
    isStableImagePath(value) {
      return /^(cloud:\/\/|https:\/\/)/i.test(String(value || '').trim())
    },
    async ensureStableClothImage() {
      const selectedPath = String(this.clothImagePath || '').trim()
      if (!selectedPath) throw new Error('请先上传服装图片')
      if (this.isStableImagePath(selectedPath)) {
        return {
          localPath: '',
          fileId: /^cloud:\/\//i.test(selectedPath) ? selectedPath : '',
          fileUrl: selectedPath
        }
      }

      this.uploadStatus = 'uploading'
      const uploaded = await uploadImage({
        filePath: selectedPath,
        scene: 'marketing_workbench'
      })
      const fileId = String(uploaded && (uploaded.fileId || uploaded.file_id) || '').trim()
      const fileUrl = String(uploaded && (uploaded.fileUrl || uploaded.file_url || uploaded.url) || '').trim()
      const stablePath = fileUrl || fileId
      if (!this.isStableImagePath(stablePath)) throw new Error('服装图片未获得稳定地址')

      this.uploadStatus = 'ready'
      return {
        localPath: selectedPath,
        fileId,
        fileUrl: fileUrl || fileId
      }
    },
    openCreatedTask() {
      if (!this.createdTaskId) return
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(this.createdTaskId)}`,
        success: () => {
          this.submissionState = 'navigated'
        },
        fail: () => {
          this.submissionState = 'navigation_failed'
          uni.showToast({ title: '任务已创建，请从生产记录查看', icon: 'none' })
        }
      })
    },
    async startGenerate() {
      if (this.isGenerating) {
        return
      }
      if (this.createdTaskId) {
        this.openCreatedTask()
        return
      }
      if (!this.clothImagePath) {
        uni.showToast({
          title: '请先上传服装图',
          icon: 'none'
        })
        return
      }

      this.isGenerating = true
      this.submissionState = 'preparing'
      this.uploadError = ''
      try {
        const clothAsset = await this.ensureStableClothImage()
        this.submissionState = 'creating'
        const config = this.currentConfig
        const task = createGenerationTaskAndRun({
          type: config.taskType,
          channel: 'marketing_workbench',
          input: {
            assets: {
              clothImage: {
                localPath: clothAsset.localPath,
                fileId: clothAsset.fileId,
                fileUrl: clothAsset.fileUrl
              }
            },
            params: {
              toolType: 'marketing',
              materialType: this.materialType,
              materialTypeName: config.label,
              [config.key]: this.currentOptionValue,
              materialOptionName: this.selectedMaterialOption.label,
              styleType: this.styleType,
              styleName: this.selectedStyle.label,
              generateCount: this.generateCount,
              promptDraft: this.buildPromptDraft(),
              generationMode: 'quick',
              outputUsage: config.outputType
            },
            options: {
              outputType: config.outputType,
              count: this.generateCount
            }
          },
          params: {
            toolType: 'marketing',
            templateType: config.taskType,
            outputType: config.outputType,
            materialType: this.materialType,
            styleType: this.styleType,
            generateCount: this.generateCount,
            generationMode: 'quick',
            outputUsage: config.outputType
          }
        })
        this.createdTaskId = task.taskId
        this.submissionState = 'task_created'
        this.openCreatedTask()
      } catch (error) {
        const isUploadFailure = this.uploadStatus === 'uploading'
        this.uploadStatus = isUploadFailure ? 'failed' : this.uploadStatus
        this.uploadError = isUploadFailure ? '服装图片上传失败，请重新选择或重试' : ''
        this.submissionState = isUploadFailure ? 'upload_failed' : 'submission_failed'
        uni.showToast({
          title: isUploadFailure ? '图片上传失败，请重试' : '任务创建失败，请重试',
          icon: 'none'
        })
      } finally {
        this.isGenerating = false
      }
    }
  }
}
</script>

<style scoped>
.marketing-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 160rpx;
  background: #f6f7fb;
  box-sizing: border-box;
}

.upload-error {
  display: block;
  margin-top: 14rpx;
  color: #b42318;
  font-size: 23rpx;
  line-height: 1.45;
}

.section-card {
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.07);
  box-sizing: border-box;
}

.section-card {
  padding: 28rpx;
  margin-bottom: 22rpx;
}

.section-head {
  margin-bottom: 20rpx;
}

.section-title {
  display: block;
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.section-note {
  display: block;
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.45;
}

.upload-placeholder {
  height: 260rpx;
  border: 2rpx dashed rgba(79, 70, 229, 0.25);
  border-radius: 28rpx;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.06), rgba(14, 165, 233, 0.06));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-plus {
  width: 64rpx;
  height: 64rpx;
  border-radius: 24rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 44rpx;
  line-height: 60rpx;
  text-align: center;
  font-weight: 500;
}

.upload-title {
  margin-top: 18rpx;
  color: #111827;
  font-size: 28rpx;
  font-weight: 700;
}

.upload-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 23rpx;
}

.upload-preview {
  position: relative;
  height: 300rpx;
  border-radius: 28rpx;
  overflow: hidden;
  background: #eef2ff;
}

.preview-image {
  width: 100%;
  height: 100%;
}

.preview-mask {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  color: #ffffff;
  background: rgba(17, 24, 39, 0.66);
  font-size: 23rpx;
  font-weight: 700;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.type-card {
  min-height: 132rpx;
  padding: 18rpx;
  border: 2rpx solid #eef2f7;
  border-radius: 24rpx;
  background: #f9fafb;
  box-sizing: border-box;
}

.type-card.active {
  border-color: rgba(79, 70, 229, 0.38);
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(14, 165, 233, 0.08));
}

.type-title {
  display: block;
  color: #111827;
  font-size: 27rpx;
  font-weight: 800;
}

.type-desc {
  display: block;
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.35;
}

.option-panel {
  margin-top: 24rpx;
  padding: 22rpx;
  border-radius: 26rpx;
  background: #f8fafc;
}

.option-title {
  display: block;
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
  margin-bottom: 16rpx;
}

.option-grid,
.style-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.choice-pill {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  color: #374151;
  background: #ffffff;
  border: 2rpx solid #e5e7eb;
  font-size: 24rpx;
  font-weight: 700;
}

.choice-pill.active {
  color: #ffffff;
  background: #4f46e5;
  border-color: #4f46e5;
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.18);
}

.style-pill {
  min-width: 132rpx;
  text-align: center;
}

.count-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.count-card {
  height: 112rpx;
  border-radius: 24rpx;
  background: #f9fafb;
  border: 2rpx solid #eef2f7;
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.count-card.active {
  border-color: rgba(79, 70, 229, 0.38);
  background: #eef2ff;
}

.count-num {
  color: #111827;
  font-size: 44rpx;
  font-weight: 900;
}

.count-unit {
  margin-left: 6rpx;
  color: #6b7280;
  font-size: 24rpx;
  font-weight: 700;
}

</style>
