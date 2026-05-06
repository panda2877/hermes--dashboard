/**
 * 看板任务路由
 * 数据来源：SQLite（kanban.db）
 */

const express = require('express')
const router = express.Router()
const sqlite = require('../services/sqlite')

// ── GET /api/kanban/tasks ─────────────────────────────────────────────────────

router.get('/tasks', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const { status, assignee, priority, project } = req.query
    const tasks = sqlite.getTasks({ status, assignee, priority, project })
    res.json({ total: tasks.length, data: tasks })
  } catch (err) {
    console.error('[kanban/tasks]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/kanban/tasks/:id ─────────────────────────────────────────────────

router.get('/tasks/:id', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const task = sqlite.getTaskById(req.params.id)
    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }
    res.json(task)
  } catch (err) {
    console.error('[kanban/tasks/:id]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── PUT /api/kanban/tasks/:id/status ─────────────────────────────────────────

router.put('/tasks/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {}
    const validStatuses = ['backlog', 'in_progress', 'done', 'completed']

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: '无效状态',
        valid: validStatuses,
      })
    }

    await sqlite.reloadIfChanged()
    sqlite.updateTaskStatus(req.params.id, status)
    await sqlite.saveDb()  // 持久化写入磁盘
    const updated = sqlite.getTaskById(req.params.id)
    res.json({ success: true, task: updated })
  } catch (err) {
    console.error('[kanban/tasks/:id/status]', err)
    res.status(500).json({ error: '更新失败', detail: err.message })
  }
})

// ── GET /api/kanban/stats ────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const rows = sqlite.getKanbanStats()
    // 转换为 { backlog: N, in_progress: N, done: N }
    const stats = {}
    for (const row of rows) {
      stats[row.status] = parseInt(row.count, 10)
    }
    res.json(stats)
  } catch (err) {
    console.error('[kanban/stats]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

module.exports = router
