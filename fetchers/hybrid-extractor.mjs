// fetchers/hybrid-extractor.mjs
// 混合提取器：结合传统算法和LangExtract

import { extractCaseFromContent, extractMultipleCasesFromArticle } from './case-extractor.mjs';
import { extractEnhancedCases } from './enhanced-case-extractor.mjs';
import { LangExtractExtractor } from './langextract-extractor.mjs';

// 提取器配置
const EXTRACTOR_CONFIG = {
  // 置信度阈值
  confidenceThresholds: {
    traditional: 0.6,    // 传统算法置信度阈值
    enhanced: 0.7,       // 增强算法置信度阈值
    langextract: 0.8     // LangExtract置信度阈值
  },
  
  // 提取器优先级
  extractorPriority: [
    'traditional',
    'enhanced', 
    'langextract'
  ],
  
  // 超时设置
  timeouts: {
    traditional: 5000,    // 5秒
    enhanced: 10000,      // 10秒
    langextract: 15000    // 15秒
  }
};

class HybridExtractor {
  constructor() {
    this.traditionalExtractor = null;
    this.enhancedExtractor = null;
    this.langextractExtractor = new LangExtractExtractor();
    this.stats = {
      traditional: { success: 0, failure: 0, totalTime: 0 },
      enhanced: { success: 0, failure: 0, totalTime: 0 },
      langextract: { success: 0, failure: 0, totalTime: 0 }
    };
  }

  // 设置传统提取器
  setTraditionalExtractor(extractor) {
    this.traditionalExtractor = extractor;
  }

  // 设置增强提取器
  setEnhancedExtractor(extractor) {
    this.enhancedExtractor = extractor;
  }

