<template>
  <view class="knowledge-page">
    <view class="public-nav">
      <view class="brand" @click="goPublic('/pages/website-demand/website-demand')">
        <text class="brand-mark">蝶</text>
        <view>
          <text class="brand-name">蝶变 Diebian</text>
          <text class="brand-sub">公开知识中心</text>
        </view>
      </view>
      <view class="nav-links">
        <text @click="goPublic('/pages/website-demand/website-demand')">首页</text>
        <text @click="goPublic('/pages/case-center/case-center')">案例</text>
        <text class="active">知识中心</text>
        <text @click="goPublic('/pages/enterprise-solution/enterprise-solution')">解决方案</text>
        <text @click="goPublic('/pages/enterprise-request/enterprise-request?sourceType=enterprise')">企业合作</text>
      </view>
    </view>

    <view v-if="article" class="article-shell">
      <text class="back-link" @click="clearArticle">← 返回知识中心</text>
      <view class="article-layout">
        <aside class="toc-card">
          <text class="toc-title">目录</text>
          <text v-for="item in catalog" :key="item.id">{{ item.title }}</text>
        </aside>
        <article class="article-card">
          <text class="kicker">{{ article.category }}</text>
          <text class="article-title">{{ article.title }}</text>
          <text class="article-summary">{{ article.summary }}</text>
          <view class="article-meta">
            <text>发布：{{ article.publishedAt }}</text>
            <text>更新：{{ article.updatedAt }}</text>
            <text>作者：{{ article.author }}</text>
            <text>审核：{{ article.reviewer }}</text>
          </view>
          <view v-for="(block, index) in article.content" :key="block.heading" class="article-section">
            <text class="section-index">0{{ index + 1 }}</text>
            <text class="section-title">{{ block.heading }}</text>
            <text class="section-copy">{{ block.body }}</text>
          </view>

          <view class="related-panel">
            <view>
              <text class="related-title">相关功能</text>
              <button v-for="fn in article.relatedFunctions" :key="fn.label" class="outline-btn" @click="goWorkspace(fn.path)">{{ fn.label }}</button>
            </view>
            <view>
              <text class="related-title">相关案例</text>
              <text v-for="caseItem in relatedCases" :key="caseItem.caseId" class="related-link" @click="goCase(caseItem.caseId)">{{ caseItem.title }}</text>
            </view>
            <view>
              <text class="related-title">相关文章</text>
              <text v-for="item in relatedArticles" :key="item.articleId" class="related-link" @click="openArticle(item.articleId)">{{ item.title }}</text>
            </view>
          </view>

          <view class="consult-card">
            <view>
              <text class="consult-title">需要把内容落到企业项目？</text>
              <text class="consult-desc">文章页只保留两个动作：进入对应 AI 功能，或提交企业需求。</text>
            </view>
            <button class="primary-btn" @click="goPublic('/pages/enterprise-request/enterprise-request?sourceType=article&sourceId=' + article.articleId)">提交企业需求</button>
          </view>
        </article>
      </view>
    </view>

    <view v-else class="list-shell">
      <view class="hero-section">
        <text class="kicker">企业知识中心</text>
        <text class="hero-title">用专业内容解释 AI 出图、AI 制版和版型数字化</text>
        <text class="hero-desc">知识中心用于承接公开搜索流量，再引导用户进入真实功能或提交企业需求，不堆砌关键词，不混入工作台私有页面。</text>
      </view>
      <view class="filter-bar">
        <input v-model.trim="keyword" placeholder="搜索文章、标签或功能关键词" />
        <view class="category-tabs">
          <text class="category-tab" :class="{ active: activeCategory === '' }" @click="setCategory('')">全部</text>
          <text v-for="category in categories" :key="category" class="category-tab" :class="{ active: activeCategory === category }" @click="setCategory(category)">{{ category }}</text>
        </view>
      </view>
      <view class="article-grid">
        <view v-for="item in filteredArticles" :key="item.articleId" class="article-list-card" @click="openArticle(item.articleId)">
          <text class="article-category">{{ item.category }}</text>
          <text class="list-title">{{ item.title }}</text>
          <text class="list-summary">{{ item.summary }}</text>
          <view class="tag-list">
            <text v-for="tag in item.tags" :key="tag">{{ tag }}</text>
          </view>
          <view class="list-meta">
            <text>{{ item.updatedAt }}</text>
            <text>{{ item.reviewer }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  WEBSITE_ARTICLE_CATEGORIES,
  getArticleCatalog,
  getRelatedWebsiteArticles,
  getWebsiteArticleById,
  searchWebsiteArticles
} from '../../utils/website/articleRepository'
import { getEnterpriseCaseById } from '../../utils/website/caseRepository'

