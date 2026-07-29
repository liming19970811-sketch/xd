<template>
  <view class="container">
    <view class="nav-bar">
      <text class="nav-link" @click="goBack">返回</text>
      <text class="nav-title">{{ pageTitle }}</text>
      <text class="nav-link nav-link-right" @click="goHome">首页</text>
    </view>

    <view v-if="submitSuccess" class="success-card">
      <text class="success-title">{{ successTitle }}</text>
      <text class="success-desc">
        {{ submitMode === 'mock' ? '当前已在本地保存提交记录。' : successDescription }}
      </text>
      <text class="success-meta">线索编号：{{ submittedLeadId || '暂无' }}</text>
      <view class="action-row">
        <button class="action-btn primary" @click="goHome">返回首页</button>
        <button v-if="canReturnToResult" class="action-btn secondary" @click="goBackToResult">查看结果页</button>
      </view>
    </view>

    <view v-else>
      <view class="intro-card">
        <text class="section-title">{{ introTitle }}</text>
        <text class="section-desc">
          {{ introDescription }}
        </text>
      </view>

      <view v-if="currentResultAttachment" class="context-card">
        <text class="section-title">当前结果图参考</text>
        <text class="section-desc">可以直接把当前结果图带入本次需求，作为参考资料一起提交。</text>
        <image class="context-image" :src="currentResultAttachment.fileUrl" mode="aspectFill"></image>
        <button class="action-btn secondary" @click="useCurrentResultAttachment">
          {{ hasCurrentResultAttached ? '已加入参考资料' : '使用当前结果图' }}
        </button>
      </view>

      <view class="form-card section-card">
        <text class="card-title">基础信息</text>
        <view class="field-block">
          <text class="field-label">联系人</text>
          <input v-model.trim="form.contactName" class="input" placeholder="请输入联系人姓名" placeholder-class="input-placeholder" />
        </view>
        <view class="field-block">
          <text class="field-label">手机号</text>
          <input v-model.trim="form.mobile" class="input" type="number" placeholder="请输入手机号" placeholder-class="input-placeholder" />
        </view>
        <view class="field-block">
          <text class="field-label">公司/店铺名</text>
          <input v-model.trim="form.companyName" class="input" placeholder="选填，便于我们了解业务场景" placeholder-class="input-placeholder" />
        </view>
      </view>

      <view class="form-card section-card">
        <text class="card-title">需求信息</text>
        <view class="field-block">
          <text class="field-label">预算范围</text>
          <picker :range="budgetOptions" :value="budgetIndex" @change="onBudgetChange">
            <view class="picker-field">{{ form.budgetRange || '请选择预算范围' }}</view>
          </picker>
        </view>
        <view class="field-block">
          <text class="field-label">期望交付时间</text>
          <picker mode="date" :value="form.expectedDeliveryDate" @change="onDeliveryDateChange">
            <view class="picker-field">{{ form.expectedDeliveryDate || '请选择日期' }}</view>
          </picker>
        </view>
        <view class="field-block">
          <text class="field-label">是否需要样品</text>
          <view class="choice-row">
            <button
              class="choice-btn"
              :class="{ active: form.needSample }"
              @click="setNeedSample(true)"
            >
              需要
            </button>
            <button
              class="choice-btn"
              :class="{ active: !form.needSample }"
              @click="setNeedSample(false)"
            >
              不需要
            </button>
          </view>
        </view>
      </view>

      <view class="form-card section-card">
        <text class="card-title">补充说明</text>
        <view class="field-block">
          <text class="field-label">需求说明</text>
          <textarea
            v-model.trim="form.requirementText"
            class="textarea"
            placeholder="请描述希望修改的方向、使用场景、目标效果等"
            placeholder-class="input-placeholder"
          />
        </view>
        <view class="attachment-block">
          <view class="attachment-head">
            <text class="section-title">参考资料上传</text>
            <button class="mini-btn" :disabled="uploading" @click="chooseAttachments">
              {{ uploading ? '上传中...' : '上传图片' }}
            </button>
          </view>
          <text v-if="attachments.length" class="attachment-summary">
            已添加 {{ attachments.length }} 张参考图，已上传 {{ uploadedAttachmentCount }} 张
          </text>

          <view v-if="attachments.length" class="attachment-list">
            <view v-for="(item, index) in attachments" :key="item.key" class="attachment-item">
              <image class="attachment-image" :src="item.fileUrl || item.localPath" mode="aspectFill"></image>
              <view class="attachment-meta">
                <text class="attachment-name">{{ item.name }}</text>
                <text class="attachment-status">{{ item.fileId ? '已上传' : (item.source === 'task_result' ? '结果图参考' : '待上传') }}</text>
              </view>
              <button class="remove-btn" @click="removeAttachment(index)">删除</button>
            </view>
          </view>
          <text v-else class="attachment-empty">暂未添加参考资料</text>
        </view>

      </view>
    </view>

    <view v-if="!submitSuccess" class="submit-bar">
      <button class="submit-btn fixed-submit-btn" :disabled="submitting || uploading" @click="handleSubmit">
        {{ submitting ? '提交中...' : '提交需求' }}
      </button>
    </view>
  </view>
