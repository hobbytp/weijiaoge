// fetchers/domain-plugins.mjs
// 域名特定的内容解析插件

// 通用工具函数
function extractTextContent(element) {
  if (!element) return '';
  return element.textContent?.trim() || '';
}

function extractHtmlContent(element) {
  if (!element) return '';
  return element.innerHTML || '';
}

function findBestSelector(dom, selectors) {
  for (const selector of selectors) {
    const element = dom.querySelector(selector);
    if (element) return element;
  }
  return null;
}

// GitHub 插件
export function createGitHubPlugin() {
  return (dom, url) => {
    // 检查是否是仓库页面
    const isRepoPage = dom.querySelector('.repository-content') || dom.querySelector('#readme');
    
    if (!isRepoPage) {
      // 如果不是仓库页面，返回null
      return null;
    }
    
    const content = findBestSelector(dom, [
      '#readme .markdown-body',
      '.markdown-body',
      '#readme',
      'article',
      '.repository-content'
    ]);
    
    if (content) {
      // 获取仓库名称作为标题
      const repoTitle = findBestSelector(dom, [
        'h1[data-pjax="#js-repo-pjax-container"]',
        '.repository-content h1',
        'h1 strong a',
        'h1'
      ])?.textContent?.trim();
      
      const repository = extractRepositoryFromUrl(url);
      const title = repoTitle || repository || 'GitHub README';
      
      return {
        title,
        content: extractTextContent(content),
        html: extractHtmlContent(content),
        type: 'github-readme',
        metadata: {
          repository: repository,
          hasCodeBlocks: content.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// Reddit 插件
export function createRedditPlugin() {
  return (dom, url) => {
    const content = findBestSelector(dom, [
      '[data-testid="post-content"]',
      '.usertext-body',
      '.md',
      '.post-content'
    ]);
    
    if (content) {
      const title = findBestSelector(dom, [
        'h1',
        '[data-testid="post-title"]',
        '.title'
      ])?.textContent?.trim() || 'Reddit Post';
      
      return {
        title,
        content: extractTextContent(content),
        html: extractHtmlContent(content),
        type: 'reddit-post',
        metadata: {
          subreddit: extractSubredditFromUrl(url),
          hasCodeBlocks: content.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// Analytics Vidhya 插件
export function createAnalyticsVidhyaPlugin() {
  return (dom, url) => {
    const content = findBestSelector(dom, [
      'article',
      '.entry-content',
      '.post-content',
      '.article-content'
    ]);
    
    if (content) {
      const title = findBestSelector(dom, [
        'h1',
        '.entry-title',
        '.post-title'
      ])?.textContent?.trim() || 'Article';
      
      return {
        title,
        content: extractTextContent(content),
        html: extractHtmlContent(content),
        type: 'article',
        metadata: {
          author: findBestSelector(dom, ['.author', '.byline'])?.textContent?.trim(),
          publishDate: findBestSelector(dom, ['.date', '.published'])?.textContent?.trim(),
          hasCodeBlocks: content.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// Medium 插件
export function createMediumPlugin() {
  return (dom, url) => {
    const content = findBestSelector(dom, [
      'article',
      '.postArticle-content',
      '.section-content'
    ]);
    
    if (content) {
      const title = findBestSelector(dom, [
        'h1',
        '.graf--title'
      ])?.textContent?.trim() || 'Medium Article';
      
      return {
        title,
        content: extractTextContent(content),
        html: extractHtmlContent(content),
        type: 'article',
        metadata: {
          author: findBestSelector(dom, ['.author', '.byline'])?.textContent?.trim(),
          hasCodeBlocks: content.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// Dev.to 插件
export function createDevToPlugin() {
  return (dom, url) => {
    const content = findBestSelector(dom, [
      'article',
      '.article-body',
      '.crayons-article__body'
    ]);
    
    if (content) {
      const title = findBestSelector(dom, [
        'h1',
        '.crayons-article__title'
      ])?.textContent?.trim() || 'Dev.to Article';
      
      return {
        title,
        content: extractTextContent(content),
        html: extractHtmlContent(content),
        type: 'article',
        metadata: {
          author: findBestSelector(dom, ['.author', '.crayons-article__author'])?.textContent?.trim(),
          tags: Array.from(dom.querySelectorAll('.tag')).map(tag => tag.textContent?.trim()).filter(Boolean),
          hasCodeBlocks: content.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// 通用博客插件
export function createGenericBlogPlugin() {
  return (dom, url) => {
    const content = findBestSelector(dom, [
      'article',
      '.entry-content',
      '.post-content',
      '.content',
      '.main-content',
      '#content',
      '.article-body',
      '.post-body',
      '.blog-content'
    ]);
    
    if (content) {
      const title = findBestSelector(dom, [
        'h1',
        '.entry-title',
        '.post-title',
        '.article-title'
      ])?.textContent?.trim() || 
      dom.querySelector('title')?.textContent?.trim() || 'Blog Post';
      
      return {
        title,
        content: extractTextContent(content),
        html: extractHtmlContent(content),
        type: 'article',
        metadata: {
          author: findBestSelector(dom, ['.author', '.byline', '.post-author'])?.textContent?.trim(),
          publishDate: findBestSelector(dom, ['.date', '.published', '.post-date'])?.textContent?.trim(),
          hasCodeBlocks: content.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// 通用插件（后备）
export function createGenericPlugin() {
  return (dom, url) => {
    const body = dom.querySelector('body');
    if (body) {
      return {
        title: dom.querySelector('title')?.textContent?.trim() || 'Web Page',
        content: extractTextContent(body),
        html: extractHtmlContent(body),
        type: 'full-page',
        metadata: {
          hasCodeBlocks: body.querySelectorAll('pre code').length > 0
        }
      };
    }
    return null;
  };
}

// 工具函数
function extractRepositoryFromUrl(url) {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
}

function extractSubredditFromUrl(url) {
  const match = url.match(/reddit\.com\/r\/([^\/]+)/);
  return match ? match[1] : null;
}

// 插件注册表
export const DOMAIN_PLUGINS = {
  'github.com': createGitHubPlugin(),
  'reddit.com': createRedditPlugin(),
  'www.reddit.com': createRedditPlugin(),
  'analyticsvidhya.com': createAnalyticsVidhyaPlugin(),
  'www.analyticsvidhya.com': createAnalyticsVidhyaPlugin(),
  'medium.com': createMediumPlugin(),
  'dev.to': createDevToPlugin(),
  'www.dev.to': createDevToPlugin(),
  '*': createGenericPlugin() // 通用后备插件
};

