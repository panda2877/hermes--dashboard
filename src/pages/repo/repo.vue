<template>
  <view class="repo-page">
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-bar-brand">
        <image class="top-logo" src="/static/icons/repo.svg" mode="aspectFit" />
        <view class="top-brand-text">Hermes</view>
      </view>
      <view class="top-bar-title-row">
        <text class="top-title">Git 仓库</text>
        <text class="top-subtitle">关联仓库状态与提交记录</text>
      </view>
      <view class="top-bar-actions">
        <view class="refresh-btn" @click="onRefresh">
          <text class="refresh-icon" :class="{ spinning: loading }">↻</text>
        </view>
      </view>
    </view>

    <!-- Page Body -->
    <view class="page-body">
      <view class="repo-grid">
        <view
          v-for="repo in repos"
          :key="repo.name"
          class="repo-card"
        >
          <view class="repo-card-header">
            <view class="repo-icon-wrap">
              <svg viewBox="0 0 16 16" fill="none" class="repo-icon-svg">
                <path d="M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4" :stroke="repo.color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2H2z" :stroke="repo.color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 7h6M5 10h4" :stroke="repo.color" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </view>
            <view class="repo-info">
              <text class="repo-name">{{ repo.name }}</text>
              <text class="repo-desc">{{ repo.desc }}</text>
            </view>
            <view class="repo-branch-tag">
              <text class="branch-text">{{ repo.branch }}</text>
            </view>
          </view>

          <view class="repo-meta-row">
            <view class="repo-meta-item">
              <text class="meta-icon">📂</text>
              <text class="meta-text">{{ repo.folder }}</text>
            </view>
            <view class="repo-meta-item">
              <text class="meta-icon">📝</text>
              <text class="meta-text" :class="{ 'ahead-text': repo.ahead > 0 }">
                {{ repo.ahead > 0 ? `${repo.ahead} commits ahead` : 'up to date' }}
              </text>
            </view>
            <view class="repo-sync-status" :class="`status-${repo.syncStatus}`">
              <view class="sync-dot" />
              <text class="sync-text">{{ syncStatusLabel(repo.syncStatus) }}</text>
            </view>
          </view>

          <view class="repo-commit-row">
            <text class="commit-label">上次提交:</text>
            <text class="commit-hash">{{ repo.commitHash }}</text>
            <text class="commit-msg">{{ repo.commitMsg }}</text>
            <text class="commit-time">{{ repo.commitTime }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const loading = ref(false)
const repos = ref<any[]>([])
const error = ref('')

interface RepoItem {
  id: string
  name: string
  desc: string
  color: string
  path: string
  branch: string
  remote: string
  dirtyFiles: number
  ahead: number
  behind: number
  syncStatus: string
  lastCommit: {
    hash: string
    message: string
    author: string
    timestamp: number
  }
  fetchedAt: string
}

function syncStatusLabel(status: string): string {
  const map: Record<string, string> = {
    synced: '已同步',
    unpushed: '未推送',
    outdated: '落后远程',
    dirty: '有修改',
    error: '同步失败',
  }
  return map[status] || status
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

async function fetchRepos() {
  loading.value = true
  error.value = ''
  try {
    const res = await new Promise<any>((resolve, reject) => {
      uni.request({
        url: '/api/repos',
        method: 'GET',
        success: (r: any) => {
          if (r.statusCode === 200) resolve(r.data)
          else reject(new Error(r.data?.error || '请求失败'))
        },
        fail: reject,
      })
    })
    repos.value = (res.repos || []).map((r: any) => ({
      name: r.name,
      desc: r.desc,
      branch: r.branch || '-',
      folder: r.path ? r.path.split('/').pop() : '',
      ahead: r.ahead || 0,
      syncStatus: r.syncStatus || 'synced',
      color: r.color || '#7170ff',
      commitHash: r.lastCommit?.hash || '',
      commitMsg: r.lastCommit?.message || '',
      commitTime: timeAgo(r.lastCommit?.timestamp),
    }))
  } catch (err: any) {
    error.value = err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function onRefresh() {
  fetchRepos()
}

onMounted(() => { fetchRepos() })
</script>

<style lang="scss" scoped>
.repo-page {
  padding: 0;
  background: #08090a;
  min-height: 100vh;
  overflow-x: hidden;
  touch-action: pan-y;
}

/* Top Bar */
.top-bar {
  padding: 16px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 0;
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
  margin-bottom: 14px;
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

.top-bar-actions {
  position: absolute;
  top: 16px;
  right: 16px;
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

/* Page Body */
.page-body {
  padding: 0 16px 20px;
}

/* Repo Grid */
.repo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.repo-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  min-width: 0; /* Allow grid item to shrink below content size on mobile */
  transition: all 0.15s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

.repo-card-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.repo-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.repo-icon-svg {
  width: 18px;
  height: 18px;
}

.repo-info {
  flex: 1;
  min-width: 0;
}

.repo-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #f7f8f8;
  margin-bottom: 2px;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repo-desc {
  display: block;
  font-size: 11px;
  color: #8a8f98;
  line-height: 1.4;
}

.repo-branch-tag {
  flex-shrink: 0;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 8px;
}

.branch-text {
  font-size: 11px;
  color: #8a8f98;
  font-family: 'JetBrains Mono', monospace;
}

/* Meta Row */
.repo-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.repo-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.meta-icon {
  font-size: 11px;
  flex-shrink: 0;
}

.meta-text {
  font-size: 11px;
  color: #8a8f98;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.ahead-text {
    color: #f59e0b;
  }
}

.repo-sync-status {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.sync-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.sync-text {
  font-size: 11px;
}

.status-synced .sync-dot { background: #22c55e; }
.status-synced .sync-text { color: #22c55e; }
.status-unpushed .sync-dot { background: #f59e0b; }
.status-unpushed .sync-text { color: #f59e0b; }
.status-outdated .sync-dot { background: #f97316; }
.status-outdated .sync-text { color: #f97316; }
.status-dirty .sync-dot { background: #8a8f98; }
.status-dirty .sync-text { color: #8a8f98; }
.status-error .sync-dot { background: #ef4444; }
.status-error .sync-text { color: #ef4444; }

/* Commit Row */
.repo-commit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #8a8f98;
  flex-wrap: nowrap;
  overflow: hidden;
}

.commit-label {
  flex-shrink: 0;
  color: #62666d;
}

.commit-hash {
  font-family: 'JetBrains Mono', monospace;
  color: #62666d;
  flex-shrink: 0;
}

.commit-msg {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #8a8f98;
}

.commit-time {
  flex-shrink: 0;
  color: #62666d;
}
</style>
