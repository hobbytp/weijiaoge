// fetchers/case-extractor.mjs
// 从网页内容中提取Nano Banana使用案例

import fs from 'fs';
import path from 'path';

// 案例分类定义
const CASE_CATEGORIES = {
  'figurine': '3D手办制作',
  'clothing': '服装替换',
  'scene': '场景合成',
  'style': '风格转换',
  'character': '角色编辑',
  'background': '背景替换',
  'composition': '图像合成',
  'enhancement': '图像增强',
  'other': '其他'
};

// 提取prompt的正则表达式模式
const PROMPT_PATTERNS = [
  /prompt[:\s]*["']([^"']+)["']/gi,
  /输入[:\s]*["']([^"']+)["']/gi,
  /提示词[:\s]*["']([^"']+)["']/gi,
  /"([^"]*create[^"]*figurine[^"]*)"/gi,
  /"([^"]*turn[^"]*into[^"]*)"/gi,
  /"([^"]*make[^"]*look[^"]*)"/gi,
  /"([^"]*transform[^"]*)"/gi,
  /"([^"]*generate[^"]*)"/gi
];

// 提取效果描述的模式
const EFFECT_PATTERNS = [
  /效果[:\s]*([^。！？\n]+)/gi,
  /结果[:\s]*([^。！？\n]+)/gi,
  /生成[:\s]*([^。！？\n]+)/gi,
  /转换[:\s]*([^。！？\n]+)/gi,
  /制作[:\s]*([^。！？\n]+)/gi
];

// 提取图片URL的模式
const IMAGE_PATTERNS = [
  /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
  /!\[[^\]]*\]\(([^)]+)\)/gi,
  /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi
];

function extractPrompts(text) {
  const prompts = [];
  for (const pattern of PROMPT_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const prompt = match[1].trim();
      if (prompt.length > 10 && prompt.length < 500) {
        prompts.push(prompt);
      }
    }
  }
  return [...new Set(prompts)]; // 去重
}

function extractEffects(text) {
  const effects = [];
  for (const pattern of EFFECT_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const effect = match[1].trim();
      if (effect.length > 5 && effect.length < 200) {
        effects.push(effect);
      }
    }
  }
  return [...new Set(effects)];
}

function extractImages(text) {
  const images = [];
  for (const pattern of IMAGE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const imageUrl = match[1].trim();
      if (imageUrl.startsWith('http')) {
        images.push(imageUrl);
      }
    }
  }
  return [...new Set(images)];
}

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
  
  return 'other';
}

export function extractCaseFromContent(item) {
  const { title, description, url } = item;
  const fullText = `${title} ${description}`;
  
  const prompts = extractPrompts(fullText);
  const effects = extractEffects(fullText);
  const images = extractImages(fullText);
  
  // 如果没有找到明确的prompt，尝试从描述中推断
  if (prompts.length === 0 && description) {
    // 查找包含动作的描述
    const actionPatterns = [
      /create[^.]*figurine[^.]*/gi,
      /turn[^.]*into[^.]*/gi,
      /make[^.]*look[^.]*/gi,
      /transform[^.]*/gi,
      /generate[^.]*/gi
    ];
    
    for (const pattern of actionPatterns) {
      const match = pattern.exec(description);
      if (match) {
        prompts.push(match[0].trim());
      }
    }
  }
  
  // 如果没有找到效果描述，从标题和描述中推断
  if (effects.length === 0) {
    if (title.includes('figurine') || title.includes('手办')) {
      effects.push('将普通照片转换为精美的3D手办模型');
    }
    if (title.includes('clothing') || title.includes('outfit')) {
      effects.push('替换人物服装，保持人物特征不变');
    }
    if (title.includes('scene') || title.includes('场景')) {
      effects.push('将人物放置到新的场景环境中');
    }
  }
  
  const category = categorizeCase(title, description, prompts);
  
  return {
    id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: title,
    category: category,
    categoryName: CASE_CATEGORIES[category],
    prompts: prompts,
    effects: effects,
    images: images,
    sourceUrl: url,
    source: item.source || 'web',
    extractedAt: new Date().toISOString(),
    originalItem: item
  };
}

export function processItemsForCases(items) {
  const cases = [];
  
  for (const item of items) {
    try {
      const caseData = extractCaseFromContent(item);
      
      // 只保留有prompt或有效果描述的案例
      if (caseData.prompts.length > 0 || caseData.effects.length > 0) {
        cases.push(caseData);
      }
    } catch (error) {
      console.error(`处理项目失败: ${item.title}`, error);
    }
  }
  
  return cases;
}
