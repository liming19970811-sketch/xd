<template>
  <view class="container">
    <view class="header-card">
      <text class="title">线索详情</text>
      <text class="subtitle">线索编号：{{ lead.leadId || '-' }}</text>
    </view>

    <view v-if="lead.leadId" class="detail-card">
      <view class="detail-grid">
        <text class="detail-line">公司/店铺：{{ lead.companyName || '暂无' }}</text>
        <text class="detail-line">品牌：{{ lead.brandName || '暂无' }}</text>
        <text class="detail-line">联系人：{{ lead.contactName || '暂无' }}</text>
        <text class="detail-line">手机号：{{ lead.mobile || lead.phone || '暂无' }}</text>
        <text class="detail-line">微信：{{ lead.wechat || '暂无' }}</text>
        <text class="detail-line">邮箱：{{ lead.email || '暂无' }}</text>
        <text class="detail-line">需求类型：{{ lead.demandType || '暂无' }}</text>
        <text class="detail-line">服务范围：{{ formatScope(lead.serviceScope) }}</text>
        <text class="detail-line">产品品类：{{ lead.productCategory || '暂无' }}</text>
        <text class="detail-line">预计数量：{{ lead.expectedVolume || '暂无' }}</text>
        <text class="detail-line">期望交付：{{ lead.expectedDeliveryDate || lead.expectedDeliveryTime || '暂无' }}</text>
        <text class="detail-line">预算范围：{{ lead.budgetRange || '暂无' }}</text>
        <text class="detail-line">附件：{{ formatAttachmentFileIds(lead.attachmentFileIds) }}</text>
        <text class="detail-line">参考图：{{ formatReferenceImages(lead.referenceImages) }}</text>
        <text class="detail-line">需要样衣：{{ lead.needSample ? '需要' : '不需要' }}</text>
        <text class="detail-line">来源：{{ lead.source || 'website' }}</text>
        <text class="detail-line">来源页面：{{ lead.sourcePage || 'website-demand' }}</text>
        <text class="detail-line">跟进状态：{{ getFollowStatusLabel(lead.followStatus) }}</text>
        <text class="detail-line">创建时间：{{ lead.createdAt || '-' }}</text>
        <text class="detail-line">更新时间：{{ lead.updatedAt || '-' }}</text>
      </view>

      <view class="desc-block">
        <text class="desc-title">需求说明</text>
        <text class="desc-content">{{ lead.requirementText || lead.description || '暂无需求说明' }}</text>
      </view>

      <view v-if="referenceImageUrls.length" class="image-block">
        <text class="desc-title">参考图片</text>
        <view class="image-grid">
          <image
            v-for="(url, index) in referenceImageUrls"
            :key="`reference-${index}-${url}`"
            :src="url"
            class="lead-thumb"
            mode="aspectFill"
            @load="onLeadImageLoad('reference', index, url)"
            @error="onLeadImageError('reference', index, url, $event)"
            @click="previewLeadImage(referenceImageUrls, index)"
          ></image>
        </view>
      </view>

      <view v-if="attachmentImageUrls.length" class="image-block">
        <text class="desc-title">附件图片</text>
        <view class="image-grid">
          <image
            v-for="(url, index) in attachmentImageUrls"
            :key="`attachment-${index}-${url}`"
            :src="url"
            class="lead-thumb"
            mode="aspectFill"
            @load="onLeadImageLoad('attachment', index, url)"
            @error="onLeadImageError('attachment', index, url, $event)"
            @click="previewLeadImage(attachmentImageUrls, index)"
          ></image>
        </view>
      </view>

      <view class="action-row">
        <picker :range="statusOptionLabels" :value="statusIndex" @change="onStatusChange">
          <view class="action-chip">更新跟进状态：{{ getFollowStatusLabel(lead.followStatus) }}</view>
        </picker>
        <button class="action-btn" @click="onProjectAction">
          {{ hasProject ? '查看项目' : '转为项目' }}
        </button>
      </view>

      <view class="project-link-block">
        <text class="desc-title">关联项目</text>
        <text class="detail-line">是否已转项目：{{ hasProject ? '是' : '否' }}</text>
        <text class="detail-line">项目编号：{{ linkedProject.projectId || '暂无' }}</text>
        <text class="detail-line">项目名称：{{ linkedProject.projectName || '暂无' }}</text>
        <text class="detail-line">项目状态：{{ getLinkedProjectStatusLabel(linkedProject.status) }}</text>
        <text class="detail-line">项目阶段：{{ getLinkedProjectStageLabel(linkedProject.stage) }}</text>
      </view>

      <view class="note-block">
        <text class="desc-title">跟进备注</text>
        <textarea
          v-model.trim="noteInput"
          class="note-input"
          placeholder="记录跟进进展、客户反馈或下一步动作"
        />
        <button class="note-btn" @click="addNote">新增备注</button>

        <view v-if="leadNotes.length" class="note-list">
          <view v-for="note in leadNotes" :key="note.noteId" class="note-item">
            <text class="note-content">{{ note.content }}</text>
            <text class="note-time">{{ note.createdAt }}</text>
          </view>
        </view>
        <text v-else class="note-empty">暂无跟进备注</text>
      </view>
    </view>

    <view v-else class="empty-card">
      <text class="empty-title">未找到线索</text>
      <text class="empty-desc">请返回线索列表并选择有效线索。</text>
    </view>
  </view>
