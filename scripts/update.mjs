// scripts/update.mjs
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromImportantArticles } from '../fetchers/article-extractor.mjs';
import { processItemsForCases } from '../fetchers/case-extractor.mjs';
import { fetchFromGitHub } from '../fetchers/github.mjs';
import { extractIntelligently, getExtractionStats } from '../fetchers/hybrid-extractor.mjs';
import { SimpleCacheManager } from '../fetchers/simple-cache-manager.mjs';
import { fetchFromWeb } from '../fetchers/web.mjs';

/**
 * 智能去重函数
 * @param {Array} cases - 案例数组
 * @returns {Array} 去重后的案例数组
 */
function deduplicateCases(cases) {
  const seen = new Set();
  const deduplicated = [];
  
  for (const caseItem of cases) {
    // 创建唯一标识符：基于标题和第一个prompt
    const firstPrompt = caseItem.prompts && caseItem.prompts.length > 0 
      ? (typeof caseItem.prompts[0] === 'string' ? caseItem.prompts[0] : caseItem.prompts[0].text || '')
      : '';
    
    // 清理标题，移除特殊字符、数字前缀和emoji
    const cleanTitle = (caseItem.title || '')
      .replace(/^[\d\s\-\u{1F300}-\u{1F9FF}]+/u, '') // 移除开头的数字、空格、连字符和emoji
      .replace(/\(Duplicate\)/g, '') // 移除(Duplicate)标记
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();
    
    // 清理prompt，移除特殊字符
    const cleanPrompt = firstPrompt
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 只保留字母、数字、空格和中文字符
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim()
      .substring(0, 100);
    
    // 使用清理后的标题和prompt作为标识符
    const identifier = `${cleanTitle}|${cleanPrompt}`;
    
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

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: items.length,
    items
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Wrote ${items.length} items to ${path.relative(root, outFile)}`);

  // 智能处理每个页面
  console.log('🧠 开始智能处理页面...');
  const processedCases = [];
  const skippedPages = [];
  
  // 处理GitHub数据
  console.log('📥 处理GitHub数据...');
  for (const item of gh) {
    if (item.description) {
      const shouldProcess = cacheManager.shouldProcess(
        item.url || item.id, 
        item.description, 
        item.caseCount || 0
      );
      
      if (shouldProcess.shouldProcess) {
        console.log(`🔄 处理页面: ${item.title} (${shouldProcess.reason})`);
        try {
          const result = await extractIntelligently(item.description, item.url || item.id, item);
          if (result.result && result.confidence > 0.6) {
            // 确保有category和title字段
            const caseWithCategory = {
              ...result.result,
              category: result.result.category || result.result.categories?.[0] || 'other',
              title: result.result.title || result.result.prompts?.[0]?.text?.substring(0, 50) + '...' || '未命名案例',
              source: 'github',
              extractor: result.extractor,
              confidence: result.confidence
            };
            processedCases.push(caseWithCategory);
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
  }
  
  // 处理Web数据
  console.log('📥 处理Web数据...');
  for (const item of web) {
    if (item.description) {
      const shouldProcess = cacheManager.shouldProcess(
        item.url || item.id, 
        item.description, 
        item.caseCount || 0
      );
      
      if (shouldProcess.shouldProcess) {
        console.log(`🔄 处理页面: ${item.title} (${shouldProcess.reason})`);
        try {
          const result = await extractIntelligently(item.description, item.url || item.id, item);
          if (result.result && result.confidence > 0.6) {
            // 确保有category和title字段
            const caseWithCategory = {
              ...result.result,
              category: result.result.category || result.result.categories?.[0] || 'other',
              title: result.result.title || result.result.prompts?.[0]?.text?.substring(0, 50) + '...' || '未命名案例',
              source: 'web',
              extractor: result.extractor,
              confidence: result.confidence
            };
            processedCases.push(caseWithCategory);
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
  }
  
  // 从重要文章中提取详细案例
  console.log('📚 从重要文章中提取详细案例...');
  const importantCases = await extractCasesFromImportantArticles(items);
  
  // 传统提取器处理
  console.log('🔍 使用传统提取器提取使用案例...');
  const cases = processItemsForCases(items);
  
  // 合并所有案例
  const allCases = [...cases, ...importantCases, ...processedCases];
  
  // 智能去重
  console.log('🔄 开始智能去重...');
  const deduplicatedCases = deduplicateCases(allCases);
  console.log(`📊 去重前: ${allCases.length} 个案例，去重后: ${deduplicatedCases.length} 个案例，去除了 ${allCases.length - deduplicatedCases.length} 个重复案例`);
  
  const casesPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: deduplicatedCases.length,
    categories: Object.keys(deduplicatedCases.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {})),
    cases: deduplicatedCases
  };
  
  fs.writeFileSync(casesFile, JSON.stringify(casesPayload, null, 2), 'utf-8');
  console.log(`📝 Wrote ${allCases.length} cases to ${path.relative(root, casesFile)} (${cases.length} from general sources + ${importantCases.length} from important articles + ${processedCases.length} from intelligent extraction)`);
  
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