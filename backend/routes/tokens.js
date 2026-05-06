/**
 * Token 用量路由
 * 数据来源：PostgreSQL（LiteLLM 数据库）
 */

const express = require('express')
const router = express.Router()
const postgres = require('../services/postgres')

// ── 辅助：解析日期范围 ────────────────────────────────────────────────────────

function parseDateRange(query) {
  // 使用北京时间（Asia/Shanghai），避免 toISOString() 产生 UTC 日期导致差一天
  const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }) // YYYY-MM-DD

  const today = new Date()
  const todayBJ = fmt(today) // 北京时间今天

  let startDate = query.startDate
  let endDate = query.endDate

  if (!startDate || !endDate) {
    const days = parseInt(query.days || '7', 10)
    const start = new Date(today)
    start.setDate(start.getDate() - days + 1)
    startDate = fmt(start)
    endDate = todayBJ
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
          date: String(r.day),  // TO_CHAR 已返回 YYYY-MM-DD 字符串
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
       WHERE "startTime" >= ($1::date)::timestamp AT TIME ZONE 'Asia/Shanghai'
         AND "startTime" <  ($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Shanghai'
       ORDER BY "startTime" DESC
       LIMIT $3 OFFSET $4`,
      [`${startDate}`, `${endDate}`, limit, offset]
    )
    res.json({ total: rows.length, limit, offset, data: rows })
  } catch (err) {
    console.error('[tokens/logs]', err)
    res.status(500).json({ error: '查询失败', detail: err.message })
  }
})

module.exports = router
