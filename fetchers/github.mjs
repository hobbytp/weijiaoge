// fetchers/github.mjs
const BASE = 'https://api.github.com';

function headers() {
  const h = { 'Accept': 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${txt}`);
  }
  return res.json();
}

function mapRepo(r) {
  return {
    id: `repo:${r.id}`,
    title: r.full_name,
    url: r.html_url,
    description: r.description || '',
    source: 'github',
    type: 'repo',
    author: r.owner?.login || '',
    stars: r.stargazers_count || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    tags: ['repo']
  };
}

function mapIssue(i) {
  return {
    id: `issue:${i.id}`,
    title: i.title,
    url: i.html_url,
    description: i.body?.slice(0, 500) || '',
    source: 'github',
    type: i.pull_request ? 'pull' : 'issue',
    author: i.user?.login || '',
    stars: 0,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    tags: [i.pull_request ? 'pull' : 'issue']
  };
}

// 核心查询词（专注于使用案例和教程）
const TERMS = [
  '"nano banana" tutorial',
  '"nano banana" example',
  '"nano banana" use case',
  '"gemini 2.5 flash image" tutorial',
  '"gemini 2.5 flash image" example'
];

async function searchRepos(q, pages = 1) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const url = `${BASE}/search/repositories?q=${encodeURIComponent(q)}+in:name,description,readme&sort=updated&order=desc&per_page=20&page=${p}`;
    const data = await gh(url);
    if (!data.items?.length) break;
    out.push(...data.items.map(mapRepo));
  }
  return out;
}

async function searchIssues(q, pages = 1) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const url = `${BASE}/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=20&page=${p}`;
    const data = await gh(url);
    if (!data.items?.length) break;
    out.push(...data.items.map(mapIssue));
  }
  return out;
}

export async function fetchFromGitHub() {
  const all = [];
  for (const term of TERMS) {
    const [repos, issues] = await Promise.all([
      searchRepos(term),
      searchIssues(term)
    ]);
    all.push(...repos, ...issues);
  }
  return all;
}

