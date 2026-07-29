<template>
  <view class="container">
    <view class="card">
      <text class="title">提交成功</text>
      <text class="desc">需求已提交，我们会尽快联系您确认图片类型、数量和交付方式。</text>
      <text class="lead-id">线索编号：{{ leadId || '暂无' }}</text>
      <text class="status-line">当前状态：new · 待首次联系</text>
      <text class="privacy-line">企业素材仅用于需求沟通和项目评估，未经授权不会用于公开案例或 AI 训练。</text>
      <button class="primary-btn" @click="goToClientPortal">查看客户门户</button>
      <button class="primary-btn" @click="goToAdmin">查看线索</button>
      <button class="secondary-btn" @click="goToIndex">返回首页</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      leadId: ''
    }
  },
  onLoad(options) {
    this.leadId = (options && options.leadId) || ''
  },
  methods: {
    goToAdmin() {
      uni.navigateTo({
        url: '/pages/admin/admin'
      })
    },
    goToClientPortal() {
      uni.navigateTo({
        url: `/pages/client-portal/client-portal?tab=requests&leadId=${encodeURIComponent(this.leadId || '')}`
      })
    },
    goToIndex() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f6f6f9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
}

.card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  text-align: center;
}

.title {
  display: block;
  font-size: 42rpx;
  font-weight: 700;
  color: #222;
}

.desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #666;
}

.lead-id {
  display: block;
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #1677ff;
  word-break: break-all;
}

.status-line,
.privacy-line {
  display: block;
  margin-top: 14rpx;
  font-size: 23rpx;
  color: #475569;
  line-height: 1.5;
}

.primary-btn,
.secondary-btn {
  margin-top: 20rpx;
  border-radius: 999rpx;
}

.primary-btn {
  background: #1677ff;
  color: #fff;
}

.secondary-btn {
  background: #f5f5f5;
  color: #333;
}
</style>
