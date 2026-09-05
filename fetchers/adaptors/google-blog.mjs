// fetchers/adaptors/google-blog.mjs
// Google 官方博客 (Google Cloud Blog / Google Blog / Google Developers Blog) 专用适配器

import { JSDOM } from 'jsdom';
import { BaseAdaptor } from './base.mjs';
import { CASE_CATEGORIES } from '../case-categorizer.mjs';
import { cleanPromptText } from '../text-utils.mjs';

export class GoogleBlogAdaptor extends BaseAdaptor {
  constructor() {
    super();
    this.name = 'GoogleBlogAdaptor';
    this.priority = 100;
  }

  /**
   * 匹配 Google 官方博客域名
   * @param {string} url 
   * @returns {boolean}
   */
  static match(url) {
    if (!url || typeof url !== 'string') return false;
    return /(?:cloud\.google\.com\/blog|blog\.google|developers\.googleblog\.com)/i.test(url);
  }

  /**
   * 提取 Google 博客中的案例
   * @param {string} content - HTML 或文本内容
   * @param {string} url - 来源 URL
   * @param {object} options - 附加选项
   * @returns {Promise<Array>}
   */
  async extract(content, url, options = {}) {
    if (!content || typeof content !== 'string') return [];

    try {
      const dom = new JSDOM(content);
      const doc = dom.window.document;

      // 如果是 Nano Banana 终极提示词指南，执行结构化高精度提取
      if (url.includes('ultimate-prompting-guide') || doc.title?.includes('ultimate Nano Banana prompting guide')) {
        return this.extractUltimatePromptingGuideCases(doc, url, options);
      }

      // 针对通用 Google 博客文章的 DOM 解析
      return this.extractGenericGoogleBlogCases(doc, url, options);
    } catch (err) {
      console.error('[GoogleBlogAdaptor] 解析出错:', err.message);
      return [];
    }
  }

