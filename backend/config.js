/**
 * BFF 配置 — 所有敏感信息从环境变量读取
 * 生产环境通过 ecosystem.config.js 注入，开发环境读取 .env 或使用默认值
 */

module.exports = {
  port: process.env.PORT || 3001,

  // ── LiteLLM ──────────────────────────────────────────────────────────────
  litellm: {
    apiUrl: process.env.LITELLM_API_URL || 'http://localhost:4000',
    apiKey: process.env.LITELLM_API_KEY || 'sk-litellm-masteR-kEy-2026',
  },

  // ── PostgreSQL（LiteLLM 数据库）────────────────────────────────────────
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'litellm',
    user: process.env.PG_USER || 'agentuser',
    password: process.env.PG_PASSWORD || 'litellm_local_pg',
    // 连接池配置
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  // ── SQLite（看板数据库）────────────────────────────────────────────────
  sqlite: {
    dbPath: process.env.KANBAN_DB_PATH || '/home/agentuser/.hermes/kanban.db',
  },

  // ── 认证 ───────────────────────────────────────────────────────────────
  auth: {
    // 前端登录密钥（后续可改为数据库存储）
    dashboardKey: process.env.DASHBOARD_KEY || 'hermes-secret-key',
    // JWT Secret（预留扩展用）
    jwtSecret: process.env.JWT_SECRET || 'hermes-dashboard-secret-2026',
  },

  // ── 请求限流 ───────────────────────────────────────────────────────────
  rateLimit: {
    windowMs: 60 * 1000, // 1 分钟
    max: 100, // 最多 100 次/分钟
  },
}
