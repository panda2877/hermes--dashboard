/**
 * SQLite 查询服务 — Hermes 看板数据
 * 使用 sql.js（纯 JS，无需本地编译）
 */

const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')
const config = require('../config')

let db = null

/**
 * 初始化数据库（异步，需等待 WASM 加载）
 */
async function initDb() {
  if (db) return db
  const SQL = await initSqlJs()
  const dbPath = config.sqlite.dbPath

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
    console.log(`[sqlite] Opened: ${dbPath}`)
  } else {
    db = new SQL.Database()
    console.warn(`[sqlite] File not found: ${dbPath}, using empty in-memory DB`)
  }

  return db
}

/**
 * 同步查询封装
 * @param {string} sql
 * @param {any[]} params
 * @returns {any[]}
 */
function query(sql, params = []) {
  if (!db) throw new Error('SQLite not initialized. Call initDb() first.')
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

/**
 * 关闭数据库连接
 */
function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

// ── 看板任务查询 ─────────────────────────────────────────────────────────────

/**
 * 规范化任务状态：将 Hermes CLI 的 in-progress（连字符）映射为 BFF 使用的 in_progress（下划线）
 */
function normalizeStatus(status) {
  return status === 'in-progress' ? 'in_progress' : status
}

/**
 * 获取任务列表
 * @param {object} filters - { status?, assignee?, priority?, project? }
 */
function getTasks(filters = {}) {
  let sql = `
    SELECT
      id,
      title,
      status,
      priority,
      assignee,
      workspace_path AS project,
      workflow_template_id AS phase,
      created_at,
      started_at,
      completed_at
    FROM tasks
    WHERE 1=1
  `
  const params = []

  if (filters.status) {
    params.push(filters.status)
    sql += ` AND status = ?`
  }
  if (filters.assignee) {
    params.push(filters.assignee)
    sql += ` AND assignee = ?`
  }
  if (filters.priority) {
    params.push(filters.priority)
    sql += ` AND priority = ?`
  }
  if (filters.project) {
    params.push(filters.project)
    sql += ` AND workspace_path = ?`
  }

  sql += `
    ORDER BY
      CASE
        WHEN status IN ('in_progress', 'in-progress') THEN 0
        WHEN status = 'backlog'     THEN 1
        WHEN status IN ('done', 'completed') THEN 2
        ELSE 3
      END,
      CASE priority
        WHEN 'P0' THEN 0
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
      END,
      created_at DESC
  `

  return query(sql, params).map((t) => ({
    ...t,
    status: normalizeStatus(t.status),
  }))
}

/**
 * 获取单个任务
 */
function getTaskById(id) {
  const rows = query(
    `SELECT
       id, title, body, status, priority,
       assignee, workspace_path AS project,
       workflow_template_id AS phase,
       created_at, started_at, completed_at,
       skills, project_name
     FROM tasks WHERE id = ?`,
    [id]
  )
  if (rows[0]) {
    rows[0].status = normalizeStatus(rows[0].status)
  }
  return rows[0] || null
}

/**
 * 更新任务状态
 */
function updateTaskStatus(id, status) {
  const now = new Date().toISOString()
  let sql, params

  if (status === 'done' || status === 'completed') {
    sql = `UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`
    params = [status, now, id]
  } else {
    sql = `UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?`
    params = [status, id]
  }

  const result = query(sql, params)
  return result.length >= 0
}

/**
 * 看板统计
 */
function getKanbanStats() {
  const rows = query(`
    SELECT status, COUNT(*) AS count
    FROM tasks
    GROUP BY status
  `)
  // 合并 in_progress + in-progress
  const merged = {}
  for (const row of rows) {
    const key = normalizeStatus(row.status)
    merged[key] = (merged[key] || 0) + parseInt(row.count, 10)
  }
  return Object.entries(merged).map(([status, count]) => ({ status, count }))
}

module.exports = {
  initDb,
  closeDb,
  getTasks,
  getTaskById,
  updateTaskStatus,
  getKanbanStats,
}
