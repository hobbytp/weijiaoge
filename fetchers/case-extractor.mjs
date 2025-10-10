// fetchers/case-extractor.mjs
// 从网页内容中提取Nano Banana使用案例

// 智能Prompt提取函数 - 多层级策略
function extractPromptsIntelligently(content) {
  const prompts = [];
  
  // 策略1: 严格的Prompt模式匹配
  const strictPatterns = [
    /Prompt[：:]\s*```\s*([^`]+?)\s*```/gis,
    /\d+\)[^：:]*Prompt[：:]\s*```\s*([^`]+?)\s*```/gis,
    /Prompt[：:]\s*```\s*([^`]+?)\s*```/gis
  ];
  
  for (const pattern of strictPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const promptText = match[1].trim();
      if (promptText.length > 20 && !prompts.includes(promptText)) {
        prompts.push(promptText);
      }
    }
  }
  
  // 策略2: 宽松的代码块匹配 - 查找所有```代码块
  const codeBlocks = content.match(/```([^`]+?)```/gs);
  if (codeBlocks) {
    for (const block of codeBlocks) {
      const codeContent = block.replace(/```/g, '').trim();
      // 过滤掉明显不是prompt的内容
      if (codeContent.length > 20 && 
          !codeContent.includes('http') && 
          !codeContent.includes('github.com') &&
          !codeContent.includes('```') &&
          !codeContent.includes('<!---') &&
          !codeContent.includes('---') &&
          !prompts.includes(codeContent)) {
        prompts.push(codeContent);
      }
    }
  }
  
  // 策略3: 基于关键词的智能分割
  const promptSections = content.split(/(?:Prompt[：:]|prompt[：:]|输入[：:]|提示词[：:])/gi);
  for (let i = 1; i < promptSections.length; i++) {
    const section = promptSections[i];
    // 提取第一个代码块或长文本
    const codeMatch = section.match(/```([^`]+?)```/s);
    if (codeMatch) {
      const promptText = codeMatch[1].trim();
      if (promptText.length > 20 && !prompts.includes(promptText)) {
        prompts.push(promptText);
      }
    } else {
      // 如果没有代码块，提取前几行文本
      const lines = section.split('\n').slice(0, 5).join('\n').trim();
      if (lines.length > 20 && !prompts.includes(lines)) {
        prompts.push(lines);
      }
    }
  }
  
  // 策略4: 基于内容结构的智能提取
  const paragraphs = content.split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    if (paragraph.length > 50 && 
        (paragraph.includes('turn') || 
         paragraph.includes('create') || 
         paragraph.includes('generate') ||
         paragraph.includes('transform') ||
         paragraph.includes('make') ||
         paragraph.includes('convert'))) {
      const cleanText = paragraph.replace(/```/g, '').trim();
      if (cleanText.length > 20 && !prompts.includes(cleanText)) {
        prompts.push(cleanText);
      }
    }
  }
  
  return prompts;
}

// 导入共享的分类函数
import { CASE_CATEGORIES, categorizeCase } from './case-categorizer.mjs';
// 导入LangExtract
import { extractWithLangExtract } from './langextract-extractor.mjs';

// 重新导出以保持向后兼容
export { CASE_CATEGORIES };

