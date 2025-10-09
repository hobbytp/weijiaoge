/* global window, document, fetch */
const $ = (s) => document.querySelector(s);
const list = $('#list');
const q = $('#q');
const type = $('#type');
const source = $('#source');
const sortSel = $('#sort');
const stats = $('#stats');

let data = { items: [] };

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function showLoading() {
  list.innerHTML = '<div class="loading">正在加载资源数据...</div>';
  stats.textContent = '加载中...';
}

function render(items) {
  if (items.length === 0) {
    const hasFilters = q.value || type.value || source.value;
    const emptyMessage = hasFilters ? 
      '没有找到匹配的项目，请尝试调整搜索条件' : 
      '暂无资源数据';
    list.innerHTML = `<div class="empty">${emptyMessage}</div>`;
    stats.textContent = `共 0 条（生成时间：${data.generatedAt ? fmtDate(data.generatedAt) : '未知'}）`;
    return;
  }

  list.innerHTML = items.map(it => {
    const star = it.stars ? `⭐ ${it.stars}` : '';
    const t = it.type || '';
    const s = it.source || '';
    const up = it.updatedAt ? `更新: ${fmtDate(it.updatedAt)}` : '';
    
    // 高亮显示使用案例相关的关键词
    const highlightKeywords = ['tutorial', 'example', 'use case', 'guide', 'figurine', '3d', 'editing'];
    let highlightedTitle = it.title;
    let highlightedDesc = it.description || '';
    
    highlightKeywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlightedTitle = highlightedTitle.replace(regex, '<mark>$1</mark>');
      highlightedDesc = highlightedDesc.replace(regex, '<mark>$1</mark>');
    });
    
    // 处理描述内容截断
    let descHtml = '';
    if (highlightedDesc) {
      const maxLength = 200; // 最大显示字符数
      const escapedDesc = highlightedDesc.replace(/</g, '&lt;');
      
      if (escapedDesc.length > maxLength) {
        const truncatedDesc = escapedDesc.substring(0, maxLength);
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
        <h3 class="title"><a href="${it.url}" target="_blank" rel="noopener noreferrer">${highlightedTitle}</a></h3>
        <div class="meta">
          <span class="type-badge">${t}</span>
          <span class="source-badge">${s}</span>
          ${star ? `<span class="stars">${star}</span>` : ''}
          ${up ? `<span class="update">${up}</span>` : ''}
          ${it.author ? `<span class="author">作者: ${it.author}</span>` : ''}
        </div>
        ${descHtml}
      </li>
    `;
  }).join('');
  stats.textContent = `共 ${items.length} 条（生成时间：${data.generatedAt ? fmtDate(data.generatedAt) : '未知'}）`;
}

function score(it) {
  const stars = it.stars || 0;
  const updated = it.updatedAt ? new Date(it.updatedAt).getTime() : 0;
  const recency = updated ? (Date.now() - updated) : Infinity;
  const recencyScore = updated ? Math.max(0, 1_000_000_000 - recency / 10_000) : 0;
  return stars * 1000 + recencyScore;
}

// 检查内容是否与 nano banana 相关
function isRelevantContent(item) {
  // 对于 repo 和 readme 类型，通常都是相关的
  if (item.type === 'repo' || item.type === 'readme') {
    return true;
  }
  
  // 完全排除所有 PR 和 Issue 类型
  if (item.type === 'pull' || item.type === 'issue') {
    return false;
  }
  
  // 其他类型默认保留
  return true;
}

function filterAndSort() {
  const kw = q.value.toLowerCase();
  let items = data.items.slice();

  // 首先过滤内容相关性
  items = items.filter(isRelevantContent);

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
  // 只基于过滤后的相关内容获取类型和来源
  const relevantItems = data.items.filter(isRelevantContent);
  const types = [...new Set(relevantItems.map(item => item.type).filter(Boolean))];
  const sources = [...new Set(relevantItems.map(item => item.source).filter(Boolean))];
  
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
    const res = await fetch('./public/data.json', { cache: 'no-store' });
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

[q, type, source, sortSel].forEach(el => el.addEventListener('input', filterAndSort));
boot();