</template>

<script>
import { getMainChainState } from '../../utils/mainChainState'
import { uploadImage } from '../../utils/api/upload'
import { submitLead } from '../../utils/api/leads'

const BUDGET_OPTIONS = [
  '5千以内',
  '5千 - 1万',
  '1万 - 3万',
  '3万 - 10万',
  '10万以上'
]

function createAttachmentItem(overrides = {}) {
  return {
    key: `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '参考图片',
    localPath: '',
    fileId: '',
    fileUrl: '',
    source: 'upload',
    ...overrides
  }
}

function normalizeMobile(value) {
  return String(value || '').replace(/\s+/g, '')
}

function hasWxCloudUpload() {
  return (
    typeof wx !== 'undefined' &&
    wx &&
    wx.cloud &&
    typeof wx.cloud.uploadFile === 'function'
  )
}

function getFileName(filePath = '') {
  const cleanPath = String(filePath || '').split('?')[0]
  const matched = cleanPath.match(/[^/\\]+$/)
  return matched && matched[0] ? matched[0] : `image_${Date.now()}.jpg`
}

function isTemporaryCloudUrl(url = '') {
  const value = String(url || '')
  return value.includes('tcb.qcloud.la') || value.includes('tmp')
}

async function getCloudFileUrl(fileId) {
  if (
    !fileId ||
    typeof wx === 'undefined' ||
    !wx ||
    !wx.cloud ||
    typeof wx.cloud.getTempFileURL !== 'function'
  ) {
    return fileId
  }

  try {
    const tempResult = await wx.cloud.getTempFileURL({
      fileList: [fileId]
    })
    const fileItem = tempResult && Array.isArray(tempResult.fileList) ? tempResult.fileList[0] : null
    return (fileItem && (fileItem.tempFileURL || fileItem.fileID)) || fileId
  } catch (error) {
    console.log('[leads:submit] attachment temp url failed', {
      errorCode: (error && (error.errCode || error.code)) || 'temp_url_failed'
    })
    return fileId
  }
}

async function uploadLeadAttachment(filePath) {
  try {
    console.log('[leads:submit] attachment upload api attempt')
    return await uploadImage({
      filePath,
      scene: 'lead_attachment'
    })
  } catch (apiError) {
    console.log('[leads:submit] attachment upload api failed', {
      errorCode: (apiError && (apiError.errorCode || apiError.code)) || 'api_upload_failed'
    })
    if (!hasWxCloudUpload()) {
      throw apiError
    }

    const cloudPath = `lead-attachments/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${getFileName(filePath)}`
    console.log('[leads:submit] attachment upload cloud attempt', {
      hasCloudPath: Boolean(cloudPath)
    })
    const cloudResult = await wx.cloud.uploadFile({
      cloudPath,
      filePath
    })
    const fileId = cloudResult && cloudResult.fileID ? cloudResult.fileID : ''
    if (!fileId) {
      throw new Error('云存储上传未返回 fileID')
    }
    const fileUrl = await getCloudFileUrl(fileId)
    console.log('[leads:submit] attachment upload cloud success', {
      hasFileId: Boolean(fileId),
      hasFileUrl: Boolean(fileUrl)
    })
    return {
      fileId,
      fileUrl,
      raw: cloudResult
    }
  }
}

export default {
  data() {
    return {
      chainState: getMainChainState(),
      submitting: false,
      uploading: false,
      submitSuccess: false,
      submitMode: '',
      submittedLeadId: '',
      fromTaskId: '',
      requestMode: 'design_service',
      sourcePage: 'service-request',
      form: {
        contactName: '',
        mobile: '',
        companyName: '',
        demandType: 'design_service',
        budgetRange: '',
        expectedDeliveryDate: '',
        needSample: false,
        requirementText: '',
        attachmentFileIds: []
      },
      attachments: [],
      budgetOptions: BUDGET_OPTIONS
    }
  },
  onLoad(query) {
    this.refreshState()
    const allowedDemandTypes = ['design_service', 'enterprise_cooperation', 'support_request']
    const demandType = query && query.demandType ? decodeURIComponent(query.demandType) : 'design_service'
    this.requestMode = allowedDemandTypes.includes(demandType) ? demandType : 'design_service'
    this.sourcePage = query && query.sourcePage ? decodeURIComponent(query.sourcePage) : 'service-request'
    this.form.demandType = this.requestMode
    const taskIdFromQuery = query && query.taskId ? decodeURIComponent(query.taskId) : ''
    this.fromTaskId = taskIdFromQuery || this.currentTaskIdValue || ''
    if (query && query.useCurrentResult === '1') {
      this.useCurrentResultAttachment()
    }
  },
  computed: {
    pageTitle() {
      if (this.requestMode === 'support_request') return '服务留言'
      if (this.requestMode === 'enterprise_cooperation') return '企业合作'
      return '提交设计需求'
    },
    introTitle() {
      return this.requestMode === 'support_request' ? '问题与意见反馈' : '一对一设计协作'
    },
    introDescription() {
      if (this.requestMode === 'support_request') return '填写遇到的问题和联系方式，我们会根据提交信息跟进。'
      if (this.requestMode === 'enterprise_cooperation') return '填写企业目标、预算和交付预期，我们会跟进批量生产与人工服务需求。'
      return '填写你的目标、预算和交付预期，我们会从 AI 结果继续承接到人工设计服务。'
    },
    successTitle() {
      return this.requestMode === 'support_request' ? '留言已提交' : '需求已提交'
    },
    successDescription() {
      return this.requestMode === 'support_request'
        ? '我们已收到你的留言，稍后会尽快跟进。'
        : '我们已收到你的设计需求，稍后会尽快跟进。'
    },
    currentTaskIdValue() {
      return this.chainState.currentTaskId || this.chainState.taskId || this.chainState.lastTaskId || ''
    },
    currentTaskValue() {
      const taskId = this.fromTaskId || this.currentTaskIdValue
      return (taskId && this.chainState.tasks && this.chainState.tasks.byId && this.chainState.tasks.byId[taskId]) || null
    },
    currentResultAttachment() {
      const task = this.currentTaskValue || {}
      const result = task.result || {}
      const resultItems = Array.isArray(result.items) ? result.items : []
      const fileUrl = result.coverUrl || ((resultItems[0] && resultItems[0].fileUrl) || '')
      if (!fileUrl) {
        return null
      }
      return createAttachmentItem({
        key: `task_result_${task.taskId || this.fromTaskId || 'current'}`,
        name: '当前结果图',
        fileUrl,
        fileId: (resultItems[0] && resultItems[0].fileId) || '',
        source: 'task_result'
      })
    },
    hasCurrentResultAttached() {
      const current = this.currentResultAttachment
      if (!current) {
        return false
      }
      return this.attachments.some((item) => item.fileUrl === current.fileUrl || (item.fileId && item.fileId === current.fileId))
    },
    uploadedAttachmentCount() {
      return this.attachments.filter((item) => item.fileId || item.fileUrl).length
    },
    budgetIndex() {
      const index = this.budgetOptions.indexOf(this.form.budgetRange)
      return index >= 0 ? index : 0
    },
    canReturnToResult() {
      return !!(this.fromTaskId || this.currentTaskIdValue)
    }
  },
  methods: {
    refreshState() {
      this.chainState = getMainChainState()
    },
    goBack() {
      uni.navigateBack({
        fail: () => {
          this.goHome()
        }
      })
    },
    goHome() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    },
    goBackToResult() {
      const taskId = this.fromTaskId || this.currentTaskIdValue
      if (!taskId) {
        this.goHome()
        return
      }
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`
      })
    },
    onBudgetChange(event) {
      const index = Number(event.detail.value)
      this.form.budgetRange = this.budgetOptions[index] || this.form.budgetRange
    },
    onDeliveryDateChange(event) {
      this.form.expectedDeliveryDate = event.detail.value || ''
    },
    syncAttachmentFileIds() {
      this.form.attachmentFileIds = this.attachments.map((item) => item.fileId).filter(Boolean)
    },
    useCurrentResultAttachment() {
      if (!this.currentResultAttachment || this.hasCurrentResultAttached) {
        return
      }
      this.attachments = [this.currentResultAttachment, ...this.attachments]
      this.syncAttachmentFileIds()
    },
    async chooseAttachments() {
      if (this.uploading) {
        return
      }

      uni.chooseImage({
        count: 6,
        success: async (res) => {
          const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
          if (!paths.length) {
            return
          }
          this.uploading = true
          try {
            for (let index = 0; index < paths.length; index += 1) {
              const localPath = paths[index]
              const uploaded = await uploadLeadAttachment(localPath)

              this.attachments.push(createAttachmentItem({
                name: `参考图片 ${this.attachments.length + 1}`,
                localPath,
                fileId: uploaded.fileId,
                fileUrl: uploaded.fileUrl,
                source: 'upload'
              }))
            }
            this.syncAttachmentFileIds()
            uni.showToast({
              title: `已上传${paths.length}张图片`,
              icon: 'none'
            })
          } catch (error) {
            console.log('[leads:submit] attachment upload failed', {
              errorCode: (error && (error.errorCode || error.code)) || 'attachment_upload_failed'
            })
            uni.showToast({
              title: (error && error.message) || '上传失败',
              icon: 'none'
            })
          } finally {
            this.uploading = false
          }
        }
      })
    },
    removeAttachment(index) {
      this.attachments = this.attachments.filter((_, itemIndex) => itemIndex !== index)
      this.syncAttachmentFileIds()
    },
    setNeedSample(value) {
      this.form.needSample = !!value
    },
    validateForm() {
      if (!this.form.contactName) {
        return '请填写联系人'
      }
      if (!normalizeMobile(this.form.mobile)) {
        return '请填写手机号'
      }
      if (!/^1\d{10}$/.test(normalizeMobile(this.form.mobile))) {
        return '手机号格式不正确'
      }
      if (!this.form.requirementText) {
        return '请填写需求说明'
      }
      return ''
    },
    async handleSubmit() {
      if (this.submitting || this.uploading || this.submitSuccess) return
      const errorMessage = this.validateForm()
      if (errorMessage) {
        uni.showToast({
          title: errorMessage,
          icon: 'none'
        })
        return
      }

      this.submitting = true
      try {
        this.syncAttachmentFileIds()
        const attachmentUrls = this.attachments
          .map((item) => item.fileUrl)
          .filter((url) => url && !isTemporaryCloudUrl(url))
        const referenceImages = this.attachments
          .map((item) => item.fileId || item.fileUrl || item.localPath)
          .filter(Boolean)
        console.log('[leads:submit] service-request submit start', {
          attachmentCount: referenceImages.length,
          demandType: this.form.demandType,
          submitting: true
        })
        const result = await submitLead({
          contactName: this.form.contactName,
          mobile: normalizeMobile(this.form.mobile),
          wechat: '',
          companyName: this.form.companyName,
          demandType: this.form.demandType,
          budgetRange: this.form.budgetRange,
          expectedDeliveryDate: this.form.expectedDeliveryDate,
          needSample: this.form.needSample,
          requirementText: this.form.requirementText,
          attachmentFileIds: this.form.attachmentFileIds,
          attachmentUrls,
          referenceImages,
          source: 'miniapp',
          sourceChannel: 'miniapp',
          sourcePage: this.sourcePage,
          taskId: this.fromTaskId || '',
          resultImageUrl: this.currentResultAttachment ? this.currentResultAttachment.fileUrl : ''
        })
        console.log('[leads:submit] service-request submit result', {
          mode: result && result.mode,
          source: result && result.source,
          success: Boolean(result && result.lead),
          hasLeadId: Boolean(result && result.lead && result.lead.leadId)
        })

        this.submitMode = result.mode || 'mock'
        this.submitSuccess = true
        this.submittedLeadId = (result.lead && result.lead.leadId) || ''
        uni.showToast({
          title: this.submitMode === 'mock' ? '提交成功（演示）' : '提交成功',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: (error && error.message) || '提交失败',
          icon: 'none'
        })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24rpx 24rpx 180rpx;
  box-sizing: border-box;
}

.nav-bar,
.intro-card,
.context-card,
.form-card,
.success-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
}

