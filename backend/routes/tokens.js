/**
 * Token 用量路由
 * 数据来源：PostgreSQL（LiteLLM 数据库）
 */

const express = require('express')
const router = express.Router()
const postgres = require('../services/postgres')

// ── 辅助：解析日期范围 ────────────────────────────────────────────────────────

function parseDateRange(query) {
  const today = new Date()
  const fmt = (d) => d.toISOString().slice(0, 10) // YYYY-MM-DD

  let startDate = query.startDate
  let endDate = query.endDate

  if (!startDate || !endDate) {
    // 默认查最近 7 天
    const days = parseInt(query.days || '7', 10)
    const end = new Date(today)
    const start = new Date(today)
    start.setDate(start.getDate() - days + 1)
    startDate = fmt(start)
    endDate = fmt(end)
  }

  return { startDate, endDate }
}

// ── GET /api/tokens/summary ───────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query)
    const data = await postgres.getTokensSummary(startDate, endDate)
    res.json(data)
  } catch (err) {
    console.error('[tokens/summary]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/tokens/daily ────────────────────────────────────────────────────

router.get('/daily', async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query)
    const model = req.query.model || undefined
    const rows = await postgres.getTokensDaily(startDate, endDate, model)
    res.json({
      startDate,
      endDate,
      model: model || null,
      data: rows.map((r) => ({
        date: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
        promptTokens: parseInt(r.prompt_tokens, 10),
        completionTokens: parseInt(r.completion_tokens, 10),
        tokens: parseInt(r.total_tokens || (r.prompt_tokens + r.completion_tokens), 10),
        cost: parseFloat(r.cost || 0),
      })),
    })
  } catch (err) {
    console.error('[tokens/daily]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/tokens/by-model ──────────────────────────────────────────────────

router.get('/by-model', async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query)
    const rows = await postgres.getTokensByModel(startDate, endDate)
    res.json({
      startDate,
      endDate,
      data: rows.map((r) => ({
        model: r.model_group,
        promptTokens: parseInt(r.prompt_tokens, 10),
        completionTokens: parseInt(r.completion_tokens, 10),
        totalTokens: parseInt(r.total_tokens, 10),
        cost: parseFloat(r.cost || 0),
      })),
    })
  } catch (err) {
    console.error('[tokens/by-model]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/tokens/models ────────────────────────────────────────────────────

router.get('/models', async (req, res) => {
  try {
    const rows = await postgres.getModelList()
    res.json({ models: rows.map((r) => r.model_group) })
  } catch (err) {
    console.error('[tokens/models]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

// ── GET /api/tokens/logs ──────────────────────────────────────────────────────

router.get('/logs', async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query)
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500)
    const offset = parseInt(req.query.offset || '0', 10)
    const rows = await postgres.query(
      `SELECT
         id, model_group, user, total_tokens,
         prompt_tokens, completion_tokens, spend,
         "startTime", endTime, status
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" >= $1::timestamp
         AND "startTime" <  $2::timestamp
       ORDER BY "startTime" DESC
       LIMIT $3 OFFSET $4`,
      [`${startDate} 00:00:00`, `${endDate} 23:59:59`, limit, offset]
    )
    res.json({ total: rows.length, limit, offset, data: rows })
  } catch (err) {
    console.error('[tokens/logs]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

module.exports = router
