// scripts/test-prompt-display-clean.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import { cleanPromptText } from '../fetchers/text-utils.mjs';

console.log('🧪 开始测试 Prompt 前缀及空白字符清洗逻辑...');

// 1. 单元测试 cleanPromptText
const casesToTest = [
  {
    name: '开头多余空格与换行',
    input: '   \n\t  Design a hyperrealistic cinematic poster  ',
    expected: 'Design a hyperrealistic cinematic poster'
  },
  {
    name: 'Prompt: 前缀带代码块',
    input: 'Prompt：\n ```\n Separate the person inside the green box',
    expected: 'Separate the person inside the green box'
  },
  {
    name: 'Prompt 序号与中文冒号',
    input: 'Prompt1：Help me convert this residential floor plan',
    expected: 'Help me convert this residential floor plan'
  },
  {
    name: '带数字序号与分类的 Prompt',
    input: '1）变手办 Prompt：\n ```\n turn this photo into a character figure.',
    expected: 'turn this photo into a character figure.'
  },
  {
    name: 'Img Prompt 前缀',
    input: 'Img Prompt：\n ```\n 把左边第二位人物换成希斯莱杰小丑',
    expected: '把左边第二位人物换成希斯莱杰小丑'
  },
  {
    name: '纯代码块包裹',
    input: '```markdown\nPixel-art scene of a [subject]\n```',
    expected: 'Pixel-art scene of a [subject]'
  },
  {
    name: '中文提示词前缀',
    input: '提示词：生成一张超高清摄影照片',
    expected: '生成一张超高清摄影照片'
  },
  {
    name: '英文 prompt: 小写前缀',
    input: '   prompt: a cute dog on grass   ',
    expected: 'a cute dog on grass'
  },
  {
    name: '紧贴的代码块反引号',
    input: 'Prompt: ```Studio shot of a [PRODUCT]```',
    expected: 'Studio shot of a [PRODUCT]'
  }
];

for (const tc of casesToTest) {
  const actual = cleanPromptText(tc.input);
  assert.strictEqual(actual, tc.expected, `用例 [${tc.name}] 期望 "${tc.expected}"，实际得到 "${actual}"`);
  console.log(`  ✅ [${tc.name}] 通过`);
}

// 2. 测试 cases.js 中 renderCase 生成的 HTML 标签紧凑性（无换行与多余空格）
// 模拟 cases.js 中的逻辑
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mockRenderPromptHtml(rawPrompt) {
  const promptText = cleanPromptText(rawPrompt);
  const isLongPrompt = promptText.length > 200;
  const displayPrompt = isLongPrompt ? promptText.substring(0, 200) + '...' : promptText;
  const fullPrompt = promptText;

  return `<div class="prompt-text ${isLongPrompt ? 'prompt-truncated' : ''}" data-full="${escapeHtml(fullPrompt)}">${escapeHtml(displayPrompt)}</div>`;
}

const html = mockRenderPromptHtml('   Prompt:\n ```\n Northern Lights Product description');
assert(html.includes('>Northern Lights Product description</div>'), `HTML 标签内不能有换行或缩进空格: ${html}`);
console.log('  ✅ [HTML 模板紧凑性测试] 通过：<div class="prompt-text"> 与文本之间无任何多余空格/换行');

// 3. 校验 public/cases.json 中已无残留的 Prompt: 或 ``` 前缀
const data = JSON.parse(fs.readFileSync('public/cases.json', 'utf8'));
let dirtyCount = 0;
for (const c of data.cases) {
  for (const p of c.prompts) {
    const t = typeof p === 'string' ? p : p.text || '';
    if (/^\s*(?:prompt\s*\d*|提示词?|咒语|输入)\s*[：:]/i.test(t) || /^\s*```/.test(t) || /^\s+/.test(t)) {
      console.warn(`  ⚠️ 发现仍存在未清理的前缀: [${c.title}] -> ${JSON.stringify(t.substring(0, 40))}`);
      dirtyCount++;
    }
  }
}
assert.strictEqual(dirtyCount, 0, `public/cases.json 中仍然存在 ${dirtyCount} 个未清理干净的 prompt！`);
console.log(`  ✅ [public/cases.json 验证] 通过：全部 ${data.cases.length} 个案例 prompt 均已清洗完毕！`);

console.log('\n🎉 所有测试均已成功通过！');
