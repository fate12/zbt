/**
 * 从「结构化 活动信息.xlsx」生成 services/api/data/activities.json
 *
 * 用法：
 *   node scripts/gen-activities-json.js [xlsx路径]
 *
 * 默认 xlsx 路径：~/Downloads/结构化 活动信息.xlsx
 * Excel 表头需包含：活动名称/活动分类/所属板块/活动标签/报名对象/
 *                   报名要求描述/详细活动要求/报名链接1/报名链接2/备注说明
 */
const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'services', 'api', 'node_modules', 'xlsx'));

const xlsxPath = process.argv[2] || path.join(process.env.HOME, 'Downloads', '结构化 活动信息.xlsx');
const outPath = path.join(__dirname, '..', 'services', 'api', 'data', 'activities.json');

const FIELDS = [
  '活动名称', '活动分类', '所属板块', '活动标签', '报名对象',
  '报名要求描述', '详细活动要求', '报名链接1', '报名链接2', '备注说明',
];

const clean = s => String(s ?? '').trim().replace(/\r/g, '');

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = rows[0];
const idx = name => headers.indexOf(name);

// 校验表头
const missing = FIELDS.filter(f => idx(f) === -1);
if (missing.length) {
  console.error('❌ Excel 缺少列:', missing.join('、'));
  process.exit(1);
}

const list = [];
rows.slice(1).forEach(r => {
  const name = clean(r[idx('活动名称')]);
  if (!name) return;
  const o = {};
  FIELDS.forEach(f => { o[f] = clean(r[idx(f)]); });
  list.push(o);
});

fs.writeFileSync(outPath, JSON.stringify(list, null, 2), 'utf8');
const byBoard = {};
list.forEach(a => { byBoard[a['所属板块']] = (byBoard[a['所属板块']] || 0) + 1; });
console.log(`✅ 已生成 ${outPath}`);
console.log(`   活动总数: ${list.length}`);
console.log(`   板块分布: ${JSON.stringify(byBoard)}`);
