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

    <!-- 加载中 / 错误 -->
    <view v-if="kanban.loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="kanban.error" class="error-state">
      <text class="error-text">{{ kanban.error }}</text>
      <view class="retry-btn" @click="kanban.refresh()">重试</view>
    </view>

    <!-- 正常内容 -->
    <template v-else>
      <!-- 统计卡片 -->
      <view class="stats-bar">
        <view class="stat-chip">
          <text class="stat-chip-num">{{ kanban.stats.backlog }}</text>
          <text class="stat-chip-label">待办</text>
        </view>
        <view class="stat-chip active-chip">
          <text class="stat-chip-num">{{ kanban.stats.in_progress }}</text>
          <text class="stat-chip-label">进行中</text>
        </view>
        <view class="stat-chip done-chip">
          <text class="stat-chip-num">{{ kanban.stats.done }}</text>
          <text class="stat-chip-label">已完成</text>
        </view>
      </view>

      <!-- 筛选栏 -->
      <view class="filter-row">
        <picker
          class="filter-picker"
          mode="selector"
          :range="projectOptions"
          :value="projectIndex"
          @change="onProjectChange"
        >
          <view class="picker-trigger">
            <text class="picker-text">{{ kanban.filter.project || '全部项目' }}</text>
            <text class="picker-arrow">▼</text>
          </view>
        </picker>
        <picker
          class="filter-picker"
          mode="selector"
          :range="assigneeOptions"
          :value="assigneeIndex"
          @change="onAssigneeChange"
        >
          <view class="picker-trigger">
            <text class="picker-text">{{ kanban.filter.assignee || '全部负责人' }}</text>
            <text class="picker-arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 三列看板 -->
      <view class="kanban-columns">
        <view
          v-for="col in columns"
          :key="col.key"
          class="kanban-col"
        >
          <view class="col-header">
            <view class="col-dot" :style="{ background: col.dotColor }" />
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
              @dragover.prevent
              @drop="onDrop(col.key, $event)"
            >
              <view class="task-header">
                <Badge
                  :text="task.priority"
                  :type="priorityType(task.priority)"
                />
                <text class="task-id">{{ task.id }}</text>
              </view>
              <text class="task-title">{{ cleanTitle(task.title) }}</text>
              <view class="task-footer">
                <text class="task-project" v-if="task.project">{{ task.project }}</text>
                <text class="task-assignee" v-if="task.assignee">{{ task.assignee }}</text>
              </view>
            </view>

            <!-- 空状态 -->
            <view v-if="col.tasks.length === 0" class="col-empty">
              <text class="col-empty-text">暂无任务</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useKanbanStore, type TaskItem } from '@/store/kanban'
import Badge from '@/components/Badge.vue'

const kanban = useKanbanStore()
const currentTab = ref('kanban')
const draggedTask = ref<TaskItem | null>(null)

// ── 生命周期 ─────────────────────────────────────────────────────────────────

onMounted(() => {
  kanban.refresh()
})

// ── Tab 导航 ─────────────────────────────────────────────────────────────────

const tabs = [
  { key: 'dashboard', label: '统计' },
  { key: 'kanban', label: '任务' },
  { key: 'agents', label: 'Agent' },
]

function switchTab(key: string) {
  currentTab.value = key
  const routes: Record<string, string> = {
    dashboard: '/pages/dashboard/dashboard',
    kanban: '/pages/kanban/kanban',
    agents: '/pages/agents/agents',
  }
  uni.reLaunch({ url: routes[key] })
}

// ── 列数据 ───────────────────────────────────────────────────────────────────

const columns = computed(() => [
  {
    key: 'backlog' as const,
    label: '待办',
    dotColor: '#8a8f98',
    tasks: kanban.backlog,
  },
  {
    key: 'in_progress' as const,
    label: '进行中',
    dotColor: '#5e6ad2',
    tasks: kanban.inProgress,
  },
  {
    key: 'done' as const,
    label: '已完成',
    dotColor: '#22c55e',
    tasks: kanban.done,
  },
])

// ── 筛选 ─────────────────────────────────────────────────────────────────────

// 从现有任务中提取项目/负责人列表（去重）
const projectOptions = computed(() => {
  const all = [...kanban.backlog, ...kanban.inProgress, ...kanban.done]
  const set = new Set(all.map(t => t.project).filter(Boolean))
  return ['全部项目', ...Array.from(set)]
})

