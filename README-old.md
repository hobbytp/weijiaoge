# 微蕉阁 (WeiJiaoGe)

持续收集和展示 Gemini Nano Banana 的使用案例和教程。

## 功能特性

- 🔍 **自动抓取**：定时从 GitHub 和全网收集相关项目、文章和讨论
- 📊 **智能排序**：按星标数、更新时间等综合排序
- 🎯 **精准搜索**：支持按标题、描述、作者、类型筛选
- 🌐 **静态部署**：零成本部署到 GitHub Pages
- ⚡ **实时更新**：每小时自动更新数据

## 本地运行

### 快速开始

**方法一：使用启动脚本（推荐）**

```bash
# Linux/Mac
./start.sh

# Windows
start.bat
```

**方法二：使用Makefile**

```bash
# 查看所有可用命令
make help

# 开发模式（热加载，推荐）
make dev

# 完整流程
make install && make update && make preview

# 或者分步执行
make install    # 安装依赖
make update     # 更新数据
make preview    # 启动服务器
```

**方法三：使用npm命令**

```bash
# 安装依赖
npm install

# 开发模式（热加载，推荐）
npm run dev

# 更新数据
npm run update

# 启动服务器
npm run preview
```

## 🔥 热加载开发

使用 `make dev` 或 `npm run dev` 启动热加载模式：

- ✅ **自动重启**：修改 `server.js`、`scripts/`、`fetchers/` 等文件时自动重启
- ✅ **监听文件**：监听 `.js`、`.mjs`、`.html`、`.json` 文件变化
- ✅ **快速开发**：无需手动重启，提高开发效率
- ✅ **智能延迟**：1秒延迟避免频繁重启

### 手动步骤

1. 克隆项目

```bash
git clone <your-repo-url>
cd weijiaoge
```

2. 配置环境变量

```bash
cp env.example .env
# 编辑.env文件，添加你的API密钥
```

3. 运行数据更新脚本

```bash
node scripts/update.mjs
```

4. 启动本地服务器

```bash
node server.js
```

访问 `http://localhost:5173` 查看效果。

## 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 在仓库 Settings → Pages 中选择 "GitHub Actions" 作为源
3. GitHub Actions 会自动：
   - 每天凌晨2点运行抓取脚本（可以在.github/workflows/fetch.yml中修改）
   - 更新 `public/data.json`
   - 部署到 GitHub Pages

## 数据源配置

### GitHub API（默认）

- 无需配置，使用公开 API
- 如需提高速率限制，在仓库 Settings → Secrets 添加 `GITHUB_TOKEN`

### 全网搜索（可选）

在仓库 Settings → Secrets 添加：

- `SERPAPI_KEY`：SerpAPI 密钥，用于 Google 搜索
- `GOOGLE_CSE_ID`：Google 自定义搜索引擎 ID

## 项目结构

```
├── fetchers/           # 数据抓取器
│   ├── github.mjs     # GitHub 数据抓取
│   └── web.mjs        # 全网搜索抓取
├── scripts/
│   └── update.mjs     # 数据更新脚本
├── public/
│   └── data.json      # 聚合数据文件
├── .github/workflows/
│   └── fetch.yml      # GitHub Actions 工作流
├── index.html         # 主页面
├── styles.css         # 样式文件
├── app.js            # 前端逻辑
└── package.json      # 项目配置
```

## 贡献

欢迎提交 Issue 和 Pull Request 来：

- 添加新的数据源
- 改进搜索关键词
- 优化前端界面
- 修复 bug

## 许可证

MIT License
