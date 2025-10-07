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
  // 基础搜索词
  '"nano banana" tutorial',
  '"nano banana" example',
  '"nano banana" use case',
  '"nano banana" prompt',
  '"nano banana" image generation',
  
  // 具体仓库名称
  'awesome-nano-banana',
  'nano-banana-images',
  'nano-banana-creation',
  'nano-banana-examples',
  
  // Gemini相关
  '"gemini 2.5 flash image" tutorial',
  '"gemini 2.5 flash image" example',
  '"gemini 2.5 flash image" prompt',
  
  // 更广泛的搜索
  'nano banana',
  'nanobanana',
  'nano_banana',
  
  // 图像生成相关
  '"nano banana" image',
  '"nano banana" generation',
  '"nano banana" model'
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

// 专门获取特定重要仓库的内容
async function fetchSpecificRepos() {
  const specificRepos = [
    'PicoTrex/Awesome-Nano-Banana-images',
    'ZHO-ZHO-ZHO/ZHO-nano-banana-Creation',
    'Super-Maker-AI/awesome-nano-banana'
  ];
  
  const results = [];
  for (const repo of specificRepos) {
    try {
      // 获取仓库基本信息
      const repoData = await gh(`${BASE}/repos/${repo}`);
      results.push(mapRepo(repoData));
      
      // 获取README内容
      try {
        const readmeData = await gh(`${BASE}/repos/${repo}/readme`);
        const readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');
        
        // 将README作为特殊项目添加
        results.push({
          id: `readme:${repoData.id}`,
          title: `${repo} - README`,
          url: `${repoData.html_url}#readme`,
          description: readmeContent, // 保存完整内容，不截断
          source: 'github',
          type: 'readme',
          author: repoData.owner?.login || '',
          stars: repoData.stargazers_count || 0,
          createdAt: repoData.created_at,
          updatedAt: repoData.updated_at,
          tags: ['readme', 'prompt-examples'],
          fullContent: readmeContent
        });
      } catch (readmeError) {
        console.log(`无法获取 ${repo} 的README:`, readmeError.message);
      }
      
    } catch (error) {
      console.log(`无法获取仓库 ${repo}:`, error.message);
    }
  }
  
  return results;
}

export async function fetchFromGitHub() {
  const all = [];
  
  try {
    // 优先获取特定重要仓库（这些包含最多的prompt案例）
    console.log('🎯 获取特定重要仓库...');
    const specificRepos = await fetchSpecificRepos();
    all.push(...specificRepos);
    
    // 如果还有API配额，进行常规搜索
    console.log('🔍 进行常规GitHub搜索...');
    const limitedTerms = TERMS.slice(0, 5); // 只搜索前5个最重要的词
    
    for (const term of limitedTerms) {
      try {
        const [repos, issues] = await Promise.all([
          searchRepos(term, 1), // 只搜索第一页
          searchIssues(term, 1) // 只搜索第一页
        ]);
        all.push(...repos, ...issues);
      } catch (error) {
        console.log(`搜索词 "${term}" 失败:`, error.message);
        // 如果遇到速率限制，停止搜索
        if (error.message.includes('rate limit')) {
          console.log('⚠️ 遇到API速率限制，停止常规搜索');
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('GitHub fetch failed:', error.message);
  }
  
  return all;
}

