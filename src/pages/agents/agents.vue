<template>
  <view class="agents-page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="nav-title">Agent 状态</view>
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
      <u-button
        type="primary"
        size="small"
        :plain="true"
        @click="handleRefresh"
        class="refresh-btn"
      >
        刷新
      </u-button>
    </view>

    <!-- Agent 卡片网格 -->
    <view class="agents-grid">
      <view
        v-for="agent in agentsStore.agents"
        :key="agent.id"
        class="agent-card"
      >
        <view class="agent-top">
          <view class="agent-avatar" :style="{ background: avatarColor(agent.id) }">
            <text class="avatar-text">{{ agent.name.charAt(0) }}</text>
          </view>
          <view class="agent-info">
            <text class="agent-name">{{ agent.name }}</text>
            <text class="agent-model">{{ agent.model }}</text>
          </view>
          <Badge
            :text="statusLabel(agent.status)"
            :type="statusType(agent.status)"
          />
        </view>
        <view class="agent-stats">
          <view class="stat-item">
            <text class="stat-val">{{ agent.totalTasks }}</text>
            <text class="stat-lbl">任务数</text>
          </view>
          <view class="stat-item">
            <text class="stat-val">{{ agent.uptime }}</text>
            <text class="stat-lbl">运行时长</text>
          </view>
          <view class="stat-item">
            <text class="stat-val">{{ agent.concurrency }}</text>
            <text class="stat-lbl">并发数</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAgentsStore } from '@/store/agents'
import Badge from '@/components/Badge.vue'

const agentsStore = useAgentsStore()
const currentTab = ref('agents')

const tabs = [
  { key: 'dashboard', label: '统计' },
  { key: 'kanban', label: '任务' },
  { key: 'agents', label: 'Agent' },
]

const avatarColors: Record<string, string> = {
  xingruyin: '#5e6ad2',
  ziling: '#22c55e',
  siyue: '#f59e0b',
  mo: '#8b5cf6',
}

function avatarColor(id: string): string {
  return avatarColors[id] || '#5e6ad2'
}

function statusLabel(status: string): string {
  return status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Error'
}

function statusType(status: string): 'success' | 'default' | 'error' {
  if (status === 'online') return 'success'
  if (status === 'offline') return 'default'
  return 'error'
}

function handleRefresh() {
  agentsStore.refresh()
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
.agents-page {
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

.nav-tabs {
  display: flex;
  gap: 4px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 12px;
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

.refresh-btn {
  margin-top: 4px;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.agent-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
}

.agent-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.agent-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.agent-info {
  flex: 1;
}

.agent-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #f7f8f8;
}

.agent-model {
  display: block;
  font-size: 12px;
  color: #8a8f98;
  margin-top: 2px;
}

.agent-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-item {
  text-align: center;
}

.stat-val {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', monospace;
}

.stat-lbl {
  display: block;
  font-size: 11px;
  color: #8a8f98;
  margin-top: 2px;
}
</style>