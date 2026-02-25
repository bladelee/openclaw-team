#!/bin/bash
# OpenClaw 多租户系统 - 测试脚本

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助
show_help() {
    cat << EOF
OpenClaw 多租户系统 - 测试脚本

用法: $0 [命令] [选项]

命令:
  unit          运行单元测试
  integration   运行集成测试
  e2e           运行端到端测试
  perf          运行性能测试
  all           运行所有测试
  coverage      生成测试覆盖率报告

选项:
  --watch        监听模式（适用于单元测试）
  --ui           使用 UI 模式
  --update       更新快照（适用于 E2E 测试）

示例:
  $0 unit
  $0 unit --watch
  $0 all
  $0 coverage
EOF
}

# 检查服务是否运行
check_services() {
    log_info "检查服务状态..."

    if ! docker-compose ps | grep -q "tenant-manager.*Up"; then
        log_error "租户管理服务未运行"
        log_info "启动服务: ./scripts/start.sh"
        exit 1
    fi

    log_info "服务检查通过"
}

# 运行单元测试
run_unit_tests() {
    log_info "运行单元测试..."

    cd tenant-manager
    pnpm install

    if [ "$1" = "--watch" ]; then
        pnpm test --watch
    else
        pnpm test
    fi
}

# 运行集成测试
run_integration_tests() {
    log_info "运行集成测试..."

    check_services

    cd tenant-manager
    pnpm install

    # 集成测试需要服务运行
    DATABASE_URL="postgresql://openclaw:openclaw123@localhost:5432/openclaw" \
    PORTAINER_URL="http://localhost:9000" \
    PORTAINER_API_KEY="$PORTAINER_API_KEY" \
    pnpm test tests/integration/
}

# 运行 E2E 测试
run_e2e_tests() {
    log_info "运行端到端测试..."

    check_services

    # 安装 Playwright 浏览器
    npx playwright install --with-deps

    cd multi-tenant
    npx playwright test "$@"
}

# 运行性能测试
run_perf_tests() {
    log_info "运行性能测试..."

    check_services

    # 检查 k6 是否安装
    if ! command -v k6 &> /dev/null; then
        log_warn "k6 未安装，跳过性能测试"
        log_info "安装 k6: https://k6.io/"
        return
    fi

    cd multi-tenant
    k6 run tests/performance/tenant-creation.k6.js
}

# 生成覆盖率报告
run_coverage() {
    log_info "生成测试覆盖率报告..."

    cd tenant-manager
    pnpm test:coverage

    log_info "覆盖率报告: coverage/index.html"
}

# 运行所有测试
run_all_tests() {
    log_info "运行所有测试..."

    run_unit_tests
    run_integration_tests
    # E2E 测试可能需要特殊环境，暂时跳过
    # run_e2e_tests
}

# 主函数
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    case "$1" in
        unit)
            shift
            run_unit_tests "$@"
            ;;
        integration)
            shift
            run_integration_tests "$@"
            ;;
        e2e)
            shift
            run_e2e_tests "$@"
            ;;
        perf|performance)
            run_perf_tests
            ;;
        coverage)
            run_coverage
            ;;
        all)
            run_all_tests
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
