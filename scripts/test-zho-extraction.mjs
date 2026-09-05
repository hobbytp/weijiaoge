// scripts/test-zho-extraction.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromGitHubReadme } from '../fetchers/case-extractor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const readmePath = path.join(root, 'scratch', 'zho_readme.md');

let content = '';
if (fs.existsSync(readmePath)) {
  content = fs.readFileSync(readmePath, 'utf8');
} else {
  console.log('Fetching raw README from GitHub...');
  const res = await fetch('https://raw.githubusercontent.com/ZHO-ZHO-ZHO/ZHO-nano-banana-Creation/main/README.md');
  content = await res.text();
}

const zhoItem = {
  title: 'ZHO-ZHO-ZHO/ZHO-nano-banana-Creation - README',
  description: content,
  url: 'https://github.com/ZHO-ZHO-ZHO/ZHO-nano-banana-Creation#readme',
  type: 'readme',
  source: 'github'
};

const cases = await extractCasesFromGitHubReadme(zhoItem);
console.log(`\n=== 提取结果分析 ===`);
console.log(`总案例数: ${cases.length}`);

// 检查每个案例的图片与Prompt
let noImages = 0;
let noPrompts = 0;
const imageCaseCount = new Map();

for (const c of cases) {
  const imgCount = c.images?.length || 0;
  const promptCount = c.prompts?.length || 0;
  if (imgCount === 0) noImages++;
  if (promptCount === 0) noPrompts++;
  
  for (const img of c.images || []) {
    imageCaseCount.set(img, (imageCaseCount.get(img) || 0) + 1);
  }
}

console.log(`无图片案例数: ${noImages}`);
console.log(`无Prompt案例数: ${noPrompts}`);

// 检查是否有同一个图片被多个不同案例共享（如之前的封面大图 48d727e7）
const duplicatedImages = [...imageCaseCount.entries()].filter(([_, count]) => count > 1);
console.log(`被多个案例共享的图片数: ${duplicatedImages.length}`);
if (duplicatedImages.length > 0) {
  for (const [img, count] of duplicatedImages) {
    console.log(`  - 共享次数 ${count}: ${img}`);
  }
}

// 输出特定关注的案例 (如产品包装贴合, 产品设计图转真实效果/渲染, 工业设计 手绘 秒变 实景效果)
const focusTitles = ['产品包装贴合', '产品设计图转真实效果/渲染', '工业设计 手绘 秒变 实景效果'];
console.log(`\n=== 重点案例验证 ===`);
for (const ft of focusTitles) {
  const found = cases.find(c => c.title.includes(ft));
  if (found) {
    console.log(`\n【${found.title}】`);
    console.log(`  - 分类: ${found.categoryName} (${found.category})`);
    console.log(`  - 图片数: ${found.images.length}`);
    console.log(`  - 图片:`, found.images);
    console.log(`  - Prompt数: ${found.prompts.length}`);
    console.log(`  - 第一条Prompt: ${found.prompts[0]?.text?.substring(0, 80)}...`);
  } else {
    console.log(`⚠️ 未找到案例: ${ft}`);
  }
}
