#!/bin/bash
# OpenClaw 多租户系统 - 启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi

    log_info "依赖检查通过"
}

# 生成密钥
generate_secrets() {
    log_info "生成密钥..."

    if [ ! -f .env ]; then
        cp .env.example .env
    fi

    # 生成 JWT 密钥
    if ! grep -q "JWT_SECRET=change-this" .env 2>/dev/null; then
        JWT_SECRET=$(openssl rand -hex 32)
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        log_info "JWT 密钥已生成"
    fi

    # 生成数据库密码
    if ! grep -q "POSTGRES_PASSWORD=openclaw123" .env 2>/dev/null; then
        POSTGRES_PASSWORD=$(openssl rand -hex 16)
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
        log_info "数据库密码已生成"
    fi
}

# 创建必要的目录
create_directories() {
    log_info "创建目录..."

    mkdir -p logs
    mkdir -p nginx/ssl

    # 生成自签名证书（如果不存在）
    if [ ! -f nginx/ssl/cert.pem ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=*.openclaw.app"
        log_info "自签名证书已生成"
    fi
}

# 构建镜像
build_images() {
    log_info "构建镜像..."
    docker-compose build
}

# 启动服务
start_services() {
    log_info "启动服务..."
    docker-compose up -d

    log_info "等待服务就绪..."
    sleep 10

    # 检查服务状态
    if docker-compose ps | grep -q "Exit"; then
        log_error "部分服务启动失败"
        docker-compose logs
        exit 1
    fi

    log_info "所有服务已启动"
}

# 显示服务状态
show_status() {
    log_info "服务状态:"
    docker-compose ps

    echo ""
    log_info "访问地址:"
    echo "  - Portainer:     http://localhost:9443"
    echo "  - 租户管理 API:  http://localhost:3000/api"
    echo "  - 健康检查:      http://localhost:3000/api/health"
    echo "  - Prometheus:    http://localhost:9090/metrics"
}

# 主函数
main() {
    echo "========================================"
    echo "  OpenClaw 多租户管理系统启动脚本"
    echo "========================================"
    echo ""

    check_dependencies
    generate_secrets
    create_directories
    build_images
    start_services
    show_status

    echo ""
    log_info "启动完成！"
    log_info "查看日志: docker-compose logs -f"
    log_info "停止服务: docker-compose down"
}

# 运行主函数
main "$@"
