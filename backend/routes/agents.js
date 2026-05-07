/**
 * Agent 状态路由
 *
 * 数据源：
 *   ~/.hermes/profiles/<id>/gateway_state.json  → 子进程运行时状态
 *   ~/.hermes/profiles/<id>/config.yaml        → 默认模型
 *   ps -p <PID> -o etimes=                    → 各 Gateway 运行时长（秒）
 *   ~/.hermes/state.db（主）/ <profile>/state.db（子） → session 活跃判断
 *   kanban.db → 按负责人统计待办数量
 */

const express = require('express')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const YAML = require('yaml')
const config = require('../config')
const sqlite = require('../services/sqlite')
const initSqlJs = require('sql.js')

const router = express.Router()

const PROFILES_DIR = config.hermes.profilesPath
const MAIN_PID = config.hermes.mainGatewayPid
const PROFILE_NAMES = config.hermes.profileNames

// Agent 活跃阈值：最后消息超过此秒数视为"空闲"（默认 20 分钟）
const IDLE_THRESHOLD_SECS = 20 * 60

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

/**
 * 从 state.db 判断 Agent 工作状态
 * 返回值：'working' | 'idle' | null（无法判断时返回 null）
 *
 * 逻辑：
 *   1. 找 ended_at IS NULL 的 session
 *   2. 查该 session 最后一条消息的 timestamp
 *   3. 如果 last_active 在 IDLE_THRESHOLD_SECS 内 → 'working'
 *   4. 否则 → 'idle'
 */
async function getAgentWorkStatus(stateDbPath) {
  if (!fs.existsSync(stateDbPath)) return null

  try {
    const SQL = await initSqlJs()
    const buffer = fs.readFileSync(stateDbPath)
    const db = new SQL.Database(buffer)

    // 找 ended_at IS NULL 的最新 session
    const stmt = db.prepare(`
      SELECT id, started_at
      FROM sessions
      WHERE ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `)

    let status = null
    if (stmt.step()) {
      const session = stmt.getAsObject()
      const sessionId = session.id

      // 查该 session 最后一条消息的时间
      const msgStmt = db.prepare(`
        SELECT timestamp FROM messages
        WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `)
      msgStmt.bind([sessionId])

      let lastActive = null
      if (msgStmt.step()) {
        lastActive = msgStmt.getAsObject().timestamp
      }
      msgStmt.free()

      // 无 messages 记录 → 不算工作中（可能是刚创建的僵尸 session）
      if (lastActive === null) {
        status = 'idle'
      } else {
        const nowSecs = Date.now() / 1000
        const idleSecs = nowSecs - lastActive
        status = idleSecs < IDLE_THRESHOLD_SECS ? 'working' : 'idle'
      }
    } else {
      // 没有任何活跃 session → 空闲
      status = 'idle'
    }

    stmt.free()
    db.close()
    return status
  } catch (err) {
    console.warn(`[agents] 读取 state.db 失败 ${stateDbPath}:`, err.message)
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

      // 判断 agent 工作状态
      const stateDbPath = path.join(PROFILES_DIR, profileId, 'state.db')
      const workStatus = await getAgentWorkStatus(stateDbPath)

      profiles.push({
        id: profileId,
        name,
        model,
        pid: state.pid,
        state: state.gateway_state === 'running' ? 'running' : 'stopped',
        workStatus: workStatus, // 'working' | 'idle' | null
        uptime: formatUptime(uptimeSeconds),
        uptimeSeconds: uptimeSeconds,
        isMain: false,
      })
    }

    // 2. 主 Gateway 作为银月的 Agent（id='yinyue'）
    const mainUptimeSecs = getPidUptime(MAIN_PID)
    const mainStateDbPath = path.join(config.hermes.profilesPath, '..', 'state.db')
    const mainWorkStatus = await getAgentWorkStatus(mainStateDbPath)

    profiles.unshift({
      id: 'yinyue',
      name: PROFILE_NAMES['yinyue'] || '银月',
      model: '—',
      pid: MAIN_PID,
      state: mainUptimeSecs !== null ? 'running' : 'stopped',
      workStatus: mainWorkStatus,
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
