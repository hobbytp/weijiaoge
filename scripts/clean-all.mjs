#!/usr/bin/env node

import fs from 'fs';

console.log('🧹 彻底清理所有数据...');

try {
  fs.rmSync('public', { recursive: true, force: true });
  console.log('🗑️  删除public目录...');
} catch(e) {
  // 忽略错误
}

try {
  fs.rmSync('.cache', { recursive: true, force: true });
  console.log('🗑️  删除缓存目录...');
} catch(e) {
  // 忽略错误
}

try {
  fs.unlinkSync('test-env.mjs');
  console.log('🗑️  删除临时文件...');
} catch(e) {
  // 忽略错误
}

console.log('✅ 彻底清理完成！现在可以运行 make update 从头开始收集数据');
