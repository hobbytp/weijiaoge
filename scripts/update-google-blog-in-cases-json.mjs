// scripts/update-google-blog-in-cases-json.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdaptor } from '../fetchers/adaptors/registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const casesFile = path.join(root, 'public', 'cases.json');
const blogHtmlPath = path.join(root, 'scratch', 'google_blog.html');

console.log('📖 读取当前 public/cases.json ...');
const data = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
console.log(`当前 cases.json 总数: ${data.cases.length}`);

const targetUrl = 'https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana';

// 识别并过滤旧的破损案例
const oldCases = data.cases.filter(c => c.sourceUrl && c.sourceUrl.includes('ultimate-prompting-guide'));
const otherCases = data.cases.filter(c => !c.sourceUrl || !c.sourceUrl.includes('ultimate-prompting-guide'));
console.log(`过滤出旧的破损案例: ${oldCases.length} 个, 其余案例: ${otherCases.length} 个`);

// 使用 GoogleBlogAdaptor 提取 12 个高质量新案例
let html = '';
if (fs.existsSync(blogHtmlPath)) {
  html = fs.readFileSync(blogHtmlPath, 'utf8');
} else {
  console.log('从网络获取 Google Blog HTML ...');
  const res = await fetch(targetUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  html = await res.text();
}

const adaptor = getAdaptor(targetUrl);
console.log(`🔄 使用适配器 ${adaptor.constructor.name} 提取最新案例...`);
const freshCases = await adaptor.extract(html, targetUrl);
console.log(`提取到新案例: ${freshCases.length} 个`);

// 合并案例
const updatedCases = [...otherCases, ...freshCases];

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
console.log(`✅ 成功更新 public/cases.json! 总案例数: ${updatedCases.length} (新增/替换 Google 博客案例: ${freshCases.length} 个)`);
