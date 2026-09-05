/* global window, document, fetch */
const $ = (s) => document.querySelector(s);
const list = $('#list');
const q = $('#q');
const type = $('#type');
const source = $('#source');
const sortSel = $('#sort');
const stats = $('#stats');

let data = { items: [] };

// ── Pagination state ──
const PAGE_SIZE = 50;
let filteredItems = [];
let displayedCount = 0;
let loadMoreObserver = null;

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function showLoading() {
  list.innerHTML = '<li class="loading">正在载入资源数据…</li>';
  stats.textContent = '加载中…';
}

// ── Debounce utility ──
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── Escape HTML to prevent XSS ──
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Highlight search term only (not fixed keywords) ──
function highlightTerm(text, term) {
  if (!term) return escapeHtml(text);
  const escaped = escapeHtml(text);
  // Escape regex special characters in the search term
  const safeRegex = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeRegex})`, 'gi'), '<mark>$1</mark>');
}

function renderCard(it, searchTerm) {
  const star = it.stars ? `⭐ ${it.stars}` : '';
  const t = it.type || '';
  const s = it.source || '';
  const up = it.updatedAt ? `更新: ${fmtDate(it.updatedAt)}` : '';
  
  const highlightedTitle = highlightTerm(it.title, searchTerm);
  const rawDesc = it.description || '';
  
  // 处理描述内容截断
  let descHtml = '';
  if (rawDesc) {
    const maxLength = 200;
    const escapedDesc = highlightTerm(rawDesc, searchTerm);
    
    if (rawDesc.length > maxLength) {
      const truncatedDesc = highlightTerm(rawDesc.substring(0, maxLength), searchTerm);
      const cardId = `card-${Math.random().toString(36).substr(2, 9)}`;
      descHtml = `
        <div class="desc-container">
          <p class="desc" id="${cardId}-short">${truncatedDesc}...</p>
          <p class="desc" id="${cardId}-full" style="display: none;">${escapedDesc}</p>
          <button class="toggle-desc" onclick="toggleDescription('${cardId}')">展开</button>
        </div>
      `;
    } else {
      descHtml = `<p class="desc">${escapedDesc}</p>`;
    }
  }
  
  return `
    <li class="card">
      <span class="card-accent-bar"></span>
      <div class="card-main">
        <h3 class="title"><a href="${it.url}" target="_blank" rel="noopener noreferrer">${highlightedTitle}</a></h3>
        <div class="meta">
          <span class="badge type-badge">${t}</span>
          <span class="badge source-badge">${s}</span>
          ${star ? `<span class="badge stars">${star}</span>` : ''}
          ${up ? `<span class="badge update">${up}</span>` : ''}
          ${it.author ? `<span class="badge author">作者: ${escapeHtml(it.author)}</span>` : ''}
        </div>
        ${descHtml}
      </div>
    </li>
  `;
}

// ── Render a batch of items and append to list ──
function renderBatch(startIndex, count) {
  const searchTerm = q.value.trim().toLowerCase();
  const end = Math.min(startIndex + count, filteredItems.length);
  const fragment = document.createDocumentFragment();
  
  for (let i = startIndex; i < end; i++) {
    const wrapper = document.createElement('template');
    wrapper.innerHTML = renderCard(filteredItems[i], searchTerm);
    fragment.appendChild(wrapper.content);
  }
  
  // Remove existing sentinel before appending
  const oldSentinel = document.getElementById('load-more-sentinel');
  if (oldSentinel) oldSentinel.remove();
  
  list.appendChild(fragment);
  displayedCount = end;
  
  // Add sentinel for next batch if there are more items
  if (displayedCount < filteredItems.length) {
    const sentinel = document.createElement('li');
    sentinel.id = 'load-more-sentinel';
    sentinel.className = 'loading';
    sentinel.textContent = `加载更多… (已显示 ${displayedCount} / ${filteredItems.length})`;
    list.appendChild(sentinel);
    observeSentinel(sentinel);
  }
}

// ── IntersectionObserver for infinite scroll ──
function observeSentinel(sentinel) {
  if (loadMoreObserver) loadMoreObserver.disconnect();
  loadMoreObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && displayedCount < filteredItems.length) {
      renderBatch(displayedCount, PAGE_SIZE);
    }
  }, { rootMargin: '200px' });
  loadMoreObserver.observe(sentinel);
}

function render(items) {
  filteredItems = items;
  displayedCount = 0;
  
  if (items.length === 0) {
    const hasFilters = q.value || type.value || source.value;
    const emptyMessage = hasFilters ? 
      '没有找到匹配的项目，请尝试调整搜索条件' : 
      '暂无资源数据';
    list.innerHTML = `<li class="empty">${emptyMessage}</li>`;
    stats.textContent = `共 0 条（生成时间：${data.generatedAt ? fmtDate(data.generatedAt) : '未知'}）`;
    return;
  }

  list.innerHTML = '';
  renderBatch(0, PAGE_SIZE);
  stats.textContent = `共 ${items.length} 条（生成时间：${data.generatedAt ? fmtDate(data.generatedAt) : '未知'}）`;
}

function score(it) {
  const stars = it.stars || 0;
  const updated = it.updatedAt ? new Date(it.updatedAt).getTime() : 0;
  const recency = updated ? (Date.now() - updated) : Infinity;
  const recencyScore = updated ? Math.max(0, 1_000_000_000 - recency / 10_000) : 0;
  return stars * 1000 + recencyScore;
}

function filterAndSort() {
  const kw = q.value.toLowerCase();
  let items = data.items.slice();

  if (kw) {
    items = items.filter(it => {
      return (it.title || '').toLowerCase().includes(kw) ||
             (it.description || '').toLowerCase().includes(kw) ||
             (it.author || '').toLowerCase().includes(kw);
    });
  }
  if (type.value) items = items.filter(it => it.type === type.value);
  if (source.value) items = items.filter(it => it.source === source.value);

  const sort = sortSel.value;
  if (sort === 'recent') {
    items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  } else if (sort === 'stars') {
    items.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  } else {
    items.sort((a, b) => score(b) - score(a));
  }

  render(items);
}

function populateFilters() {
  const types = [...new Set(data.items.map(item => item.type).filter(Boolean))];
  const sources = [...new Set(data.items.map(item => item.source).filter(Boolean))];
  
  // 清空并重新填充类型选项
  type.innerHTML = '<option value="">全部类型</option>';
  types.forEach(t => {
    const option = document.createElement('option');
    option.value = t;
    option.textContent = t;
    type.appendChild(option);
  });
  
  // 清空并重新填充来源选项
  source.innerHTML = '<option value="">全部来源</option>';
  sources.forEach(s => {
    const option = document.createElement('option');
    option.value = s;
    option.textContent = s;
    source.appendChild(option);
  });
}

async function boot() {
  // 显示加载状态
  showLoading();
  
  try {
    const res = await fetch('./public/data.json');
    data = await res.json();
    console.log(`加载了 ${data.items.length} 个项目`);
  } catch (error) {
    console.error('加载数据失败:', error);
    data = { items: [] };
    list.innerHTML = '<div class="empty">加载失败，请刷新页面重试</div>';
    stats.textContent = '加载失败';
    return;
  }
  
  // 填充筛选选项
  populateFilters();
  
  // 初始渲染
  filterAndSort();
}

// 切换描述展开/收起的函数
window.toggleDescription = function(cardId) {
  const shortDesc = document.getElementById(`${cardId}-short`);
  const fullDesc = document.getElementById(`${cardId}-full`);
  const toggleBtn = shortDesc.parentElement.querySelector('.toggle-desc');
  
  if (shortDesc.style.display === 'none') {
    // 当前显示完整描述，切换到简短描述
    shortDesc.style.display = 'block';
    fullDesc.style.display = 'none';
    toggleBtn.textContent = '展开';
  } else {
    // 当前显示简短描述，切换到完整描述
    shortDesc.style.display = 'none';
    fullDesc.style.display = 'block';
    toggleBtn.textContent = '收起';
  }
};

// 搜索框使用 debounce，下拉菜单立即响应
const debouncedFilter = debounce(filterAndSort, 200);
q.addEventListener('input', debouncedFilter);
[type, source, sortSel].forEach(el => el.addEventListener('input', filterAndSort));
boot();

