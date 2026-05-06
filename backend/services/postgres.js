/**
 * PostgreSQL 查询服务 — LiteLLM 用量数据
 * 连接池：pg.Pool
 *
 * 关键：LiteLLM 数据库的 startTime 列为 timestamp without time zone（naive），
 * 存储的是 UTC 墙钟时间字符串。
 * 所有查询必须用 "startTime" AT TIME ZONE 'UTC' 将其显式声明为 UTC，
 * 再 AT TIME ZONE 'Asia/Shanghai' 投影为北京时间。
 */

const { Pool } = require('pg')
const config = require('../config')

let pool = null

function getPool() {
  if (!pool) {
    pool = new Pool(config.postgres)
    pool.on('error', (err) => {
      console.error('[postgres] Unexpected error on idle client', err)
    })
  }
  return pool
}

async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

async function query(text, params = []) {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()
  }
}

// ── 日期转 UTC 辅助 ──────────────────────────────────────────────────────────

/**
 * 将北京时间日期字符串（YYYY-MM-DD）转为 UTC TIMESTAMPTZ。
 * 原理：北京时间 00:00 = UTC 前一天 16:00。
 * 例如：'2026-05-07' → TIMESTAMPTZ '2026-05-06T16:00:00Z'
 *
 * 注意：这里不做 AT TIME ZONE，直接返回 UTC timestamptz 字符串。
 * 配合 "startTime" AT TIME ZONE 'UTC' 使用：
 *   "startTime" AT TIME ZONE 'UTC' >= bjDayStartUTC('2026-05-07')
 *   → 将 naive startTime 声明为 UTC，再与 bjDayStartUTC 结果（UTC timestamptz）比较。
 */
function bjDayStartUTC(dateStr) {
  return `('${dateStr}'::date + INTERVAL '0 second')::timestamp AT TIME ZONE 'Asia/Shanghai'`
}

/**
 * 将北京时间日期字符串（YYYY-MM-DD）转为次日 00:00 北京时间对应的 UTC TIMESTAMPTZ。
 * 例如：'2026-05-07' → TIMESTAMPTZ '2026-05-07T16:00:00Z'
 * 用于右开区间 < 边界。
 */
function bjDayEndUTC(dateStr) {
  return `(('${dateStr}'::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Shanghai')`
}

/**
 * 获取 startTime 的 UTC 投影表达式（在 SELECT/GROUP BY 中使用）。
 * 1. "startTime" AT TIME ZONE 'UTC' — 将 naive UTC 字符串转为 UTC timestamptz
 * 2. AT TIME ZONE 'Asia/Shanghai' — 投影为北京时间
 * 合起来：把数据库里的 UTC 墙钟时间 → UTC timestamptz → 北京时间
 */
const TZ_UTC = `"startTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'`

// ── Token 用量查询 ──────────────────────────────────────────────────────────

/**
 * 按模型分组统计
 * @param {string} startDate - YYYY-MM-DD（北京时间）
 * @param {string} endDate   - YYYY-MM-DD（北京时间）
 */
async function getTokensByModel(startDate, endDate) {
  return query(
    `SELECT
       model_group,
       SUM(prompt_tokens)      AS prompt_tokens,
       SUM(completion_tokens) AS completion_tokens,
       SUM(total_tokens)      AS total_tokens,
       SUM(spend)             AS cost
     FROM "LiteLLM_SpendLogs"
     WHERE "startTime" AT TIME ZONE 'UTC' >= ${bjDayStartUTC(startDate)}
       AND "startTime" AT TIME ZONE 'UTC' <  ${bjDayEndUTC(endDate)}
     GROUP BY model_group
     ORDER BY total_tokens DESC`,
  )
}

/**
 * 按粒度查询 Token 趋势
 * @param {string} startDate   - YYYY-MM-DD（北京时间）
 * @param {string} endDate     - YYYY-MM-DD（北京时间）
 * @param {string} granularity - '2hour' | 'daily' | 'weekly'
 * @param {string} [model]     - 可选，按模型名过滤
 */
