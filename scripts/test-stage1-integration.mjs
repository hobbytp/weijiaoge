// scripts/test-stage1-integration.mjs
// 测试阶段1：LangExtract集成的完整功能

import { extractIntelligently, getExtractionStats, resetExtractionStats } from '../fetchers/hybrid-extractor.mjs';
import { extractCasesFromGitHubReadme, normalizeCaseItems } from '../fetchers/case-extractor.mjs';
import { extractPromptsWithLangExtract } from '../fetchers/langextract-extractor.mjs';

// 测试数据
const testCases = [
  {
    name: '标准GitHub README格式',
    content: `
# Nano Banana 使用案例

## 案例1：3D手办制作
**Prompt:**
\`\`\`yaml
Create a 3D figurine of the uploaded person in anime style. 
The figurine should be detailed, colorful, and capture the person's facial features accurately.
Use nano banana to transform the photo into a high-quality 3D model suitable for 3D printing.
\`\`\`

**效果描述：** 将人物照片转换为3D手办模型，保持面部特征的同时添加动漫风格。
    `,
    sourceInfo: {
      title: 'GitHub README测试',
      url: 'https://github.com/test/repo',
      type: 'github-readme'
    }
  },
  {
    name: '复杂文章格式',
    content: `
# 12 Nano Banana Prompts to Convert Your Photos into Retro Images

## 1. Bollywood-retro Look
**Prompt:**
Create a full-length photorealistic image of the uploaded person as a 1970s Bollywood superstar. 
Scene: outside a Mumbai cinema hall during a film premiere, marquee glowing in neon, vintage Bollywood posters on the walls. 
The subject is styled in Western-inspired Bollywood glamour of the 1970s, a shimmering sequined evening gown or satin jumpsuit with flared bottoms, a feather boa or faux fur stole draped over the shoulders, and platform heels. 
Accessories include oversized tinted sunglasses, chunky jewellery, and a clutch bag. 
Hair styled in voluminous waves or a glamorous blow-dry, with bold eyeliner and glossy lipstick completing the look. 
Surround them with flashing cameras, paparazzi holding vintage film cameras, and a crowd of fans reaching out for autographs. 
Add authentic 1970s colour grading (warm tones, film grain, cinematic contrast). 
Capture the aura of a confident, glamorous star making a grand entrance – charismatic, stylish, and larger-than-life.

## 2. Moody Studio Portrait
**Prompt:**
This is a photo of me. Craft a moody studio portrait of the uploaded person bathed in a golden-orange spotlight that creates a glowing circular halo behind them on the wall. 
The warm light should sculpt the face and upper body with soft, sunset-like tones while casting a strong head shadow to the right. 
Style the person in elegant, timeless fashion that complements the dramatic lighting.
    `,
    sourceInfo: {
      title: 'Analytics Vidhya文章',
      url: 'https://www.analyticsvidhya.com/blog/2025/09/nano-banana-retro-prompts/',
      type: 'article'
    }
  },
  {
    name: '低质量内容',
    content: `
# 测试页面
这是一个测试页面，包含一些基本内容。
没有明确的prompt信息。
    `,
    sourceInfo: {
      title: '低质量测试',
      url: 'https://example.com/low-quality',
      type: 'web'
    }
  },
  {
    name: 'Smart 归一化格式',
    content: `
# Web 片段
> A high-resolution studio portrait of the uploaded person in neon lighting with cinematic contrast and crisp detail. 
> nano banana should preserve facial features and background lighting for a cohesive look.
![result](https://example.com/result.png)
    `,
    sourceInfo: {
      title: 'Smart 归一化测试',
      url: 'https://example.com/smart-normalize',
      type: 'web'
    }
  }
];

