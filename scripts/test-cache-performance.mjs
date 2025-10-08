import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimpleCacheManager } from '../fetchers/simple-cache-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 测试缓存性能
 */
async function testCachePerformance() {
  console.log('🚀 开始测试缓存性能...');
  
  // 清理测试环境
  const testCacheDir = path.join(__dirname, '../.cache');
  if (fs.existsSync(testCacheDir)) {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  }
  
  try {
    // 初始化缓存管理器
    const cacheManager = new SimpleCacheManager();
    
    // 生成大量测试数据
    const testDataSize = 1000; // 1000个页面
    const testPages = [];
    
    console.log(`📊 生成 ${testDataSize} 个测试页面...`);
    for (let i = 0; i < testDataSize; i++) {
      testPages.push({
        url: `https://example.com/page${i}`,
        title: `Page ${i}`,
        description: `This is page ${i} with ${Math.floor(Math.random() * 20) + 1} nano banana cases`,
        caseCount: Math.floor(Math.random() * 20) + 1
      });
    }
    
    // 测试1: 第一次处理性能
    console.log('\n📝 测试1: 第一次处理性能');
    const startTime1 = Date.now();
    
    for (const page of testPages) {
      const shouldProcess = cacheManager.shouldProcess(page.url, page.description, page.caseCount);
      if (shouldProcess.shouldProcess) {
        // 模拟处理
        cacheManager.updateCache(page.url, page.description, page.caseCount);
      }
    }
    
    const endTime1 = Date.now();
    const firstProcessTime = endTime1 - startTime1;
    console.log(`✅ 第一次处理完成: ${firstProcessTime}ms (${(firstProcessTime / testDataSize).toFixed(2)}ms/页面)`);
    
    // 保存缓存
    cacheManager.saveCache();
    
    // 测试2: 第二次处理性能（缓存命中）
    console.log('\n📝 测试2: 第二次处理性能（缓存命中）');
    const startTime2 = Date.now();
    
    for (const page of testPages) {
      const shouldProcess = cacheManager.shouldProcess(page.url, page.description, page.caseCount);
      // 大部分应该跳过
    }
    
    const endTime2 = Date.now();
    const secondProcessTime = endTime2 - startTime2;
    console.log(`✅ 第二次处理完成: ${secondProcessTime}ms (${(secondProcessTime / testDataSize).toFixed(2)}ms/页面)`);
    
    // 测试3: 缓存文件大小
    console.log('\n📝 测试3: 缓存文件大小');
    const fileSize = cacheManager.getCacheFileSize();
    const fileSizeKB = (fileSize / 1024).toFixed(2);
    console.log(`✅ 缓存文件大小: ${fileSize} 字节 (${fileSizeKB} KB)`);
    console.assert(fileSize < 100000, '缓存文件大小应该小于100KB');
    
    // 测试4: 内存使用情况
    console.log('\n📝 测试4: 内存使用情况');
    const stats = cacheManager.getStats();
    console.log(`✅ 缓存统计: ${stats.cacheSize} 个页面`);
    console.log(`✅ 总页面数: ${stats.totalPages}`);
    console.log(`✅ 已处理页面: ${stats.processedPages}`);
    console.log(`✅ 跳过页面: ${stats.skippedPages}`);
    console.log(`✅ 节省API调用: ${stats.savedAPI}`);
    
    // 测试5: 性能对比
    console.log('\n📝 测试5: 性能对比');
    const performanceImprovement = ((firstProcessTime - secondProcessTime) / firstProcessTime * 100).toFixed(1);
    console.log(`✅ 性能提升: ${performanceImprovement}%`);
    console.log(`✅ 第一次处理: ${firstProcessTime}ms`);
    console.log(`✅ 第二次处理: ${secondProcessTime}ms`);
    console.log(`✅ 节省时间: ${firstProcessTime - secondProcessTime}ms`);
    
    // 测试6: 缓存命中率
    console.log('\n📝 测试6: 缓存命中率');
    const hitRate = (stats.skippedPages / stats.totalPages * 100).toFixed(1);
    console.log(`✅ 缓存命中率: ${hitRate}%`);
    console.assert(hitRate > 90, '缓存命中率应该大于90%');
    
    // 测试7: 大规模数据测试
    console.log('\n📝 测试7: 大规模数据测试');
    const largeTestSize = 5000; // 5000个页面
    const largeTestPages = [];
    
    for (let i = 0; i < largeTestSize; i++) {
      largeTestPages.push({
        url: `https://example.com/largepage${i}`,
        title: `Large Page ${i}`,
        description: `This is large page ${i} with ${Math.floor(Math.random() * 50) + 1} nano banana cases`,
        caseCount: Math.floor(Math.random() * 50) + 1
      });
    }
    
    const startTime3 = Date.now();
    for (const page of largeTestPages) {
      const shouldProcess = cacheManager.shouldProcess(page.url, page.description, page.caseCount);
      if (shouldProcess.shouldProcess) {
        cacheManager.updateCache(page.url, page.description, page.caseCount);
      }
    }
    const endTime3 = Date.now();
    const largeProcessTime = endTime3 - startTime3;
    
    console.log(`✅ 大规模数据处理: ${largeProcessTime}ms (${(largeProcessTime / largeTestSize).toFixed(2)}ms/页面)`);
    console.assert(largeProcessTime < 10000, '大规模数据处理时间应该小于10秒');
    
    // 最终统计
    const finalStats = cacheManager.getStats();
    console.log('\n🎉 性能测试完成！');
    console.log('\n📊 最终性能统计:');
    console.log(`   总页面数: ${finalStats.totalPages}`);
    console.log(`   已处理页面: ${finalStats.processedPages}`);
    console.log(`   跳过页面: ${finalStats.skippedPages}`);
    console.log(`   节省API调用: ${finalStats.savedAPI}`);
    console.log(`   缓存大小: ${finalStats.cacheFileSize} 字节`);
    console.log(`   缓存命中率: ${hitRate}%`);
    console.log(`   性能提升: ${performanceImprovement}%`);
    
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
    throw error;
  } finally {
    // 清理测试环境
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  }
}

// 运行性能测试
testCachePerformance().catch(console.error);
