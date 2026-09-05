// scripts/update.mjs
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromImportantArticles } from '../fetchers/article-extractor.mjs';
import { CASE_CATEGORIES, processItemsForCases } from '../fetchers/case-extractor.mjs';
import { fetchFromGitHub } from '../fetchers/github.mjs';
import { extractIntelligently, getExtractionStats } from '../fetchers/hybrid-extractor.mjs';
import { SimpleCacheManager } from '../fetchers/simple-cache-manager.mjs';
import { fetchFromWeb } from '../fetchers/web.mjs';

// 常量定义
const DEFAULT_CATEGORY = 'other';
const DEFAULT_CATEGORY_NAME = '其他';
const DEFAULT_TITLE = '未命名案例';
const TITLE_MAX_LENGTH = 50;

// 前端展示的类型白名单（pull/issue 前端不展示，不需要输出）
const FRONTEND_TYPES = new Set(['repo', 'readme', 'article']);
// 前端描述最大长度（readme 类型的 description 可能是完整全文，需要截断）
const FRONTEND_DESC_MAX_LENGTH = 300;

/**
 * 创建带有分类信息的案例对象
 * @param {Object} result - 提取结果
 * @param {string} source - 数据源 ('github' 或 'web')
 * @returns {Object} 带有分类信息的案例对象
 */
function createCaseWithCategory(result, source) {
  const category = result.result.category || result.result.categories?.[0] || DEFAULT_CATEGORY;
  const title = result.result.title || 
    result.result.prompts?.[0]?.text?.substring(0, TITLE_MAX_LENGTH) + '...' || 
    DEFAULT_TITLE;
  
  return {
    ...result.result,
    category: category,
    categoryName: CASE_CATEGORIES[category] || DEFAULT_CATEGORY_NAME,
    title: title,
    source: source,
    extractor: result.extractor,
    confidence: result.confidence
  };
}

function createCaseFromNormalizedCase(caseItem, result, source, item) {
  const category = caseItem.category || result.result?.category || result.result?.categories?.[0] || DEFAULT_CATEGORY;
  const title = caseItem.title || caseItem.prompts?.[0]?.text?.substring(0, TITLE_MAX_LENGTH) + '...' || DEFAULT_TITLE;
  const sourceUrl = caseItem.sourceUrl || item?.url || item?.id || caseItem.url || '';

  return {
    ...caseItem,
    category,
    categoryName: CASE_CATEGORIES[category] || DEFAULT_CATEGORY_NAME,
    title,
    source: source,
    sourceUrl,
    extractor: result.extractor,
    confidence: caseItem.confidence ?? result.confidence
  };
}

/**
 * 处理单个页面的智能提取
 * @param {Object} item - 页面项目
 * @param {string} source - 数据源 ('github' 或 'web')
 * @param {Array} processedCases - 已处理的案例数组
 * @param {Array} skippedPages - 跳过的页面数组
 * @param {Object} cacheManager - 缓存管理器
 */
async function processPageIntelligently(item, source, processedCases, skippedPages, cacheManager) {
  const shouldProcess = cacheManager.shouldProcess(
    item.url || item.id, 
    item.description, 
    item.caseCount || 0
  );
  
  if (shouldProcess.shouldProcess) {
    console.log(`🔄 处理页面: ${item.title} (${shouldProcess.reason})`);
    try {
      const result = await extractIntelligently(item.description, item);
      if (result.result && result.confidence > 0.6) {
        if (Array.isArray(result.result.cases) && result.result.cases.length > 0) {
          for (const caseItem of result.result.cases) {
            processedCases.push(createCaseFromNormalizedCase(caseItem, result, source, item));
          }
        } else {
          const caseWithCategory = createCaseWithCategory(result, source);
          processedCases.push(caseWithCategory);
        }
      }
      // 更新缓存
      cacheManager.updateCache(item.url || item.id, item.description, result.result?.cases?.length || 0);
    } catch (error) {
      console.error(`智能提取失败: ${item.title}`, error);
    }
  } else {
    console.log(`⏭️ 跳过页面: ${item.title} (${shouldProcess.reason})`);
    skippedPages.push(item.title);
  }
}

