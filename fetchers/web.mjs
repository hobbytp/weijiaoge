// fetchers/web.mjs
const SERPAPI_BASE = 'https://serpapi.com/search';
const SERPER_BASE = 'https://google.serper.dev/search';

function headers() {
  const h = { 'Accept': 'application/json' };
  return h;
}

function serperHeaders() {
  const h = { 
    'X-API-KEY': process.env.SERPER_API_KEY,
    'Content-Type': 'application/json'
  };
  return h;
}

async function serper(query, pages = 1) {
  if (!process.env.SERPER_API_KEY) {
    console.log('SERPER_API_KEY not set, skipping serper search');
    return [];
  }

  const results = [];
  // Serper usually returns 10-20 results per request.
  // We can't easily paginate deep with Serper in the same way as SerpApi (it uses 'page' or 'num'),
  // but standard /search endpoint supports 'num'.
  
  for (let page = 0; page < pages; page++) {
    const body = {
      q: query,
      num: 20,
      page: page + 1
    };

    try {
      const res = await fetch(SERPER_BASE, { 
        method: 'POST',
        headers: serperHeaders(),
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        console.error(`Serper error: ${res.status}`);
        break;
      }
      const data = await res.json();
      
      if (data.organic) {
        results.push(...data.organic.map(mapSerperResult));
      }
    } catch (e) {
      console.error('Serper request failed:', e.message);
      break;
    }
  }
  return results;
}

function mapSerperResult(r) {
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

// 搜索关键词（专注于具体使用案例）
const WEB_TERMS = [
  'nano banana tutorial how to use examples',
  'gemini 2.5 flash image editing examples',
  'nano banana image editing use cases',
  'gemini nano banana creative examples',
  'nano banana image generation tutorial',
  'gemini 2.5 flash image practical examples',
  'nano banana image manipulation guide',
  'gemini nano banana real world examples'
];

export async function fetchFromWeb() {
  const all = [];
  
  // Try Serper first if available
  if (process.env.SERPER_API_KEY) {
    console.log('🔍 Using Serper for web search...');
    for (const term of WEB_TERMS) {
      const results = await serper(term, 1);
      all.push(...results);
    }
  }

  // Then try SerpApi
  if (process.env.SERPAPI_KEY) {
    console.log('🔍 Using SerpApi for web search...');
    for (const term of WEB_TERMS) {
      const results = await serpapi(term, 1);
      all.push(...results);
    }
  }
  
  if (all.length === 0) {
    console.log('⚠️ No search API keys configured or no results found');
  }

  return all;
}
