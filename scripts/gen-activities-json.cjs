/**
 * 从「结构化 活动信息.xlsx」生成 services/api/data/activities.json
 *
 * 用法：
 *   node scripts/gen-activities-json.cjs [xlsx路径]
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

// 链接列：单元格显示文字与真实 hyperlink 分离，需要把 URL 合并回来，
// 否则 sheet_to_json 只能拿到显示文字，报名链接会变成不可点的纯文本。
const LINK_FIELDS = ['报名链接1', '报名链接2'];

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

// 取某数据行（slice(1) 之后的 0 基索引）、某列的单元格 hyperlink URL
function cellHyperlink(rowIdx, colIdx) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
  const cell = ws[addr];
  if (!cell || !cell.l || !cell.l.Target) return '';
  // SheetJS 可能对 URL 做 HTML 实体转义（& -> &amp;），还原以免跳错链接
  return cell.l.Target.replace(/&amp;/g, '&');
}

const list = [];
rows.slice(1).forEach((r, rowIdx) => {
  const name = clean(r[idx('活动名称')]);
  if (!name) return;
  const o = {};
  FIELDS.forEach(f => {
    const colIdx = idx(f);
    const text = clean(r[colIdx]);
    if (LINK_FIELDS.includes(f)) {
      const url = cellHyperlink(rowIdx, colIdx);
      if (url && text && text !== url) {
        // markdown 链接，前端 ReactMarkdown 可直接渲染成可点击 <a>
        o[f] = `[${text}](${url})`;
      } else if (url) {
        o[f] = url;
      } else {
        o[f] = text;
      }
    } else {
      o[f] = text;
    }
  });
  // 「推荐频次」为可选列：Excel 无该列时取空字符串，不阻塞生成（也不计入上方 FIELDS 校验）
  const freqIdx = idx('推荐频次');
  o['推荐频次'] = freqIdx >= 0 ? clean(r[freqIdx]) : '';
  list.push(o);
});

fs.writeFileSync(outPath, JSON.stringify(list, null, 2), 'utf8');
const byBoard = {};
list.forEach(a => { byBoard[a['所属板块']] = (byBoard[a['所属板块']] || 0) + 1; });
console.log(`✅ 已生成 ${outPath}`);
console.log(`   活动总数: ${list.length}`);
console.log(`   板块分布: ${JSON.stringify(byBoard)}`);
