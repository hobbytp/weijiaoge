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

// HTML 实体转义函数
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 清理 prompt 开头的空格、Prompt:、代码块标记等无关前缀
function cleanPrompt(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned
      // 1. 移除开头的代码块标记，如 ```markdown\n, ```text\n, 或 ```
      .replace(/^```(?:[a-zA-Z0-9_-]+\r?\n|\s*)/, '')
      // 2. 移除开头的单反引号或多个反引号
      .replace(/^`+\s*/, '')
      // 3. 移除各种 Prompt / 提示词 前缀，支持中文或英文冒号、序号、修饰词等
      // 如: 'Prompt:', 'Prompt：', 'prompt:', 'Prompt 1:', 'Prompt1：', 'Img Prompt:', '1) 变手办 Prompt：'
      .replace(/^(?:\d+[\.\)）]\s*)?(?:[^\n：:]{0,20}?\s*)?(?:prompt\s*\d*|提示词?|咒语|输入)\s*[：:]\s*/i, '')
      // 4. 再次移除可能紧随在 Prompt: 后的代码块标记
      .replace(/^```(?:[a-zA-Z0-9_-]+\r?\n|\s*)/, '')
      .trim();
  } while (cleaned !== prev);

  // 5. 移除末尾多余的代码块标记
  cleaned = cleaned.replace(/\s*```+$/, '').trim();

  return cleaned;
}

// 自动探测或提取案例长宽比
function detectAspectRatio(caseItem) {
  if (caseItem.aspectRatio) return caseItem.aspectRatio;
  const text = `${caseItem.title || ''} ${(caseItem.prompts || []).map(p => typeof p === 'string' ? p : p.text || '').join(' ')}`.toLowerCase();
  if (text.includes('16:9') || text.includes('landscape') || text.includes('横版') || text.includes('壁纸') || text.includes('cinematic')) return '16:9';
  if (text.includes('9:16') || text.includes('portrait') || text.includes('竖版') || text.includes('海报') || text.includes('手机')) return '9:16';
  if (text.includes('4:3')) return '4:3';
  if (text.includes('3:4')) return '3:4';
  if (text.includes('21:9')) return '21:9';
  return '1:1';
}

