<template>
  <view class="kanban-page">
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-bar-brand">
        <image class="top-logo" src="/static/icons/kanban-active.svg" mode="aspectFit" />
        <view class="top-brand-text">Hermes</view>
      </view>
      <view class="top-bar-content">
        <view class="top-bar-title-row">
          <text class="top-title">任务看板</text>
          <text class="top-subtitle">Hermes 任务状态一览</text>
        </view>
        <view class="sub-tab-bar">
          <view
            v-for="tab in subTabs"
            :key="tab.key"
            class="sub-tab"
            :class="{ active: activeSubTab === tab.key }"
            @click="activeSubTab = tab.key"
          >
            {{ tab.label }}
          </view>
        </view>
      </view>
    </view>

    <!-- ========== Sub-View A: 任务看板 ========== -->
    <view v-if="activeSubTab === 'board'" class="page-body">

      <!-- Loading / Error -->
      <view v-if="kanban.loading && kanban.backlog.length === 0 && kanban.inProgress.length === 0 && kanban.done.length === 0" class="loading-state">
        <text class="loading-text">加载中...</text>
      </view>
      <view v-else-if="kanban.error" class="error-state">
        <text class="error-text">{{ kanban.error }}</text>
        <view class="retry-btn" @click="kanban.refresh()">重试</view>
      </view>

      <template v-else>
        <!-- Stats Bar -->
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

        <!-- Filter Row -->
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
              <text class="picker-text">{{ assigneeZh(kanban.filter.assignee) || '全部负责人' }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
          <view class="refresh-btn" @click="kanban.refresh()">
            <text class="refresh-icon" :class="{ spinning: kanban.loading }">↻</text>
          </view>
        </view>

        <!-- Three Column Kanban -->
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
                  <Badge :text="task.priority" :type="priorityType(task.priority)" />
                  <text class="task-id">{{ task.id }}</text>
                </view>
                <text class="task-title">{{ cleanTitle(task.title) }}</text>
                <view class="task-footer">
                  <text class="task-project" v-if="task.project">{{ task.project }}</text>
                  <text class="task-assignee" v-if="task.assigneeZh">{{ task.assigneeZh }}</text>
                </view>
              </view>
              <view v-if="col.tasks.length === 0" class="col-empty">
                <text class="col-empty-text">暂无任务</text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </view>

    <!-- ========== Sub-View B: 里程碑看板（三期重构：项目-里程碑-任务三层） ========== -->
    <view v-if="activeSubTab === 'milestone'" class="page-body">

      <!-- Loading -->
      <view v-if="milestonesLoading" class="loading-state">
        <text class="loading-text">加载中...</text>
      </view>

      <!-- Error -->
      <view v-else-if="milestonesError" class="error-state">
        <text class="error-text">{{ milestonesError }}</text>
        <view class="retry-btn" @click="fetchMilestones()">重试</view>
      </view>

      <template v-else>
        <view class="milestone-list">
        <view
          v-for="proj in projects"
          :key="proj.name"
          class="project-card"
          :class="{ 'active-project': proj.progress > 0 && proj.progress < 100 }"
        >
          <!-- 项目层 header -->
          <view class="project-header" @click="toggleProject(proj)">
            <view class="project-header-left">
              <view class="project-icon" :style="{ background: proj.iconBg }">
                <text class="project-icon-text">{{ proj.iconText }}</text>
              </view>
              <text class="project-name">{{ proj.name }}</text>
            </view>
            <view class="project-header-right">
              <view class="project-progress-info">
                <view class="project-bar-wrap">
                  <view
                    class="project-bar-fill"
                    :style="{
                      width: proj.progress + '%',
                      background: projectBarColor(proj.progress)
                    }"
                  />
                </view>
                <text class="project-pct" :style="{ color: projectBarColor(proj.progress) }">
                  {{ proj.progress }}%
                </text>
              </view>
              <text class="project-count">{{ proj.done }}/{{ proj.total }} 任务</text>
              <view class="project-toggle" :class="{ open: proj.expanded }">
                <text class="toggle-arrow">▼</text>
              </view>
            </view>
          </view>
          <!-- 里程碑容器（项目内部） -->
          <view class="project-milestones" :class="{ open: proj.expanded }">
            <view
              v-for="m in proj.milestones"
              :key="m.name"
              class="milestone-item"
              :class="{ 'active-milestone': m.progress > 0 && m.progress < 100 }"
            >
              <view class="milestone-header">
                <view class="milestone-header-left" @click="toggleMilestoneTasks(m)">
                  <view class="milestone-dot" :style="{ background: milestoneDotColor(m.progress) }" />
                  <text class="milestone-name">{{ m.name }}</text>
                </view>
                <view class="milestone-header-right">
                  <view class="milestone-progress-compact">
                    <view class="milestone-bar-wrap">
                      <view
                        class="milestone-bar-fill"
                        :style="{
                          width: m.progress + '%',
                          background: milestoneBarColor(m.progress)
                        }"
                      />
                    </view>
                    <text class="milestone-pct" :style="{ color: milestonePctColor(m.progress) }">
                      {{ m.progress }}%
                    </text>
                  </view>
                  <text class="milestone-meta-text">{{ m.done }}/{{ m.total }}</text>
                  <view
                    class="milestone-arrow"
                    :class="{ open: m.tasksExpanded }"
                    @click.stop="toggleMilestoneTasks(m)"
                  >
                    <text class="toggle-arrow">▼</text>
                  </view>
                </view>
              </view>
              <!-- 任务明细（里程碑内部） -->
              <view v-if="m.tasksExpanded" class="milestone-tasks" :class="{ open: m.tasksExpanded }">
                <view
                  v-for="task in m.tasks"
                  :key="task.id"
                  class="milestone-task-row"
                >
                  <view class="milestone-task-status" :style="{ background: taskStatusColor(task.progress) }" />
                  <text class="milestone-task-name">{{ task.title }}</text>
                  <text class="milestone-task-assignee">{{ task.assignee }}</text>
                  <Badge :text="task.priority" :type="priorityType(task.priority)" />
                </view>
              </view>
            </view>
          </view>
        </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useKanbanStore, type TaskItem } from '@/store/kanban'