const assigneeOptions = computed(() => {
  const all = [...kanban.backlog, ...kanban.inProgress, ...kanban.done]
  const set = new Set(all.map(t => t.assignee).filter(Boolean))
  return ['全部负责人', ...Array.from(set)]
})

const projectIndex = computed(() => {
  if (!kanban.filter.project) return 0
  return projectOptions.value.indexOf(kanban.filter.project)
})

const assigneeIndex = computed(() => {
  if (!kanban.filter.assignee) return 0
  return assigneeOptions.value.indexOf(kanban.filter.assignee)
})

function onProjectChange(e: any) {
  const idx = e.detail.value
  kanban.setFilter({ project: idx > 0 ? projectOptions.value[idx] : '' })
}

function onAssigneeChange(e: any) {
  const idx = e.detail.value
  kanban.setFilter({ assignee: idx > 0 ? assigneeOptions.value[idx] : '' })
}

// ── 拖拽 ─────────────────────────────────────────────────────────────────────

function onDragStart(task: TaskItem) {
  draggedTask.value = task
}

function onDrop(targetStatus: 'backlog' | 'in_progress' | 'done', _e?: any) {
  if (!draggedTask.value) return
  kanban.moveTask(draggedTask.value.id, targetStatus)
  draggedTask.value = null
}

// ── 辅助 ─────────────────────────────────────────────────────────────────────

function priorityType(p: string): 'error' | 'warning' | 'default' {
  if (p === 'P0') return 'error'
  if (p === 'P1') return 'warning'
  return 'default'
}

/** 去掉标题中 [P0] 这类前缀（Badge 已经单独显示） */
function cleanTitle(title: string): string {
  return title.replace(/^\[P\d+\]\s*/, '')
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

// ── 加载/错误 ────────────────────────────────────────────────────────────────

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
}
.loading-text { color: #8a8f98; font-size: 14px; }

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  background: #0f1011;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin-bottom: 16px;
}
.error-text { color: #ef4444; font-size: 13px; }
.retry-btn {
  padding: 6px 20px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
}

// ── 统计卡片 ─────────────────────────────────────────────────────────────────

.stats-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.stat-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;

  &.active-chip {
    border-color: rgba(94, 106, 210, 0.4);
    background: rgba(94, 106, 210, 0.08);
  }
  &.done-chip {
    border-color: rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.06);
  }
}

.stat-chip-num {
  font-size: 18px;
  font-weight: 700;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
}

.stat-chip-label {
  font-size: 12px;
  color: #8a8f98;
}

// ── 筛选栏 ───────────────────────────────────────────────────────────────────

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.filter-picker {
  flex: 1;
  height: 36px;
}

.picker-trigger {
  height: 36px;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.picker-text {
  font-size: 13px;
  color: #d0d6e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-arrow {
  font-size: 10px;
  color: #62666d;
  flex-shrink: 0;
}

// ── 三列看板 ─────────────────────────────────────────────────────────────────

.kanban-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  min-height: 60vh;
}

.kanban-col {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.col-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.col-title {
  font-size: 13px;
  font-weight: 600;
  color: #d0d6e0;
}

.col-count {
  margin-left: auto;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  color: #8a8f98;
  font-family: 'JetBrains Mono', monospace;
}

.col-body {
  flex: 1;
  padding: 6px;
  overflow-y: auto;
  max-height: calc(100vh - 280px);
}

.col-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}
.col-empty-text {
  font-size: 12px;
  color: #62666d;
}

// ── 任务卡片 ─────────────────────────────────────────────────────────────────

.task-card {
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: grab;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(94, 106, 210, 0.35);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  &:active {
    cursor: grabbing;
    opacity: 0.85;
  }
}

.task-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.task-id {
  font-size: 10px;
  color: #62666d;
  font-family: 'JetBrains Mono', monospace;
}

.task-title {
  font-size: 13px;
  color: #f7f8f8;
  font-weight: 500;
  margin-bottom: 6px;
  display: block;
  line-height: 1.4;
  word-break: break-word;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-project {
  font-size: 10px;
  color: #8a8f98;
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
}

.task-assignee {
  font-size: 10px;
  color: #5e6ad2;
  font-weight: 500;
}
</style>
