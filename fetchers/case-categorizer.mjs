// 共享的案例分类工具函数

// 案例分类定义
export const CASE_CATEGORIES = {
  'figurine': '3D手办制作',
  'clothing': '服装替换',
  'scene': '场景合成',
  'style': '风格转换',
  'character': '角色编辑',
  'background': '背景替换',
  'composition': '图像合成',
  'enhancement': '图像增强',
  'design': '设计相关',
  'education': '教育相关',
  'business': '商业相关',
  'technical': '技术相关',
  'artistic': '艺术相关',
  'other': '其他'
};

/**
 * 统一的案例分类函数
 * @param {string} title - 案例标题
 * @param {string} description - 案例描述
 * @param {Array} prompts - 提示词数组
 * @returns {string} 分类键
 */
export function categorizeCase(title, description, prompts) {
  const text = (title + ' ' + description + ' ' + prompts.join(' ')).toLowerCase();

  if (text.includes('figurine') || text.includes('手办') || text.includes('3d')) {
    return 'figurine';
  }
  if (text.includes('clothing') || text.includes('outfit') || text.includes('衣服') || text.includes('服装')) {
    return 'clothing';
  }
  if (text.includes('scene') || text.includes('场景') || text.includes('background') || text.includes('背景')) {
    return 'scene';
  }
  if (text.includes('style') || text.includes('风格') || text.includes('artistic')) {
    return 'style';
  }
  if (text.includes('character') || text.includes('角色') || text.includes('person')) {
    return 'character';
  }
  if (text.includes('composition') || text.includes('合成') || text.includes('combine')) {
    return 'composition';
  }
  if (text.includes('enhance') || text.includes('enhancement') || text.includes('增强')) {
    return 'enhancement';
  }

  // 新增细化分类
  if (text.includes('design') || text.includes('设计') || text.includes('包装') || text.includes('工业设计') ||
      text.includes('产品设计') || text.includes('包装设计') || text.includes('卡片设计') || text.includes('包装生成')) {
    return 'design';
  }
  if (text.includes('教育') || text.includes('教学') || text.includes('分析') || text.includes('批注') ||
      text.includes('标注') || text.includes('卡路里') || text.includes('批改')) {
    return 'education';
  }
  if (text.includes('广告') || text.includes('营销') || text.includes('信息图') || text.includes('商业') ||
      text.includes('广告短片') || text.includes('商品') || text.includes('business')) {
    return 'business';
  }
  if (text.includes('技术') || text.includes('参数') || text.includes('设置') || text.includes('拆解') ||
      text.includes('硬件') || text.includes('相机') || text.includes('technical') || text.includes('iso')) {
    return 'technical';
  }
  if (text.includes('艺术') || text.includes('绘画') || text.includes('插画') || text.includes('漫画') ||
      text.includes('artistic') || text.includes('painting') || text.includes('illustration') || text.includes('drawing')) {
    return 'artistic';
  }

  return 'other';
}

/**
 * 获取分类的中文名称
 * @param {string} category - 分类键
 * @returns {string} 中文分类名称
 */
export function getCategoryName(category) {
  return CASE_CATEGORIES[category] || '其他';
}
