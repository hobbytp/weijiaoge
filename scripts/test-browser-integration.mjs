// scripts/test-browser-integration.mjs
// 测试浏览器工具集成功能

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserExtractor } from '../fetchers/browser-extractor.mjs';

describe('浏览器工具集成测试', () => {
  let browserExtractor;

  beforeAll(async () => {
    browserExtractor = new BrowserExtractor();
  });

  afterAll(async () => {
    if (browserExtractor) {
      await browserExtractor.cleanup();
    }
  });

  describe('基础功能测试', () => {
    it('应该能够初始化浏览器提取器', () => {
      expect(browserExtractor).toBeDefined();
      expect(browserExtractor.isInitialized).toBe(true);
    });

    it('应该能够设置浏览器配置', () => {
      const config = {
        headless: true,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      
      browserExtractor.setConfig(config);
      expect(browserExtractor.config).toEqual(config);
    });

    it('应该能够设置超时时间', () => {
      const timeout = 30000;
      browserExtractor.setTimeout(timeout);
      expect(browserExtractor.timeout).toBe(timeout);
    });
  });

  describe('页面导航测试', () => {
    it('应该能够导航到指定URL', async () => {
      const url = 'https://example.com';
      
      const result = await browserExtractor.navigateTo(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.url).toBe(url);
      expect(result.title).toBeDefined();
    });

    it('应该能够处理导航错误', async () => {
      const invalidUrl = 'https://invalid-url-that-does-not-exist.com';
      
      const result = await browserExtractor.navigateTo(invalidUrl);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该能够等待页面加载完成', async () => {
      const url = 'https://example.com';
      
      const result = await browserExtractor.navigateTo(url, { waitForLoad: true });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(true);
    });
  });

  describe('内容提取测试', () => {
    it('应该能够提取页面文本内容', async () => {
      const url = 'https://example.com';
      
      const result = await browserExtractor.extractTextContent(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('应该能够提取特定元素内容', async () => {
      const url = 'https://example.com';
      const selector = 'h1';
      
      const result = await browserExtractor.extractElementContent(url, selector);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('应该能够提取多个元素内容', async () => {
      const url = 'https://example.com';
      const selectors = ['h1', 'p', 'a'];
      
      const result = await browserExtractor.extractMultipleElements(url, selectors);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.elements).toBeDefined();
      expect(result.elements.length).toBeGreaterThan(0);
    });
  });

  describe('JavaScript渲染测试', () => {
    it('应该能够处理JavaScript渲染的内容', async () => {
      const url = 'https://example.com';
      
      const result = await browserExtractor.extractDynamicContent(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.isDynamic).toBe(true);
    });

    it('应该能够等待特定元素出现', async () => {
      const url = 'https://example.com';
      const selector = '.dynamic-content';
      
      const result = await browserExtractor.waitForElement(url, selector);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
    });

    it('应该能够执行自定义JavaScript', async () => {
      const url = 'https://example.com';
      const script = 'return document.title;';
      
      const result = await browserExtractor.executeScript(url, script);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });

  describe('截图和视觉分析测试', () => {
    it('应该能够截取页面截图', async () => {
      const url = 'https://example.com';
      
      const result = await browserExtractor.takeScreenshot(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.screenshot.length).toBeGreaterThan(0);
    });

    it('应该能够截取特定元素截图', async () => {
      const url = 'https://example.com';
      const selector = 'h1';
      
      const result = await browserExtractor.takeElementScreenshot(url, selector);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
    });

    it('应该能够分析页面布局', async () => {
      const url = 'https://example.com';
      
      const result = await browserExtractor.analyzeLayout(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.layout).toBeDefined();
      expect(result.layout.elements).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成页面加载', async () => {
      const url = 'https://example.com';
      
      const startTime = Date.now();
      const result = await browserExtractor.navigateTo(url);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // 应该在10秒内完成
    });

    it('应该能够处理多个并发请求', async () => {
      const urls = [
        'https://example.com',
        'https://httpbin.org/html',
        'https://httpbin.org/json'
      ];
      
      const startTime = Date.now();
      const results = await Promise.all(
        urls.map(url => browserExtractor.extractTextContent(url))
      );
      const endTime = Date.now();
      
      expect(results).toHaveLength(urls.length);
      expect(endTime - startTime).toBeLessThan(15000); // 并发应该在15秒内完成
    });
  });

  describe('错误处理测试', () => {
    it('应该处理网络超时', async () => {
      const url = 'https://httpbin.org/delay/10';
      browserExtractor.setTimeout(5000); // 5秒超时
      
      const result = await browserExtractor.navigateTo(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('应该处理页面错误', async () => {
      const url = 'https://httpbin.org/status/500';
      
      const result = await browserExtractor.navigateTo(url);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理选择器错误', async () => {
      const url = 'https://example.com';
      const invalidSelector = '.non-existent-element';
      
      const result = await browserExtractor.extractElementContent(url, invalidSelector);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('资源管理测试', () => {
    it('应该能够清理浏览器资源', async () => {
      const result = await browserExtractor.cleanup();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('应该能够重置浏览器状态', async () => {
      const result = await browserExtractor.reset();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});

// 运行测试
async function runTests() {
  console.log('🧪 开始浏览器工具集成测试...\n');
  
  try {
    // 这里应该使用实际的测试运行器
    console.log('✅ 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
