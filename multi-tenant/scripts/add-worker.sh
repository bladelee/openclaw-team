#!/bin/bash
# OpenClaw Worker - 添加到 Portainer 集群的脚本

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 检查参数
if [ $# -lt 2 ]; then
    echo "用法: $0 <worker-name> <portainer-url> [portainer-agent-port]"
    echo ""
    echo "示例:"
    echo "  $0 worker-01 http://192.168.1.10:9000"
    echo "  $0 worker-01 http://192.168.1.10:9000 9001"
    exit 1
fi

WORKER_NAME=$1
PORTAINER_URL=$2
AGENT_PORT=${3:-9001}

log_info "添加 Worker: $WORKER_NAME"
log_info "Portainer URL: $PORTAINER_URL"
log_info "Agent 端口: $AGENT_PORT"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装"
    exit 1
fi

# 拉取 Portainer Agent 镜像
log_info "拉取 Portainer Agent 镜像..."
docker pull portainer/agent:latest

# 启动 Agent
log_info "启动 Portainer Agent..."
docker run -d \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /var/lib/docker/volumes:/var/lib/docker/volumes \
    -v /:/host \
    --name portainer-agent \
    --restart=unless-stopped \
    -p ${AGENT_PORT}:9001 \
    portainer/agent:latest

# 等待 Agent 启动
log_info "等待 Agent 启动..."
sleep 5

# 显示状态
docker ps | grep portainer-agent

log_info "Worker 已启动！"
log_warn "接下来在 Portainer UI 中添加环境:"
log_warn "  1. 登录 Portainer: $PORTAINER_URL"
log_warn "  2. Environments → Add environment"
log_warn "  3. 选择 'Docker Standalone'"
log_warn "  4. Environment URL: tcp://$(hostname -I | awk '{print $1}'):$AGENT_PORT"
log_warn "  5. Name: $WORKER_NAME"
