<template>
  <view class="model-library-page">
    <view class="library-header">
      <text class="header-kicker">Professional Model Library</text>
      <text class="header-title">专业版 AI 模特库</text>
      <text class="header-desc">按性别、年龄、身材和风格筛选适合服装上新的模特资产。</text>
    </view>

    <view class="library-tabs">
      <view class="library-tab" :class="{ active: activeTab === 'system' }" @click="activeTab = 'system'">
        <text>系统模特</text>
      </view>
      <view class="library-tab" :class="{ active: activeTab === 'mine' }" @click="activeTab = 'mine'">
        <text>我的模特</text>
      </view>
    </view>

    <view v-if="activeTab === 'system'" class="filter-panel">
      <view v-for="group in filterGroups" :key="group.key" class="filter-row">
        <text class="filter-label">{{ group.label }}</text>
        <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
          <view class="filter-chip-row">
            <view
              v-for="item in group.options"
              :key="item.value"
              class="filter-chip"
              :class="{ active: filters[group.key] === item.value }"
              @click="setFilter(group.key, item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="model-grid">
      <view
        v-for="model in visibleModels"
        :key="model.modelId"
        class="model-card"
        :class="{ active: selectedModel && selectedModel.modelId === model.modelId }"
        @click="selectModel(model)"
      >
        <view class="model-cover">
          <image v-if="getModelAvatar(model)" class="model-image" :src="getModelAvatar(model)" mode="aspectFill" @error="markImageFailed(model, 'avatarUrl')"></image>
          <view v-else class="model-placeholder">
            <text>{{ model.name.slice(0, 1) }}</text>
          </view>
        </view>
        <view class="model-card-body">
          <text class="model-name">{{ model.name }}</text>
          <text class="model-meta">{{ model.ageRange }} · {{ model.height || '身高未设' }} · {{ model.bodyType }}身材</text>
          <view class="tag-row">
            <text v-for="tag in model.styleTags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="activeTab === 'mine'" class="custom-panel">
      <text class="custom-title">创建我的固定模特</text>
      <text class="custom-desc">第一阶段仅保存本地模特资产数据，不接真人训练和云端上传。</text>
      <view class="custom-upload-grid">
        <view class="custom-upload-item" @click="chooseCustomImage('avatarUrl')">
          <image v-if="customForm.avatarUrl" class="custom-upload-image" :src="customForm.avatarUrl" mode="aspectFill"></image>
          <text v-else>上传头像</text>
        </view>
        <view class="custom-upload-item" @click="chooseCustomImage('frontImageUrl')">
          <image v-if="customForm.frontImageUrl" class="custom-upload-image" :src="customForm.frontImageUrl" mode="aspectFill"></image>
          <text v-else>上传正脸</text>
        </view>
        <view class="custom-upload-item" @click="chooseCustomImage('sideImageUrl')">
          <image v-if="customForm.sideImageUrl" class="custom-upload-image" :src="customForm.sideImageUrl" mode="aspectFill"></image>
          <text v-else>上传侧脸</text>
        </view>
        <view class="custom-upload-item" @click="chooseCustomImage('fullBodyImageUrl')">
          <image v-if="customForm.fullBodyImageUrl" class="custom-upload-image" :src="customForm.fullBodyImageUrl" mode="aspectFill"></image>
          <text v-else>上传全身</text>
        </view>
      </view>
      <view class="custom-field-row">
        <input v-model.trim="customForm.name" class="custom-input" placeholder="模特名称" />
        <input v-model.trim="customForm.height" class="custom-input" placeholder="身高，如 168cm" />
      </view>
      <view class="custom-field-row">
        <input v-model.trim="customForm.ageRange" class="custom-input" placeholder="年龄，如 25" />
        <input v-model.trim="customForm.bodyType" class="custom-input" placeholder="体型，如 标准" />
      </view>
      <textarea v-model.trim="customForm.modelPrompt" class="custom-textarea" placeholder="固定描述，如：25岁亚洲女性商业模特，鹅蛋脸，黑色长发，165cm，标准身材，职业气质。" />
      <button class="custom-save-button" @click="saveCustomModel">保存我的模特</button>
    </view>

    <view v-if="!visibleModels.length" class="empty-card">
      <text class="empty-title">{{ activeTab === 'mine' ? '还没有专属模特' : '暂无匹配模特' }}</text>
      <text class="empty-desc">{{ activeTab === 'mine' ? '后续可在这里管理为品牌定制的专属模特。' : '请调整筛选条件后再查看。' }}</text>
    </view>

    <view v-if="selectedModel" class="detail-panel">
      <view class="detail-cover">
        <image v-if="getModelAvatar(selectedModel)" class="detail-image" :src="getModelAvatar(selectedModel)" mode="aspectFill" @error="markImageFailed(selectedModel, 'avatarUrl')"></image>
        <view v-else class="detail-placeholder">
          <text>{{ selectedModel.name.slice(0, 1) }}</text>
        </view>
      </view>
      <view class="detail-content">
        <text class="detail-title">{{ selectedModel.name }}</text>
        <text class="detail-meta">{{ getGenderLabel(selectedModel.gender) }} · {{ selectedModel.ageRange }} · {{ selectedModel.height || '身高未设' }} · {{ selectedModel.bodyType }} · {{ selectedModel.region }}</text>
        <view class="reference-grid">
          <view v-for="item in referenceImages" :key="item.key" class="reference-card">
            <image v-if="item.url" class="reference-image" :src="item.url" mode="aspectFill" @error="markImageFailed(selectedModel, item.key)"></image>
            <view v-else class="reference-empty"><text>{{ item.label }}</text></view>
            <text class="reference-label">{{ item.label }}</text>
          </view>
        </view>
        <view class="detail-section">
          <text class="detail-label">固定描述</text>
          <text class="detail-prompt">{{ selectedModel.modelPrompt || '暂无固定描述' }}</text>
        </view>
        <view class="detail-section">
          <text class="detail-label">模特标签</text>
          <view class="tag-row">
            <text v-for="tag in selectedModel.styleTags" :key="tag" class="tag">{{ tag }}</text>
          </view>
        </view>
        <view class="detail-section">
          <text class="detail-label">适用品类</text>
          <view class="tag-row">
            <text v-for="tag in selectedModel.categoryTags" :key="tag" class="tag category">{{ tag }}</text>
          </view>
        </view>
        <view class="detail-section">
          <text class="detail-label">适用场景</text>
          <view class="tag-row">
            <text v-for="tag in selectedModel.sceneTags" :key="tag" class="tag scene">{{ tag }}</text>
          </view>
        </view>
        <button class="select-button" @click="confirmModel">选择该模特</button>
      </view>
    </view>
  </view>
