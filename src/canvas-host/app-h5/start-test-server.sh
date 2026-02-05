#!/bin/bash
# OpenClaw H5 App 测试服务器启动脚本

set -e

echo "========================================="
echo "OpenClaw H5 App 测试服务器"
echo "========================================="
echo ""

# 检查构建
if [ ! -d "dist/app-h5" ]; then
    echo "❌ 构建目录不存在"
    echo "请先运行: pnpm app:h5:build"
    exit 1
fi

echo "✅ 构建文件检查通过"
echo ""

# 准备部署目录
DEPLOY_DIR="/tmp/openclaw-h5-deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r dist/app-h5/* "$DEPLOY_DIR/"

echo "✅ 部署文件已准备: $DEPLOY_DIR"
echo ""

# 获取本地IP
LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

# 检查端口
PORT=${1:-8080}
if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 $PORT 已被占用"
        echo ""
        echo "使用其他端口:"
        echo "  $0 [端口号]"
        echo ""
        echo "或停止占用端口的进程:"
        echo "  lsof -ti:$PORT | xargs kill -9"
        exit 1
    fi
fi

echo "========================================="
echo "🚀 启动测试服务器"
echo "========================================="
echo ""
echo "访问地址:"
echo "  🏠 本地:   http://localhost:$PORT"
echo "  🌐 网络:   http://$LOCAL_IP:$PORT"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""
echo "========================================="
echo ""
echo "💡 提示:"
echo "  - 无需 Gateway 可测试 UI 功能"
echo "  - 需要 Gateway 可测试 WebSocket 功能"
echo "  - 查看 TESTING.md 了解完整测试流程"
echo ""
echo "========================================="
echo ""

cd "$DEPLOY_DIR"

# 启动服务器
if command -v python3 >/dev/null 2>&1; then
    python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
    python -m SimpleHTTPServer $PORT
else
    echo "❌ 需要 Python 3 来运行 HTTP 服务器"
    echo ""
    echo "替代方案:"
    echo "  1. 安装 Python 3"
    echo "  2. 使用: npx serve dist/app-h5 -l $PORT"
    echo "  3. 使用: pnpm app:h5:dev"
    exit 1
fi
