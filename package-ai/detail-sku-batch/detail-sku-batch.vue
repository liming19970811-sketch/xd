<template>
  <view class="page">
    <view class="intro"><text class="title">同款多色详情长图</text><text class="desc">复用同一商品档案，为每个真实颜色 SKU 生成独立详情长图。</text></view>

    <view class="section">
      <text class="section-title">1 公共商品信息</text>
      <view v-if="profile" class="profile-row"><view><text>{{ fieldValue('productName') || '未命名商品' }}</text><text>档案 V{{ group.sharedProfileVersion }} · {{ sizeStatus }}</text></view><text class="link" @click="openProfile">修改</text></view>
      <button v-else class="primary" @click="openProfile">选择商品档案</button>
    </view>

    <view class="section">
      <view class="section-head"><view><text class="section-title">2 SKU 颜色列表</text><text class="section-desc">颜色提取仅为建议，确认后才用于正式排版。</text></view><view class="sku-actions"><button class="minor" @click="batchUploadAssets">批量上传</button><button class="minor" @click="addSku">新增颜色</button></view></view>
      <view v-if="(group.pendingAssets || []).length" class="pending-assets"><text class="section-desc">待分配素材（必须指定 SKU 和用途）</text><view class="asset-grid"><view v-for="asset in group.pendingAssets" :key="asset.assetId" class="asset" @click="assignPendingAsset(asset)"><image :src="asset.localPath || asset.fileId" mode="aspectFill" /><text>待分配 · 点击处理</text></view></view></view>
      <view v-for="(sku, index) in skus" :key="sku.skuId || index" class="sku-card">
        <view class="sku-head" @click="sku.expanded = !sku.expanded"><view class="swatch" :style="{ backgroundColor: sku.colorHex || '#f2f4f7' }"></view><view class="sku-main"><text>{{ sku.colorName || `颜色SKU ${index + 1}` }}</text><text>{{ sku.skuCode || '未填写编码' }} · {{ sku.assets.length }} 张素材 · {{ skuReadyText(sku) }}</text></view><text class="check" @click.stop="sku.selected = !sku.selected">{{ sku.selected ? '✓' : '○' }}</text></view>
        <view v-if="sku.expanded" class="sku-edit">
          <input v-model.trim="sku.skuCode" placeholder="SKU编码（同款内唯一）" />
          <view class="color-row"><input v-model.trim="sku.colorName" placeholder="颜色名称" /><input v-model.trim="sku.colorHex" placeholder="#RRGGBB" /><button class="minor" @click="chooseRecentColor(sku)">最近颜色</button><button class="minor" @click="confirmColor(sku)">确认颜色</button></view>
          <view class="asset-grid"><view v-for="asset in sku.assets" :key="asset.assetId" class="asset"><image :src="asset.localPath || asset.fileId" mode="aspectFill" /><text>{{ usageLabel(asset.usage) }}</text><text class="remove" @click="removeAsset(sku, asset.assetId)">删除</text></view><view class="upload" @click="uploadSkuAsset(sku)"><text>＋</text><text>上传SKU图片</text></view></view>
          <view class="confirm-row"><text @click="sku.assetColorConfirmed = !sku.assetColorConfirmed">{{ sku.assetColorConfirmed ? '☑' : '□' }} 图片属于当前颜色</text><text @click="sku.styleConfirmed = !sku.styleConfirmed">{{ sku.styleConfirmed ? '☑' : '□' }} 与公共档案为同一款式</text></view>
          <textarea v-model.trim="sku.skuSpecificFacts.sellingPoints" placeholder="SKU专属说明（可选）" />
          <view class="sku-actions"><button class="minor" @click="copySku(sku)">复制SKU</button><button class="minor" @click="saveSku(sku)">保存SKU</button></view>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">3 SKU 素材检查</text>
      <view v-for="sku in skus" :key="`check_${sku.skuId}`" class="check-row"><text>{{ sku.colorName || sku.skuCode || '未命名SKU' }}</text><text :class="{ error: skuErrors(sku).length }">{{ skuErrors(sku)[0] || '资料完整，可以生成' }}</text></view>
    </view>

    <view class="section">
      <text class="section-title">4 公共详情模块</text>
      <view class="module-grid"><text v-for="module in moduleOptions" :key="module.id" :class="{ active: moduleIds.includes(module.id) }" @click="toggleModule(module)">{{ module.title }}</text></view>
    </view>

    <view class="section">
      <text class="section-title">5 各 SKU 差异内容</text>
      <text class="section-desc">主图、细节图、颜色名称、HEX/Lab 和 SKU 编码按 SKU 隔离；版型、尺码、工艺和公共卖点来自同一档案版本。</text>
    </view>

    <view class="section">
      <text class="section-title">6 模板与平台</text>
      <view class="module-grid"><text v-for="item in templates" :key="item.id" :class="{ active: templateId === item.id }" @click="templateId = item.id">{{ item.name }}</text></view>
      <view class="module-grid"><text v-for="item in platforms" :key="item.id" :class="{ active: platformId === item.id }" @click="platformId = item.id">{{ item.name }}</text></view>
    </view>

    <view class="section confirm-section">
      <text class="section-title">7 批量任务确认</text>
      <text>已选择 {{ selectedSkus.length }} 个 SKU</text><text>将创建 {{ selectedSkus.length }} 个独立作品</text><text>预计生成 {{ expectedSegments }} 张详情长图分片</text><text>模板排版不调用 AI 生图，不消耗 AI 生成额度</text>
      <text v-if="submitError" class="error">{{ submitError }}</text>
    </view>

    <canvas :canvas-id="canvasId" :id="canvasId" class="render-canvas" :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }" />
    <view class="bottom"><text>{{ selectedSkus.length }} 个SKU · {{ expectedSegments }}个结果</text><button class="primary" :disabled="submitting || !canSubmit" @click="submitBatch">{{ submitting ? '正在创建...' : `生成${selectedSkus.length}个独立作品` }}</button></view>
  </view>
