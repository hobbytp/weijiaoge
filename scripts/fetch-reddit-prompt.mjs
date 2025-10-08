import { JSDOM } from 'jsdom';

const REDDIT_URL = 'https://www.reddit.com/r/Bard/comments/1ngm4rb/how_to_generate_nano_banana_3d_figurine/';

async function fetchRedditPrompt() {
  try {
    console.log('🔍 正在获取Reddit页面的完整prompt...');
    
    const response = await fetch(REDDIT_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // 查找包含prompt的文本
    const postContent = document.querySelector('[data-testid="post-content"]') || 
                       document.querySelector('.Post') ||
                       document.querySelector('[data-click-id="text"]');
    
    if (postContent) {
      const text = postContent.textContent;
      console.log('📝 找到的文本内容:');
      console.log(text);
      
      // 查找prompt模式
      const promptMatch = text.match(/Create a 1\/7 scale commercialized figurine[^.]*\./i);
      if (promptMatch) {
        console.log('\n🎯 找到的完整prompt:');
        console.log(promptMatch[0]);
        return promptMatch[0];
      }
    }
    
    console.log('❌ 未找到完整的prompt');
    return null;
    
  } catch (error) {
    console.error('❌ 获取Reddit内容失败:', error);
    return null;
  }
}

// 运行函数
fetchRedditPrompt();
