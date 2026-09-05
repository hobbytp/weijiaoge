// fetchers/llm-scanner.mjs
/**
 * LLM-based Scanner to extract structured cases from unstructured content.
 * Features:
 * - Dual-model support: Google Gemini (default) + OpenAI (failover/fallback)
 * - Exponential backoff retry on 429 / 5xx errors
 * - Rate limiting throttle to stay within RPM limits
 * - Structured Output Schema with category classification
 */

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const CATEGORIES = [
  '3d-figurine',
  'style-transfer',
  'clothing-change',
  'character-design',
  'scene-generation',
  'other'
];

export class LLMScanner {
  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    this.lastCallTime = 0;
    this.minIntervalMs = 800; // 最小请求间隔，防止短时触发 RPM 限制
    this.maxRetries = 3;      // 429 / 5xx 最大重试次数
  }

  get isAvailable() {
    return !!(this.geminiKey || this.openaiKey);
  }

  /**
   * 限流节流，确保请求间隔安全
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
   * 带指数退避的通用 fetch 重试包装
   */
  async fetchWithRetry(url, options, modelName = 'LLM') {
    let delay = 2000;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.throttle();
        const response = await fetch(url, options);

        // 遇到限流 (429) 或服务端错误 (5xx) 时退避重试
        if (response.status === 429 || response.status >= 500) {
          const isLastAttempt = attempt === this.maxRetries;
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

          console.warn(`⚠️ [${modelName}] HTTP ${response.status} (尝试 ${attempt}/${this.maxRetries})，等待 ${(waitTime / 1000).toFixed(1)}s 后重试...`);
          if (isLastAttempt) {
            throw new Error(`${modelName} API Error ${response.status} (重试耗尽)`);
          }
          await sleep(waitTime);
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`${modelName} API Error: ${response.status} ${response.statusText} ${errText.slice(0, 200)}`);
        }

        return await response.json();
      } catch (err) {
        if (attempt === this.maxRetries) {
          throw err;
        }
        console.warn(`⚠️ [${modelName}] 网络异常 (${err.message})，${delay / 1000}s 后重试 (第 ${attempt} 次)...`);
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  /**
   * Extract cases from content using LLM with auto-failover
   * @param {string} content - Text or HTML content
   * @param {string} url - Source URL
   * @returns {Promise<Array>} - Array of extracted cases
   */
  async scan(content, url) {
    if (!this.isAvailable) {
      console.log('⚠️ LLM Scanner not available (no keys)');
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
3. category: The best category from: [${CATEGORIES.map(c => `"${c}"`).join(', ')}].
4. effects: Array of keywords/tags describing the effect (e.g. ["Style Transfer", "Character Consistency"]).
5. images: Array of image URLs showing input/output results.

Rules:
- Only extract cases that clearly have a Prompt.
- Ignore navigation menus, code snippets unrelated to image generation, footers, and general comments.
- Source URL is: ${url} (use this to resolve relative image paths).
- Return JSON strictly following the schema. If no use cases are found, return {"cases": []}.
`;

    // 容灾调度：优先使用 Gemini，失败时自动降级尝试 OpenAI
    if (this.geminiKey) {
      try {
        const cases = await this.callGemini(truncatedContent, systemPrompt);
        if (Array.isArray(cases)) return cases;
      } catch (geminiError) {
        console.error(`❌ Gemini 调用失败: ${geminiError.message}`);
        if (this.openaiKey) {
          console.log(`🔄 自动容灾降级：切换至 OpenAI (${this.openaiModel})...`);
          try {
            return await this.callOpenAI(truncatedContent, systemPrompt);
          } catch (openaiError) {
            console.error(`❌ OpenAI 备用调用同样失败: ${openaiError.message}`);
          }
        }
        return [];
      }
    } else if (this.openaiKey) {
      try {
        return await this.callOpenAI(truncatedContent, systemPrompt);
      } catch (error) {
        console.error(`❌ OpenAI 调用失败: ${error.message}`);
        return [];
      }
    }

    return [];
  }

  async callGemini(content, systemPrompt) {
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nWebpage Content:\n${content}`
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            cases: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  prompt: { type: "STRING" },
                  category: { type: "STRING", enum: CATEGORIES },
                  effects: { type: "ARRAY", items: { type: "STRING" } },
                  images: { type: "ARRAY", items: { type: "STRING" } }
                },
                required: ["title", "prompt"]
              }
            }
          },
          required: ["cases"]
        }
      }
    };

    const data = await this.fetchWithRetry(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, `Gemini (${this.geminiModel})`);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];

    try {
      const result = JSON.parse(text);
      return Array.isArray(result.cases) ? result.cases : [];
    } catch {
      console.error('Failed to parse Gemini JSON response');
      return [];
    }
  }

  async callOpenAI(content, systemPrompt) {
    const payload = {
      model: this.openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" }
    };

    const data = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify(payload)
    }, `OpenAI (${this.openaiModel})`);

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return [];

    try {
      const result = JSON.parse(text);
      return Array.isArray(result.cases) ? result.cases : [];
    } catch {
      console.error('Failed to parse OpenAI JSON response');
      return [];
    }
  }
}
