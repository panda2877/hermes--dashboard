<template>
  <view class="agents-page">
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-bar-brand">
        <image class="top-logo" src="/static/icons/agents-active.svg" mode="aspectFit" />
        <view class="top-brand-text">Hermes</view>
      </view>
      <view class="top-bar-content">
        <view class="top-bar-title-row">
          <text class="top-title">Agent</text>
          <text class="top-subtitle">Agent 运行状态与定时任务</text>
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

    <!-- ========== Sub-View A: 状态 ========== -->
    <view v-if="activeSubTab === 'status'" class="page-body">
      <view v-if="agentsStore.loading && agentsStore.agents.length === 0" class="state-tip">
        加载中...
      </view>
      <view v-else-if="agentsStore.error" class="error-state">
        <text class="error-text">{{ agentsStore.error }}</text>
        <view class="retry-btn" @click="agentsStore.refresh()">重试</view>
      </view>

      <view v-else class="agents-grid">
        <view
          v-for="agent in agentsStore.agents"
          :key="agent.id"
          class="agent-card"
          :class="{ 'card-main': agent.isMain }"
        >
          <view class="agent-top">
            <view class="agent-avatar" :style="{ background: avatarColor(agent.id) }">
              <text class="avatar-text">{{ agent.name.charAt(0) }}</text>
            </view>
            <view class="agent-info">
              <text class="agent-name">{{ agent.name }}</text>
              <text class="agent-model">{{ agent.model }}</text>
            </view>
            <view class="status-badge" :class="workBadgeClass(agent)">
              <text class="status-dot" />
              <text class="status-txt">{{ workBadgeLabel(agent) }}</text>
            </view>
          </view>
          <view class="agent-stats">
            <view class="stat-item">
              <text class="stat-val">{{ agent.uptime }}</text>
              <text class="stat-lbl">运行时长</text>
            </view>
            <view class="stat-item">
              <text class="stat-val">{{ agent.pid }}</text>
              <text class="stat-lbl">PID</text>
            </view>
            <view class="stat-item">
              <text class="stat-val">{{ agent.backlogCount }}</text>
              <text class="stat-lbl">待办数</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="!agentsStore.loading && !agentsStore.error && agentsStore.agents.length === 0" class="state-tip">
        暂无运行中的 Agent
      </view>
    </view>

    <!-- ========== Sub-View B: CronJob ========== -->
    <view v-if="activeSubTab === 'cronjob'" class="page-body">
      <!-- Filter Toolbar -->
      <view class="cronjob-toolbar">
        <picker
          class="filter-picker"
          mode="selector"
          :range="cronStatusOptions"
          :value="cronStatusIdx"
          @change="onCronStatusChange"
        >
          <view class="picker-trigger">
            <text class="picker-text">{{ cronStatusOptions[cronStatusIdx] }}</text>
            <text class="picker-arrow">▼</text>
          </view>
        </picker>
        <view class="refresh-btn" @click="onRefreshCronjobs">
          <text class="refresh-icon">↻</text>
        </view>
      </view>

      <!-- CronJob Table -->
      <view class="table-wrap">
        <!-- Header -->
        <view class="table-header">
          <text class="th th-name">名称</text>
          <text class="th th-schedule">调度表达式</text>
          <text class="th th-status">状态</text>
          <text class="th th-last">上次运行</text>
          <text class="th th-next">下次运行</text>
          <text class="th th-action">操作</text>
        </view>
        <!-- Rows -->
        <view
          v-for="(job, i) in filteredCronjobs"
          :key="i"
          class="table-row"
        >
          <text class="td td-name">{{ job.name }}</text>
          <text class="td td-schedule">{{ job.schedule }}</text>
          <view class="td td-status">
            <view class="cron-status-badge" :class="`cron-${job.status}`">
              <view class="cron-dot" />
              <text>{{ job.statusLabel }}</text>
            </view>
          </view>
          <text class="td td-time">{{ job.lastRun }}</text>
          <text class="td td-time">{{ job.nextRun }}</text>
          <view class="td td-action">
            <text class="action-btn">{{ job.status === 'active' ? '暂停' : '启用' }}</text>
          </view>
        </view>
        <view v-if="filteredCronjobs.length === 0" class="table-empty">
          <text>暂无 CronJob 数据</text>
        </view>
      </view>
    </view>

    <!-- ========== Sub-View C: Skill ========== -->
    <view v-if="activeSubTab === 'skill'" class="page-body">
      <!-- Toolbar -->
      <view class="skill-toolbar">
        <view class="skill-search-wrap">
          <text class="search-icon">🔍</text>
          <input
            class="skill-search"
            type="text"
            placeholder="搜索 skill 名称..."
            v-model="skillSearch"
          />
        </view>
        <picker
          class="filter-picker"
          mode="selector"
          :range="categoryOptions"
          :value="categoryIdx"
          @change="onCategoryChange"
        >
          <view class="picker-trigger">
            <text class="picker-text">{{ categoryOptions[categoryIdx] }}</text>
            <text class="picker-arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- Count -->
      <view class="skill-count-bar">
        <text class="skill-count-text">共 <text class="skill-count-num">{{ filteredSkills.length }}</text> 个 skill</text>
      </view>

      <!-- Skill Grid -->
      <view class="skill-grid">
        <view
          v-for="skill in filteredSkills"
          :key="skill.name"
          class="skill-card"
        >
          <view class="skill-card-header">
            <text class="skill-name">{{ skill.name }}</text>
            <text class="skill-version">v{{ skill.version }}</text>
          </view>
          <text class="skill-desc">{{ skill.desc }}</text>
          <view class="skill-tags">
            <text class="skill-tag cat-tag">{{ skill.category }}</text>
            <text
              v-for="tag in skill.tags"
              :key="tag"
              class="skill-tag"
            >{{ tag }}</text>
          </view>
          <view class="skill-footer">
            <text class="skill-related" v-if="skill.related">
              关联: <text class="related-name">{{ skill.related }}</text>
            </text>
            <text class="skill-related" v-else>—</text>
            <text class="skill-detail-btn">查看详情</text>
          </view>
        </view>
      </view>

      <view v-if="filteredSkills.length === 0" class="state-tip">
        未找到匹配的 skill
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAgentsStore } from '@/store/agents'

