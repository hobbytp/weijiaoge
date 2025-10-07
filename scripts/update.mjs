// scripts/update.mjs
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCasesFromImportantArticles } from '../fetchers/article-extractor.mjs';
import { processItemsForCases } from '../fetchers/case-extractor.mjs';
import { fetchFromGitHub } from '../fetchers/github.mjs';
import { fetchFromWeb } from '../fetchers/web.mjs';
import { extractIntelligently, getExtractionStats } from '../fetchers/hybrid-extractor.mjs';

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

  // 提取使用案例 - 使用混合智能提取器
  console.log('🔍 使用混合智能提取器提取使用案例...');
  const cases = processItemsForCases(items);
  
  // 从重要文章中提取详细案例
  console.log('📚 从重要文章中提取详细案例...');
  const importantCases = await extractCasesFromImportantArticles(items);
  
  // 使用智能提取器处理低置信度的案例
  console.log('🧠 使用智能提取器处理低置信度案例...');
  const lowConfidenceItems = items.filter(item => {
    // 这里可以添加逻辑来识别低置信度的项目
    return item.description && item.description.length > 100;
  });
  
  const intelligentCases = [];
  for (const item of lowConfidenceItems.slice(0, 10)) { // 限制处理数量
    try {
      const result = await extractIntelligently(item.description, item);
      if (result.result && result.confidence > 0.6) {
        intelligentCases.push({
          ...result.result,
          source: 'intelligent',
          extractor: result.extractor,
          confidence: result.confidence
        });
      }
    } catch (error) {
      console.error(`智能提取失败: ${item.title}`, error);
    }
  }
  
  // 合并所有案例
  const allCases = [...cases, ...importantCases, ...intelligentCases];
  
  const casesPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: allCases.length,
    categories: Object.keys(allCases.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {})),
    cases: allCases
  };
  
  fs.writeFileSync(casesFile, JSON.stringify(casesPayload, null, 2), 'utf-8');
  console.log(`📝 Wrote ${allCases.length} cases to ${path.relative(root, casesFile)} (${cases.length} from general sources + ${importantCases.length} from important articles + ${intelligentCases.length} from intelligent extraction)`);
  
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