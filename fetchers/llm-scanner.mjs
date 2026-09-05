// fetchers/llm-scanner.mjs
/**
 * 统一 OpenAI API 兼容架构的 LLM Scanner
 * 原生支持多模型提供商（包含 Google Gemini 官方 OpenAI 兼容端点、DeepSeek、OpenAI）
 * 具备自动容灾降级（Failover）、指数退避重试（Exponential Backoff）与请求限流保护（Throttling）
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

export class LLMScanner {
  constructor() {
    this.lastCallTime = 0;
    this.minIntervalMs = 800; // 最小请求间隔，防止短时触发 RPM 限制
    this.maxRetries = 3;      // 429 / 5xx 最大重试次数

    // 统一各提供商的 OpenAI 协议配置
    this.providers = {
      gemini: {
        id: 'gemini',
        name: 'Google Gemini (OpenAI 兼容端点)',
        baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
      },
      deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
      },
      openai: {
        id: 'openai',
        name: 'OpenAI',
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
      }
    };
  }

  /**
   * 获取当前配置了 API Key 的可用提供商列表（按优先级排序）
   */
  getAvailableProviders() {
    // 支持通过环境变量指定首选提供商，例如 LLM_PROVIDER=deepseek
    const preferred = (process.env.LLM_PROVIDER || '').toLowerCase();
    const order = preferred && this.providers[preferred]
      ? [preferred, ...['gemini', 'deepseek', 'openai'].filter(p => p !== preferred)]
      : ['gemini', 'deepseek', 'openai'];

    return order
      .map(key => this.providers[key])
      .filter(provider => Boolean(provider.apiKey));
  }

  get isAvailable() {
    return this.getAvailableProviders().length > 0;
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
   * 带指数退避的通用 HTTP POST 重试包装
   */
  async postWithRetry(url, headers, body, providerName) {
    let delay = 2000;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.throttle();
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        // 遇到限流 (429) 或服务端错误 (5xx) 时退避重试
        if (response.status === 429 || response.status >= 500) {
          const isLastAttempt = attempt === this.maxRetries;
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

          console.warn(`⚠️ [${providerName}] HTTP ${response.status} (尝试 ${attempt}/${this.maxRetries})，等待 ${(waitTime / 1000).toFixed(1)}s 后重试...`);
          if (isLastAttempt) {
            throw new Error(`${providerName} HTTP ${response.status} (重试耗尽)`);
          }
          await sleep(waitTime);
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`${providerName} 错误: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
        }

        return await response.json();
      } catch (err) {
        if (attempt === this.maxRetries) {
          throw err;
        }
        console.warn(`⚠️ [${providerName}] 请求异常 (${err.message})，${delay / 1000}s 后重试 (第 ${attempt} 次)...`);
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  /**
   * 基于统一 OpenAI ChatCompletions 规范调用任一提供商
   */
  async callProvider(provider, content, systemPrompt) {
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
        { role: 'user', content: content }
      ],
      response_format: { type: 'json_object' }
    };

    const data = await this.postWithRetry(endpoint, headers, payload, `${provider.name} (${provider.model})`);
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return [];

    try {
      const result = JSON.parse(text);
      return Array.isArray(result.cases) ? result.cases : [];
    } catch {
      console.error(`[${provider.name}] 解析返回的 JSON 失败:`, text.slice(0, 150));
      return [];
    }
  }

  /**
   * 自动容灾调度：遍历可用提供商提取用例
   * @param {string} content - 页面纯文本内容
   * @param {string} url - 来源 URL
   * @returns {Promise<Array>} 提取出的案例数组
   */
  async scan(content, url) {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) {
      console.log('⚠️ LLM Scanner 未配置任何可用 API Key (Gemini / DeepSeek / OpenAI)');
      return [];
    }

    // 截取合理长度（约 12,000 字符，相当于 3,000~4,000 Token），避免超出上下文或浪费额度
    const truncatedContent = content.substring(0, 12000);

    const systemPrompt = `
You are an expert data extractor for "Nano Banana" / Gemini Flash Image Preview (a generative AI image model).
Your task is to extract all "Use Cases" from the provided webpage content.

A "Use Case" consists of:
1. title: Short summary of the case (max 50 chars).
2. prompt: The exact text prompt used to generate or edit the image.
3. category: The best category from: [${CASE_CATEGORIES.map(c => `"${c}"`).join(', ')}].
4. effects: Array of keywords/tags describing the effect (e.g. ["Style Transfer", "Character Consistency"]).
5. images: Array of image URLs showing input/output results.

Rules:
- Only extract cases that clearly have a Prompt.
- Ignore navigation menus, code snippets unrelated to image generation, footers, and general comments.
- Source URL is: ${url} (use this to resolve relative image paths).
- Return JSON strictly with a top-level key "cases" containing the array of case objects. If no use cases are found, return {"cases": []}.
`;

    // 链式容灾调度：首选提供商失败时，自动尝试下一个可用提供商
    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i];
      try {
        console.log(`🤖 正在调用 ${provider.name} (${provider.model}) 提取案例...`);
        const cases = await this.callProvider(provider, truncatedContent, systemPrompt);
        return cases;
      } catch (err) {
        console.error(`❌ ${provider.name} 提取失败: ${err.message}`);
        const nextProvider = availableProviders[i + 1];
        if (nextProvider) {
          console.log(`🔄 自动容灾降级：尝试切换至 ${nextProvider.name} (${nextProvider.model})...`);
        }
      }
    }

    console.warn('⚠️ 所有配置的 LLM 提供商均已尝试，未成功提取到案例');
    return [];
  }
}