</template>

<script>
import { createCustomModel, getMyModels, getSystemModels } from '../../utils/model/modelLibrary'

const ALL = ''

export default {
  data() {
    return {
      activeTab: 'system',
      filters: {
        gender: ALL,
        ageRange: ALL,
        bodyType: ALL,
        style: ALL
      },
      selectedModel: null,
      systemModels: [],
      myModels: [],
      imageLoadErrors: {},
      customForm: {
        name: '',
        avatarUrl: '',
        frontImageUrl: '',
        sideImageUrl: '',
        fullBodyImageUrl: '',
        gender: 'female',
        ageRange: '',
        height: '',
        bodyType: '',
        skinTone: '',
        faceStyle: '',
        hairStyle: '',
        region: '东亚',
        styleTags: ['品牌专属'],
        categoryTags: ['女装'],
        sceneTags: ['电商棚拍'],
        modelPrompt: ''
      },
      filterGroups: [
        {
          key: 'gender',
          label: '性别',
          options: [
            { label: '全部', value: ALL },
            { label: '女', value: 'female' },
            { label: '男', value: 'male' },
            { label: '童装', value: 'kids' }
          ]
        },
        {
          key: 'ageRange',
          label: '年龄',
          options: [
            { label: '全部', value: ALL },
            { label: '18-25岁', value: '18-25岁' },
            { label: '25-35岁', value: '25-35岁' },
            { label: '35-45岁', value: '35-45岁' }
          ]
        },
        {
          key: 'bodyType',
          label: '身材',
          options: [
            { label: '全部', value: ALL },
            { label: '标准', value: '标准' },
            { label: '高挑', value: '高挑' },
            { label: '微胖', value: '微胖' },
            { label: '大码', value: '大码' }
          ]
        },
        {
          key: 'style',
          label: '风格',
          options: [
            { label: '全部', value: ALL },
            { label: '通勤风', value: '通勤风' },
            { label: '轻熟', value: '轻熟' },
            { label: '国风', value: '国风' },
            { label: '商务', value: '商务' },
            { label: '休闲', value: '休闲' },
            { label: '街拍', value: '街拍' },
            { label: '男童', value: '男童' },
            { label: '女童', value: '女童' }
          ]
        }
      ]
    }
  },
  computed: {
    visibleModels() {
      const source = this.activeTab === 'mine' ? this.myModels : this.systemModels
      if (this.activeTab === 'mine') {
        return source
      }
      return source.filter((model) => {
        const styleTags = Array.isArray(model.styleTags) ? model.styleTags : []
        return (!this.filters.gender || model.gender === this.filters.gender) &&
          (!this.filters.ageRange || model.ageRange === this.filters.ageRange) &&
          (!this.filters.bodyType || model.bodyType === this.filters.bodyType) &&
          (!this.filters.style || styleTags.includes(this.filters.style))
      })
    },
    referenceImages() {
      if (!this.selectedModel) {
        return []
      }
      return [
        { key: 'avatarUrl', label: '标准头像', url: this.getReferenceImageUrl(this.selectedModel, 'avatarUrl') },
        { key: 'frontImageUrl', label: '正脸图', url: this.getReferenceImageUrl(this.selectedModel, 'frontImageUrl') },
        { key: 'fullBodyImageUrl', label: '全身图', url: this.getReferenceImageUrl(this.selectedModel, 'fullBodyImageUrl') }
      ]
    }
  },
  onLoad() {
    this.refreshModels()
  },
  onShow() {
    this.refreshModels()
  },
  methods: {
    refreshModels() {
      this.systemModels = getSystemModels()
      this.myModels = getMyModels()
      if (!this.selectedModel && this.systemModels.length) {
        this.selectedModel = this.systemModels[0]
      }
    },
    setFilter(key, value) {
      this.filters = {
        ...this.filters,
        [key]: value
      }
      this.selectedModel = this.visibleModels[0] || null
    },
    selectModel(model) {
      this.selectedModel = model
    },
    getModelAvatar(model = {}) {
      if (this.imageLoadErrors[this.getImageErrorKey(model, 'avatarUrl')]) {
        return ''
      }
      return model.avatarUrl || model.coverUrl || ''
    },
    getImageErrorKey(model = {}, imageKey = '') {
      return `${model.modelId || 'unknown'}:${imageKey}`
    },
    getReferenceImageUrl(model = {}, imageKey = '') {
      if (this.imageLoadErrors[this.getImageErrorKey(model, imageKey)]) {
        return ''
      }
      return model[imageKey] || ''
    },
    markImageFailed(model = {}, imageKey = '') {
      this.imageLoadErrors = {
        ...this.imageLoadErrors,
        [this.getImageErrorKey(model, imageKey)]: true
      }
    },
    getGenderLabel(value) {
      const map = {
        female: '女',
        male: '男',
        kids: '童装'
      }
      return map[value] || value || '未设定'
    },
    chooseCustomImage(key) {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.customForm = {
            ...this.customForm,
            [key]: paths[0] || ''
          }
        }
      })
    },
    saveCustomModel() {
      if (!this.customForm.name) {
        uni.showToast({
          title: '请填写模特名称',
          icon: 'none'
        })
        return
      }
      const saved = createCustomModel({
        ...this.customForm,
        coverUrl: this.customForm.avatarUrl,
        modelPrompt: this.customForm.modelPrompt || `${this.customForm.ageRange || ''}亚洲女性商业模特，${this.customForm.height || ''}，${this.customForm.bodyType || '标准'}身材，品牌专属气质，适合服装电商展示。`
      })
      this.myModels = getMyModels()
      this.selectedModel = saved
      this.customForm = {
        ...this.customForm,
        name: '',
        avatarUrl: '',
        frontImageUrl: '',
        sideImageUrl: '',
        fullBodyImageUrl: '',
        ageRange: '',
        height: '',
        bodyType: '',
        modelPrompt: ''
      }
      uni.showToast({
        title: '已保存模特',
        icon: 'success'
      })
    },
    confirmModel() {
      if (!this.selectedModel) {
        return
      }
      uni.setStorageSync('diebiandesign_selected_model', this.selectedModel)
      uni.showToast({
        title: '已选择模特',
        icon: 'success'
      })
    }
  }
}
</script>

