# 微蕉阁 (WeiJiaoGe)

持续收集与展示 Gemini Flash Image Preview（Nano Banana）的资源与使用案例，并提供自动化的 Prompt/效果/图片提取、筛选与展示。

## 项目概述
- 资源列表页：聚合 GitHub 仓库与文章，支持搜索与排序（见 [app.js](file:///f:/AI/src/weijiaoge/app.js)）。
- 使用案例页：按来源与分类展示具体 Prompt、效果与图片（见 [cases.js](file:///f:/AI/src/weijiaoge/cases.js)、[cases.html](file:///f:/AI/src/weijiaoge/cases.html)）。
- 数据来源：
  - GitHub 特定仓库的 README 与元信息（见 [github.mjs](file:///f:/AI/src/weijiaoge/fetchers/github.mjs)）。
  - 重要文章与网页（见 [article-extractor.mjs](file:///f:/AI/src/weijiaoge/fetchers/article-extractor.mjs)）。
- 提取与分类：
  - 混合提取器（传统 + LangExtract + 增强）：[hybrid-extractor.mjs](file:///f:/AI/src/weijiaoge/fetchers/hybrid-extractor.mjs)。
  - LangExtract 集成（严格 Prompt 识别与截断、效果/图片提取）：[langextract-extractor.mjs](file:///f:/AI/src/weijiaoge/fetchers/langextract-extractor.mjs)。
  - 针对 ZHO 仓库的章节解析与全局图片关联增强：见 [case-extractor.mjs](file:///f:/AI/src/weijiaoge/fetchers/case-extractor.mjs#L515-L599)。

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
- 资源列表数据：`public/data.json`（由 [github.mjs](file:///f:/AI/src/weijiaoge/fetchers/github.mjs) 等生成）
- 使用案例数据：`public/cases.json`（由 [scripts/update.mjs](file:///f:/AI/src/weijiaoge/scripts/update.mjs) 汇总生成）
- 页面入口：
  - 资源列表：`index.html`（脚本 [app.js](file:///f:/AI/src/weijiaoge/app.js)）
  - 使用案例：`cases.html`（脚本 [cases.js](file:///f:/AI/src/weijiaoge/cases.js)）

## 核心提取逻辑
- LangExtract 集成：
  - 严格匹配 `Prompt/提示词/输入` 标签，限制正文最多 4 行与 400 字符，避免整段说明误识别为 Prompt。
  - 支持 ZHO 风格 `1）… Prompt:`、代码块与引号格式。
  - 图片提取支持 `<img>` 与 Markdown 图片，结合上下文与 `alt` 文本。
- ZHO README 增强：
  - 章节文本内未命中图片时，使用“全局图片回填”：按章节标题关键词与编号，到全文范围关联相关图片。

## 常用测试与验证
- 阶段 1 集成测试：`npm run test:stage1`（日志型验证）
- ZHO README 专项测试：在项目根运行 `node test-zho-langextract.mjs`，输出案例与图片统计，便于核查提取效果（见 [test-zho-langextract.mjs](file:///f:/AI/src/weijiaoge/test-zho-langextract.mjs)）。

## 贡献与工作流
- 建议使用独立分支开发，发起 GitHub PR 进行代码 Review 与合并。
- 遵循项目规则：使用 Makefile 管理启动/停止与数据刷新等。

## 注意事项
- 目前视频（如 `.mov`）不会作为图片展示；若需视频缩略图，可在前端增加占位卡或抓取缩略图策略。
- `scripts/test-langextract-integration.mjs` 依赖 `vitest` 接口，但默认通过 `node` 运行日志型测试；如需跑 Vitest，请自行安装并配置。

