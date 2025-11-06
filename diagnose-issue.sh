#!/bin/bash

# 诊断脚本 - 帮助排查视频分析超时问题

echo "================================================"
echo "  51Talk 视频分析系统 - 问题诊断工具"
echo "================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 检查服务器状态
echo "【1】检查服务器状态"
echo "-------------------"

if curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 后端服务器正在运行 (端口 3001)"
else
    echo -e "${RED}✗${NC} 后端服务器未运行"
    echo "   请运行: npm run dev:server"
fi

if curl -s http://localhost:8080/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 前端服务器正在运行 (端口 8080)"
else
    echo -e "${RED}✗${NC} 前端服务器未运行"
    echo "   请运行: npm run dev"
fi

echo ""

# 2. 检查环境变量
echo "【2】检查环境配置"
echo "-------------------"

if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env 文件存在"
    
    if grep -q "OPENAI_API_KEY=" .env; then
        if grep "OPENAI_API_KEY=sk-" .env > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} OPENAI_API_KEY 已配置"
        else
            echo -e "${YELLOW}⚠${NC} OPENAI_API_KEY 为空（将使用模拟模式）"
        fi
    else
        echo -e "${YELLOW}⚠${NC} OPENAI_API_KEY 未设置"
    fi
    
    if grep -q "USE_MOCK_ANALYSIS=true" .env; then
        echo -e "${BLUE}ℹ${NC} 默认使用模拟分析模式"
    else
        echo -e "${BLUE}ℹ${NC} 默认使用真实AI分析模式（如果有API Key）"
    fi
else
    echo -e "${RED}✗${NC} .env 文件不存在"
    echo "   请运行: cp .env.example .env"
fi

echo ""

# 3. 测试网络连接
echo "【3】测试网络连接"
echo "-------------------"

# 测试示例视频URL
TEST_URL="https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4"

echo "测试下载示例视频..."
if curl -s --head --max-time 10 "$TEST_URL" | grep "200 OK" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 可以访问外部视频 URL"
else
    echo -e "${RED}✗${NC} 无法访问外部视频 URL"
    echo "   可能原因: 1) 网络连接问题 2) 防火墙阻止"
fi

# 测试 OpenAI API
if [ -n "$OPENAI_API_KEY" ]; then
    echo "测试 OpenAI API 连接..."
    if curl -s --max-time 10 https://api.openai.com/v1/models > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} 可以访问 OpenAI API"
    else
        echo -e "${YELLOW}⚠${NC} 无法直接访问 OpenAI API（可能需要代理）"
    fi
else
    echo -e "${BLUE}ℹ${NC} 跳过 OpenAI API 测试（未设置 API Key）"
fi

echo ""

# 4. 检查磁盘空间
echo "【4】检查系统资源"
echo "-------------------"

# 检查 /tmp 目录空间
TMP_SPACE=$(df /tmp | awk 'NR==2 {print $4}')
if [ $TMP_SPACE -gt 1000000 ]; then
    echo -e "${GREEN}✓${NC} /tmp 目录有足够空间"
else
    echo -e "${YELLOW}⚠${NC} /tmp 目录空间不足"
    echo "   可用空间: $TMP_SPACE KB"
fi

echo ""

# 5. 常见问题建议
echo "【5】常见问题和解决方案"
echo "-------------------"
echo ""
echo "${BLUE}问题 1: 服务器无响应（3分钟后超时）${NC}"
echo "可能原因："
echo "  • 视频文件太大（>50MB）"
echo "  • 视频 URL 无效或无法访问"
echo "  • 网络速度慢"
echo "  • OpenAI API 响应慢"
echo ""
echo "解决方案："
echo "  1. 使用较短的视频（3-5 分钟，<20MB）"
echo "  2. 确保视频 URL 可以直接访问"
echo "  3. 检查网络连接速度"
echo "  4. 先使用模拟数据测试（关闭'使用真实AI'开关）"
echo "  5. 查看服务器日志：npm run dev:server"
echo ""
echo "${BLUE}问题 2: OpenAI API 错误${NC}"
echo "可能原因："
echo "  • API Key 无效或过期"
echo "  • API 配额用完"
echo "  • 网络无法访问 OpenAI（国内需要代理）"
echo ""
echo "解决方案："
echo "  1. 检查 API Key 是否正确"
echo "  2. 访问 https://platform.openai.com/usage 查看配额"
echo "  3. 配置代理：export HTTPS_PROXY=http://your-proxy:port"
echo ""
echo "${BLUE}问题 3: 视频下载失败${NC}"
echo "可能原因："
echo "  • 视频 URL 需要认证"
echo "  • 视频格式不支持"
echo "  • URL 返回 404"
echo ""
echo "解决方案："
echo "  1. 使用公开可访问的视频 URL"
echo "  2. 支持格式: MP4, MP3, WAV, M4A"
echo "  3. 测试 URL: curl -I <video_url>"
echo ""

# 6. 查看最近日志
echo "【6】查看服务器日志建议"
echo "-------------------"
echo "如果问题仍然存在，请："
echo "  1. 在一个终端运行: npm run dev:server"
echo "  2. 在另一个终端运行: npm run dev"
echo "  3. 提交分析请求"
echo "  4. 查看 dev:server 终端的详细日志"
echo ""
echo "日志中会显示："
echo "  • 📝 收到的请求信息"
echo "  • ⬇️ 视频下载进度"
echo "  • 🎙️ Whisper 转录状态"
echo "  • 🤖 GPT-4 分析进度"
echo "  • ❌ 任何错误信息"
echo ""

echo "================================================"
echo "诊断完成"
echo "================================================"

