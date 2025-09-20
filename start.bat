@echo off
chcp 65001 >nul

echo 🍌 微蕉阁 (WeiJiaoGe) 启动脚本
echo ================================

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查依赖是否安装
if not exist "node_modules" (
    echo 📦 安装依赖...
    npm install
)

REM 检查.env文件
if not exist ".env" (
    echo ⚠️  警告: 未找到.env文件，请复制env.example并配置环境变量
    echo    copy env.example .env
    echo    然后编辑.env文件添加你的API密钥
    echo.
)

REM 更新数据
echo 🔄 更新数据...
node scripts/update.mjs

REM 启动服务器
echo.
echo 🚀 启动服务器...
echo 📱 访问地址: http://localhost:5173
echo ⏹️  按 Ctrl+C 停止服务器
echo.

node server.js

pause
