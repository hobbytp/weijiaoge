// scripts/update-zho-in-cases-json.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromGitHubReadme } from '../fetchers/case-extractor.mjs';
import { cleanPromptText } from '../fetchers/text-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const casesFile = path.join(root, 'public', 'cases.json');

console.log('📖 读取当前 public/cases.json ...');
const data = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
console.log(`当前 cases.json 总数: ${data.cases.length}`);

// 识别并过滤旧 ZHO 案例
const oldZhoCases = data.cases.filter(c => 
  (c.sourceUrl && c.sourceUrl.includes('ZHO')) || 
  (c.source && c.source.includes('ZHO'))
);
const nonZhoCases = data.cases.filter(c => 
  (!c.sourceUrl || !c.sourceUrl.includes('ZHO')) && 
  (!c.source || !c.source.includes('ZHO'))
);
console.log(`过滤出旧 ZHO 案例: ${oldZhoCases.length} 个, 其余案例: ${nonZhoCases.length} 个`);

// 提取全新 46 个准确 ZHO 案例
let readmeContent = '';
const scratchReadme = path.join(root, 'scratch', 'zho_readme.md');
if (fs.existsSync(scratchReadme)) {
  readmeContent = fs.readFileSync(scratchReadme, 'utf8');
} else {
  console.log('从 GitHub 获取最新 README ...');
  const res = await fetch('https://raw.githubusercontent.com/ZHO-ZHO-ZHO/ZHO-nano-banana-Creation/main/README.md');
  readmeContent = await res.text();
}

const zhoItem = {
  title: 'ZHO-ZHO-ZHO/ZHO-nano-banana-Creation - README',
  description: readmeContent,
  url: 'https://github.com/ZHO-ZHO-ZHO/ZHO-nano-banana-Creation#readme',
  type: 'readme',
  source: 'github'
};

console.log('🔄 使用修复后的提取器提取 ZHO 案例...');
const freshZhoCases = await extractCasesFromGitHubReadme(zhoItem);
console.log(`提取到新 ZHO 案例: ${freshZhoCases.length} 个`);

// 格式化与瘦身
const slimFreshCases = freshZhoCases.map(({ originalItem, id, extractedAt, ...rest }) => {
  if (Array.isArray(rest.prompts)) {
    rest.prompts = rest.prompts.map(p => {
      const raw = typeof p === 'string' ? p : p.text || '';
      const text = cleanPromptText(raw);
      return typeof p === 'string' ? { text } : { ...p, text };
    }).filter(p => p.text);
  }
  return rest;
});

// 合并案例
const updatedCases = [...nonZhoCases, ...slimFreshCases];

const categories = Object.keys(updatedCases.reduce((acc, c) => {
  acc[c.category] = (acc[c.category] || 0) + 1;
  return acc;
}, {}));

const updatedPayload = {
  version: data.version || 1,
  generatedAt: new Date().toISOString(),
  total: updatedCases.length,
  categories: categories,
  cases: updatedCases
};

fs.writeFileSync(casesFile, JSON.stringify(updatedPayload, null, 2), 'utf8');
console.log(`✅ 成功更新 public/cases.json! 总案例数: ${updatedCases.length} (新 ZHO: ${slimFreshCases.length} 个)`);
