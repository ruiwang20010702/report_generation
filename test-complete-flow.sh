#!/bin/bash

# 51Talk 视频分析系统 - 完整流程测试
# 测试前后端集成和真实AI分析功能

echo "================================================"
echo "  51Talk 视频分析系统 - 完整流程测试"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果计数
PASSED=0
FAILED=0

# 测试函数
test_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "测试: $name ... "
    
    response=$(curl -s "$url")
    
    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✓ 通过${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "  响应: $response"
        ((FAILED++))
        return 1
    fi
}

# 1. 测试后端服务器
echo "【1】测试后端服务器"
echo "-------------------"

test_endpoint "服务器根路径" \
    "http://localhost:3001/" \
    "51Talk Video Analysis API"

test_endpoint "健康检查端点" \
    "http://localhost:3001/api/analysis/health" \
    "status"

echo ""

# 2. 测试前端服务器
echo "【2】测试前端服务器"
echo "-------------------"

test_endpoint "前端首页" \
    "http://localhost:8080/" \
    "<!doctype html"

echo ""

# 3. 测试模拟数据分析
echo "【3】测试模拟数据分析"
echo "-------------------"

echo -n "测试: POST /api/analysis/analyze (模拟模式) ... "

mock_request='{
  "studentName": "测试学生",
  "grade": "三年级",
  "level": "Level 5",
  "video1": "https://example.com/video1.mp4",
  "video2": "https://example.com/video2.mp4",
  "useMockData": true
}'

mock_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$mock_request" \
    http://localhost:3001/api/analysis/analyze)

if echo "$mock_response" | grep -q "learningData"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASSED++))
    
    # 详细验证返回数据结构
    echo "  验证数据结构..."
    
    checks=(
        "learningData:学习数据"
        "strengths:优势领域"
        "weaknesses:改进领域"
        "overall:总体评分"
    )
    
    for check in "${checks[@]}"; do
        field="${check%%:*}"
        name="${check##*:}"
        if echo "$mock_response" | grep -q "\"$field\""; then
            echo -e "    ${GREEN}✓${NC} $name"
        else
            echo -e "    ${RED}✗${NC} $name 缺失"
        fi
    done
else
    echo -e "${RED}✗ 失败${NC}"
    echo "  响应: ${mock_response:0:200}..."
    ((FAILED++))
fi

echo ""

# 4. 测试真实AI分析（如果有API Key）
echo "【4】测试真实 AI 分析"
echo "-------------------"

if [ -f .env ]; then
    source .env
fi

if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your_openai_api_key_here" ]; then
    echo -e "${YELLOW}⚠ 跳过真实AI测试（需要手动运行 test-ai-analysis.sh）${NC}"
    echo "  原因: 真实AI测试需要较长时间且会产生费用"
    echo "  运行: ./test-ai-analysis.sh 进行完整测试"
else
    echo -e "${YELLOW}⚠ 跳过真实AI测试（未配置 API Key）${NC}"
    echo "  提示: 在 .env 中设置 OPENAI_API_KEY 以启用真实AI分析"
fi

echo ""

# 5. 测试API错误处理
echo "【5】测试错误处理"
echo "-------------------"

echo -n "测试: 缺少必填字段 ... "

invalid_request='{
  "studentName": "测试学生"
}'

error_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$invalid_request" \
    http://localhost:3001/api/analysis/analyze)

if echo "$error_response" | grep -q "error"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败${NC}"
    ((FAILED++))
fi

echo -n "测试: 真实AI缺少API Key ... "

no_key_request='{
  "studentName": "测试学生",
  "video1": "https://example.com/video1.mp4",
  "video2": "https://example.com/video2.mp4",
  "useMockData": false
}'

no_key_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$no_key_request" \
    http://localhost:3001/api/analysis/analyze)

if echo "$no_key_response" | grep -q "API Key"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ 失败${NC}"
    ((FAILED++))
fi

echo ""

# 测试总结
echo "================================================"
echo "                  测试总结"
echo "================================================"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo "总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！系统运行正常${NC}"
    echo ""
    echo "下一步："
    echo "  1. 打开浏览器访问: http://localhost:8080"
    echo "  2. 使用\"快速测试\"按钮体验模拟数据分析"
    echo "  3. 运行 ./test-ai-analysis.sh 测试真实AI分析"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 有测试失败，请检查系统配置${NC}"
    echo ""
    echo "故障排除："
    echo "  1. 确保前后端服务都在运行: npm run dev:all"
    echo "  2. 检查端口 3001 和 8080 是否被占用"
    echo "  3. 查看终端日志获取详细错误信息"
    echo ""
    exit 1
fi