function renderCase(caseItem) {
  const promptsHtml = caseItem.prompts.map((prompt) => {
    // 处理prompt可能是字符串或对象的情况
    const rawText = typeof prompt === 'string' ? prompt : prompt.text || '';
    const promptText = cleanPrompt(rawText);
    if (!promptText) return '';
    const isLongPrompt = promptText.length > 200;
    const displayPrompt = isLongPrompt ? promptText.substring(0, 200) + '...' : promptText;
    const fullPrompt = promptText;
    
    // 注意：.prompt-text 设置了 white-space: pre-wrap; 标签与内容之间严禁出现换行和缩进空格
    return `
      <div class="prompt-container">
        <div class="prompt-text ${isLongPrompt ? 'prompt-truncated' : ''}" data-full="${escapeHtml(fullPrompt)}">${escapeHtml(displayPrompt)}</div>
        ${isLongPrompt ? `
          <button class="expand-btn" onclick="togglePrompt(this)">
            <span class="expand-text">展开完整prompt</span>
            <span class="collapse-text" style="display: none;">收起</span>
          </button>
        ` : ''}
      </div>
    `;
  }).filter(Boolean).join('');
  
  const totalSteps = caseItem.prompts ? caseItem.prompts.length : 1;
  const primaryPromptRaw = (caseItem.prompts && caseItem.prompts.length > 0)
    ? (typeof caseItem.prompts[0] === 'string' ? caseItem.prompts[0] : caseItem.prompts[0].text || '')
    : '';
  const primaryPrompt = cleanPrompt(primaryPromptRaw);

  // 效果部分主要显示图片，文字描述作为补充
  const imagesHtml = (() => {
    const copyBtnHtml = `
      <button class="quick-copy-btn" title="一键复制主 Prompt" aria-label="一键复制主 Prompt" data-prompt="${escapeHtml(primaryPrompt)}" data-steps="${totalSteps}" onclick="event.stopPropagation(); copyMainPrompt(this);">
        <svg class="copy-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span class="copy-label">复制 Prompt</span>
      </button>
    `;
    if (!caseItem.images || caseItem.images.length === 0) return '';
    // 主图是第一张
    const primary = caseItem.images[0];
    const countBadge = caseItem.images.length > 1
      ? `<span class="img-count-badge">${caseItem.images.length} 张</span>` : '';
    const aspect = detectAspectRatio(caseItem);
    const aspectBadge = aspect ? `<span class="aspect-badge">${escapeHtml(aspect)}</span>` : '';
    return `
      <div class="case-image-wrap" onclick="openLightbox('${primary.replace(/'/g, "&apos;")}', '')">
        <img src="${primary}" alt="${escapeHtml(caseItem.title || '效果图')}" loading="lazy" decoding="async" onerror="this.parentElement.style.display='none'">
        ${aspectBadge}
        ${copyBtnHtml}
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
    <div class="case-card" data-steps="${totalSteps}">
      ${imagesHtml}
      <div class="case-body">
        <div class="case-header">
          <div class="case-title">${titleHtml}</div>
          <div class="case-category">${caseItem.categoryName}</div>
        </div>

        ${promptsHtml ? `
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

// ── Masonry Column Balancer & Batch State ────────────────────
const BATCH_SIZE = 24;
let activeCases = [];
let renderedCount = 0;
let columnElements = [];
let columnHeights = [];
let currentColumnCount = 0;
let batchObserver = null;

// 响应式计算当前适宜的列数 (1~4列)
function getColumnCount() {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth || 1200;
  if (w < 640) return 1;
  if (w < 1024) return 2;
  if (w < 1440) return 3;
  return 4;
}

// 初始化/重置列容器
function setupColumns(count) {
  casesGrid.innerHTML = '';
  columnElements = [];
  columnHeights = [];
  currentColumnCount = count;

  for (let i = 0; i < count; i++) {
    const col = document.createElement('div');
    col.className = 'masonry-column';
    casesGrid.appendChild(col);
    columnElements.push(col);
    columnHeights.push(0);
  }
}

// 更新滚动哨兵状态
function updateSentinel(hasMore) {
  const sentinel = document.getElementById('batch-sentinel');
  if (!sentinel) return;
  if (hasMore) {
    sentinel.classList.remove('hidden');
    sentinel.innerHTML = '<span class="sentinel-text">向下滚动加载更多…</span>';
  } else {
    sentinel.classList.add('hidden');
    sentinel.innerHTML = '';
  }
}

// 增量分批渲染 (Shortest-column-first 均衡算法)
function renderNextBatch(batchSize = BATCH_SIZE) {
  if (!activeCases || activeCases.length === 0) {
    updateSentinel(false);
    return;
  }
  if (renderedCount >= activeCases.length) {
    updateSentinel(false);
    return;
  }

  const nextItems = activeCases.slice(renderedCount, renderedCount + batchSize);
  nextItems.forEach(item => {
    // 找出当前高度最短的列
    let shortestIdx = 0;
    for (let i = 1; i < currentColumnCount; i++) {
      if (columnHeights[i] < columnHeights[shortestIdx]) {
        shortestIdx = i;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderCase(item);
    const card = wrapper.firstElementChild;
    if (card && columnElements[shortestIdx]) {
      columnElements[shortestIdx].appendChild(card);
      // 预估卡片高度（基准高 + 图片占位 + prompt高度估算）
      const approxHeight = 350 + (item.prompts ? item.prompts.length * 35 : 0);
      columnHeights[shortestIdx] += approxHeight;
    }
  });

  renderedCount += nextItems.length;
  updateSentinel(renderedCount < activeCases.length);
}

// 监听滚动哨兵触碰事件
function initBatchObserver() {
  const sentinel = document.getElementById('batch-sentinel');
  if (!sentinel || typeof IntersectionObserver === 'undefined') return;
  if (batchObserver) {
    batchObserver.disconnect();
  }
  batchObserver = new IntersectionObserver((entries) => {
    if (entries[0] && entries[0].isIntersecting) {
      renderNextBatch();
    }
  }, { rootMargin: '300px' });
  batchObserver.observe(sentinel);
}

function renderCases(cases) {
  if (cases.length === 0) {
    casesGrid.innerHTML = '<div class="empty">没有找到匹配的案例</div>';
    stats.textContent = `共 0 个案例`;
    updateSentinel(false);
    return;
  }

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

  activeCases = deduped;
  renderedCount = 0;
  stats.textContent = `共 ${deduped.length} 个案例`;

  const colCount = getColumnCount();
  setupColumns(colCount);
  renderNextBatch(BATCH_SIZE);
  initBatchObserver();
}

// 窗口尺寸变化时防抖重新分列
if (typeof window !== 'undefined') {
  window.addEventListener('resize', debounce(() => {
    const newColCount = getColumnCount();
    if (newColCount !== currentColumnCount && activeCases.length > 0) {
      const countToRestore = renderedCount;
      setupColumns(newColCount);
      renderedCount = 0;
      renderNextBatch(countToRestore);
    }
  }, 250));

  window.loadCases = loadCases;
  window.renderNextBatch = renderNextBatch;
  window.deriveFeatureTags = deriveFeatureTags;
}

// ── Hybrid Feature Tag Extraction Engine ────────────────────
const FEATURE_TAG_RULES = [
  {
    tag: '多图参考',
    test: (text, item) => (item.images && item.images.length > 1) || /多图|图一|图二|参考图|结构图|reference|using the attached|blend|fusion|合成/i.test(text)
  },
  {
    tag: '实时联网',
    test: (text) => /search for|current weather|real-time|实时|联网|天气|新闻/i.test(text)
  },
  {
    tag: '局部修图',
    test: (text) => /remove the|消除|局部|替换|修图|erase|mask|inpaint|inpainting/i.test(text)
  },
  {
    tag: '风格迁移',
    test: (text) => /recreate this photo into|style|style transfer|油画|水彩|像素|风格|film|胶片|vintage|1980s|梵高/i.test(text)
  },
  {
    tag: '海报排版',
    test: (text) => /poster|typographic|typography|海报|排版|字体|文字|text|lettering/i.test(text)
  },
  {
    tag: '人物角色',
    test: (text) => /portrait|character|model|person|man|woman|人物|角色|模特|人像|希斯莱杰|女孩|小丑/i.test(text)
  },
  {
    tag: '材质光影',
    test: (text) => /chiaroscuro|lighting|texture|material|armor|材质|光影|纹理|质感|布光|studio/i.test(text)
  },
  {
    tag: '产品设计',
    test: (text) => /product|commercial|bottle|packaging|design|产品|包装|工业设计|香水|易拉罐|手办/i.test(text)
  },
  {
    tag: '镜头视角',
    test: (text) => /gopro|action shot|angle|lens|wide angle|close-up|俯视|仰视|特写|镜头|视角/i.test(text)
  },
  {
    tag: '手绘转实景',
    test: (text) => /sketch|illustration|手绘|草图|转实景|线稿|手绘草图/i.test(text)
  }
];

function deriveFeatureTags(caseItem) {
  if (caseItem.tags && Array.isArray(caseItem.tags) && caseItem.tags.length > 0) {
    return caseItem.tags;
  }
  const text = `${caseItem.title || ''} ${(caseItem.prompts || []).map(p => typeof p === 'string' ? p : p.text || '').join(' ')} ${(caseItem.effects || []).join(' ')}`;
  const tags = [];
  for (const rule of FEATURE_TAG_RULES) {
    if (rule.test(text, caseItem)) {
      tags.push(rule.tag);
    }
  }
  return tags.length > 0 ? tags : ['通用生图'];
}

let activeCategory = '';
let activeFeatureTag = '';

function filterAndSort() {
  const searchTerm = (searchInput.value || '').toLowerCase();
  const selectedCategory = activeCategory || (categorySelect ? categorySelect.value : '');
  const selectedPath = pathSelect ? pathSelect.value : '';
  const sortBy = sortSelect ? sortSelect.value : 'category';
  
  let filteredCases = casesData.cases.slice();
  
  // 搜索过滤 (支持标题、Prompt、效果与衍生标签)
  if (searchTerm) {
    filteredCases = filteredCases.filter(caseItem => {
      const promptsText = (caseItem.prompts || []).map(p => typeof p === 'string' ? p : p.text || '').join(' ');
      const tagsText = (caseItem.derivedTags || []).join(' ');
      const searchText = `${caseItem.title} ${promptsText} ${caseItem.effects.join(' ')} ${tagsText}`.toLowerCase();
      return searchText.includes(searchTerm);
    });
  }
  
  // 一级分类过滤
  if (selectedCategory) {
    filteredCases = filteredCases.filter(caseItem => caseItem.category === selectedCategory);
  }

  // 二级特性标签过滤 (单选互斥)
  if (activeFeatureTag) {
    filteredCases = filteredCases.filter(caseItem =>
      caseItem.derivedTags && caseItem.derivedTags.includes(activeFeatureTag)
    );
  }
  
  // 路径过滤
  if (selectedPath) {
    filteredCases = filteredCases.filter(caseItem => caseItem.urlPath === selectedPath);
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
      const pathA = a.urlPath || '';
      const pathB = b.urlPath || '';
      if (pathA !== pathB) {
        return pathA.localeCompare(pathB);
      }
      return a.title.localeCompare(b.title);
    });
  }
  
  renderCases(filteredCases);
}

function renderTaxonomyBar(categoryCounts, categoryNames, featureCounts) {
  const categoryChips = document.getElementById('category-chips');
  const featureChips = document.getElementById('feature-chips');
  if (!categoryChips || !featureChips) return;

  // 渲染一级分类胶囊
  const totalCount = casesData.cases.length;
  let catHtml = `
    <button class="category-chip ${activeCategory === '' ? 'active' : ''}" data-category="">
      全部案例 <span class="chip-count">${totalCount}</span>
    </button>
  `;
  Object.keys(categoryCounts).forEach(cat => {
    const isActive = activeCategory === cat;
    catHtml += `
      <button class="category-chip ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat)}">
        ${escapeHtml(categoryNames[cat])} <span class="chip-count">${categoryCounts[cat]}</span>
      </button>
    `;
  });
  categoryChips.innerHTML = catHtml;

  // 渲染二级特性标签胶囊 (按频次高低排序)
  const sortedTags = Object.keys(featureCounts).sort((a, b) => featureCounts[b] - featureCounts[a]);
  let featHtml = `
    <button class="feature-chip ${activeFeatureTag === '' ? 'active' : ''}" data-tag="">
      全部特性
    </button>
  `;
  sortedTags.forEach(tag => {
    const isActive = activeFeatureTag === tag;
    featHtml += `
      <button class="feature-chip ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
        #${escapeHtml(tag)} <span class="chip-count">${featureCounts[tag]}</span>
      </button>
    `;
  });
  featureChips.innerHTML = featHtml;

  // 绑定一级分类胶囊事件
  categoryChips.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      activeCategory = cat;
      if (categorySelect) categorySelect.value = cat;
      populateFilters();
      filterAndSort();
    });
  });

  // 绑定二级特性标签胶囊事件 (单选互斥与反选还原)
  featureChips.querySelectorAll('.feature-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      if (activeFeatureTag === tag && tag !== '') {
        activeFeatureTag = '';
      } else {
        activeFeatureTag = tag;
      }
      populateFilters();
      filterAndSort();
    });
  });
}

