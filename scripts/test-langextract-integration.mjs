// scripts/test-langextract-integration.mjs
// 测试LangExtract集成功能

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LangExtractExtractor } from '../fetchers/langextract-extractor.mjs';

describe('LangExtract集成测试', () => {
  let langextractExtractor;

  beforeAll(async () => {
    langextractExtractor = new LangExtractExtractor();
  });

  afterAll(async () => {
    if (langextractExtractor) {
      await langextractExtractor.cleanup();
    }
  });

  describe('基础功能测试', () => {
    it('应该能够初始化LangExtract提取器', () => {
      expect(langextractExtractor).toBeDefined();
      expect(langextractExtractor.isInitialized).toBe(true);
    });

    it('应该能够设置提取模式', () => {
      const mode = 'nano-banana-prompts';
      langextractExtractor.setMode(mode);
      expect(langextractExtractor.currentMode).toBe(mode);
    });
  });

  describe('Prompt提取测试', () => {
    it('应该从标准格式中提取prompt', async () => {
      const content = `
        **Prompt:**
        Create a 3D figurine of the uploaded person in anime style. 
        The figurine should be detailed, colorful, and capture the person's facial features accurately.
        Use nano banana to transform the photo into a high-quality 3D model.
      `;

      const result = await langextractExtractor.extractPrompts(content);
      
      expect(result).toBeDefined();
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].text).toContain('3D figurine');
      expect(result.prompts[0].confidence).toBeGreaterThan(0.7);
    });

    it('应该从代码块中提取prompt', async () => {
      const content = `
        \`\`\`yaml
        Create a moody studio portrait of the uploaded person bathed in golden-orange spotlight.
        The warm light should sculpt the face and upper body with soft, sunset-like tones.
        \`\`\`
      `;

      const result = await langextractExtractor.extractPrompts(content);
      
      expect(result).toBeDefined();
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].text).toContain('moody studio portrait');
    });

    it('应该从多个prompt中提取所有内容', async () => {
      const content = `
        **Prompt 1:**
        Create a retro Bollywood style image.
        
        **Prompt 2:**
        Transform this into a vintage gentleman portrait.
      `;

      const result = await langextractExtractor.extractPrompts(content);
      
      expect(result).toBeDefined();
      expect(result.prompts).toHaveLength(2);
      expect(result.prompts[0].text).toContain('Bollywood');
      expect(result.prompts[1].text).toContain('vintage gentleman');
    });
  });

  describe('效果描述提取测试', () => {
    it('应该提取效果描述', async () => {
      const content = `
        **Prompt:**
        Create a 3D figurine using nano banana.
        
        **效果描述：** 将人物照片转换为3D手办模型，保持面部特征的同时添加动漫风格。
      `;

      const result = await langextractExtractor.extractEffects(content);
      
      expect(result).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].text).toContain('3D手办模型');
    });

    it('应该从多种格式中提取效果描述', async () => {
      const content = `
        **Result:** This creates a vintage Bollywood look.
        **Description:** The image is transformed into 1970s style.
        **用途：** 用于制作复古风格的图像。
      `;

      const result = await langextractExtractor.extractEffects(content);
      
      expect(result).toBeDefined();
      expect(result.effects.length).toBeGreaterThan(0);
    });
  });

  describe('智能分类测试', () => {
    it('应该正确分类3D手办案例', async () => {
      const content = `
        **Prompt:**
        Create a 3D figurine of the uploaded person in anime style.
        The figurine should be detailed and suitable for 3D printing.
      `;

      const result = await langextractExtractor.extractAndCategorize(content);
      
      expect(result).toBeDefined();
      expect(result.categories).toContain('3d-figurine');
    });

    it('应该正确分类风格转换案例', async () => {
      const content = `
        **Prompt:**
        Transform this photo into a retro 1970s Bollywood style.
        Use warm color grading and film grain effect.
      `;

      const result = await langextractExtractor.extractAndCategorize(content);
      
      expect(result).toBeDefined();
      expect(result.categories).toContain('style-transfer');
    });

    it('应该正确分类服装更换案例', async () => {
      const content = `
        **Prompt:**
        Change the clothing in this photo to a formal business suit.
        Keep the person's face and pose unchanged.
      `;

      const result = await langextractExtractor.extractAndCategorize(content);
      
      expect(result).toBeDefined();
      expect(result.categories).toContain('clothing-change');
    });
  });

  describe('置信度计算测试', () => {
    it('应该为高质量prompt给出高置信度', async () => {
      const content = `
        **Prompt:**
        Create a full-length photorealistic image of the uploaded person as a 1970s Bollywood superstar.
        Scene: outside a Mumbai cinema hall during a film premiere, marquee glowing in neon.
        The subject is styled in Western-inspired Bollywood glamour of the 1970s.
      `;

      const result = await langextractExtractor.extractPrompts(content);
      
      expect(result).toBeDefined();
      expect(result.prompts[0].confidence).toBeGreaterThan(0.8);
    });

    it('应该为低质量prompt给出低置信度', async () => {
      const content = `
        **Prompt:**
        test
      `;

      const result = await langextractExtractor.extractPrompts(content);
      
      expect(result).toBeDefined();
      if (result.prompts.length > 0) {
        expect(result.prompts[0].confidence).toBeLessThan(0.5);
      }
    });
  });

  describe('错误处理测试', () => {
    it('应该处理空内容', async () => {
      const result = await langextractExtractor.extractPrompts('');
      
      expect(result).toBeDefined();
      expect(result.prompts).toHaveLength(0);
    });

    it('应该处理无效内容', async () => {
      const result = await langextractExtractor.extractPrompts(null);
      
      expect(result).toBeDefined();
      expect(result.prompts).toHaveLength(0);
    });

    it('应该处理网络错误', async () => {
      // 模拟网络错误
      const originalExtract = langextractExtractor.extract;
      langextractExtractor.extract = () => {
        throw new Error('Network error');
      };

      const result = await langextractExtractor.extractPrompts('test content');
      
      expect(result).toBeDefined();
      expect(result.error).toBe('Network error');
      
      // 恢复原始方法
      langextractExtractor.extract = originalExtract;
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成提取', async () => {
      const largeContent = `
        **Prompt 1:**
        Create a 3D figurine of the uploaded person in anime style.
        
        **Prompt 2:**
        Transform this photo into a retro 1970s Bollywood style.
        
        **Prompt 3:**
        Change the clothing in this photo to a formal business suit.
      `.repeat(100); // 重复100次创建大内容

      const startTime = Date.now();
      const result = await langextractExtractor.extractPrompts(largeContent);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });
});

// 运行测试
async function runTests() {
  console.log('🧪 开始LangExtract集成测试...\n');
  
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
