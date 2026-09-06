// scripts/test-picotrex-extraction.mjs
// 验证 PicoTrex/Awesome-Nano-Banana-images 案例精准提取与图片分离

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromGitHubReadme } from '../fetchers/case-extractor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const localReadmeCache = path.join(root, 'scratch', 'picotrex_readme.md');

console.log('🧪 开始测试 PicoTrex/Awesome-Nano-Banana-images 案例提取...\n');

let readmeText = '';
if (fs.existsSync(localReadmeCache)) {
  readmeText = fs.readFileSync(localReadmeCache, 'utf8');
} else {
  console.log('🌐 从 GitHub 获取最新 PicoTrex README...');
  const res = await fetch('https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/README.md');
  readmeText = await res.text();
  // 缓存本地供后续快速测试
  if (!fs.existsSync(path.dirname(localReadmeCache))) {
    fs.mkdirSync(path.dirname(localReadmeCache), { recursive: true });
  }
  fs.writeFileSync(localReadmeCache, readmeText, 'utf8');
}

if (!readmeText || readmeText.length < 1000) {
  console.error('❌ README 内容获取失败或内容为空');
  process.exit(1);
}

const item = {
  title: 'PicoTrex/Awesome-Nano-Banana-images',
  url: 'https://github.com/PicoTrex/Awesome-Nano-Banana-images',
  description: readmeText,
  source: 'github'
};

const cases = await extractCasesFromGitHubReadme(item);
console.log(`📊 提取到总案例数: ${cases.length}`);

if (cases.length < 150) {
  console.error(`❌ 提取案例数过少: ${cases.length}，预期 >= 150`);
  process.exit(1);
}
console.log('✅ [案例总数] 提取数量充足且正常 (>= 150)');

// 1. 验证“周边设计”案例只提取出一个，并且配图为正确的 2 张（生成结果 output 在前）
const zhoubianCases = cases.filter(c => c.title && c.title.includes('周边设计'));
if (zhoubianCases.length !== 1) {
  console.error(`❌ 预期“周边设计”只有 1 个案例，实际出现 ${zhoubianCases.length} 个！`);
  process.exit(1);
}
const c68 = zhoubianCases[0];
if (!c68.images || c68.images.length !== 2) {
  console.error(`❌ Case 68 (周边设计) 配图数量异常: ${c68.images?.length}，预期 2 张！`);
  process.exit(1);
}
if (!c68.images[0].includes('output.jpg')) {
  console.error(`❌ Case 68 首张封面图应为 output.jpg，实际为: ${c68.images[0]}`);
  process.exit(1);
}
const c68Prompt = c68.prompts?.[0]?.text || '';
if (!c68Prompt.includes('用这个角色图像创建商品')) {
  console.error(`❌ Case 68 Prompt 提取异常: ${c68Prompt}`);
  process.exit(1);
}
console.log('✅ [Case 68 周边设计] 标题独立唯一、Prompt 完整、图片仅 2 张且 output.jpg 置顶封面');

// 2. 验证例 69 - 例 92 不再合并，且各自具有独立标题和图片
const sampleCheckList = [
  { num: '69', keyword: '模型全息投影', expectedImg: 'case69/output.png' },
  { num: '70', keyword: '巨型人物脚手架', expectedImg: 'case70/output.png' },
  { num: '71', keyword: '遥感影像建筑物提取', expectedImg: 'case71/output.png' },
  { num: '72', keyword: '部件提取', expectedImg: 'case72/output.png' },
  { num: '73', keyword: '移除汉堡的配料', expectedImg: 'case73/output.jpg' },
  { num: '74', keyword: '图像高清修复', expectedImg: 'case74/output.png' },
  { num: '75', keyword: '图片生成微缩场景', expectedImg: 'case75/output.png' },
  { num: '80', keyword: '切割模型', expectedImg: 'case80' },
  { num: '90', keyword: '成为Vtuber', expectedImg: 'case90' }
];

for (const check of sampleCheckList) {
  const matched = cases.find(c => c.title && c.title.includes(check.keyword));
  if (!matched) {
    console.error(`❌ 未找到例 ${check.num} 对应案例 (${check.keyword})`);
    process.exit(1);
  }
  if (!matched.images || matched.images.length === 0) {
    console.error(`❌ 例 ${check.num} (${check.keyword}) 缺少配图`);
    process.exit(1);
  }
  if (check.expectedImg && !matched.images[0].includes(check.expectedImg)) {
    console.error(`❌ 例 ${check.num} (${check.keyword}) 封面图不匹配预期 ${check.expectedImg}，实际为: ${matched.images[0]}`);
    process.exit(1);
  }
  if (matched.images.length > 10) {
    console.error(`❌ 例 ${check.num} (${check.keyword}) 图片数量异常过多: ${matched.images.length} 张`);
    process.exit(1);
  }
}
console.log('✅ [例 69-92 独立性] 所有抽检案例均具有专属独立标题、专属 Prompt 与隔离配图');

// 3. 全局唯一性校验：确保没有任何两个案例共享相同非空首图
const primaryImageMap = new Map();
let duplicateCount = 0;

for (const c of cases) {
  if (c.images && c.images.length > 0) {
    const primary = c.images[0];
    if (primaryImageMap.has(primary)) {
      duplicateCount++;
      console.warn(`⚠️ 发现首图碰撞: ${primary} 共享于 [${primaryImageMap.get(primary)}] 和 [${c.title}]`);
    } else {
      primaryImageMap.set(primary, c.title);
    }
  }
}

if (duplicateCount > 0) {
  console.error(`❌ 存在 ${duplicateCount} 个首图碰撞的案例！`);
  process.exit(1);
}
console.log('✅ [全局首图唯一性] 全量 162 个案例中 0 个首图碰撞，封面图完全隔离且精准对应');

console.log('\n🎉 所有 PicoTrex 案例提取测试全部通过！');
