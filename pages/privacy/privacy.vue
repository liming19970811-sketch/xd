<template>
  <view class="legal-page">
    <view class="legal-shell">
      <text class="eyebrow">Privacy Policy</text>
      <text class="page-title">蝶变隐私政策</text>
      <text class="page-desc">版本：{{ policyVersion }}。本页面说明蝶变在官网、工作台、小程序和企业服务中如何处理用户素材、企业数据与 AI 训练授权。</text>

      <view class="notice-card">
        <text class="card-title">核心原则</text>
        <text>企业上传素材默认仅用于完成当前服务。未经独立授权，不跨企业复用、不进入公共版型库、不用于公开案例，也不进入 AI 训练候选集。</text>
      </view>

      <view class="section">
        <text class="section-title">授权类型独立管理</text>
        <view class="consent-grid">
          <view v-for="item in catalog" :key="item.type" class="consent-card">
            <text class="card-title">{{ item.label }}</text>
            <text class="row-meta">{{ item.required ? '基础服务必要项' : '可选授权，默认关闭' }}</text>
            <text class="card-desc">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">AI 训练授权</text>
        <text class="section-text">AI 训练授权默认关闭。开启前会明确说明使用的数据、使用目的、是否包含人工修订、授权范围、保存期限和撤回方式。撤回授权后，未进入冻结数据集的数据立即停止使用；历史模型影响将按协议和技术能力如实说明，不做无法兑现的承诺。</text>
      </view>

      <view class="section">
        <text class="section-title">AI 供应商处理披露</text>
        <text class="section-text">任务提交前应提示是否调用第三方 AI 供应商、发送的数据类型、是否跨境处理、文件临时访问方式和数据保留规则。供应商变化必须更新系统记录，不能只修改政策文字。</text>
      </view>

      <view class="section">
        <text class="section-title">用户数据权利</text>
        <view class="rights-list">
          <text>查看个人数据范围</text>
          <text>提交导出申请</text>
          <text>提交删除申请</text>
          <text>撤回可选授权</text>
          <text>申请注销账号</text>
          <text>联系隐私负责人</text>
        </view>
        <text class="section-text">删除请求会先检查项目、订单、额度、交付和法定留存要求，不会直接清空全部数据库。</text>
      </view>

      <view class="footer-actions">
        <button class="outline-btn" @click="goTerms">查看用户协议</button>
        <button class="primary-btn" @click="goConsent">管理我的授权</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getConsentCatalog, PRIVACY_POLICY_VERSION } from '../../utils/compliance/privacyConsentCenter'

export default {
  data() {
    return {
      policyVersion: PRIVACY_POLICY_VERSION,
      catalog: getConsentCatalog()
    }
  },
  methods: {
    goTerms() {
      uni.navigateTo({ url: '/pages/terms/terms' })
    },
    goConsent() {
      uni.navigateTo({ url: '/pages/workspace-data-consent/workspace-data-consent' })
    }
  }
}
</script>

<style scoped>
.legal-page { min-height: 100vh; background: #f8fafc; color: #0f172a; }
.legal-shell { max-width: 1120px; margin: 0 auto; padding: 56px 24px; box-sizing: border-box; }
.eyebrow, .page-title, .page-desc, .section-title, .section-text, .card-title, .card-desc, .row-meta { display: block; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.page-title { margin-top: 8px; font-size: 38px; font-weight: 950; }
.page-desc { max-width: 780px; margin-top: 12px; color: #64748b; line-height: 1.7; }
.notice-card, .section, .consent-card { border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, .05); box-sizing: border-box; }
.notice-card { margin-top: 26px; padding: 20px; line-height: 1.7; color: #334155; }
.section { margin-top: 18px; padding: 22px; }
.section-title, .card-title { font-size: 20px; font-weight: 900; }
.section-text, .card-desc { margin-top: 10px; color: #475569; line-height: 1.75; }
.consent-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.consent-card { padding: 16px; }
.row-meta { margin-top: 6px; color: #64748b; font-size: 12px; }
.rights-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.rights-list text { padding: 8px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 850; }
.footer-actions { display: flex; gap: 10px; margin-top: 22px; }
.primary-btn, .outline-btn { height: 42px; padding: 0 16px; border-radius: 10px; font-weight: 900; }
.primary-btn { border: 0; background: #4f46e5; color: #fff; }
.outline-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
@media (max-width: 800px) {
  .legal-shell { padding: 36px 16px; }
  .page-title { font-size: 30px; }
  .consent-grid { grid-template-columns: 1fr; }
  .footer-actions { flex-direction: column; }
}
</style>
