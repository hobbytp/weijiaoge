/* global window, document, fetch */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const searchInput = $('#search');
const categorySelect = $('#category');
const sortSelect = $('#sort');
const stats = $('#stats');
const casesGrid = $('#cases-grid');

let casesData = { cases: [] };

function renderCase(caseItem) {
  const promptsHtml = caseItem.prompts.map(prompt => 
    `<div class="prompt-text">${prompt}</div>`
  ).join('');
  
  const effectsHtml = caseItem.effects.map(effect => 
    `<div class="effect-text">${effect}</div>`
  ).join('');
  
  const imagesHtml = caseItem.images.length > 0 ? `
    <div class="images-section">
      <div class="image-grid">
        ${caseItem.images.map(img => 
          `<img src="${img}" alt="效果图" class="case-image" onerror="this.style.display='none'">`
        ).join('')}
      </div>
    </div>
  ` : '';
  
  return `
    <div class="case-card">
      <div class="case-title">${caseItem.title}</div>
      <div class="case-category">${caseItem.categoryName}</div>
      
      ${caseItem.prompts.length > 0 ? `
        <div class="prompt-section">
          <div class="prompt-label">🎯 Prompt:</div>
          ${promptsHtml}
        </div>
      ` : ''}
      
      ${caseItem.effects.length > 0 ? `
        <div class="effect-section">
          <div class="effect-label">✨ 效果:</div>
          ${effectsHtml}
        </div>
      ` : ''}
      
      ${imagesHtml}
      
      <div class="source-link">
        <a href="${caseItem.sourceUrl}" target="_blank" rel="noopener noreferrer">
          查看原文 →
        </a>
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

  casesGrid.innerHTML = cases.map(renderCase).join('');
  stats.textContent = `共 ${cases.length} 个案例`;
}

function filterAndSort() {
  const searchTerm = (searchInput.value || '').toLowerCase();
  const selectedCategory = categorySelect.value;
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
[searchInput, categorySelect, sortSelect].forEach(element => {
  element.addEventListener('input', filterAndSort);
});

// 页面加载完成后加载数据
document.addEventListener('DOMContentLoaded', loadCases);