// 提取prompt的正则表达式模式 - 更精确的匹配
const PROMPT_PATTERNS = [
  // 明确的prompt标记
  /prompt[:\s]*["']([^"']{20,})["']/gi,
  /输入[:\s]*["']([^"']{20,})["']/gi,
  /提示词[:\s]*["']([^"']{20,})["']/gi,
  /输入文本[:\s]*["']([^"']{20,})["']/gi,
  
  // 引号包围的完整描述性prompt
  /"([^"]{30,}(?:create|make|turn|transform|generate|edit|change|convert)[^"]{20,})"/gi,
  /"([^"]{30,}(?:figurine|character|scene|style|clothing|outfit)[^"]{20,})"/gi,
  
  // 代码块中的prompt
  /```[^`]*["']([^"']{30,})["'][^`]*```/gi,
  
  // 示例中的prompt
  /example[:\s]*["']([^"']{30,})["']/gi,
  /示例[:\s]*["']([^"']{30,})["']/gi,
  
  // 文章中的详细prompt（以**Prompt:**开头）
  /\*\*Prompt:\*\*\s*([^*]+?)(?=\*\*Output:\*\*|\*\*[A-Z]|\n\n|$)/gis,
  
  // 文章中的详细prompt（以Prompt:开头）
  /Prompt:\s*([^\n]+(?:\n(?!\n)[^\n]+)*?)(?=Output:|[A-Z][a-z]+:|$)/gis,
  
  // 长段落中的详细描述（包含具体操作指令）
  /(Create a [^.!?]*(?:full-length|portrait|image|photo)[^.!?]*(?:1970s|retro|vintage|Bollywood)[^.!?]*\.)/gi,
  /(Craft a [^.!?]*(?:moody|studio|portrait|image)[^.!?]*(?:golden|warm|lighting)[^.!?]*\.)/gi,
  /(Transform [^.!?]*(?:photo|image|person)[^.!?]*(?:into|as)[^.!?]*\.)/gi
];

// 排除的假prompt模式
const EXCLUDE_PATTERNS = [
  /^generateContent$/i,
  /^generateText$/i,
  /^model$/i,
  /^function$/i,
  /^api$/i,
  /^code$/i,
  /^example$/i,
  /^test$/i,
  /^demo$/i,
  /^sample$/i,
  /^[a-z_]+\(/i,  // 函数调用
  /^[A-Z][a-z]+[A-Z]/  // 驼峰命名
];

// 提取效果描述的模式 - 增强版
const EFFECT_PATTERNS = [
  // 中文效果描述
  /效果[:\s]*([^。！？\n]+)/gi,
  /结果[:\s]*([^。！？\n]+)/gi,
  /生成[:\s]*([^。！？\n]+)/gi,
  /转换[:\s]*([^。！？\n]+)/gi,
  /制作[:\s]*([^。！？\n]+)/gi,
  /变成[:\s]*([^。！？\n]+)/gi,
  /变成[:\s]*([^。！？\n]+)/gi,
  
  // 英文效果描述
  /result[:\s]*([^.!?\n]+)/gi,
  /effect[:\s]*([^.!?\n]+)/gi,
  /transform[:\s]*([^.!?\n]+)/gi,
  /convert[:\s]*([^.!?\n]+)/gi,
  /turn[:\s]*([^.!?\n]+)/gi,
  /make[:\s]*([^.!?\n]+)/gi,
  /create[:\s]*([^.!?\n]+)/gi,
  /generate[:\s]*([^.!?\n]+)/gi,
  
  // 描述性文本模式
  /(将[^。！？\n]{10,50})/gi,
  /(把[^。！？\n]{10,50})/gi,
  /(从[^。！？\n]{10,50})/gi,
  /(into[^.!?\n]{10,50})/gi,
  /(from[^.!?\n]{10,50})/gi,
  /(to[^.!?\n]{10,50})/gi
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
      
      // 检查长度和排除假prompt
      if (prompt.length >= 20 && prompt.length <= 500) {
        // 检查是否应该排除
        const shouldExclude = EXCLUDE_PATTERNS.some(excludePattern => 
          excludePattern.test(prompt)
        );
        
        if (!shouldExclude) {
          // 检查是否包含有意义的词汇
          const hasMeaningfulWords = /(create|make|turn|transform|generate|edit|change|convert|figurine|character|scene|style|clothing|outfit|person|image|photo|picture)/i.test(prompt);
          
          // 排除技术描述和代码片段
          const isTechnicalDescription = /(built on|using|technology|model|api|function|code|typescript|react|javascript)/i.test(prompt);
          const isCodeSnippet = /(gemini-2|generate-002|imagen|flash|preview)/i.test(prompt);
          
          if (hasMeaningfulWords && !isTechnicalDescription && !isCodeSnippet) {
            prompts.push(prompt);
          }
        }
      }
    }
  }
  return [...new Set(prompts)]; // 去重
}

