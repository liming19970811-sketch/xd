<template>
  <view class="page">
    <view class="intro">
      <text class="intro-title">我的常用模特</text>
      <text class="intro-desc">保存你已获得授权的人像参考图，在换模特和批量制作时重复使用。</text>
      <text class="privacy-note">仅本人可见，不公开、不用于训练，也不会自动加入系统人像库。</text>
    </view>

    <view v-if="loading" class="state-card">正在加载常用模特...</view>
    <view v-else-if="errorMessage" class="state-card error">
      <text>{{ errorMessage }}</text><button class="text-button" @click="loadProfiles">重新加载</button>
    </view>
    <view v-else-if="!profiles.length && !editing" class="state-card empty">
      <text class="state-title">还没有常用模特</text>
      <text>上传经过授权的人像，下次可直接选择使用。</text>
      <button class="primary-button compact" @click="startCreate">添加常用模特</button>
    </view>

    <view v-else-if="!editing" class="profile-list">
      <view v-for="profile in profiles" :key="profile.modelProfileId" class="profile-card">
        <image v-if="profile.coverUrl" class="profile-cover" :src="profile.coverUrl" mode="aspectFill" />
        <view v-else class="profile-cover placeholder">模</view>
        <view class="profile-main">
          <view class="profile-title-row"><text class="profile-name">{{ profile.name }}</text><text v-if="profile.isDefault" class="default-tag">默认</text></view>
          <text class="profile-meta">{{ 1 + (profile.referenceFileIds || []).length }} 张参考图 · 私有素材</text>
          <text v-if="profile.note" class="profile-note">{{ profile.note }}</text>
          <view class="profile-actions">
            <button v-if="selectMode" class="small-button primary" @click="selectProfile(profile)">选择使用</button>
            <button class="small-button" @click="editProfile(profile)">编辑</button>
            <button v-if="!profile.isDefault" class="small-button" @click="makeDefault(profile)">设为默认</button>
            <button class="small-button" @click="archiveProfileItem(profile)">归档</button>
            <button class="small-button danger" @click="removeProfile(profile)">删除</button>
          </view>
        </view>
      </view>
    </view>

    <view v-if="editing" class="editor">
      <view class="section-card">
        <view class="section-head"><text class="section-title">模特名称</text><text class="required">必填</text></view>
        <input v-model="form.name" class="input" maxlength="60" placeholder="例如：小雅｜女装日常" />
        <text class="field-label">备注（可选）</text>
        <textarea v-model="form.note" class="textarea" maxlength="300" placeholder="记录适合的品类或使用场景" />
      </view>

      <view class="section-card">
        <view class="section-head"><view><text class="section-title">人像参考图</text><text class="section-desc">1 张主参考图，最多再添加 2 张补充图</text></view><text class="required">必填</text></view>
        <view class="image-grid">
          <view v-for="(image, index) in images" :key="image.fileId || image.localPath || index" class="image-card">
            <image class="reference-image" :src="image.previewUrl" mode="aspectFill" />
            <text class="image-role">{{ index === 0 ? '主参考图' : `补充图 ${index}` }}</text>
            <button class="remove-image" @click="removeImage(index)">删除</button>
          </view>
          <view v-if="images.length < 3" class="image-upload" :class="{ disabled: uploading }" @click="chooseImages">
            <text class="plus">+</text><text>{{ uploading ? '上传中...' : '添加人像' }}</text>
          </view>
        </view>
        <text class="upload-tip">支持 JPG、PNG、WEBP；建议不低于 512×512，正面或轻微侧脸且五官无遮挡。</text>
        <text v-if="uploadError" class="field-error">{{ uploadError }}</text>
      </view>

      <view class="section-card consent-card">
        <view class="check-row" @click="form.imageQualityConfirmed = !form.imageQualityConfirmed"><text :class="['check-box', { checked: form.imageQualityConfirmed }]">{{ form.imageQualityConfirmed ? '✓' : '' }}</text><text>我已确认图片清晰，人物正面或轻微侧脸，五官无遮挡。</text></view>
        <view class="check-row" @click="form.consentConfirmed = !form.consentConfirmed"><text :class="['check-box', { checked: form.consentConfirmed }]">{{ form.consentConfirmed ? '✓' : '' }}</text><text>{{ consentText }}</text></view>
        <text class="privacy-note">训练授权固定关闭；账户头像不会自动成为模特参考图。</text>
      </view>

      <view class="editor-actions"><button class="secondary-button" :disabled="saving" @click="cancelEdit">取消</button><button class="primary-button" :disabled="!canSave" @click="saveProfile">{{ saving ? '保存中...' : '保存常用模特' }}</button></view>
    </view>

    <button v-if="!editing && profiles.length" class="floating-add" @click="startCreate">添加常用模特</button>
    <view class="bottom-safe"></view>
  </view>
