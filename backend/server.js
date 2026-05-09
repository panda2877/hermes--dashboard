/**
 * Hermes Dashboard BFF — 主入口
 * 启动：node server.js
 * 开发：nodemon server.js
 */

const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const config = require('./config')
const postgres = require('./services/postgres')
const sqlite = require('./services/sqlite')
const litellmApi = require('./services/litellmApi')
const gitRepo = require('./services/gitRepo')

// ── 路由 ─────────────────────────────────────────────────────────────────────
const authRouter = require('./routes/auth')
const tokensRouter = require('./routes/tokens')
const kanbanRouter = require('./routes/kanban')
const agentsRouter = require('./routes/agents')
const reposRouter = require('./routes/repos')
const milestoneRouter = require('./routes/milestone')
const cronjobsRouter = require('./routes/cronjobs')
const skillsRouter = require('./routes/skills')
const lifeRouter = require('./routes/life')

// ── Express 应用 ─────────────────────────────────────────────────────────────
const app = express()

// ── 中间件 ───────────────────────────────────────────────────────────────────

// CORS（开发环境允许本地前端访问）
app.use(cors({
  origin: true, // Vite 开发服务器会发 Origin header
  credentials: true,
}))

// 请求体解析
app.use(express.json())

// 请求日志
app.use((req, _res, next) => {
  const ts = new Date().toISOString().slice(11, 23)
  console.log(`[${ts}] ${req.method} ${req.path}`)
  next()
})

// 限流（防止滥用）
app.use('/api', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
}))

// ── 健康检查 ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── 路由挂载 ─────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter)
app.use('/api/tokens', tokensRouter)
app.use('/api/kanban', kanbanRouter)
app.use('/api/agents', agentsRouter)
app.use('/api/repos', reposRouter)
app.use('/api/kanban', milestoneRouter)
app.use('/api', milestoneRouter)  // projects 路由挂在 /api 下
app.use('/api/cronjobs', cronjobsRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/life', lifeRouter)

// 404
app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 全局错误处理
app.use((err, _req, res, _next) => {
  console.error('[server error]', err)
  res.status(500).json({ error: '服务器内部错误', detail: err.message })
})

// ── 启动 ─────────────────────────────────────────────────────────────────────

async function start() {
  const port = config.port

  // 初始化 SQLite（异步 WASM 加载）
  try {
    await sqlite.initDb()
  } catch (err) {
    console.error('[startup] SQLite init failed:', err.message)
    console.warn('[startup] Continuing without SQLite...')
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Hermes Dashboard BFF running on http://0.0.0.0:${port}`)
    console.log(`   PostgreSQL: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`)
    console.log(`   SQLite: ${config.sqlite.dbPath}`)

    // 启动 LiteLLM 模型健康状态后台同步（每2分钟）
    litellmApi.startHealthSync().catch(err => {
      console.warn('[startup] Health sync start failed:', err.message)
    })

    // 启动 Git 仓库状态后台同步（每10分钟）
    gitRepo.startRepoSync(config.repos)
  })
}

// 优雅退出
process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM received')
  await postgres.closePool()
  sqlite.closeDb()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[shutdown] SIGINT received')
  await postgres.closePool()
  sqlite.closeDb()
  process.exit(0)
})

start()

module.exports = app // 供测试使用