function populateFilters() {
  const categoryCounts = {};
  const categoryNames = {};
  const pathCounts = {};
  const featureCounts = {};

  for (const c of casesData.cases) {
    if (c.category) {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      if (!categoryNames[c.category]) categoryNames[c.category] = c.categoryName || c.category;
    }
    const p = c.urlPath || '';
    if (p) {
      pathCounts[p] = (pathCounts[p] || 0) + 1;
    }
    if (c.derivedTags && Array.isArray(c.derivedTags)) {
      for (const t of c.derivedTags) {
        featureCounts[t] = (featureCounts[t] || 0) + 1;
      }
    }
  }

  // 填充兼容用的隐藏分类与路径选项
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">全部分类</option>';
    Object.keys(categoryCounts).forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = `${categoryNames[category]} (${categoryCounts[category]})`;
      categorySelect.appendChild(option);
    });
  }

  if (pathSelect) {
    pathSelect.innerHTML = '<option value="">全部来源</option>';
    Object.keys(pathCounts).sort().forEach(path => {
      const option = document.createElement('option');
      option.value = path;
      option.textContent = `${path} (${pathCounts[path]})`;
      pathSelect.appendChild(option);
    });
  }

  renderTaxonomyBar(categoryCounts, categoryNames, featureCounts);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function loadCases() {
  try {
    const response = await fetch('./public/cases.json');
    casesData = await response.json();
    console.log(`加载了 ${casesData.cases.length} 个案例`);
    
    // P3 优化：加载时预先计算 urlPath 与 derivedTags，消除重复计算
    casesData.cases.forEach(c => {
      c.urlPath = extractUrlPath(c.sourceUrl);
      c.derivedTags = deriveFeatureTags(c);
    });
    
    // 填充筛选选项与胶囊标签
    populateFilters();
    
    // 初始渲染
    filterAndSort();
  } catch (error) {
    console.error('加载案例数据失败:', error);
    casesGrid.innerHTML = '<div class="empty">加载案例数据失败</div>';
    stats.textContent = '加载失败';
  }
}