<style scoped>
.model-library-page {
  min-height: 100vh;
  padding: 28rpx;
  background: #eef2f7;
  box-sizing: border-box;
}

.library-header,
.filter-panel,
.model-card,
.custom-panel,
.empty-card,
.detail-panel {
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18rpx 48rpx rgba(15, 23, 42, 0.08);
  box-sizing: border-box;
}

.library-header {
  padding: 30rpx;
}

.header-kicker,
.header-title,
.header-desc,
.filter-label,
.model-name,
.model-meta,
.detail-title,
.detail-meta,
.detail-label,
.detail-prompt,
.custom-title,
.custom-desc,
.empty-title,
.empty-desc {
  display: block;
}

.header-kicker {
  color: #5b6cff;
  font-size: 23rpx;
  font-weight: 850;
}

.header-title {
  margin-top: 10rpx;
  color: #0f172a;
  font-size: 44rpx;
  font-weight: 950;
}

.header-desc {
  margin-top: 12rpx;
  color: #64748b;
  font-size: 26rpx;
  line-height: 1.6;
}

.library-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 20rpx;
}

.library-tab {
  min-height: 76rpx;
  line-height: 76rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #334155;
  text-align: center;
  font-size: 26rpx;
  font-weight: 850;
}

.library-tab.active {
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.14), rgba(168, 85, 247, 0.12));
  color: #4f46e5;
}