function extractEffects(text) {
  const effects = [];
  
  // 使用模式匹配提取效果描述
  for (const pattern of EFFECT_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const effect = match[1].trim();
      if (effect.length > 5 && effect.length < 200) {
        effects.push(effect);
      }
    }
  }
  
  // 如果没有找到明确的效果描述，从标题和内容中推断
  if (effects.length === 0) {
    const inferredEffects = inferEffectsFromContent(text);
    effects.push(...inferredEffects);
  }
  
  return [...new Set(effects)];
}

// 清理标题，移除无意义的前缀和图片信息
function cleanTitle(title) {
  if (!title) return title;
  
  // 移除数字emoji前缀 (如 ⑥、1️⃣、2️⃣等)
  let cleaned = title.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d+️⃣\s]*/, '');
  
  // 移除常见的无意义前缀
  cleaned = cleaned.replace(/^(例\s*\d+[:：]\s*|Case\s*\d+[:：]\s*|案例\s*\d+[:：]\s*)/i, '');
  
  // 移除图片相关后缀
  cleaned = cleaned.replace(/\s*image[^a-zA-Z]*$/i, '');
  cleaned = cleaned.replace(/\s*图片[^a-zA-Z]*$/i, '');
  cleaned = cleaned.replace(/\s*艺术相关.*$/i, '');
  
  // 移除HTML标签（包括不完整的标签）
  cleaned = cleaned.replace(/<[^>]*$/g, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // 移除多余的空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// 从内容中推断效果描述
function inferEffectsFromContent(text) {
  const effects = [];
  const lowerText = text.toLowerCase();
  
  // 基于关键词推断效果
  const effectMappings = {
    'figurine': '将照片转换为精美的3D手办模型',
    '手办': '将照片转换为精美的3D手办模型',
    '3d': '转换为3D模型效果',
    'character': '角色编辑和特征保持',
    '角色': '角色编辑和特征保持',
    'clothing': '服装替换，保持人物特征不变',
    '服装': '服装替换，保持人物特征不变',
    'outfit': '服装替换，保持人物特征不变',
    'scene': '将人物放置到新的场景环境中',
    '场景': '将人物放置到新的场景环境中',
    'background': '背景替换和场景合成',
    '背景': '背景替换和场景合成',
    'style': '风格转换和艺术效果',
    '风格': '风格转换和艺术效果',
    'artistic': '艺术风格转换',
    'enhance': '图像增强和画质提升',
    '增强': '图像增强和画质提升',
    'high-definition': '高清画质提升',
    '高清': '高清画质提升',
    'realistic': '超写实照片级生成',
    '写实': '超写实照片级生成',
    'portrait': '专业肖像摄影效果',
    '肖像': '专业肖像摄影效果',
    'studio': '专业摄影棚效果',
    '摄影': '专业摄影效果',
    'design': '设计相关效果',
    '设计': '设计相关效果',
    'product': '产品设计效果',
    '产品': '产品设计效果',
    'packaging': '包装设计效果',
    '包装': '包装设计效果'
  };
  
  // 检查文本中的关键词并推断效果
  for (const [keyword, effect] of Object.entries(effectMappings)) {
    if (lowerText.includes(keyword)) {
      effects.push(effect);
    }
  }
  
  // 如果没有找到特定效果，提供通用描述
  if (effects.length === 0) {
    if (lowerText.includes('prompt') || lowerText.includes('提示')) {
      effects.push('基于提示词生成的效果');
    } else if (lowerText.includes('image') || lowerText.includes('图片')) {
      effects.push('图像处理和转换效果');
    } else {
      effects.push('AI生成的效果展示');
    }
  }
  
  return effects;
}

// 智能图片提取函数 - 针对不同布局优化
function extractImages(text, title = '', description = '') {
  const images = [];
  
  // 基础图片提取
  for (const pattern of IMAGE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const imageUrl = match[1].trim();
      if (imageUrl.startsWith('http')) {
        images.push(imageUrl);
      } else if (imageUrl.startsWith('images/')) {
        // 处理相对路径的图片，转换为GitHub完整URL
        const githubUrl = `https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/${imageUrl}`;
        images.push(githubUrl);
      }
    }
  }
  
  // 针对"效果图在前，prompt在后"布局的优化
  // 查找在prompt之前出现的图片
  const beforePromptPatterns = [
    // 查找prompt标记前的图片
    /<img[^>]+src=["']([^"']+)["'][^>]*>(?=[^<]*(?:prompt|输入|提示词|Prompt|Input))/gi,
    /!\[[^\]]*\]\(([^)]+)\)(?=[^<]*(?:prompt|输入|提示词|Prompt|Input))/gi,
    // 查找在"输入:"或"提示词:"之前的图片
    /<img[^>]+src=["']([^"']+)["'][^>]*>(?=[^<]*(?:输入:|提示词:|Prompt:|Input:))/gi,
    /!\[[^\]]*\]\(([^)]+)\)(?=[^<]*(?:输入:|提示词:|Prompt:|Input:))/gi
  ];
  
  for (const pattern of beforePromptPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const imageUrl = match[1].trim();
      if (imageUrl.startsWith('http')) {
        images.push(imageUrl);
      } else if (imageUrl.startsWith('images/')) {
        const githubUrl = `https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/${imageUrl}`;
        images.push(githubUrl);
      }
    }
  }
  
  // 针对"效果图在后，prompt在前"布局的优化
  // 查找在prompt之后出现的图片
  const afterPromptPatterns = [
    // 查找prompt标记后的图片
    /(?:prompt|输入|提示词|Prompt|Input)[^<]*<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
    /(?:prompt|输入|提示词|Prompt|Input)[^<]*!\[[^\]]*\]\(([^)]+)\)/gi,
    // 查找在"输出:"或"结果:"之后的图片
    /(?:输出:|结果:|Output:|Result:)[^<]*<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
    /(?:输出:|结果:|Output:|Result:)[^<]*!\[[^\]]*\]\(([^)]+)\)/gi
  ];
  
  for (const pattern of afterPromptPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const imageUrl = match[1].trim();
      if (imageUrl.startsWith('http')) {
        images.push(imageUrl);
      } else if (imageUrl.startsWith('images/')) {
        const githubUrl = `https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/${imageUrl}`;
        images.push(githubUrl);
      }
    }
  }
  
  // 查找高质量的效果图片（通常包含特定关键词）
  const effectImagePatterns = [
    // 查找包含"效果"、"结果"、"输出"等关键词的图片
    /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["'][^"']*(?:效果|结果|输出|展示|示例)[^"']*["']|title=["'][^"']*(?:效果|结果|输出|展示|示例)[^"']*["'])[^>]*>/gi,
    /!\[(?:效果|结果|输出|展示|示例)[^\]]*\]\(([^)]+)\)/gi,
    // 查找在特定区域内的图片
    /(?:效果图|结果图|输出图|展示图)[^<]*<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
    /(?:效果图|结果图|输出图|展示图)[^<]*!\[[^\]]*\]\(([^)]+)\)/gi
  ];
  
  for (const pattern of effectImagePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const imageUrl = match[1].trim();
      if (imageUrl.startsWith('http')) {
        images.push(imageUrl);
      } else if (imageUrl.startsWith('images/')) {
        const githubUrl = `https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/${imageUrl}`;
        images.push(githubUrl);
      }
    }
  }
  
  // 去重并返回
  return [...new Set(images)];
}