/**
 * 批量处理页面项目
 * @param {Array} items - 页面项目数组
 * @param {string} source - 数据源 ('github' 或 'web')
 * @param {Array} processedCases - 已处理的案例数组
 * @param {Array} skippedPages - 跳过的页面数组
 * @param {Object} cacheManager - 缓存管理器
 */
async function processItemsBatch(items, source, processedCases, skippedPages, cacheManager) {
  for (const item of items) {
    if (item.description) {
      await processPageIntelligently(item, source, processedCases, skippedPages, cacheManager);
    }
  }
}

/**
 * 智能去重函数
 * @param {Array} cases - 案例数组
 * @returns {Array} 去重后的案例数组
 */
function deduplicateCases(cases) {
  const seen = new Set();
  const deduplicated = [];
  
  for (const caseItem of cases) {
    // 创建唯一标识符：加入来源信息，减少误合并
    const firstPrompt = caseItem.prompts && caseItem.prompts.length > 0 
      ? (typeof caseItem.prompts[0] === 'string' ? caseItem.prompts[0] : caseItem.prompts[0].text || '')
      : '';

    const sourceKey = caseItem.sourceUrl 
      || (caseItem.originalItem && (caseItem.originalItem.url || caseItem.originalItem.sourceUrl))
      || caseItem.url 
      || caseItem.id 
      || '';
    
    // 清理标题，移除特殊字符、数字前缀和emoji
    const cleanTitle = (caseItem.title || '')
      .replace(/^[\d\s\-\u{1F300}-\u{1F9FF}]+/u, '')
      .replace(/\(Duplicate\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 清理prompt，移除特殊字符
    const cleanPrompt = (firstPrompt || '')
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    // 当prompt为空时加入效果片段作为辅助标识
    const effectSnippet = Array.isArray(caseItem.effects)
      ? caseItem.effects.join(' ')
          .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 100)
      : '';

    const category = caseItem.category || '';
    
    // 组合更稳健的标识符（同源 + 标题 + prompt/效果 + 类别）
    const identifier = `${sourceKey}|${cleanTitle}|${cleanPrompt || effectSnippet}|${category}`;
    
    if (!seen.has(identifier)) {
      seen.add(identifier);
      deduplicated.push(caseItem);
    } else {
      console.log(`🔄 跳过重复案例: ${caseItem.title}`);
    }
  }
  
  return deduplicated;
}

// 加载.env文件
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public');
const outFile = path.join(outDir, 'data.json');
const casesFile = path.join(outDir, 'cases.json');

function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const key = it.url || it.id;
    if (!seen.has(key)) seen.set(key, it);
  }
  return Array.from(seen.values());
}

function score(it) {
  // 简单排序：星标与时间
  const stars = it.stars || 0;
  const updated = it.updatedAt ? new Date(it.updatedAt).getTime() : 0;
  const recency = updated ? (Date.now() - updated) : Infinity;
  const recencyScore = updated ? Math.max(0, 1_000_000_000 - recency / 10_000) : 0;
  return stars * 1000 + recencyScore;
}

function sortItems(items) {
  return items.sort((a, b) => score(b) - score(a));
}

function mergeOld(oldItems, newItems) {
  const byUrl = new Map();
  for (const it of oldItems) byUrl.set(it.url || it.id, it);
  for (const it of newItems) byUrl.set(it.url || it.id, it);
  return Array.from(byUrl.values());
}

