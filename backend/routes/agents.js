/**
 * Agent 状态路由
 *
 * 数据源：
 *   ~/.hermes/profiles/<id>/gateway_state.json  → 子进程运行时状态
 *   ~/.hermes/profiles/<id>/config.yaml        → 默认模型
 *   ps -p <PID> -o etimes=                    → 各 Gateway 运行时长（秒）
 *   kanban.db → 按负责人统计待办数量
 */

const express = require('express')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const YAML = require('yaml')
const config = require('../config')
const sqlite = require('../services/sqlite')

const router = express.Router()

const PROFILES_DIR = config.hermes.profilesPath
const MAIN_PID = config.hermes.mainGatewayPid
const PROFILE_NAMES = config.hermes.profileNames

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || parts.length === 0) parts.push(`${m}m`)
  return parts.join(' ')
}

function getPidUptime(pid) {
  try {
    const out = execSync(`ps -p ${pid} -o etimes= 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim()
    const secs = parseInt(out, 10)
    return isNaN(secs) ? null : secs
  } catch {
    return null
  }
}

function readDefaultModel(profileId) {
  try {
    const yamlPath = path.join(PROFILES_DIR, profileId, 'config.yaml')
    const content = fs.readFileSync(yamlPath, 'utf-8')
    const doc = YAML.parse(content)
    return doc?.model?.default || '—'
  } catch {
    return '—'
  }
}

function readGatewayState(profileId) {
  try {
    const statePath = path.join(PROFILES_DIR, profileId, 'gateway_state.json')
    const raw = fs.readFileSync(statePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── GET /api/agents ─────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    // 1. 遍历子进程 profile
    const entries = fs.readdirSync(PROFILES_DIR, { withFileTypes: true })
    const profiles = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const profileId = entry.name
      if (profileId === 'shared') continue

      const state = readGatewayState(profileId)
      if (!state || !state.pid) continue

      const uptimeSeconds = getPidUptime(state.pid)
      const model = readDefaultModel(profileId)
      const name = PROFILE_NAMES[profileId] || profileId

      profiles.push({
        id: profileId,
        name,
        model,
        pid: state.pid,
        state: state.gateway_state === 'running' ? 'running' : 'stopped',
        uptime: formatUptime(uptimeSeconds),
        uptimeSeconds: uptimeSeconds,
        isMain: false,
      })
    }

    // 2. 主 Gateway 作为银月的 Agent（id='yinyue'）
    const mainUptimeSecs = getPidUptime(MAIN_PID)
    profiles.unshift({
      id: 'yinyue',
      name: PROFILE_NAMES['yinyue'] || '银月',
      model: '—',
      pid: MAIN_PID,
      state: mainUptimeSecs !== null ? 'running' : 'stopped',
      uptime: formatUptime(mainUptimeSecs),
      uptimeSeconds: mainUptimeSecs,
      isMain: true,
    })

    // 3. 待办数量（从 kanban.db）
    await sqlite.reloadIfChanged()
    const backlogCounts = sqlite.getBacklogCounts()

    // 合并待办数量到每个 agent
    const result = profiles.map((p) => ({
      ...p,
      backlogCount: backlogCounts[p.id] ?? 0,
    }))

    res.json({ agents: result })
  } catch (err) {
    console.error('[agents] 查询失败:', err)
    res.status(500).json({ error: 'Agent 状态查询失败', detail: err.message })
  }
})

module.exports = router