// 使用共享的分类函数

export function extractCaseFromContent(item) {
  const { title, description, url } = item;
  const fullText = `${title} ${description}`;
  
  const prompts = extractPrompts(fullText);
  const effects = extractEffects(fullText);
  const images = extractImages(fullText, title, description);
  
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
    title: cleanTitle(title),
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

// 专门处理GitHub README的函数
export async function extractCasesFromGitHubReadme(item) {
  const { title, description, url } = item;
  const cases = [];
  
  // 直接使用原始内容，不清理代码块，因为我们需要提取其中的prompt
  const fullText = description;
  
  // 检测README格式
  
  // 检测README格式并相应处理 - 优先检查更具体的格式
  if (fullText.includes('### 例 1:') || fullText.includes('### 例 2:')) {
    // PicoTrex仓库格式：使用"### 例 X:"
    return extractPicoTrexFormat(fullText, item);
  } else if (fullText.includes('Case 1:') || fullText.includes('Case 2:')) {
    // Super-Maker-AI仓库格式：使用"Case X:"
    return extractSuperMakerFormat(fullText, item);
  } else if (fullText.includes('1️⃣') || fullText.includes('2️⃣')) {
    // ZHO仓库格式：使用数字emoji
    return await extractZHOFormat(fullText, item);
  }
  return cases;
}

// 处理ZHO仓库格式
async function extractZHOFormat(fullText, item) {
  const cases = [];
  const seenTitles = new Set(); // 用于跟踪已见过的标题
  
  // 按章节分割内容（以数字开头的章节），并增加多种备选分割策略
  let sections = fullText.split(/(?=\d+️⃣)/);
  if (!sections || sections.length <= 1) {
    // 兼容 "### 1️⃣" 标题 或 "1. 标题" 的写法
    sections = fullText.split(/(?=^#{1,6}\s*\d+️⃣)|(?=^\s*\d+\.\s+)/m);
  }
  if (!sections || sections.length <= 1) {
    // 兼容中文编号样式：一、二、三、 或 1）
    sections = fullText.split(/(?=^[一二三四五六七八九十]+、)|(?=^\s*\d+\))/m);
  }
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // 提取章节标题
    const titleMatch = section.match(/^(\d+️⃣[^：:]+[：:]?)(.*)/s);
    if (!titleMatch) continue;
    
    let sectionTitle = titleMatch[1].replace(/[：:]/g, '').trim();
    const sectionContent = titleMatch[2];
    
    // 处理重复标题 - 为重复的案例添加后缀
    const originalTitle = sectionTitle;
    if (seenTitles.has(originalTitle)) {
      sectionTitle = sectionTitle + " (Duplicate)";
    }
    seenTitles.add(originalTitle);
    
    // 尝试LangExtract提取
    let prompts = [];
    let images = [];
    let effects = [];
    let langExtractSuccess = false;
    
    try {
      const langExtractResult = await extractWithLangExtract(sectionContent);
      if (langExtractResult.prompts && langExtractResult.prompts.length > 0) {
        prompts = langExtractResult.prompts.map(p => p.text);
        images = langExtractResult.images.map(img => img.url);
        effects = langExtractResult.effects.map(e => e.text);
        langExtractSuccess = true;
        console.log(`✅ LangExtract成功提取章节: ${sectionTitle}`);
      }
    } catch (error) {
      console.log(`⚠️ LangExtract失败，使用传统方法: ${sectionTitle} - ${error.message}`);
    }
    
    // 回退到传统提取方法
    if (!langExtractSuccess) {
      prompts = extractPromptsIntelligently(sectionContent);
      if (!prompts || prompts.length === 0) {
        const fallback = extractFallbackPrompt(sectionContent, sectionTitle);
        if (fallback) {
          prompts = [fallback];
        }
      }
      
      if (images.length === 0) {
        images = extractSectionImages(sectionContent);
      }
      
      if (effects.length === 0) {
        effects = extractEffects(sectionContent);
      }
    }
    
    // 创建每个章节一个案例
    if (prompts.length > 0) {
      const category = categorizeCase(sectionTitle, sectionContent, prompts);
      cases.push({
        id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: cleanTitle(sectionTitle),
        category: category,
        categoryName: CASE_CATEGORIES[category],
        prompts: prompts.slice(0, 3), // 最多3个prompt
        effects: effects.slice(0, 3),
        images: images.slice(0, 6), // 最多6张图片
        sourceUrl: item.url,
        source: item.source || 'github',
        extractedAt: new Date().toISOString(),
        originalItem: item
      });
    }
  }
  
  return cases;
}

// 新增：当智能提取失败时的 Prompt 回退推断
function extractFallbackPrompt(content, sectionTitle = '') {
  // 1) 直接查找“Prompt/输入/提示词”标记后的文本段
  const labelPattern = /(Prompt|提示词|输入)[：:]+\s*([^\n`]{20,})/i;
  const labelMatch = content.match(labelPattern);
  if (labelMatch) {
    const text = labelMatch[2].trim();
    if (text.length >= 20) return text;
  }
  
  // 2) 选取包含动作词的段落作为近似 Prompt
  const paragraphs = content.split(/\n\s*\n/);
  const actionWords = /(create|make|turn|transform|generate|convert|craft|render|produce|将|把|生成|转换|制作)/i;
  for (const p of paragraphs) {
    const cleaned = p.replace(/```[\s\S]*?```/g, '').trim();
    if (cleaned.length >= 30 && actionWords.test(cleaned)) {
      // 进一步排除技术段
      if (!/(api|function|代码|TypeScript|JavaScript|React|模型|Gemini|Imagen)/i.test(cleaned)) {
        return cleaned;
      }
    }
  }
  
  // 3) 没有明显标记时，取章节前若干行组合
  const firstLines = content.split('\n').slice(0, 6).join('\n').trim();
  if (firstLines.length >= 20) return firstLines;
  
  return null;
}
// 新增：提取案例特定图片的函数
function extractCaseSpecificImages(caseTitle, caseContent) {
  const images = [];
  
  // 清理标题，用于匹配
  const cleanTitle = caseTitle
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩\d+️⃣\s]/g, '') // 移除数字emoji
    .replace(/[（(].*?[）)]/g, '') // 移除括号内容
    .replace(/\s+/g, ' ') // 合并空格
    .trim();
  
  // 根据案例标题提取相关图片
  const titleKeywords = cleanTitle.split(/\s+/).filter(word => word.length > 1);
  
  // 查找包含案例标题关键词的图片
  const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  
  while ((match = imgPattern.exec(caseContent)) !== null) {
    const imgUrl = match[1];
    const imgTag = match[0];
    
    // 检查图片是否与当前案例相关
    let isRelevant = false;
    
    // 方法1: 检查图片周围的文本是否包含案例关键词
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(caseContent.length, match.index + 500);
    const context = caseContent.substring(contextStart, contextEnd).toLowerCase();
    
    // 检查上下文是否包含案例关键词
    for (const keyword of titleKeywords) {
      if (context.includes(keyword.toLowerCase())) {
        isRelevant = true;
        break;
      }
    }
    
    // 方法2: 检查图片alt属性
    const altMatch = imgTag.match(/alt="([^"]*)"/);
    if (altMatch) {
      const altText = altMatch[1].toLowerCase();
      for (const keyword of titleKeywords) {
        if (altText.includes(keyword.toLowerCase())) {
          isRelevant = true;
          break;
        }
      }
    }
    
    // 方法3: 对于ZHO仓库，使用案例编号匹配
    const caseNumberPattern = /[①②③④⑤⑥⑦⑧⑨⑩\d+️⃣]/;
    const caseNumberMatch = caseTitle.match(caseNumberPattern);
    
    if (caseNumberMatch) {
      const caseNumber = caseNumberMatch[0];
      // 查找包含该案例编号的图片
      const numberContextStart = Math.max(0, match.index - 200);
      const numberContextEnd = Math.min(caseContent.length, match.index + 200);
      const numberContext = caseContent.substring(numberContextStart, numberContextEnd);
      
      if (numberContext.includes(caseNumber)) {
        isRelevant = true;
      }
    }
    
    if (isRelevant && imgUrl.startsWith('http')) {
      images.push(imgUrl);
    }
  }
  
  // 去重
  return [...new Set(images)];
}

// 新增：提取章节内所有图片的函数（严格按章节边界）
function extractSectionImages(sectionContent) {
  const images = [];
  const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  
  while ((match = imgPattern.exec(sectionContent)) !== null) {
    const imgUrl = match[1];
    if (imgUrl && imgUrl.startsWith('http')) {
      images.push(imgUrl);
    }
  }
  
  // 也检查markdown图片语法
  const mdPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = mdPattern.exec(sectionContent)) !== null) {
    const imgUrl = match[2];
    if (imgUrl && imgUrl.startsWith('http')) {
      images.push(imgUrl);
    }
  }
  
  return [...new Set(images)]; // 去重
}

// 处理PicoTrex仓库格式
function extractPicoTrexFormat(fullText, item) {
  const cases = [];
  
  // 按案例分割内容 - 匹配 ### 例 X: 格式
  const sections = fullText.split(/(?=### 例 \d+:)/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // 提取案例标题 - 匹配 ### 例 X: [标题](链接)（by 作者）格式
    const titleMatch = section.match(/^### (例 \d+:[^）]*?)（by[^）]+）(.*)/s);
    if (!titleMatch) continue;
    
    const sectionTitle = titleMatch[1].trim();
    const sectionContent = titleMatch[2];
    
    // 在章节内容中查找prompt
    const promptPattern = /```\s*([^`]+?)\s*```/gis;
    let promptMatch;
    
    while ((promptMatch = promptPattern.exec(sectionContent)) !== null) {
      const promptText = promptMatch[1].trim();
      
      if (promptText.length > 20 && !promptText.includes('输入:') && !promptText.includes('输出:')) {
        const category = categorizeCase(sectionTitle, sectionContent, [promptText]);
        const effects = extractEffects(sectionContent);
        const images = extractImages(sectionContent, sectionTitle, sectionContent);
        
        cases.push({
          id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: cleanTitle(sectionTitle),
          category: category,
          categoryName: CASE_CATEGORIES[category],
          prompts: [promptText],
          effects: effects,
          images: images,
          sourceUrl: item.url,
          source: item.source || 'github',
          extractedAt: new Date().toISOString(),
          originalItem: item
        });
      }
    }
  }
  
  return cases;
}

// 处理Super-Maker-AI仓库格式
function extractSuperMakerFormat(fullText, item) {
  const cases = [];
  const seenTitles = new Set(); // 用于跟踪已见过的标题
  
  // 按案例分割内容
  const sections = fullText.split(/(?=Case \d+:)/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // 提取案例标题
    const titleMatch = section.match(/^(Case \d+:[^(]+)(\(by[^)]+\))?(.*)/s);
    if (!titleMatch) continue;
    
    let sectionTitle = titleMatch[1].trim();
    const sectionContent = titleMatch[3];
    
    // 处理重复标题 - 为重复的案例添加后缀
    const originalTitle = sectionTitle;
    if (seenTitles.has(originalTitle)) {
      sectionTitle = sectionTitle + " (Duplicate)";
    }
    seenTitles.add(originalTitle);
    
    // 在章节内容中查找prompt
    const promptPattern = /```yaml\s*([^`]+?)\s*```/gis;
    let promptMatch;
    
    while ((promptMatch = promptPattern.exec(sectionContent)) !== null) {
      const promptText = promptMatch[1].trim();
      
      if (promptText.length > 20) {
        const category = categorizeCase(sectionTitle, sectionContent, [promptText]);
        const effects = extractEffects(sectionContent);
        const images = extractImages(sectionContent, sectionTitle, sectionContent);
        
        cases.push({
          id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: cleanTitle(sectionTitle),
          category: category,
          categoryName: CASE_CATEGORIES[category],
          prompts: [promptText],
          effects: effects,
          images: images,
          sourceUrl: item.url,
          source: item.source || 'github',
          extractedAt: new Date().toISOString(),
          originalItem: item
        });
      }
    }
  }
  
  return cases;
}

// 新增：从单个文章中提取多个案例
export function extractMultipleCasesFromArticle(item) {
  const { title, description, url } = item;
  
  // 如果是GitHub README，使用专门的处理函数
  if (item.type === 'readme' || url.includes('github.com') || title.includes('README')) {
    return extractCasesFromGitHubReadme(item);
  }
  
  // 其他文章使用原来的逻辑
  const fullText = `${title} ${description}`;
  const cases = [];
  
  // 提取所有prompt
  const prompts = extractPrompts(fullText);
  
  // 如果找到了多个prompt，为每个prompt创建一个案例
  if (prompts.length > 1) {
    prompts.forEach((prompt, index) => {
      const effects = extractEffects(fullText);
      const images = extractImages(fullText, title, description);
      const category = categorizeCase(title, description, [prompt]);
      
      // 为每个prompt生成一个独特的标题
      let caseTitle = cleanTitle(title);
      if (prompt.includes('Bollywood') || prompt.includes('1970s')) {
        caseTitle = `${cleanTitle(title)} - 宝莱坞复古风格`;
      } else if (prompt.includes('studio') || prompt.includes('portrait')) {
        caseTitle = `${cleanTitle(title)} - 工作室肖像`;
      } else if (prompt.includes('vintage') || prompt.includes('retro')) {
        caseTitle = `${cleanTitle(title)} - 复古风格`;
      } else if (prompt.includes('figurine') || prompt.includes('3D')) {
        caseTitle = `${cleanTitle(title)} - 3D手办制作`;
      }
      
      cases.push({
        id: `case:${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        title: caseTitle,
        category: category,
        categoryName: CASE_CATEGORIES[category],
        prompts: [prompt],
        effects: effects,
        images: images,
        sourceUrl: url,
        source: item.source || 'web',
        extractedAt: new Date().toISOString(),
        originalItem: item
      });
    });
  } else if (prompts.length === 1) {
    // 只有一个prompt，使用原来的逻辑
    const caseData = extractCaseFromContent(item);
    cases.push(caseData);
  }
  
  return cases;
}

