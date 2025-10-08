import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimpleCacheManager } from '../fetchers/simple-cache-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 测试SimpleCacheManager功能
 */
async function testSimpleCacheManager() {
  console.log('🧪 开始测试SimpleCacheManager...');
  
  // 清理测试环境
  const testCacheDir = path.join(__dirname, '../.cache');
  if (fs.existsSync(testCacheDir)) {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  }
  
  try {
    // 测试1: 初始化缓存管理器
    console.log('\n📝 测试1: 初始化缓存管理器');
    const cacheManager = new SimpleCacheManager();
    console.log('✅ 缓存管理器初始化成功');
    
    // 测试2: 新页面处理
    console.log('\n📝 测试2: 新页面处理');
    const url1 = 'https://example.com/page1';
    const content1 = 'This is page 1 content with 5 cases';
    const caseCount1 = 5;
    
    const result1 = cacheManager.shouldProcess(url1, content1, caseCount1);
    console.log('新页面处理结果:', result1);
    console.assert(result1.shouldProcess === true, '新页面应该需要处理');
    console.assert(result1.reason === 'new_page', '新页面原因应该是new_page');
    
    // 更新缓存
    cacheManager.updateCache(url1, content1, caseCount1);
    console.log('✅ 新页面处理测试通过');
    
    // 测试3: 相同内容跳过
    console.log('\n📝 测试3: 相同内容跳过');
    const result2 = cacheManager.shouldProcess(url1, content1, caseCount1);
    console.log('相同内容处理结果:', result2);
    console.assert(result2.shouldProcess === false, '相同内容应该跳过处理');
    console.assert(result2.reason === 'no_change', '相同内容原因应该是no_change');
    console.log('✅ 相同内容跳过测试通过');
    
    // 测试4: 内容变化检测
    console.log('\n📝 测试4: 内容变化检测');
    const content1Changed = 'This is page 1 content with 8 cases (updated)';
    const caseCount1Changed = 8;
    
    const result3 = cacheManager.shouldProcess(url1, content1Changed, caseCount1Changed);
    console.log('内容变化处理结果:', result3);
    console.assert(result3.shouldProcess === true, '内容变化应该需要处理');
    console.assert(result3.reason === 'content_changed', '内容变化原因应该是content_changed');
    console.log('✅ 内容变化检测测试通过');
    
    // 测试5: case数量变化检测
    console.log('\n📝 测试5: case数量变化检测');
    const result4 = cacheManager.shouldProcess(url1, content1, 10);
    console.log('case数量变化处理结果:', result4);
    console.assert(result4.shouldProcess === true, 'case数量变化应该需要处理');
    console.assert(result4.reason === 'content_changed', 'case数量变化原因应该是content_changed');
    console.log('✅ case数量变化检测测试通过');
    
    // 测试6: 缓存保存和加载
    console.log('\n📝 测试6: 缓存保存和加载');
    cacheManager.saveCache();
    console.log('缓存保存成功');
    
    // 创建新的缓存管理器实例来测试加载
    const cacheManager2 = new SimpleCacheManager();
    const stats = cacheManager2.getStats();
    console.log('加载后的统计信息:', stats);
    console.assert(stats.cacheSize > 0, '缓存应该包含数据');
    console.log('✅ 缓存保存和加载测试通过');
    
    // 测试7: 统计信息
    console.log('\n📝 测试7: 统计信息');
    const finalStats = cacheManager.getStats();
    console.log('最终统计信息:', finalStats);
    console.assert(finalStats.totalPages > 0, '总页面数应该大于0');
    console.assert(finalStats.processedPages > 0, '已处理页面数应该大于0');
    console.assert(finalStats.skippedPages > 0, '跳过页面数应该大于0');
    console.log('✅ 统计信息测试通过');
    
    // 测试8: 哈希函数
    console.log('\n📝 测试8: 哈希函数');
    const hash1 = cacheManager.hashContent('test content');
    const hash2 = cacheManager.hashContent('test content');
    const hash3 = cacheManager.hashContent('different content');
    
    console.assert(hash1 === hash2, '相同内容应该产生相同哈希');
    console.assert(hash1 !== hash3, '不同内容应该产生不同哈希');
    console.log('✅ 哈希函数测试通过');
    
    // 测试9: 缓存文件大小
    console.log('\n📝 测试9: 缓存文件大小');
    const fileSize = cacheManager.getCacheFileSize();
    console.log('缓存文件大小:', fileSize, '字节');
    console.assert(fileSize > 0, '缓存文件大小应该大于0');
    console.log('✅ 缓存文件大小测试通过');
    
    console.log('\n🎉 所有测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  } finally {
    // 清理测试环境
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  }
}

// 运行测试
testSimpleCacheManager().catch(console.error);
