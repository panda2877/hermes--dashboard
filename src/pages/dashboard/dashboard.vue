<template>
  <view class="dashboard-page">
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-bar-brand">
        <image class="top-logo" src="/static/icons/dashboard-active.svg" mode="aspectFit" />
        <view class="top-brand-text">Hermes</view>
      </view>
      <view class="top-bar-title-row">
        <text class="top-title">Token 用量统计</text>
        <text class="top-subtitle">实时监控 API 消耗与成本</text>
      </view>
    </view>

    <!-- Loading / Error -->
    <view v-if="stats.loading && stats.totalTokens === 0" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="stats.error" class="error-state">
      <text class="error-text">{{ stats.error }}</text>
      <view class="retry-btn" @click="stats.fetchStats()">重试</view>
    </view>

    <!-- Stat Cards (responsive: 4 cols on wide, 2x2 on narrow) -->
    <view v-else class="stats-grid">
      <view class="stat-card">
        <view class="stat-label">总 Token</view>
        <view class="stat-value">{{ formatNum(stats.totalTokens) }}</view>
        <view
          class="stat-change"
          :class="stats.totalChange >= 0 ? 'up' : 'down'"
        >
          <template v-if="stats.hasPrevData">
            <text>{{ stats.totalChange >= 0 ? '↑' : '↓' }}</text>
            <text>{{ Math.abs(stats.totalChange) }}%</text>
            <text class="change-hint">vs 上周期</text>
          </template>
          <text v-else class="change-hint">首次记录</text>
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-label">Prompt Token</view>
        <view class="stat-value">{{ formatNum(stats.totalPromptTokens) }}</view>
      </view>
      <view class="stat-card">
        <view class="stat-label">Completion Token</view>
        <view class="stat-value">{{ formatNum(stats.totalCompletionTokens) }}</view>
      </view>
      <view class="stat-card cost-card">
        <view class="stat-label">总费用</view>
        <view class="stat-value">¥{{ stats.totalCostRMB.toFixed(2) }}</view>
        <view v-if="stats.backupCost > 0" class="backup-cost">
          <text class="backup-label">backup: </text>
          <text class="backup-value">¥{{ stats.backupCost.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- Filter Row -->
    <view v-if="!stats.loading && !stats.error" class="filter-row">
      <view class="time-buttons">
        <view
          v-for="t in timeOptions"
          :key="t.key"
          class="time-btn"
          :class="{ active: stats.timeRange === t.key }"
          @click="stats.setTimeRange(t.key as 'today' | 'week' | 'month')"
        >
          {{ t.label }}
        </view>
      </view>
      <picker
        class="model-picker"
        mode="selector"
        :range="modelPickerList"
        :value="selectedIndex"
        @change="onModelChange"
      >
        <view class="picker-trigger">
          <text class="picker-text">{{ stats.selectedModel || '全部模型' }}</text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>
      <view class="refresh-btn" @click="stats.fetchStats()">
        <text class="refresh-icon" :class="{ spinning: stats.loading }">↻</text>
      </view>
    </view>

    <!-- Charts Row -->
    <view v-if="!stats.loading && !stats.error" class="charts-row">
      <!-- Token Trend Bar Chart -->
      <view class="chart-card">
        <view class="chart-title">
          {{ trendChartTitle }}
          <text v-if="stats.selectedModel" class="chart-model-tag">{{ stats.selectedModel }}</text>
        </view>
        <view class="bar-chart-wrap">
          <view class="bar-chart">
            <view
              v-for="(item, i) in stats.trendStats"
              :key="i"
              class="bar-item"
              @touchstart="hoveredBar = i"
              @touchend="hoveredBar = -1"
              @mouseenter="hoveredBar = i"
              @mouseleave="hoveredBar = -1"
            >
              <view v-if="hoveredBar === i" class="bar-tooltip">
                <text class="tooltip-date">{{ item.label }}</text>
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
              <text class="bar-label">{{ item.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Model Distribution Pie Chart -->
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
          <view class="pie-legend">
            <view
              v-for="(item, i) in stats.modelStats.filter(s => s.tokens > 0 && s.model)"
              :key="i"
              class="pie-row"
            >
              <view class="pie-dot" :style="{ background: pieColors[i % pieColors.length] }" />
              <text class="pie-label">{{ item.model || '(未知)' }}</text>
              <text v-if="item.status === 'healthy'" class="model-status healthy">正常</text>
              <text v-else-if="item.status === 'unhealthy'" class="model-status unhealthy">异常</text>
              <text v-else class="model-status unknown">未知</text>
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
const hoveredBar = ref(-1)

onMounted(() => {
  stats.fetchStats()
})

const selectedIndex = computed(() => {
  if (!stats.selectedModel) return 0
  return stats.modelList.indexOf(stats.selectedModel) + 1
})

const modelPickerList = computed(() => ['全部模型', ...stats.modelList])

const trendChartTitle = computed(() => {
  switch (stats.timeRange) {
    case 'today': return 'Token 趋势（2小时粒度）'
    case 'week':  return 'Token 趋势（每日）'
    case 'month': return 'Token 趋势（每周）'
  }
})

const pieSegments = computed(() => {
  const total = stats.modelStats.reduce((s, m) => s + m.tokens, 0)
  if (total === 0) return []
  const circumference = 2 * Math.PI * 40
  let offset = 0
  return stats.modelStats
    .filter(m => m.tokens > 0 && m.model)
    .map(m => {
      const pct = m.tokens / total
      const dash = `${pct * circumference} ${circumference}`
      const seg = { dash, offset: -offset }
      offset += pct * circumference
      return seg
    })
})

function onModelChange(e: any) {
  const idx = e.detail.value
  stats.setSelectedModel(idx > 0 ? stats.modelList[idx - 1] : '')
}

const timeOptions = [
  { key: 'today', label: '本日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
]

const pieColors = ['#5e6ad2', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function formatNum(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function barHeight(val: number): number {
  if (!val) return 4
  const max = Math.max(...stats.trendStats.map(d => d.tokens), 1)
  return Math.max((val / max) * 160, 4)
}
</script>

<style lang="scss" scoped>
.dashboard-page {
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

.top-bar-title-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 20px;
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
  padding: 40px 16px;
  background: #0f1011;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin: 0 16px 16px;
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

/* Stat Cards — responsive: 4-col wide, 2-col narrow */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 0 16px;
  margin-bottom: 14px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
}

.stat-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 14px 14px;
  transition: all 0.15s ease;
  cursor: default;

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &.cost-card {
    background: linear-gradient(135deg, #0f1011 0%, #12131a 100%);
    border-color: rgba(94, 106, 210, 0.3);
  }
}

.stat-label {
  font-size: 11px;
  font-weight: 500;
  color: #8a8f98;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.5px;

  @media (min-width: 640px) {
    font-size: 26px;
  }
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

/* Filter Row */
.filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 16px;
  margin-bottom: 14px;
  flex-wrap: nowrap;
}

.time-buttons {
  display: flex;
  gap: 2px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 2px;
  flex-shrink: 0;
}

.time-btn {
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #8a8f98;
  cursor: pointer;
  transition: all 0.15s ease;

  &.active {
    background: #5e6ad2;
    color: #fff;
    font-weight: 600;
  }
}

.model-picker {
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
}

.picker-arrow {
  font-size: 10px;
  color: #62666d;
  flex-shrink: 0;
  margin-left: 6px;
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

/* Charts */
.charts-row {
  display: flex;
  gap: 12px;
  padding: 0 16px;
  flex-wrap: wrap;
}

.chart-card {
  flex: 1;
  min-width: 280px;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-model-tag {
  font-size: 11px;
  background: rgba(94, 106, 210, 0.2);
  color: #8b8eff;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 400;
}

/* Bar Chart */
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
  background: linear-gradient(180deg, #5e6ad2 0%, #434a9a 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}

.bar-label {
  font-size: 10px;
  color: #62666d;
  text-align: center;
}

.bar-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #28282c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: #d0d6e0;
  white-space: nowrap;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tooltip-date { color: #8a8f98; font-size: 10px; }
.tooltip-tokens { color: #f7f8f8; font-weight: 600; }
.tooltip-prompt, .tooltip-completion { color: #8a8f98; }

/* Pie Chart */
.pie-wrap {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.pie-svg {
  flex-shrink: 0;
}

.pie-svg-el {
  transform: rotate(-90deg);
  width: 100px;
  height: 100px;
}

.pie-legend {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pie-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.pie-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pie-label {
  color: #d0d6e0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-status {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;

  &.healthy { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
  &.unhealthy { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
  &.unknown { background: rgba(138, 143, 152, 0.15); color: #8a8f98; }
}

.pie-tokens {
  color: #f7f8f8;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  flex-shrink: 0;
}

.pie-pct {
  color: #62666d;
  font-size: 11px;
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
}
</style>