export function processItemsForCases(items) {
  const cases = [];
  
  for (const item of items) {
    try {
      // 使用新的多案例提取功能
      const extractedCases = extractMultipleCasesFromArticle(item);
      
      // 验证每个提取的案例
      extractedCases.forEach(caseData => {
        if (caseData.prompts.length > 0) {
          // 进一步验证prompt的质量
          const hasValidPrompts = caseData.prompts.some(prompt => {
            // 检查是否包含具体的操作指令
            const hasAction = /(create|make|turn|transform|generate|edit|change|convert|craft)/i.test(prompt);
            // 检查是否包含具体的目标对象
            const hasTarget = /(figurine|character|scene|style|clothing|outfit|person|image|photo|picture|3d|model|portrait|Bollywood|retro|vintage)/i.test(prompt);
            // 检查长度是否足够描述性
            const isDescriptive = prompt.length >= 30;
            
            // 排除技术描述
            const isNotTechnical = !/(built on|using|technology|model|api|function|code|typescript|react|javascript|gemini-2|generate-002|imagen|flash|preview)/i.test(prompt);
            
            // 检查是否像真正的用户prompt（包含形容词、名词等自然语言）
            const isNaturalLanguage = /(a|an|the|beautiful|stunning|amazing|cute|detailed|realistic|fantasy|anime|cartoon|full-length|photorealistic|moody|studio|golden|warm|vintage|retro|Bollywood|1970s)/i.test(prompt);
            
            return hasAction && hasTarget && isDescriptive && isNotTechnical && isNaturalLanguage;
          });
          
          if (hasValidPrompts) {
            cases.push(caseData);
          }
        }
      });
    } catch (error) {
      console.error(`处理项目失败: ${item.title}`, error);
    }
  }
  
  return cases;
}
