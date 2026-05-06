#!/bin/bash
# =============================================================================
# Hermes Dashboard 统一启动脚本
# 用法:
#   ./start.sh          # 开发模式（前台）
#   ./start.sh dev      # 开发模式（同上）
#   ./start.sh prod    # 生产模式（后台 pm2）
#   ./start.sh stop    # 停止生产服务
#   ./start.sh status  # 查看服务状态
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[启动]${NC} $1"; }
warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
info() { echo -e "${CYAN}[信息]${NC} $1"; }
err()  { echo -e "${RED}[错误]${NC} $1" >&2; }

# ── 检查依赖 ─────────────────────────────────────────────────────────────────

check_deps() {
  # 检查 Node.js
  if ! command -v node &>/dev/null; then
    err "Node.js 未安装，请先安装 Node.js >= 18"
    exit 1
  fi

  # 检查前端依赖
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    warn "前端依赖未安装，开始安装..."
    cd "$FRONTEND_DIR" && npm install
  fi

  # 检查后端依赖
  if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    warn "后端依赖未安装，开始安装..."
    cd "$BACKEND_DIR" && npm install
  fi
}

# ── 开发模式 ─────────────────────────────────────────────────────────────────

start_dev() {
  check_deps

  log "开发模式启动"
  echo ""
  info "  前端 H5: http://localhost:5173"
  info "  BFF API: http://localhost:3001"
  info "  Vite 代理 /api → BFF，无需跨域"
  echo ""

  # 启动后端（后台运行）
  cd "$BACKEND_DIR"
  log "启动 BFF (nodemon)..."
  PORT=3001 node server.js &
  BFF_PID=$!

  # 等待 BFF 就绪
  sleep 2
  if ! kill -0 $BFF_PID 2>/dev/null; then
    err "BFF 启动失败，请检查端口 3001 是否被占用"
    exit 1
  fi
  log "BFF 启动成功 (PID: $BFF_PID)"

  # 启动前端
  log "启动前端 H5..."
  cd "$FRONTEND_DIR"
  npm run dev:h5 &
  FRONTEND_PID=$!

  log "前端启动成功 (PID: $FRONTEND_PID)"
  echo ""
  info "按 Ctrl+C 停止所有服务"

  # 等待任意进程退出
  wait $BFF_PID $FRONTEND_PID
}

# ── 生产模式 ─────────────────────────────────────────────────────────────────

start_prod() {
  # 检查 pm2
  if ! command -v pm2 &>/dev/null; then
    warn "pm2 未安装，开始安装..."
    npm install -g pm2
  fi

  check_deps

  log "生产模式启动"

  # 启动后端 BFF
  log "启动 BFF (pm2)..."
  cd "$BACKEND_DIR"
  pm2 start ecosystem.config.js

  # 等待 BFF 就绪
  sleep 2
  BFF_STATUS=$(pm2 jlist 2>/dev/null | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const app = data.find(a => a.name === 'hermes-dashboard-bff');
    console.log(app ? app.pm2_env.status : 'not_found');
  " 2>/dev/null || echo "unknown")

  if [ "$BFF_STATUS" = "online" ]; then
    log "BFF 启动成功"
  else
    err "BFF 启动失败，状态: $BFF_STATUS"
    exit 1
  fi

  # 构建前端
  log "构建前端 H5..."
  cd "$FRONTEND_DIR"
  npm run build:h5

  log "前端构建完成，产物在 dist/"
  echo ""
  info "前端可通过 Nginx 托管 dist/ 目录"
  info "BFF 端口: 3001"
  info ""
  info "常用 pm2 命令："
  info "  pm2 status          - 查看状态"
  info "  pm2 logs bff        - 查看 BFF 日志"
  info "  pm2 restart bff     - 重启 BFF"
  info "  pm2 stop bff        - 停止 BFF"
  info "  pm2 delete bff      - 删除服务"

  # 保存 pm2 进程列表
  pm2 save
  log "pm2 进程已保存"
}

# ── 停止 ─────────────────────────────────────────────────────────────────────

stop_prod() {
  if ! command -v pm2 &>/dev/null; then
    info "pm2 未安装，无需停止"
    return
  fi
  log "停止生产服务..."
  cd "$BACKEND_DIR" && pm2 stop hermes-dashboard-bff 2>/dev/null || true
  log "停止完成"
}

# ── 状态 ─────────────────────────────────────────────────────────────────────

status() {
  if ! command -v pm2 &>/dev/null; then
    info "pm2 未安装"
    return
  fi
  pm2 status hermes-dashboard-bff
}

# ── 主入口 ─────────────────────────────────────────────────────────────────────

case "${1:-dev}" in
  dev|dev:*|"")
    start_dev
    ;;
  prod|production)
    start_prod
    ;;
  stop)
    stop_prod
    ;;
  status)
    status
    ;;
  *)
    echo "用法: $0 {dev|prod|stop|status}"
    echo ""
    echo "  dev     - 开发模式（前台运行，Ctrl+C 停止）"
    echo "  prod    - 生产模式（pm2 后台运行）"
    echo "  stop    - 停止生产服务"
    echo "  status  - 查看 pm2 服务状态"
    exit 1
    ;;
esac
