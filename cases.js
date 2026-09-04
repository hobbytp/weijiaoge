/* global window, document, fetch */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const searchInput = $('#search');
const categorySelect = $('#category');
const pathSelect = $('#path');
const sortSelect = $('#sort');
const stats = $('#stats');
const casesGrid = $('#cases-grid');

let casesData = { cases: [] };

// 解析Markdown链接格式的标题
function parseMarkdownTitle(title) {
  // 匹配 [标题](链接) 格式
  const markdownLinkRegex = /^\[([^\]]+)\]\(([^)]+)\)$/;
  const match = title.match(markdownLinkRegex);
  
  if (match) {
    return {
      text: match[1], // 提取标题文本
      url: match[2]   // 提取链接URL
    };
  }
  
  // 如果不是Markdown格式，返回原标题
  return {
    text: title,
    url: null
  };
}

// 从URL中提取作者名称
function extractAuthorFromUrl(url) {
  try {
    // 匹配 x.com/username 或 twitter.com/username 格式
    const twitterMatch = url.match(/(?:x\.com|twitter\.com)\/([^\/\?]+)/);
    if (twitterMatch) {
      return twitterMatch[1];
    }
    
    // 匹配 github.com/username 格式
    const githubMatch = url.match(/github\.com\/([^\/\?]+)/);
    if (githubMatch) {
      return githubMatch[1];
    }
    
    // 其他情况，尝试从域名后第一个路径段提取
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
    if (pathSegments.length > 0) {
      return pathSegments[0];
    }
  } catch (e) {
    // URL解析失败，返回null
  }
  
  return null;
}

// 从URL中提取简化的显示文本
function getSimplifiedSourceText(url) {
  if (!url || typeof url !== 'string') {
    return '未知来源';
  }
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const segments = urlObj.pathname.split('/').filter(Boolean);

    // GitHub: 只显示仓库名
    if (host === 'github.com' || host === 'raw.githubusercontent.com') {
      if (segments.length >= 2) {
        return segments[1]; // 只返回仓库名
      }
      return segments[0] || 'GitHub';
    }

    // X/Twitter: 显示为 "@用户名"
    if (host === 'x.com' || host === 'twitter.com') {
      return segments[0] ? `@${segments[0]}` : 'X/Twitter';
    }

    // Medium相关域名: 显示为 "Medium + 文章关键词"
    if (host.includes('medium.com') || host.includes('gitconnected.com')) {
      if (segments.length > 0) {
        // 提取路径中的关键词，通常是文章标题的一部分
        const articlePath = segments[segments.length - 1];
        // 提取前几个有意义的词汇
        const MAX_KEYWORDS_COUNT = 3; // 最大关键词数量
        const keywords = articlePath.split('-').slice(0, MAX_KEYWORDS_COUNT).join('-');
        return keywords.length > 20 ? keywords.substring(0, 20) + '...' : keywords;
      }
      return 'Medium';
    }

    // 其他域名: 显示域名，但限制长度
    const simplifiedHost = host.replace('www.', '');
    return simplifiedHost.length > 20 ? simplifiedHost.substring(0, 20) + '...' : simplifiedHost;
  } catch (e) {
    const safe = String(url);
    return safe.length > 30 ? safe.substring(0, 30) + '...' : safe;
  }
}

// 从URL中提取路径作为分类依据
function extractUrlPath(url) {
  if (!url || typeof url !== 'string') {
    return '未知来源';
  }
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const segments = urlObj.pathname.split('/').filter(Boolean);

    // GitHub: 统一归一化为仓库名
    if (host === 'github.com' || host === 'raw.githubusercontent.com') {
      if (segments.length >= 2) {
        return segments[1]; // owner/repo -> repo
      }
      return segments[0] || host;
    }

    // X/Twitter: 使用用户名
    if (host === 'x.com' || host === 'twitter.com') {
      return segments[0] || host;
    }

    // Medium相关域名: 使用简化的关键词
    if (host.includes('medium.com') || host.includes('gitconnected.com')) {
      if (segments.length > 0) {
        // 提取路径中的关键词，通常是文章标题的一部分
        const articlePath = segments[segments.length - 1];
        // 提取前几个有意义的词汇
        const keywords = articlePath.split('-').slice(0, 3).join('-');
        return keywords.length > 20 ? keywords.substring(0, 20) + '...' : keywords;
      }
      return 'Medium';
    }

    // 其他域名: 显示域名，但限制长度
    const simplifiedHost = host.replace('www.', '');
    return simplifiedHost.length > 20 ? simplifiedHost.substring(0, 20) + '...' : simplifiedHost;
  } catch (e) {
    const safe = String(url);
    return safe.length > 30 ? safe.substring(0, 30) + '...' : safe;
  }
}

