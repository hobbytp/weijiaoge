// fetchers/article-extractor.mjs
// 专门从重要文章中提取详细prompt内容

import { extractMultipleCasesFromArticle } from './case-extractor.mjs';
import { contentExtractor } from './content-fetcher.mjs';

// 已知包含详细prompt的重要文章
const IMPORTANT_ARTICLES = [
  {
    url: 'https://www.analyticsvidhya.com/blog/2025/09/nano-banana-retro-prompts/',
    title: '12 Nano Banana Prompts to Convert Your Photos into Retro Images',
    description: 'Turn yourself into a 1970s Bollywood superstar with Google\'s new Nano Banana AI and its ability to create retro images.',
    // 从网页搜索结果中提取的详细prompt内容
    fullContent: `
    **1. Bollywood-retro Look**
    **Prompt:**
    Create a full-length photorealistic image of the uploaded person as a 1970s Bollywood superstar. Scene: outside a Mumbai cinema hall during a film premiere, marquee glowing in neon, vintage Bollywood posters on the walls. The subject is styled in Western-inspired Bollywood glamour of the 1970s, a shimmering sequined evening gown or satin jumpsuit with flared bottoms, a feather boa or faux fur stole draped over the shoulders, and platform heels. Accessories include oversized tinted sunglasses, chunky jewellery, and a clutch bag. Hair styled in voluminous waves or a glamorous blow-dry, with bold eyeliner and glossy lipstick completing the look. Surround them with flashing cameras, paparazzi holding vintage film cameras, and a crowd of fans reaching out for autographs. Add authentic 1970s colour grading (warm tones, film grain, cinematic contrast). Capture the aura of a confident, glamorous star making a grand entrance – charismatic, stylish, and larger-than-life.

    **2. Moody Studio Portrait**
    **Prompt:**
    This is a photo of me. Craft a moody studio portrait of the uploaded person bathed in a golden-orange spotlight that creates a glowing circular halo behind them on the wall. The warm light should sculpt the face and upper body with soft, sunset-like tones while casting a strong head shadow to the right. Style the person in elegant, timeless fashion that complements the dramatic lighting.

    **3. Paris Night-Time Portrait**
    **Prompt:**
    Create an ultra-realistic night-time portrait from this photo, standing near the Arc de Triomphe at night. The person should be wearing a classic black evening dress with elegant accessories, bathed in the warm glow of Parisian streetlights and neon signs. The background should show the iconic monument with soft bokeh, creating a romantic, cinematic atmosphere with deep shadows and golden highlights.

    **4. The Vintage Gentleman**
    **Prompt:**
    Transform this photo into a sophisticated vintage gentleman portrait. The person should be wearing a tailored three-piece suit from the 1970s era, complete with wide lapels, a patterned tie, and polished leather shoes. The setting should be a classic library or study with warm wood tones, vintage books, and soft natural lighting. Add subtle film grain and warm color grading to enhance the retro aesthetic.

    **5. The Serene Sunset Look**
    **Prompt:**
    Create a softly lit portrait of the uploaded person standing indoors near a window with warm sunlight streaming through. Use a cinematic, golden-hour lighting style that highlights the face and hair with natural glow and soft shadows. The person should be wearing a loose, casual white shirt with slightly rolled-up sleeves. The mood should feel calm, dreamy, and natural, with soft depth of field and a warm, intimate atmosphere.

    **6. Retro Vinyl Lounge Vibe**
    **Prompt:**
    Create a hyper-realistic portrait of the uploaded person (preserve face 100%) styled as a 1970s retro icon. He is seated casually in a dimly lit lounge with vintage vinyl records stacked behind him, a glowing jukebox casting warm neon light across the scene. Outfit: open-collared patterned silk shirt, flared trousers, gold chain, and tinted aviator sunglasses. The lighting is warm amber with subtle film grain, evoking the ambience of old Bollywood jazz clubs. Pose is relaxed, with one arm resting on a velvet sofa and a confident half-smile.
    `
  }
];

export async function extractCasesFromImportantArticles(webItems = []) {
  const cases = [];
  
  // 处理预定义的重要文章
  for (const article of IMPORTANT_ARTICLES) {
    try {
      // 使用新的内容获取器获取完整内容
      const extractedContent = await contentExtractor.extractContent(article.url);
      
      if (extractedContent) {
        // 创建包含完整内容的item对象
        const itemWithFullContent = {
          ...article,
          title: extractedContent.title,
          description: extractedContent.content, // 使用提取的完整内容
          fullContent: extractedContent.content,
          metadata: extractedContent.metadata
        };
        
        // 使用多案例提取功能
        const extractedCases = extractMultipleCasesFromArticle(itemWithFullContent);
        cases.push(...extractedCases);
        
        console.log(`从文章 "${extractedContent.title}" 提取了 ${extractedCases.length} 个案例`);
      } else {
        // 如果无法获取内容，使用预定义的内容作为后备
        const itemWithFullContent = {
          ...article,
          description: article.fullContent
        };
        
        const extractedCases = extractMultipleCasesFromArticle(itemWithFullContent);
        cases.push(...extractedCases);
        
        console.log(`从预定义内容 "${article.title}" 提取了 ${extractedCases.length} 个案例`);
      }
    } catch (error) {
      console.error(`处理重要文章失败: ${article.title}`, error);
    }
  }
  
  // 处理GitHub仓库的README内容
  const githubReadmes = webItems.filter(item => 
    item.source === 'github' && 
    item.type === 'readme' && 
    item.fullContent
  );
  
  for (const readme of githubReadmes) {
    try {
      // 创建包含完整内容的item对象
      const itemWithFullContent = {
        ...readme,
        description: readme.fullContent // 使用完整README内容
      };
      
      // 使用多案例提取功能
      const extractedCases = extractMultipleCasesFromArticle(itemWithFullContent);
      cases.push(...extractedCases);
      
      console.log(`从GitHub仓库 "${readme.title}" 提取了 ${extractedCases.length} 个案例`);
    } catch (error) {
      console.error(`处理GitHub README失败: ${readme.title}`, error);
    }
  }
  
  return cases;
}
