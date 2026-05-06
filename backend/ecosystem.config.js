/**
 * pm2 生产部署配置
 * 使用：pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'hermes-dashboard-bff',
      script: 'server.js',

      // 启动方式
      instances: 1,
      exec_mode: 'fork', // BFF 是无状态服务，fork 模式足够

      // 工作目录
      cwd: '/home/agentuser/public/hermes-dashboard/backend',

      // 自动重启
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',

      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3001,

        // LiteLLM
        LITELLM_API_URL: 'http://localhost:4000',
        LITELLM_API_KEY: 'sk-litellm-masteR-kEy-2026',

        // PostgreSQL（LiteLLM 数据库）
        PG_HOST: 'localhost',
        PG_PORT: 5432,
        PG_DATABASE: 'litellm',
        PG_USER: 'agentuser',
        PG_PASSWORD: 'litellm_local_pg',

        // SQLite（看板数据库）
        KANBAN_DB_PATH: '/home/agentuser/.hermes/kanban.db',

        // 认证
        DASHBOARD_KEY: 'hermes-secret-key',
        JWT_SECRET: 'hermes-dashboard-jwt-secret-2026',
      },

      // 日志
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // 科学上网代理（如果需要访问外网模型）
      // env_production: {
      //   HTTP_PROXY: 'http://127.0.0.1:7890',
      //   HTTPS_PROXY: 'http://127.0.0.1:7890',
      // },
    },
  ],
}