const agentsStore = useAgentsStore()
const activeSubTab = ref('status')

const subTabs = [
  { key: 'status', label: '状态' },
  { key: 'cronjob', label: 'CronJob' },
  { key: 'skill', label: 'Skill' },
]

onMounted(() => {
  agentsStore.refresh()
})

const avatarColors: Record<string, string> = {
  yinyue: '#f59e0b', wensiyue: '#3b82f6', xingruyin: '#5e6ad2', ziling: '#22c55e',
}

function avatarColor(id: string): string {
  return avatarColors[id] || '#5e6ad2'
}

function workBadgeLabel(agent: any): string {
  if (agent.workStatus === 'working') return '工作中'
  if (agent.workStatus === 'idle') return '空闲'
  return '断线'
}

function workBadgeClass(agent: any): string {
  if (agent.workStatus === 'working') return 'status-working'
  if (agent.workStatus === 'idle') return 'status-idle'
  return 'status-disconnected'
}

// ── CronJob ──────────────────────────────────────────────────────────────────
const cronStatusOptions = ['全部状态', '活跃中', '已暂停', '异常']
const cronStatusIdx = ref(0)

interface CronJob {
  name: string
  schedule: string
  status: string
  statusLabel: string
  lastRun: string
  nextRun: string
}

// Mock data — replace with BFF API
const cronjobs = ref<CronJob[]>([
  { name: 'token-stats-sync', schedule: '0 */2 * * *', status: 'active', statusLabel: '活跃中', lastRun: '2026-05-07 08:00', nextRun: '2026-05-07 10:00' },
  { name: 'kanban-db-cleanup', schedule: '0 3 * * *', status: 'active', statusLabel: '活跃中', lastRun: '2026-05-07 03:00', nextRun: '2026-05-08 03:00' },
  { name: 'agent-health-check', schedule: '*/5 * * * *', status: 'active', statusLabel: '活跃中', lastRun: '2026-05-07 09:55', nextRun: '2026-05-07 10:00' },
  { name: 'daily-report-email', schedule: '0 9 * * 1-5', status: 'paused', statusLabel: '已暂停', lastRun: '2026-05-05 09:00', nextRun: '—' },
  { name: 'model-cost-tracker', schedule: '0 0 * * *', status: 'error', statusLabel: '异常', lastRun: '2026-05-06 00:00', nextRun: '2026-05-07 00:00' },
])

