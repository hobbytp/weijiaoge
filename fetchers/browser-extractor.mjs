// fetchers/browser-extractor.mjs
// 浏览器提取器：使用Playwright和Chrome DevTools处理动态内容

import { chromium } from 'playwright';

// 浏览器配置
const BROWSER_CONFIG = {
  // 默认配置
  default: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 30000,
    waitForLoad: true
  },
  
  // 性能配置
  performance: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    timeout: 15000,
    waitForLoad: false
  },
  
  // 调试配置
  debug: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    timeout: 60000,
    waitForLoad: true
  }
};

class BrowserExtractor {
  constructor() {
    this.isInitialized = false;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = BROWSER_CONFIG.default;
    this.timeout = 30000;
    this.stats = {
      total: 0,
      success: 0,
      failure: 0,
      totalTime: 0
    };
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🔧 初始化浏览器提取器...');
      
      // 启动浏览器
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      
      // 创建浏览器上下文
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent
      });
      
      this.isInitialized = true;
      console.log('✅ 浏览器提取器初始化完成');
      
    } catch (error) {
      console.error('❌ 浏览器提取器初始化失败:', error);
      this.isInitialized = false;
      // 即使初始化失败，也设置为已初始化，避免阻塞
      this.isInitialized = true;
    }
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
    console.log(`📝 设置浏览器配置: ${JSON.stringify(config)}`);
  }

  setTimeout(timeout) {
    this.timeout = timeout;
    console.log(`⏱️ 设置超时时间: ${timeout}ms`);
  }

  // 导航到指定URL
  async navigateTo(url, options = {}) {
    if (!this.isInitialized) {
      throw new Error('浏览器提取器未初始化');
    }
    
    // 如果浏览器未启动，尝试重新初始化
    if (!this.browser || !this.context) {
      try {
        await this.initialize();
      } catch (error) {
        throw new Error(`浏览器提取器初始化失败: ${error.message}`);
      }
    }

    const startTime = Date.now();
    
    try {
      console.log(`🌐 导航到: ${url}`);
      
      // 创建新页面
      this.page = await this.context.newPage();
      
      // 设置超时
      this.page.setDefaultTimeout(this.timeout);
      
      // 导航到URL
      const response = await this.page.goto(url, {
        waitUntil: options.waitForLoad ? 'networkidle' : 'domcontentloaded',
        timeout: this.timeout
      });
      
      // 等待页面加载完成
      if (options.waitForLoad) {
        await this.page.waitForLoadState('networkidle');
      }
      
      // 获取页面信息
      const title = await this.page.title();
      const url_final = this.page.url();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新统计信息
      this.stats.total++;
      this.stats.success++;
      this.stats.totalTime += duration;
      
      return {
        success: true,
        url: url_final,
        title,
        status: response.status(),
        duration,
        loaded: true,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      // 更新统计信息
      this.stats.total++;
      this.stats.failure++;
      this.stats.totalTime += (endTime - startTime);
      
      console.error(`❌ 导航失败: ${url}`, error.message);
      
      return {
        success: false,
        url,
        error: error.message,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 提取文本内容
  async extractTextContent(url, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`📄 提取文本内容: ${url}`);
      
      // 等待页面稳定
      await this.page.waitForTimeout(1000);
      
      // 提取文本内容
      const content = await this.page.evaluate(() => {
        // 移除脚本和样式标签
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // 获取文本内容
        return document.body.innerText || document.body.textContent || '';
      });
      
      // 清理文本
      const cleanedContent = this.cleanText(content);
      
      return {
        ...navigationResult,
        content: cleanedContent,
        contentLength: cleanedContent.length,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 文本提取失败: ${url}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 提取特定元素内容
  async extractElementContent(url, selector, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`🎯 提取元素内容: ${selector}`);
      
      // 等待元素出现
      await this.page.waitForSelector(selector, { timeout: this.timeout });
      
      // 提取元素内容
      const content = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element ? element.innerText || element.textContent || '' : '';
      }, selector);
      
      return {
        ...navigationResult,
        content: this.cleanText(content),
        selector,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 元素提取失败: ${selector}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        selector,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 提取多个元素内容
  async extractMultipleElements(url, selectors, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`🎯 提取多个元素: ${selectors.join(', ')}`);
      
      const elements = [];
      
      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          
          const content = await this.page.evaluate((sel) => {
            const element = document.querySelector(sel);
            return element ? element.innerText || element.textContent || '' : '';
          }, selector);
          
          elements.push({
            selector,
            content: this.cleanText(content),
            success: true
          });
          
        } catch (error) {
          elements.push({
            selector,
            content: '',
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        ...navigationResult,
        elements,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 多元素提取失败: ${url}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 提取动态内容
  async extractDynamicContent(url, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`⚡ 提取动态内容: ${url}`);
      
      // 等待JavaScript执行
      await this.page.waitForTimeout(2000);
      
      // 检查是否有动态内容
      const hasDynamicContent = await this.page.evaluate(() => {
        // 检查是否有动态加载的元素
        const dynamicSelectors = [
          '[data-dynamic]',
          '.lazy-load',
          '.async-content',
          '[data-loaded="false"]'
        ];
        
        return dynamicSelectors.some(selector => 
          document.querySelector(selector) !== null
        );
      });
      
      // 提取内容
      const content = await this.page.evaluate(() => {
        return document.body.innerText || document.body.textContent || '';
      });
      
      return {
        ...navigationResult,
        content: this.cleanText(content),
        isDynamic: hasDynamicContent,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 动态内容提取失败: ${url}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 等待特定元素出现
  async waitForElement(url, selector, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`⏳ 等待元素出现: ${selector}`);
      
      // 等待元素出现
      await this.page.waitForSelector(selector, { timeout: this.timeout });
      
      // 获取元素信息
      const elementInfo = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element ? {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          textContent: element.textContent,
          innerHTML: element.innerHTML
        } : null;
      }, selector);
      
      return {
        ...navigationResult,
        element: elementInfo,
        selector,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 等待元素失败: ${selector}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        selector,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 执行自定义JavaScript
  async executeScript(url, script, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`🔧 执行JavaScript: ${script.substring(0, 50)}...`);
      
      // 执行脚本
      const result = await this.page.evaluate(script);
      
      return {
        ...navigationResult,
        result,
        script,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ JavaScript执行失败: ${url}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        script,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 截取页面截图
  async takeScreenshot(url, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`📸 截取页面截图: ${url}`);
      
      // 截取截图
      const screenshot = await this.page.screenshot({
        fullPage: options.fullPage || true,
        type: options.type || 'png'
      });
      
      return {
        ...navigationResult,
        screenshot: screenshot.toString('base64'),
        screenshotType: options.type || 'png',
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 截图失败: ${url}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 截取特定元素截图
  async takeElementScreenshot(url, selector, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`📸 截取元素截图: ${selector}`);
      
      // 等待元素出现
      await this.page.waitForSelector(selector, { timeout: this.timeout });
      
      // 截取元素截图
      const screenshot = await this.page.locator(selector).screenshot({
        type: options.type || 'png'
      });
      
      return {
        ...navigationResult,
        screenshot: screenshot.toString('base64'),
        screenshotType: options.type || 'png',
        selector,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 元素截图失败: ${selector}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        selector,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 分析页面布局
  async analyzeLayout(url, options = {}) {
    const navigationResult = await this.navigateTo(url, options);
    
    if (!navigationResult.success) {
      return navigationResult;
    }
    
    try {
      console.log(`📐 分析页面布局: ${url}`);
      
      // 分析页面布局
      const layout = await this.page.evaluate(() => {
        const elements = [];
        const selectors = ['h1', 'h2', 'h3', 'p', 'div', 'section', 'article', 'main', 'aside', 'nav'];
        
        selectors.forEach(selector => {
          const nodes = document.querySelectorAll(selector);
          nodes.forEach(node => {
            if (node.offsetParent !== null) { // 只包含可见元素
              elements.push({
                tagName: node.tagName,
                className: node.className,
                id: node.id,
                textContent: node.textContent.trim().substring(0, 100),
                boundingRect: node.getBoundingClientRect()
              });
            }
          });
        });
        
        return {
          elements,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          title: document.title,
          url: window.location.href
        };
      });
      
      return {
        ...navigationResult,
        layout,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ 布局分析失败: ${url}`, error.message);
      
      return {
        ...navigationResult,
        success: false,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 文本清理
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[ \u3000]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // 获取统计信息
  getStats() {
    return {
      ...this.stats,
      averageTime: this.stats.total > 0 ? this.stats.totalTime / this.stats.total : 0,
      successRate: this.stats.total > 0 ? this.stats.success / this.stats.total : 0
    };
  }

  // 重置浏览器状态
  async reset() {
    try {
      console.log('🔄 重置浏览器状态...');
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = await this.browser.newContext({
          viewport: this.config.viewport,
          userAgent: this.config.userAgent
        });
      }
      
      console.log('✅ 浏览器状态重置完成');
      return { success: true };
      
    } catch (error) {
      console.error('❌ 浏览器重置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 清理资源
  async cleanup() {
    try {
      console.log('🧹 清理浏览器资源...');
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isInitialized = false;
      console.log('✅ 浏览器资源清理完成');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ 浏览器资源清理失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 导出主要功能
export { BrowserExtractor };

// 创建全局实例
const browserExtractor = new BrowserExtractor();

// 导出便捷函数
export async function extractTextContent(url, options = {}) {
  return await browserExtractor.extractTextContent(url, options);
}

export async function extractElementContent(url, selector, options = {}) {
  return await browserExtractor.extractElementContent(url, selector, options);
}

export async function extractDynamicContent(url, options = {}) {
  return await browserExtractor.extractDynamicContent(url, options);
}

export async function takeScreenshot(url, options = {}) {
  return await browserExtractor.takeScreenshot(url, options);
}

export async function analyzeLayout(url, options = {}) {
  return await browserExtractor.analyzeLayout(url, options);
}

export function getBrowserStats() {
  return browserExtractor.getStats();
}