// 事件监听：搜索输入使用 200ms 防抖，下拉菜单保持即时响应
const debouncedCasesFilter = debounce(filterAndSort, 200);
searchInput.addEventListener('input', debouncedCasesFilter);
[categorySelect, pathSelect, sortSelect].forEach(element => {
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

// ── Toast 通知系统 ─────────────────────────────────────────────
function showToast(message, duration = 2800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fading');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, duration);
}

// ── 快捷复制主 Prompt ──────────────────────────────────────────
function copyMainPrompt(button, caseItem) {
  let promptText = '';
  let steps = 1;

  if (caseItem) {
    const raw = (caseItem.prompts && caseItem.prompts.length > 0)
      ? (typeof caseItem.prompts[0] === 'string' ? caseItem.prompts[0] : caseItem.prompts[0].text || '')
      : '';
    promptText = cleanPrompt(raw);
    steps = (caseItem.prompts && caseItem.prompts.length) || 1;
  } else if (button) {
    promptText = button.getAttribute('data-prompt') || '';
    if (!promptText) {
      const card = button.closest('.case-card');
      const promptEl = card ? card.querySelector('.prompt-text') : null;
      promptText = promptEl ? (promptEl.getAttribute('data-full') || promptEl.textContent || '') : '';
    }
    const stepsAttr = button.getAttribute('data-steps') || (button.closest('.case-card') ? button.closest('.case-card').getAttribute('data-steps') : '1');
    steps = parseInt(stepsAttr || '1', 10);
  }

  if (promptText && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(promptText).catch(err => console.error('复制到剪贴板失败:', err));
  }

  if (button) {
    button.classList.add('copied');
    const label = button.querySelector('.copy-label');
    const origText = label ? label.textContent : '';
    if (label) label.textContent = '已复制';
    setTimeout(() => {
      button.classList.remove('copied');
      if (label) label.textContent = origText;
    }, 2000);
  }

  const toastMessage = steps > 1
    ? `已复制首步 Prompt（共 ${steps} 步工作流）`
    : '已复制主 Prompt 到剪贴板';
  showToast(toastMessage);
}

// 导出全局对象，方便浏览器与测试脚本访问
if (typeof window !== 'undefined') {
  window.deriveFeatureTags = deriveFeatureTags;
  window.showToast = showToast;
  window.copyMainPrompt = copyMainPrompt;
  window.loadCases = loadCases;
}
