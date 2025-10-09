#!/usr/bin/env node

import fs from 'fs';

console.log('🧹 清理临时文件...');

try {
  fs.unlinkSync('test-env.mjs');
} catch(e) {
  // 忽略错误
}

console.log('✅ 清理完成！');
