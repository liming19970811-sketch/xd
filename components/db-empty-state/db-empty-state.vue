<template>
  <view class="db-empty-state">
    <view>
      <text class="db-empty-title">{{ title }}</text>
      <text class="db-empty-message">{{ message }}</text>
    </view>
    <button v-if="actionLabel" class="db-empty-action" :disabled="loading || disabled" @click="$emit('action')">
      {{ loading ? loadingText : actionLabel }}
    </button>
  </view>
</template>

<script>
export default {
  name: 'DbEmptyState',
  props: {
    title: {
      type: String,
      default: '暂无数据'
    },
    message: {
      type: String,
      default: '当前没有可展示内容。'
    },
    actionLabel: {
      type: String,
      default: ''
    },
    loadingText: {
      type: String,
      default: '处理中...'
    },
    loading: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped>
.db-empty-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--db-space-4);
  padding: var(--db-space-5);
  border: 1px dashed var(--db-color-border-strong);
  border-radius: var(--db-radius-lg);
  background: var(--db-color-surface-muted);
  box-sizing: border-box;
}
.db-empty-title,
.db-empty-message {
  display: block;
}
.db-empty-title {
  color: var(--db-color-text);
  font-size: var(--db-font-size-md);
  font-weight: 950;
}
.db-empty-message {
  margin-top: var(--db-space-2);
  color: var(--db-color-text-muted);
  font-size: var(--db-font-size-sm);
  line-height: var(--db-line-normal);
}
.db-empty-action {
  flex: 0 0 auto;
  min-height: var(--db-control-height);
  margin: 0;
  padding: 0 var(--db-space-4);
  border-radius: var(--db-radius-pill);
  background: var(--db-color-primary);
  color: #fff;
  font-size: var(--db-font-size-sm);
  font-weight: 900;
  line-height: var(--db-control-height);
}
.db-empty-action[disabled] {
  opacity: .56;
}
@media (max-width: 768px) {
  .db-empty-state {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
