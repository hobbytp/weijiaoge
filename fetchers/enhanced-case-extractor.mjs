// fetchers/enhanced-case-extractor.mjs
// 增强的案例提取器，支持更多格式和智能解析

import { extractCasesFromGitHubReadme } from './case-extractor.mjs';

// 增强的prompt模式，支持更多格式
const ENHANCED_PROMPT_PATTERNS = [
  // 标准格式
  /```(?:yaml|json|text|prompt)?\s*([^`]+?)\s*```/gis,
  /```\s*([^`]+?)\s*```/gis,
  
  // 带标签的格式
  /(?:prompt|提示词)[：:]\s*```\s*([^`]+?)\s*```/gis,
  /(?:prompt|提示词)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
  
  // 引号格式
  /"(?:prompt|提示词)"[：:]\s*"([^"]+?)"/gis,
  /'(?:prompt|提示词)'[：:]\s*'([^']+?)'/gis,
  
  // 列表格式
  /(?:prompt|提示词)[：:]\s*\n\s*[-*]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
  
  // 段落格式
  /(?:prompt|提示词)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
  
  // 特殊格式（如Reddit等）
  /^>\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gims,
  
  // 代码块内的prompt
  /prompt[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis
];

// 增强的效果描述模式
const ENHANCED_EFFECT_PATTERNS = [
  /(?:效果|结果|描述|说明)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
  /(?:effect|result|description)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
  /(?:用途|应用|场景)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis,
  /(?:use case|application|scenario)[：:]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gis
];

// 增强的图片模式
const ENHANCED_IMAGE_PATTERNS = [
  /!\[([^\]]*)\]\(([^)]+)\)/g,
  /<img[^>]+src="([^"]+)"[^>]*>/g,
  /src="([^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
  /(?:图片|image|photo)[：:]\s*([^\s]+)/gis
];

// 智能文本清理
function smartCleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[ \u3000]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 智能prompt验证
function isValidPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  
  const cleaned = smartCleanText(prompt);
  
  // 基本长度检查
  if (cleaned.length < 10 || cleaned.length > 2000) return false;
  
  // 排除明显不是prompt的内容
  const excludePatterns = [
    /^(?:点击|click|查看|view|更多|more)/i,
    /^(?:http|https|www\.)/i,
    /^(?:作者|author|来源|source)/i,
    /^(?:标签|tag|分类|category)/i,
    /^(?:日期|date|时间|time)/i
  ];
  
  for (const pattern of excludePatterns) {
    if (pattern.test(cleaned)) return false;
  }
  
  // 检查是否包含nano banana相关内容
  const nanoBananaKeywords = [
    'nano banana',
    'nanobanana',
    'nano-banana',
    'nano_banana'
  ];
  
  const hasNanoBanana = nanoBananaKeywords.some(keyword => 
    cleaned.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return hasNanoBanana;
}

// 智能案例分类
function smartCategorizeCase(title, content, prompt) {
  const text = `${title} ${content} ${prompt}`.toLowerCase();
  
  const categories = {
    'figurine': ['3d', 'figurine', 'figure', 'model', 'sculpture', '手办', '模型', '雕塑'],
    'character': ['character', 'person', 'face', 'portrait', '人物', '角色', '肖像', '面部'],
    'style': ['style', 'art', 'painting', 'artistic', '风格', '艺术', '绘画', '画风'],
    'enhancement': ['enhance', 'improve', 'quality', 'resolution', '增强', '改善', '质量', '分辨率'],
    'clothing': ['clothing', 'dress', 'outfit', 'fashion', '衣服', '服装', '穿搭', '时尚'],
    'scene': ['background', 'scene', 'environment', '背景', '场景', '环境'],
    'composition': ['pose', 'action', 'movement', 'gesture', '姿势', '动作', '姿态'],
    'other': ['age', 'young', 'old', 'aging', '性别', '男性', '女性', 'retro', 'vintage', 'classic', 'old', '复古', '经典', '怀旧', 'fantasy', 'creature', 'monster', 'dragon', '奇幻', '生物', '怪物', '龙', 'anime', 'manga', 'cartoon', '动漫', '漫画', '卡通']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  
  return 'general';
}

// 增强的案例提取
export function extractEnhancedCases(content, sourceInfo = {}) {
  const cases = [];
  
  if (!content || typeof content !== 'string') {
    return cases;
  }
  
  // 如果是GitHub README，使用专门的解析器
  if (sourceInfo.type === 'github-readme') {
    const githubCases = extractCasesFromGitHubReadme({
      title: sourceInfo.title || 'GitHub README',
      description: content,
      url: sourceInfo.url || ''
    });
    
    // 转换格式以匹配增强提取器的格式
    return githubCases.map(caseItem => ({
      ...caseItem,
      confidence: calculateConfidence(caseItem.prompt, caseItem.effects, caseItem.images),
      extractedAt: new Date().toISOString()
    }));
  }
  
  const cleanedContent = smartCleanText(content);
  
  // 尝试多种prompt提取模式
  for (const pattern of ENHANCED_PROMPT_PATTERNS) {
    let match;
    while ((match = pattern.exec(cleanedContent)) !== null) {
      const prompt = smartCleanText(match[1]);
      
      if (isValidPrompt(prompt)) {
        // 提取效果描述
        const effects = [];
        for (const effectPattern of ENHANCED_EFFECT_PATTERNS) {
          const effectMatch = effectPattern.exec(cleanedContent);
          if (effectMatch) {
            effects.push(smartCleanText(effectMatch[1]));
          }
        }
        
        // 提取图片
        const images = [];
        for (const imagePattern of ENHANCED_IMAGE_PATTERNS) {
          let imageMatch;
          while ((imageMatch = imagePattern.exec(cleanedContent)) !== null) {
            const imageUrl = imageMatch[2] || imageMatch[1];
            if (imageUrl && imageUrl.startsWith('http')) {
              images.push(imageUrl);
            }
          }
        }
        
        // 生成案例标题
        const title = generateCaseTitle(prompt, sourceInfo);
        
        // 智能分类
        const category = smartCategorizeCase(title, cleanedContent, prompt);
        
        const caseItem = {
          id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title,
          prompt,
          effects: effects.length > 0 ? effects : ['使用nano banana进行图像处理'],
          images,
          category,
          source: sourceInfo.url || 'unknown',
          sourceType: sourceInfo.type || 'web',
          extractedAt: new Date().toISOString(),
          confidence: calculateConfidence(prompt, effects, images)
        };
        
        cases.push(caseItem);
      }
    }
  }
  
  return cases;
}

// 生成案例标题
function generateCaseTitle(prompt, sourceInfo) {
  // 从prompt中提取关键词
  const keywords = prompt.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 5);
  
  // 基于关键词生成标题
  if (keywords.length > 0) {
    return keywords.join(' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // 基于来源生成标题
  if (sourceInfo.title) {
    return sourceInfo.title;
  }
  
  return 'Nano Banana 使用案例';
}

// 计算置信度
function calculateConfidence(prompt, effects, images) {
  let confidence = 0.5; // 基础置信度
  
  // prompt质量
  if (prompt && prompt.length > 50) confidence += 0.2;
  if (prompt && prompt.length > 100) confidence += 0.1;
  
  // 效果描述
  if (effects && effects.length > 0) confidence += 0.1;
  if (effects && effects.length > 1) confidence += 0.1;
  
  // 图片
  if (images && images.length > 0) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

// 批量处理多个内容源
export async function processMultipleSources(sources) {
  const allCases = [];
  
  for (const source of sources) {
    try {
      const cases = extractEnhancedCases(source.content, source);
      allCases.push(...cases);
      console.log(`从 ${source.url || source.title} 提取了 ${cases.length} 个案例`);
    } catch (error) {
      console.error(`处理源失败: ${source.url || source.title}`, error);
    }
  }
  
  return allCases;
}

// 导出主要功能
export {
    isValidPrompt,
    smartCategorizeCase, smartCleanText
};

