#!/bin/bash

# 微蕉阁启动脚本
echo "🍌 微蕉阁 (WeiJiaoGe) 启动脚本"
echo "================================"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到.env文件，请复制env.example并配置环境变量"
    echo "   cp env.example .env"
    echo "   然后编辑.env文件添加你的API密钥"
fi

# 更新数据
echo "🔄 更新数据..."
node scripts/update.mjs

# 启动服务器
echo ""
echo "🚀 启动服务器..."
echo "📱 访问地址: http://localhost:5173"
echo "⏹️  按 Ctrl+C 停止服务器"
echo ""

node server.js
