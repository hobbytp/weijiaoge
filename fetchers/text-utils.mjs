// fetchers/text-utils.mjs
// 共享的文本处理工具函数

/**
 * 标准化prompt文本用于去重比较
 * @param {string} text - 要标准化的文本
 * @returns {string} 标准化后的文本
 */
export function normalizePrompt(text) {
  return text
    .replace(/^```[\s\S]*?\n/, '') // 移除开头的代码块标记
    .replace(/\n```$/, '') // 移除结尾的代码块标记
    .replace(/^`+|`+$/g, '') // 移除首尾的反引号
    .replace(/\s+/g, ' ') // 标准化空格
    .toLowerCase()
    .trim();
}

/**
 * 简化版本的prompt标准化（仅移除代码块标记）
 * @param {string} text - 要标准化的文本
 * @returns {string} 标准化后的文本
 */
export function normalizePromptSimple(text) {
  return text.replace(/```/g, '').trim();
}

/**
 * 检查是否为截断的prompt
 * @param {string} prompt1 - 第一个prompt
 * @param {string} prompt2 - 第二个prompt
 * @param {number} lengthThreshold - 长度差异阈值，默认为10
 * @returns {boolean} 是否为截断关系
 */
export function isTruncatedPrompt(prompt1, prompt2, lengthThreshold = 10) {
  const norm1 = normalizePrompt(prompt1);
  const norm2 = normalizePrompt(prompt2);
  
  // 如果长度差异小于阈值，不认为是截断
  if (Math.abs(norm1.length - norm2.length) < lengthThreshold) {
    return false;
  }
  
  // 检查一个是否是另一个的前缀
  return norm1.startsWith(norm2) || norm2.startsWith(norm1);
}