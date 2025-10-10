import fs from 'fs';
import path from 'path';

// 读取cases.json
const casesPath = path.join(process.cwd(), 'public', 'cases.json');
const casesData = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

console.log('🔍 分析prompt重复情况...\n');

let totalCases = 0;
let casesWithDuplicates = 0;
let duplicatePatterns = [];

// 标准化文本函数
function normalizeText(text) {
  return text
    .replace(/^```[\s\S]*?\n/, '') // 移除开头的代码块标记
    .replace(/\n```$/, '') // 移除结尾的代码块标记
    .replace(/^`+|`+$/g, '') // 移除首尾的反引号
    .replace(/\s+/g, ' ') // 标准化空格
    .toLowerCase()
    .trim();
}

// 检查是否为截断的prompt
function isTruncatedPrompt(prompt1, prompt2) {
  const norm1 = normalizeText(prompt1);
  const norm2 = normalizeText(prompt2);
  
  // 检查一个是否是另一个的前缀
  return norm1.startsWith(norm2) || norm2.startsWith(norm1);
}

// 检查是否为中英文对照
function isBilingualPair(prompt1, prompt2) {
  // 简单检查：包含中文字符和英文字符，且用｜或|分隔
  const hasChinese1 = /[\u4e00-\u9fff]/.test(prompt1);
  const hasEnglish1 = /[a-zA-Z]/.test(prompt1);
  const hasChinese2 = /[\u4e00-\u9fff]/.test(prompt2);
  const hasEnglish2 = /[a-zA-Z]/.test(prompt2);
  
  const hasSeparator1 = /[｜|]/.test(prompt1);
  const hasSeparator2 = /[｜|]/.test(prompt2);
  
  return (hasChinese1 && hasEnglish1 && hasSeparator1) || 
         (hasChinese2 && hasEnglish2 && hasSeparator2) ||
         (hasChinese1 && !hasEnglish1 && hasChinese2 && !hasEnglish2) ||
         (hasEnglish1 && !hasChinese1 && hasEnglish2 && !hasChinese2);
}

casesData.cases.forEach((caseItem, index) => {
  totalCases++;
  
  if (caseItem.prompts && caseItem.prompts.length > 1) {
    const prompts = caseItem.prompts;
    let hasDuplicates = false;
    
    // 检查所有prompt对
    for (let i = 0; i < prompts.length; i++) {
      for (let j = i + 1; j < prompts.length; j++) {
        const prompt1 = prompts[i];
        const prompt2 = prompts[j];
        
        // 完全相同
        if (normalizeText(prompt1) === normalizeText(prompt2)) {
          hasDuplicates = true;
          duplicatePatterns.push({
            title: caseItem.title,
            type: 'exact_duplicate',
            prompt1: prompt1.substring(0, 100) + '...',
            prompt2: prompt2.substring(0, 100) + '...'
          });
        }
        // 截断的prompt
        else if (isTruncatedPrompt(prompt1, prompt2)) {
          hasDuplicates = true;
          duplicatePatterns.push({
            title: caseItem.title,
            type: 'truncated',
            prompt1: prompt1.substring(0, 100) + '...',
            prompt2: prompt2.substring(0, 100) + '...'
          });
        }
        // 中英文对照（可能是有意的）
        else if (isBilingualPair(prompt1, prompt2)) {
          duplicatePatterns.push({
            title: caseItem.title,
            type: 'bilingual',
            prompt1: prompt1.substring(0, 100) + '...',
            prompt2: prompt2.substring(0, 100) + '...'
          });
        }
      }
    }
    
    if (hasDuplicates) {
      casesWithDuplicates++;
    }
  }
});

console.log(`📊 统计结果:`);
console.log(`总案例数: ${totalCases}`);
console.log(`有重复prompt的案例数: ${casesWithDuplicates}`);
console.log(`重复率: ${((casesWithDuplicates / totalCases) * 100).toFixed(2)}%\n`);

console.log(`🔍 重复模式分析:`);
const patternCounts = {};
duplicatePatterns.forEach(pattern => {
  patternCounts[pattern.type] = (patternCounts[pattern.type] || 0) + 1;
});

Object.entries(patternCounts).forEach(([type, count]) => {
  const typeName = {
    'exact_duplicate': '完全重复',
    'truncated': '截断重复',
    'bilingual': '中英文对照'
  }[type] || type;
  console.log(`${typeName}: ${count} 个`);
});

console.log(`\n📝 详细重复案例:`);
duplicatePatterns.forEach((pattern, index) => {
  if (index < 10) { // 只显示前10个
    console.log(`${index + 1}. ${pattern.title} (${pattern.type})`);
    console.log(`   Prompt 1: ${pattern.prompt1}`);
    console.log(`   Prompt 2: ${pattern.prompt2}\n`);
  }
});

if (duplicatePatterns.length > 10) {
  console.log(`... 还有 ${duplicatePatterns.length - 10} 个重复案例`);
}