.filter-panel {
  margin-top: 20rpx;
  padding: 22rpx;
}

.filter-row {
  margin-bottom: 18rpx;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-label {
  margin-bottom: 12rpx;
  color: #0f172a;
  font-size: 25rpx;
  font-weight: 900;
}

.filter-scroll {
  white-space: nowrap;
}

.filter-chip-row {
  display: flex;
  gap: 12rpx;
}

.filter-chip {
  flex: 0 0 auto;
  padding: 13rpx 20rpx;
  border-radius: 999rpx;
  background: #f8fafc;
  color: #475569;
  font-size: 24rpx;
  font-weight: 760;
}

.filter-chip.active {
  background: #eef2ff;
  color: #4f46e5;
}

.model-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18rpx;
  margin-top: 20rpx;
}

.model-card {
  display: grid;
  grid-template-columns: 148rpx minmax(0, 1fr);
  gap: 18rpx;
  overflow: hidden;
  padding: 18rpx;
}

.model-card.active {
  border-color: rgba(91, 108, 255, 0.36);
}

.model-cover {
  overflow: hidden;
  width: 148rpx;
  height: 148rpx;
  border-radius: 24rpx;
  background: linear-gradient(145deg, #eef2ff, #ffffff 48%, #f5f3ff);
}

.model-image,
.detail-image {
  width: 100%;
  height: 100%;
}

.model-placeholder,
.detail-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: rgba(79, 70, 229, 0.26);
  font-size: 56rpx;
  font-weight: 950;
}

.model-card-body {
  min-width: 0;
  padding: 4rpx 0;
}

.model-name {
  color: #0f172a;
  font-size: 28rpx;
  font-weight: 900;
}

.model-meta {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 22rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.tag {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 760;
}

.tag.scene {
  background: #f8fafc;
  color: #475569;
}

.tag.category {
  background: #fff7ed;
  color: #c2410c;
}

.custom-panel {
  margin-top: 20rpx;
  padding: 24rpx;
}

.custom-title {
  color: #0f172a;
  font-size: 30rpx;
  font-weight: 950;
}

.custom-desc {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.5;
}

.custom-upload-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.custom-upload-item {
  display: flex;
  overflow: hidden;
  min-height: 132rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx dashed rgba(91, 108, 255, 0.28);
  border-radius: 20rpx;
  background: #f8fafc;
  color: #64748b;
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}

.custom-upload-image {
  width: 100%;
  height: 132rpx;
}

.custom-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.custom-input,
.custom-textarea {
  width: 100%;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 18rpx;
  background: #f8fafc;
  color: #0f172a;
  font-size: 24rpx;
  box-sizing: border-box;
}

.custom-input {
  height: 72rpx;
  padding: 0 18rpx;
}

.custom-textarea {
  min-height: 120rpx;
  margin-top: 14rpx;
  padding: 18rpx;
  line-height: 1.5;
}

.custom-save-button {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  margin-top: 16rpx;
  border-radius: 999rpx;
  background: #0f172a;
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 900;
}

.empty-card {
  margin-top: 20rpx;
  padding: 34rpx;
  text-align: center;
}

.empty-title {
  color: #0f172a;
  font-size: 30rpx;
  font-weight: 900;
}

.empty-desc {
  margin-top: 10rpx;
  color: #64748b;
  font-size: 24rpx;
}

.detail-panel {
  display: grid;
  grid-template-columns: 240rpx minmax(0, 1fr);
  gap: 22rpx;
  margin-top: 20rpx;
  padding: 22rpx;
}

.detail-cover {
  overflow: hidden;
  height: 260rpx;
  border-radius: 22rpx;
  background: linear-gradient(145deg, #eef2ff, #ffffff 48%, #f5f3ff);
}

.detail-title {
  color: #0f172a;
  font-size: 34rpx;
  font-weight: 950;
}

.detail-meta {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
}

.detail-section {
  margin-top: 18rpx;
}

.detail-label {
  color: #0f172a;
  font-size: 24rpx;
  font-weight: 900;
}

.detail-prompt {
  margin-top: 10rpx;
  color: #475569;
  font-size: 24rpx;
  line-height: 1.55;
}

.reference-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}

.reference-card {
  min-width: 0;
}

.reference-image,
.reference-empty {
  width: 100%;
  height: 126rpx;
  border-radius: 18rpx;
  background: linear-gradient(145deg, #eef2ff, #ffffff 48%, #f5f3ff);
}

.reference-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 20rpx;
  font-weight: 800;
}

.reference-label {
  display: block;
  margin-top: 7rpx;
  color: #64748b;
  font-size: 20rpx;
  text-align: center;
}

.select-button {
  width: 100%;
  height: 78rpx;
  line-height: 78rpx;
  margin-top: 20rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #0f172a, #5b6cff 64%, #a855f7);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
}
</style>
