// fetchers/ultimate-extractor.mjs
// 终极提取器：集成所有三个阶段的功能

import { BrowserExtractor } from './browser-extractor.mjs';
import { EnhancedHybridExtractor } from './enhanced-hybrid-extractor.mjs';

// 终极配置
const ULTIMATE_CONFIG = {
  // 提取策略
  strategies: {
    'fast': {
      useBrowser: false,
      useLLM: false,
      useLangExtract: true,
      timeout: 10000
    },
    'balanced': {
      useBrowser: false,
      useLLM: true,
      useLangExtract: true,
      timeout: 30000
    },
    'comprehensive': {
      useBrowser: true,
      useLLM: true,
      useLangExtract: true,
      timeout: 60000
    }
  },
  
  // 内容类型检测
  contentTypes: {
    'static': {
      useBrowser: false,
      useLLM: false,
      useLangExtract: true
    },
    'dynamic': {
      useBrowser: true,
      useLLM: true,
      useLangExtract: true
    },
    'complex': {
      useBrowser: true,
      useLLM: true,
      useLangExtract: true
    }
  },
  
  // 质量阈值
  qualityThresholds: {
    high: 0.8,
    medium: 0.6,
    low: 0.4
  }
};

class UltimateExtractor {
  constructor() {
    this.enhancedExtractor = new EnhancedHybridExtractor();
    this.browserExtractor = new BrowserExtractor();
    this.currentStrategy = 'balanced';
    this.stats = {
      total: 0,
      success: 0,
      failure: 0,
      totalTime: 0,
      strategies: {
        fast: { total: 0, success: 0, failure: 0 },
        balanced: { total: 0, success: 0, failure: 0 },
        comprehensive: { total: 0, success: 0, failure: 0 }
      }
    };
  }

  // 设置提取策略
  setStrategy(strategy) {
    if (ULTIMATE_CONFIG.strategies[strategy]) {
      this.currentStrategy = strategy;
      console.log(`📝 设置提取策略: ${strategy}`);
    } else {
      throw new Error(`未知的提取策略: ${strategy}`);
    }
  }

  // 检测内容类型
  async detectContentType(url) {
    try {
      console.log(`🔍 检测内容类型: ${url}`);
      
      // 检查浏览器提取器是否已初始化
      if (!this.browserExtractor.isInitialized) {
        console.log('⚠️ 浏览器提取器未初始化，使用静态内容检测');
        return 'static';
      }
      
      // 快速检测：尝试获取页面标题
      const quickResult = await this.browserExtractor.navigateTo(url, { 
        waitForLoad: false,
        timeout: 5000 
      });
      
      if (!quickResult.success) {
        return 'static'; // 如果无法访问，默认为静态
      }
      
      // 检测是否有JavaScript内容
      const hasJS = await this.browserExtractor.executeScript(url, `
        return {
          hasReact: !!window.React,
          hasVue: !!window.Vue,
          hasAngular: !!window.ng,
          hasJQuery: !!window.jQuery,
          hasDynamicContent: document.querySelectorAll('[data-dynamic], .lazy-load, .async-content').length > 0
        };
      `);
      
      if (hasJS.success && hasJS.result) {
        const { hasReact, hasVue, hasAngular, hasJQuery, hasDynamicContent } = hasJS.result;
        
        if (hasReact || hasVue || hasAngular || hasJQuery || hasDynamicContent) {
          return 'dynamic';
        }
      }
      
      return 'static';
      
    } catch (error) {
      console.error(`❌ 内容类型检测失败: ${url}`, error);
      return 'static';
    }
  }

