// fetchers/enhanced-hybrid-extractor.mjs
// 增强的混合提取器：集成大模型验证

import { HybridExtractor } from './hybrid-extractor.mjs';
import { LLMValidator } from './llm-validator.mjs';

// 增强配置
const ENHANCED_CONFIG = {
  // 验证阈值
  validationThresholds: {
    high: 0.8,      // 高置信度，直接使用
    medium: 0.6,    // 中等置信度，需要验证
    low: 0.4        // 低置信度，需要深度验证
  },
  
  // 验证策略
  validationStrategies: {
    'aggressive': {
      validateAll: true,
      similarityCheck: true,
      categoryValidation: true
    },
    'balanced': {
      validateAll: false,
      similarityCheck: true,
      categoryValidation: true
    },
    'conservative': {
      validateAll: false,
      similarityCheck: false,
      categoryValidation: false
    }
  },
  
  // 去重配置
  deduplication: {
    similarityThreshold: 0.8,
    enableSemanticDedup: true,
    enableExactDedup: true
  }
};

class EnhancedHybridExtractor extends HybridExtractor {
  constructor() {
    super();
    this.llmValidator = new LLMValidator();
    this.validationStrategy = 'balanced';
    this.enhancedStats = {
      ...this.stats,
      validation: { total: 0, success: 0, failure: 0, totalTime: 0 },
      deduplication: { total: 0, duplicates: 0, unique: 0 }
    };
  }

  // 设置验证策略
  setValidationStrategy(strategy) {
    if (ENHANCED_CONFIG.validationStrategies[strategy]) {
      this.validationStrategy = strategy;
      console.log(`📝 设置验证策略: ${strategy}`);
    } else {
      throw new Error(`未知的验证策略: ${strategy}`);
    }
  }

