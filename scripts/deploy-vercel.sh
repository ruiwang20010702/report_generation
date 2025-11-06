#!/bin/bash

# Vercel 快速部署脚本
# 使用方法: ./scripts/deploy-vercel.sh [production|preview]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Vercel CLI
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI 未安装"
        print_info "正在安装 Vercel CLI..."
        npm install -g vercel
    else
        print_info "✓ Vercel CLI 已安装"
    fi
}

# 检查环境变量
check_env_vars() {
    print_info "检查环境变量..."
    
    REQUIRED_VARS=("OPENAI_API_KEY" "ASSEMBLYAI_API_KEY")
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        print_warn "以下环境变量未设置："
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        print_warn "部署后请在 Vercel Dashboard 中设置这些环境变量"
    else
        print_info "✓ 所有必需的环境变量已设置"
    fi
}

# 运行测试
run_tests() {
    print_info "运行构建测试..."
    
    # 检查是否有 TypeScript 错误
    if npm run lint 2>&1 | grep -q "error"; then
        print_error "代码检查失败，请修复错误后再部署"
        exit 1
    fi
    
    # 尝试构建
    print_info "测试构建..."
    if ! npm run build; then
        print_error "构建失败，请修复错误后再部署"
        exit 1
    fi
    
    print_info "✓ 构建测试通过"
}

# 部署到 Vercel
deploy_to_vercel() {
    local env=$1
    
    print_info "开始部署到 Vercel ($env)..."
    
    if [ "$env" == "production" ]; then
        vercel --prod
    else
        vercel
    fi
    
    print_info "✓ 部署完成"
}

# 设置环境变量
setup_env_vars() {
    print_info "设置 Vercel 环境变量..."
    
    if [ -f .env ]; then
        print_info "从 .env 文件读取环境变量..."
        
        # 读取 .env 文件并设置到 Vercel
        while IFS='=' read -r key value; do
            # 跳过注释和空行
            [[ $key =~ ^#.*$ ]] && continue
            [[ -z $key ]] && continue
            
            # 移除可能的引号
            value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            
            print_info "设置 $key..."
            echo "$value" | vercel env add "$key" production --force || true
        done < .env
        
        print_info "✓ 环境变量设置完成"
    else
        print_warn ".env 文件不存在，请手动在 Vercel Dashboard 设置环境变量"
    fi
}

# 显示部署信息
show_deployment_info() {
    print_info "================================"
    print_info "部署完成！"
    print_info "================================"
    echo ""
    print_info "下一步："
    echo "  1. 访问 Vercel Dashboard 查看部署状态"
    echo "  2. 确认所有环境变量已正确设置"
    echo "  3. 测试 API 健康检查: https://your-app.vercel.app/api/health"
    echo "  4. 测试前端页面: https://your-app.vercel.app"
    echo ""
    print_info "有用的命令："
    echo "  - 查看日志: vercel logs"
    echo "  - 查看域名: vercel domains"
    echo "  - 查看环境变量: vercel env ls"
    echo ""
}

# 主函数
main() {
    local deployment_type=${1:-preview}
    
    echo "================================"
    echo "🚀 Vercel 部署脚本"
    echo "================================"
    echo ""
    
    # 步骤 1: 检查 CLI
    check_vercel_cli
    echo ""
    
    # 步骤 2: 检查环境变量
    check_env_vars
    echo ""
    
    # 步骤 3: 运行测试
    print_info "是否运行构建测试? (y/n)"
    read -r run_test
    if [ "$run_test" == "y" ]; then
        run_tests
        echo ""
    fi
    
    # 步骤 4: 确认部署
    print_warn "即将部署到 $deployment_type 环境"
    print_warn "继续? (y/n)"
    read -r confirm
    if [ "$confirm" != "y" ]; then
        print_info "部署已取消"
        exit 0
    fi
    echo ""
    
    # 步骤 5: 部署
    deploy_to_vercel "$deployment_type"
    echo ""
    
    # 步骤 6: 设置环境变量（仅首次部署）
    print_info "是否需要设置环境变量? (y/n)"
    read -r setup_env
    if [ "$setup_env" == "y" ]; then
        setup_env_vars
        echo ""
    fi
    
    # 步骤 7: 显示信息
    show_deployment_info
}

# 运行主函数
main "$@"

