/**
 * 里程碑路由
 * GET  /api/kanban/milestones     — 获取项目-里程碑-任务三层聚合数据
 * GET  /api/kanban/milestones/:id — 获取单个里程碑详情（含任务列表）
 * GET  /api/projects              — 获取项目列表（含进度统计）
 */

const express = require('express')
const router = express.Router()
const sqlite = require('../services/sqlite')
const milestone = require('../services/milestone')

// ── GET /api/kanban/milestones ───────────────────────────────────────────────

router.get('/milestones', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const data = milestone.getMilestones()
    res.json({ total: data.length, data })
  } catch (err) {
    console.error('[kanban/milestones]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/kanban/milestones/:id ───────────────────────────────────────────

router.get('/milestones/:id', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const data = milestone.getMilestoneById(req.params.id)
    if (!data) {
      return res.status(404).json({ error: '里程碑不存在' })
    }
    res.json(data)
  } catch (err) {
    console.error('[kanban/milestones/:id]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/projects ────────────────────────────────────────────────────────

router.get('/projects', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const data = milestone.getProjects()
    res.json({ total: data.length, data })
  } catch (err) {
    console.error('[kanban/projects]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

module.exports = router