<template>
  <view class="legal-page">
    <view class="legal-shell">
      <text class="eyebrow">Terms of Service</text>
      <text class="page-title">蝶变用户协议</text>
      <text class="page-desc">版本：{{ termsVersion }}。本协议说明蝶变提供 AI 服装视觉、AI 制版、版型资产、企业项目和交付服务时的基本规则。</text>

      <view class="section">
        <text class="section-title">服务范围</text>
        <text class="section-text">蝶变提供服装 AI 出图、AI 制版参考、版型资产管理、项目协作、审核交付和企业服务能力。AI 生成内容存在不确定性，AI 制版结果仅作参考，投入生产前必须由专业版师审核、修订并确认尺寸。</text>
      </view>

      <view class="section">
        <text class="section-title">上传内容与权利</text>
        <text class="section-text">用户应确保上传的服装图、模特图、Logo、品牌素材、版型文件和附件拥有合法权利或授权。蝶变仅在完成服务所需范围内处理素材，不因提供服务取得用户素材的所有权。</text>
      </view>

      <view class="section">
        <text class="section-title">企业数据与协作</text>
        <text class="section-text">企业数据按企业、项目、角色和权限隔离。企业管理员可管理团队成员和授权记录，成员个人授权不得突破企业数据政策。</text>
      </view>

      <view class="section">
        <text class="section-title">额度、失败与交付</text>
        <text class="section-text">真实额度和扣费以服务端记录为准。生成失败、回滚、补偿和正式交付需要形成可追溯记录。mock、fallback、未完成、未审核或来源不明的结果不得进入正式交付。</text>
      </view>

      <view class="section">
        <text class="section-title">禁止行为</text>
        <view class="terms-list">
          <text>上传侵权、违法或未经授权的素材</text>
          <text>冒用他人肖像、品牌或客户案例</text>
          <text>绕过权限读取其他企业数据</text>
          <text>通过 URL、工单或聊天传递密钥</text>
          <text>将未审核 AI 制版结果直接用于生产</text>
        </view>
      </view>

      <view class="footer-actions">
        <button class="outline-btn" @click="goPrivacy">查看隐私政策</button>
        <button class="primary-btn" @click="goHome">返回首页</button>
      </view>
    </view>
  </view>
</template>

<script>
import { TERMS_VERSION } from '../../utils/compliance/privacyConsentCenter'

export default {
  data() {
    return {
      termsVersion: TERMS_VERSION
    }
  },
  methods: {
    goPrivacy() {
      uni.navigateTo({ url: '/pages/privacy/privacy' })
    },
    goHome() {
      uni.navigateTo({ url: '/pages/website-demand/website-demand' })
    }
  }
}
</script>

<style scoped>
.legal-page { min-height: 100vh; background: #f8fafc; color: #0f172a; }
.legal-shell { max-width: 1040px; margin: 0 auto; padding: 56px 24px; box-sizing: border-box; }
.eyebrow, .page-title, .page-desc, .section-title, .section-text { display: block; }
.eyebrow { color: #4f46e5; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.page-title { margin-top: 8px; font-size: 38px; font-weight: 950; }
.page-desc { max-width: 780px; margin-top: 12px; color: #64748b; line-height: 1.7; }
.section { margin-top: 18px; padding: 22px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, .05); }
.section-title { font-size: 20px; font-weight: 900; }
.section-text { margin-top: 10px; color: #475569; line-height: 1.75; }
.terms-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.terms-list text { padding: 8px 10px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 13px; font-weight: 850; }
.footer-actions { display: flex; gap: 10px; margin-top: 22px; }
.primary-btn, .outline-btn { height: 42px; padding: 0 16px; border-radius: 10px; font-weight: 900; }
.primary-btn { border: 0; background: #4f46e5; color: #fff; }
.outline-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
@media (max-width: 800px) {
  .legal-shell { padding: 36px 16px; }
  .page-title { font-size: 30px; }
  .footer-actions { flex-direction: column; }
}
</style>