  // 执行提取器
  async executeExtractor(extractorName, content, sourceInfo = {}) {
    const startTime = Date.now();
    
    try {
      let result = null;
      
      switch (extractorName) {
        case 'traditional':
          if (this.traditionalExtractor) {
            result = await this.traditionalExtractor.extractCaseFromContent(sourceInfo);
          } else {
            result = extractCaseFromContent(sourceInfo);
          }
          break;
          
        case 'enhanced':
          if (this.enhancedExtractor) {
            result = await this.enhancedExtractor.extractEnhancedCases(content, sourceInfo);
          } else {
            result = extractEnhancedCases(content, sourceInfo);
          }
          break;
          
        case 'langextract':
          result = await this.langextractExtractor.extractAndCategorize(content);
          break;
          
        default:
          throw new Error(`未知的提取器: ${extractorName}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新统计信息
      this.stats[extractorName].success++;
      this.stats[extractorName].totalTime += duration;
      
      return {
        result,
        extractor: extractorName,
        duration,
        success: true
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新统计信息
      this.stats[extractorName].failure++;
      this.stats[extractorName].totalTime += duration;
      
      return {
        result: null,
        extractor: extractorName,
        duration,
        success: false,
        error: error.message
      };
    }
  }

  // 计算置信度
  calculateConfidence(result, extractorName) {
    if (!result) return 0;
    
    switch (extractorName) {
      case 'traditional':
        // 传统算法基于prompt数量和长度
        const promptCount = result.prompts ? result.prompts.length : 0;
        const effectCount = result.effects ? result.effects.length : 0;
        const imageCount = result.images ? result.images.length : 0;
        
        let confidence = 0.3; // 基础置信度
        if (promptCount > 0) confidence += 0.3;
        if (effectCount > 0) confidence += 0.2;
        if (imageCount > 0) confidence += 0.2;
        
        return Math.min(confidence, 1.0);
        
      case 'enhanced':
        // 增强算法使用内置置信度
        return result.confidence || 0.5;
        
      case 'langextract':
        // LangExtract使用平均置信度
        if (result.prompts && result.prompts.length > 0) {
          const avgConfidence = result.prompts.reduce((sum, p) => sum + (p.confidence || 0), 0) / result.prompts.length;
          return avgConfidence;
        }
        return 0.5;
        
      default:
        return 0.5;
    }
  }

  // 智能提取
  async extractIntelligently(content, sourceInfo = {}) {
    console.log('🔍 开始智能提取...');
    
    const results = [];
    const errors = [];
    
    // 按优先级尝试各个提取器
    for (const extractorName of EXTRACTOR_CONFIG.extractorPriority) {
      console.log(`📝 尝试 ${extractorName} 提取器...`);
      
      try {
        // 设置超时
        const timeout = EXTRACTOR_CONFIG.timeouts[extractorName];
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('提取器超时')), timeout)
        );
        
        const extractPromise = this.executeExtractor(extractorName, content, sourceInfo);
        const result = await Promise.race([extractPromise, timeoutPromise]);
        
        if (result.success && result.result) {
          const confidence = this.calculateConfidence(result.result, extractorName);
          
          results.push({
            ...result,
            confidence
          });
          
          console.log(`✅ ${extractorName} 提取成功，置信度: ${confidence.toFixed(2)}`);
          
          // 如果置信度足够高，直接返回
          if (confidence >= EXTRACTOR_CONFIG.confidenceThresholds[extractorName]) {
            console.log(`🎯 ${extractorName} 置信度足够高，直接返回结果`);
            return {
              result: result.result,
              extractor: extractorName,
              confidence,
              duration: result.duration,
              fallback: false
            };
          }
        } else {
          errors.push({
            extractor: extractorName,
            error: result.error || '提取失败'
          });
          console.log(`❌ ${extractorName} 提取失败: ${result.error || '未知错误'}`);
        }
        
      } catch (error) {
        errors.push({
          extractor: extractorName,
          error: error.message
        });
        console.log(`❌ ${extractorName} 提取异常: ${error.message}`);
      }
    }
    
    // 选择最佳结果
    if (results.length > 0) {
      const bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      console.log(`🏆 选择最佳结果: ${bestResult.extractor}，置信度: ${bestResult.confidence.toFixed(2)}`);
      
      return {
        result: bestResult.result,
        extractor: bestResult.extractor,
        confidence: bestResult.confidence,
        duration: bestResult.duration,
        fallback: true,
        alternatives: results.filter(r => r !== bestResult)
      };
    }
    
    // 所有提取器都失败
    console.log('❌ 所有提取器都失败');
    return {
      result: null,
      extractor: 'none',
      confidence: 0,
      duration: 0,
      fallback: false,
      errors
    };
  }

  // 批量智能提取
  async extractMultipleIntelligently(sources, concurrency = 3) {
    console.log(`🚀 开始批量智能提取，并发数: ${concurrency}`);
    
    const results = [];
    
    // 分批处理
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(source => this.extractIntelligently(source.content, source))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
      
      // 避免请求过于频繁
      if (i + concurrency < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ 批量提取完成，成功 ${results.length}/${sources.length} 个`);
    return results;
  }

  // 获取统计信息
  getStats() {
    const totalStats = {
      total: 0,
      success: 0,
      failure: 0,
      totalTime: 0,
      averageTime: 0,
      extractors: {}
    };
    
    for (const [extractorName, stats] of Object.entries(this.stats)) {
      const extractorTotal = stats.success + stats.failure;
      const extractorAvgTime = extractorTotal > 0 ? stats.totalTime / extractorTotal : 0;
      
      totalStats.total += extractorTotal;
      totalStats.success += stats.success;
      totalStats.failure += stats.failure;
      totalStats.totalTime += stats.totalTime;
      
      totalStats.extractors[extractorName] = {
        ...stats,
        total: extractorTotal,
        averageTime: extractorAvgTime,
        successRate: extractorTotal > 0 ? stats.success / extractorTotal : 0
      };
    }
    
    totalStats.averageTime = totalStats.total > 0 ? totalStats.totalTime / totalStats.total : 0;
    
    return totalStats;
  }

  // 重置统计信息
  resetStats() {
    this.stats = {
      traditional: { success: 0, failure: 0, totalTime: 0 },
      enhanced: { success: 0, failure: 0, totalTime: 0 },
      langextract: { success: 0, failure: 0, totalTime: 0 }
    };
  }

  // 清理资源
  async cleanup() {
    console.log('🧹 清理混合提取器资源...');
    
    try {
      if (this.langextractExtractor) {
        await this.langextractExtractor.cleanup();
      }
      
      console.log('✅ 混合提取器资源清理完成');
    } catch (error) {
      console.error('❌ 资源清理失败:', error);
    }
  }
}

// 导出主要功能
export { HybridExtractor };

// 创建全局实例
const hybridExtractor = new HybridExtractor();

// 导出便捷函数
export async function extractIntelligently(content, sourceInfo = {}) {
  return await hybridExtractor.extractIntelligently(content, sourceInfo);
}

export async function extractMultipleIntelligently(sources, concurrency = 3) {
  return await hybridExtractor.extractMultipleIntelligently(sources, concurrency);
}

export function getExtractionStats() {
  return hybridExtractor.getStats();
}

export function resetExtractionStats() {
  return hybridExtractor.resetStats();
}
