<template>
  <view class="kanban-page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="nav-title">任务看板</view>
      <view class="nav-tabs">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-tab"
          :class="{ active: currentTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </view>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-row">
      <u-input
        v-model="projectFilter"
        placeholder="项目"
        :clearable="true"
        :custom-style="{ backgroundColor: '#191a1b', color: '#f7f8f8', borderColor: 'rgba(255,255,255,0.08)' }"
        class="filter-input"
      />
      <u-input
        v-model="assigneeFilter"
        placeholder="负责人"
        :clearable="true"
        :custom-style="{ backgroundColor: '#191a1b', color: '#f7f8f8', borderColor: 'rgba(255,255,255,0.08)' }"
        class="filter-input"
      />
    </view>

    <!-- 三列看板 -->
    <view class="kanban-columns">
      <view
        v-for="col in columns"
        :key="col.key"
        class="kanban-col"
        @dragover.prevent
        @drop="onDrop(col.key)"
      >
        <view class="col-header">
          <text class="col-title">{{ col.label }}</text>
          <text class="col-count">{{ col.tasks.length }}</text>
        </view>
        <view class="col-body">
          <view
            v-for="task in col.tasks"
            :key="task.id"
            class="task-card"
            :draggable="true"
            @dragstart="onDragStart(task)"
          >
            <view class="task-header">
              <Badge
                :text="task.priority"
                :type="priorityType(task.priority)"
              />
              <text class="task-id">{{ task.id }}</text>
            </view>
            <text class="task-title">{{ task.title }}</text>
            <view class="task-footer">
              <text class="task-project">{{ task.project }}</text>
              <text class="task-assignee">{{ task.assignee }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKanbanStore, type TaskItem } from '@/store/kanban'
import Badge from '@/components/Badge.vue'

const kanban = useKanbanStore()
const currentTab = ref('kanban')
const projectFilter = ref('')
const assigneeFilter = ref('')
const draggedTask = ref<TaskItem | null>(null)

const tabs = [
  { key: 'dashboard', label: '统计' },
  { key: 'kanban', label: '任务' },
  { key: 'agents', label: 'Agent' },
]

const columns = computed(() => [
  {
    key: 'backlog' as const,
    label: '待办',
    tasks: filterTasks(kanban.columns.backlog),
  },
  {
    key: 'in_progress' as const,
    label: '进行中',
    tasks: filterTasks(kanban.columns.inProgress),
  },
  {
    key: 'done' as const,
    label: '已完成',
    tasks: filterTasks(kanban.columns.done),
  },
])

function filterTasks(tasks: TaskItem[]): TaskItem[] {
  return tasks.filter(t => {
    if (projectFilter.value && !t.project.includes(projectFilter.value)) return false
    if (assigneeFilter.value && !t.assignee.includes(assigneeFilter.value)) return false
    return true
  })
}

function priorityType(p: string): 'error' | 'warning' | 'default' {
  if (p === 'P0') return 'error'
  if (p === 'P1') return 'warning'
  return 'default'
}

function onDragStart(task: TaskItem) {
  draggedTask.value = task
}

function onDrop(targetStatus: 'backlog' | 'in_progress' | 'done') {
  if (!draggedTask.value) return
  kanban.moveTask(draggedTask.value.id, targetStatus)
  draggedTask.value = null
}

function switchTab(key: string) {
  currentTab.value = key
  const routes: Record<string, string> = {
    dashboard: '/pages/dashboard/dashboard',
    kanban: '/pages/kanban/kanban',
    agents: '/pages/agents/agents',
  }
  uni.reLaunch({ url: routes[key] })
}
</script>

<style lang="scss" scoped>
.kanban-page {
  padding: 20px 16px;
  background: #08090a;
  min-height: 100vh;
}

.nav-bar {
  margin-bottom: 16px;
}

.nav-title {
  font-size: 22px;
  font-weight: 700;
  color: #f7f8f8;
  margin-bottom: 12px;
}

.nav-tabs {
  display: flex;
  gap: 4px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px;
}

.nav-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-radius: 6px;
  font-size: 14px;
  color: #8a8f98;
  cursor: pointer;

  &.active {
    background: #191a1b;
    color: #f7f8f8;
    font-weight: 600;
  }
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-input {
  flex: 1;
}

.kanban-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  min-height: 60vh;
}

.kanban-col {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.col-title {
  font-size: 14px;
  font-weight: 600;
  color: #d0d6e0;
}

.col-count {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #8a8f98;
}

.col-body {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.task-card {
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: grab;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(94, 106, 210, 0.4);
    transform: translateY(-1px);
  }
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.task-id {
  font-size: 11px;
  color: #62666d;
  font-family: 'JetBrains Mono', monospace;
}

.task-title {
  font-size: 14px;
  color: #f7f8f8;
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-project {
  font-size: 11px;
  color: #8a8f98;
}

.task-assignee {
  font-size: 11px;
  color: #5e6ad2;
}
</style>