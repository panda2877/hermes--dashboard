<template>
  <view class="dashboard-page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="nav-title">统计看板</view>
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
    <view v-if="stats.loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="stats.error" class="error-state">
      <text class="error-text">{{ stats.error }}</text>
      <view class="retry-btn" @click="stats.refresh()">重试</view>
    </view>

    <!-- 统计卡片 -->
    <view v-else class="stats-grid">
      <!-- 总 Token（带增幅） -->
      <view class="stat-card">
        <view class="stat-label">总 Token</view>
        <view class="stat-value">{{ formatNum(stats.totalTokens) }}</view>
        <view
          v-if="!stats.loading"
          class="stat-change"
          :class="stats.totalChange >= 0 ? 'up' : 'down'"
        >
          <text>{{ stats.totalChange >= 0 ? '↑' : '↓' }}</text>
          <text>{{ Math.abs(stats.totalChange) }}%</text>
          <text class="change-hint">vs 上周期</text>
        </view>
      </view>
      <!-- Prompt Token -->
      <view class="stat-card">
        <view class="stat-label">Prompt Token</view>
        <view class="stat-value">{{ formatNum(stats.totalPromptTokens) }}</view>
      </view>
      <!-- Completion Token -->
      <view class="stat-card">
        <view class="stat-label">Completion Token</view>
        <view class="stat-value">{{ formatNum(stats.totalCompletionTokens) }}</view>
      </view>
      <!-- 费用汇总 -->
      <view class="stat-card cost-card">
        <view class="stat-label">总费用</view>
        <view class="stat-value">¥{{ stats.totalCostRMB.toFixed(2) }}</view>
        <view class="stat-sub">
          <text class="cost-ratelabel">@ 0.15元/M tokens</text>
        </view>
        <view v-if="stats.backupCost > 0" class="backup-cost">
          <text class="backup-label">backup: </text>
          <text class="backup-value">¥{{ stats.backupCost.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view v-if="!stats.loading && !stats.error" class="filter-row">
      <view class="time-buttons">
        <view
          v-for="t in timeOptions"
          :key="t.key"
          class="time-btn"
          :class="{ active: stats.timeRange === t.key }"
          @click="stats.setTimeRange(t.key)"
        >
          {{ t.label }}
        </view>
      </view>
      <!-- 模型下拉选择器 -->
      <picker
        class="model-picker"
        mode="selector"
        :range="modelPickerList"
        :value="selectedIndex"
        @change="onModelChange"
      >
        <view class="picker-trigger">
          <text class="picker-text">
            {{ stats.selectedModel || '全部模型' }}
          </text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>
    </view>

    <!-- 图表区域 -->
    <view v-if="!stats.loading && !stats.error" class="charts-row">
      <!-- Token 趋势柱状图（带悬停提示） -->
      <view class="chart-card">
        <view class="chart-title">Token 趋势</view>
        <view class="bar-chart-wrap">
          <view class="bar-chart">
            <view
              v-for="(item, i) in stats.dailyStats"
              :key="i"
              class="bar-item"
              @touchstart="hoveredBar = i"
              @touchend="hoveredBar = -1"
              @mouseenter="hoveredBar = i"
              @mouseleave="hoveredBar = -1"
            >
              <!-- 悬停提示 -->
              <view v-if="hoveredBar === i" class="bar-tooltip">
                <text class="tooltip-date">{{ item.date }}</text>
                <text class="tooltip-tokens">{{ formatNum(item.tokens) }} tokens</text>
                <text class="tooltip-prompt">P: {{ formatNum(item.promptTokens) }}</text>
                <text class="tooltip-completion">C: {{ formatNum(item.completionTokens) }}</text>
              </view>
              <view
                class="bar"
                :style="{
                  height: barHeight(item.tokens) + 'px',
                  opacity: hoveredBar === -1 || hoveredBar === i ? 1 : 0.4,
                }"
              />
              <text class="bar-label">{{ item.date.slice(5) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 模型分布饼图（带 token 数量） -->
      <view class="chart-card">
        <view class="chart-title">模型分布</view>
        <view class="pie-wrap">
          <view class="pie-svg">
            <svg viewBox="0 0 100 100" class="pie-svg-el">
              <circle
                v-for="(seg, i) in pieSegments"
                :key="i"
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                :stroke="pieColors[i % pieColors.length]"
                stroke-width="20"
                :stroke-dasharray="seg.dash"
                :stroke-dashoffset="seg.offset"
                class="pie-seg"
              />
            </svg>
          </view>
          <!-- 图例 -->
          <view class="pie-legend">
            <view
              v-for="(item, i) in stats.modelStats.filter(s => s.tokens > 0)"
              :key="i"
              class="pie-row"
            >
              <view class="pie-dot" :style="{ background: pieColors[i % pieColors.length] }" />
              <text class="pie-label">{{ item.model || '(未知)' }}</text>
              <text class="pie-tokens">{{ formatNum(item.tokens) }}</text>
              <text class="pie-pct">{{ item.percentage }}%</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStatsStore } from '@/store/stats'

const stats = useStatsStore()
const currentTab = ref('dashboard')
const hoveredBar = ref(-1)

// 页面加载时拉取真实数据
onMounted(() => {
  stats.fetchStats()
})

// ── 计算属性 ─────────────────────────────────────────────────────────────────

// 选中的模型下拉索引（0 = 全部）
const selectedIndex = computed(() => {
  if (!stats.selectedModel) return 0
  return stats.modelList.indexOf(stats.selectedModel) + 1
})

// picker 列表：第一个是"全部模型"，后面接真实模型
const modelPickerList = computed(() => ['全部模型', ...stats.modelList])

// 饼图扇形（SVG stroke-dasharray 实现）
const pieSegments = computed(() => {
  const total = stats.modelStats.reduce((s, m) => s + m.tokens, 0)
  if (total === 0) return []
  const circumference = 2 * Math.PI * 40 // r=40
  let offset = 0
  return stats.modelStats
    .filter(m => m.tokens > 0)
    .map(m => {
      const pct = m.tokens / total
      const dash = `${pct * circumference} ${circumference}`
      const seg = { dash, offset: -offset }
      offset += pct * circumference
      return seg
    })
})

// ── 事件 ─────────────────────────────────────────────────────────────────────

function onModelChange(e: any) {
  const idx = e.detail.value
  // idx=0 → 全部模型；否则取 modelList[idx-1]
  stats.setSelectedModel(idx > 0 ? stats.modelList[idx - 1] : '')
}

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

const tabs = [
  { key: 'dashboard', label: '统计' },
  { key: 'kanban', label: '任务' },
  { key: 'agents', label: 'Agent' },
]

const timeOptions = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
]

const pieColors = ['#5e6ad2', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function barHeight(val: number): number {
  if (!val) return 4
  const max = Math.max(...stats.dailyStats.map(d => d.tokens), 1)
  return Math.max((val / max) * 160, 4)
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
.dashboard-page {
  padding: 20px 16px;
  background: #08090a;
  min-height: 100vh;
}

.nav-bar { margin-bottom: 24px; }

.nav-title {
  font-size: 22px;
  font-weight: 700;
  color: #f7f8f8;
  margin-bottom: 12px;
}

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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  &.cost-card {
    background: linear-gradient(135deg, #0f1011 0%, #12131a 100%);
    border-color: rgba(94, 106, 210, 0.3);
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
  &.up { color: #22c55e; }
  &.down { color: #ef4444; }
}
.change-hint {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}
.stat-sub { margin-top: 4px; }
.cost-ratelabel {
  font-size: 11px;
  color: #62666d;
}
.backup-cost {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  gap: 4px;
  align-items: center;
}
.backup-label { font-size: 11px; color: #8a8f98; }
.backup-value { font-size: 12px; color: #f59e0b; font-weight: 600; }

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
.time-buttons {
  display: flex;
  gap: 4px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 2px;
}
.time-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #8a8f98;
  cursor: pointer;
  &.active {
    background: #5e6ad2;
    color: #fff;
    font-weight: 600;
  }
}

.model-picker {
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

.charts-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.chart-card {
  flex: 1;
  min-width: 300px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #d0d6e0;
  margin-bottom: 16px;
}

// ── 柱状图 ──────────────────────────────────────────────────────────────────
.bar-chart-wrap {
  height: 220px;
  position: relative;
}
.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200px;
  padding-top: 20px;
  gap: 4px;
}
.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  flex: 1;
}
.bar {
  width: 100%;
  max-width: 32px;
  background: linear-gradient(180deg, #5e6ad2 0%, #7170ff 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: opacity 0.2s, height 0.3s;
  cursor: pointer;
}
.bar-label {
  font-size: 10px;
  color: #8a8f98;
}

// 悬停气泡
.bar-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1a1b1f;
  border: 1px solid rgba(94, 106, 210, 0.4);
  border-radius: 6px;
  padding: 8px 10px;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: rgba(94, 106, 210, 0.4);
  }
}
.tooltip-date { font-size: 11px; color: #8a8f98; }
.tooltip-tokens { font-size: 13px; color: #f7f8f8; font-weight: 600; }
.tooltip-prompt { font-size: 11px; color: #5e6ad2; }
.tooltip-completion { font-size: 11px; color: #22c55e; }

// ── 饼图 ────────────────────────────────────────────────────────────────────
.pie-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.pie-svg {
  width: 140px;
  height: 140px;
}
.pie-svg-el {
  transform: rotate(-90deg);
  overflow: visible;
}
.pie-seg {
  transition: opacity 0.2s;
}

.pie-legend {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pie-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-radius: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.pie-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pie-label {
  flex: 1;
  font-size: 12px;
  color: #d0d6e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pie-tokens {
  font-size: 12px;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
  min-width: 60px;
  text-align: right;
}
.pie-pct {
  font-size: 12px;
  color: #8a8f98;
  min-width: 40px;
  text-align: right;
}
</style>
