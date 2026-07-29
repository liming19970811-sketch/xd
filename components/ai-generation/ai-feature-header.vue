<template>
  <view class="ai-feature-header">
    <view class="ai-feature-header-copy">
      <text class="ai-feature-header-title">{{ title }}</text>
      <text v-if="description" class="ai-feature-header-description">{{ description }}</text>
    </view>
    <view v-if="helpText" class="ai-feature-header-help" @click="$emit('help')">{{ helpText }}</view>
  </view>
</template>

<script>
export default {
  name: 'AiFeatureHeader',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    helpText: { type: String, default: '' }
  }
}
</script>

<style scoped>
.ai-feature-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
  padding: 28rpx 30rpx;
  border: 1rpx solid #e7eaf0;
  border-radius: 32rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.ai-feature-header-copy { min-width: 0; flex: 1; }

.ai-feature-header-title,
.ai-feature-header-description { display: block; }

.ai-feature-header-title {
  color: #1f2937;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.3;
}

.ai-feature-header-description {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 25rpx;
  line-height: 1.5;
}

.ai-feature-header-help {
  flex-shrink: 0;
  min-height: 64rpx;
  padding: 0 12rpx;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 64rpx;
}
</style>