async function getTokensTrend(startDate, endDate, granularity, model) {
  // 不同粒度的分组键 + 标签生成（基于 UTC 投影后的北京时间）
  const groupExpr = {
    '2hour': `LPAD((FLOOR(EXTRACT(HOUR FROM ${TZ_UTC}) / 2) * 2)::text, 2, '0') || ':00'`,
    'daily': `TO_CHAR(${TZ_UTC}, 'YYYY-MM-DD')`,
    'weekly': `TO_CHAR(${TZ_UTC}, 'IYYY-"W"IW')`,
  }

  const labelExpr = groupExpr[granularity] || groupExpr.daily

  const where = model
    ? `WHERE "startTime" AT TIME ZONE 'UTC' >= ${bjDayStartUTC(startDate)}
         AND "startTime" AT TIME ZONE 'UTC' <  ${bjDayEndUTC(endDate)}
         AND model_group = $1`
    : `WHERE "startTime" AT TIME ZONE 'UTC' >= ${bjDayStartUTC(startDate)}
         AND "startTime" AT TIME ZONE 'UTC' <  ${bjDayEndUTC(endDate)}`
  const params = model ? [model] : []

  return query(
    `SELECT
       ${labelExpr} AS label,
       SUM(prompt_tokens)     AS prompt_tokens,
       SUM(completion_tokens) AS completion_tokens,
       SUM(total_tokens)      AS total_tokens,
       SUM(spend)             AS cost
     FROM "LiteLLM_SpendLogs"
     ${where}
     GROUP BY label
     ORDER BY label`,
    params,
  )
}

/** 按日聚合（兼容旧接口，默认 daily 粒度） */
async function getTokensDaily(startDate, endDate, model) {
  return getTokensTrend(startDate, endDate, 'daily', model)
}

/**
 * 总览摘要（指标 + 模型分布）
 */
async function getTokensSummary(startDate, endDate) {
  const [totals, distribution] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(total_tokens), 0)       AS total_tokens,
         COALESCE(SUM(prompt_tokens), 0)      AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0)  AS completion_tokens,
         COALESCE(SUM(spend), 0)              AS total_cost
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" AT TIME ZONE 'UTC' >= ${bjDayStartUTC(startDate)}
         AND "startTime" AT TIME ZONE 'UTC' <  ${bjDayEndUTC(endDate)}`,
    ),
    query(
      `SELECT
         model_group,
         SUM(total_tokens) AS tokens
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" AT TIME ZONE 'UTC' >= ${bjDayStartUTC(startDate)}
         AND "startTime" AT TIME ZONE 'UTC' <  ${bjDayEndUTC(endDate)}
       GROUP BY model_group
       ORDER BY tokens DESC`,
    ),
  ])

  const total = parseInt(totals[0]?.total_tokens || 0, 10)

  return {
    totalTokens: total,
    totalPromptTokens: parseInt(totals[0]?.prompt_tokens || 0, 10),
    totalCompletionTokens: parseInt(totals[0]?.completion_tokens || 0, 10),
    totalCost: parseFloat(totals[0]?.total_cost || 0),
    modelDistribution: distribution.map((r) => ({
      model: r.model_group,
      tokens: parseInt(r.tokens, 10),
      percentage: total > 0 ? Math.round((parseInt(r.tokens, 10) / total) * 1000) / 10 : 0,
    })),
  }
}

/**
 * 模型列表（有消耗记录的）
 */
async function getModelList() {
  return query(
    `SELECT DISTINCT model_group
     FROM "LiteLLM_SpendLogs"
     ORDER BY model_group`,
  )
}

module.exports = {
  query,
  getPool,
  closePool,
  getTokensByModel,
  getTokensDaily,
  getTokensTrend,
  getTokensSummary,
  getModelList,
}
