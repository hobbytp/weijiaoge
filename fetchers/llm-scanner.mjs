
/**
 * LLM-based Scanner to extract structured cases from unstructured content.
 * Supports Gemini and OpenAI.
 */
export class LLMScanner {
  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.model = 'gemini-3-flash-preview'; // Default model
  }

  get isAvailable() {
    return !!(this.geminiKey || this.openaiKey);
  }

  /**
   * Extract cases from content using LLM
   * @param {string} content - Text or HTML content
   * @param {string} url - Source URL
   * @returns {Promise<Array>} - Array of extracted cases
   */
  async scan(content, url) {
    if (!this.isAvailable) {
      console.log('⚠️ LLM Scanner not available (no keys)');
      return [];
    }

    // Truncate content to avoid token limits (approx 30k chars)
    const truncatedContent = content.substring(0, 30000);
    
    const systemPrompt = `
You are an expert data extractor for "Nano Banana" (a generative AI model).
Your task is to extract "Use Cases" from the provided webpage content.
A "Use Case" consists of:
1. A **Title** (short summary).
2. A **Prompt** (the text input used to generate the image).
3. **Effects** (list of tags/keywords describing what happened, e.g., "Style Transfer", "Character Consistency").
4. **Images** (list of image URLs showing the result or input).

Rules:
- Only extract cases that clearly have a Prompt.
- Ignore navigation menus, footers, and unrelated text.
- Return the result as a JSON object with a key "cases" containing an array of objects.
- Each object must have: title, prompt, effects (array), images (array).
- If no cases are found, return {"cases": []}.
- The source URL is: ${url} (use this to resolve relative image paths if needed, but prefer absolute).
    `;

    try {
      if (this.geminiKey) {
        return await this.callGemini(truncatedContent, systemPrompt);
      } else {
        return await this.callOpenAI(truncatedContent, systemPrompt);
      }
    } catch (error) {
      console.error('❌ LLM Scan failed:', error.message);
      return [];
    }
  }

  async callGemini(content, systemPrompt) {
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nWebpage Content:\n${content}`
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) return [];

    try {
      const result = JSON.parse(text);
      return result.cases || [];
    } catch (e) {
      console.error('Failed to parse Gemini JSON response');
      return [];
    }
  }

  async callOpenAI(content, systemPrompt) {
    const payload = {
      model: "gpt-4o-mini", // Cost effective
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" }
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) return [];

    try {
      const result = JSON.parse(text);
      return result.cases || [];
    } catch (e) {
      console.error('Failed to parse OpenAI JSON response');
      return [];
    }
  }
}
