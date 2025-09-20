import { fetchFromGitHub } from '../fetchers/github.mjs';

async function testGitHubSearch() {
  console.log('🧪 测试GitHub搜索功能...');
  
  try {
    const results = await fetchFromGitHub();
    
    console.log(`\n📊 搜索结果统计:`);
    console.log(`- 总项目数: ${results.length}`);
    
    const byType = results.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`- 按类型分布:`, byType);
    
    const bySource = results.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`- 按来源分布:`, bySource);
    
    // 显示前几个结果
    console.log(`\n🔍 前5个结果:`);
    results.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   类型: ${item.type}, 来源: ${item.source}`);
      console.log(`   描述: ${item.description.slice(0, 100)}...`);
      console.log(`   URL: ${item.url}`);
      console.log('');
    });
    
    // 检查是否有README内容
    const readmes = results.filter(item => item.type === 'readme');
    console.log(`\n📚 找到 ${readmes.length} 个README:`);
    readmes.forEach(readme => {
      console.log(`- ${readme.title}`);
      console.log(`  内容长度: ${readme.fullContent ? readme.fullContent.length : 0} 字符`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testGitHubSearch();
