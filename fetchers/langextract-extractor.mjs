// fetchers/langextract-extractor.mjs
// LangExtract集成提取器


// LangExtract配置
const LANGEXTRACT_CONFIG = {
  // 提取模式配置
  modes: {
    'nano-banana-prompts': {
      schema: {
        type: 'object',
        properties: {
          prompts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                category: { type: 'string' },
                confidence: { type: 'number' },
                effects: { type: 'array', items: { type: 'string' } },
                images: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }
};

// 案例分类配置
const CATEGORY_KEYWORDS = {
  'figurine': ['3d', 'figurine', 'figure', 'model', 'sculpture', '手办', '模型', '雕塑'],
  'character': ['character', 'person', 'face', 'portrait', '人物', '角色', '肖像', '面部'],
  'style': ['style', 'art', 'painting', 'artistic', '风格', '艺术', '绘画', '画风'],
  'enhancement': ['enhance', 'improve', 'quality', 'resolution', '增强', '改善', '质量', '分辨率'],
  'clothing': ['clothing', 'dress', 'outfit', 'fashion', '衣服', '服装', '穿搭', '时尚'],
  'scene': ['background', 'scene', 'environment', '背景', '场景', '环境'],
  'composition': ['pose', 'action', 'movement', 'gesture', '姿势', '动作', '姿态'],
  'design': ['design', '设计', '包装', '工业设计', '产品设计', '包装设计', '卡片设计', '包装生成', 'product', 'packaging'],
  'education': ['教育', '教学', '分析', '批注', '标注', '卡路里', '批改', '教学', 'education', 'teaching', 'analysis', 'annotation'],
  'business': ['广告', '营销', '信息图', '商业', '广告短片', '商品', '营销', 'business', 'advertisement', 'marketing', 'infographic'],
  'technical': ['技术', '参数', '设置', '拆解', '硬件', '相机', 'technical', 'iso', 'camera', 'hardware', 'parameter'],
  'artistic': ['艺术', '绘画', '插画', '漫画', 'artistic', 'painting', 'illustration', 'drawing', 'manga', 'comic'],
  'other': ['age', 'young', 'old', 'aging', '性别', '男性', '女性', 'retro', 'vintage', 'classic', 'old', '复古', '经典', '怀旧', 'fantasy', 'creature', 'monster', 'dragon', '奇幻', '生物', '怪物', '龙', 'anime', 'manga', 'cartoon', '动漫', '漫画', '卡通']
};

class LangExtractExtractor {
  constructor() {
    this.isInitialized = false;
    this.currentMode = 'nano-banana-prompts';
    this.config = LANGEXTRACT_CONFIG;
    this.initialize();
  }

  async initialize() {
    try {
      // 模拟LangExtract初始化
      // 在实际实现中，这里会调用LangExtract的初始化方法
      console.log('🔧 初始化LangExtract提取器...');
      
      // 设置默认模式
      this.setMode(this.currentMode);
      
      this.isInitialized = true;
      console.log('✅ LangExtract提取器初始化完成');
    } catch (error) {
      console.error('❌ LangExtract初始化失败:', error);
      this.isInitialized = false;
    }
  }

  setMode(mode) {
    if (this.config.modes[mode]) {
      this.currentMode = mode;
      console.log(`📝 设置提取模式: ${mode}`);
    } else {
      throw new Error(`未知的提取模式: ${mode}`);
    }
  }

  // 智能文本清理
  smartCleanText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[ \u3000]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // 验证prompt质量
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return false;
    
    const cleaned = this.smartCleanText(prompt);
    
    // 基本长度检查
    if (cleaned.length < 10 || cleaned.length > 2000) return false;
    
    // 检查是否包含nano banana相关内容
    const nanoBananaKeywords = [
      'nano banana', 'nanobanana', 'nano-banana', 'nano_banana',
      'gemini 2.5', 'flash image', 'image preview'
    ];
    
    const hasNanoBanana = nanoBananaKeywords.some(keyword => 
      cleaned.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // 检查是否包含有意义的操作词汇
    const actionWords = [
      'create', 'make', 'turn', 'transform', 'generate', 'edit', 'change', 'convert',
      'craft', 'design', 'style', 'modify', 'enhance', 'improve'
    ];
    
    const hasAction = actionWords.some(word => 
      cleaned.toLowerCase().includes(word)
    );
    
    // 检查是否包含目标对象
    const targetWords = [
      'figurine', 'character', 'scene', 'style', 'clothing', 'outfit', 
      'person', 'image', 'photo', 'picture', 'portrait', 'model'
    ];
    
    const hasTarget = targetWords.some(word => 
      cleaned.toLowerCase().includes(word)
    );
    
    return hasNanoBanana && hasAction && hasTarget;
  }

  // 智能分类
  categorizeContent(text) {
    const lowerText = text.toLowerCase();
    const categories = [];
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        categories.push(category);
      }
    }
    
    return categories.length > 0 ? categories : ['general'];
  }

  // 计算置信度
  calculateConfidence(prompt, effects = [], images = []) {
    let confidence = 0.5; // 基础置信度
    
    // prompt质量评分
    if (prompt && prompt.length > 50) confidence += 0.2;
    if (prompt && prompt.length > 100) confidence += 0.1;
    if (prompt && prompt.length > 200) confidence += 0.1;
    
    // 效果描述评分
    if (effects && effects.length > 0) confidence += 0.1;
    if (effects && effects.length > 1) confidence += 0.1;
    
    // 图片评分
    if (images && images.length > 0) confidence += 0.1;
    
    // 语义质量评分
    const hasDetailedDescription = /(detailed|specific|precise|exact)/i.test(prompt);
    if (hasDetailedDescription) confidence += 0.1;
    
    const hasStyleKeywords = /(style|artistic|creative|aesthetic)/i.test(prompt);
    if (hasStyleKeywords) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  // 提取prompts
  async extractPrompts(content) {
    if (!this.isInitialized) {
      throw new Error('LangExtract提取器未初始化');
    }

    try {
      const cleanedContent = this.smartCleanText(content);
      const prompts = [];
      
      // 使用多种模式提取prompt
      const promptPatterns = [
        // 标准格式
        /(?:prompt|提示词)[：:]\s*```\s*([^`]+?)\s*```/gis,
        /(?:prompt|提示词)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
        
        // 代码块格式
        /```(?:yaml|json|text|prompt)?\s*([^`]+?)\s*```/gis,
        
        // 引号格式
        /"(?:prompt|提示词)"[：:]\s*"([^"]+?)"/gis,
        /'(?:prompt|提示词)'[：:]\s*'([^']+?)'/gis,
        
        // 段落格式
        /(?:prompt|提示词)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis
      ];
      
      for (const pattern of promptPatterns) {
        let match;
        while ((match = pattern.exec(cleanedContent)) !== null) {
          const promptText = this.smartCleanText(match[1]);
          
          if (this.validatePrompt(promptText)) {
            const categories = this.categorizeContent(promptText);
            const confidence = this.calculateConfidence(promptText);
            
            prompts.push({
              text: promptText,
              category: categories[0] || 'general',
              categories: categories,
              confidence: confidence,
              extractedAt: new Date().toISOString()
            });
          }
        }
      }
      
      // 去重
      const uniquePrompts = [];
      const seenTexts = new Set();
      
      for (const prompt of prompts) {
        const normalizedText = prompt.text.toLowerCase().trim();
        if (!seenTexts.has(normalizedText)) {
          seenTexts.add(normalizedText);
          uniquePrompts.push(prompt);
        }
      }
      
      return {
        prompts: uniquePrompts,
        total: uniquePrompts.length,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ LangExtract提取失败:', error);
      return {
        prompts: [],
        total: 0,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 提取效果描述
  async extractEffects(content) {
    if (!this.isInitialized) {
      throw new Error('LangExtract提取器未初始化');
    }

    try {
      const cleanedContent = this.smartCleanText(content);
      const effects = [];
      
      const effectPatterns = [
        /(?:效果|结果|描述|说明)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
        /(?:effect|result|description)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
        /(?:用途|应用|场景)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
        /(?:use case|application|scenario)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis
      ];
      
      for (const pattern of effectPatterns) {
        let match;
        while ((match = pattern.exec(cleanedContent)) !== null) {
          const effectText = this.smartCleanText(match[1]);
          if (effectText.length > 5 && effectText.length < 500) {
            effects.push({
              text: effectText,
              confidence: this.calculateConfidence(effectText),
              extractedAt: new Date().toISOString()
            });
          }
        }
      }
      
      return {
        effects: effects,
        total: effects.length,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ 效果描述提取失败:', error);
      return {
        effects: [],
        total: 0,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 提取图片
  async extractImages(content) {
    if (!this.isInitialized) {
      throw new Error('LangExtract提取器未初始化');
    }

    try {
      const cleanedContent = this.smartCleanText(content);
      const images = [];
      
      const imagePatterns = [
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        /<img[^>]+src="([^"]+)"[^>]*>/g,
        /src="([^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
        /(?:图片|image|photo)[：:]\s*([^\s]+)/gis
      ];
      
      for (const pattern of imagePatterns) {
        let match;
        while ((match = pattern.exec(cleanedContent)) !== null) {
          const imageUrl = match[2] || match[1];
          if (imageUrl && imageUrl.startsWith('http')) {
            images.push({
              url: imageUrl,
              alt: match[1] || '',
              extractedAt: new Date().toISOString()
            });
          }
        }
      }
      
      return {
        images: images,
        total: images.length,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ 图片提取失败:', error);
      return {
        images: [],
        total: 0,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 综合提取和分类
  async extractAndCategorize(content) {
    if (!this.isInitialized) {
      throw new Error('LangExtract提取器未初始化');
    }

    try {
      const [promptsResult, effectsResult, imagesResult] = await Promise.all([
        this.extractPrompts(content),
        this.extractEffects(content),
        this.extractImages(content)
      ]);
      
      // 合并结果
      const combinedResult = {
        prompts: promptsResult.prompts,
        effects: effectsResult.effects,
        images: imagesResult.images,
        categories: [...new Set(promptsResult.prompts.flatMap(p => p.categories))],
        total: promptsResult.total + effectsResult.total + imagesResult.total,
        extractedAt: new Date().toISOString()
      };
      
      return combinedResult;
      
    } catch (error) {
      console.error('❌ 综合提取失败:', error);
      return {
        prompts: [],
        effects: [],
        images: [],
        categories: [],
        total: 0,
        error: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  // 清理资源
  async cleanup() {
    try {
      console.log('🧹 清理LangExtract提取器资源...');
      // 在实际实现中，这里会清理LangExtract的资源
      this.isInitialized = false;
      console.log('✅ LangExtract提取器资源清理完成');
    } catch (error) {
      console.error('❌ 资源清理失败:', error);
    }
  }
}

// 导出主要功能
export { LangExtractExtractor };

// 创建全局实例
const langextractExtractor = new LangExtractExtractor();

// 导出便捷函数
export async function extractWithLangExtract(content) {
  return await langextractExtractor.extractAndCategorize(content);
}

export async function extractPromptsWithLangExtract(content) {
  return await langextractExtractor.extractPrompts(content);
}

export async function extractEffectsWithLangExtract(content) {
  return await langextractExtractor.extractEffects(content);
}

export async function extractImagesWithLangExtract(content) {
  return await langextractExtractor.extractImages(content);
}
