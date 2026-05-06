/**
 * Agent 状态路由
 * 当前返回静态数据，后续对接 Hermes Gateway API
 */

const express = require('express')
const router = express.Router()

// 静态数据（待后续对接 Gateway 真实 API）
const AGENTS = [
  { id: 'xingruyin', name: '辛如音', model: 'DeepSeek-V3', status: 'online', totalTasks: 47, uptime: '12h 34m', concurrency: 3 },
  { id: 'ziling', name: '紫灵', model: 'Claude-3.5-Sonnet', status: 'online', totalTasks: 32, uptime: '8h 21m', concurrency: 2 },
  { id: 'siyue', name: '思月', model: 'GPT-4o', status: 'online', totalTasks: 28, uptime: '6h 15m', concurrency: 2 },
  { id: 'mo', name: '墨', model: 'DeepSeek-R1', status: 'offline', totalTasks: 15, uptime: '0h 0m', concurrency: 0 },
]

// ── GET /api/agents ─────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.json({ data: AGENTS })
})

// ── GET /api/agents/:id ──────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
  const agent = AGENTS.find((a) => a.id === req.params.id)
  if (!agent) {
    return res.status(404).json({ error: 'Agent 不存在' })
  }
  res.json(agent)
})

module.exports = router
