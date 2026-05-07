<template>
  <view class="agents-page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="nav-title">Agent 状态</view>
      <view class="nav-refresh" @click="agentsStore.refresh()">
        <text class="refresh-icon" :class="{ spinning: agentsStore.loading }">↻</text>
      </view>
    </view>

    <!-- 加载状态 -->
    <view v-if="agentsStore.loading && agentsStore.agents.length === 0" class="state-tip">
      加载中...
    </view>

    <!-- 错误状态 -->
    <view v-else-if="agentsStore.error" class="state-tip error" @click="agentsStore.refresh()">
      {{ agentsStore.error }}（点击重试）
    </view>

    <!-- Agent 卡片网格 -->
    <view v-else class="agents-grid">
      <view
        v-for="agent in agentsStore.agents"
        :key="agent.id"
        class="agent-card"
        :class="{ 'card-main': agent.isMain }"
      >
        <!-- 卡片头部 -->
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

        <!-- 统计行 -->
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

    <!-- 无数据 -->
    <view v-if="!agentsStore.loading && !agentsStore.error && agentsStore.agents.length === 0" class="state-tip">
      暂无运行中的 Agent
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onMounted } from 'vue'
import { useAgentsStore } from '@/store/agents'

const agentsStore = useAgentsStore()

onMounted(() => {
  agentsStore.refresh()
})

const avatarColors: Record<string, string> = {
  yinyue: '#f59e0b',
  wensiyue: '#3b82f6',
  xingruyin: '#5e6ad2',
  ziling: '#22c55e',
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
</script>

<style lang="scss" scoped>
.agents-page {
  padding: 20px 16px;
  background: #08090a;
  min-height: 100vh;
  overflow-x: hidden;
  touch-action: pan-y;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.nav-title {
  font-size: 22px;
  font-weight: 700;
  color: #f7f8f8;
}

/* 刷新按钮（与任务页一致） */
.nav-refresh {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;

  .refresh-icon {
    font-size: 18px;
    color: #8a8f98;
    display: inline-block;

    &.spinning {
      animation: spin 1s linear infinite;
      color: #3b82f6;
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 状态提示 */
.state-tip {
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
  color: #8a8f98;
}

.state-tip.error {
  color: #ef4444;
}

/* Agent 卡片网格 */
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

/* 卡片头部 */
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

/* 状态徽章 */
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

.status-working {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.status-idle {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.status-disconnected {
  background: rgba(138, 143, 152, 0.12);
  color: #8a8f98;
}

/* 统计行 */
.agent-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-item {
  text-align: center;
}

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
</style>
