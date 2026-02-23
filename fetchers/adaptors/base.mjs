
/**
 * Base class for Site Adaptors.
 * Each adaptor handles a specific domain or URL pattern.
 */
export class BaseAdaptor {
  constructor() {
    this.name = 'BaseAdaptor';
    this.priority = 0; // Higher = specific match
  }

  /**
   * Check if this adaptor supports the given URL
   * @param {string} url 
   * @returns {boolean}
   */
  static match(url) {
    return false;
  }

  /**
   * Extract cases from content
   * @param {string} content - HTML or Text content
   * @param {string} url - Source URL
   * @param {object} options - Optional context
   * @returns {Promise<Array>} - Array of extracted cases
   */
  async extract(content, url, options = {}) {
    throw new Error('Not implemented');
  }
}
