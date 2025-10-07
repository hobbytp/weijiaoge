// fetchers/content-fetcher.mjs
import { JSDOM } from 'jsdom';
import { DOMAIN_PLUGINS } from './domain-plugins.mjs';

// 轻量UA，避免部分站点拒绝请求
const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
};

// 文本标准化函数
function normalizeText(s = '') {
  return s.replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[ \u3000]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 基础HTML获取函数
async function fetchHtml(url, timeoutMs = 20000) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { 
      headers: DEFAULT_HEADERS,
      signal: ac.signal 
    });
    clearTimeout(to);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.text();
  } catch (err) {
    clearTimeout(to);
    throw err;
  }
}

// 通用内容提取器
class ContentExtractor {
  constructor() {
    this.plugins = new Map();
    this.registerDefaultPlugins();
  }

  // 注册域名特定的插件
  registerPlugin(domain, extractor) {
    this.plugins.set(domain, extractor);
  }

  // 注册默认插件
  registerDefaultPlugins() {
    // 注册所有域名插件
    for (const [domain, plugin] of Object.entries(DOMAIN_PLUGINS)) {
      this.registerPlugin(domain, plugin);
    }
  }


  // 主提取方法
  async extractContent(url) {
    try {
      console.log(`🔍 获取内容: ${url}`);
      
      // 获取HTML
      const html = await fetchHtml(url);
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // 确定域名
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      // 查找匹配的插件
      let extractor = this.plugins.get(domain);
      if (!extractor) {
        extractor = this.plugins.get('*'); // 使用通用插件
      }

      // 提取内容
      const result = extractor(document, url);
      
      if (result) {
        console.log(`✅ 成功提取内容: ${result.title}`);
        return {
          ...result,
          content: normalizeText(result.content),
          url,
          domain,
          extractedAt: new Date().toISOString()
        };
      } else {
        console.log(`⚠️ 无法提取内容: ${url}`);
        return null;
      }

    } catch (error) {
      console.error(`❌ 获取内容失败: ${url}`, error.message);
      return null;
    }
  }

  // 批量提取内容
  async extractMultiple(urls, concurrency = 3) {
    const results = [];
    
    // 分批处理，避免并发过多
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.extractContent(url))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
      
      // 避免请求过于频繁
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

// 创建全局实例
const contentExtractor = new ContentExtractor();

// 导出主要功能
export { contentExtractor, ContentExtractor, fetchHtml, normalizeText };

// 便捷函数
export async function extractContent(url) {
  return await contentExtractor.extractContent(url);
}

export async function extractMultiple(urls, concurrency = 3) {
  return await contentExtractor.extractMultiple(urls, concurrency);
}