</template>

<script>
import { uploadImage } from '../../utils/api/upload'
import { DETAIL_ASSET_USAGES, DETAIL_PAGE_TEMPLATES, DETAIL_PAGE_PLATFORMS, DETAIL_PAGE_MODULES } from '../../utils/detail-page/detailPageContract'
import { drawDetailPageSegment } from '../../utils/detail-page/detailPageRenderer'
import { createSkuRenderBatch, prepareSkuRender, startSkuRenderChild } from '../../utils/detail-page/detailSkuBatch'
import { createSkuColor, copyProductSku, getSkuGroup, getSkuGroupByProduct, listProductSkus, saveProductSku, saveSkuGroup, validateSkuForRender } from '../../utils/product/productSkuRepository'
import { getProductProfile, getSizeChart } from '../../utils/product/productProfileRepository'
import { extractDominantColors, getColorHistory } from '../../utils/color/colorPicker'

const DEFAULT_MODULES = ['hero', 'flat_display', 'selling_points', 'product_info', 'size_chart']

function imageInfo(source = '') { return new Promise((resolve, reject) => uni.getImageInfo({ src: source, success: resolve, fail: reject })) }
function canvasPath(canvasId, component, width, height) { return new Promise((resolve, reject) => uni.canvasToTempFilePath({ canvasId, width, height, destWidth: width, destHeight: height, fileType: 'jpg', quality: 0.92, success: ({ tempFilePath }) => resolve(tempFilePath), fail: reject }, component)) }