  // 智能提取
  async extractIntelligently(url, sourceInfo = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 开始智能提取: ${url}`);
      
      // 检测内容类型
      const contentType = await this.detectContentType(url);
      console.log(`📊 检测到内容类型: ${contentType}`);
      
      // 选择提取策略
      const strategy = this.selectStrategy(contentType);
      console.log(`📝 选择提取策略: ${strategy}`);
      
      let result = null;
      
      // 根据策略执行提取
      if (strategy === 'fast') {
        try {
          result = await this.extractFast(url, sourceInfo);
        } catch (error) {
          console.log('⚠️ 快速提取失败，降级到平衡策略');
          result = await this.extractBalanced(url, sourceInfo);
        }
      } else if (strategy === 'balanced') {
        result = await this.extractBalanced(url, sourceInfo);
      } else if (strategy === 'comprehensive') {
        result = await this.extractComprehensive(url, sourceInfo);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新统计信息
      this.stats.total++;
      this.stats.success++;
      this.stats.totalTime += duration;
      this.stats.strategies[strategy].total++;
      this.stats.strategies[strategy].success++;
      
      return {
        ...result,
        strategy,
        contentType,
        duration,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      // 更新统计信息
      this.stats.total++;
      this.stats.failure++;
      this.stats.totalTime += (endTime - startTime);
      this.stats.strategies[this.currentStrategy].total++;
      this.stats.strategies[this.currentStrategy].failure++;
      
      console.error(`❌ 智能提取失败: ${url}`, error);
      
      return {
        success: false,
        error: error.message,
        strategy: this.currentStrategy,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 快速提取
  async extractFast(url, sourceInfo = {}) {
    console.log(`⚡ 执行快速提取: ${url}`);
    
    try {
      // 检查浏览器提取器是否已初始化
      if (!this.browserExtractor.isInitialized) {
        console.log('⚠️ 浏览器提取器未初始化，跳过快速提取');
        throw new Error('浏览器提取器未初始化');
      }
      
      // 使用浏览器快速获取内容
      const browserResult = await this.browserExtractor.extractTextContent(url, {
        waitForLoad: false,
        timeout: 10000
      });
      
      if (!browserResult.success) {
        throw new Error(`浏览器提取失败: ${browserResult.error}`);
      }
      
      // 使用增强提取器处理内容
      const enhancedResult = await this.enhancedExtractor.extractIntelligentlyEnhanced(
        browserResult.content, 
        { ...sourceInfo, url }
      );
      
      return {
        success: true,
        result: enhancedResult.result,
        confidence: enhancedResult.enhancedConfidence || enhancedResult.confidence,
        extractor: enhancedResult.extractor,
        method: 'fast',
        contentLength: browserResult.contentLength
      };
      
    } catch (error) {
      throw new Error(`快速提取失败: ${error.message}`);
    }
  }

  // 平衡提取
  async extractBalanced(url, sourceInfo = {}) {
    console.log(`⚖️ 执行平衡提取: ${url}`);
    
    try {
      // 使用浏览器获取内容
      const browserResult = await this.browserExtractor.extractTextContent(url, {
        waitForLoad: true,
        timeout: 30000
      });
      
      if (!browserResult.success) {
        throw new Error(`浏览器提取失败: ${browserResult.error}`);
      }
      
      // 使用增强提取器处理内容
      const enhancedResult = await this.enhancedExtractor.extractIntelligentlyEnhanced(
        browserResult.content, 
        { ...sourceInfo, url }
      );
      
      return {
        success: true,
        result: enhancedResult.result,
        confidence: enhancedResult.enhancedConfidence || enhancedResult.confidence,
        extractor: enhancedResult.extractor,
        method: 'balanced',
        contentLength: browserResult.contentLength,
        validation: enhancedResult.validation
      };
      
    } catch (error) {
      throw new Error(`平衡提取失败: ${error.message}`);
    }
  }

  // 全面提取
  async extractComprehensive(url, sourceInfo = {}) {
    console.log(`🔍 执行全面提取: ${url}`);
    
    try {
      // 使用浏览器获取完整内容
      const browserResult = await this.browserExtractor.extractTextContent(url, {
        waitForLoad: true,
        timeout: 60000
      });
      
      if (!browserResult.success) {
        throw new Error(`浏览器提取失败: ${browserResult.error}`);
      }
      
      // 获取页面布局信息
      const layoutResult = await this.browserExtractor.analyzeLayout(url);
      
      // 使用增强提取器处理内容
      const enhancedResult = await this.enhancedExtractor.extractIntelligentlyEnhanced(
        browserResult.content, 
        { ...sourceInfo, url, layout: layoutResult.layout }
      );
      
      // 截取页面截图
      const screenshotResult = await this.browserExtractor.takeScreenshot(url);
      
      return {
        success: true,
        result: enhancedResult.result,
        confidence: enhancedResult.enhancedConfidence || enhancedResult.confidence,
        extractor: enhancedResult.extractor,
        method: 'comprehensive',
        contentLength: browserResult.contentLength,
        validation: enhancedResult.validation,
        layout: layoutResult.layout,
        screenshot: screenshotResult.screenshot,
        isDynamic: browserResult.isDynamic
      };
      
    } catch (error) {
      throw new Error(`全面提取失败: ${error.message}`);
    }
  }

  // 选择提取策略
  selectStrategy(contentType) {
    const strategy = ULTIMATE_CONFIG.strategies[this.currentStrategy];
    
    if (contentType === 'static' && strategy.useBrowser === false) {
      return 'fast';
    } else if (contentType === 'dynamic' && strategy.useBrowser === true) {
      return 'comprehensive';
    } else {
      return 'balanced';
    }
  }

  // 批量智能提取
  async extractMultipleIntelligently(urls, concurrency = 3) {
    console.log(`🚀 开始批量智能提取，并发数: ${concurrency}`);
    
    const results = [];
    
    // 分批处理
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.extractIntelligently(url))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
      
      // 避免请求过于频繁
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`✅ 批量提取完成，成功 ${results.length}/${urls.length} 个`);
    return results;
  }

  // 获取统计信息
  getStats() {
    const baseStats = this.stats;
    const enhancedStats = this.enhancedExtractor.getEnhancedStats();
    const browserStats = this.browserExtractor.getStats();
    
    return {
      ...baseStats,
      averageTime: baseStats.total > 0 ? baseStats.totalTime / baseStats.total : 0,
      successRate: baseStats.total > 0 ? baseStats.success / baseStats.total : 0,
      enhanced: enhancedStats,
      browser: browserStats
    };
  }

  // 清理资源
  async cleanup() {
    console.log('🧹 清理终极提取器资源...');
    
    try {
      // 清理增强提取器
      await this.enhancedExtractor.cleanup();
      
      // 清理浏览器提取器
      await this.browserExtractor.cleanup();
      
      console.log('✅ 终极提取器资源清理完成');
    } catch (error) {
      console.error('❌ 资源清理失败:', error);
    }
  }
}

// 导出主要功能
export { UltimateExtractor };

// 创建全局实例
const ultimateExtractor = new UltimateExtractor();

// 导出便捷函数
export async function extractIntelligently(url, sourceInfo = {}) {
  return await ultimateExtractor.extractIntelligently(url, sourceInfo);
}

export async function extractMultipleIntelligently(urls, concurrency = 3) {
  return await ultimateExtractor.extractMultipleIntelligently(urls, concurrency);
}

export function getUltimateStats() {
  return ultimateExtractor.getStats();
}

export function setStrategy(strategy) {
  return ultimateExtractor.setStrategy(strategy);
}