export default {
  data() {
    return {
      articleId: '',
      keyword: '',
      activeCategory: '',
      categories: WEBSITE_ARTICLE_CATEGORIES
    }
  },
  computed: {
    article() {
      return this.articleId ? getWebsiteArticleById(this.articleId) : null
    },
    catalog() {
      return getArticleCatalog(this.article)
    },
    filteredArticles() {
      return searchWebsiteArticles({ keyword: this.keyword, category: this.activeCategory })
    },
    relatedArticles() {
      return this.article ? getRelatedWebsiteArticles(this.article.articleId, 3) : []
    },
    relatedCases() {
      if (!this.article) return []
      return (this.article.relatedCases || []).map((caseId) => getEnterpriseCaseById(caseId)).filter(Boolean)
    }
  },
  onLoad(options = {}) {
    if (options.articleId) {
      this.articleId = decodeURIComponent(options.articleId)
    }
  },
  methods: {
    setCategory(category) {
      this.activeCategory = category || ''
    },
    openArticle(articleId) {
      this.articleId = articleId
      if (process.env.NODE_ENV !== 'production') {
        const article = getWebsiteArticleById(articleId)
        console.log('[website:article]', { articleId, title: article ? article.title : '' })
      }
    },
    clearArticle() {
      this.articleId = ''
    },
    goPublic(url) {
      uni.navigateTo({ url })
    },
    goCase(caseId) {
      uni.navigateTo({ url: `/pages/case-center/case-center?caseId=${encodeURIComponent(caseId)}` })
    },
    goWorkspace(path) {
      const target = path || '/workspace'
      const typeMatch = target.match(/[?&]type=([^&]+)/)
      const moduleName = target.indexOf('pattern-making') > -1
        ? 'pattern-making'
        : (target.indexOf('pattern-library') > -1 ? 'library' : 'ai-output')
      const typeQuery = typeMatch ? `&type=${encodeURIComponent(decodeURIComponent(typeMatch[1]))}` : ''
      uni.navigateTo({ url: `/pages/workspace/workspace?module=${moduleName}${typeQuery}` })
    }
  }
}
</script>

