// fetchers/llm-scanner.mjs
/**
 * 统一 OpenAI API 兼容架构的 LLM Scanner
 * 原生支持多模型提供商（包含 Google Gemini 官方 OpenAI 兼容端点、DeepSeek、OpenAI）
 * 具备 HTTP 429 智能熔断（Circuit Breaker）、自动容灾降级（Failover）、
 * 指数退避重试（Exponential Backoff）与多网页批量打包扫描（Multi-page Batching）
 */

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const CASE_CATEGORIES = [
  '3d-figurine',
  'style-transfer',
  'clothing-change',
  'character-design',
  'scene-generation',
  'other'
];

/**
 * 安全解析模型返回的 JSON（支持标准 JSON、Markdown 代码块及截断容错）
 */
function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return null;
  }
}

export class LLMScanner {
  constructor() {
    this.lastCallTime = 0;
    this.minIntervalMs = 800; // 最小请求间隔，防止短时触发 RPM 限制
    this.maxRetries = 2;      // 最大重试次数（遇配额耗尽则直接熔断无需等待）

    // 统一各提供商的 OpenAI 协议配置与熔断状态
    this.providers = {
      gemini: {
        id: 'gemini',
        name: 'Google Gemini (OpenAI 兼容端点)',
        baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        isExhausted: false,
        exhaustedReason: null
      },
      deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        isExhausted: false,
        exhaustedReason: null
      },
      openai: {
        id: 'openai',
        name: 'OpenAI',
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        isExhausted: false,
        exhaustedReason: null
      }
    };
  }

  /**
   * 获取当前配置了 API Key 且未被熔断的可用提供商列表（按优先级排序）
   */
  getAvailableProviders() {
    const preferred = (process.env.LLM_PROVIDER || '').toLowerCase();
    const order = preferred && this.providers[preferred]
      ? [preferred, ...['gemini', 'deepseek', 'openai'].filter(p => p !== preferred)]
      : ['gemini', 'deepseek', 'openai'];

    return order
      .map(key => this.providers[key])
      .filter(provider => Boolean(provider.apiKey) && !provider.isExhausted);
  }

  get isAvailable() {
    return this.getAvailableProviders().length > 0;
  }

  /**
   * 重置所有提供商熔断状态（用于调试或新运行周期）
   */
  resetCircuitBreakers() {
    for (const provider of Object.values(this.providers)) {
      provider.isExhausted = false;
      provider.exhaustedReason = null;
    }
  }

  /**
   * 请求节流，确保请求间隔安全
   */
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastCallTime = Date.now();
  }

  /**
   * 带 429 智能熔断与指数退避的通用 HTTP POST 包装
   */
  async postWithRetry(url, headers, body, provider) {
    let delay = 1500;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.throttle();
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        // 遇到认证异常 (401) 或余额不足 (402) 时直接熔断
        if (response.status === 401 || response.status === 402) {
          const errText = await response.text().catch(() => '');
          provider.isExhausted = true;
          provider.exhaustedReason = `HTTP ${response.status} 认证/账户异常: ${errText.slice(0, 120)}`;
          console.warn(`🚫 [${provider.name}] HTTP ${response.status} 鉴权或余额异常，触发熔断并切换下一模型！`);
          throw new Error(`[CIRCUIT_BREAKER] ${provider.name} 认证或账户异常: ${errText.slice(0, 150)}`);
        }

        // 遇到限流 (429) 或服务端故障 (5xx)
        if (response.status === 429 || response.status >= 500) {
          let errText = '';
          try {
            errText = await response.text();
          } catch {}

          // 核心特性：检测配额耗尽关键词（如 Gemini RESOURCE_EXHAUSTED、OpenAI insufficient_quota）
          const isQuotaExhausted = response.status === 429 && (
            /RESOURCE_EXHAUSTED|quota|insufficient_quota|balance|billing|credit|limit reached/i.test(errText) ||
            /exceeded your current quota/i.test(errText)
          );

          if (isQuotaExhausted) {
            provider.isExhausted = true;
            provider.exhaustedReason = `HTTP 429 配额耗尽: ${errText.slice(0, 120)}`;
            console.warn(`🚫 [${provider.name}] 检测到配额耗尽 (HTTP 429 Quota Exhausted)，触发熔断！立即排除该提供商并切换备用模型`);
            throw new Error(`[CIRCUIT_BREAKER] ${provider.name} 配额耗尽: ${errText.slice(0, 150)}`);
          }

          // 常规 429 (并发限流) 或 5xx 故障
          const isLastAttempt = attempt === this.maxRetries;
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 10000) : delay;

          console.warn(`⚠️ [${provider.name}] HTTP ${response.status} (尝试 ${attempt}/${this.maxRetries})，等待 ${(waitTime / 1000).toFixed(1)}s 后重试...`);
          if (isLastAttempt) {
            if (response.status === 429) {
              provider.isExhausted = true;
              provider.exhaustedReason = `429 限流重试耗尽: ${errText.slice(0, 120)}`;
              console.warn(`🚫 [${provider.name}] 429 重试耗尽，本轮执行熔断该提供商`);
            }
            throw new Error(`${provider.name} HTTP ${response.status} (重试耗尽) ${errText.slice(0, 150)}`);
          }
          await sleep(waitTime);
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`${provider.name} 错误: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
        }

        return await response.json();
      } catch (err) {
        if (err.message.startsWith('[CIRCUIT_BREAKER]') || attempt === this.maxRetries) {
          throw err;
        }
        console.warn(`⚠️ [${provider.name}] 请求异常 (${err.message})，${delay / 1000}s 后重试 (第 ${attempt} 次)...`);
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  /**
   * 基于统一 OpenAI ChatCompletions 规范执行单次 LLM 请求
   */
  async callChatCompletions(provider, systemPrompt, userPrompt) {
    const cleanBase = provider.baseURL.replace(/\/+$/, '');
    const endpoint = cleanBase.endsWith('/chat/completions')
      ? cleanBase
      : `${cleanBase}/chat/completions`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`
    };

    const payload = {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    };

    return await this.postWithRetry(endpoint, headers, payload, provider);
  }

  /**
   * 多网页批量扫描 (Multi-page Batching)
   * 将 3~4 个候选网页打包进单个 LLM 提示词中，显著减少调用次数并提升 CI 吞吐量
   * @param {Array<{ id: string, url: string, title: string, content: string }>} pages - 待分析网页数组
   * @returns {Promise<Record<string, Array>>} 各页面 id 对应提取出的案例数组映射表
   */
  async scanBatch(pages) {
    const resultsMap = {};
    for (const page of pages) {
      resultsMap[page.id] = [];
    }

    if (!pages || pages.length === 0) return resultsMap;

    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) {
      console.warn('⚠️ [LLM Scanner] 未配置任何可用或未熔断的 API Key');
      return resultsMap;
    }

    // 组合批量 Prompt
    const systemPrompt = `
You are an expert data extractor for "Nano Banana" / Gemini Flash Image Preview (a generative AI image model).
Your task is to extract all "Use Cases" from each of the provided web pages.

Each Use Case consists of:
1. title: Short summary of the case (max 50 chars).
2. prompt: The exact text prompt used to generate or edit the image.
3. category: Best category from: [${CASE_CATEGORIES.map(c => `"${c}"`).join(', ')}].
4. effects: Array of keywords/tags describing the effect (e.g. ["Style Transfer", "Character Consistency"]).
5. images: Array of image URLs showing input/output results (resolve relative paths using that page's source URL).

Rules:
- Only extract cases that clearly have a Prompt for image generation.
- Ignore navigation menus, unrelated code snippets, footers, and general comments.
- You MUST return a JSON object with a "pages" array matching each page's "id":
{
  "pages": [
    {
      "id": "page-id",
      "cases": [
        {
          "title": "...",
          "prompt": "...",
          "category": "...",
          "effects": [...],
          "images": [...]
        }
      ]
    }
  ]
}
If a page has no use cases, return "cases": [] for that page's id.
`;

    // 格式化各页面文本（每个页面安全截断至 3500 字符，保留最核心的 prompt 描述区域）
    const userPrompt = pages.map((p, idx) => {
      const truncated = (p.content || '').substring(0, 3500);
      return `=== PAGE ${idx + 1} [ID: ${p.id}] [URL: ${p.url || ''}] [TITLE: ${p.title || ''}] ===\n${truncated}`;
    }).join('\n\n');

    // 链式容灾调度：遍历可用提供商
    while (true) {
      const currentAvailable = this.getAvailableProviders();
      if (currentAvailable.length === 0) {
        console.warn('⚠️ 所有 LLM 提供商均已熔断或不可用，批量提取降级');
        break;
      }

      const provider = currentAvailable[0];
      try {
        console.log(`🤖 正在调用 ${provider.name} (${provider.model}) 批量分析 ${pages.length} 个页面...`);
        const data = await this.callChatCompletions(provider, systemPrompt, userPrompt);
        const text = data?.choices?.[0]?.message?.content;
        const parsed = safeParseJson(text);

        if (!parsed) {
          throw new Error(`无法解析模型返回的 JSON 内容: ${text?.slice(0, 100)}`);
        }

        // 统一解析结果
        if (Array.isArray(parsed.pages)) {
          for (const pageItem of parsed.pages) {
            if (pageItem?.id && Array.isArray(pageItem.cases)) {
              resultsMap[pageItem.id] = pageItem.cases;
            }
          }
        } else if (pages.length === 1 && Array.isArray(parsed.cases)) {
          resultsMap[pages[0].id] = parsed.cases;
        }

        return resultsMap;
      } catch (err) {
        console.error(`❌ [${provider.name}] 批量提取失败: ${err.message}`);
        // 发生错误时如果该提供商已被标记熔断，下一次循环将自动调用后续可用提供商
        if (!provider.isExhausted) {
          provider.isExhausted = true;
          provider.exhaustedReason = err.message;
        }
      }
    }

    return resultsMap;
  }

  /**
   * 单页面扫描（兼容原有 scan 接口，底层复用 scanBatch）
   * @param {string} content - 页面纯文本内容
   * @param {string} url - 来源 URL
   * @param {string} title - 页面标题
   * @returns {Promise<Array>} 提取出的案例数组
   */
  async scan(content, url, title = '') {
    const pageId = url || 'page_0';
    const batchResult = await this.scanBatch([{
      id: pageId,
      url,
      title,
      content
    }]);
    return batchResult[pageId] || [];
  }
}

