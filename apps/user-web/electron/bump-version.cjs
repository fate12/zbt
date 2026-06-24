// 打包前自动累计版本号：默认 patch +1
//   node electron/bump-version.cjs            # 1.0.0 -> 1.0.1
//   BUMP=minor node electron/bump-version.cjs # 1.0.0 -> 1.1.0
//   BUMP=major node electron/bump-version.cjs # 1.0.0 -> 2.0.0
//   NO_BUMP=1  node electron/bump-version.cjs # 跳过（重打同一版本时用）
const fs = require('node:fs');
const path = require('node:path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const raw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);
const oldVersion = pkg.version;

if (process.env.NO_BUMP === '1') {
  console.log(`[bump] NO_BUMP=1，保持版本 ${oldVersion}`);
  process.exit(0);
}

// 解析为三段数字（缺段补 0；带预发布后缀的去掉）
const parts = String(oldVersion).split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);

const idx = { major: 0, minor: 1, patch: 2 }[process.env.BUMP || 'patch'];
parts[idx] += 1;
for (let i = idx + 1; i < 3; i++) parts[i] = 0; // 低位归零，符合 semver
pkg.version = parts.join('.');

// 写回：2 空格缩进，保留原换行风格
const newline = /\r\n$/.test(raw) ? '\r\n' : '\n';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + newline);

console.log(`[bump] 版本累计：${oldVersion} -> ${pkg.version}`);
