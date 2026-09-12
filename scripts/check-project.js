const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let checked = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel', 'artifacts'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', cwd: root });
      if (result.status !== 0) throw new Error(result.stderr);
      checked++;
    }
    if (entry.name.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
  }
}
walk(root);
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
for (const page of app.pages) for (const ext of ['js','json','wxml','wxss']) {
  if (!fs.existsSync(path.join(root,'miniprogram',`${page}.${ext}`))) throw new Error('小程序页面缺少文件: '+page+'.'+ext);
}
console.log(`通过：${checked} 个 JavaScript 文件语法、JSON 文件及 ${app.pages.length} 个小程序页面入口。`);
