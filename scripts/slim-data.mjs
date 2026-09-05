// One-off script to slim down existing JSON data files for frontend performance
// Run: node scripts/slim-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataFile = path.join(root, 'public', 'data.json');
const casesFile = path.join(root, 'public', 'cases.json');

const FRONTEND_TYPES = new Set(['repo', 'readme', 'article']);
const FRONTEND_DESC_MAX_LENGTH = 300;

// === Slim down data.json ===
console.log('📦 Processing data.json...');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
const originalCount = data.items.length;
const originalSize = fs.statSync(dataFile).size;

// Save full backup
const fullFile = path.join(root, 'public', 'data-full.json');
fs.writeFileSync(fullFile, JSON.stringify(data), 'utf-8');
console.log(`  💾 Backed up full data to data-full.json (${(fs.statSync(fullFile).size / 1024 / 1024).toFixed(2)} MB)`);

// Filter and slim
const frontendItems = data.items
  .filter(it => FRONTEND_TYPES.has(it.type))
  .map(({ id, createdAt, tags, fullContent, ...rest }) => {
    if (rest.description && rest.description.length > FRONTEND_DESC_MAX_LENGTH) {
      rest.description = rest.description.substring(0, FRONTEND_DESC_MAX_LENGTH);
    }
    return rest;
  });

const slimData = {
  version: data.version || 1,
  generatedAt: data.generatedAt,
  total: frontendItems.length,
  items: frontendItems
};

fs.writeFileSync(dataFile, JSON.stringify(slimData), 'utf-8');
const newDataSize = fs.statSync(dataFile).size;
console.log(`  ✅ data.json: ${originalCount} → ${frontendItems.length} items`);
console.log(`  ✅ data.json: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(newDataSize / 1024).toFixed(0)} KB (↓${((1 - newDataSize / originalSize) * 100).toFixed(1)}%)`);

// === Slim down cases.json ===
console.log('\n📦 Processing cases.json...');
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf-8'));
const originalCasesSize = fs.statSync(casesFile).size;

const slimCases = cases.cases.map(({ originalItem, id, extractedAt, ...rest }) => rest);

const slimCasesPayload = {
  ...cases,
  total: slimCases.length,
  cases: slimCases
};

fs.writeFileSync(casesFile, JSON.stringify(slimCasesPayload), 'utf-8');
const newCasesSize = fs.statSync(casesFile).size;
console.log(`  ✅ cases.json: ${cases.cases.length} cases (fields stripped)`);
console.log(`  ✅ cases.json: ${(originalCasesSize / 1024 / 1024).toFixed(2)} MB → ${(newCasesSize / 1024).toFixed(0)} KB (↓${((1 - newCasesSize / originalCasesSize) * 100).toFixed(1)}%)`);

console.log('\n🎉 Done! Data files slimmed for frontend.');