export default {
  data() { return { productId: '', retrySkuId: '', profile: null, group: { skuGroupId: '', sharedProfileVersion: 1 }, skus: [], moduleIds: [...DEFAULT_MODULES], templateId: 'simple_ecommerce', platformId: 'taobao', submitting: false, submitError: '', canvasId: 'sku-detail-renderer', canvasWidth: 750, canvasHeight: 1000 } },
  computed: {
    templates() { return DETAIL_PAGE_TEMPLATES }, platforms() { return DETAIL_PAGE_PLATFORMS }, moduleOptions() { return DETAIL_PAGE_MODULES },
    selectedSkus() { return this.skus.filter((item) => item.selected && !this.skuErrors(item).length) },
    expectedSegments() { return this.selectedSkus.reduce((sum, sku) => { try { return sum + prepareSkuRender({ group: this.group, sku, moduleIds: this.moduleIds, templateId: this.templateId, platformId: this.platformId }).expectedOutputCount } catch (error) { return sum } }, 0) },
    sizeStatus() { const chart = this.profile && this.profile.sizeChartId ? getSizeChart(this.profile.sizeChartId) : null; return chart && chart.confirmed ? '尺码表已确认' : '尺码表待确认' },
    canSubmit() { return Boolean(this.profile && this.selectedSkus.length && this.expectedSegments) }
  },
  onLoad(query = {}) { this.productId = query.productId ? decodeURIComponent(query.productId) : ''; this.retrySkuId = query.retrySkuId ? decodeURIComponent(query.retrySkuId) : ''; this.loadData(query.skuGroupId ? decodeURIComponent(query.skuGroupId) : '') },
  onShow() { if (this.productId) this.profile = getProductProfile(this.productId) },
  methods: {
    fieldValue(key) { return (((this.profile || {})[key] || {}).value) || '' },
    usageLabel(value) { return ((DETAIL_ASSET_USAGES.find((item) => item.value === value) || {}).label) || value },
    loadData(groupId = '') { this.profile = this.productId ? getProductProfile(this.productId) : null; if (!this.profile) return; const existing = groupId ? getSkuGroup(groupId) : getSkuGroupByProduct(this.productId); this.group = existing || saveSkuGroup({ productId: this.productId, sharedProfileVersion: this.profile.version, templateId: this.templateId, platformId: this.platformId, sharedModules: this.moduleIds }); this.templateId = this.group.templateId; this.platformId = this.group.platformId; this.moduleIds = this.group.sharedModules.length ? [...this.group.sharedModules] : [...DEFAULT_MODULES]; this.skus = listProductSkus(this.group.skuGroupId).map((item) => ({ ...item, selected: this.retrySkuId ? item.skuId === this.retrySkuId : item.selected !== false, expanded: this.retrySkuId ? item.skuId === this.retrySkuId : false, skuSpecificFacts: { ...(item.skuSpecificFacts || {}) } })); if (!this.skus.length) this.addSku() },
    openProfile() { uni.navigateTo({ url: this.productId ? `/package-assets/product-profile/product-profile?productId=${encodeURIComponent(this.productId)}` : '/package-assets/product-profile/product-profile?select=1' }) },
    addSku() { this.skus.push({ skuId: '', skuGroupId: this.group.skuGroupId, skuCode: '', colorName: '', colorHex: '', colorLab: [], colorSource: 'manual', colorConfirmed: false, assets: [], assetColorConfirmed: false, styleConfirmed: false, selected: true, expanded: true, skuSpecificFacts: {} }) },
    confirmColor(sku) { const color = createSkuColor({ name: sku.colorName, displayName: sku.colorName, hex: sku.colorHex, colorConfirmed: true }, 'manual'); if (!color.colorHex) return uni.showToast({ title: '请输入有效HEX色值', icon: 'none' }); Object.assign(sku, color, { colorConfirmed: true }) },
    chooseRecentColor(sku) { const colors = getColorHistory().slice(0, 12); if (!colors.length) return uni.showToast({ title: '暂无最近使用颜色', icon: 'none' }); uni.showActionSheet({ itemList: colors.map((item) => `${item.displayName || item.name || '颜色'} ${item.hex}`), success: ({ tapIndex }) => { const color = colors[tapIndex]; Object.assign(sku, createSkuColor({ ...color, colorName: color.displayName || color.name, colorConfirmed: true }, 'recent_color')) } }) },
    copySku(sku) { if (!sku.skuId) return uni.showToast({ title: '请先保存该SKU', icon: 'none' }); const copy = copyProductSku(sku.skuId); this.skus.push({ ...copy, expanded: true, skuSpecificFacts: { ...(copy.skuSpecificFacts || {}) } }) },
    saveSku(sku) { try { const saved = saveProductSku({ ...sku, skuGroupId: this.group.skuGroupId }); Object.assign(sku, saved, { expanded: true }); uni.showToast({ title: 'SKU已保存', icon: 'success' }) } catch (error) { uni.showToast({ title: error.message, icon: 'none' }) } },
    removeAsset(sku, assetId) { sku.assets = sku.assets.filter((item) => item.assetId !== assetId); sku.assetColorConfirmed = false },
    uploadSkuAsset(sku) { uni.showActionSheet({ itemList: DETAIL_ASSET_USAGES.slice(0, 11).map((item) => item.label), success: ({ tapIndex }) => this.chooseAndUpload(sku, DETAIL_ASSET_USAGES[tapIndex].value) }) },
    pickAction(items) { return new Promise((resolve, reject) => uni.showActionSheet({ itemList: items, success: ({ tapIndex }) => resolve(tapIndex), fail: reject })) },
    batchUploadAssets() { uni.chooseImage({ count: 9, sourceType: ['album', 'camera'], success: async ({ tempFilePaths }) => { uni.showLoading({ title: '批量上传中' }); try { const pending = [...(this.group.pendingAssets || [])]; for (const path of tempFilePaths || []) { const uploaded = await uploadImage({ filePath: path, assetType: 'product_sku_source', targetType: 'sku_group', targetId: this.group.skuGroupId, relation: 'pending_assignment', scene: 'detail_sku_batch' }); if (uploaded.fileId) pending.push({ assetId: (uploaded.assetRecord && uploaded.assetRecord.fileId) || `asset_${Date.now()}_${pending.length}`, fileId: uploaded.fileId, localPath: path, usage: 'other', source: 'manual_upload', shared: false }) } this.group = saveSkuGroup({ ...this.group, pendingAssets: pending }) } catch (error) { uni.showToast({ title: '部分素材上传失败，请重试', icon: 'none' }) } finally { uni.hideLoading() } } }) },
    async assignPendingAsset(asset) { if (!this.skus.length) return uni.showToast({ title: '请先新增SKU', icon: 'none' }); try { const skuIndex = await this.pickAction(this.skus.map((item, index) => `${item.colorName || `SKU ${index + 1}`} · ${item.skuCode || '未填编码'}`)); const usageIndex = await this.pickAction(DETAIL_ASSET_USAGES.slice(0, 11).map((item) => item.label)); const sku = this.skus[skuIndex]; const usage = DETAIL_ASSET_USAGES[usageIndex].value; if (usage === 'product_main') sku.assets = sku.assets.filter((item) => item.usage !== 'product_main'); sku.assets.push({ ...asset, skuId: sku.skuId, usage, shared: false, colorConfirmed: false, styleConfirmed: false }); sku.assetColorConfirmed = false; this.group = saveSkuGroup({ ...this.group, pendingAssets: (this.group.pendingAssets || []).filter((item) => item.assetId !== asset.assetId) }); if (usage === 'product_main' && !sku.colorConfirmed) await this.suggestColorFromImage(sku, asset.localPath || asset.fileId) } catch (error) {} },
    chooseAndUpload(sku, usage) { uni.chooseImage({ count: 1, sourceType: ['album', 'camera'], success: async ({ tempFilePaths }) => { const path = (tempFilePaths || [])[0]; if (!path) return; uni.showLoading({ title: '上传中' }); try { const uploaded = await uploadImage({ filePath: path, assetType: 'product_sku_source', targetType: 'product_sku', targetId: sku.skuId || this.group.skuGroupId, relation: usage, scene: 'detail_sku_batch' }); const fileId = uploaded.fileId || ''; if (!fileId) throw new Error('未获得稳定文件地址'); if (usage === 'product_main') sku.assets = sku.assets.filter((item) => item.usage !== 'product_main'); sku.assets.push({ assetId: (uploaded.assetRecord && uploaded.assetRecord.fileId) || `asset_${Date.now()}`, fileId, localPath: path, usage, source: 'manual_upload', colorConfirmed: false, styleConfirmed: false }); sku.assetColorConfirmed = false; if (usage === 'product_main' && !sku.colorConfirmed) await this.suggestColorFromImage(sku, path) } catch (error) { uni.showToast({ title: '图片上传失败', icon: 'none' }) } finally { uni.hideLoading() } } }) },
    async suggestColorFromImage(sku, path) { try { const info = await imageInfo(path); this.canvasWidth = 64; this.canvasHeight = 64; await this.$nextTick(); await new Promise((resolve) => { const context = uni.createCanvasContext(this.canvasId, this); context.drawImage(path, 0, 0, 64, 64); context.draw(false, resolve) }); const pixels = await new Promise((resolve, reject) => uni.canvasGetImageData({ canvasId: this.canvasId, x: 0, y: 0, width: 64, height: 64, success: ({ data }) => resolve(data), fail: reject }, this)); const suggestion = extractDominantColors(pixels, { limit: 5, pixelStep: Math.max(1, Math.round((info.width * info.height) / 2000000)) })[0]; if (suggestion) { Object.assign(sku, createSkuColor({ ...suggestion, colorName: suggestion.displayName || suggestion.name, colorConfirmed: false }, 'dominant_color')); sku.colorConfirmed = false; uni.showToast({ title: '已提取颜色建议，请确认', icon: 'none' }) } } catch (error) { uni.showToast({ title: '颜色提取失败，可手动填写', icon: 'none' }) } },
    toggleModule(module) { if (module.id === 'hero') return; this.moduleIds = this.moduleIds.includes(module.id) ? this.moduleIds.filter((id) => id !== module.id) : [...this.moduleIds, module.id] },
    skuErrors(sku) { try { return validateSkuForRender(sku, { ...this.group, sharedModules: this.moduleIds }).errors } catch (error) { return [error.message] } },
    skuReadyText(sku) { return this.skuErrors(sku).length ? '资料待补充' : '可以生成' },
    saveAll() { this.group = saveSkuGroup({ ...this.group, productId: this.productId, sharedProfileVersion: this.profile.version, sharedModules: this.moduleIds, templateId: this.templateId, platformId: this.platformId }); this.skus = this.skus.map((sku) => ({ ...saveProductSku({ ...sku, skuGroupId: this.group.skuGroupId }), expanded: sku.expanded, skuSpecificFacts: { ...(sku.skuSpecificFacts || {}) } })) },
    async moduleImageInfo(modules) { const map = {}; for (const module of modules) { const source = module.localPath || module.fileUrl || module.fileId; if (source) map[module.id] = await imageInfo(source) } return map },
    async renderChild(child) { const paths = []; const modules = child.snapshot.contentSnapshot.map((module) => { const asset = child.draft.assets.find((item) => item.assetId === module.assetId); return { ...module, localPath: (asset && asset.localPath) || '', fileUrl: module.fileId } }); const imageInfoMap = await this.moduleImageInfo(modules); for (const segment of child.segments) { const prepared = { ...segment, modules: segment.modules.map((module) => ({ ...module, ...(modules.find((item) => item.id === module.id) || {}) })) }; this.canvasWidth = prepared.width; this.canvasHeight = prepared.height; await this.$nextTick(); await new Promise((resolve, reject) => { try { const context = uni.createCanvasContext(this.canvasId, this); drawDetailPageSegment(context, prepared, { sizeRows: child.snapshot.sizeChartSnapshot.rows, imageInfoMap, template: child.snapshot.render.template, platform: child.snapshot.platformId }); context.draw(false, resolve) } catch (error) { reject(error) } }); paths.push(await canvasPath(this.canvasId, this, prepared.width, prepared.height)) } return paths },
    async submitBatch() { if (this.submitting || !this.canSubmit) return; this.submitting = true; this.submitError = ''; try { this.saveAll(); const validIds = this.skus.filter((item) => item.selected && !this.skuErrors(item).length).map((item) => item.skuId); const execution = createSkuRenderBatch({ skuGroupId: this.group.skuGroupId, skuIds: validIds, moduleIds: this.moduleIds, templateId: this.templateId, platformId: this.platformId }); const jobs = []; for (const child of execution.children) { try { const paths = await this.renderChild(child); jobs.push(startSkuRenderChild(child, paths)) } catch (error) { jobs.push(Promise.reject(error)) } } Promise.allSettled(jobs); uni.navigateTo({ url: `/package-ai/detail-sku-batch-result/detail-sku-batch-result?batchId=${encodeURIComponent(execution.batchId)}` }) } catch (error) { this.submitError = error.message || '批量任务创建失败' } finally { this.submitting = false } }
  }
}
</script>

