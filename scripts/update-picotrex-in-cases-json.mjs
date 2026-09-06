// scripts/update-picotrex-in-cases-json.mjs
// 注入重新精准提取的 PicoTrex/Awesome-Nano-Banana-images 案例至 public/cases.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromGitHubReadme } from '../fetchers/case-extractor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const casesFile = path.join(root, 'public', 'cases.json');
const localReadmeCache = path.join(root, 'scratch', 'picotrex_readme.md');

console.log('📖 读取当前 public/cases.json ...');
const data = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
console.log(`当前 cases.json 总数: ${data.cases.length}`);

// 识别并过滤旧的破损 PicoTrex 案例
const isPicoTrexCase = (c) => {
  return (c.sourceUrl && c.sourceUrl.includes('Awesome-Nano-Banana-images')) ||
    (c.originalItem?.url && c.originalItem.url.includes('Awesome-Nano-Banana-images')) ||
    (c.title && c.title.includes('周边设计') && c.images?.length > 10);
};

const oldCases = data.cases.filter(isPicoTrexCase);
const otherCases = data.cases.filter(c => !isPicoTrexCase(c));
console.log(`过滤出旧的 PicoTrex 案例: ${oldCases.length} 个, 其余其他来源案例: ${otherCases.length} 个`);

// 读取或下载最新 PicoTrex README
let readmeText = '';
if (fs.existsSync(localReadmeCache)) {
  readmeText = fs.readFileSync(localReadmeCache, 'utf8');
} else {
  console.log('🌐 从 GitHub 获取最新 PicoTrex README...');
  const res = await fetch('https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/README.md');
  readmeText = await res.text();
}

const item = {
  title: 'PicoTrex/Awesome-Nano-Banana-images',
  url: 'https://github.com/PicoTrex/Awesome-Nano-Banana-images',
  description: readmeText,
  source: 'github'
};

console.log('🔄 执行精准案例提取...');
const freshCases = await extractCasesFromGitHubReadme(item);
console.log(`提取到独立优质新案例: ${freshCases.length} 个`);

// 合并案例
const updatedCases = [...otherCases, ...freshCases];

const categories = Object.keys(updatedCases.reduce((acc, c) => {
  if (c.category) acc[c.category] = (acc[c.category] || 0) + 1;
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
console.log(`✅ 成功更新 public/cases.json! 总案例数: ${updatedCases.length} (替换/新增 PicoTrex 案例: ${freshCases.length} 个)`);
