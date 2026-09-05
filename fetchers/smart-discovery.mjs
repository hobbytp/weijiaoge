// fetchers/smart-discovery.mjs
import { LLMScanner } from './llm-scanner.mjs';
import { getAdaptor } from './adaptors/registry.mjs';
import { GenericAdaptor } from './adaptors/generic.mjs';
import { JSDOM } from 'jsdom';

/**
 * Smart Discovery Extractor.
 * Orchestrates:
 * 1. Content Fetching (if content is snippet/missing)
 * 2. Specific Site Adaptors
 * 3. Heuristic Pre-filter -> LLM Scanner (if candidate)
 * 4. Generic Extraction
 */
export class SmartDiscoveryExtractor {
  constructor() {
    this.llmScanner = new LLMScanner();
  }

  /**
   * 清理 HTML 文本，剥离所有与主要内容无关的噪声 DOM 元素
   * @param {string} content - HTML 或文本
   * @returns {string} 干净的纯文本
   */
  cleanHtmlToText(content) {
    if (!content || typeof content !== 'string') return '';
    if (!content.trim().startsWith('<')) {
      return content.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
    }

    try {
      const dom = new JSDOM(content);
      const doc = dom.window.document;

      // 移除导航、页眉页脚、侧边栏、脚本样式等噪声节点，大幅节省 Token 并提升提取准确度
      doc.querySelectorAll(
        'script, style, noscript, nav, header, footer, aside, form, svg, iframe, [role="navigation"], [aria-hidden="true"], .cookie-banner, .advertisement'
      ).forEach(el => el.remove());

      const bodyText = doc.body ? (doc.body.textContent || '') : content;
      return bodyText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
    } catch {
      return content;
    }
  }

  /**
   * 启发式初筛：判断页面内容是否具备 AI 生图 / Prompt 提取价值
   * 避免对纯技术文档、普通资讯、无关仓库做无意义的 LLM 调用
   * @param {string} text - 清理后的文本
   * @returns {boolean}
   */
  isCandidateForLLM(text) {
    if (!text || text.length < 40) return false;

    // 匹配生图、Prompt、模型或相关风格特征
    const candidateRegex = /(?:prompt|nano\s*banana|gemini|imagen|text-to-image|t2i|generate|style\s*transfer|figurine|character|portrait|photorealistic|cinematic|lighting|midjourney|flux|提示词|生图|微蕉|画风|风格迁移|手办|人像|文生图|出图|咒语)/i;

    return candidateRegex.test(text);
  }

  /**
   * Fetch full content from URL if the provided content looks like a snippet.
   * @param {string} url 
   * @param {string} currentContent 
   * @returns {Promise<string>}
   */
  async ensureFullContent(url, currentContent) {
    if (!url || !url.startsWith('http')) return currentContent;

    // 若内容太短或仅为 meta 摘要，尝试获取完整网页
    if (!currentContent || currentContent.length < 1000) {
      try {
        console.log(`🌐 Fetching full content from: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        console.error(`❌ Failed to fetch ${url}:`, error.message);
      }
    }
    return currentContent;
  }

  /**
   * Extract cases from content using the best available method.
   * @param {string} initialContent - HTML or Text content (or snippet)
   * @param {string} url - Source URL
   * @param {object} options - Optional context
   * @returns {Promise<Array>} - Array of extracted cases
   */
  async extract(initialContent, url, options = {}) {
    // 0. 确保具备较完整内容
    const content = await this.ensureFullContent(url, initialContent);

    // 1. 尝试特定站点适配器
    const adaptor = getAdaptor(url);
    if (!(adaptor instanceof GenericAdaptor)) {
      console.log(`🔌 Using specific adaptor: ${adaptor.constructor.name}`);
      try {
        return await adaptor.extract(content, url, options);
      } catch {
        console.error(`Specific adaptor ${adaptor.constructor.name} failed, falling back to smart discovery.`);
      }
    }

    // 提取清洗后的降噪纯文本
    const cleanText = this.cleanHtmlToText(content);

    // 2. 启发式前置过滤 -> LLM Scanner 扫描
    if (this.llmScanner.isAvailable) {
      if (this.isCandidateForLLM(cleanText)) {
        console.log(`🤖 [LLM Scanner] 页面检测到生图特征，开始调用 LLM 提取: ${url}`);
        try {
          const llmCases = await this.llmScanner.scan(cleanText, url);
          if (llmCases && llmCases.length > 0) {
            console.log(`✅ LLM 成功提取出 ${llmCases.length} 个案例`);
            return llmCases.map(c => ({
              ...c,
              sourceUrl: url,
              source: 'web-llm',
              extractedAt: new Date().toISOString(),
              confidence: 0.9
            }));
          } else {
            console.log(`ℹ️ LLM 未在页面中发现有效 prompt 案例`);
          }
        } catch (e) {
          console.error('LLM Scan failed/error, falling back to generic.', e.message);
        }
      } else {
        console.log(`⏭️ [Heuristic Filter] 跳过 LLM 扫描（未匹配到 Prompt / 生图特征关键词）: ${url}`);
      }
    }

    // 3. Fallback to Generic (Enhanced Extractor)
    console.log('Using Generic Enhanced Extractor...');
    return await adaptor.extract(cleanText, url, options);
  }
}
