// 调试ZHO仓库图片提取问题
import fs from 'fs';

// 复制图片提取函数
const IMAGE_PATTERNS = [
  /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
  /!\[[^\]]*\]\(([^)]+)\)/gi,
  /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi
];

function extractImages(text, title = '', description = '') {
  const images = [];
  
  // 基础图片提取
  for (const pattern of IMAGE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const imageUrl = match[1].trim();
      if (imageUrl.startsWith('http')) {
        images.push(imageUrl);
      } else if (imageUrl.startsWith('images/')) {
        // 处理相对路径的图片，转换为GitHub完整URL
        const githubUrl = `https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/main/${imageUrl}`;
        images.push(githubUrl);
      }
    }
  }
  
  return [...new Set(images)];
}

// 测试ZHO仓库内容
const data = JSON.parse(fs.readFileSync('public/data.json', 'utf8'));
const zhoItem = data.items.find(item => item.title && item.title.includes('ZHO-nano-banana-Creation - README'));

if (zhoItem) {
  const fullText = zhoItem.description;
  console.log('ZHO仓库内容长度:', fullText.length);
  
  // 测试整个文档的图片提取
  const allImages = extractImages(fullText);
  console.log('整个文档提取到图片数量:', allImages.length);
  if (allImages.length > 0) {
    console.log('前5个图片URL:');
    allImages.slice(0, 5).forEach((url, i) => console.log((i+1) + '. ' + url));
  }
  
  // 按章节分割测试
  const sections = fullText.split(/(?=\d+️⃣)/);
  console.log('\\n总章节数:', sections.length);
  
  // 测试前5个章节的图片提取
  for (let i = 1; i < Math.min(6, sections.length); i++) {
    const section = sections[i];
    const images = extractImages(section);
    console.log(`章节 ${i}: 提取到 ${images.length} 个图片`);
    if (images.length > 0) {
      console.log(`  第一个图片: ${images[0]}`);
    }
  }
}