  // 验证提取结果
  async validateResult(result, content, sourceInfo = {}) {
    if (!result || !result.result) {
      return result;
    }

    const startTime = Date.now();
    
    try {
      const strategy = ENHANCED_CONFIG.validationStrategies[this.validationStrategy];
      const validationResults = {};
      
      // 验证prompts
      if (result.result.prompts && result.result.prompts.length > 0) {
        console.log(`🔍 验证 ${result.result.prompts.length} 个prompt...`);
        
        const promptValidationResults = await this.llmValidator.validateBatch(
          result.result.prompts.map(p => p.text || p)
        );
        
        // 过滤低质量prompt
        const originalPrompts = result.result.prompts;
        const validPrompts = [];
        for (let i = 0; i < originalPrompts.length; i++) {
          const prompt = originalPrompts[i];
          const validation = promptValidationResults[i];
          
          if (validation && validation.isValid && validation.confidence > 0.6) {
            validPrompts.push({
              ...prompt,
              validation: validation,
              enhancedConfidence: validation.confidence
            });
          }
        }
        
        result.result.prompts = validPrompts;
        validationResults.prompts = {
          total: originalPrompts.length,
          valid: validPrompts.length,
          invalid: originalPrompts.length - validPrompts.length
        };
      }
      
      // 验证效果描述
      if (result.result.effects && result.result.effects.length > 0 && strategy.categoryValidation) {
        console.log(`🔍 验证 ${result.result.effects.length} 个效果描述...`);
        
        const effectValidationResults = [];
        for (const effect of result.result.effects) {
          if (result.result.prompts && result.result.prompts.length > 0) {
            const validation = await this.llmValidator.validateEffect(
              result.result.prompts[0].text || result.result.prompts[0],
              effect.text || effect
            );
            effectValidationResults.push(validation);
          }
        }
        
        validationResults.effects = effectValidationResults;
      }
      
      // 验证分类
      if (result.result.category && strategy.categoryValidation) {
        console.log(`🔍 验证分类: ${result.result.category}`);
        
        const categoryValidation = await this.llmValidator.validateCategory(
          result.result.prompts ? result.result.prompts[0].text : '',
          content,
          result.result.category
        );
        
        if (categoryValidation.suggestedCategory && categoryValidation.suggestedCategory !== result.result.category) {
          console.log(`📝 建议分类调整: ${result.result.category} -> ${categoryValidation.suggestedCategory}`);
          result.result.category = categoryValidation.suggestedCategory;
        }
        
        validationResults.category = categoryValidation;
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新统计信息
      this.enhancedStats.validation.total++;
      this.enhancedStats.validation.success++;
      this.enhancedStats.validation.totalTime += duration;
      
      result.validation = validationResults;
      result.enhancedConfidence = this.calculateEnhancedConfidence(result);
      
      return result;
      
    } catch (error) {
      const endTime = Date.now();
      
      // 更新统计信息
      this.enhancedStats.validation.total++;
      this.enhancedStats.validation.failure++;
      this.enhancedStats.validation.totalTime += (endTime - startTime);
      
      console.error('❌ 验证失败:', error);
      return result;
    }
  }

  // 计算增强置信度
  calculateEnhancedConfidence(result) {
    let confidence = result.confidence || 0.5;
    
    // 基于验证结果调整置信度
    if (result.validation) {
      if (result.validation.prompts) {
        const validRate = result.validation.prompts.valid / result.validation.prompts.total;
        confidence = confidence * 0.7 + validRate * 0.3;
      }
      
      if (result.validation.category && result.validation.category.isCorrect) {
        confidence += 0.1;
      }
    }
    
    return Math.min(confidence, 1.0);
  }

  // 去重处理
  async deduplicateResults(results) {
    if (!ENHANCED_CONFIG.deduplication.enableSemanticDedup) {
      return results;
    }

    console.log(`🔄 开始去重处理 ${results.length} 个结果...`);
    
    const startTime = Date.now();
    const uniqueResults = [];
    const seenPrompts = new Set();
    
    for (const result of results) {
      if (!result.result || !result.result.prompts || result.result.prompts.length === 0) {
        continue;
      }
      
      const mainPrompt = result.result.prompts[0].text || result.result.prompts[0];
      
      // 精确去重
      if (ENHANCED_CONFIG.deduplication.enableExactDedup) {
        const normalizedPrompt = mainPrompt.toLowerCase().trim();
        if (seenPrompts.has(normalizedPrompt)) {
          console.log(`📝 发现精确重复: ${mainPrompt.substring(0, 50)}...`);
          this.enhancedStats.deduplication.duplicates++;
          continue;
        }
        seenPrompts.add(normalizedPrompt);
      }
      
      // 语义去重
      let isDuplicate = false;
      for (const uniqueResult of uniqueResults) {
        if (uniqueResult.result && uniqueResult.result.prompts && uniqueResult.result.prompts.length > 0) {
          const uniquePrompt = uniqueResult.result.prompts[0].text || uniqueResult.result.prompts[0];
          
          try {
            const similarity = await this.llmValidator.checkSimilarity(mainPrompt, uniquePrompt);
            
            if (similarity.similarity > ENHANCED_CONFIG.deduplication.similarityThreshold) {
              console.log(`📝 发现语义重复: ${mainPrompt.substring(0, 50)}... (相似度: ${similarity.similarity.toFixed(2)})`);
              isDuplicate = true;
              this.enhancedStats.deduplication.duplicates++;
              break;
            }
          } catch (error) {
            console.error('❌ 相似度检查失败:', error);
          }
        }
      }
      
      if (!isDuplicate) {
        uniqueResults.push(result);
        this.enhancedStats.deduplication.unique++;
      }
    }
    
    const endTime = Date.now();
    this.enhancedStats.deduplication.total = results.length;
    
    console.log(`✅ 去重完成: ${uniqueResults.length}/${results.length} 个唯一结果 (${this.enhancedStats.deduplication.duplicates} 个重复)`);
    
    return uniqueResults;
  }

  // 增强的智能提取
  async extractIntelligentlyEnhanced(content, sourceInfo = {}) {
    console.log('🧠 开始增强智能提取...');
    
    // 使用基础混合提取器
    const baseResult = await this.extractIntelligently(content, sourceInfo);
    
    if (!baseResult.result) {
      return baseResult;
    }
    
    // 验证结果
    const validatedResult = await this.validateResult(baseResult, content, sourceInfo);
    
    // 计算最终置信度
    const finalConfidence = this.calculateEnhancedConfidence(validatedResult);
    
    return {
      ...validatedResult,
      enhancedConfidence: finalConfidence,
      validationStrategy: this.validationStrategy,
      enhancedAt: new Date().toISOString()
    };
  }

  // 批量增强提取
  async extractMultipleIntelligentlyEnhanced(sources, concurrency = 3) {
    console.log(`🚀 开始批量增强智能提取，并发数: ${concurrency}`);
    
    // 使用基础批量提取
    const baseResults = await this.extractMultipleIntelligently(sources, concurrency);
    
    // 验证所有结果
    const validatedResults = [];
    for (const result of baseResults) {
      if (result.result) {
        const validatedResult = await this.validateResult(result, result.content || '', result.sourceInfo || {});
        validatedResults.push(validatedResult);
      } else {
        validatedResults.push(result);
      }
    }
    
    // 去重处理
    const uniqueResults = await this.deduplicateResults(validatedResults);
    
    console.log(`✅ 批量增强提取完成，成功 ${uniqueResults.length}/${sources.length} 个`);
    
    return uniqueResults;
  }

  // 获取增强统计信息
  getEnhancedStats() {
    const baseStats = this.getStats();
    const validationStats = this.enhancedStats.validation;
    const deduplicationStats = this.enhancedStats.deduplication;
    
    return {
      ...baseStats,
      validation: {
        ...validationStats,
        averageTime: validationStats.total > 0 ? validationStats.totalTime / validationStats.total : 0,
        successRate: validationStats.total > 0 ? validationStats.success / validationStats.total : 0
      },
      deduplication: {
        ...deduplicationStats,
        duplicateRate: deduplicationStats.total > 0 ? deduplicationStats.duplicates / deduplicationStats.total : 0,
        uniqueRate: deduplicationStats.total > 0 ? deduplicationStats.unique / deduplicationStats.total : 0
      }
    };
  }

  // 清理资源
  async cleanup() {
    console.log('🧹 清理增强混合提取器资源...');
    
    try {
      // 清理基础提取器
      await super.cleanup();
      
      // 清理大模型验证器
      if (this.llmValidator) {
        await this.llmValidator.cleanup();
      }
      
      console.log('✅ 增强混合提取器资源清理完成');
    } catch (error) {
      console.error('❌ 资源清理失败:', error);
    }
  }
}

// 导出主要功能
export { EnhancedHybridExtractor };

// 创建全局实例
const enhancedHybridExtractor = new EnhancedHybridExtractor();

// 导出便捷函数
export async function extractIntelligentlyEnhanced(content, sourceInfo = {}) {
  return await enhancedHybridExtractor.extractIntelligentlyEnhanced(content, sourceInfo);
}

export async function extractMultipleIntelligentlyEnhanced(sources, concurrency = 3) {
  return await enhancedHybridExtractor.extractMultipleIntelligentlyEnhanced(sources, concurrency);
}

export function getEnhancedExtractionStats() {
  return enhancedHybridExtractor.getEnhancedStats();
}

export function setValidationStrategy(strategy) {
  return enhancedHybridExtractor.setValidationStrategy(strategy);
}
