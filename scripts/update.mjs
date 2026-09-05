// scripts/update.mjs
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromImportantArticles } from '../fetchers/article-extractor.mjs';
import { CASE_CATEGORIES, extractCaseFromContent, processItemsForCases } from '../fetchers/case-extractor.mjs';
import { fetchFromGitHub } from '../fetchers/github.mjs';
import { extractIntelligently, getExtractionStats } from '../fetchers/hybrid-extractor.mjs';
import { SimpleCacheManager } from '../fetchers/simple-cache-manager.mjs';
import { fetchFromWeb } from '../fetchers/web.mjs';
import { SmartDiscoveryExtractor } from '../fetchers/smart-discovery.mjs';
import { getAdaptor } from '../fetchers/adaptors/registry.mjs';
import { GenericAdaptor } from '../fetchers/adaptors/generic.mjs';
import { cleanPromptText } from '../fetchers/text-utils.mjs';

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
 * 批量高效处理页面项目（结合缓存机制、本地快速正则提取、严格启发式初筛与多页面 LLM 批量打包）
 * @param {Array} items - 页面项目数组
 * @param {string} source - 数据源 ('github' 或 'web')
 * @param {Array} processedCases - 已处理的案例数组
 * @param {Array} skippedPages - 跳过的页面数组
 * @param {Object} cacheManager - 缓存管理器
 */