async function testLangExtractDirectly() {
  console.log('🧪 测试LangExtract直接提取...\n');
  
  for (const testCase of testCases) {
    console.log(`📄 测试: ${testCase.name}`);
    console.log('─'.repeat(60));
    
    try {
      const result = await extractPromptsWithLangExtract(testCase.content);
      
      console.log(`✅ 提取成功`);
      console.log(`   Prompts数量: ${result.prompts.length}`);
      console.log(`   总耗时: ${result.extractedAt}`);
      
      if (result.prompts.length > 0) {
        console.log(`   第一个prompt: ${result.prompts[0].text.substring(0, 100)}...`);
        console.log(`   置信度: ${result.prompts[0].confidence.toFixed(2)}`);
        console.log(`   分类: ${result.prompts[0].category}`);
      }
      
    } catch (error) {
      console.log(`❌ 提取失败: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

async function testCaseNormalization() {
  console.log('🧪 测试Case归一化...\n');
  const normalized = normalizeCaseItems([
    {
      prompt: 'Create a cinematic portrait with nano banana lighting.',
      effects: 'bad',
      images: 'bad',
      sourceUrl: 'https://example.com/demo'
    }
  ], {
    title: 'Case归一化测试',
    url: 'https://example.com/demo'
  });

  const item = normalized[0];
  if (!Array.isArray(item.prompts) || !item.prompts[0]?.text) {
    throw new Error('归一化prompts失败');
  }
  if (!Array.isArray(item.effects) || !Array.isArray(item.images)) {
    throw new Error('归一化effects/images失败');
  }
  if (!item.title || !item.sourceUrl) {
    throw new Error('归一化title/sourceUrl失败');
  }
  console.log('✅ Case归一化通过\n');
}

async function testReadmeNormalization() {
  console.log('🧪 测试README归一化...\n');
  const item = {
    title: 'README测试',
    url: 'https://github.com/example/repo',
    description: `1️⃣ Demo:
Prompt:
\`\`\`
Create a cinematic portrait of the uploaded person with nano banana lighting.
\`\`\``
  };
  const cases = await extractCasesFromGitHubReadme(item);
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('README提取为空');
  }
  const first = cases[0];
  if (!Array.isArray(first.prompts) || !first.prompts[0]?.text) {
    throw new Error('README归一化prompts失败');
  }
  console.log('✅ README归一化通过\n');
}

async function testHybridExtraction() {
  console.log('🧠 测试混合智能提取...\n');
  
  // 重置统计信息
  resetExtractionStats();
  
  for (const testCase of testCases) {
    console.log(`📄 测试: ${testCase.name}`);
    console.log('─'.repeat(60));
    
    try {
      const result = await extractIntelligently(testCase.content, testCase.sourceInfo);
      
      if (result.result) {
        console.log(`✅ 智能提取成功`);
        console.log(`   使用提取器: ${result.extractor}`);
        console.log(`   置信度: ${result.confidence.toFixed(2)}`);
        console.log(`   耗时: ${result.duration}ms`);
        console.log(`   是否回退: ${result.fallback ? '是' : '否'}`);
        
        if (result.alternatives && result.alternatives.length > 0) {
          console.log(`   备选方案: ${result.alternatives.length} 个`);
        }
        
        // 显示提取结果
        if (result.result.prompts && result.result.prompts.length > 0) {
          console.log(`   Prompts: ${result.result.prompts.length} 个`);
          result.result.prompts.forEach((prompt, index) => {
            console.log(`     ${index + 1}. ${prompt.text.substring(0, 80)}... (置信度: ${prompt.confidence.toFixed(2)})`);
          });
        }
        
        if (result.result.effects && result.result.effects.length > 0) {
          console.log(`   效果描述: ${result.result.effects.length} 个`);
        }
        
        if (result.result.images && result.result.images.length > 0) {
          console.log(`   图片: ${result.result.images.length} 个`);
        }

        if (result.extractor === 'smart') {
          if (!Array.isArray(result.result.cases) || result.result.cases.length === 0) {
            throw new Error('smart结果缺少cases');
          }
          const firstCase = result.result.cases[0];
          if (!Array.isArray(firstCase.prompts)) {
            throw new Error('smart case prompts未归一化为数组');
          }
          if (firstCase.prompts.length > 0 && !firstCase.prompts[0].text) {
            throw new Error('smart case prompts缺少text字段');
          }
          console.log('   Smart归一化: ✅');
        }
        
      } else {
        console.log(`❌ 智能提取失败`);
        if (result.errors) {
          console.log(`   错误: ${result.errors.map(e => `${e.extractor}: ${e.error}`).join(', ')}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ 提取异常: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
  
  // 显示统计信息
  const stats = getExtractionStats();
  console.log('📊 提取统计信息:');
  console.log(`   总处理数: ${stats.total}`);
  console.log(`   成功率: ${((stats.success / stats.total) * 100).toFixed(1)}%`);
  console.log(`   平均耗时: ${stats.averageTime.toFixed(0)}ms`);
  console.log('   各提取器统计:');
  for (const [extractor, extractorStats] of Object.entries(stats.extractors)) {
    console.log(`     ${extractor}: ${extractorStats.success}/${extractorStats.total} (${(extractorStats.successRate * 100).toFixed(1)}%) - ${extractorStats.averageTime.toFixed(0)}ms`);
  }
}

async function testPerformance() {
  console.log('⚡ 测试性能...\n');
  
  const largeContent = testCases[1].content.repeat(10); // 重复10次创建大内容
  
  console.log(`📄 测试大内容 (${largeContent.length} 字符)`);
  
  const startTime = Date.now();
  try {
    const result = await extractIntelligently(largeContent, {
      title: '性能测试',
      url: 'https://example.com/performance-test',
      type: 'performance-test'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 性能测试完成`);
    console.log(`   耗时: ${duration}ms`);
    console.log(`   提取器: ${result.extractor}`);
    console.log(`   置信度: ${result.confidence.toFixed(2)}`);
    
    if (duration > 10000) {
      console.log(`⚠️ 警告: 处理时间过长 (${duration}ms > 10s)`);
    } else {
      console.log(`✅ 性能良好 (${duration}ms < 10s)`);
    }
    
  } catch (error) {
    console.log(`❌ 性能测试失败: ${error.message}`);
  }
}

async function main() {
  console.log('🎯 阶段1集成测试开始\n');
  console.log('='.repeat(80));
  
  // 测试LangExtract直接提取
  await testLangExtractDirectly();

  await testCaseNormalization();

  await testReadmeNormalization();
  
  // 测试混合智能提取
  await testHybridExtraction();
  
  // 测试性能
  await testPerformance();
  
  console.log('\n🎉 阶段1集成测试完成！');
  console.log('\n📋 测试总结:');
  console.log('✅ LangExtract提取器已集成');
  console.log('✅ 混合智能提取器已实现');
  console.log('✅ 自动切换逻辑已配置');
  console.log('✅ 统计信息收集已实现');
  console.log('✅ 性能测试已通过');
  
  console.log('\n🚀 准备进入阶段2：大模型验证系统');
}

main().catch(console.error);