const filteredCronjobs = computed(() => {
  if (cronStatusIdx.value === 0) return cronjobs.value
  const labels = ['全部状态', '活跃中', '已暂停', '异常']
  const target = labels[cronStatusIdx.value]
  return cronjobs.value.filter(j => j.statusLabel === target)
})

function onCronStatusChange(e: any) {
  cronStatusIdx.value = e.detail.value
}

function onRefreshCronjobs() {
  // TODO: call BFF API
}

// ── Skill ────────────────────────────────────────────────────────────────────
const categoryOptions = ['全部分类', 'devops', 'creative', 'github', 'mlops', 'productivity', 'research', 'software-development']
const categoryIdx = ref(0)
const skillSearch = ref('')

interface Skill {
  name: string
  version: string
  desc: string
  category: string
  tags: string[]
  related: string
}

// Mock data — replace with BFF API
const skills = ref<Skill[]>([
  { name: 'kanban-orchestrator', version: '2.0.0', desc: 'Decomposition playbook + specialist-roster conventions for an orchestrator profile routing work through Kanban.', category: 'devops', tags: ['kanban', 'multi-agent', 'orchestration'], related: 'kanban-worker' },
  { name: 'kanban-worker', version: '2.0.0', desc: 'Pitfalls, examples, and edge cases for Hermes Kanban worker execution.', category: 'devops', tags: ['kanban', 'worker'], related: 'kanban-orchestrator' },
  { name: 'claude-design', version: '1.0.0', desc: 'Design one-off HTML artifacts — landing pages, prototypes, decks, component labs, motion studies.', category: 'creative', tags: ['design', 'html', 'prototype', 'ux'], related: 'popular-web-designs, design-md' },
  { name: 'github-pr-workflow', version: '2.0.0', desc: 'GitHub PR lifecycle — branch, commit, open, CI, merge. Full workflow automation.', category: 'github', tags: ['pr', 'git', 'ci/cd'], related: 'github-code-review' },
  { name: 'test-driven-development', version: '1.0.0', desc: 'TDD workflow — enforce RED-GREEN-REFACTOR cycle, tests before code.', category: 'software-development', tags: ['tdd', 'testing'], related: '' },
  { name: 'llama-cpp', version: '1.0.0', desc: 'Local GGUF inference with llama.cpp — model discovery, quantization, and serving.', category: 'mlops', tags: ['llm', 'gguf', 'inference'], related: 'huggingface-hub' },
  { name: 'youtube-content', version: '1.0.0', desc: 'YouTube transcripts to summaries, threads, and blog posts.', category: 'research', tags: ['youtube', 'transcript', 'summary'], related: '' },
  { name: 'obsidian', version: '1.0.0', desc: 'Read, search, and create notes in the Obsidian vault.', category: 'productivity', tags: ['notes', 'obsidian', 'knowledge'], related: '' },
  { name: 'github-code-review', version: '1.0.0', desc: 'Review PRs — diffs, inline comments via gh or REST API.', category: 'github', tags: ['code-review', 'pr'], related: 'github-pr-workflow' },
  { name: 'axolotl', version: '1.0.0', desc: 'YAML LLM fine-tuning — LoRA, DPO, GRPO. Declarative config-driven training.', category: 'mlops', tags: ['fine-tuning', 'lora', 'dpo'], related: 'unsloth, trl' },
  { name: 'ziling-diagram', version: '1.0.0', desc: '紫灵专属的图表/流程图设计工具，快速生成架构图与交互图。', category: 'creative', tags: ['diagram', 'architecture'], related: 'requirements-expert-ziling' },
  { name: 'requirements-expert-ziling', version: '2.0.0', desc: '紫灵 — 需求/创意专家。负责接收想法、与老大讨论可行性、优化为需求方案。', category: 'creative', tags: ['requirements', 'design'], related: 'ziling-diagram' },
])

