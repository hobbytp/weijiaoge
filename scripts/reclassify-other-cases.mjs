#!/usr/bin/env node

import fs from 'fs';
import { categorizeCase } from '../fetchers/case-categorizer.mjs';

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
