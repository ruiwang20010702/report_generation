#!/bin/bash

# 快速测试脚本 - 测试分析功能

echo "========================================"
echo "  快速测试 - 51Talk 视频分析系统"
echo "========================================"
echo ""

# 测试后端服务器
echo "【1】测试后端服务器..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✓ 后端服务器响应正常"
else
    echo "✗ 后端服务器未响应"
    exit 1
fi
echo ""

# 测试模拟分析
echo "【2】测试模拟分析（不使用真实AI）..."
echo "发送测试请求..."

response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studentName": "测试学生",
    "grade": "小学三年级",
    "level": "Level 3",
    "unit": "Unit 5",
    "video1": "https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4",
    "video2": "https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_2mb.mp4",
    "useMockData": true
  }' 2>&1)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo ""
echo "HTTP 状态码: $http_code"

if [ "$http_code" = "200" ]; then
    echo "✓ 模拟分析成功！"
    echo ""
    echo "响应数据（前200字符）："
    echo "$body" | head -c 200
    echo "..."
elif [ "$http_code" = "000" ]; then
    echo "✗ 请求失败 - 无法连接到服务器"
    echo ""
    echo "错误信息："
    echo "$body"
else
    echo "✗ 分析失败"
    echo ""
    echo "错误响应："
    echo "$body" | head -c 500
fi

echo ""
echo ""
echo "========================================"
echo "测试完成"
echo "========================================"
echo ""
echo "如果模拟分析失败，请："
echo "1. 检查后端服务器是否运行: npm run dev:server"
echo "2. 查看详细日志以了解具体错误"

