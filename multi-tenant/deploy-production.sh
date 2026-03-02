#!/bin/bash
set -e

##############################################################################
# OpenClaw 多租户平台 - 生产环境快速部署脚本
#
# 使用方法:
#   chmod +x deploy-production.sh
#   ./deploy-production.sh
#
# 注意:
#   - 请先配置 .env 文件
#   - 请先配置 SSL 证书
#   - 请先在 Liuma 注册 OAuth 应用
##############################################################################

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     OpenClaw 多租户平台 - 生产环境部署脚本                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_command() {
    if ! command -v $1 &> /dev/null
    then
        echo -e "${RED}✗ $1 未安装${NC}"
        echo "请先安装: $2"
        exit 1
    else
        echo -e "${GREEN}✓ $1 已安装${NC}"
    fi
}

check_env_file() {
    if [ ! -f .env ]; then
        echo -e "${RED}✗ .env 文件不存在${NC}"
        echo "请先创建 .env 文件并配置环境变量"
        echo "可以参考: cp .env.example .env"
        exit 1
    else
        echo -e "${GREEN}✓ .env 文件已配置${NC}"
    fi
}

check_ssl_cert() {
    if [ ! -f data/nginx/ssl/cert.pem ] || [ ! -f data/nginx/ssl/key.pem ]; then
        echo -e "${YELLOW}⚠ SSL 证书不存在${NC}"
        echo "请先配置 SSL 证书:"
        echo "  1. 使用 Let's Encrypt: certbot certonly --standalone -d your-domain.com"
        echo "  2. 或复制已有证书到: data/nginx/ssl/"
        read -p "是否继续部署? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✓ SSL 证书已配置${NC}"
    fi
}

# 主流程
main() {
    echo -e "${NC}📋 前置检查${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 检查必要命令
    check_command "docker" "curl -fsSL https://get.docker.com | sudo sh"
    check_command "docker-compose" "sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)\" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose"

    # 检查配置文件
    check_env_file

    # 检查 SSL
    check_ssl_cert

    echo ""
    echo -e "${NC}📦 创建数据目录${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    mkdir -p data/{postgres,redis,tenant,nginx/ssl}
    mkdir -p logs/{tenant-manager,nginx}
    echo -e "${GREEN}✓ 数据目录已创建${NC}"

    echo ""
    echo -e "${NC}🔧 更新 Nginx 配置${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 从 .env 读取域名
    source .env
    DOMAIN=${DOMAIN:-your-domain.com}

    # 更新 nginx 配置中的域名
    sed -i "s/your-domain.com/${DOMAIN}/g" nginx/nginx.conf

    echo -e "${GREEN}✓ Nginx 配置已更新 (域名: ${DOMAIN})${NC}"

    echo ""
    echo -e "${NC}🏗️  构建 Docker 镜像${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo "构建 tenant-manager 镜像..."
    docker-compose build tenant-manager

    echo "构建 frontend 镜像..."
    docker-compose build frontend

    echo -e "${GREEN}✓ 镜像构建完成${NC}"

    echo ""
    echo -e "${NC}🚀 启动服务${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 停止现有服务（如果有）
    docker-compose down

    # 启动服务
    docker-compose up -d

    echo -e "${GREEN}✓ 服务已启动${NC}"

    echo ""
    echo -e "${NC}⏳ 等待服务就绪...${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 等待服务启动
    sleep 30

    # 健康检查
    echo ""
    echo -e "${NC}🔍 健康检查${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 检查容器状态
    RUNNING=$(docker-compose ps | grep "Up" | wc -l)
    if [ $RUNNING -ge 4 ]; then
        echo -e "${GREEN}✓ 容器运行正常 (${RUNNING}/4)${NC}"
    else
        echo -e "${RED}✗ 部分容器未运行${NC}"
        docker-compose ps
    fi

    # 测试后端 API
    if curl -sf http://localhost:3000/api/health > /dev/null; then
        echo -e "${GREEN}✓ 后端 API 正常${NC}"
    else
        echo -e "${RED}✗ 后端 API 异常${NC}"
    fi

    # 测试前端
    if curl -sf http://localhost:3002 > /dev/null; then
        echo -e "${GREEN}✓ 前端服务正常${NC}"
    else
        echo -e "${YELLOW}⚠ 前端服务可能还在启动中...${NC}"
    fi

    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║              🎉 部署完成！                                       ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${NC}📍 访问地址:${NC}"
    echo "   • PC前端: https://${DOMAIN}"
    echo "   • API: https://api.${DOMAIN}"
    echo "   • 移动端H5: https://h5.${DOMAIN}"
    echo ""
    echo -e "${NC}📝 下一步操作:${NC}"
    echo "   1. 在 Liuma 注册 OAuth 应用 (如果还没有)"
    echo "      访问: https://auth.liuma.app"
    echo "   2. 配置 OAuth 回调 URL"
    echo "      PC端: https://${DOMAIN}/auth/callback"
    echo "      移动端: https://h5.${DOMAIN}/auth/callback"
    echo "   3. 测试登录流程"
    echo "   4. 配置自动备份"
    echo "   5. 配置监控告警"
    echo ""
    echo -e "${NC}📊 查看日志:${NC}"
    echo "   docker-compose logs -f tenant-manager"
    echo "   docker-compose logs -f frontend"
    echo "   docker-compose logs -f nginx"
    echo ""
    echo -e "${NC}🔧 管理命令:${NC}"
    echo "   docker-compose ps          # 查看服务状态"
    echo "   docker-compose restart     # 重启所有服务"
    echo "   docker-compose logs -f       # 查看所有日志"
    echo "   docker-compose down          # 停止所有服务"
    echo ""
}

# 运行主流程
main