const filteredSkills = computed(() => {
  let result = skills.value
  const q = skillSearch.value.trim().toLowerCase()
  if (q) result = result.filter(s => s.name.toLowerCase().includes(q))
  if (categoryIdx.value > 0) result = result.filter(s => s.category === categoryOptions[categoryIdx.value])
  return result
})

function onCategoryChange(e: any) {
  categoryIdx.value = e.detail.value
}
</script>

<style lang="scss" scoped>
.agents-page {
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

/* State Tips */
.state-tip {
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
  color: #8a8f98;
}

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

/* Refresh Btn */
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
}

/* Filter Row */
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-picker {
  height: 36px;
  flex: 1;
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
}

.picker-arrow {
  font-size: 10px;
  color: #62666d;
  margin-left: 6px;
}

/* Agent Grid */
.agents-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.agent-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px 10px;

  &.card-main {
    border-color: rgba(245, 158, 11, 0.3);
    background: linear-gradient(135deg, #1a1b2e 0%, #0f1011 100%);
  }
}

.agent-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.agent-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #f7f8f8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-model {
  display: block;
  font-size: 10px;
  color: #8a8f98;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  flex-shrink: 0;
}

.status-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.status-working { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
.status-idle { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.status-disconnected { background: rgba(138, 143, 152, 0.12); color: #8a8f98; }

.agent-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-item { text-align: center; }
.stat-val {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-lbl {
  display: block;
  font-size: 9px;
  color: #8a8f98;
  margin-top: 1px;
  white-space: nowrap;
}

/* CronJob Table */
.cronjob-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.table-wrap {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  overflow-x: auto;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 600px;
}

.th {
  font-size: 11px;
  font-weight: 600;
  color: #62666d;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.th-name { flex: 1.2; }
.th-schedule { flex: 1; }
.th-status { flex: 0.8; }
.th-last, .th-next { flex: 1; }
.th-action { flex: 0.6; text-align: center; }

.table-row {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  min-width: 600px;
  transition: background 0.15s ease;

  &:hover { background: rgba(255, 255, 255, 0.02); }
  &:last-child { border-bottom: none; }
}

.td {
  font-size: 12px;
  color: #d0d6e0;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-name { flex: 1.2; font-weight: 500; color: #f7f8f8; }
.td-schedule {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #8a8f98;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 2px 8px;
}
.td-status { flex: 0.8; }
.td-time {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #8a8f98;
}
.td-action { flex: 0.6; text-align: center; }

.cron-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;

  &.cron-active { color: #22c55e; background: rgba(34, 197, 94, 0.1); }
  &.cron-paused { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
  &.cron-error { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
}

.cron-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.action-btn {
  font-size: 11px;
  padding: 3px 10px;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #8a8f98;
  cursor: pointer;
}

.table-empty {
  text-align: center;
  padding: 32px 0;
  font-size: 13px;
  color: #62666d;
}

/* Skill View */
.skill-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.skill-search-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  pointer-events: none;
}

.skill-search {
  width: 100%;
  height: 36px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0 10px 0 32px;
  font-size: 13px;
  color: #f7f8f8;
  outline: none;
  box-sizing: border-box;
  font-family: 'Inter', sans-serif;

  &::placeholder { color: #62666d; }
  &:focus { border-color: #5e6ad2; }
}

.skill-count-bar {
  margin-bottom: 12px;
}
.skill-count-text {
  font-size: 12px;
  color: #8a8f98;
}
.skill-count-num {
  color: #f7f8f8;
  font-weight: 600;
}

.skill-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 960px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.skill-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 14px;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 0;

  &:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

.skill-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.2px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-version {
  font-size: 10px;
  color: #62666d;
  font-family: 'JetBrains Mono', monospace;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.skill-desc {
  font-size: 12px;
  color: #8a8f98;
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.skill-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 500;
  color: #8a8f98;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.06);

  &.cat-tag {
    color: #7170ff;
    background: rgba(113, 112, 255, 0.08);
    border-color: rgba(113, 112, 255, 0.2);
  }
}

.skill-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  gap: 8px;
}

.skill-related {
  font-size: 11px;
  color: #62666d;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-name {
  color: #8a8f98;
}

.skill-detail-btn {
  font-size: 11px;
  padding: 3px 10px;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #8a8f98;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
