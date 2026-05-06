/**
 * PostgreSQL 查询服务 — LiteLLM 用量数据
 * 连接池：pg.Pool
 */

const { Pool } = require('pg')
const config = require('../config')

let pool = null

/**
 * 获取连接池（单例）
 */
function getPool() {
  if (!pool) {
    pool = new Pool(config.postgres)
    pool.on('error', (err) => {
      console.error('[postgres] Unexpected error on idle client', err)
    })
  }
  return pool
}

/**
 * 关闭连接池
 */
async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

/**
 * 查询封装
 * @param {string} text - SQL 语句
 * @param {any[]} params - 参数数组
 * @returns {Promise<any[]>}
 */
async function query(text, params = []) {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()
  }
}

// ── Token 用量查询 ──────────────────────────────────────────────────────────

/**
 * 按模型分组统计
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 */
async function getTokensByModel(startDate, endDate) {
  return query(
    `SELECT
       model_group,
       SUM(prompt_tokens)     AS prompt_tokens,
       SUM(completion_tokens) AS completion_tokens,
       SUM(total_tokens)      AS total_tokens,
       SUM(spend)             AS cost
     FROM "LiteLLM_SpendLogs"
     WHERE "startTime" >= $1::timestamp
       AND "startTime" <  $2::timestamp
     GROUP BY model_group
     ORDER BY total_tokens DESC`,
    [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
  )
}

/**
 * 按日聚合趋势
 */
async function getTokensDaily(startDate, endDate) {
  return query(
    `SELECT
       DATE("startTime")         AS day,
       SUM(prompt_tokens)     AS prompt_tokens,
       SUM(completion_tokens) AS completion_tokens,
       SUM(total_tokens)      AS total_tokens,
       SUM(spend)             AS cost
     FROM "LiteLLM_SpendLogs"
     WHERE "startTime" >= $1::timestamp
       AND "startTime" <  $2::timestamp
     GROUP BY DATE("startTime")
     ORDER BY day`,
    [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
  )
}

/**
 * 总览摘要（指标 + 模型分布）
 */
async function getTokensSummary(startDate, endDate) {
  const [totals, distribution] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(total_tokens), 0)      AS total_tokens,
         COALESCE(SUM(prompt_tokens), 0)     AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
         COALESCE(SUM(spend), 0)            AS total_cost
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" >= $1::timestamp
         AND "startTime" <  $2::timestamp`,
      [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
    ),
    query(
      `SELECT
         model_group,
         SUM(total_tokens) AS tokens
       FROM "LiteLLM_SpendLogs"
       WHERE "startTime" >= $1::timestamp
         AND "startTime" <  $2::timestamp
       GROUP BY model_group
       ORDER BY tokens DESC`,
      [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
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
     ORDER BY model_group`
  )
}

module.exports = {
  query,
  getPool,
  closePool,
  getTokensByModel,
  getTokensDaily,
  getTokensSummary,
  getModelList,
}