async function processItemsBatch(items, source, processedCases, skippedPages, cacheManager) {
  const smartDiscovery = new SmartDiscoveryExtractor();
  const llmQueue = [];

  for (const item of items) {
    if (!item.description && !item.title) continue;

    const pageId = item.url || item.id;
    const shouldProcess = cacheManager.shouldProcess(
      pageId, 
      item.description, 
      item.caseCount || 0
    );

    if (!shouldProcess.shouldProcess) {
      console.log(`⏭️ 跳过页面: ${item.title} (${shouldProcess.reason})`);
      skippedPages.push(item.title);
      continue;
    }

    console.log(`🔄 检查页面: ${item.title} (${shouldProcess.reason})`);

    // 1. 本地快速提取：如果本地规则已明确识别出 prompt 与效果，直接采纳，耗时 < 1ms，无需调用任何大模型
    try {
      const tradResult = extractCaseFromContent(item);
      const hasPrompts = Array.isArray(tradResult?.prompts) && tradResult.prompts.length > 0;
      if (hasPrompts) {
        console.log(`⚡ [Traditional] 本地规则直接命中: ${item.title} (${tradResult.prompts.length} 个 Prompt)`);
        const caseWithCategory = createCaseWithCategory({
          result: tradResult,
          extractor: 'traditional',
          confidence: 0.8
        }, source);
        processedCases.push(caseWithCategory);
        cacheManager.updateCache(pageId, item.description, 1);
        continue;
      }
    } catch (e) {
      // 忽略本地提取异常，继续后续流程
    }

    // 2. 检查站点专用 Adaptor（如 civitai / huggingface 等）
    const adaptor = getAdaptor(item.url || '');
    if (!(adaptor instanceof GenericAdaptor)) {
      console.log(`🔌 [Adaptor] 使用专用站点适配器: ${item.title}`);
      try {
        const fullContent = await smartDiscovery.ensureFullContent(item.url, item.description);
        const adaptorCases = await adaptor.extract(fullContent, item.url, item);
        if (adaptorCases && adaptorCases.length > 0) {
          for (const c of adaptorCases) {
            processedCases.push(createCaseFromNormalizedCase(c, { extractor: adaptor.constructor.name, confidence: 0.85 }, source, item));
          }
          cacheManager.updateCache(pageId, item.description, adaptorCases.length);
          continue;
        }
      } catch (err) {
        console.warn(`专用适配器提取失败: ${err.message}`);
      }
    }

    // 3. 准备清洗降噪文本，进行严格双维度初筛
    const fullContent = await smartDiscovery.ensureFullContent(item.url, item.description);
    const cleanText = smartDiscovery.cleanHtmlToText(fullContent);

    // 4. 严格启发式初筛：是否具备生图特征及 Prompt 案例价值
    const isCandidate = smartDiscovery.isCandidateForLLM(cleanText);

    if (isCandidate && smartDiscovery.llmScanner.isAvailable) {
      // 进入 LLM 批量打包队列
      llmQueue.push({
        id: pageId,
        url: item.url || item.id,
        title: item.title,
        content: cleanText,
        item,
        source
      });
    } else {
      if (!isCandidate) {
        console.log(`⏭️ [Heuristic Filter] 初筛排除（非生图/Prompt页面，节省大模型额度）: ${item.title}`);
      }
      // 通用增强算法快速兜底
      try {
        const genericCases = await adaptor.extract(cleanText, item.url, item);
        const validCases = Array.isArray(genericCases) ? genericCases : [];
        for (const c of validCases) {
          processedCases.push(createCaseFromNormalizedCase(c, { extractor: 'generic', confidence: 0.5 }, source, item));
        }
        cacheManager.updateCache(pageId, item.description, validCases.length);
      } catch {
        cacheManager.updateCache(pageId, item.description, 0);
      }
    }
  }

  // 第二阶段：LLM 批量打包扫描 (3~4 个网页合并打包为 1 次请求)
  if (llmQueue.length > 0) {
    const BATCH_SIZE = 3;
    console.log(`\n🚀 [LLM Batch Queue] 共有 ${llmQueue.length} 个候选网页进入批量打包队列（每批 ${BATCH_SIZE} 个）...`);

    for (let i = 0; i < llmQueue.length; i += BATCH_SIZE) {
      const batch = llmQueue.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(llmQueue.length / BATCH_SIZE);

      console.log(`📦 正在处理批次 ${batchNum}/${totalBatches} (${batch.map(b => b.title).join(' | ')})`);

      try {
        const batchResults = await smartDiscovery.llmScanner.scanBatch(batch.map(b => ({
          id: b.id,
          url: b.url,
          title: b.title,
          content: b.content
        })));

        for (const queued of batch) {
          const cases = batchResults[queued.id] || [];
          if (cases.length > 0) {
            console.log(`✅ [LLM Batch] ${queued.title} 成功提取 ${cases.length} 个案例`);
            for (const c of cases) {
              processedCases.push(createCaseFromNormalizedCase(c, { extractor: 'llm-batch', confidence: 0.9 }, queued.source, queued.item));
            }
            cacheManager.updateCache(queued.id, queued.item.description, cases.length);
          } else {
            console.log(`ℹ️ [LLM Batch] ${queued.title} 未提取到有效案例，执行通用兜底`);
            const adaptor = getAdaptor(queued.url);
            const fallbackCases = await adaptor.extract(queued.content, queued.url, queued.item);
            const count = Array.isArray(fallbackCases) ? fallbackCases.length : 0;
            if (count > 0) {
              for (const c of fallbackCases) {
                processedCases.push(createCaseFromNormalizedCase(c, { extractor: 'generic-fallback', confidence: 0.5 }, queued.source, queued.item));
              }
            }
            cacheManager.updateCache(queued.id, queued.item.description, count);
          }
        }
      } catch (err) {
        console.error(`❌ 批次 ${batchNum} 处理失败: ${err.message}，降级回退处理`);
        for (const queued of batch) {
          const adaptor = getAdaptor(queued.url);
          const fallbackCases = await adaptor.extract(queued.content, queued.url, queued.item).catch(() => []);
          cacheManager.updateCache(queued.id, queued.item.description, fallbackCases?.length || 0);
        }
      }
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
  
  // 精简案例数据：剥离前端不使用的 originalItem（占 76% 体积）、id、source、extractedAt，并规范清理 prompt
  const slimCases = deduplicatedCases.map(({ originalItem, id, extractedAt, ...rest }) => {
    if (Array.isArray(rest.prompts)) {
      rest.prompts = rest.prompts.map(p => {
        const raw = typeof p === 'string' ? p : p.text || '';
        const text = cleanPromptText(raw);
        return typeof p === 'string' ? { text } : { ...p, text };
      }).filter(p => p.text);
    }
    return rest;
  });
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
