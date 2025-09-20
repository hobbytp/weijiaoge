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

function render(items) {
  list.innerHTML = items.map(it => {
    const star = it.stars ? `⭐ ${it.stars}` : '';
    const t = it.type || '';
    const s = it.source || '';
    const up = it.updatedAt ? `更新: ${fmtDate(it.updatedAt)}` : '';
    return `
      <li class="card">
        <h3 class="title"><a href="${it.url}" target="_blank" rel="noopener noreferrer">${it.title}</a></h3>
        <div class="meta">
          <span>${t}</span>
          <span>${s}</span>
          ${star ? `<span>${star}</span>` : ''}
          ${up ? `<span>${up}</span>` : ''}
          ${it.author ? `<span>作者: ${it.author}</span>` : ''}
        </div>
        ${it.description ? `<p class="desc">${it.description.replace(/</g, '&lt;')}</p>` : ''}
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

function filterAndSort() {
  const kw = (q.value || '').toLowerCase();
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

async function boot() {
  try {
    const res = await fetch('./public/data.json', { cache: 'no-store' });
    data = await res.json();
  } catch {
    data = { items: [] };
  }
  filterAndSort();
}

[q, type, source, sortSel].forEach(el => el.addEventListener('input', filterAndSort));
boot();

