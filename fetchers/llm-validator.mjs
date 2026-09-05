// fetchers/llm-validator.mjs
// 大模型验证器：使用Gemini和GPT-4o进行智能验证

import { JSDOM } from 'jsdom';

// 验证器配置
const VALIDATOR_CONFIG = {
  // 支持的模型
  models: {
    gemini: {
      name: 'gemini-2.0-flash',
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      maxTokens: 8192,
      temperature: 0.1
    },
    gpt4o: {
      name: 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 4096,
      temperature: 0.1
    }
  },
  
  // 验证模式
  modes: {
    'nano-banana-validation': {
      prompt: '你是一个专门验证nano banana相关prompt的AI助手。请分析给定的prompt，判断其质量、相关性和准确性。',
      criteria: {
        quality: ['详细程度', '具体性', '可执行性'],
        relevance: ['nano banana相关性', '图像处理相关性'],
        accuracy: ['技术准确性', '语法正确性']
      }
    }
  },
  
  // 置信度阈值
  thresholds: {
    high: 0.8,
    medium: 0.6,
    low: 0.4
  }
};

class LLMValidator {
  constructor() {
    this.isInitialized = false;
    this.currentMode = 'nano-banana-validation';
    this.apiKeys = {};
    this.config = VALIDATOR_CONFIG;
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
      console.log('🔧 初始化大模型验证器...');
      
      // 重新获取环境变量（因为模块加载时可能还没有加载.env）
      const geminiKey = process.env.GEMINI_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      // 检查API密钥
      if (geminiKey) {
        this.apiKeys.gemini = geminiKey;
        console.log(`✅ gemini API密钥已配置`);
      } else {
        console.log(`⚠️ gemini API密钥未配置`);
      }
      
      if (openaiKey) {
        this.apiKeys.gpt4o = openaiKey;
        console.log(`✅ gpt4o API密钥已配置`);
      } else {
        console.log(`⚠️ gpt4o API密钥未配置`);
      }
      
      this.isInitialized = true;
      console.log('✅ 大模型验证器初始化完成');
    } catch (error) {
      console.error('❌ 大模型验证器初始化失败:', error);
      this.isInitialized = false;
    }
  }

  setMode(mode) {
    if (this.config.modes[mode]) {
      this.currentMode = mode;
      console.log(`📝 设置验证模式: ${mode}`);
    } else {
      throw new Error(`未知的验证模式: ${mode}`);
    }
  }

  setApiKey(model, apiKey) {
    this.apiKeys[model] = apiKey;
    console.log(`🔑 设置${model} API密钥`);
  }

  getApiKey(model) {
    return this.apiKeys[model];
  }

  // 统一的API调用方法
  async callLLM(model, prompt, content) {
    const modelConfig = this.config.models[model];
    if (!modelConfig) {
      throw new Error(`不支持的模型: ${model}`);
    }

    const apiKey = this.apiKeys[model];
    if (!apiKey) {
      throw new Error(`${model} API密钥未配置`);
    }

    const fullContent = `${prompt}\n\n内容：\n${content}`;
    
    if (model === 'gemini') {
      // Gemini使用Google AI API格式
      const url = `${modelConfig.baseUrl}?key=${apiKey}`;
      
      const requestBody = {
        contents: [{
          parts: [{
            text: fullContent
          }]
        }],
        generationConfig: {
          maxOutputTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`${model} API错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
      
    } else {
      // GPT-4o使用OpenAI API格式
      const url = modelConfig.baseUrl;
      
      const requestBody = {
        model: modelConfig.name,
        messages: [{
          role: 'user',
          content: fullContent
        }],
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`${model} API错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }
  }

  // 智能选择模型
  selectModel() {
    const availableModels = Object.keys(this.apiKeys);
    if (availableModels.length === 0) {
      throw new Error('没有可用的API密钥');
    }
    
    // 优先使用Gemini，然后是GPT-4o
    if (availableModels.includes('gemini')) {
      return 'gemini';
    } else if (availableModels.includes('gpt4o')) {
      return 'gpt4o';
    } else {
      return availableModels[0];
    }
  }

  // 解析AI响应
  parseAIResponse(response) {
    try {
      // 尝试解析JSON格式的响应
      if (response.includes('{') && response.includes('}')) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      // 解析文本格式的响应
      const result = {
        isValid: false,
        confidence: 0.5,
        qualityScore: 0.5,
        reasons: [],
        isNanoBananaRelated: false,
        suggestedCategory: 'general'
      };
      
      // 解析置信度
      const confidenceMatch = response.match(/置信度[：:]\s*([0-9.]+)/i);
      if (confidenceMatch) {
        result.confidence = parseFloat(confidenceMatch[1]);
      }
      
      // 解析质量评分
      const qualityMatch = response.match(/质量评分[：:]\s*([0-9.]+)/i);
      if (qualityMatch) {
        result.qualityScore = parseFloat(qualityMatch[1]);
      }
      
      // 解析有效性
      if (response.includes('有效') || response.includes('valid') || response.includes('高质量')) {
        result.isValid = true;
      }
      
      // 解析nano banana相关性
      if (response.includes('nano banana') || response.includes('相关')) {
        result.isNanoBananaRelated = true;
      }
      
      // 解析原因
      if (response.includes('详细') || response.includes('具体')) {
        result.reasons.push('high-quality');
      }
      if (response.includes('简单') || response.includes('模糊')) {
        result.reasons.push('low-quality');
      }
      
      return result;
      
    } catch (error) {
      console.error('解析AI响应失败:', error);
      return {
        isValid: false,
        confidence: 0.3,
        qualityScore: 0.3,
        reasons: ['parse-error'],
        isNanoBananaRelated: false,
        suggestedCategory: 'general',
        error: error.message
      };
    }
  }

  // 验证prompt质量
  async validatePrompt(prompt) {
    if (!this.isInitialized) {
      throw new Error('大模型验证器未初始化');
    }

    const startTime = Date.now();
    
    try {
      const model = this.selectModel();
      const modeConfig = this.config.modes[this.currentMode];
      
      const validationPrompt = `
        ${modeConfig.prompt}
        
        请分析以下prompt的质量：
        1. 是否与nano banana相关？
        2. 是否足够详细和具体？
        3. 是否具有可执行性？
        
        请以JSON格式返回结果：
        {
          "isValid": true/false,
          "confidence": 0.0-1.0,
          "qualityScore": 0.0-1.0,
          "reasons": ["reason1", "reason2"],
          "isNanoBananaRelated": true/false,
          "suggestedCategory": "category"
        }
      `;
      
      const response = await this.callLLM(model, validationPrompt, prompt);
      
      const result = this.parseAIResponse(response);
      const endTime = Date.now();
      
      // 更新统计信息
      this.stats.total++;
      this.stats.success++;
      this.stats.totalTime += (endTime - startTime);
      
      return {
        ...result,
        model,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      // 更新统计信息
      this.stats.total++;
      this.stats.failure++;
      this.stats.totalTime += (endTime - startTime);
      
      return {
        isValid: false,
        confidence: 0.3,
        qualityScore: 0.3,
        reasons: ['validation-error'],
        isNanoBananaRelated: false,
        suggestedCategory: 'general',
        error: error.message,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 验证效果描述
  async validateEffect(prompt, effect) {
    if (!this.isInitialized) {
      throw new Error('大模型验证器未初始化');
    }

    const startTime = Date.now();
    
    try {
      const model = this.selectModel();
      
      const validationPrompt = `
        请验证以下效果描述是否与prompt匹配：
        
        Prompt: ${prompt}
        效果描述: ${effect}
        
        请分析：
        1. 效果描述是否准确描述了prompt的预期结果？
        2. 两者是否在语义上匹配？
        3. 效果描述是否提供了有用的信息？
        
        请以JSON格式返回结果：
        {
          "isAccurate": true/false,
          "confidence": 0.0-1.0,
          "matchScore": 0.0-1.0,
          "suggestions": ["suggestion1", "suggestion2"]
        }
      `;
      
      const response = await this.callLLM(model, validationPrompt, '');
      
      const result = this.parseAIResponse(response);
      const endTime = Date.now();
      
      return {
        ...result,
        model,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      return {
        isAccurate: false,
        confidence: 0.3,
        matchScore: 0.3,
        suggestions: [],
        error: error.message,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 验证分类
  async validateCategory(prompt, content, category) {
    if (!this.isInitialized) {
      throw new Error('大模型验证器未初始化');
    }

    const startTime = Date.now();
    
    try {
      const model = this.selectModel();
      
      const validationPrompt = `
        请验证以下分类是否正确：
        
        Prompt: ${prompt}
        内容: ${content}
        当前分类: ${category}
        
        请分析：
        1. 当前分类是否准确？
        2. 如果不准确，建议什么分类？
        3. 分类的置信度如何？
        
        请以JSON格式返回结果：
        {
          "isCorrect": true/false,
          "confidence": 0.0-1.0,
          "suggestedCategory": "category",
          "reasoning": "explanation"
        }
      `;
      
      const response = await this.callLLM(model, validationPrompt, '');
      
      const result = this.parseAIResponse(response);
      const endTime = Date.now();
      
      return {
        ...result,
        model,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      return {
        isCorrect: false,
        confidence: 0.3,
        suggestedCategory: category,
        reasoning: 'validation-error',
        error: error.message,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 检查相似度
  async checkSimilarity(prompt1, prompt2) {
    if (!this.isInitialized) {
      throw new Error('大模型验证器未初始化');
    }

    const startTime = Date.now();
    
    try {
      const model = this.selectModel();
      
      const validationPrompt = `
        请比较以下两个prompt的相似度：
        
        Prompt 1: ${prompt1}
        Prompt 2: ${prompt2}
        
        请分析：
        1. 两个prompt的语义相似度（0.0-1.0）
        2. 是否描述的是相同的任务？
        3. 是否应该被视为重复内容？
        
        请以JSON格式返回结果：
        {
          "similarity": 0.0-1.0,
          "isSimilar": true/false,
          "reasoning": "explanation"
        }
      `;
      
      const response = await this.callLLM(model, validationPrompt, '');
      
      const result = this.parseAIResponse(response);
      const endTime = Date.now();
      
      return {
        ...result,
        model,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      return {
        similarity: 0.0,
        isSimilar: false,
        reasoning: 'validation-error',
        error: error.message,
        duration: endTime - startTime,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 批量验证
  async validateBatch(prompts) {
    if (!this.isInitialized) {
      throw new Error('大模型验证器未初始化');
    }

    console.log(`🔄 开始批量验证 ${prompts.length} 个prompt...`);
    
    const results = [];
    const batchSize = 3; // 限制并发数
    
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(prompt => this.validatePrompt(prompt))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            isValid: false,
            confidence: 0.3,
            qualityScore: 0.3,
            reasons: ['batch-error'],
            isNanoBananaRelated: false,
            suggestedCategory: 'general',
            error: result.reason.message,
            extractedAt: new Date().toISOString()
          });
        }
      }
      
      // 避免API限制
      if (i + batchSize < prompts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ 批量验证完成，成功 ${results.length}/${prompts.length} 个`);
    return results;
  }

  // 获取批量验证统计信息
  getBatchStats(results) {
    const stats = {
      total: results.length,
      valid: 0,
      invalid: 0,
      validRate: 0,
      averageConfidence: 0,
      averageQualityScore: 0,
      categories: {},
      reasons: {}
    };
    
    let totalConfidence = 0;
    let totalQualityScore = 0;
    
    for (const result of results) {
      if (result.isValid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }
      
      totalConfidence += result.confidence || 0;
      totalQualityScore += result.qualityScore || 0;
      
      // 统计分类
      const category = result.suggestedCategory || 'general';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
      
      // 统计原因
      for (const reason of result.reasons || []) {
        stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
      }
    }
    
    stats.validRate = stats.total > 0 ? stats.valid / stats.total : 0;
    stats.averageConfidence = stats.total > 0 ? totalConfidence / stats.total : 0;
    stats.averageQualityScore = stats.total > 0 ? totalQualityScore / stats.total : 0;
    
    return stats;
  }

  // 获取统计信息
  getStats() {
    return {
      ...this.stats,
      averageTime: this.stats.total > 0 ? this.stats.totalTime / this.stats.total : 0,
      successRate: this.stats.total > 0 ? this.stats.success / this.stats.total : 0
    };
  }

  // 清理资源
  async cleanup() {
    console.log('🧹 清理大模型验证器资源...');
    
    try {
      // 清理API密钥
      this.apiKeys = {};
      
      console.log('✅ 大模型验证器资源清理完成');
    } catch (error) {
      console.error('❌ 资源清理失败:', error);
    }
  }
}

// 导出主要功能
export { LLMValidator };

// 创建全局实例
const llmValidator = new LLMValidator();

// 导出便捷函数
export async function validatePrompt(prompt) {
  return await llmValidator.validatePrompt(prompt);
}

export async function validateEffect(prompt, effect) {
  return await llmValidator.validateEffect(prompt, effect);
}

export async function validateCategory(prompt, content, category) {
  return await llmValidator.validateCategory(prompt, content, category);
}

export async function checkSimilarity(prompt1, prompt2) {
  return await llmValidator.checkSimilarity(prompt1, prompt2);
}

export async function validateBatch(prompts) {
  return await llmValidator.validateBatch(prompts);
}

export function getValidationStats() {
  return llmValidator.getStats();
}
