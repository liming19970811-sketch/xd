<template>
  <view v-if="!keyboardVisible" class="generation-action-bar">
    <view class="generation-action-inner">
      <view class="generation-action-copy">
        <text class="generation-action-summary">{{ displaySummary }}</text>
        <text v-if="reason" class="generation-action-reason">{{ reason }}</text>
      </view>
      <button
        class="generation-action-button"
        :class="{ disabled: disabled || loading }"
        :disabled="disabled || loading"
        @click="$emit('generate')"
      >{{ loading ? loadingText : buttonText }}</button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'GenerationActionBar',
  props: {
    summary: { type: String, default: '' },
    buttonText: { type: String, required: true },
    loadingText: { type: String, default: '正在提交…' },
    reason: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    keyboardVisible: { type: Boolean, default: false }
  },
  computed: {
    displaySummary() {
      return this.summary || this.reason || '完成配置后即可生成'
    }
  }
}
</script>

<style scoped>
.generation-action-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 80;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -10rpx 28rpx rgba(15, 23, 42, 0.07);
  box-sizing: border-box;
}

.generation-action-inner {
  display: flex;
  align-items: center;
  gap: 20rpx;
  max-width: 750rpx;
  margin: 0 auto;
}

.generation-action-copy { min-width: 0; flex: 1; }

.generation-action-summary,
.generation-action-reason {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.generation-action-summary {
  color: #334155;
  font-size: 23rpx;
  font-weight: 600;
}

.generation-action-reason {
  margin-top: 6rpx;
  color: #c2410c;
  font-size: 20rpx;
}

.generation-action-button {
  flex: 0 0 276rpx;
  height: 96rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 20rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 96rpx;
}

.generation-action-button::after { border: 0; }
.generation-action-button.disabled { background: #cbd5e1; color: #ffffff; }

@media screen and (max-width: 350px) {
  .generation-action-inner { gap: 14rpx; }
  .generation-action-button { flex-basis: 244rpx; font-size: 25rpx; }
  .generation-action-summary { font-size: 21rpx; }
}
</style>
