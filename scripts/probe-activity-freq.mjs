#!/usr/bin/env node
/**
 * Step 0 探针（一次性调试工具）：对活动知识库索引调用一次 retrieve，打印完整原始返回。
 *
 * 目的：在接入「推荐频次」过滤前，确认三件事——
 *   1. 切片里到底有没有「推荐频次」字段（前提：已把含频次的 Excel 重新上传知识库）；
 *   2. 该字段在 metadata 里还是在 text 正文里，确切的字段名是什么；
 *   3. chunk_id 是否稳定（同一活动多次检索 chunk_id 是否一致）——决定计数主键能否借力。
 *
 * 用法：
 *   node scripts/probe-activity-freq.mjs                  # 用默认 query
 *   node scripts/probe-activity-freq.mjs "TopStar名单"    # 指定活动名做 query
 *
 * 读取环境变量（从 services/api/.env）：
 *   DASHSCOPE_API_KEY、BAILIAN_ACTIVITY_INDEX_ID、（可选）BAILIAN_WORKSPACE_ID
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', 'services', 'api', '.env');

// 简易 .env 读取（不覆盖已有环境变量）
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const API_KEY = process.env.DASHSCOPE_API_KEY;
const INDEX_ID = process.env.BAILIAN_ACTIVITY_INDEX_ID;
const WORKSPACE_ID = process.env.BAILIAN_WORKSPACE_ID || '';
const query = process.argv[2] || 'TopStar';

if (!API_KEY || !INDEX_ID) {
  console.error('❌ 缺少 DASHSCOPE_API_KEY 或 BAILIAN_ACTIVITY_INDEX_ID，请检查 services/api/.env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};
if (WORKSPACE_ID) headers['X-DashScope-Workspace'] = WORKSPACE_ID;

console.log(`查询 index_id=${INDEX_ID} query="${query}"\n`);

const res = await fetch('https://dashscope.aliyuncs.com/api/v1/apps/index/retrieval', {
  method: 'POST',
  headers,
  body: JSON.stringify({ index_id: INDEX_ID, query, top_k: 3, rerank: false }),
});

const json = await res.json();
console.log('=== HTTP', res.status, '===');
console.log(JSON.stringify(json, null, 2));

// 兼容两种返回结构（项目端点 output.results / 官方 Retrieve Data.Nodes）
const results = json?.output?.results ?? json?.output?.nodes ?? json?.Data?.Nodes ?? [];
console.log('\n=== 频次字段探测 ===');
for (const [i, r] of results.entries()) {
  const text = r.content ?? r.text ?? r.Text ?? '';
  const meta = r.metadata ?? r.Metadata ?? r.meta ?? {};
  const m1 = text.match(/推荐频次[：:]\s*(\d+)/) || text.match(/推荐次数上限[：:]\s*(\d+)/);
  const numericMeta = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => /^\d+$/.test(String(v)))
  );
  console.log(`[#${i}] chunkId=${r.chunk_id ?? r.chunkId ?? r.id}`);
  console.log(`     title=${r.title ?? r.document_title ?? ''}`);
  console.log(`     text 命中「推荐频次」: ${m1 ? m1[1] : '无'}`);
  console.log(`     metadata keys: ${Object.keys(meta).join(', ') || '(空)'}`);
  console.log(`     metadata 中数字字段: ${JSON.stringify(numericMeta)}`);
  console.log(`     text 前 200 字: ${text.slice(0, 200)}`);
}
