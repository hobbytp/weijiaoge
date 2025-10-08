import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * 轻量级缓存管理器
 * 专门为nano banana cases数据设计，以文本prompt为主，数据量小
 */
class SimpleCacheManager {
  constructor() {
    this.cacheFile = '.cache/page-cache.json';
    this.statsFile = '.cache/stats.json';
    this.cache = new Map();
    this.stats = {
      totalPages: 0,
      processedPages: 0,
      skippedPages: 0,
      savedAPI: 0,
      lastUpdate: null
    };
    
    this.initializeCache();
  }
  
  /**
   * 初始化缓存
   */
  initializeCache() {
    try {
      // 确保缓存目录存在
      if (!fs.existsSync('.cache')) {
        fs.mkdirSync('.cache', { recursive: true });
        console.log('📁 创建缓存目录: .cache');
      }
      
      // 加载现有缓存
      this.loadCache();
      
      console.log('✅ 轻量级缓存管理器初始化完成');
    } catch (error) {
      console.error('❌ 缓存初始化失败:', error);
    }
  }
  
  /**
   * 加载缓存数据
   */
  loadCache() {
    try {
      // 加载页面缓存
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        this.cache = new Map(Object.entries(data));
        console.log(`📊 加载页面缓存: ${this.cache.size} 个页面`);
      }
      
      // 加载统计信息
      if (fs.existsSync(this.statsFile)) {
        const stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
        this.stats = { ...this.stats, ...stats };
        console.log(`📈 加载统计信息: 总页面 ${this.stats.totalPages}, 已处理 ${this.stats.processedPages}, 跳过 ${this.stats.skippedPages}`);
      }
    } catch (error) {
      console.error('❌ 加载缓存失败:', error);
      // 如果加载失败，使用默认值
      this.cache = new Map();
      this.stats = {
        totalPages: 0,
        processedPages: 0,
        skippedPages: 0,
        savedAPI: 0,
        lastUpdate: null
      };
    }
  }
  
  /**
   * 保存缓存数据
   */
  saveCache() {
    try {
      // 保存页面缓存
      const cacheData = Object.fromEntries(this.cache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
      
      // 保存统计信息
      this.stats.lastUpdate = new Date().toISOString();
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
      
      console.log('💾 缓存数据已保存');
    } catch (error) {
      console.error('❌ 保存缓存失败:', error);
    }
  }
  
  /**
   * 检查页面是否需要处理
   * @param {string} url - 页面URL
   * @param {string} content - 页面内容
   * @param {number} caseCount - case数量
   * @returns {Object} 处理决策
   */
  shouldProcess(url, content, caseCount = 0) {
    const cached = this.cache.get(url);
    
    if (!cached) {
      this.stats.totalPages++;
      return { shouldProcess: true, reason: 'new_page' };
    }
    
    // 简单检测：内容哈希 + case数量
    const contentHash = this.hashContent(content);
    const hasContentChanged = cached.contentHash !== contentHash;
    const hasCaseCountChanged = cached.caseCount !== caseCount;
    
    if (hasContentChanged || hasCaseCountChanged) {
      this.stats.processedPages++;
      return { shouldProcess: true, reason: 'content_changed' };
    }
    
    this.stats.skippedPages++;
    this.stats.savedAPI++;
    return { shouldProcess: false, reason: 'no_change' };
  }
  
  /**
   * 更新页面缓存
   * @param {string} url - 页面URL
   * @param {string} content - 页面内容
   * @param {number} caseCount - case数量
   */
  updateCache(url, content, caseCount) {
    this.cache.set(url, {
      contentHash: this.hashContent(content),
      caseCount: caseCount,
      lastProcessed: Date.now()
    });
    
    // 检查缓存大小，如果超过限制则清理
    this.checkCacheSize();
  }
  
  /**
   * 检查缓存大小
   */
  checkCacheSize() {
    const maxCacheSize = 500; // 最大缓存500个页面
    if (this.cache.size > maxCacheSize) {
      console.log(`🧹 缓存大小超限 (${this.cache.size} > ${maxCacheSize})，开始清理...`);
      this.cleanupOldCache();
    }
  }
  
  /**
   * 清理旧缓存
   */
  cleanupOldCache() {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastProcessed - b[1].lastProcessed);
    
    // 删除最旧的50%缓存
    const deleteCount = Math.floor(entries.length * 0.5);
    for (let i = 0; i < deleteCount; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    console.log(`🗑️ 清理了 ${deleteCount} 个旧缓存条目`);
  }
  
  /**
   * 简单哈希函数
   * @param {string} content - 内容
   * @returns {string} 哈希值
   */
  hashContent(content) {
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex');
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheFileSize: this.getCacheFileSize()
    };
  }
  
  /**
   * 获取缓存文件大小
   * @returns {number} 文件大小（字节）
   */
  getCacheFileSize() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        return fs.statSync(this.cacheFile).size;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * 清理过期缓存
   * @param {number} maxAge - 最大年龄（毫秒），默认7天
   */
  cleanupExpiredCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.lastProcessed > maxAge) {
        this.cache.delete(url);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 清理过期缓存: ${cleanedCount} 个页面`);
      this.saveCache();
    }
  }
  
  /**
   * 重置缓存
   */
  resetCache() {
    this.cache.clear();
    this.stats = {
      totalPages: 0,
      processedPages: 0,
      skippedPages: 0,
      savedAPI: 0,
      lastUpdate: null
    };
    this.saveCache();
    console.log('🔄 缓存已重置');
  }
}

export { SimpleCacheManager };
