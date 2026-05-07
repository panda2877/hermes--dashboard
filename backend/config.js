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

  // ── Hermes Agent ────────────────────────────────────────────────────────
  hermes: {
    profilesPath: process.env.HERMES_PROFILES_PATH || '/home/agentuser/.hermes/profiles',
    mainGatewayPid: parseInt(process.env.HERMES_MAIN_GATEWAY_PID || '195514', 10),
    // profile id → 中文名映射（可扩展）
    profileNames: {
      yinyue: '银月',
      wensiyue: '文思月',
      xingruyin: '辛如音',
      ziling: '紫灵',
    },
  },

  // ── 认证 ───────────────────────────────────────────────────────────────
  auth: {
    // 前端登录密钥（后续可改为数据库存储）
    dashboardKey: process.env.DASHBOARD_KEY || 'hermes-secret-key',
    // JWT Secret（预留扩展用）
    jwtSecret: process.env.JWT_SECRET || 'hermes-dashboard-secret-2026',
  },

  // ── Git 仓库配置 ───────────────────────────────────────────────────────
  repos: [
    {
      id: 'hermes-dashboard',
      name: 'hermes-dashboard',
      desc: 'Hermes 多功能看板前端项目（uni-app + Vue 3）',
      color: '#7170ff',
      path: '/home/agentuser/public/hermes-dashboard',
    },
    {
      id: 'hermes-agent',
      name: 'hermes-agent',
      desc: 'Hermes Agent 核心仓库（CLI / Gateway / Skills）',
      color: '#10b981',
      path: '/home/agentuser/.hermes/hermes-agent',
    },
    {
      id: 'obsidian-vault',
      name: 'obsidian-vault',
      desc: 'Obsidian 知识库（项目管理 / 技术文档 / Wiki）',
      color: '#f59e0b',
      path: '/home/agentuser/obsidian-vault',
    },
    {
      id: 'capability-platform',
      name: 'capability-platform',
      desc: 'Capability Platform（todo-system）',
      color: '#ef4444',
      path: '/home/agentuser/git-repos/todo-system.git',
    },
  ],

  // ── 请求限流 ───────────────────────────────────────────────────────────
  rateLimit: {
    windowMs: 60 * 1000, // 1 分钟
    max: 100, // 最多 100 次/分钟
  },
}
