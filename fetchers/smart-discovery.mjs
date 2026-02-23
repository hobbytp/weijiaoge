
import { LLMScanner } from './llm-scanner.mjs';
import { getAdaptor } from './adaptors/registry.mjs';
import { GenericAdaptor } from './adaptors/generic.mjs';
import { JSDOM } from 'jsdom';

/**
 * Smart Discovery Extractor.
 * Orchestrates:
 * 1. Content Fetching (if content is snippet/missing)
 * 2. Specific Site Adaptors
 * 3. LLM Scanner
 * 4. Generic Extraction
 */
export class SmartDiscoveryExtractor {
  constructor() {
    this.llmScanner = new LLMScanner();
  }

  /**
   * Fetch full content from URL if the provided content looks like a snippet.
   * @param {string} url 
   * @param {string} currentContent 
   * @returns {Promise<string>}
   */
  async ensureFullContent(url, currentContent) {
    // If no URL or not http(s), return as is
    if (!url || !url.startsWith('http')) return currentContent;

    // Heuristic: If content is short (< 1000 chars) or looks like a snippet, fetch full page.
    // For web search results, description is usually just a meta description.
    if (!currentContent || currentContent.length < 1000) {
      try {
        console.log(`🌐 Fetching full content from: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          // Use JSDOM to strip scripts/styles and get text (or keep HTML for specific adaptors)
          // For now, we return HTML because adaptors/LLM might need structure.
          // But LLM scanner prefers text to save tokens, though it can handle HTML.
          // Let's return HTML and let consumers decide, or strip it here.
          // Actually, GenericAdaptor expects text-like content or simple HTML.
          return html;
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
    // 0. Ensure we have full content
    const content = await this.ensureFullContent(url, initialContent);

    // 1. Try Specific Adaptor
    const adaptor = getAdaptor(url);
    
    // If we found a specific adaptor (not Generic), use it.
    if (!(adaptor instanceof GenericAdaptor)) {
      console.log(`🔌 Using specific adaptor: ${adaptor.constructor.name}`);
      try {
        return await adaptor.extract(content, url, options);
      } catch (e) {
        console.error(`Specific adaptor ${adaptor.constructor.name} failed, falling back to smart discovery.`);
      }
    }

    // 2. Try LLM Scanner if available
    if (this.llmScanner.isAvailable) {
      console.log('🤖 Using LLM Scanner for discovery...');
      try {
        // Strip HTML for LLM to save tokens, unless we think structure is needed.
        // Simple strip:
        const dom = new JSDOM(content);
        const textContent = dom.window.document.body.textContent || content;
        
        const llmCases = await this.llmScanner.scan(textContent, url);
        if (llmCases && llmCases.length > 0) {
          console.log(`✅ LLM found ${llmCases.length} cases.`);
          // Enrich cases with metadata
          return llmCases.map(c => ({
            ...c,
            sourceUrl: url,
            source: 'web-llm',
            extractedAt: new Date().toISOString(),
            confidence: 0.9 // High confidence for LLM results
          }));
        } else {
            console.log('LLM found no cases.');
        }
      } catch (e) {
        console.error('LLM Scan failed/error, falling back to generic.', e);
      }
    }

    // 3. Fallback to Generic (Enhanced Extractor)
    // Note: GenericAdaptor wraps extractEnhancedCases which handles regex extraction.
    // It works best on Markdown or simple text.
    // If we passed HTML, we might want to convert to text first?
    // extractEnhancedCases has "smartCleanText" but it doesn't strip HTML tags aggressively enough for raw HTML pages.
    // Let's use JSDOM to get text for Generic Adaptor if content is HTML.
    let textForGeneric = content;
    if (content.trim().startsWith('<')) {
         const dom = new JSDOM(content);
         // Remove scripts/styles
         const doc = dom.window.document;
         doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());
         textForGeneric = doc.body.textContent || content;
    }

    console.log('Using Generic Enhanced Extractor...');
    return await adaptor.extract(textForGeneric, url, options);
  }
}