import Badge from '@/components/Badge.vue'

const kanban = useKanbanStore()
const draggedTask = ref<TaskItem | null>(null)
const activeSubTab = ref('board')

const subTabs = [
  { key: 'board', label: '任务看板' },
  { key: 'milestone', label: '里程碑看板' },
]

// ── Projects / Milestones (from BFF API) ──────────────────────────────────────
interface MilestoneTask {
  id: string
  title: string
  assignee: string
  priority: string
  progress: number
}

interface Milestone {
  name: string
  total: number
  done: number
  progress: number
  tasksExpanded: boolean
  tasks: MilestoneTask[]
}

interface Project {
  name: string
  iconText: string
  iconBg: string
  total: number
  done: number
  progress: number
  expanded: boolean
  milestones: Milestone[]
}

const projects = ref<Project[]>([])
const milestonesLoading = ref(false)
const milestonesError = ref('')

async function fetchMilestones() {
  milestonesLoading.value = true
  milestonesError.value = ''
  try {
    const res = await uni.request({
      url: '/api/kanban/milestones',
      method: 'GET',
    })
    const body = res.data as any
    if (body.data) {
      // 给每个 project 加 expanded 状态，给每个 milestone 加 tasksExpanded
      projects.value = body.data.map((p: any) => ({
        ...p,
        expanded: true, // 项目默认展开
        milestones: (p.milestones || []).map((m: any) => ({
          ...m,
          tasksExpanded: false, // 里程碑默认折叠
        })),
      }))
    }
  } catch (err: any) {
    milestonesError.value = err.message || '加载失败'
    console.error('[milestones]', err)
  } finally {
    milestonesLoading.value = false
  }
}

function toggleProject(proj: Project) {
  proj.expanded = !proj.expanded
}

function toggleMilestoneTasks(m: Milestone) {
  m.tasksExpanded = !m.tasksExpanded
}

function projectBarColor(progress: number): string {
  if (progress >= 100) return '#22c55e'
  if (progress > 50) return '#10b981'
  if (progress > 0) return '#7170ff'
  return '#62666d'
}

function milestoneDotColor(progress: number): string {
  if (progress >= 100) return '#10b981'
  if (progress > 0) return '#7170ff'
  return '#62666d'
}

function milestoneBarColor(progress: number): string {
  if (progress >= 100) return '#10b981'
  if (progress > 0) return '#7170ff'
  return '#62666d'
}

function milestonePctColor(progress: number): string {
  if (progress >= 100) return '#22c55e'
  if (progress > 0) return '#7170ff'
  return '#8a8f98'
}