.nav-link {
  font-size: 26rpx;
  color: #1677ff;
  line-height: 1.5;
}

.nav-link-right {
  text-align: right;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #222;
  flex: 1;
  text-align: center;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #222;
}

.section-desc,
.success-desc,
.success-meta,
.attachment-empty {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
}

.context-image {
  width: 100%;
  height: 300rpx;
  margin-top: 16rpx;
  border-radius: 16rpx;
  background: #f0f0f0;
}

.section-card {
  margin-bottom: 20rpx;
}

.card-title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #222;
}

.field-block {
  margin-bottom: 20rpx;
}

.field-block:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
}

.input,
.picker-field,
.textarea {
  width: 100%;
  background: #f5f7fa;
  border-radius: 16rpx;
  padding: 24rpx 20rpx;
  box-sizing: border-box;
  font-size: 30rpx;
  color: #222;
  line-height: 1.5;
  min-height: 96rpx;
  border: 2rpx solid #e6ebf2;
  overflow: visible;
  white-space: normal;
}

.textarea {
  min-height: 240rpx;
  padding-top: 24rpx;
  padding-bottom: 24rpx;
}

.input-placeholder {
  color: #98a2b3;
  font-size: 28rpx;
  line-height: 1.5;
}

.choice-row {
  display: flex;
  gap: 16rpx;
}