</template>

<script>
import {
  LEAD_FOLLOW_STATUS_DISPLAY,
  getLeadFollowStatusLabel,
  getProjectStageLabel,
  getProjectStatusLabel
} from '../../utils/constants'
import { appendLeadNote, getLeadNotes } from '../../utils/service/leadStore'
import {
  convertAdminLeadToProject,
  getAdminLeadById,
  getAdminLeadProjectState,
  updateAdminLeadFollowStatus
} from '../../utils/service/adminRepository'

const getFollowStatusLabel = getLeadFollowStatusLabel
const FOLLOW_STATUS_OPTIONS = LEAD_FOLLOW_STATUS_DISPLAY

function createEmptyLead() {
  return {
    leadId: '',
    companyName: '',
    brandName: '',
    contactName: '',
    mobile: '',
    phone: '',
    wechat: '',
    email: '',
    demandType: '',
    serviceScope: [],
    productCategory: '',
    expectedVolume: '',
    expectedDeliveryDate: '',
    expectedDeliveryTime: '',
    budgetRange: '',
    attachmentFileIds: [],
    attachmentUrls: [],
    referenceImages: [],
    needSample: false,
    requirementText: '',
    description: '',
    source: 'website',
    sourcePage: 'website-demand',
    followStatus: 'new',
    status: 'new',
    createdAt: '',
    updatedAt: ''
  }
}

