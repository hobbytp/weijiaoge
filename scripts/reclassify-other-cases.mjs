#!/usr/bin/env node

import fs from 'fs';

// 导入分类函数

// 新的分类逻辑
function categorizeCase(title, description, prompts) {
  const text = (title + ' ' + description + ' ' + prompts.join(' ')).toLowerCase();
  
  if (text.includes('figurine') || text.includes('手办') || text.includes('3d')) {
    return 'figurine';
  }
  if (text.includes('clothing') || text.includes('outfit') || text.includes('衣服') || text.includes('服装')) {
    return 'clothing';
  }
  if (text.includes('scene') || text.includes('场景') || text.includes('background') || text.includes('背景')) {
    return 'scene';
  }
  if (text.includes('style') || text.includes('风格') || text.includes('artistic')) {
    return 'style';
  }
  if (text.includes('character') || text.includes('角色') || text.includes('person')) {
    return 'character';
  }
  if (text.includes('composition') || text.includes('合成') || text.includes('combine')) {
    return 'composition';
  }
  if (text.includes('enhance') || text.includes('enhancement') || text.includes('增强')) {
    return 'enhancement';
  }
  
  // 新增细化分类
  if (text.includes('design') || text.includes('设计') || text.includes('包装') || text.includes('工业设计') || 
      text.includes('产品设计') || text.includes('包装设计') || text.includes('卡片设计') || text.includes('包装生成')) {
    return 'design';
  }
  if (text.includes('教育') || text.includes('教学') || text.includes('分析') || text.includes('批注') || 
      text.includes('标注') || text.includes('卡路里') || text.includes('批改')) {
    return 'education';
  }
  if (text.includes('广告') || text.includes('营销') || text.includes('信息图') || text.includes('商业') || 
      text.includes('广告短片') || text.includes('商品') || text.includes('business')) {
    return 'business';
  }
  if (text.includes('技术') || text.includes('参数') || text.includes('设置') || text.includes('拆解') || 
      text.includes('硬件') || text.includes('相机') || text.includes('technical') || text.includes('iso')) {
    return 'technical';
  }
  if (text.includes('艺术') || text.includes('绘画') || text.includes('插画') || text.includes('漫画') || 
      text.includes('artistic') || text.includes('painting') || text.includes('illustration') || text.includes('drawing')) {
    return 'artistic';
  }
  
  return 'other';
}

async function reclassifyOtherCases() {
  console.log('🔄 开始重新分类"其他"类别案例...');
  
  // 读取现有的cases.json
  const casesData = JSON.parse(fs.readFileSync('./public/cases.json', 'utf8'));
  
  // 找到所有"其他"类别的案例
  const otherCases = casesData.cases.filter(c => c.category === 'other');
  console.log(`📊 找到 ${otherCases.length} 个"其他"类别案例`);
  
  // 重新分类
  let reclassifiedCount = 0;
  const categoryStats = {};
  
  for (const caseItem of casesData.cases) {
    if (caseItem.category === 'other') {
      const newCategory = categorizeCase(
        caseItem.title || '',
        caseItem.effects ? caseItem.effects.join(' ') : '',
        caseItem.prompts || []
      );
      
      if (newCategory !== 'other') {
        caseItem.category = newCategory;
        reclassifiedCount++;
        
        // 统计新分类
        categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1;
        
        console.log(`✅ 重新分类: "${caseItem.title}" -> ${newCategory}`);
      }
    }
  }
  
  // 更新分类列表
  const allCategories = [...new Set(casesData.cases.map(c => c.category))];
  casesData.categories = allCategories;
  
  // 保存更新后的数据
  fs.writeFileSync('./public/cases.json', JSON.stringify(casesData, null, 2));
  
  console.log('\n📊 重新分类统计:');
  console.log(`总重新分类案例数: ${reclassifiedCount}`);
  console.log('各新分类案例数:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} 个案例`);
  });
  
  // 统计最终分类情况
  const finalStats = {};
  casesData.cases.forEach(c => {
    finalStats[c.category] = (finalStats[c.category] || 0) + 1;
  });
  
  console.log('\n📈 最终分类统计:');
  Object.entries(finalStats).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} 个案例`);
  });
  
  console.log('\n✅ 重新分类完成！');
}

// 运行重新分类
reclassifyOtherCases().catch(console.error);
