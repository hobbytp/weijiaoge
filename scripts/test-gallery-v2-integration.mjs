// scripts/test-gallery-v2-integration.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 开始运行 Gallery v2 DOM 集成测试 (Ticket 1: Theme & Tokens)...');

// 1. 验证 public/style.css 中包含核心设计令牌 Token
const cssContent = fs.readFileSync(path.join(rootDir, 'public', 'style.css'), 'utf-8');
const expectedTokens = [
  '--bg-primary',
  '--bg-surface',
  '--text-primary',
  '--text-muted',
  '--accent-gold',
  '--border-subtle'
];

console.log('  ▸ 校验 CSS 设计令牌定义...');
for (const token of expectedTokens) {
  assert(cssContent.includes(token), `public/style.css 必须定义设计令牌: ${token}`);
}
assert(cssContent.includes('[data-theme="dark"]'), 'public/style.css 必须包含 [data-theme="dark"] 作用域');
console.log('  ✅ 设计令牌定义校验通过');

// 2. 模拟 JSDOM 环境加载 cases.html
console.log('  ▸ 校验 cases.html 主题切换按钮与持久化逻辑...');
const htmlContent = fs.readFileSync(path.join(rootDir, 'cases.html'), 'utf-8');

// 创建 localStorage Mock
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const virtualConsole = new VirtualConsole();
virtualConsole.on('error', () => {});

const dom = new JSDOM(htmlContent, {
  runScripts: 'dangerously',
  virtualConsole,
  url: 'http://localhost:3000/cases.html',
  beforeParse(window) {
    const mockStorage = new LocalStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
    window.matchMedia = window.matchMedia || function() {
      return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
      };
    };
  }
});

const { document, window } = dom.window;

// 等待 DOMContentLoaded
await new Promise(resolve => setTimeout(resolve, 50));

// 3. 验证导航栏中存在主题切换按钮
const themeToggleBtn = document.getElementById('theme-toggle');
assert(themeToggleBtn, 'cases.html 导航栏中必须包含 id="theme-toggle" 按钮');
assert(themeToggleBtn.getAttribute('aria-label'), '主题切换按钮必须有 aria-label 属性');

// 4. 验证默认初始化主题
const rootElement = document.documentElement;
assert.strictEqual(
  rootElement.getAttribute('data-theme'),
  'light',
  '在无存储且 prefers-color-scheme 为 false 时，初始 data-theme 必须为 light'
);

// 5. 模拟点击切换到 dark 模式
themeToggleBtn.click();
assert.strictEqual(
  rootElement.getAttribute('data-theme'),
  'dark',
  '点击主题按钮后，data-theme 必须切换为 dark'
);
assert.strictEqual(
  window.localStorage.getItem('weijiaoge-theme'),
  'dark',
  '切换到 dark 后，localStorage weijiaoge-theme 必须保存为 dark'
);

// 6. 再次点击切回 light 模式
themeToggleBtn.click();
assert.strictEqual(
  rootElement.getAttribute('data-theme'),
  'light',
  '再次点击主题按钮后，data-theme 必须切换回 light'
);
assert.strictEqual(
  window.localStorage.getItem('weijiaoge-theme'),
  'light',
  '切换回 light 后，localStorage weijiaoge-theme 必须保存为 light'
);

console.log('  ✅ 主题切换与持久化测试完全通过！');
console.log('🎉 Ticket 1 集成测试用例执行完毕！');

// ── Ticket 2: Masonry Balancer & Incremental Batch Rendering ──
console.log('\n🧪 开始运行 Ticket 2: Masonry 瀑布流与分批增量渲染测试...');

// 7. 验证 style.css 中包含瀑布流相关选择器
console.log('  ▸ 校验 CSS 瀑布流与角标样式...');
assert(cssContent.includes('.masonry-column'), 'public/style.css 必须定义 .masonry-column 样式');
assert(cssContent.includes('.aspect-badge'), 'public/style.css 必须定义 .aspect-badge 比例角标样式');
assert(cssContent.includes('.batch-sentinel'), 'public/style.css 必须定义 .batch-sentinel 哨兵样式');
console.log('  ✅ CSS 瀑布流与角标样式校验通过');

// 8. 验证 cases.html 中存在 batch-sentinel 元素
console.log('  ▸ 校验 cases.html 结构与哨兵节点...');
const batchSentinel = document.getElementById('batch-sentinel');
assert(batchSentinel, 'cases.html 必须包含 id="batch-sentinel" 哨兵元素');
console.log('  ✅ 哨兵节点校验通过');

// 9. 验证 cases.js 导出的瀑布流与分批渲染机制
console.log('  ▸ 校验 Masonry 列均衡与 24 张分批增量加载...');
const casesGrid = document.getElementById('cases-grid');
assert(casesGrid, '必须存在 id="cases-grid" 容器');

// 读取 cases.js 并注入执行
const casesJsCode = fs.readFileSync(path.join(rootDir, 'cases.js'), 'utf-8');

// 构造 30 个包含不同尺寸与比例的 mock 案例
const mockCases = Array.from({ length: 30 }, (_, i) => ({
  title: `Test Case ${i + 1}`,
  category: 'test',
  categoryName: '测试分类',
  sourceUrl: `https://example.com/test-${i}`,
  prompts: [`Prompt for test case ${i + 1}`],
  effects: [`Effect description ${i + 1}`],
  images: [`https://example.com/image-${i}.png`],
  aspectRatio: i % 3 === 0 ? '16:9' : (i % 3 === 1 ? '9:16' : '1:1')
}));

// Mock fetch 返回 mock 案例数据
window.fetch = async () => ({
  json: async () => ({ cases: mockCases })
});

// Mock IntersectionObserver
let observerCallback = null;
class IntersectionObserverMock {
  constructor(cb) {
    observerCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = IntersectionObserverMock;

// 执行 cases.js
window.eval(casesJsCode);

// 触发 loadCases
await window.loadCases();

// 验证第一批渲染：必须分列且卡片数正好为 24
const columns = casesGrid.querySelectorAll('.masonry-column');
assert(columns.length >= 1, 'casesGrid 必须包含至少 1 个 .masonry-column 列容器');

const initialCards = casesGrid.querySelectorAll('.case-card');
assert.strictEqual(initialCards.length, 24, `首屏第一批必须渲染 24 张卡片，实际得到 ${initialCards.length}`);

// 验证卡片内含有 aspect-badge
const firstCardBadge = initialCards[0].querySelector('.aspect-badge');
assert(firstCardBadge, 'Case Card 必须包含 .aspect-badge 比例角标');

// 模拟滚动触碰哨兵，触发第二批渲染
assert(typeof observerCallback === 'function', '必须为 batch-sentinel 注册 IntersectionObserver 回调');
observerCallback([{ isIntersecting: true }]);

// 再次统计卡片数量：30 张应全量加载完毕
const allCards = casesGrid.querySelectorAll('.case-card');
assert.strictEqual(allCards.length, 30, `第二批加载后卡片总数应为 30，实际得到 ${allCards.length}`);

console.log('  ✅ Masonry 列均衡与分批流式渲染全部通过！');
console.log('🎉 Ticket 2 集成测试用例执行完毕！\n');