.choice-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  background: #f5f7fa;
  color: #667085;
  border: 2rpx solid #e6ebf2;
  font-size: 28rpx;
}

.choice-btn.active {
  background: #eef6ff;
  color: #1677ff;
  border-color: #b6d7ff;
}

.attachment-block {
  margin-top: 24rpx;
  margin-bottom: 20rpx;
}

.attachment-head,
.action-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 16rpx;
}

.attachment-summary {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #1677ff;
  line-height: 1.5;
}

.attachment-item {
  display: flex;
  gap: 12rpx;
  align-items: center;
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 12rpx;
}

.attachment-image {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.attachment-meta {
  flex: 1;
  min-width: 0;
}

.attachment-name,
.attachment-status {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.attachment-name {
  color: #222;
  font-weight: 600;
}

.submit-btn,
.action-btn,
.mini-btn,
.remove-btn {
  border-radius: 999rpx;
}

.submit-btn,
.action-btn {
  margin-top: 16rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 28rpx;
  border: none;
}

.action-btn {
  flex: 1;
}

.primary {
  background: #1677ff;
  color: #fff;
}

.secondary,
.mini-btn {
  background: #eef6ff;
  color: #1677ff;
  border: 2rpx solid #b6d7ff;
}

.mini-btn,
.remove-btn {
  height: 64rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
}

.remove-btn {
  background: #fff2f0;
  color: #cf1322;
  border: 2rpx solid #ffccc7;
}

.success-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #222;
}

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(245, 247, 250, 0.96);
  box-sizing: border-box;
}

.fixed-submit-btn {
  margin-top: 0;
  width: 100%;
  box-shadow: 0 10rpx 24rpx rgba(22, 119, 255, 0.18);
}
</style>
