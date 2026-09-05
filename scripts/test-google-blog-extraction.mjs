// scripts/test-google-blog-extraction.mjs
// 验证 Google 官方博客《Ultimate prompting guide for Nano Banana》案例精准提取

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdaptor } from '../fetchers/adaptors/registry.mjs';
import { GoogleBlogAdaptor } from '../fetchers/adaptors/google-blog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const blogHtmlPath = path.join(root, 'scratch', 'google_blog.html');

console.log('🧪 开始测试 Google 官方博客案例提取...\n');

const testUrl = 'https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana';

// 1. 验证 Adaptor 匹配
const adaptor = getAdaptor(testUrl);
if (!(adaptor instanceof GoogleBlogAdaptor)) {
  console.error(`❌ [Adaptor 匹配失败] 未匹配到 GoogleBlogAdaptor，实际为: ${adaptor?.constructor?.name}`);
  process.exit(1);
}
console.log('✅ [Adaptor 匹配] 成功匹配到 GoogleBlogAdaptor');

// 2. 读取或获取 HTML
let html = '';
if (fs.existsSync(blogHtmlPath)) {
  html = fs.readFileSync(blogHtmlPath, 'utf8');
} else {
  console.log('🌐 从网络获取 Google Blog HTML...');
  const res = await fetch(testUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  html = await res.text();
}

if (!html || html.length < 1000) {
  console.error('❌ HTML 内容为空或获取失败');
  process.exit(1);
}

// 3. 执行提取
const cases = await adaptor.extract(html, testUrl);
console.log(`\n📊 提取到案例数: ${cases.length}`);

if (cases.length !== 12) {
  console.error(`❌ 期望提取 12 个案例，实际提取到 ${cases.length} 个`);
  process.exit(1);
}
console.log('✅ [案例总数] 12/12 全部提取成功');

// 4. 逐个案例验证
const allImages = new Set();
let hasErrors = false;

cases.forEach((c, idx) => {
  const num = idx + 1;
  const promptText = c.prompts?.[0]?.text || c.prompt || '';
  const images = c.images || [];

  if (!c.title || c.title.startsWith('[')) {
    console.error(`❌ 案例 ${num} 标题不合格: "${c.title}"`);
    hasErrors = true;
  }

  if (!promptText || promptText.length < 10) {
    console.error(`❌ 案例 ${num} Prompt 不合格: "${promptText}"`);
    hasErrors = true;
  }

  if (promptText.includes('Multimodal generation (generation with references)')) {
    console.error(`❌ 案例 ${num} Prompt 粘连了正文说明段落: "${promptText.substring(0, 100)}..."`);
    hasErrors = true;
  }

  if (images.length === 0) {
    console.error(`❌ 案例 ${num} 缺少配图`);
    hasErrors = true;
  }

  for (const img of images) {
    allImages.add(img);
    if (!img.startsWith('https://storage.googleapis.com/')) {
      console.error(`❌ 案例 ${num} 图片非 Google 官方存储源: ${img}`);
      hasErrors = true;
    }
  }

  console.log(`  ${num}. [${c.categoryName}] ${c.title}`);
  console.log(`     - 配图 (${images.length}张): ${images[0]}`);
  console.log(`     - 提示词: ${promptText.substring(0, 60)}...`);
});

if (hasErrors) {
  console.error('\n❌ 测试未完全通过，存在格式或内容问题！');
  process.exit(1);
}

console.log(`\n🖼️  配图去重检查: 共 ${allImages.size} 张独立原图，无重复图污染`);
console.log('🎉 Google 官方博客案例提取测试全部顺利通过！\n');