function renderCase(caseItem) {
  const promptsHtml = caseItem.prompts.map((prompt, index) => {
    // 处理prompt可能是字符串或对象的情况
    const promptText = typeof prompt === 'string' ? prompt : prompt.text || '';
    const isLongPrompt = promptText.length > 200;
    const displayPrompt = isLongPrompt ? promptText.substring(0, 200) + '...' : promptText;
    const fullPrompt = promptText;
    
    return `
      <div class="prompt-container">
        <div class="prompt-text ${isLongPrompt ? 'prompt-truncated' : ''}" data-full="${fullPrompt.replace(/"/g, '&quot;')}">
          ${displayPrompt}
        </div>
        ${isLongPrompt ? `
          <button class="expand-btn" onclick="togglePrompt(this)">
            <span class="expand-text">展开完整prompt</span>
            <span class="collapse-text" style="display: none;">收起</span>
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // 效果部分主要显示图片，文字描述作为补充
  const imagesHtml = (() => {
    if (caseItem.images.length === 0) return '';
    // 主图是第一张
    const primary = caseItem.images[0];
    const countBadge = caseItem.images.length > 1
      ? `<span class="img-count-badge">${caseItem.images.length} 张</span>` : '';
    return `
      <div class="case-image-wrap" onclick="openLightbox('${primary.replace(/'/g, "&apos;")}', '')">
        <img src="${primary}" alt="效果图" onerror="this.parentElement.style.display='none'">
        ${countBadge}
      </div>
    `;
  })();

  const effectsHtml = (() => {
    if (caseItem.effects.length === 0) return '';
    if (caseItem.images.length > 0) {
      const shortEffect = caseItem.effects[0].length > 60
        ? caseItem.effects[0].substring(0, 60) + '…'
        : caseItem.effects[0];
      return `<div class="effect-text effect-summary">${shortEffect}</div>`;
    }
    return caseItem.effects.map(effect =>
      `<div class="effect-text">${effect}</div>`
    ).join('');
  })();
  
  // 解析标题，移除中括号并提取链接
  const titleInfo = parseMarkdownTitle(caseItem.title);
  const displayTitle = titleInfo.text;
  
  // 构建标题HTML，如果有链接则使用链接，否则使用原始sourceUrl
  const titleHtml = titleInfo.url 
    ? `<a href="${titleInfo.url}" target="_blank" rel="noopener noreferrer">${displayTitle}</a>`
    : displayTitle;
  
  // 如果标题中包含链接，在source-link中显示简化的作者信息
  let sourceLinkHtml = '';
  const simplifiedSourceText = getSimplifiedSourceText(caseItem.sourceUrl);
  
  if (titleInfo.url) {
    const author = extractAuthorFromUrl(titleInfo.url);
    if (author) {
      sourceLinkHtml = `
        <div class="source-link">
          <a href="${titleInfo.url}" target="_blank" rel="noopener noreferrer">
            @${author}
          </a>
          <span class="separator">•</span>
          <a href="${caseItem.sourceUrl}" target="_blank" rel="noopener noreferrer" title="${caseItem.sourceUrl}">
            ${simplifiedSourceText}
          </a>
        </div>
      `;
    } else {
      sourceLinkHtml = `
        <div class="source-link">
          <a href="${caseItem.sourceUrl}" target="_blank" rel="noopener noreferrer" title="${caseItem.sourceUrl}">
            ${simplifiedSourceText}
          </a>
        </div>
      `;
    }
  } else {
    sourceLinkHtml = `
      <div class="source-link">
        <a href="${caseItem.sourceUrl}" target="_blank" rel="noopener noreferrer" title="${caseItem.sourceUrl}">
          ${simplifiedSourceText}
        </a>
      </div>
    `;
  }
  
  return `
    <div class="case-card">
      ${imagesHtml}
      <div class="case-body">
        <div class="case-header">
          <div class="case-title">${titleHtml}</div>
          <div class="case-category">${caseItem.categoryName}</div>
        </div>

        ${caseItem.prompts.length > 0 ? `
          <div class="prompt-section">
            <div class="prompt-label">Prompt</div>
            ${promptsHtml}
          </div>
        ` : ''}

        ${(effectsHtml || (!imagesHtml && caseItem.effects.length > 0)) ? `
          <div class="effect-section">
            <div class="effect-label">效果</div>
            ${effectsHtml}
          </div>
        ` : ''}

        ${sourceLinkHtml}
      </div>
    </div>
  `;
}

function renderCases(cases) {
  if (cases.length === 0) {
    casesGrid.innerHTML = '<div class="empty">没有找到匹配的案例</div>';
    stats.textContent = `共 0 个案例`;
    return;
  }

  // 防嵌套：重置容器的内容，避免残留节点造成嵌套
  casesGrid.innerHTML = '';

  // 去重：按 (标题 + 来源路径 + 首个prompt片段) 生成稳定键
  const seen = new Set();
  const deduped = [];

  for (const c of cases) {
    const path = extractUrlPath(c.sourceUrl || '');
    const title = (c.title || '').trim();
    const promptKey = (Array.isArray(c.prompts) && c.prompts.length > 0) 
      ? (typeof c.prompts[0] === 'string' ? c.prompts[0] : (c.prompts[0].text || ''))
      : '';
    const promptSnippet = promptKey.replace(/\s+/g, ' ').slice(0, 60);
    const key = `${title}|${path}|${promptSnippet}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(c);
    }
  }

  // 渲染卡片（逐个追加，避免大字符串拼接造成结构异常）
  const fragments = document.createDocumentFragment();
  deduped.forEach(item => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderCase(item);
    // 提取最外层 .case-card 并追加到容器，确保结构平整
    const card = wrapper.firstElementChild;
    fragments.appendChild(card);
  });

  casesGrid.appendChild(fragments);
  stats.textContent = `共 ${deduped.length} 个案例`;
}

function filterAndSort() {
  const searchTerm = (searchInput.value || '').toLowerCase();
  const selectedCategory = categorySelect.value;
  const selectedPath = pathSelect.value;
  const sortBy = sortSelect.value;
  
  let filteredCases = casesData.cases.slice();
  
  // 搜索过滤
  if (searchTerm) {
    filteredCases = filteredCases.filter(caseItem => {
      const searchText = `${caseItem.title} ${caseItem.prompts.join(' ')} ${caseItem.effects.join(' ')}`.toLowerCase();
      return searchText.includes(searchTerm);
    });
  }
  
  // 分类过滤
  if (selectedCategory) {
    filteredCases = filteredCases.filter(caseItem => caseItem.category === selectedCategory);
  }
  
  // 路径过滤
  if (selectedPath) {
    filteredCases = filteredCases.filter(caseItem => {
      const urlPath = extractUrlPath(caseItem.sourceUrl);
      return urlPath === selectedPath;
    });
  }
  
  // 排序
  if (sortBy === 'title') {
    filteredCases.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'category') {
    filteredCases.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.title.localeCompare(b.title);
    });
  } else if (sortBy === 'path') {
    filteredCases.sort((a, b) => {
      const pathA = extractUrlPath(a.sourceUrl);
      const pathB = extractUrlPath(b.sourceUrl);
      if (pathA !== pathB) {
        return pathA.localeCompare(pathB);
      }
      return a.title.localeCompare(b.title);
    });
  }
  
  renderCases(filteredCases);
}

function populateFilters() {
  // 获取所有唯一的分类
  const categories = [...new Set(casesData.cases.map(c => c.category))];
  
  // 清空并重新填充分类选项
  categorySelect.innerHTML = '<option value="">全部分类</option>';
  categories.forEach(category => {
    const caseItem = casesData.cases.find(c => c.category === category);
    const option = document.createElement('option');
    option.value = category;
    option.textContent = `${caseItem.categoryName} (${casesData.cases.filter(c => c.category === category).length})`;
    categorySelect.appendChild(option);
  });
  
  // 获取所有唯一的路径
  const paths = [...new Set(casesData.cases.map(c => extractUrlPath(c.sourceUrl)))];
  
  // 清空并重新填充路径选项
  pathSelect.innerHTML = '<option value="">全部来源</option>';
  paths.sort().forEach(path => {
    const count = casesData.cases.filter(c => extractUrlPath(c.sourceUrl) === path).length;
    const option = document.createElement('option');
    option.value = path;
    option.textContent = `${path} (${count})`;
    pathSelect.appendChild(option);
  });
}

async function loadCases() {
  try {
    const response = await fetch('./public/cases.json', { cache: 'no-store' });
    casesData = await response.json();
    console.log(`加载了 ${casesData.cases.length} 个案例`);
    
    // 填充筛选选项
    populateFilters();
    
    // 初始渲染
    filterAndSort();
  } catch (error) {
    console.error('加载案例数据失败:', error);
    casesGrid.innerHTML = '<div class="empty">加载案例数据失败</div>';
    stats.textContent = '加载失败';
  }
}

// 事件监听
[searchInput, categorySelect, pathSelect, sortSelect].forEach(element => {
  element.addEventListener('input', filterAndSort);
});

// 展开/收起prompt功能
function togglePrompt(button) {
  const promptText = button.previousElementSibling;
  const expandText = button.querySelector('.expand-text');
  const collapseText = button.querySelector('.collapse-text');
  
  if (promptText.classList.contains('prompt-expanded')) {
    // 收起
    const fullText = promptText.getAttribute('data-full');
    const truncatedText = fullText.substring(0, 200) + '...';
    promptText.textContent = truncatedText;
    promptText.classList.remove('prompt-expanded');
    expandText.style.display = 'inline';
    collapseText.style.display = 'none';
  } else {
    // 展开
    const fullText = promptText.getAttribute('data-full');
    promptText.textContent = fullText;
    promptText.classList.add('prompt-expanded');
    expandText.style.display = 'none';
    collapseText.style.display = 'inline';
  }
}

// 页面加载完成后加载数据
document.addEventListener('DOMContentLoaded', loadCases);