<style scoped>
.knowledge-page { min-height:100vh; padding:28rpx; background:#f8fafc; color:#0f172a; box-sizing:border-box; }
.public-nav, .list-shell, .article-shell { max-width:1180rpx; margin:0 auto; }
.public-nav { position:sticky; top:18rpx; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:24rpx; padding:18rpx 22rpx; border:1rpx solid rgba(15,23,42,.08); border-radius:26rpx; background:rgba(255,255,255,.94); box-shadow:0 18rpx 54rpx rgba(15,23,42,.08); }
.brand { display:flex; align-items:center; gap:14rpx; }
.brand-mark { display:flex; align-items:center; justify-content:center; width:52rpx; height:52rpx; border-radius:16rpx; background:#4f46e5; color:#fff; font-weight:900; }
.brand-name, .brand-sub, .kicker, .hero-title, .hero-desc, .article-title, .article-summary, .section-title, .section-copy, .related-title, .consult-title, .consult-desc, .list-title, .list-summary { display:block; }
.brand-name { font-size:26rpx; font-weight:900; }
.brand-sub { margin-top:2rpx; color:#64748b; font-size:19rpx; }
.nav-links { display:flex; gap:24rpx; color:#475569; font-size:22rpx; font-weight:800; }
.nav-links .active { color:#4f46e5; }
.hero-section { padding:72rpx 0 26rpx; }
.kicker, .article-category { color:#4f46e5; font-size:23rpx; font-weight:900; }
.hero-title { max-width:880rpx; margin-top:14rpx; font-size:54rpx; line-height:1.12; font-weight:950; }
.hero-desc { max-width:880rpx; margin-top:18rpx; color:#475569; font-size:26rpx; line-height:1.65; }
.filter-bar { padding:20rpx; border:1rpx solid #e2e8f0; border-radius:26rpx; background:#fff; }
.filter-bar input { height:64rpx; padding:0 18rpx; border-radius:18rpx; background:#f8fafc; color:#0f172a; font-size:23rpx; }
.category-tabs { display:flex; flex-wrap:wrap; gap:10rpx; margin-top:16rpx; }
.category-tab { padding:10rpx 16rpx; border-radius:999rpx; background:#f1f5f9; color:#475569; font-size:21rpx; font-weight:850; }
.category-tab.active { background:#4f46e5; color:#fff; }
.article-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18rpx; margin-top:22rpx; }
.article-list-card, .article-card, .toc-card, .consult-card { border:1rpx solid rgba(15,23,42,.08); border-radius:26rpx; background:#fff; box-shadow:0 18rpx 54rpx rgba(15,23,42,.06); box-sizing:border-box; }
.article-list-card { padding:22rpx; }
.list-title { margin-top:10rpx; font-size:29rpx; font-weight:930; line-height:1.3; }
.list-summary { margin-top:10rpx; color:#475569; font-size:22rpx; line-height:1.58; }
.tag-list { display:flex; flex-wrap:wrap; gap:8rpx; margin-top:14rpx; }
.tag-list text { padding:7rpx 11rpx; border-radius:999rpx; background:#eef2ff; color:#4f46e5; font-size:18rpx; font-weight:800; }
.list-meta { display:flex; justify-content:space-between; margin-top:16rpx; color:#94a3b8; font-size:19rpx; }
.article-shell { padding:34rpx 0 60rpx; }
.back-link { display:block; margin:18rpx 0; color:#4f46e5; font-size:23rpx; font-weight:850; }
.article-layout { display:grid; grid-template-columns:260rpx minmax(0,1fr); gap:20rpx; align-items:start; }
.toc-card { position:sticky; top:120rpx; padding:20rpx; }
.toc-title { display:block; margin-bottom:12rpx; color:#0f172a; font-size:24rpx; font-weight:900; }
.toc-card text:not(.toc-title) { display:block; margin-top:10rpx; color:#64748b; font-size:20rpx; line-height:1.45; }
.article-card { padding:32rpx; }
.article-title { margin-top:12rpx; font-size:48rpx; line-height:1.16; font-weight:950; }
.article-summary { margin-top:16rpx; color:#475569; font-size:25rpx; line-height:1.62; }
.article-meta { display:flex; flex-wrap:wrap; gap:12rpx; margin-top:18rpx; color:#64748b; font-size:20rpx; }
.article-section { margin-top:28rpx; padding-top:24rpx; border-top:1rpx solid #e2e8f0; }
.section-index { color:#4f46e5; font-size:22rpx; font-weight:950; }
.section-title { margin-top:8rpx; font-size:31rpx; font-weight:930; }
.section-copy { margin-top:10rpx; color:#334155; font-size:24rpx; line-height:1.72; }
.related-panel { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16rpx; margin-top:28rpx; padding:20rpx; border-radius:22rpx; background:#f8fafc; }
.related-title { margin-bottom:10rpx; font-size:23rpx; font-weight:900; }
.related-link { display:block; margin-top:10rpx; color:#475569; font-size:21rpx; line-height:1.45; }
.outline-btn, .primary-btn { height:58rpx; line-height:58rpx; margin:8rpx 0 0; border-radius:999rpx; font-size:21rpx; font-weight:850; }
.outline-btn { border:1rpx solid #c7d2fe; background:#fff; color:#4338ca; }
.primary-btn { min-width:180rpx; background:#4f46e5; color:#fff; }
.consult-card { display:flex; justify-content:space-between; align-items:center; gap:18rpx; margin-top:24rpx; padding:22rpx; }
.consult-title { font-size:27rpx; font-weight:930; }
.consult-desc { margin-top:8rpx; color:#64748b; font-size:21rpx; }
@media screen and (max-width: 900px) {
  .knowledge-page { padding:18rpx; }
  .public-nav, .consult-card { display:block; }
  .nav-links { margin-top:16rpx; flex-wrap:wrap; gap:14rpx; }
  .hero-title, .article-title { font-size:40rpx; }
  .article-grid, .article-layout, .related-panel { grid-template-columns:1fr; }
  .toc-card { position:static; }
  .primary-btn { margin-top:16rpx; }
}
</style>
