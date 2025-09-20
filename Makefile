# 微蕉阁 (WeiJiaoGe) - Gemini 2.5 Flash Image Preview 资源收集
# 统一管理命令

.PHONY: help install update serve preview clean push pull

# 默认目标
help:
	@echo "🍌 微蕉阁 (WeiJiaoGe) - 项目管理命令"
	@echo ""
	@echo "可用命令:"
	@echo "  make install    - 安装依赖"
	@echo "  make update     - 更新数据（抓取最新资源）"
	@echo "  make serve      - 启动本地服务器"
	@echo "  make preview    - 启动服务器并显示访问地址"
	@echo "  make stop       - 停止服务器"
	@echo "  make restart    - 重启服务器（更新数据后）"
	@echo "  make clean      - 清理临时文件"
	@echo "  make push       - 推送代码到GitHub"
	@echo "  make pull       - 从GitHub拉取最新代码"
	@echo ""
	@echo "快速开始:"
	@echo "  make install && make update && make preview"

# 安装依赖
install:
	@echo "📦 安装依赖..."
	npm install

# 更新数据
update:
	@echo "🔄 更新数据中..."
	node scripts/update.mjs
	@echo "✅ 数据更新完成！"

# 启动服务器
serve:
	@echo "🚀 启动服务器..."
	node server.js

# 预览模式（启动服务器并显示信息）
preview:
	@echo "🚀 微蕉阁服务器启动中..."
	@echo "📱 访问地址: http://localhost:5173"
	@echo "⏹️  按 Ctrl+C 停止服务器"
	@echo ""
	node server.js

# 停止服务器
stop:
	@echo "⏹️  停止服务器..."
	@taskkill //F //IM node.exe 2>nul || echo "没有运行的Node.js进程"
	@echo "✅ 服务器已停止"

# 重启服务器（更新数据后使用）
restart: stop update
	@echo "🔄 重启服务器..."
	@echo "📱 访问地址: http://localhost:5173"
	@echo "⏹️  按 Ctrl+C 停止服务器"
	@echo ""
	node server.js

# 清理临时文件
clean:
	@echo "🧹 清理临时文件..."
	rm -f test-env.mjs
	@echo "✅ 清理完成！"

# 推送到GitHub
push:
	@echo "📤 推送到GitHub..."
	git add .
	git commit -m "chore: 自动更新数据" || true
	git push
	@echo "✅ 推送完成！"

# 从GitHub拉取
pull:
	@echo "📥 从GitHub拉取..."
	git pull
	@echo "✅ 拉取完成！"

# 完整部署流程
deploy: update push
	@echo "🚀 部署完成！"
