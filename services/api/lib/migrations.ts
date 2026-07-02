import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, transaction } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 迁移文件目录解析。
 *
 * 从 __dirname 逐级向上查找 `deploy/db/migrations`，兼容任意部署目录深度
 * （源码运行在 services/api/lib、编译运行在 services/api/dist/lib、
 *   或打包到更深路径都能命中仓库根的 deploy/db/migrations）。
 *
 * 也可用环境变量 MIGRATIONS_DIR 显式指定，优先级最高。
 */
function resolveMigrationsDir(): string {
  const override = process.env.MIGRATIONS_DIR;
  if (override) return override;

  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'deploy', 'db', 'migrations');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break; // 到达文件系统根
    dir = parent;
  }
  // 兜底：返回最可能的位置，runMigrations 会再判存在性并告警
  return path.resolve(__dirname, '..', '..', '..', 'deploy', 'db', 'migrations');
}

/**
 * 启动时自动迁移。
 *
 * 工作方式：
 * - 用 `_migrations(filename, applied_at)` 表记录已应用的文件
 * - 扫描 deploy/db/migrations/*.sql，按文件名排序
 * - 对每个未记录的文件，在**单个事务**里执行整段 SQL，成功后写入 _migrations
 * - 任一文件失败 → 抛错中断启动（避免带着不一致的 schema 跑起来）
 *
 * 多语句支持：node-postgres 在「不带 params」时走 simple query protocol，
 * 可一次执行整段分号分隔的 SQL（含 $$ ... $$ 函数体），无需手动切分。
 *
 * 日常加字段：在 deploy/db/migrations/ 新增一个编号更大的 .sql 文件即可，
 * 提交部署后服务启动会自动执行，无需手动碰数据库。
 */
export async function runMigrations(): Promise<void> {
  const dir = resolveMigrationsDir();
  if (!fs.existsSync(dir)) {
    console.warn(`[migrate] 迁移目录不存在: ${dir}，跳过自动迁移`);
    return;
  }

  // 1. 追踪表（幂等）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 2. 已应用集合
  const { rows } = await pool.query('SELECT filename FROM _migrations');
  const applied = new Set(rows.map((r: any) => r.filename));

  // 3. 扫描并按文件名排序
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] 无迁移文件');
    return;
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log(`[migrate] 全部 ${files.length} 个迁移已应用，跳过`);
    return;
  }

  console.log(`[migrate] 待应用 ${pending.length}/${files.length}: ${pending.join(', ')}`);

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await transaction(async (client) => {
        await client.query(sql); // simple protocol，整段多语句一次跑完
        await client.query('INSERT INTO _migrations(filename) VALUES ($1)', [file]);
      });
      console.log(`[migrate] ✓ ${file}`);
    } catch (e: any) {
      console.error(`[migrate] ✗ ${file} 失败:`, e?.message);
      throw e;
    }
  }

  console.log('[migrate] 全部迁移完成');
}
