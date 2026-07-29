<template>
  <view class="request-page">
    <view class="request-nav">
      <view class="brand" @click="goHome">
        <text class="brand-mark">铦?/text>
        <view>
          <text class="brand-name">铦跺彉 Diebian</text>
          <text class="brand-sub">浼佷笟闇€姹傛彁浜?/text>
        </view>
      </view>
      <button class="ghost-btn" @click="goHome">杩斿洖瀹樼綉</button>
    </view>

    <view class="request-shell">
      <view class="request-hero">
        <text class="kicker">Enterprise Request</text>
        <text class="hero-title">鎻愪氦浼佷笟闇€姹傦紝杩涘叆鍙窡杩涚殑鏈嶅姟娴佺▼</text>
        <text class="hero-desc">鍙渶鐣欎笅鑱旂郴浜哄拰涓€绉嶆湁鏁堣仈绯绘柟寮忋€傞渶姹傜粏鑺傘€侀檮浠跺拰浜や粯瑕佹眰鍙互鍏堢畝鍗曞～鍐欙紝鍚庣画鐢辫窡杩涗汉鍛樿ˉ榻愩€?/text>
      </view>

      <view class="step-tabs">
        <text v-for="(step, index) in steps" :key="step" :class="{ active: currentStep === index }" @click="currentStep = index">{{ index + 1 }}. {{ step }}</text>
      </view>

      <view class="form-card">
        <view v-if="currentStep === 0" class="form-section">
          <text class="section-title">鑱旂郴鏂瑰紡</text>
          <text class="section-desc">鑱旂郴浜哄繀濉紝鎵嬫満鍙峰拰寰俊鍙疯嚦灏戝～鍐欎竴涓€?/text>
          <input v-model.trim="form.contactName" class="input" placeholder="鑱旂郴浜? />
          <view class="form-grid">
            <input v-model.trim="form.phone" class="input" placeholder="鎵嬫満鍙? />
            <input v-model.trim="form.wechat" class="input" placeholder="寰俊鍙? />
          </view>
          <input v-model.trim="form.companyName" class="input" placeholder="鍏徃 / 搴楅摵鍚嶇О" />
        </view>

        <view v-else-if="currentStep === 1" class="form-section">
          <text class="section-title">涓氬姟闇€姹?/text>
          <text class="section-desc">鍙互澶氶€夛紝鍚庣画浼氭寜閲嶇偣鏂瑰悜鍒嗛厤璺熻繘銆?/text>
          <view class="choice-grid">
            <text v-for="item in demandTypes" :key="item.value" :class="{ active: form.demandTypes.includes(item.value) }" @click="toggleDemandType(item.value)">{{ item.label }}</text>
          </view>
        </view>

        <view v-else class="form-section">
          <text class="section-title">浜や粯瑕佹眰</text>
          <text class="section-desc">闈炲繀濉紝鏂逛究鎴戜滑鏇村揩鍒ゆ柇椤圭洰鑼冨洿銆?/text>
          <view class="form-grid">
            <input v-model.trim="form.clothingCategory" class="input" placeholder="鏈嶈鍝佺被锛屼緥濡傚コ瑁呫€佺瑁呫€佺窘缁掓湇" />
            <input v-model.trim="form.quantity" class="input" placeholder="棰勮鏁伴噺锛屼緥濡?20寮?/ 100涓猄KU" />
            <input v-model.trim="form.platform" class="input" placeholder="浣跨敤骞冲彴锛屼緥濡傛窐瀹濄€佸皬绾功銆丄mazon" />
            <input v-model.trim="form.expectedTime" class="input" placeholder="鏈熸湜鏃堕棿锛屼緥濡?3澶╁唴 / 涓嬪懆浜? />
          </view>
          <textarea v-model.trim="form.description" class="textarea" placeholder="琛ュ厖璇存槑锛氱洰鏍囬鏍笺€佸弬鑰冨搧鐗屻€佷氦浠樻牸寮忋€佹槸鍚﹂渶瑕佷汉宸ョ簿淇瓑" />
          <view class="upload-box">
            <view>
              <text class="upload-title">鍙傝€冮檮浠?/text>
              <text class="upload-desc">鏀寔鍥剧墖銆丳DF 鍜岃〃鏍硷紝鏈€澶?6 涓紝鍗曚釜涓嶈秴杩?20MB銆備簯鑳藉姏鍙敤鏃朵笂浼犱负绉佹湁浜戝瓨鍌?fileID銆?/text>
            </view>
            <button class="outline-btn" @click="chooseAttachment">娣诲姞闄勪欢</button>
          </view>
          <view v-if="attachments.length" class="attachment-list">
            <view v-for="item in attachments" :key="item.attachmentId">
              <text>{{ item.name }}</text>
              <text>{{ item.statusText }}</text>
            </view>
          </view>
        </view>

        <view v-if="duplicateLeadIds.length" class="duplicate-tip">
          <text>妫€娴嬪埌杩戞湡鍙兘閲嶅鐨勭嚎绱細{{ duplicateLeadIds.join('銆?) }}</text>
          <text>涓嶄細鑷姩鍚堝苟锛岄渶鍚庡彴浜哄伐纭骞惰褰曞璁°€?/text>
        </view>

        <label class="privacy-row">
          <checkbox :checked="form.privacyConfirmed" @click="form.privacyConfirmed = !form.privacyConfirmed" />
          <text>鎴戠‘璁ゆ彁浜よ祫鏂欎粎鐢ㄤ簬闇€姹傛矡閫氬拰椤圭洰璇勪及锛涙湭缁忔巿鏉冿紝涓嶅緱鐢ㄤ簬鍏紑妗堜緥鎴?AI 璁粌銆?/text>
        </label>

        <view class="form-actions">
          <button class="ghost-btn" :disabled="currentStep === 0" @click="prevStep">涓婁竴姝?/button>
          <button v-if="currentStep < 2" class="primary-btn" @click="nextStep">涓嬩竴姝?/button>
          <button v-else class="primary-btn" :disabled="submitting" @click="submitRequest">{{ submitting ? '鎻愪氦涓?..' : '鎻愪氦闇€姹? }}</button>
        </view>
      </view>

      <view class="flow-card">
        <text class="section-title">鎻愪氦鍚庡浣曡窡杩?/text>
        <view class="flow-list">
          <view v-for="item in flowItems" :key="item.title">
            <text>{{ item.title }}</text>
            <text>{{ item.desc }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { submitLead } from '../../utils/api/leads'
import { uploadUnifiedFile } from '../../utils/upload/unifiedUploadService'
import {
  ENTERPRISE_DEMAND_TYPES,
  buildEnterpriseLeadPayload,
  canAddAttachment,
  findPossibleDuplicateLeads,
  validateAttachment,
  validateContact
} from '../../utils/website/enterpriseRequestFlow'

function createAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getFileName(file = {}) {
  const value = file.name || file.path || file.tempFilePath || '浼佷笟闇€姹傞檮浠?
  return String(value).split(/[\\/]/).pop()
}

function getAttachmentAssetType(fileName = '') {
  const ext = String(fileName || '').split('.').pop().toLowerCase()
  if (['pdf', 'csv', 'xls', 'xlsx'].includes(ext)) {
    return 'document'
  }
  return 'garment_image'
}

export default {
  data() {
    return {
      currentStep: 0,
      routeOptions: {},
      submitting: false,
      steps: ['鑱旂郴鏂瑰紡', '涓氬姟闇€姹?, '浜や粯瑕佹眰'],
      demandTypes: ENTERPRISE_DEMAND_TYPES,
      attachments: [],
      duplicateLeadIds: [],
      form: {
        contactName: '',
        phone: '',
        wechat: '',
        companyName: '',
        demandTypes: ['ai_output'],
        clothingCategory: '',
        quantity: '',
        platform: '',
        expectedTime: '',
        description: '',
        privacyConfirmed: false
      },
      flowItems: [
        { title: '绾跨储鍒涘缓', desc: '鎻愪氦鍚庣敓鎴愮湡瀹為渶姹傜紪鍙?leadId锛屽彲鐢ㄤ簬鏌ヨ澶勭悊鐘舵€併€? },
        { title: '閿€鍞窡杩?, desc: '鍚庡彴璁板綍璐熻矗浜恒€佽窡杩涘唴瀹瑰拰涓嬩竴娆¤窡杩涙椂闂淬€? },
        { title: '杞负椤圭洰', desc: '纭闇€姹傚悗涓€閿垱寤?projectId锛屽苟淇濈暀绾跨储蹇収銆? }
      ]
    }
  },
  onLoad(options = {}) {
    this.routeOptions = options || {}
    if (options.interestType) {
      this.form.demandTypes = [decodeURIComponent(options.interestType)]
    }
  },
  methods: {
    goHome() {
      uni.navigateTo({ url: '/pages/website-demand/website-demand' })
    },
    toggleDemandType(value) {
      const exists = this.form.demandTypes.includes(value)
      this.form.demandTypes = exists
        ? this.form.demandTypes.filter((item) => item !== value)
        : [...this.form.demandTypes, value]
      if (!this.form.demandTypes.length) {
        this.form.demandTypes = [value]
      }
    },
    nextStep() {
      if (this.currentStep === 0) {
        const validation = validateContact(this.form)
        if (!validation.ok) {
          uni.showToast({ title: validation.message, icon: 'none' })
          return
        }
        this.updateDuplicateHint()
      }
      this.currentStep = Math.min(this.currentStep + 1, 2)
    },
    prevStep() {
      this.currentStep = Math.max(this.currentStep - 1, 0)
    },
    updateDuplicateHint() {
      this.duplicateLeadIds = findPossibleDuplicateLeads({
        phone: this.form.phone,
        companyName: this.form.companyName
      })
    },
    chooseAttachment() {
      if (!canAddAttachment(this.attachments)) {
        uni.showToast({ title: '鏈€澶氭坊鍔?6 涓檮浠?, icon: 'none' })
        return
      }
      const handleFiles = (files = []) => {
        files.slice(0, 6 - this.attachments.length).forEach((file) => this.addAttachment(file))
      }
      if (typeof uni.chooseFile === 'function') {
        uni.chooseFile({
          count: 6 - this.attachments.length,
          success: (res) => handleFiles(res.tempFiles || [])
        })
        return
      }
      uni.chooseImage({
        count: 6 - this.attachments.length,
        success: (res) => {
          const files = (res.tempFiles || []).map((item, index) => ({
            ...item,
            path: item.path || (res.tempFilePaths || [])[index],
            name: getFileName(item)
          }))
          handleFiles(files)
        }
      })
    },
    async addAttachment(file = {}) {
      const validation = validateAttachment(file)
      if (!validation.ok) {
        uni.showToast({ title: validation.message, icon: 'none' })
        return
      }
      const localPath = file.path || file.tempFilePath || ''
      const attachment = {
        attachmentId: createAttachmentId(),
        name: getFileName(file),
        size: file.size || 0,
        fileId: '',
        tempUrl: '',
        localPath,
        status: 'local_pending',
        statusText: '寰呬簯绔繚瀛?
      }
      this.attachments.push(attachment)
      await this.tryUploadPrivateAttachment(attachment)
    },
    async tryUploadPrivateAttachment(attachment) {
      if (!attachment.localPath) return
      try {
        const result = await uploadUnifiedFile({
          filePath: attachment.localPath,
          path: attachment.localPath,
          name: attachment.name,
          size: attachment.size
        }, {
          assetType: getAttachmentAssetType(attachment.name),
          targetType: 'enterprise_request',
          targetId: attachment.attachmentId,
          relation: 'attachment',
          permissionScope: 'private',
          source: 'enterprise_request',
          resolveTempUrl: false
        })
        attachment.fileId = result.fileId || ''
        attachment.status = attachment.fileId ? 'private_cloud_file' : 'upload_failed'
        attachment.statusText = attachment.fileId ? '已保存为私有云文件' : '上传失败'
        attachment.fileRecord = result.file || null
      } catch (error) {
        attachment.status = 'upload_failed'
        attachment.statusText = '上传失败，可后续补充'
      }
    },
    async submitRequest() {
      const validation = validateContact(this.form)
      if (!validation.ok) {
        this.currentStep = 0
        uni.showToast({ title: validation.message, icon: 'none' })
        return
      }
      if (!this.form.privacyConfirmed) {
        uni.showToast({ title: '璇峰厛纭璧勬枡鐢ㄩ€斾笌闅愮璇存槑', icon: 'none' })
        return
      }
      if (this.submitting) return
      this.submitting = true
      try {
        this.updateDuplicateHint()
        const payload = buildEnterpriseLeadPayload({
          form: this.form,
          attachments: this.attachments,
          routeOptions: this.routeOptions,
          duplicateLeadIds: this.duplicateLeadIds
        })
        const result = await submitLead(payload)
        const lead = result && result.lead ? result.lead : {}
        const leadId = lead.leadId || lead.id || ''
        if (!leadId) {
          throw new Error('leadId_missing')
        }
        uni.navigateTo({ url: `/pages/website-demand-success/website-demand-success?leadId=${encodeURIComponent(leadId)}` })
      } catch (error) {
        uni.showToast({ title: '鎻愪氦澶辫触锛岃绋嶅悗閲嶈瘯', icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.request-page { min-height:100vh; padding:28rpx; background:#f8fafc; color:#0f172a; box-sizing:border-box; }
.request-nav, .request-shell { max-width:1180rpx; margin:0 auto; }
.request-nav { display:flex; align-items:center; justify-content:space-between; gap:20rpx; padding:18rpx 22rpx; border:1rpx solid #e2e8f0; border-radius:26rpx; background:#fff; box-shadow:0 18rpx 54rpx rgba(15,23,42,.06); }
.brand { display:flex; align-items:center; gap:14rpx; }
.brand-mark { display:flex; align-items:center; justify-content:center; width:52rpx; height:52rpx; border-radius:16rpx; background:#4f46e5; color:#fff; font-weight:900; }
.brand-name, .brand-sub, .kicker, .hero-title, .hero-desc, .section-title, .section-desc, .upload-title, .upload-desc { display:block; }
.brand-name { font-size:26rpx; font-weight:900; }
.brand-sub { color:#64748b; font-size:19rpx; }
.request-shell { display:grid; grid-template-columns:minmax(0,1fr) 340rpx; gap:22rpx; padding:56rpx 0; }
.request-hero { grid-column:1 / -1; }
.kicker { color:#4f46e5; font-size:24rpx; font-weight:900; }
.hero-title { max-width:900rpx; margin-top:14rpx; font-size:54rpx; line-height:1.12; font-weight:950; }
.hero-desc { max-width:850rpx; margin-top:16rpx; color:#475569; font-size:26rpx; line-height:1.65; }
.step-tabs { grid-column:1 / -1; display:flex; flex-wrap:wrap; gap:12rpx; }
.step-tabs text { padding:12rpx 18rpx; border-radius:999rpx; background:#fff; color:#475569; font-size:22rpx; font-weight:850; }
.step-tabs text.active { background:#4f46e5; color:#fff; }
.form-card, .flow-card { border:1rpx solid rgba(15,23,42,.08); border-radius:28rpx; background:#fff; box-shadow:0 20rpx 60rpx rgba(15,23,42,.06); box-sizing:border-box; }
.form-card { padding:28rpx; }
.flow-card { padding:24rpx; }
.section-title { font-size:31rpx; font-weight:930; }
.section-desc { margin-top:8rpx; color:#64748b; font-size:22rpx; line-height:1.55; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14rpx; }
.input, .textarea { width:100%; margin-top:16rpx; padding:20rpx 22rpx; border:1rpx solid #e2e8f0; border-radius:18rpx; background:#f8fafc; color:#0f172a; font-size:24rpx; box-sizing:border-box; }
.textarea { min-height:150rpx; }
.choice-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12rpx; margin-top:20rpx; }
.choice-grid text { padding:18rpx; border:1rpx solid #e2e8f0; border-radius:18rpx; background:#f8fafc; color:#334155; font-size:23rpx; font-weight:850; text-align:center; }
.choice-grid text.active { border-color:#4f46e5; background:#eef2ff; color:#4338ca; }
.upload-box { display:flex; justify-content:space-between; gap:18rpx; margin-top:18rpx; padding:18rpx; border-radius:20rpx; background:#f8fafc; }
.upload-title { font-size:24rpx; font-weight:900; }
.upload-desc { margin-top:6rpx; color:#64748b; font-size:20rpx; line-height:1.45; }
.attachment-list { margin-top:14rpx; display:grid; gap:10rpx; }
.attachment-list view { display:flex; justify-content:space-between; gap:12rpx; padding:12rpx 14rpx; border-radius:14rpx; background:#f1f5f9; color:#475569; font-size:20rpx; }
.duplicate-tip { margin-top:18rpx; padding:16rpx; border-radius:18rpx; background:#fff7ed; color:#9a3412; font-size:21rpx; line-height:1.5; }
.duplicate-tip text { display:block; }
.privacy-row { display:flex; align-items:flex-start; gap:10rpx; margin-top:18rpx; color:#475569; font-size:21rpx; line-height:1.5; }
.form-actions { display:flex; justify-content:flex-end; gap:12rpx; margin-top:24rpx; }
.primary-btn, .ghost-btn, .outline-btn { min-width:160rpx; height:62rpx; line-height:62rpx; margin:0; border-radius:999rpx; font-size:22rpx; font-weight:850; }
.primary-btn { background:#4f46e5; color:#fff; }
.ghost-btn, .outline-btn { border:1rpx solid #c7d2fe; background:#fff; color:#4338ca; }
.flow-list { display:grid; gap:14rpx; margin-top:18rpx; }
.flow-list view { padding:16rpx; border-radius:18rpx; background:#f8fafc; }
.flow-list text { display:block; color:#475569; font-size:21rpx; line-height:1.45; }
.flow-list text:first-child { color:#0f172a; font-weight:900; }
@media screen and (max-width:900px) {
  .request-page { padding:18rpx; }
  .request-nav, .upload-box { display:block; }
  .request-shell, .form-grid, .choice-grid { grid-template-columns:1fr; }
  .hero-title { font-size:42rpx; }
  .outline-btn { margin-top:14rpx; }
}
</style>

