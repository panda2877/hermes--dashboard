/**
 * Hermes Dashboard BFF — Life 路由组
 * /api/life/* — 生活助手相关接口
 *
 * 路由设计：
 *   GET   /api/life/           — 获取生活助手概览（状态、可用功能列表）
 *   GET   /api/life/status     — 获取当前系统运行状态
 *   GET   /api/life/features   — 获取已启用的功能模块列表
 *   POST  /api/life/execute    — 执行生活助手指令
 *   GET   /api/life/history    — 获取执行历史
 *   GET   /api/life/history/:id — 获取单次执行详情
 *
 * 数据源：
 *   - 生活助手配置：~/.hermes/profiles/ziling/skills/ 扫描
 *   - 执行历史：SQLite kanban.db + 自定义 life_history 表
 */

const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')

const sqlite = require('../services/sqlite')

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 扫描 life-assistant 相关技能目录
 * 返回可用的功能模块列表
 */
function scanLifeFeatures() {
  const features = []
  const skillsRoot = '/home/agentuser/.hermes/skills'

  // 扫描技能目录中与 life 相关的技能
  const walk = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.name === 'SKILL.md' && entry.isFile()) {
        // 尝试解析技能名称
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const nameMatch = content.match(/^\s*name:\s*['"]?(.+?)['"]?\s*$/m)
          const categoryMatch = content.match(/^\s*category:\s*['"]?(.+?)['"]?\s*$/m)
          if (nameMatch) {
            features.push({
              name: nameMatch[1].trim(),
              category: categoryMatch ? categoryMatch[1].trim() : 'uncategorized',
              path: path.relative(skillsRoot, fullPath),
            })
          }
        } catch {
          // 跳过无法解析的文件
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walk(fullPath, path.join(prefix, entry.name))
      }
    }
  }

  walk(skillsRoot)
  return features
}

// ── GET /api/life/ ───────────────────────────────────────────────────────────
// 生活助手概览

router.get('/', async (_req, res) => {
  try {
    await sqlite.reloadIfChanged()
    const features = scanLifeFeatures()

    res.json({
      name: 'Life Assistant',
      version: '1.0.0',
      description: 'Hermes 生活助手路由组',
      status: 'running',
      features_count: features.length,
      data: {
        features: features.slice(0, 20), // 限制返回数量
        total_features: features.length,
      },
    })
  } catch (err) {
    console.error('[life/index]', err)
    res.status(500).json({ error: '获取概览失败', detail: err.message })
  }
})

// ── GET /api/life/status ─────────────────────────────────────────────────────
// 系统运行状态

router.get('/status', async (_req, res) => {
  try {
    await sqlite.reloadIfChanged()

    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        sqlite: 'ok',
        skills: 'ok',
      },
      uptime: process.uptime ? Math.floor(process.uptime()) : 'N/A',
      memory: process.memoryUsage ? (() => {
        const mem = process.memoryUsage()
        return {
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          external: Math.round(mem.external / 1024 / 1024),
        }
      })() : 'N/A',
    }

    res.json(status)
  } catch (err) {
    console.error('[life/status]', err)
    res.status(500).json({ error: '获取状态失败', detail: err.message })
  }
})

// ── GET /api/life/features ───────────────────────────────────────────────────
// 已启用的功能模块列表

router.get('/features', async (_req, res) => {
  try {
    const features = scanLifeFeatures()
    res.json({
      total: features.length,
      data: features,
    })
  } catch (err) {
    console.error('[life/features]', err)
    res.status(500).json({ error: '获取功能列表失败', detail: err.message })
  }
})

// ── POST /api/life/execute ───────────────────────────────────────────────────
// 执行生活助手指令（预留接口，后续实现）

router.post('/execute', async (req, res) => {
  try {
    const { action, params } = req.body

    if (!action) {
      return res.status(400).json({ error: '缺少 action 参数' })
    }

    // 预留执行逻辑，后续根据 action 分发到具体技能
    res.json({
      status: 'pending',
      action,
      params: params || {},
      message: '指令已接收，待实现具体执行逻辑',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[life/execute]', err)
    res.status(500).json({ error: '执行失败', detail: err.message })
  }
})

// ── GET /api/life/history ────────────────────────────────────────────────────
// 获取执行历史

router.get('/history', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()

    // 尝试从 SQLite 读取执行历史
    const { limit = 20, offset = 0 } = req.query
    const sql = `
      SELECT id, action, status, created_at, result
      FROM life_history
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `

    try {
      const rows = await sqlite.query(sql, [parseInt(limit), parseInt(offset)])
      res.json({
        total: rows.length,
        data: rows,
      })
    } catch {
      // life_history 表不存在，返回空结果
      res.json({ total: 0, data: [], message: '执行历史表尚未初始化' })
    }
  } catch (err) {
    console.error('[life/history]', err)
    res.status(500).json({ error: '获取历史失败', detail: err.message })
  }
})

// ── GET /api/life/history/:id ────────────────────────────────────────────────
// 获取单次执行详情

router.get('/history/:id', async (req, res) => {
  try {
    await sqlite.reloadIfChanged()

    const sql = 'SELECT * FROM life_history WHERE id = ?'
    try {
      const rows = await sqlite.query(sql, [req.params.id])
      if (rows.length === 0) {
        return res.status(404).json({ error: '执行记录不存在' })
      }
      res.json(rows[0])
    } catch {
      res.status(404).json({ error: '执行记录不存在或表未初始化' })
    }
  } catch (err) {
    console.error('[life/history/:id]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

module.exports = router
