
import { BaseAdaptor } from './base.mjs';
import { extractEnhancedCases } from '../enhanced-case-extractor.mjs';

/**
 * Generic adaptor that uses EnhancedCaseExtractor.
 * Matches any URL as a fallback.
 */
export class GenericAdaptor extends BaseAdaptor {
  constructor() {
    super();
    this.name = 'GenericAdaptor';
    this.priority = 10; // Lowest priority
  }

  static match(url) {
    return true; // Matches everything
  }

  async extract(content, url, options = {}) {
    try {
      // Use existing enhanced extractor logic
      const cases = await extractEnhancedCases(content, { ...options, url });
      return cases;
    } catch (error) {
      console.error('Generic extraction failed:', error);
      return [];
    }
  }
}
