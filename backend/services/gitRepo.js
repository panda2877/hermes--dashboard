/**
 * Git 仓库信息采集服务
 *
 * 功能：每 10 分钟后台采集 4 个仓库的 git 状态，写入 data/repos.json
 * 前端请求时直接从内存读取，零等待
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const DATA_FILE = path.join(__dirname, '..', 'data', 'repos.json')
const SYNC_INTERVAL_MS = 10 * 60 * 1000 // 10 分钟

let reposCache = []
let lastSyncAt = null

// ── Git 命令封装 ──────────────────────────────────────────────────────────────

function gitCmd(repoPath, cmd) {
  try {
    return execSync(`git -C ${repoPath} ${cmd}`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim()
  } catch {
    return ''
  }
}

/**
 * 采集单个仓库状态
 * @param {object} repoConfig - { id, name, path, desc, color }
 * @returns {object} 仓库状态数据
 */
function collectRepoInfo(repoConfig) {
  const p = repoConfig.path

  // 检测目录是否存在且是 git 仓库
  if (!fs.existsSync(path.join(p, '.git'))) {
    return {
      id: repoConfig.id,
      name: repoConfig.name,
      desc: repoConfig.desc,
      color: repoConfig.color,
      path: p,
      error: 'Not a git repository',
      fetchedAt: new Date().toISOString(),
    }
  }

  // 当前分支
  const branch = gitCmd(p, 'branch --show-current') || 'detached'

  // 远程地址 — 优先取非本地路径的 remote
  let remote = ''
  const remotesRaw = gitCmd(p, 'remote -v')
  if (remotesRaw) {
    const lines = remotesRaw.split('\n')
    // 取第一个不以 /home/ 开头的 remote URL
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length >= 2) {
        const url = parts[1].replace(/\s+\(.*\)$/, '')
        if (url && !url.startsWith('/home/')) {
          remote = url
          break
        }
      }
    }
    // 没有非本地 remote，fallback 到第一个
    if (!remote) {
      const first = lines[0]
      if (first) {
        const parts = first.split('\t')
        if (parts.length >= 2) remote = parts[1].replace(/\s+\(.*\)$/, '')
      }
    }
  }

  // 最新 commit 信息：hash | subject | author | timestamp(unix)
  const logFormat = '%h|%s|%an|%ct'
  const logLine = gitCmd(p, `log -1 --format="${logFormat}"`)
  let commitHash = '', commitMsg = '', commitAuthor = '', commitTimestamp = 0
  if (logLine) {
    const parts = logLine.split('|')
    commitHash = parts[0] || ''
    commitMsg = parts[1] || ''
    commitAuthor = parts[2] || ''
    commitTimestamp = parseInt(parts[3] || '0', 10)
  }

  // 工作区脏文件数
  const dirtyOutput = gitCmd(p, 'status --porcelain')
  const dirtyFiles = dirtyOutput ? dirtyOutput.split('\n').filter(Boolean).length : 0

  // 领先远程的 commit 数（无 upstream 时返回 0）
  const ahead = parseInt(gitCmd(p, 'rev-list --count @{upstream}..HEAD 2>/dev/null') || '0', 10)

  // 落后远程的 commit 数
  const behind = parseInt(gitCmd(p, 'rev-list --count HEAD..@{upstream} 2>/dev/null') || '0', 10)

  // 同步状态（四态）
  let syncStatus = 'synced'
  if (ahead > 0) syncStatus = 'unpushed'
  if (behind > 0) syncStatus = 'outdated'
  if (ahead > 0 && behind > 0) syncStatus = 'unpushed' // 有本地未推送时优先显示"未推送"
  if (dirtyFiles > 0 && syncStatus === 'synced') syncStatus = 'dirty'

  return {
    id: repoConfig.id,
    name: repoConfig.name,
    desc: repoConfig.desc,
    color: repoConfig.color,
    path: p,
    branch,
    remote,
    dirtyFiles,
    ahead,
    behind,
    syncStatus,
    lastCommit: {
      hash: commitHash,
      message: commitMsg,
      author: commitAuthor,
      timestamp: commitTimestamp,
    },
    fetchedAt: new Date().toISOString(),
  }
}

// ── 全量采集 ──────────────────────────────────────────────────────────────────

function collectAll(reposConfig) {
  return reposConfig.map(cfg => collectRepoInfo(cfg))
}

// ── 文件持久化 ────────────────────────────────────────────────────────────────

function saveToFile(data) {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify({ repos: data, updatedAt: new Date().toISOString() }, null, 2))
  } catch (err) {
    console.warn('[gitRepo] 保存文件失败:', err.message)
  }
}

function loadFromFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed.repos || null
  } catch {
    return null
  }
}

// ── 后台同步 ──────────────────────────────────────────────────────────────────

let syncTimer = null

/**
 * 启动后台同步（server.js 调用）
 * 1. 从文件加载兜底数据
 * 2. 立即采集一次
 * 3. 每 10 分钟定时采集
 */
function startRepoSync(reposConfig) {
  // 1. 从文件加载兜底
  const fileData = loadFromFile()
  if (fileData) {
    reposCache = fileData
    console.log('[gitRepo] 已从文件加载仓库数据（%d repos）', reposCache.length)
  }

  // 2. 立即采集一次（异步）
  try {
    reposCache = collectAll(reposConfig)
    lastSyncAt = new Date().toISOString()
    saveToFile(reposCache)
    console.log('[gitRepo] 初始采集完成（%d repos）', reposCache.length)
  } catch (err) {
    console.warn('[gitRepo] 初始采集失败，使用文件数据:', err.message)
  }

  // 3. 定时同步
  syncTimer = setInterval(() => {
    try {
      reposCache = collectAll(reposConfig)
      lastSyncAt = new Date().toISOString()
      saveToFile(reposCache)
      console.log('[gitRepo] 定时同步完成（%d repos）', reposCache.length)
    } catch (err) {
      console.warn('[gitRepo] 定时同步失败:', err.message)
    }
  }, SYNC_INTERVAL_MS)
}

function stopRepoSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

// ── 前端请求接口 ──────────────────────────────────────────────────────────────

/** 获取所有仓库状态（同步，直接读内存缓存） */
function getRepos() {
  return reposCache
}

/** 获取单个仓库详情 */
function getRepoById(id) {
  return reposCache.find(r => r.id === id) || null
}

/** 获取最后同步时间 */
function getLastSyncAt() {
  return lastSyncAt
}

module.exports = {
  startRepoSync,
  stopRepoSync,
  getRepos,
  getRepoById,
  getLastSyncAt,
}
