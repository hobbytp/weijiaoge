# GitHub Secrets 配置说明

## 🔐 必需的 Secrets

### 1. 大模型API密钥
```
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

**获取方式**:
- **Gemini API**: 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI API**: 访问 [OpenAI Platform](https://platform.openai.com/api-keys)

### 2. 搜索API密钥
```
SERPAPI_KEY=your_serpapi_key_here
GOOGLE_CSE_ID=your_google_cse_id_here
GOOGLE_SEARCH_API_KEY=your_google_search_api_key_here
```

**获取方式**:
- **SerpAPI**: 访问 [SerpAPI](https://serpapi.com/) 注册获取API密钥
- **Google CSE**: 访问 [Google Custom Search](https://cse.google.com/) 创建搜索引擎
- **Google Search API**: 访问 [Google Cloud Console](https://console.cloud.google.com/) 启用Custom Search API

### 3. GitHub Token
```
GITHUB_TOKEN=自动提供，无需手动设置
```

## 📋 配置步骤

### 1. 进入GitHub仓库设置
1. 访问你的GitHub仓库
2. 点击 "Settings" 标签
3. 在左侧菜单中找到 "Secrets and variables" → "Actions"

### 2. 添加Repository Secrets
点击 "New repository secret" 按钮，逐个添加以下secrets：

| Secret名称 | 描述 | 示例值 |
|-----------|------|--------|
| `GEMINI_API_KEY` | Google Gemini API密钥 | `AIzaSyC...` |
| `OPENAI_API_KEY` | OpenAI API密钥 | `sk-...` |
| `SERPAPI_KEY` | SerpAPI密钥 | `abc123...` |
| `GOOGLE_CSE_ID` | Google自定义搜索引擎ID | `012345678901234567890:abcdefghijk` |
| `GOOGLE_SEARCH_API_KEY` | Google搜索API密钥 | `AIzaSyC...` |

### 3. 验证配置
添加完所有secrets后，可以：
1. 手动触发workflow测试
2. 检查workflow日志确认API密钥有效
3. 验证数据提取是否正常工作

## ⚠️ 重要注意事项

### 1. Secret命名规则
- ✅ 可以使用 `GITHUB_TOKEN` (这是GitHub自动提供的)
- ✅ 可以使用 `GEMINI_API_KEY`, `OPENAI_API_KEY` 等
- ❌ 不要使用以 `GITHUB_` 开头的自定义secret名称
- ✅ 建议使用大写字母和下划线

### 2. API密钥安全
- 🔒 不要在代码中硬编码API密钥
- 🔒 不要将API密钥提交到版本控制
- 🔒 定期轮换API密钥
- 🔒 使用最小权限原则

### 3. 成本控制
- 💰 Gemini API: 按使用量计费
- 💰 OpenAI API: 按使用量计费
- 💰 SerpAPI: 按请求数计费
- 💰 Google Search API: 按请求数计费

## 🧪 测试配置

### 1. 本地测试
```bash
# 设置环境变量
export GEMINI_API_KEY="your_key_here"
export OPENAI_API_KEY="your_key_here"
export SERPAPI_KEY="your_key_here"
export GOOGLE_CSE_ID="your_cse_id_here"
export GOOGLE_SEARCH_API_KEY="your_key_here"

# 运行测试
npm run test:github
```

### 2. GitHub Actions测试
1. 进入 "Actions" 标签
2. 选择 "Fetch and Deploy" workflow
3. 点击 "Run workflow" 按钮
4. 查看运行日志确认配置正确

## 📊 配置验证清单

- [ ] `GEMINI_API_KEY` 已设置且有效
- [ ] `OPENAI_API_KEY` 已设置且有效
- [ ] `SERPAPI_KEY` 已设置且有效
- [ ] `GOOGLE_CSE_ID` 已设置且有效
- [ ] `GOOGLE_SEARCH_API_KEY` 已设置且有效
- [ ] 本地测试通过
- [ ] GitHub Actions测试通过
- [ ] 数据提取正常工作

## 🔧 故障排除

### 常见问题

1. **API密钥无效**
   - 检查密钥是否正确复制
   - 确认API密钥未过期
   - 验证API密钥权限

2. **Google搜索API配额超限**
   - 检查Google Cloud Console配额
   - 考虑升级API配额
   - 优化搜索频率

3. **大模型API调用失败**
   - 检查API密钥格式
   - 确认API服务可用
   - 验证请求参数

4. **Playwright安装失败**
   - 检查网络连接
   - 确认Node.js版本兼容
   - 尝试手动安装: `npx playwright install chromium`

## 📞 支持

如果遇到问题，请：
1. 检查GitHub Actions日志
2. 验证API密钥配置
3. 查看相关API文档
4. 提交Issue描述问题
