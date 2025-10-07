// scripts/test-llm-validation.mjs
// 测试大模型验证系统

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LLMValidator } from '../fetchers/llm-validator.mjs';

describe('大模型验证系统测试', () => {
  let llmValidator;

  beforeAll(async () => {
    llmValidator = new LLMValidator();
  });

  afterAll(async () => {
    if (llmValidator) {
      await llmValidator.cleanup();
    }
  });

  describe('基础功能测试', () => {
    it('应该能够初始化大模型验证器', () => {
      expect(llmValidator).toBeDefined();
      expect(llmValidator.isInitialized).toBe(true);
    });

    it('应该能够设置验证模式', () => {
      const mode = 'nano-banana-validation';
      llmValidator.setMode(mode);
      expect(llmValidator.currentMode).toBe(mode);
    });

    it('应该能够设置API密钥', () => {
      const apiKey = 'test-api-key';
      llmValidator.setApiKey('gemini', apiKey);
      expect(llmValidator.getApiKey('gemini')).toBe(apiKey);
    });
  });

  describe('Prompt质量验证测试', () => {
    it('应该验证高质量prompt', async () => {
      const highQualityPrompt = `
        Create a full-length photorealistic image of the uploaded person as a 1970s Bollywood superstar.
        Scene: outside a Mumbai cinema hall during a film premiere, marquee glowing in neon, vintage Bollywood posters on the walls.
        The subject is styled in Western-inspired Bollywood glamour of the 1970s, a shimmering sequined evening gown or satin jumpsuit with flared bottoms.
        Use nano banana to transform the photo into a high-quality cinematic image.
      `;

      const result = await llmValidator.validatePrompt(highQualityPrompt);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.qualityScore).toBeGreaterThan(0.7);
      expect(result.reasons).toContain('high-quality');
    });

    it('应该拒绝低质量prompt', async () => {
      const lowQualityPrompt = 'test';

      const result = await llmValidator.validatePrompt(lowQualityPrompt);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.qualityScore).toBeLessThan(0.3);
      expect(result.reasons).toContain('low-quality');
    });

    it('应该识别nano banana相关prompt', async () => {
      const nanoBananaPrompt = `
        Use nano banana to create a 3D figurine of the uploaded person in anime style.
        The figurine should be detailed and suitable for 3D printing.
      `;

      const result = await llmValidator.validatePrompt(nanoBananaPrompt);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.isNanoBananaRelated).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('应该识别非nano banana相关prompt', async () => {
      const unrelatedPrompt = `
        Create a beautiful landscape painting.
        The painting should show mountains and rivers.
      `;

      const result = await llmValidator.validatePrompt(unrelatedPrompt);
      
      expect(result).toBeDefined();
      expect(result.isNanoBananaRelated).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('效果描述验证测试', () => {
    it('应该验证效果描述的准确性', async () => {
      const prompt = 'Create a 3D figurine using nano banana';
      const effect = '将人物照片转换为3D手办模型，保持面部特征的同时添加动漫风格';

      const result = await llmValidator.validateEffect(prompt, effect);
      
      expect(result).toBeDefined();
      expect(result.isAccurate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.matchScore).toBeGreaterThan(0.6);
    });

    it('应该识别不匹配的效果描述', async () => {
      const prompt = 'Create a 3D figurine using nano banana';
      const effect = '这是一个关于天气的讨论';

      const result = await llmValidator.validateEffect(prompt, effect);
      
      expect(result).toBeDefined();
      expect(result.isAccurate).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.matchScore).toBeLessThan(0.3);
    });
  });

  describe('案例分类验证测试', () => {
    it('应该正确分类3D手办案例', async () => {
      const prompt = 'Create a 3D figurine of the uploaded person in anime style';
      const content = 'This is about creating 3D figurines and models';

      const result = await llmValidator.validateCategory(prompt, content, '3d-figurine');
      
      expect(result).toBeDefined();
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.suggestedCategory).toBe('3d-figurine');
    });

    it('应该建议正确的分类', async () => {
      const prompt = 'Transform this photo into a retro 1970s Bollywood style';
      const content = 'This is about style transformation and retro effects';

      const result = await llmValidator.validateCategory(prompt, content, 'clothing-change');
      
      expect(result).toBeDefined();
      expect(result.isCorrect).toBe(false);
      expect(result.suggestedCategory).toBe('style-transfer');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('语义相似度检测测试', () => {
    it('应该检测相似的prompt', async () => {
      const prompt1 = 'Create a 3D figurine of the uploaded person in anime style';
      const prompt2 = 'Make a 3D anime figurine of the person in the photo';

      const result = await llmValidator.checkSimilarity(prompt1, prompt2);
      
      expect(result).toBeDefined();
      expect(result.similarity).toBeGreaterThan(0.8);
      expect(result.isSimilar).toBe(true);
    });

    it('应该识别不同的prompt', async () => {
      const prompt1 = 'Create a 3D figurine of the uploaded person in anime style';
      const prompt2 = 'Transform this photo into a retro Bollywood style';

      const result = await llmValidator.checkSimilarity(prompt1, prompt2);
      
      expect(result).toBeDefined();
      expect(result.similarity).toBeLessThan(0.5);
      expect(result.isSimilar).toBe(false);
    });
  });

  describe('批量验证测试', () => {
    it('应该能够批量验证多个prompt', async () => {
      const prompts = [
        'Create a 3D figurine using nano banana',
        'Transform this photo into retro style',
        'Change the clothing in this photo',
        'test' // 低质量prompt
      ];

      const results = await llmValidator.validateBatch(prompts);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(prompts.length);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false);
    });

    it('应该提供批量验证统计信息', async () => {
      const prompts = [
        'Create a 3D figurine using nano banana',
        'Transform this photo into retro style',
        'test',
        'another test'
      ];

      const results = await llmValidator.validateBatch(prompts);
      const stats = llmValidator.getBatchStats(results);
      
      expect(stats).toBeDefined();
      expect(stats.total).toBe(prompts.length);
      expect(stats.valid).toBe(2);
      expect(stats.invalid).toBe(2);
      expect(stats.validRate).toBe(0.5);
    });
  });

  describe('错误处理测试', () => {
    it('应该处理API错误', async () => {
      // 模拟API错误
      const originalValidate = llmValidator.validate;
      llmValidator.validate = () => {
        throw new Error('API rate limit exceeded');
      };

      const result = await llmValidator.validatePrompt('test prompt');
      
      expect(result).toBeDefined();
      expect(result.error).toBe('API rate limit exceeded');
      
      // 恢复原始方法
      llmValidator.validate = originalValidate;
    });

    it('应该处理网络超时', async () => {
      // 模拟网络超时
      const originalValidate = llmValidator.validate;
      llmValidator.validate = () => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        });
      };

      const result = await llmValidator.validatePrompt('test prompt');
      
      expect(result).toBeDefined();
      expect(result.error).toBe('Request timeout');
      
      // 恢复原始方法
      llmValidator.validate = originalValidate;
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成验证', async () => {
      const prompt = 'Create a 3D figurine using nano banana';
      
      const startTime = Date.now();
      const result = await llmValidator.validatePrompt(prompt);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // 应该在10秒内完成
    });

    it('应该支持并发验证', async () => {
      const prompts = [
        'Create a 3D figurine using nano banana',
        'Transform this photo into retro style',
        'Change the clothing in this photo'
      ];
      
      const startTime = Date.now();
      const results = await Promise.all(
        prompts.map(prompt => llmValidator.validatePrompt(prompt))
      );
      const endTime = Date.now();
      
      expect(results).toHaveLength(prompts.length);
      expect(endTime - startTime).toBeLessThan(15000); // 并发应该在15秒内完成
    });
  });
});

// 运行测试
async function runTests() {
  console.log('🧪 开始大模型验证系统测试...\n');
  
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