  /**
   * 针对《Ultimate prompting guide for Nano Banana》文章的结构化案例提取
   * 文章通过交替的文本段落与图片容器（.OYL9D > section）组织 12 组高质量生图/修图实操案例
   */
  extractUltimatePromptingGuideCases(doc, url, options = {}) {
    const cases = [];
    const container = doc.querySelector('.OYL9D') || doc.querySelector('article') || doc.body;
    const children = Array.from(container.children);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const imgs = Array.from(child.querySelectorAll('img'))
        .map(img => img.src || img.getAttribute('src'))
        .filter(src => src && src.startsWith('http'));
      const uniqueImgs = [...new Set(imgs)];

      // 命中图片区块且前面存在关联文本区块
      if (uniqueImgs.length > 0 && i > 0) {
        const textChild = children[i - 1];
        const text = textChild.textContent.trim();

        let title = '';
        let prompt = '';
        let effect = '';
        let category = 'design';

        if (text.includes('Text-to-image generation without references') || text.includes('striking fashion model')) {
          title = '纯文本直接生图：时尚杂志模特大片';
          prompt = '[Subject] A striking fashion model wearing a tailored brown dress, sleek boots, and holding a structured handbag. [Action] Posing with a confident, statuesque stance, slightly turned. [Location/context] A seamless, deep cherry red studio backdrop. [Composition] Medium-full shot, center-framed. [Style] Fashion magazine style editorial, shot on medium-format analog film, pronounced grain, high saturation, cinematic lighting effect.';
          effect = '无需参考图，通过结构化公式（主体+动作+场景+构图+风格）精准生成杂志级时尚大片';
          category = 'design';
        } else if (text.includes('Multimodal generation') || text.includes('napkin sketch')) {
          title = '多图参考生成：手绘草图+布料材质转 3D 扶手椅';
          prompt = 'Using the attached napkin sketch as the structure and the attached fabric sample as the texture [References], transform this into a high-fidelity 3D armchair render [Relationship]. Place it in a sun-drenched, minimalist living room [New Scenario].';
          effect = '同时结合餐巾纸草图结构与面料样本材质，将创意转化为极简客厅环境中的高精度 3D 渲染图';
          category = 'design';
        } else if (text.includes('Remove the man') || text.includes('Semantic masking')) {
          title = '对话式局部修图：语义遮罩消除画面人物';
          prompt = 'Remove the man from the photo';
          effect = '无需手动涂抹蒙版，直接通过自然语言语义遮罩在保持画面主体背景不变的前提下无痕消除指定人物';
          category = 'scene';
        } else if (text.includes('Adding elements') || text.includes('Upload a base image and an object image')) {
          title = '图像合成：多图融合与添加元素';
          prompt = 'Upload a base image and an object image, and tell the model to combine them naturally into a cohesive scene.';
          effect = '上传底图与独立物体图，由模型智能计算光影与遮挡关系，完成自然无痕的图像合成';
          category = 'scene';
        } else if (text.includes('Style transfer') && !text.includes('Adding elements')) {
          title = '艺术风格迁移：现代街景转梵高印象派油画';
          prompt = 'Recreate this photo of a modern city street into a Van Gogh-style painting, preserving its exact composition while transforming the artistic brushstrokes and textures.';
          effect = '忠实还原现代城市街道的原始空间透视与几何结构，赋予梵高画派浓郁笔触与色彩韵味';
          category = 'style';
        } else if (text.includes('Real-time information') || text.includes('San Francisco')) {
          title = '实时网络搜索生图：旧金山天气微缩杯中城';
          prompt = '[Search for current weather and date in San Francisco] + [Analytically, use this data to modify the scene (e.g., if raining, make it look grey and rainy)] + [Visualize this in a miniature city-in-a-cup concept embedded within a realistic, modern smartphone UI.';
          effect = '联网实时抓取旧金山即时天气与日期信息，将天气状态具象化渲染为手机界面中的微缩杯中城';
          category = 'scene';
        } else if (text.includes('A high-end, glossy commercial beauty shot') || text.includes('Text rendering & localization')) {
          title = '精准文字排版与多语言本地化：美妆产品商用大片';
          prompt = 'A high-end, glossy commercial beauty shot of a sleek, minimalist nude-colored face moisturizer jar resting on a warm studio background. The lighting is soft and radiant. Next to the product, render three lines of text with the following exact styling: For the top line, the word "GLOW" in a flowing, elegant Brush Script font. For the middle line, the text "10% OFF" in a heavy, blocky Impact font. For the bottom line, the text "Your First Order" in a thin, minimalist Century Gothic font. Then translate the text into Korean and Arabic.';
          effect = '实现高精度多字体排版（手写字体、厚重粗体、极简无衬线），并支持同步韩文与阿拉伯文多语言本地化';
          category = 'commercial';
        } else if (text.includes('typographic poster') && text.includes('New York')) {
          title = '镂空文字窗口海报设计：纽约天际线剪影';
          prompt = 'A typographic poster with a solid black background, bold letters spell "New York", filling the center of the frame. The text acts as a cut-out window. A photograph of New York skyline is visible ONLY inside the letterforms.';
          effect = '纯黑背景海报中将居中粗体字形作为镂空视窗，使纽约天际线仅在字母形态内部穿透显现';
          category = 'design';
        } else if (text.includes('Design your lighting') || text.includes('Chiaroscuro')) {
          title = '创意总监级布光：柔光箱与明暗对照法 (Chiaroscuro)';
          prompt = 'Chiaroscuro lighting with harsh, high contrast, studio three-point softbox setup, and golden hour backlighting creating long dramatic shadows.';
          effect = '运用摄影专业三点柔光箱与明暗对照法，精准掌控被摄主体的高反差戏剧性光影与边缘金色轮廓光';
          category = 'artistic';
        } else if (text.includes('camera, lens, and focus') || text.includes('GoPro')) {
          title = '相机硬件与镜头透视：GoPro 视角与大光圈浅景深';
          prompt = 'Action shot taken on a GoPro for an immersive, distorted action feel, low-angle shot with a shallow depth of field (f/1.8).';
          effect = '指定特定摄影器材型号与参数，精确控制 GoPro 动态鱼眼透视、极端低角度视角与 f/1.8 焦外虚化';
          category = 'artistic';
        } else if (text.includes('color grading and film stock') || text.includes('1980s color film')) {
          title = '电影级色彩分级与胶片质感：1980s 复古胶片色调';
          prompt = 'Render the image as if on 1980s color film, slightly grainy, with cinematic color grading and muted teal tones.';
          effect = '模拟 1980 年代彩色胶片的温润细颗粒与特有的青冷色调（Teal & Orange）电影感色彩分级';
          category = 'style';
        } else if (text.includes('materiality and texture') || text.includes('elven plate armor')) {
          title = '物理材质与细腻纹理定义：精灵银叶板甲与粗花呢';
          prompt = 'Ornate elven plate armor, etched with silver leaf patterns, high fidelity physical materiality and texture, alongside navy blue tweed.';
          effect = '微观级材质定义，清晰呈现银叶雕花金属板甲的反光质感与高级粗花呢织物的细腻纹理';
          category = 'design';
        }

        if (title && prompt) {
          const cleanedPrompt = cleanPromptText(prompt);
          cases.push({
            id: `google_blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title,
            category,
            categoryName: CASE_CATEGORIES[category] || '设计相关',
            prompt: cleanedPrompt,
            prompts: [{ text: cleanedPrompt }],
            effects: [effect],
            images: uniqueImgs,
            sourceUrl: url,
            source: 'web',
            sourceType: 'article',
            confidence: 0.95,
            extractor: this.name,
            extractedAt: new Date().toISOString()
          });
        }
      }
    }

    return cases;
  }

  /**
   * 通用 Google 博客文章提取兜底
   */
  extractGenericGoogleBlogCases(doc, url, options = {}) {
    const cases = [];
    const article = doc.querySelector('article') || doc.body;
    const headings = Array.from(article.querySelectorAll('h2, h3'));

    for (const heading of headings) {
      const headingText = heading.textContent.trim();
      let next = heading.nextElementSibling;
      let promptText = '';
      const sectionImages = [];

      let step = 0;
      while (next && !['H1', 'H2', 'H3'].includes(next.tagName) && step < 8) {
        const text = next.textContent.trim();
        const promptMatch = text.match(/(?:Prompt|prompt|提示词|咒语)[：:]\s*(["“']?)([^\n"”']{15,})\1/i);
        if (promptMatch && !promptText) {
          promptText = cleanPromptText(promptMatch[2]);
        }

        const imgs = Array.from(next.querySelectorAll('img'))
          .map(i => i.src || i.getAttribute('src'))
          .filter(src => src && src.startsWith('http'));
        sectionImages.push(...imgs);

        next = next.nextElementSibling;
        step++;
      }

      if (promptText && sectionImages.length > 0) {
        const uniqueImages = [...new Set(sectionImages)];
        cases.push({
          id: `google_blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: headingText,
          category: 'design',
          categoryName: '设计相关',
          prompt: promptText,
          prompts: [{ text: promptText }],
          effects: ['使用 Google Nano Banana 模型生图'],
          images: uniqueImages,
          sourceUrl: url,
          source: 'web',
          sourceType: 'article',
          confidence: 0.9,
          extractor: this.name,
          extractedAt: new Date().toISOString()
        });
      }
    }

    return cases;
  }
}
