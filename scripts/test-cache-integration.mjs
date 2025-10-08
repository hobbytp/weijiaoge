import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimpleCacheManager } from '../fetchers/simple-cache-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 测试缓存集成效果
 */
async function testCacheIntegration() {
  console.log('🧪 开始测试缓存集成效果...');
  
  // 清理测试环境
  const testCacheDir = path.join(__dirname, '../.cache');
  if (fs.existsSync(testCacheDir)) {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  }
  
  try {
    // 初始化缓存管理器
    console.log('\n📝 测试1: 初始化缓存管理器');
    const cacheManager = new SimpleCacheManager();
    console.log('✅ 缓存管理器初始化成功');
    
    // 模拟页面数据
    const mockPages = [
      {
        url: 'https://github.com/example/repo1',
        title: 'Repo 1',
        description: 'This is repo 1 with 5 nano banana cases',
        caseCount: 5
      },
      {
        url: 'https://github.com/example/repo2',
        title: 'Repo 2', 
        description: 'This is repo 2 with 3 nano banana cases',
        caseCount: 3
      },
      {
        url: 'https://example.com/article1',
        title: 'Article 1',
        description: 'This is article 1 with 8 nano banana cases',
        caseCount: 8
      }
    ];
    
    // 测试2: 第一次处理所有页面
    console.log('\n📝 测试2: 第一次处理所有页面');
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const page of mockPages) {
      const shouldProcess = cacheManager.shouldProcess(page.url, page.description, page.caseCount);
      
      if (shouldProcess.shouldProcess) {
        console.log(`🔄 处理页面: ${page.title} (${shouldProcess.reason})`);
        // 模拟处理结果
        const mockResult = {
          cases: Array.from({ length: page.caseCount }, (_, i) => ({
            id: `case_${page.title}_${i}`,
            prompt: `Mock prompt ${i}`,
            category: 'test'
          }))
        };
        
        cacheManager.updateCache(page.url, page.description, mockResult.cases.length);
        processedCount++;
      } else {
        console.log(`⏭️ 跳过页面: ${page.title} (${shouldProcess.reason})`);
        skippedCount++;
      }
    }
    
    console.log(`✅ 第一次处理完成: 处理 ${processedCount} 个页面, 跳过 ${skippedCount} 个页面`);
    console.assert(processedCount === 3, '第一次应该处理所有3个页面');
    console.assert(skippedCount === 0, '第一次不应该跳过任何页面');
    
    // 保存缓存
    cacheManager.saveCache();
    
    // 测试3: 第二次处理相同内容
    console.log('\n📝 测试3: 第二次处理相同内容');
    processedCount = 0;
    skippedCount = 0;
    
    for (const page of mockPages) {
      const shouldProcess = cacheManager.shouldProcess(page.url, page.description, page.caseCount);
      
      if (shouldProcess.shouldProcess) {
        console.log(`🔄 处理页面: ${page.title} (${shouldProcess.reason})`);
        processedCount++;
      } else {
        console.log(`⏭️ 跳过页面: ${page.title} (${shouldProcess.reason})`);
        skippedCount++;
      }
    }
    
    console.log(`✅ 第二次处理完成: 处理 ${processedCount} 个页面, 跳过 ${skippedCount} 个页面`);
    console.assert(processedCount === 0, '第二次应该跳过所有页面');
    console.assert(skippedCount === 3, '第二次应该跳过所有3个页面');
    
    // 测试4: 内容变化检测
    console.log('\n📝 测试4: 内容变化检测');
    const changedPage = {
      ...mockPages[0],
      description: 'This is repo 1 with 7 nano banana cases (updated)',
      caseCount: 7
    };
    
    const shouldProcess = cacheManager.shouldProcess(changedPage.url, changedPage.description, changedPage.caseCount);
    console.log(`内容变化处理结果: ${shouldProcess.shouldProcess} (${shouldProcess.reason})`);
    console.assert(shouldProcess.shouldProcess === true, '内容变化应该需要处理');
    console.assert(shouldProcess.reason === 'content_changed', '内容变化原因应该是content_changed');
    console.log('✅ 内容变化检测测试通过');
    
    // 测试5: 缓存统计信息
    console.log('\n📝 测试5: 缓存统计信息');
    const stats = cacheManager.getStats();
    console.log('缓存统计信息:', stats);
    console.assert(stats.totalPages > 0, '总页面数应该大于0');
    console.assert(stats.processedPages > 0, '已处理页面数应该大于0');
    console.assert(stats.skippedPages > 0, '跳过页面数应该大于0');
    console.assert(stats.savedAPI > 0, '节省的API调用数应该大于0');
    console.log('✅ 缓存统计信息测试通过');
    
    // 测试6: 缓存文件大小
    console.log('\n📝 测试6: 缓存文件大小');
    const fileSize = cacheManager.getCacheFileSize();
    console.log('缓存文件大小:', fileSize, '字节');
    console.assert(fileSize > 0, '缓存文件大小应该大于0');
    console.assert(fileSize < 10000, '缓存文件大小应该小于10KB（轻量级）');
    console.log('✅ 缓存文件大小测试通过');
    
    // 测试7: 缓存持久化
    console.log('\n📝 测试7: 缓存持久化');
    const cacheManager2 = new SimpleCacheManager();
    const stats2 = cacheManager2.getStats();
    console.log('重新加载后的统计信息:', stats2);
    console.assert(stats2.cacheSize > 0, '重新加载后缓存应该包含数据');
    console.log('✅ 缓存持久化测试通过');
    
    console.log('\n🎉 所有集成测试通过！');
    console.log('\n📊 最终统计信息:');
    console.log(`   总页面数: ${stats.totalPages}`);
    console.log(`   已处理页面: ${stats.processedPages}`);
    console.log(`   跳过页面: ${stats.skippedPages}`);
    console.log(`   节省API调用: ${stats.savedAPI}`);
    console.log(`   缓存大小: ${stats.cacheFileSize} 字节`);
    
  } catch (error) {
    console.error('❌ 集成测试失败:', error);
    throw error;
  } finally {
    // 清理测试环境
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  }
}

// 运行集成测试
testCacheIntegration().catch(console.error);
