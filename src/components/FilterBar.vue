<template>
  <view class="filter-bar">
    <u-input
      v-model="projectModel"
      placeholder="项目"
      :clearable="true"
      class="filter-input"
    />
    <u-input
      v-model="assigneeModel"
      placeholder="负责人"
      :clearable="true"
      class="filter-input"
    />
    <u-button type="primary" size="small" @click="apply">筛选</u-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  project: string
  assignee: string
}>()

const emit = defineEmits(['update:project', 'update:assignee', 'apply'])

const projectModel = ref(props.project)
const assigneeModel = ref(props.assignee)

function apply() {
  emit('update:project', projectModel.value)
  emit('update:assignee', assigneeModel.value)
  emit('apply')
}
</script>

<style lang="scss" scoped>
.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  background: #0f1011;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.filter-input {
  flex: 1;
}
</style>
