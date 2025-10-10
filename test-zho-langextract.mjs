// test-zho-langextract.mjs
// 测试LangExtract集成的ZHO仓库案例提取

import fs from 'fs';
import { extractCasesFromGitHubReadme } from './fetchers/case-extractor.mjs';

async function testZHOExtraction() {
  console.log('🧪 测试LangExtract集成的ZHO仓库案例提取...\n');
  
  try {
    // 读取ZHO仓库数据
    const data = JSON.parse(fs.readFileSync('public/data.json', 'utf8'));
    const zhoItem = data.items.find(item => 
      item.title && item.title.includes('ZHO-nano-banana-Creation - README')
    );
    
    if (!zhoItem) {
      console.error('❌ 未找到ZHO仓库数据');
      return;
    }
    
    console.log(`📊 开始提取ZHO仓库案例...`);
    console.log(`   - 仓库: ${zhoItem.title}`);
    console.log(`   - 内容长度: ${zhoItem.description.length} 字符`);
    
    const startTime = Date.now();
    const cases = await extractCasesFromGitHubReadme(zhoItem);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n📈 提取结果:`);
    console.log(`   - 总案例数: ${cases.length}`);
    console.log(`   - 提取时间: ${duration}ms`);
    console.log(`   - 平均每案例时间: ${(duration / cases.length).toFixed(1)}ms`);
    
    // 统计图片信息
    const totalImages = cases.reduce((sum, c) => sum + c.images.length, 0);
    const avgImages = cases.length > 0 ? (totalImages / cases.length).toFixed(1) : 0;
    const casesWithImages = cases.filter(c => c.images.length > 0).length;
    
    console.log(`\n🖼️  图片统计:`);
    console.log(`   - 总图片数: ${totalImages}`);
    console.log(`   - 平均每案例图片数: ${avgImages}`);
    console.log(`   - 有图片的案例数: ${casesWithImages}/${cases.length}`);
    
    // 统计prompt信息
    const totalPrompts = cases.reduce((sum, c) => sum + c.prompts.length, 0);
    const avgPrompts = cases.length > 0 ? (totalPrompts / cases.length).toFixed(1) : 0;
    const casesWithPrompts = cases.filter(c => c.prompts.length > 0).length;
    
    console.log(`\n📝 Prompt统计:`);
    console.log(`   - 总Prompt数: ${totalPrompts}`);
    console.log(`   - 平均每案例Prompt数: ${avgPrompts}`);
    console.log(`   - 有Prompt的案例数: ${casesWithPrompts}/${cases.length}`);
    
    // 检查重复图片
    const allImages = cases.flatMap(c => c.images);
    const uniqueImages = [...new Set(allImages)];
    const duplicateCount = allImages.length - uniqueImages.length;
    
    console.log(`\n🔍 图片重复检查:`);
    console.log(`   - 唯一图片数: ${uniqueImages.length}`);
    console.log(`   - 重复图片数: ${duplicateCount}`);
    console.log(`   - 重复率: ${((duplicateCount / allImages.length) * 100).toFixed(1)}%`);
    
    // 显示前10个案例的详细信息
    console.log(`\n📋 前10个案例详情:`);
    cases.slice(0, 10).forEach((caseItem, index) => {
      console.log(`\n${index + 1}. ${caseItem.title}`);
      console.log(`   📷 图片数: ${caseItem.images.length}`);
      console.log(`   📝 Prompt数: ${caseItem.prompts.length}`);
      console.log(`   🎯 分类: ${caseItem.categoryName}`);
      console.log(`   🔗 来源: ${caseItem.sourceUrl}`);
      
      if (caseItem.images.length > 0) {
        console.log(`   🖼️  前3张图片:`);
        caseItem.images.slice(0, 3).forEach((img, idx) => {
          console.log(`     ${idx + 1}. ${img.substring(0, 80)}...`);
        });
      }
      
      if (caseItem.prompts.length > 0) {
        console.log(`   📝 第一个Prompt:`);
        const firstPrompt = caseItem.prompts[0];
        console.log(`     ${firstPrompt.substring(0, 100)}${firstPrompt.length > 100 ? '...' : ''}`);
      }
    });
    
    // 检查是否达到46个案例的目标
    const targetCases = 46;
    const successRate = (cases.length / targetCases) * 100;
    
    console.log(`\n🎯 目标达成情况:`);
    console.log(`   - 目标案例数: ${targetCases}`);
    console.log(`   - 实际案例数: ${cases.length}`);
    console.log(`   - 达成率: ${successRate.toFixed(1)}%`);
    
    if (cases.length >= targetCases * 0.9) {
      console.log(`✅ 成功提取了足够的案例！`);
    } else {
      console.log(`⚠️  案例数量不足，需要检查提取逻辑`);
    }
    
    // 保存测试结果
    const testResult = {
      timestamp: new Date().toISOString(),
      totalCases: cases.length,
      totalImages: totalImages,
      totalPrompts: totalPrompts,
      duration: duration,
      avgImagesPerCase: parseFloat(avgImages),
      avgPromptsPerCase: parseFloat(avgPrompts),
      casesWithImages: casesWithImages,
      casesWithPrompts: casesWithPrompts,
      duplicateImages: duplicateCount,
      successRate: successRate,
      cases: cases.map(c => ({
        title: c.title,
        imageCount: c.images.length,
        promptCount: c.prompts.length,
        category: c.categoryName
      }))
    };
    
    fs.writeFileSync('test-zho-results.json', JSON.stringify(testResult, null, 2));
    console.log(`\n💾 测试结果已保存到 test-zho-results.json`);
    
    console.log(`\n✅ 测试完成！`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testZHOExtraction();
