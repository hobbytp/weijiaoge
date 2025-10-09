# WeiJiaoGe - Gemini 2.5 Flash Image Preview Resource Collection
# Unified Management Commands

.PHONY: help install update serve preview clean push pull

# Default target
help:
	@echo "🍌 WeiJiaoGe - Project Management Commands"
	@echo ""
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make update     - Update data (fetch latest resources)"
	@echo "  make serve      - Start local server"
	@echo "  make dev        - Start hot-reload development server"
	@echo "  make preview    - Start server and show access URL"
	@echo "  make stop       - Stop server"
	@echo "  make restart    - Restart server (after updating data)"
	@echo "  make clean      - Clean temporary files"
	@echo "  make clean-all  - Clean all data (including cache and generated data)"
	@echo "  make test       - Test enhanced system (requires network)"
	@echo "  make test-data  - Test existing data extraction"
	@echo "  make test-basic - Test basic functionality"
	@echo "  make push       - Push code to GitHub"
	@echo "  make pull       - Pull latest code from GitHub"
	@echo ""
	@echo "Quick start:"
	@echo "  make install && make update && make preview"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Installation completed!"

# Update data
update:
	@echo "🔄 Updating data..."
	npm run update
	@echo "✅ Data update completed!"

# Start server
serve:
	@echo "🚀 Starting server..."
	npm run serve

# Development server with hot reload
dev:
	@echo "🔥 Starting hot-reload development server..."
	@echo "📁 Watching files: server.js, scripts/, fetchers/, public/, *.html, *.js"
	@echo "🔄 Server will restart automatically when files change"
	npm run dev

# Start server and show access URL
preview:
	@echo "🚀 WeiJiaoGe server starting..."
	@echo "📱 Access URL: http://localhost:5173"
	@echo "⏹️  Press Ctrl+C to stop server"
	npm run preview

# Stop server
stop:
	@echo "⏹️  Stopping server..."
	@cmd //c "for /f \"tokens=5\" %%i in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%i >nul 2>&1"
	@echo "✅ Server stopped"

# Restart server
restart: update
	@echo "🔄 Restarting server..."
	@echo "📱 Access URL: http://localhost:5173"
	@echo "⏹️  Press Ctrl+C to stop server"
	npm run serve

# Test enhanced system
test:
	@echo "🧪 Testing enhanced system..."
	npm run test:stage3
	@echo "✅ Test completed!"

# Test existing data extraction
test-data:
	@echo "🧪 Testing existing data extraction..."
	npm run test:github
	@echo "✅ Test completed!"

# Test basic functionality
test-basic:
	@echo "🧪 Testing basic functionality..."
	npm run test:basic
	@echo "✅ Test completed!"

# Clean temporary files
clean:
	@node scripts/clean.mjs

# Clean all data (including cache and generated data)
clean-all:
	@node scripts/clean-all.mjs

# Push to GitHub
push:
	@echo "📤 Pushing to GitHub..."
	git add .
	git commit -m "Update: $(shell date)"
	git push origin master
	@echo "✅ Push completed!"

# Pull from GitHub
pull:
	@echo "📥 Pulling from GitHub..."
	git pull origin master
	@echo "✅ Pull completed!"

# Deploy
deploy: push
	@echo "🚀 Deployment completed!"