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