</template>

<script>
import { uploadUnifiedFile } from '../../utils/upload/unifiedUploadService.js'
import {
  MODEL_PROFILE_CONSENT_TEXT,
  MODEL_PROFILE_SELECTION_KEY,
  archiveModelProfile,
  deleteModelProfile,
  getModelProfiles,
  saveModelProfile,
  setDefaultModelProfile,
  updateModelProfile
} from '../../utils/model/modelProfileRepository.js'

const MAX_BYTES = 10 * 1024 * 1024
const MIN_SIDE = 512
const ALLOWED_TYPES = ['jpg', 'jpeg', 'png', 'webp']

export default {
  data() {
    return {
      profiles: [], loading: false, errorMessage: '', editing: false, editingId: '', selectMode: false,
      images: [], uploading: false, saving: false, uploadError: '', consentText: MODEL_PROFILE_CONSENT_TEXT,
      form: { name: '', note: '', consentConfirmed: false, imageQualityConfirmed: false }
    }
  },
  computed: {
    canSave() {
      return !this.saving && !this.uploading && this.form.name.trim() && this.images.length > 0 && this.form.consentConfirmed && this.form.imageQualityConfirmed
    }
  },
  onLoad(query = {}) { this.selectMode = String(query.select || '') === '1' },
  onShow() { if (!this.editing) this.loadProfiles() },
  onPullDownRefresh() { this.loadProfiles().finally(() => uni.stopPullDownRefresh()) },
  methods: {
    async loadProfiles() {
      if (this.loading) return
      this.loading = true; this.errorMessage = ''
      const result = await getModelProfiles({ scope: 'personal' })
      this.loading = false
      if (!result.ok) { this.errorMessage = result.message || '常用模特加载失败。'; return }
      this.profiles = (result.data && result.data.profiles) || []
    },
    resetForm() {
      this.editingId = ''; this.images = []; this.uploadError = ''
      this.form = { name: '', note: '', consentConfirmed: false, imageQualityConfirmed: false }
    },
    startCreate() { this.resetForm(); this.editing = true },
    editProfile(profile) {
      this.editingId = profile.modelProfileId
      this.form = { name: profile.name || '', note: profile.note || '', consentConfirmed: false, imageQualityConfirmed: false }
      const fileIds = [profile.coverFileId, ...(profile.referenceFileIds || [])]
      const urls = [profile.coverUrl, ...(profile.referenceUrls || [])]
      this.images = fileIds.map((fileId, index) => ({ fileId, previewUrl: urls[index] || '', meta: {} }))
      this.editing = true
    },
    cancelEdit() { this.editing = false; this.resetForm() },
    imageInfo(path) { return new Promise((resolve, reject) => uni.getImageInfo({ src: path, success: resolve, fail: reject })) },
    async validateImage(file, path) {
      const clean = String(path || '').split('?')[0]
      const match = clean.match(/\.([a-z0-9]+)$/i)
      const ext = match ? match[1].toLowerCase() : ''
      if (ext && !ALLOWED_TYPES.includes(ext)) throw new Error('仅支持 JPG、PNG 或 WEBP 图片。')
      if (Number(file.size || 0) > MAX_BYTES) throw new Error('单张图片不能超过 10MB。')
      let info
      try { info = await this.imageInfo(path) } catch (error) { throw new Error('无法读取图片，请重新选择。') }
      const type = String(info.type || ext || '').toLowerCase().replace('jpeg', 'jpg')
      if (type && !ALLOWED_TYPES.map((item) => item.replace('jpeg', 'jpg')).includes(type)) throw new Error('仅支持 JPG、PNG 或 WEBP 图片。')
      if (Number(info.width || 0) < MIN_SIDE || Number(info.height || 0) < MIN_SIDE) throw new Error('图片分辨率过低，宽高均需至少 512px。')
      return { width: Number(info.width || 0), height: Number(info.height || 0), size: Number(file.size || 0), type }
    },
    chooseImages() {
      if (this.uploading || this.images.length >= 3) return
      uni.chooseImage({ count: 3 - this.images.length, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: (result) => this.uploadImages(result) })
    },
    async uploadImages(result = {}) {
      const paths = result.tempFilePaths || []
      const files = result.tempFiles || []
      this.uploading = true; this.uploadError = ''
      for (let index = 0; index < paths.length && this.images.length < 3; index += 1) {
        const path = paths[index]
        const file = { ...(files[index] || {}), path }
        try {
          const meta = await this.validateImage(file, path)
          const uploaded = await uploadUnifiedFile(file, { assetType: 'model_reference', targetType: 'model_profile', relation: this.images.length ? 'supplement_reference' : 'cover_reference', permissionScope: 'private', source: 'model_profile' })
          if (!uploaded.success || !/^cloud:\/\//i.test(String(uploaded.fileId || ''))) throw new Error(uploaded.message || '图片上传失败，请重试。')
          this.images.push({ fileId: uploaded.fileId, previewUrl: uploaded.tempUrl || path, meta })
        } catch (error) { this.uploadError = error.message || '图片上传失败，请重试。'; break }
      }
      this.uploading = false
    },
    removeImage(index) { this.images.splice(index, 1) },
    async saveProfile() {
      if (!this.canSave) return
      this.saving = true
      const payload = {
        name: this.form.name.trim(), note: this.form.note.trim(), coverFileId: this.images[0].fileId,
        referenceFileIds: this.images.slice(1).map((item) => item.fileId), scope: 'personal', consentConfirmed: true,
        consentText: this.consentText, imageQualityConfirmed: true, trainingAllowed: false
      }
      const result = this.editingId ? await updateModelProfile(this.editingId, payload) : await saveModelProfile(payload)
      this.saving = false
      if (!result.ok) { uni.showToast({ title: result.message || '保存失败', icon: 'none' }); return }
      uni.showToast({ title: '常用模特已保存', icon: 'success' }); this.editing = false; this.resetForm(); await this.loadProfiles()
    },
    selectProfile(profile) { uni.setStorageSync(MODEL_PROFILE_SELECTION_KEY, profile); uni.navigateBack() },
    async makeDefault(profile) { const result = await setDefaultModelProfile(profile.modelProfileId); if (!result.ok) return uni.showToast({ title: result.message, icon: 'none' }); await this.loadProfiles() },
    async archiveProfileItem(profile) { const result = await archiveModelProfile(profile.modelProfileId); if (!result.ok) return uni.showToast({ title: result.message, icon: 'none' }); await this.loadProfiles() },
    removeProfile(profile) {
      uni.showModal({ title: '删除常用模特', content: '删除后不能用于新任务，历史任务和结果不会受影响。', confirmColor: '#dc2626', success: async ({ confirm }) => {
        if (!confirm) return
        const result = await deleteModelProfile(profile.modelProfileId)
        if (!result.ok) return uni.showToast({ title: result.message || '删除失败', icon: 'none' })
        uni.showToast({ title: '常用模特已删除', icon: 'success' }); await this.loadProfiles()
      } })
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx; background: #f5f6fa; color: #1d2939; box-sizing: border-box; }
.intro, .section-card, .profile-card, .state-card { border: 1rpx solid #e4e7ec; border-radius: 16px; background: #fff; }
.intro { padding: 28rpx; margin-bottom: 24rpx; }
.intro-title, .section-title, .state-title { display: block; font-size: 32rpx; font-weight: 700; }
.intro-desc, .section-desc, .profile-meta, .profile-note, .upload-tip, .privacy-note, .state-card { display: block; margin-top: 10rpx; color: #667085; font-size: 24rpx; line-height: 1.5; }
.privacy-note { color: #475467; }
.state-card { padding: 48rpx 28rpx; text-align: center; }
.state-card.error { color: #b42318; }.text-button { margin-top: 20rpx; color: #1677ff; background: transparent; }
.profile-list { display: grid; gap: 20rpx; }.profile-card { display: flex; gap: 22rpx; padding: 20rpx; }
.profile-cover { width: 180rpx; height: 220rpx; flex: 0 0 auto; border-radius: 20rpx; background: #eef2ff; }
.profile-cover.placeholder { display: flex; align-items: center; justify-content: center; color: #4758d6; font-size: 56rpx; }
.profile-main { min-width: 0; flex: 1; }.profile-title-row { display: flex; align-items: center; gap: 12rpx; }.profile-name { font-size: 28rpx; font-weight: 700; }
.default-tag { padding: 4rpx 10rpx; border-radius: 8rpx; color: #1677ff; background: #eaf3ff; font-size: 20rpx; }
.profile-note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.profile-actions { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.small-button { min-height: 56rpx; margin: 0; padding: 0 16rpx; color: #344054; background: #f2f4f7; font-size: 22rpx; line-height: 56rpx; }.small-button.primary { color: #fff; background: #1677ff; }.small-button.danger { color: #b42318; }
.editor { display: grid; gap: 20rpx; }.section-card { padding: 28rpx; }.section-head { display: flex; justify-content: space-between; gap: 20rpx; margin-bottom: 20rpx; }.required { color: #d92d20; font-size: 22rpx; }
.field-label { display: block; margin: 22rpx 0 10rpx; font-size: 26rpx; font-weight: 600; }.input, .textarea { width: 100%; box-sizing: border-box; border-radius: 16rpx; background: #f9fafb; font-size: 26rpx; }.input { height: 88rpx; padding: 0 20rpx; }.textarea { height: 160rpx; padding: 20rpx; }
.image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }.image-card, .image-upload { position: relative; min-height: 240rpx; border-radius: 18rpx; overflow: hidden; background: #f2f4f7; }
.reference-image { width: 100%; height: 190rpx; }.image-role { display: block; padding: 10rpx; font-size: 20rpx; text-align: center; }.remove-image { position: absolute; top: 8rpx; right: 8rpx; min-height: 48rpx; padding: 0 12rpx; color: #fff; background: rgba(0,0,0,.58); font-size: 20rpx; line-height: 48rpx; }
.image-upload { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2rpx dashed #98a2b3; color: #475467; font-size: 23rpx; }.image-upload.disabled { opacity: .55; }.plus { font-size: 52rpx; color: #1677ff; }
.field-error { display: block; margin-top: 12rpx; color: #d92d20; font-size: 23rpx; }.check-row { display: flex; align-items: flex-start; gap: 16rpx; margin-bottom: 22rpx; font-size: 24rpx; line-height: 1.5; }.check-box { display: flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; flex: 0 0 auto; border: 2rpx solid #98a2b3; border-radius: 8rpx; }.check-box.checked { color: #fff; border-color: #1677ff; background: #1677ff; }
.editor-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 16rpx; }.primary-button, .secondary-button, .floating-add { min-height: 88rpx; border-radius: 16rpx; font-size: 27rpx; font-weight: 600; }.primary-button, .floating-add { color: #fff; background: #1677ff; }.primary-button[disabled] { color: #fff; opacity: .45; }.secondary-button { color: #344054; background: #eaecf0; }.primary-button.compact { margin-top: 24rpx; padding: 0 28rpx; }
.floating-add { position: fixed; right: 28rpx; bottom: calc(32rpx + env(safe-area-inset-bottom)); padding: 0 30rpx; box-shadow: 0 10rpx 28rpx rgba(22,119,255,.22); }.bottom-safe { height: calc(140rpx + env(safe-area-inset-bottom)); }
</style>