function taskStatusColor(progress: number): string {
  if (progress >= 100) return '#10b981'
  if (progress > 0) return '#7170ff'
  return '#62666d'
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  kanban.refresh()
  fetchMilestones()
})

// ── Kanban Columns ───────────────────────────────────────────────────────────
const columns = computed(() => [
  { key: 'backlog' as const, label: '待办', dotColor: '#8a8f98', tasks: kanban.backlog },
  { key: 'in_progress' as const, label: '进行中', dotColor: '#5e6ad2', tasks: kanban.inProgress },
  { key: 'done' as const, label: '已完成', dotColor: '#22c55e', tasks: kanban.done },
])

// ── Filters ─────────────────────────────────────────────────────────────────
const projectOptions = computed(() => {
  const set = new Set(kanban.allTasks.map(t => t.project).filter(Boolean))
  return ['全部项目', ...Array.from(set)]
})

const projectIndex = computed(() => {
  if (!kanban.filter.project) return 0
  return projectOptions.value.indexOf(kanban.filter.project)
})

function onProjectChange(e: any) {
  const idx = e.detail.value
  kanban.setFilter({ project: idx > 0 ? projectOptions.value[idx] : '' })
}

// ── Drag ─────────────────────────────────────────────────────────────────────
function onDragStart(task: TaskItem) {
  draggedTask.value = task
}

function onDrop(targetStatus: 'backlog' | 'in_progress' | 'done', _e?: any) {
  if (!draggedTask.value) return
  kanban.moveTask(draggedTask.value.id, targetStatus)
  draggedTask.value = null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const ASSIGNEE_ZH: Record<string, string> = {
  'yinyue': '银月', 'xingruyin': '辛如音', 'ziling': '紫灵', 'siyue': '思月',
}

function assigneeZh(en: string): string {
  if (!en) return ''
  return en.split(',').map(s => ASSIGNEE_ZH[s.trim()] || s.trim()).join(', ')
}

const ASSIGNEE_KEYS = Object.keys(ASSIGNEE_ZH)

const assigneeOptions = computed(() => ['全部负责人', ...ASSIGNEE_KEYS.map(k => ASSIGNEE_ZH[k] || k)])

const assigneeIndex = computed(() => {
  if (!kanban.filter.assignee) return 0
  const zh = assigneeZh(kanban.filter.assignee)
  return assigneeOptions.value.indexOf(zh) >= 0 ? assigneeOptions.value.indexOf(zh) : 0
})

function onAssigneeChange(e: any) {
  const idx = e.detail.value
  kanban.setFilter({ assignee: idx > 0 ? ASSIGNEE_KEYS[idx - 1] : '' })
}

function priorityType(p: string): 'error' | 'warning' | 'default' {
  if (p === 'P0') return 'error'
  if (p === 'P1') return 'warning'
  return 'default'
}

function cleanTitle(title: string): string {
  return title.replace(/^\[P\d+\]\s*/, '')
}
</script>

<style lang="scss" scoped>
.kanban-page {
  padding: 0 0 20px;
  background: #08090a;
  min-height: 100vh;
  overflow-x: hidden;
  touch-action: pan-y;
}

/* Top Bar */
.top-bar {
  padding: 16px 16px 0;
}

.top-bar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.top-logo {
  width: 28px;
  height: 28px;
}

.top-brand-text {
  font-size: 14px;
  font-weight: 600;
  color: #f7f8f8;
  letter-spacing: -0.02em;
}

.top-bar-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.top-bar-title-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.top-title {
  font-size: 22px;
  font-weight: 700;
  color: #f7f8f8;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.top-subtitle {
  font-size: 13px;
  color: #8a8f98;
}

/* Sub-Tab Bar (inline in title row) */
.sub-tab-bar {
  display: flex;
  gap: 2px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 3px;
  flex-shrink: 0;
  align-self: flex-start;
}

.sub-tab {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #8a8f98;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &.active {
    background: #191a1b;
    color: #f7f8f8;
    font-weight: 600;
  }
}

/* Page Body */
.page-body {
  padding: 0 16px;
}

/* Loading/Error */
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

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
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

/* Filter Row */
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: nowrap;
}

.filter-picker {
  flex: 1;
  height: 36px;
  min-width: 0;
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
  flex: 1;
}

.picker-arrow {
  font-size: 10px;
  color: #62666d;
  flex-shrink: 0;
  margin-left: 4px;
}

