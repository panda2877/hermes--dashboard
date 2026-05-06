/**
 * PostgreSQL 查询服务 — LiteLLM 用量数据
 * 连接池：pg.Pool
 *
 * 注意：所有日期参数均被视为北京时间（Asia/Shanghai）。
 * 使用 AT TIME ZONE 'Asia/Shanghai' 对 UTC 时间戳列做投影，转换为北京时间日期用于过滤和分组。
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
 * 将北京时间日期字符串（YYYY-MM-DD）转为对应当天 00:00:00 北京时间，
 * 即 UTC 00:00:00 - 8h = 前一天 16:00:00 UTC。
 * 用于 WHERE 条件左边界（>=）。
 * 例如：'2026-05-07' → TIMESTAMPTZ '2026-05-06T16:00:00Z'
 */
function bjDayStart(dateStr) {
  // 'Asia/Shanghai' AT TIME ZONE：对 naive timestamp（midnight），当作 Asia/Shanghai 本地时间，
  // 输出对应的 UTC timestamptz（凌晨北京时间 = 前一天 UTC 下午）
  return `('${dateStr}'::date)::timestamp AT TIME ZONE 'Asia/Shanghai'`
}

/**
 * 将北京时间日期字符串（YYYY-MM-DD）转为对应次日 00:00:00 北京时间。
 * 用于 WHERE 条件右边界（<，区间右开）。
 * 例如：'2026-05-07' → TIMESTAMPTZ '2026-05-07T16:00:00Z'
 */
function bjDayEnd(dateStr) {
  return `(('${dateStr}'::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Shanghai')`
}

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
     WHERE "startTime" >= ${bjDayStart(startDate)}
       AND "startTime" <  ${bjDayEnd(endDate)}
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
  // 不同粒度的分组键 + 标签生成
  const groupExpr = {
    '2hour': `LPAD((FLOOR(EXTRACT(HOUR FROM "startTime" AT TIME ZONE 'Asia/Shanghai') / 2) * 2)::text, 2, '0') || ':00'`,
    'daily': `TO_CHAR("startTime" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
    'weekly': `TO_CHAR("startTime" AT TIME ZONE 'Asia/Shanghai', 'IYYY-"W"IW')`,
  }

  const labelExpr = groupExpr[granularity] || groupExpr.daily

  const where = model
    ? `WHERE "startTime" >= ${bjDayStart(startDate)}
         AND "startTime" <  ${bjDayEnd(endDate)}
         AND model_group = $1`
    : `WHERE "startTime" >= ${bjDayStart(startDate)}
         AND "startTime" <  ${bjDayEnd(endDate)}`
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
         COALESCE(SUM(prompt_tokens), 0)       AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0)   AS completion_tokens,
         COALESCE(SUM(spend), 0)               AS total_cost
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" >= ${bjDayStart(startDate)}
         AND "startTime" <  ${bjDayEnd(endDate)}`,
    ),
    query(
      `SELECT
         model_group,
         SUM(total_tokens) AS tokens
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" >= ${bjDayStart(startDate)}
         AND "startTime" <  ${bjDayEnd(endDate)}
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
