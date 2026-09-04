# 微蕉阁 (WeiJiaoGe)

<p align="center">
  <a href="https://hobbytp.github.io/weijiaoge/">
    <img src="https://img.shields.io/badge/🌐_在线预览-Live_Demo-4285F4?style=for-the-badge" alt="Live Demo" />
  </a>
  <a href="https://github.com/hobbytp/weijiaoge/actions/workflows/fetch.yml">
    <img src="https://github.com/hobbytp/weijiaoge/actions/workflows/fetch.yml/badge.svg" alt="Fetch and Deploy" />
  </a>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhobbytp%2Fweijiaoge">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/hobbytp/weijiaoge">
    <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" />
  </a>
</p>

> 持续收集与展示 Gemini Flash Image Preview（Nano Banana）的资源与使用案例，并提供自动化的 Prompt/效果/图片提取、筛选与展示。
>
> 🔗 **在线访问地址**：[https://hobbytp.github.io/weijiaoge/](https://hobbytp.github.io/weijiaoge/)

## 一键部署与托管

### 方案 1：GitHub Pages 原生自动部署（推荐，支持定时自动更新）
本仓库已配置 GitHub Actions 自动更新与发布工作流：
1. **Fork 本仓库** 到你的 GitHub 账号。
2. 进入仓库 **Settings** -> **Pages**，在 **Build and deployment** 下将 **Source** 设置为 **GitHub Actions**。
3. （可选）配置 API 密钥以启用每日自动抓取与大模型案例提取，详细步骤参见 [GitHub Secrets 配置说明](GITHUB_SECRETS_SETUP.md)。
4. 工作流将在每天定时运行，或在 Actions 页面手动点击 **Run workflow** 触发，完成后将自动发布到你的专属 GitHub Pages：`https://<你的用户名>.github.io/weijiaoge/`。

### 方案 2：Vercel 一键部署（静态网页极速托管）
点击下方按钮，一键克隆并托管到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhobbytp%2Fweijiaoge)

### 方案 3：Netlify 一键部署
点击下方按钮，一键克隆并托管到 Netlify：

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/hobbytp/weijiaoge)

## 项目概述
- 资源列表页：聚合 GitHub 仓库与文章，支持搜索与排序（见 [app.js](app.js)）。
- 使用案例页：按来源与分类展示具体 Prompt、效果与图片（见 [cases.js](cases.js)、[cases.html](cases.html)）。
- 数据来源：
  - GitHub 特定仓库的 README 与元信息（见 [github.mjs](fetchers/github.mjs)）。
  - 重要文章与网页（见 [article-extractor.mjs](fetchers/article-extractor.mjs)）。
- 提取与分类：
  - 混合提取器（传统 + LangExtract + 增强）：[hybrid-extractor.mjs](fetchers/hybrid-extractor.mjs)。
  - LangExtract 集成（严格 Prompt 识别与截断、效果/图片提取）：[langextract-extractor.mjs](fetchers/langextract-extractor.mjs)。
  - 针对 ZHO 仓库的章节解析与全局图片关联增强：见 [case-extractor.mjs](fetchers/case-extractor.mjs)。

## 功能特性
- 自动抓取：定期更新 `public/data.json` 与 `public/cases.json`。
- 智能提取：从 README/文章中识别 Prompt、效果与图片，并进行去重与质量控制。
- ZHO README 适配：章节切分、Prompt 严格识别、图片全局回填，提高“无图案例”的命中率。
- 前端展示：
  - 卡片去重（标题 + 来源路径 + 首个 Prompt 片段）。
  - Prompt 展开/收起、图片网格、效果简介。
  - 筛选：按分类/来源路径/标题排序与过滤。

## 环境要求
- Node.js >= 18
- Windows 11 + Git Bash 友好（项目规则建议使用 Makefile 管理日常操作）

## 安装与运行
### 使用 Makefile（推荐）
- 查看命令：`make help`
- 开发热加载：`make dev`
- 完整流程：`make install && make update && make preview`

### 使用 npm 脚本
- 安装依赖：`npm install`
- 开发热加载（nodemon）：`npm run dev`
- 更新数据（抓取 + 提取）：`npm run update`
- 本地预览（静态服务）：`npm run preview`

## 数据与页面
- 资源列表数据：`public/data.json`（由 [github.mjs](fetchers/github.mjs) 等生成）
- 使用案例数据：`public/cases.json`（由 [scripts/update.mjs](scripts/update.mjs) 汇总生成）
- 页面入口：
  - 资源列表：`index.html`（脚本 [app.js](app.js)）
  - 使用案例：`cases.html`（脚本 [cases.js](cases.js)）

## 核心提取逻辑
- LangExtract 集成：
  - 严格匹配 `Prompt/提示词/输入` 标签，限制正文最多 4 行与 400 字符，避免整段说明误识别为 Prompt。
  - 支持 ZHO 风格 `1）… Prompt:`、代码块与引号格式。
  - 图片提取支持 `<img>` 与 Markdown 图片，结合上下文与 `alt` 文本。
- ZHO README 增强：
  - 章节文本内未命中图片时，使用“全局图片回填”：按章节标题关键词与编号，到全文范围关联相关图片。

## 常用测试与验证
- 阶段 1 集成测试：`npm run test:stage1`（日志型验证）
- ZHO README 专项测试：在项目根运行 `node test-zho-langextract.mjs`，输出案例与图片统计，便于核查提取效果（见 [test-zho-langextract.mjs](test-zho-langextract.mjs)）。

## 贡献与工作流
- 建议使用独立分支开发，发起 GitHub PR 进行代码 Review 与合并。
- 遵循项目规则：使用 Makefile 管理启动/停止与数据刷新等。

## 注意事项
- 目前视频（如 `.mov`）不会作为图片展示；若需视频缩略图，可在前端增加占位卡或抓取缩略图策略。
- `scripts/test-langextract-integration.mjs` 依赖 `vitest` 接口，但默认通过 `node` 运行日志型测试；如需跑 Vitest，请自行安装并配置。