export default {
  data() {
    return {
      leadId: '',
      lead: createEmptyLead(),
      statusOptions: FOLLOW_STATUS_OPTIONS,
      hasProject: false,
      linkedProject: {},
      noteInput: '',
      leadNotes: [],
      resolvedReferenceImageUrls: [],
      resolvedAttachmentImageUrls: []
    }
  },
  computed: {
    statusOptionLabels() {
      return this.statusOptions.map((item) => item.label)
    },
    statusIndex() {
      const index = this.statusOptions.findIndex((item) => item.value === this.lead.followStatus)
      return index >= 0 ? index : 0
    },
    referenceImageUrls() {
      return this.resolvedReferenceImageUrls
    },
    attachmentImageUrls() {
      return this.resolvedAttachmentImageUrls
    }
  },
  onLoad(query) {
    this.leadId = query && query.leadId ? decodeURIComponent(query.leadId) : ''
  },
  onShow() {
    this.loadLeadDetail()
  },
  methods: {
    async loadLeadDetail() {
      const lead = await getAdminLeadById(this.leadId, { preferCloud: true })
      this.lead = lead || createEmptyLead()
      console.log('[lead-detail:images] lead image fields', {
        referenceImageCount: Array.isArray(this.lead.referenceImages) ? this.lead.referenceImages.length : 0,
        attachmentUrlCount: Array.isArray(this.lead.attachmentUrls) ? this.lead.attachmentUrls.length : 0,
        attachmentFileCount: Array.isArray(this.lead.attachmentFileIds) ? this.lead.attachmentFileIds.length : 0
      })
      await this.resolveLeadImageUrls()
      const projectState = await getAdminLeadProjectState(this.leadId, { preferCloud: true })
      this.linkedProject = (projectState && projectState.project) || {}
      this.hasProject = !!(projectState && projectState.hasProject)
      this.leadNotes = getLeadNotes(this.leadId)
    },
    formatScope(scope) {
      if (!Array.isArray(scope) || !scope.length) {
        return '暂无'
      }
      return scope.join('、')
    },
    formatAttachmentFileIds(fileIds) {
      if (!Array.isArray(fileIds) || !fileIds.length) {
        return '暂无'
      }
      return `${fileIds.length} 个文件`
    },
    formatReferenceImages(images) {
      if (!Array.isArray(images) || !images.length) {
        return '暂无'
      }
      return `${images.length} 张图片`
    },
    normalizeImageUrls(images) {
      if (!Array.isArray(images)) {
        return []
      }

      return images
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }
          if (!item || typeof item !== 'object') {
            return ''
          }
          return item.url || item.fileUrl || item.tempFileURL || item.path || item.fileID || ''
        })
        .map((url) => String(url || '').trim())
        .filter(Boolean)
    },
    uniqueImageUrls(urls) {
      const result = []
      ;(Array.isArray(urls) ? urls : []).forEach((url) => {
        const value = String(url || '').trim()
        if (value && !result.includes(value)) {
          result.push(value)
        }
      })
      return result
    },
    async resolveLeadImageUrls() {
      const attachmentFileIds = this.normalizeImageUrls(this.lead.attachmentFileIds)
      const referenceImages = this.normalizeImageUrls(this.lead.referenceImages)
      const attachmentUrls = this.normalizeImageUrls(this.lead.attachmentUrls)
      const primaryReferenceImages = this.uniqueImageUrls([
        ...attachmentFileIds,
        ...referenceImages,
        ...attachmentUrls
      ])
      this.resolvedReferenceImageUrls = await this.resolveCloudFileUrls(primaryReferenceImages)
      this.resolvedAttachmentImageUrls = await this.resolveCloudFileUrls(this.uniqueImageUrls([
        ...attachmentFileIds,
        ...attachmentUrls
      ]))
      console.log('[lead-detail:images] resolved image summary', {
        attachmentFileCount: attachmentFileIds.length,
        referenceImageCount: referenceImages.length,
        attachmentUrlCount: attachmentUrls.length,
        primaryReferenceCount: primaryReferenceImages.length,
        resolvedReferenceCount: this.resolvedReferenceImageUrls.length,
        resolvedAttachmentCount: this.resolvedAttachmentImageUrls.length
      })
    },
    async resolveCloudFileUrls(urls) {
      const imageUrls = Array.isArray(urls) ? urls.filter(Boolean) : []
      const cloudFileIds = imageUrls.filter((url) => String(url).indexOf('cloud://') === 0)
      if (!cloudFileIds.length) {
        return imageUrls
      }

      if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
        console.log('[lead-detail:images] getTempFileURL unavailable, keep cloud fileIDs')
        return imageUrls
      }

      try {
        const response = await wx.cloud.getTempFileURL({
          fileList: cloudFileIds
        })
        const tempUrlMap = {}
        const fileList = response && Array.isArray(response.fileList) ? response.fileList : []
        fileList.forEach((item) => {
          if (item && item.fileID && item.tempFileURL) {
            tempUrlMap[item.fileID] = item.tempFileURL
          }
        })
        console.log('[lead-detail:images] getTempFileURL success', {
          requestedCount: cloudFileIds.length,
          resolvedCount: fileList.filter((item) => item && item.tempFileURL).length
        })
        return imageUrls.map((url) => tempUrlMap[url] || url)
      } catch (error) {
        console.log('[lead-detail:images] getTempFileURL failed', {
          errorCode: (error && (error.errCode || error.code)) || 'cloud_file_url_failed'
        })
        return imageUrls
      }
    },
    previewLeadImage(urls, index) {
      const imageUrls = Array.isArray(urls) ? urls.filter(Boolean) : []
      if (!imageUrls.length) {
        return
      }
      uni.previewImage({
        urls: imageUrls,
        current: imageUrls[index] || imageUrls[0]
      })
    },
    onLeadImageLoad(type, index, src) {
      console.log('[lead-detail:images] image load', {
        type,
        index,
        hasSource: Boolean(src)
      })
    },
    onLeadImageError(type, index, src, event) {
      console.log('[lead-detail:images] image error', {
        type,
        index,
        hasSource: Boolean(src),
        hasErrorMessage: Boolean(event && event.detail && event.detail.errMsg)
      })
    },
    getFollowStatusLabel,
    getLinkedProjectStatusLabel(value) {
      return value ? getProjectStatusLabel(value) : '暂无'
    },
    getLinkedProjectStageLabel(value) {
      return value ? getProjectStageLabel(value) : '暂无'
    },
    async onStatusChange(event) {
      if (!this.lead.leadId) {
        return
      }

      const index = Number(event.detail.value)
      const nextStatus = (this.statusOptions[index] && this.statusOptions[index].value) || this.statusOptions[0].value

      try {
        const updated = await updateAdminLeadFollowStatus(this.lead.leadId, nextStatus, { preferCloud: true })
        this.lead =
          (updated && updated.leadId)
            ? updated
            : (updated && updated.data && updated.data.leadId)
              ? updated.data
              : this.lead
        uni.showToast({
          title: '线索状态已更新',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '更新失败',
          icon: 'none'
        })
      }
    },
    async createProject() {
      if (!this.lead.leadId || this.hasProject) {
        return
      }

      try {
        const result = await convertAdminLeadToProject(this.lead.leadId, { preferCloud: true })
        await this.loadLeadDetail()

        if (result && result.duplicated) {
          uni.showToast({
            title: '项目已存在',
            icon: 'none'
          })
          return
        }

        uni.showToast({
          title: '项目已创建',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '创建项目失败',
          icon: 'none'
        })
      }
    },
    goToProjectDetail() {
      if (!this.linkedProject || !this.linkedProject.projectId) {
        return
      }

      uni.navigateTo({
        url: `/package-mobile-enterprise/project-detail/project-detail?projectId=${encodeURIComponent(this.linkedProject.projectId)}`
      })
    },
    async onProjectAction() {
      if (this.hasProject) {
        this.goToProjectDetail()
        return
      }
      await this.createProject()
    },
    addNote() {
      if (!this.leadId) {
        return
      }

      const content = String(this.noteInput || '').trim()
      if (!content) {
        uni.showToast({
          title: '请填写备注内容',
          icon: 'none'
        })
        return
      }

      try {
        appendLeadNote(this.leadId, content)
        this.noteInput = ''
        this.leadNotes = getLeadNotes(this.leadId)
        uni.showToast({
          title: '备注已新增',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: error && error.message ? error.message : '新增备注失败',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f6f6f9;
  padding: 24rpx;
}

.header-card,
.detail-card,
.empty-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #222;
}

.subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #666;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.detail-line {
  font-size: 24rpx;
  color: #333;
  line-height: 1.6;
  word-break: break-all;
}

.desc-block {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.desc-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #222;
}

.desc-content {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #555;
}

.image-block {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.lead-thumb {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #eef2f7;
}

.action-row {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.action-chip {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}

.action-btn {
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}

.action-btn[disabled] {
  opacity: 0.6;
}

.note-block {
  margin-top: 22rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.project-link-block {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.note-input {
  width: 100%;
  min-height: 140rpx;
  margin-top: 12rpx;
  padding: 16rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #fff;
  font-size: 24rpx;
  color: #333;
}

.note-btn {
  margin-top: 12rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 999rpx;
}

.note-list {
  margin-top: 14rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.note-item {
  padding: 14rpx;
  border-radius: 12rpx;
  background: #fff;
}

.note-content {
  display: block;
  font-size: 24rpx;
  color: #333;
  line-height: 1.6;
}

.note-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #888;
}

.note-empty {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #888;
}

.empty-card {
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222;
}

.empty-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #888;
}
</style>
