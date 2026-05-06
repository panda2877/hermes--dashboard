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
      <StatCard label="总 Token" :value="formatNum(stats.totalTokens)" :change="null" />
      <StatCard label="Prompt Token" :value="formatNum(stats.totalPromptTokens)" :change="null" />
      <StatCard label="Completion Token" :value="formatNum(stats.totalCompletionTokens)" :change="null" />
      <StatCard label="总费用 ($)" :value="stats.totalCost.toFixed(4)" :change="null" />
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
      <view class="model-select">
        <input
          class="filter-input"
          v-model="modelFilter"
          placeholder="选择模型"
          placeholder-class="placeholder"
        />
      </view>
    </view>

    <!-- 图表区域 -->
    <view v-if="!stats.loading && !stats.error" class="charts-row">
      <view class="chart-card">
        <view class="chart-title">Token 趋势</view>
        <!-- uCharts 柱状图占位 -->
        <view class="chart-placeholder">
          <view class="bar-chart">
            <view
              v-for="(item, i) in stats.dailyStats"
              :key="i"
              class="bar-item"
            >
              <view
                class="bar"
                :style="{ height: barHeight(item.tokens) + 'px' }"
              />
              <text class="bar-label">{{ item.date }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="chart-card">
        <view class="chart-title">模型分布</view>
        <view class="pie-placeholder">
          <view
            v-for="(item, i) in stats.modelStats"
            :key="i"
            class="pie-row"
          >
            <view class="pie-dot" :style="{ background: pieColors[i] }" />
            <text class="pie-label">{{ item.model }}</text>
            <text class="pie-value">{{ item.percentage }}%</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStatsStore } from '@/store/stats'
import StatCard from '@/components/StatCard.vue'

const stats = useStatsStore()
const currentTab = ref('dashboard')
const modelFilter = ref('')

// 页面加载时拉取真实数据
onMounted(() => {
  stats.fetchStats()
})

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

const pieColors = ['#5e6ad2', '#22c55e', '#f59e0b', '#ef4444']

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function barHeight(val: number): number {
  const max = Math.max(...stats.dailyStats.map(d => d.tokens))
  return (val / max) * 160
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

.nav-bar {
  margin-bottom: 24px;
}

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

.loading-text {
  color: #8a8f98;
  font-size: 14px;
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

.error-text {
  color: #ef4444;
  font-size: 13px;
}

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

.model-select {
  flex: 1;
}

.filter-input {
  width: 100%;
  height: 36px;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #f7f8f8;
  font-size: 13px;
  padding: 0 10px;
  outline: none;
  caret-color: #5e6ad2;
  box-sizing: border-box;

  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  &:focus {
    border-color: rgba(94, 106, 210, 0.6);
  }
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

.chart-placeholder {
  height: 200px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 180px;
  padding-top: 20px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bar {
  width: 24px;
  background: linear-gradient(180deg, #5e6ad2 0%, #7170ff 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.3s;
}

.bar-label {
  font-size: 10px;
  color: #8a8f98;
}

.pie-placeholder {
  padding: 20px 0;
}

.pie-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pie-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.pie-label {
  flex: 1;
  font-size: 13px;
  color: #d0d6e0;
}

.pie-value {
  font-size: 13px;
  font-weight: 600;
  color: #f7f8f8;
}
</style>