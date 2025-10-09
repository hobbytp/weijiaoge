// fetchers/case-extractor.mjs
// 从网页内容中提取Nano Banana使用案例


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
  'design': '设计相关',
  'education': '教育相关',
  'business': '商业相关',
  'technical': '技术相关',
  'artistic': '艺术相关',
  'other': '其他'
};

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
  
  // 新增细化分类
  if (text.includes('design') || text.includes('设计') || text.includes('包装') || text.includes('工业设计') || 
      text.includes('产品设计') || text.includes('包装设计') || text.includes('卡片设计') || text.includes('包装生成')) {
    return 'design';
  }
  if (text.includes('教育') || text.includes('教学') || text.includes('分析') || text.includes('批注') || 
      text.includes('标注') || text.includes('卡路里') || text.includes('批改') || text.includes('教学')) {
    return 'education';
  }
  if (text.includes('广告') || text.includes('营销') || text.includes('信息图') || text.includes('商业') || 
      text.includes('广告短片') || text.includes('商品') || text.includes('营销') || text.includes('business')) {
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

// 专门处理GitHub README的函数
export function extractCasesFromGitHubReadme(item) {
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
    return extractZHOFormat(fullText, item);
  }
  return cases;
}

// 处理ZHO仓库格式
function extractZHOFormat(fullText, item) {
  const cases = [];
  const seenTitles = new Set(); // 用于跟踪已见过的标题
  
  // 按章节分割内容（以数字开头的章节）
  const sections = fullText.split(/(?=\d+️⃣)/);
  
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
    
    // 在章节内容中查找prompt - 更精确的匹配
    const promptPattern = /Prompt[：:]\s*```\s*([^`]+?)\s*```/gis;
    let promptMatch;
    
    while ((promptMatch = promptPattern.exec(sectionContent)) !== null) {
      const promptText = promptMatch[1].trim();
      
      if (promptText.length > 20) {
        const category = categorizeCase(sectionTitle, sectionContent, [promptText]);
        const effects = extractEffects(sectionContent);
        const images = extractImages(sectionContent);
        
        cases.push({
          id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: sectionTitle,
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
        const images = extractImages(sectionContent);
        
        cases.push({
          id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: sectionTitle,
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
        const images = extractImages(sectionContent);
        
        cases.push({
          id: `case:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: sectionTitle,
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
      const images = extractImages(fullText);
      const category = categorizeCase(title, description, [prompt]);
      
      // 为每个prompt生成一个独特的标题
      let caseTitle = title;
      if (prompt.includes('Bollywood') || prompt.includes('1970s')) {
        caseTitle = `${title} - 宝莱坞复古风格`;
      } else if (prompt.includes('studio') || prompt.includes('portrait')) {
        caseTitle = `${title} - 工作室肖像`;
      } else if (prompt.includes('vintage') || prompt.includes('retro')) {
        caseTitle = `${title} - 复古风格`;
      } else if (prompt.includes('figurine') || prompt.includes('3D')) {
        caseTitle = `${title} - 3D手办制作`;
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
