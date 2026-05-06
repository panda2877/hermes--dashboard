<template>
  <view class="badge" :class="typeClass">{{ text }}</view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
  type?: 'default' | 'primary' | 'success' | 'warning' | 'error'
}>()

const typeClass = computed(() => {
  return props.type || 'default'
})
</script>

<style lang="scss" scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;

  &.default {
    background: rgba(255, 255, 255, 0.08);
    color: #d0d6e0;
  }

  &.primary {
    background: rgba(94, 106, 210, 0.2);
    color: #7170ff;
  }

  &.success {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  &.warning {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  &.error {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
}
</style>