<style scoped>
.page{min-height:100vh;padding:24rpx 24rpx calc(190rpx + env(safe-area-inset-bottom));background:#f5f6fa;color:#101828;box-sizing:border-box}.intro,.section{margin-bottom:20rpx;padding:24rpx;border:1rpx solid #e4e7ec;border-radius:20rpx;background:#fff}.title,.section-title{display:block;font-size:32rpx;font-weight:700}.desc,.section-desc{display:block;margin-top:8rpx;color:#667085;font-size:22rpx;line-height:1.5}.section-head,.profile-row,.sku-head,.check-row,.color-row,.confirm-row,.sku-actions{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.profile-row{margin-top:18rpx;padding:18rpx;border-radius:14rpx;background:#f5f9ff}.profile-row text{display:block}.profile-row view text+text{margin-top:6rpx;color:#667085;font-size:21rpx}.link{color:#1677ff}.minor,.primary{margin:0;border:0;border-radius:12rpx;font-size:22rpx}.minor{height:62rpx;padding:0 18rpx;background:#eef4ff;color:#1677ff;line-height:62rpx}.primary{height:78rpx;background:#1677ff;color:#fff;line-height:78rpx}.sku-card{margin-top:16rpx;border:1rpx solid #e4e7ec;border-radius:16rpx;overflow:hidden}.sku-head{padding:18rpx}.swatch{width:52rpx;height:52rpx;flex:none;border:1rpx solid #d0d5dd;border-radius:50%}.sku-main{min-width:0;flex:1}.sku-main text{display:block;font-size:24rpx;font-weight:600}.sku-main text+text{margin-top:6rpx;color:#667085;font-size:20rpx;font-weight:400}.check{font-size:34rpx;color:#1677ff}.sku-edit{padding:18rpx;border-top:1rpx solid #eaecf0;background:#fafafa}.sku-edit input,.sku-edit textarea{height:72rpx;padding:0 16rpx;border:1rpx solid #d0d5dd;border-radius:12rpx;background:#fff;font-size:22rpx;box-sizing:border-box}.color-row{margin-top:12rpx}.color-row input{min-width:0;flex:1}.sku-edit textarea{width:100%;height:96rpx;margin-top:14rpx;padding-top:14rpx}.asset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12rpx;margin-top:16rpx}.asset,.upload{position:relative;min-height:168rpx;border:1rpx solid #d0d5dd;border-radius:12rpx;background:#fff;overflow:hidden}.asset image{width:100%;height:120rpx}.asset text,.upload text{display:block;padding:7rpx;text-align:center;font-size:19rpx}.asset .remove{position:absolute;top:4rpx;right:4rpx;border-radius:8rpx;background:rgba(0,0,0,.65);color:#fff}.upload{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1677ff}.upload text:first-child{font-size:42rpx}.confirm-row{align-items:flex-start;flex-direction:column;margin-top:16rpx;color:#344054;font-size:21rpx}.sku-actions{justify-content:flex-end;margin-top:14rpx}.check-row{padding:15rpx 0;border-bottom:1rpx solid #eaecf0;font-size:21rpx}.check-row text:last-child{max-width:65%;color:#067647;text-align:right}.check-row text.error,.error{color:#d92d20}.module-grid{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:16rpx}.module-grid text{min-height:62rpx;padding:0 18rpx;border:1rpx solid #d0d5dd;border-radius:12rpx;color:#475467;font-size:21rpx;line-height:62rpx}.module-grid text.active{border-color:#1677ff;background:#eef6ff;color:#1677ff;font-weight:700}.confirm-section>text:not(.section-title){display:block;margin-top:12rpx;color:#475467;font-size:22rpx}.bottom{position:fixed;z-index:10;right:0;bottom:0;left:0;display:flex;align-items:center;gap:18rpx;padding:16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));border-top:1rpx solid #e4e7ec;background:rgba(255,255,255,.98)}.bottom>text{color:#475467;font-size:21rpx}.bottom .primary{flex:1}.primary[disabled]{background:#98a2b3}.render-canvas{position:fixed;left:-10000px;top:-10000px;pointer-events:none}
</style>
