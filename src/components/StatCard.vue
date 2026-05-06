<template>
  <view class="stat-card" @click="$emit('click')">
    <view class="stat-label">{{ label }}</view>
    <view class="stat-value">{{ value }}</view>
    <view v-if="change !== undefined" class="stat-change" :class="changeClass">
      <text>{{ change >= 0 ? '↑' : '↓' }}</text>
      <text>{{ Math.abs(change) }}%</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: string | number
  change?: number
}>()

defineEmits(['click'])

const changeClass = computed(() => {
  if (props.change === undefined) return ''
  return props.change >= 0 ? 'up' : 'down'
})
</script>

<style lang="scss" scoped>
.stat-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #191a1b;
  }
}

.stat-label {
  font-size: 12px;
  color: #8a8f98;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
}

.stat-change {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  margin-top: 4px;

  &.up {
    color: #22c55e;
  }
  &.down {
    color: #ef4444;
  }
}
</style>
