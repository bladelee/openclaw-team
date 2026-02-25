#!/bin/bash
# OpenClaw 多租户系统 - 停止脚本

set -e

GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_info "停止服务..."
docker-compose down

log_info "清理数据卷？（谨慎！）"
read -p "是否删除所有数据？(yes/no): " answer

if [ "$answer" = "yes" ]; then
    log_info "删除数据卷..."
    docker-compose down -v
    docker system prune -f
fi

log_info "服务已停止"
