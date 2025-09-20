// fetchers/web.mjs
const SERPAPI_BASE = 'https://serpapi.com/search';

function headers() {
  const h = { 'Accept': 'application/json' };
  return h;
}

async function serpapi(query, pages = 1) {
  if (!process.env.SERPAPI_KEY) {
    console.log('SERPAPI_KEY not set, skipping web search');
    return [];
  }

  const results = [];
  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams({
      q: query,
      api_key: process.env.SERPAPI_KEY,
      engine: 'google',
      start: page * 10,
      num: 10
    });

    try {
      const res = await fetch(`${SERPAPI_BASE}?${params}`, { headers: headers() });
      if (!res.ok) {
        console.error(`SerpAPI error: ${res.status}`);
        break;
      }
      const data = await res.json();
      
      if (data.organic_results) {
        results.push(...data.organic_results.map(mapResult));
      }
    } catch (e) {
      console.error('SerpAPI request failed:', e.message);
      break;
    }
  }
  return results;
}

function mapResult(r) {
  return {
    id: `web:${r.position || Math.random()}`,
    title: r.title || '',
    url: r.link || '',
    description: r.snippet || '',
    source: 'web',
    type: 'article',
    author: r.source || '',
    stars: 0,
    createdAt: null,
    updatedAt: null,
    tags: ['web', 'article']
  };
}

// 搜索关键词
const WEB_TERMS = [
  'gemini 2.5 flash image preview tutorial',
  'gemini nano banana examples',
  'gemini-2.5-flash-image-preview guide',
  'google gemini image preview api'
];

export async function fetchFromWeb() {
  const all = [];
  for (const term of WEB_TERMS) {
    const results = await serpapi(term, 1);
    all.push(...results);
  }
  return all;
}