async function main() {
  console.log('🚀 开始智能更新流程...');
  
  // 初始化缓存管理器
  const cacheManager = new SimpleCacheManager();
  
  const [gh, web] = await Promise.all([
    fetchFromGitHub().catch(e => {
      console.error('GitHub fetch failed:', e.message);
      return [];
    }),
    fetchFromWeb().catch(() => [])
  ]);

  let items = dedupe([...gh, ...web]);

  // 读取旧数据，以保留可能的手动补充或暂时下线源
  let old = [];
  if (fs.existsSync(outFile)) {
    try {
      const json = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
      old = json.items || [];
    } catch {}
  }

  items = mergeOld(old, items);
  items = sortItems(items);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 保存完整数据至 .cache/（用于本地调试备份，不污染 public/ 目录与 git）
  const cacheDir = path.join(root, '.cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const fullPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: items.length,
    items
  };
  fs.writeFileSync(path.join(cacheDir, 'data-full.json'), JSON.stringify(fullPayload), 'utf-8');

  // 保存精简数据（供前端使用：过滤 pull/issue，剥离未使用字段，截断长描述）
  const frontendItems = items
    .filter(it => FRONTEND_TYPES.has(it.type))
    .map(({ id, createdAt, tags, fullContent, ...rest }) => {
      if (rest.description && rest.description.length > FRONTEND_DESC_MAX_LENGTH) {
        rest.description = rest.description.substring(0, FRONTEND_DESC_MAX_LENGTH);
      }
      return rest;
    });
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: frontendItems.length,
    items: frontendItems
  };
  fs.writeFileSync(outFile, JSON.stringify(payload), 'utf-8');
  console.log(`Wrote ${frontendItems.length} items to ${path.relative(root, outFile)} (slim, for frontend, filtered from ${items.length})`);

  // 智能处理每个页面
  console.log('🧠 开始智能处理页面...');
  const processedCases = [];
  const skippedPages = [];
  
  // 处理GitHub数据
  console.log('📥 处理GitHub数据...');
  await processItemsBatch(gh, 'github', processedCases, skippedPages, cacheManager);
  
  // 处理Web数据
  console.log('📥 处理Web数据...');
  await processItemsBatch(web, 'web', processedCases, skippedPages, cacheManager);
  
  // 从重要文章中提取详细案例
  console.log('📚 从重要文章中提取详细案例...');
  const importantCases = await extractCasesFromImportantArticles(items);
  
  // 传统提取器处理
  console.log('🔍 使用传统提取器提取使用案例...');
  const cases = await processItemsForCases(items);
  
  // 合并所有案例
  const allCases = [...cases, ...importantCases, ...processedCases];
  
  // 智能去重
  console.log('🔄 开始智能去重...');
  const deduplicatedCases = deduplicateCases(allCases);
  console.log(`📊 去重前: ${allCases.length} 个案例，去重后: ${deduplicatedCases.length} 个案例，去除了 ${allCases.length - deduplicatedCases.length} 个重复案例`);
  
  // 精简案例数据：剥离前端不使用的 originalItem（占 76% 体积）、id、source、extractedAt
  const slimCases = deduplicatedCases.map(({ originalItem, id, extractedAt, ...rest }) => rest);
  const casesPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: slimCases.length,
    categories: Object.keys(slimCases.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {})),
    cases: slimCases
  };
  
  fs.writeFileSync(casesFile, JSON.stringify(casesPayload), 'utf-8');
  console.log(`📝 Wrote ${slimCases.length} cases to ${path.relative(root, casesFile)} (${cases.length} from general sources + ${importantCases.length} from important articles + ${processedCases.length} from intelligent extraction)`);
  
  // 保存缓存
  cacheManager.saveCache();
  
  // 显示缓存统计信息
  const cacheStats = cacheManager.getStats();
  console.log('\n📊 缓存统计信息:');
  console.log(`   总页面数: ${cacheStats.totalPages}`);
  console.log(`   已处理页面: ${cacheStats.processedPages}`);
  console.log(`   跳过页面: ${cacheStats.skippedPages}`);
  console.log(`   节省API调用: ${cacheStats.savedAPI}`);
  console.log(`   缓存大小: ${cacheStats.cacheFileSize} 字节`);
  console.log(`   跳过页面列表: ${skippedPages.join(', ')}`);
  
  // 显示提取统计信息
  const stats = getExtractionStats();
  console.log('\n📊 提取统计信息:');
  console.log(`   总处理数: ${stats.total}`);
  console.log(`   成功率: ${((stats.success / stats.total) * 100).toFixed(1)}%`);
  console.log(`   平均耗时: ${stats.averageTime.toFixed(0)}ms`);
  console.log('   各提取器统计:');
  for (const [extractor, extractorStats] of Object.entries(stats.extractors)) {
    console.log(`     ${extractor}: ${extractorStats.success}/${extractorStats.total} (${(extractorStats.successRate * 100).toFixed(1)}%) - ${extractorStats.averageTime.toFixed(0)}ms`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