.refresh-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.refresh-icon {
  font-size: 18px;
  color: #8a8f98;
  display: inline-block;

  &.spinning {
    animation: spin 1s linear infinite;
    color: #5e6ad2;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Kanban Columns */
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
  max-height: calc(100vh - 340px);
}

.col-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}
.col-empty-text { font-size: 12px; color: #62666d; }

/* Task Card */
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

  &:active { cursor: grabbing; opacity: 0.85; }
}

.task-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.task-id {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: #62666d;
}

.task-title {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #f7f8f8;
  line-height: 1.4;
  margin-bottom: 6px;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.task-project {
  font-size: 11px;
  color: #8a8f98;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-assignee {
  font-size: 11px;
  color: #62666d;
  flex-shrink: 0;
}

/* ===== Milestone Board — 三期重构：项目-里程碑-任务三层 ===== */
.milestone-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* --- 项目层卡片 --- */
.project-card {
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.15s ease;
  overflow: hidden;

  &:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }
  &.active-project {
    border-color: rgba(113, 112, 255, 0.3);
  }
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }
}

/* 移动端：第一层项目标题和进度条分两行 */
@media (max-width: 768px) {
  .project-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px 16px 10px;
  }
  .project-header-left {
    flex: none;
    width: 100%;
    margin-bottom: 0;
  }
  .project-header-right {
    flex: none;
    width: 100%;
    gap: 10px;
    justify-content: flex-end;
  }
  .project-progress-info {
    flex: none;
  }
  .project-bar-wrap {
    width: 120px;
    max-width: none;
  }
  .project-count {
    flex-shrink: 0;
  }

  /* 第二层里程碑也分两行 */
  .milestone-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .milestone-header-left {
    flex: none;
    width: 100%;
    margin-bottom: 0;
  }
  .milestone-header-right {
    flex: none;
    width: 100%;
    justify-content: flex-end;
    gap: 8px;
  }
  .milestone-bar-wrap {
    width: 120px;
    max-width: none;
  }
}

.project-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.project-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.project-icon-text {
  font-size: 14px;
  font-weight: 700;
  color: #7170ff;
}

.project-name {
  font-size: 15px;
  font-weight: 600;
  color: #f7f8f8;
  letter-spacing: -0.2px;
}

.project-header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.project-progress-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.project-bar-wrap {
  width: 140px;
  height: 6px;
  background: #0f1011;
  border-radius: 3px;
  overflow: hidden;
}

.project-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.project-pct {
  font-size: 13px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  min-width: 42px;
  text-align: right;
}

.project-count {
  font-size: 11px;
  color: #62666d;
  white-space: nowrap;
}

.project-toggle {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #62666d;
  transition: transform 0.2s ease;
  flex-shrink: 0;

  &.open {
    transform: rotate(180deg);
  }
}

.toggle-arrow {
  font-size: 10px;
}

/* --- 里程碑容器（在项目内部） --- */
.project-milestones {
  display: none;
  padding: 0 20px 18px;

  &.open {
    display: block;
  }
}

.milestone-item {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 14px 16px;
  transition: all 0.15s ease;
  margin-bottom: 8px;

  &:last-child { margin-bottom: 0; }
  &:hover { border-color: rgba(255, 255, 255, 0.10); }

  &.active-milestone {
    border-color: rgba(113, 112, 255, 0.25);
  }
}

.milestone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.milestone-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  cursor: pointer;
  user-select: none;

  &:hover .milestone-name {
    color: #7170ff;
  }
}

.milestone-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.milestone-name {
  font-size: 13px;
  font-weight: 600;
  color: #f7f8f8;
  transition: color 0.15s ease;
}

.milestone-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.milestone-progress-compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.milestone-bar-wrap {
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.milestone-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.milestone-pct {
  font-size: 12px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  min-width: 36px;
  text-align: right;
}

.milestone-meta-text {
  font-size: 11px;
  color: #62666d;
  white-space: nowrap;
}

.milestone-arrow {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #62666d;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  cursor: pointer;

  &.open {
    transform: rotate(180deg);
  }
}

/* --- 任务明细（在里程碑内部） --- */
.milestone-tasks {
  display: none;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  &.open { display: block; }
}

.milestone-task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 13px;

  & + & { border-top: 1px solid rgba(255, 255, 255, 0.04); }
}

.milestone-task-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.milestone-task-name {
  flex: 1;
  color: #d0d6e0;
  font-size: 12px;
}

.milestone-task-assignee {
  font-size: 11px;
  color: #62666d;
}
</style>
