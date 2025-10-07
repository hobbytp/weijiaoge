# 🛠️ 本地开发指南

## 📋 本地数据收集最佳实践

### 1. **本地开发流程**

#### 🔄 **推荐工作流程**

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 本地数据收集
npm run update

# 3. 本地预览
npm run serve

# 4. 提交本地更改
git add public/
git commit -m "feat: 本地数据更新"
git push origin main
```

#### ⚠️ **避免冲突的方法**

```bash
# 在本地修改前，先拉取最新代码
git pull origin main

# 或者创建开发分支
git checkout -b local-data-update
npm run update
# 处理完后再合并到主分支
```

### 2. **数据同步策略**

#### 🔄 **同步方式选择**

| 方式 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| **本地优先** | 开发测试 | 快速迭代 | 可能被覆盖 |
| **云端优先** | 生产环境 | 数据一致 | 需要等待 |
| **混合模式** | 团队协作 | 灵活性强 | 需要协调 |

#### 🎯 **推荐策略**

**开发阶段**:

```bash
# 本地开发，快速测试
npm run update
npm run serve
```

**生产阶段**:

```bash
# 让GitHub Actions处理，确保数据一致性
# 不要手动修改public/目录下的文件
```

### 3. **数据备份和恢复**

#### 💾 **数据备份**

```bash
# 备份当前数据
cp public/data.json public/data.json.backup
cp public/cases.json public/cases.json.backup

# 或者使用git标签
git tag data-backup-$(date +%Y%m%d)
git push origin data-backup-$(date +%Y%m%d)
```

#### 🔄 **数据恢复**

```bash
# 从备份恢复
cp public/data.json.backup public/data.json
cp public/cases.json.backup public/cases.json

# 或者从git标签恢复
git checkout data-backup-20250107 -- public/
```

### 4. **本地开发环境配置**

#### 🔧 **环境变量设置**

```bash
# 创建本地.env文件
cp env.example .env

# 编辑.env文件，添加API密钥
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
SERPAPI_KEY=your_serpapi_key
GOOGLE_CSE_ID=your_cse_id
GOOGLE_SEARCH_API_KEY=your_search_key
```

#### 🚀 **本地开发命令**

```bash
# 安装依赖
npm install
npx playwright install chromium

# 数据收集
npm run update

# 本地服务器
npm run serve

# 开发模式（自动重启）
npm run dev
```

### 5. **数据覆盖处理**

#### ⚠️ **覆盖风险**

- GitHub Actions运行时会覆盖本地数据
- 本地修改可能丢失
- 数据不一致问题

#### 🛡️ **防护措施**

**1. 使用分支开发**

```bash
# 创建开发分支
git checkout -b feature/local-data-update

# 在分支上开发
npm run update
# 测试和修改

# 完成后合并
git checkout main
git merge feature/local-data-update
```

**2. 数据版本控制**

```bash
# 提交数据更改
git add public/
git commit -m "feat: 更新本地数据"

# 推送到远程
git push origin main
```

**3. 监控GitHub Actions**

- 查看Actions运行状态
- 监控数据更新频率
- 检查数据质量

### 6. **团队协作最佳实践**

#### 👥 **协作流程**

**开发者A**:

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 本地数据收集
npm run update

# 3. 测试和验证
npm run serve

# 4. 提交更改
git add public/
git commit -m "feat: 本地数据更新"
git push origin main
```

**开发者B**:

```bash
# 1. 拉取最新代码（包含A的更改）
git pull origin main

# 2. 继续开发
npm run update
# 基于最新数据继续开发
```

#### 🔄 **数据同步策略**

**策略1: 云端优先**

- 始终从GitHub Actions获取最新数据
- 本地只做测试，不提交数据文件
- 适合生产环境

**策略2: 本地优先**

- 本地开发，手动控制数据更新
- 定期同步到云端
- 适合开发环境

**策略3: 混合模式**

- 开发分支：本地优先
- 主分支：云端优先
- 定期合并和同步

### 7. **故障排除**

#### ❌ **常见问题**

**问题1: 数据被覆盖**

```bash
# 解决方案：从备份恢复
git checkout HEAD~1 -- public/
```

**问题2: 数据不一致**

```bash
# 解决方案：重新拉取和生成
git pull origin main
npm run update
```

**问题3: API密钥问题**

```bash
# 解决方案：检查环境变量
echo $GEMINI_API_KEY
echo $OPENAI_API_KEY
```

#### 🔧 **调试工具**

**查看数据状态**

```bash
# 查看数据文件信息
ls -la public/
stat public/data.json
stat public/cases.json
```

**查看数据内容**

```bash
# 查看数据统计
node -e "console.log(JSON.parse(require('fs').readFileSync('public/data.json', 'utf8')).total)"
node -e "console.log(JSON.parse(require('fs').readFileSync('public/cases.json', 'utf8')).total)"
```

**查看Git历史**

```bash
# 查看数据文件历史
git log --oneline public/data.json
git log --oneline public/cases.json
```

### 8. **最佳实践总结**

#### ✅ **推荐做法**

1. **开发时**: 使用本地数据收集进行快速测试
2. **生产时**: 让GitHub Actions处理数据更新
3. **协作时**: 使用分支开发，定期同步
4. **备份**: 重要数据及时备份
5. **监控**: 关注GitHub Actions运行状态

#### ❌ **避免做法**

1. 不要在生产分支上手动修改数据文件
2. 不要忽略GitHub Actions的覆盖
3. 不要在没有备份的情况下进行大量修改
4. 不要忽略数据一致性问题

---

**总结**: GitHub Actions会覆盖本地数据，但通过合理的开发流程和版本控制，可以避免数据冲突，实现高效的本地开发。
