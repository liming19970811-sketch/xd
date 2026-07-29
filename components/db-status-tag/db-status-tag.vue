<template>
  <text class="db-status-tag" :class="statusClass">{{ label }}</text>
</template>

<script>
const TYPE_CLASS = {
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
  error: 'is-danger',
  failed: 'is-danger',
  processing: 'is-warning',
  pending: 'is-warning',
  disabled: 'is-disabled'
}

export default {
  name: 'DbStatusTag',
  props: {
    label: {
      type: String,
      default: '未知'
    },
    type: {
      type: String,
      default: 'default'
    }
  },
  computed: {
    statusClass() {
      return TYPE_CLASS[this.type] || ''
    }
  }
}
</script>

<style scoped>
.db-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 var(--db-space-2);
  border-radius: var(--db-radius-pill);
  background: var(--db-color-surface-muted);
  color: var(--db-color-text-muted);
  font-size: var(--db-font-size-xs);
  font-weight: 900;
}
.db-status-tag.is-success {
  background: var(--db-color-success-soft);
  color: var(--db-color-success);
}
.db-status-tag.is-warning {
  background: var(--db-color-warning-soft);
  color: var(--db-color-warning);
}
.db-status-tag.is-danger {
  background: var(--db-color-danger-soft);
  color: var(--db-color-danger);
}
.db-status-tag.is-disabled {
  opacity: .56;
}
</style>
