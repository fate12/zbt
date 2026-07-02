import pg from 'pg';
import { ENV } from '../_core/env.js';

const { Pool } = pg;

/**
 * 模块级 PostgreSQL 连接池单例。
 *
 * 设计取舍：
 * - RLS 不再依赖（init.sql 不启用），所有请求一律以库 owner 身份直连，无需 per-request 客户端。
 * - 单 Pool 自带连接复用，比「每请求建/传 client」更轻；与原 chat-service / count-service / importRoutes
 *   里「模块级 supabase 单例」的用法对齐，迁移时只需把 import 换成 { query }。
 *
 * SSL：阿里云 RDS 默认开启 SSL，node-postgres 需显式配置，否则握手失败。
 *   rejectUnauthorized:false 仅用于绕过阿里云自签根证书的校验（生产可改为指定 CA）。
 */
const sslEnabled = /sslmode\s*=\s*(require|verify-ca|verify-full)/i.test(ENV.databaseUrl);

export const pool = new Pool({
  connectionString: ENV.databaseUrl || undefined,
  ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
});

/**
 * 参数化查询薄封装。
 * 用法：`const rows = await query<UserRow>('SELECT * FROM t WHERE id=$1', [id])`
 * pg 在出错时会直接 throw（不再有 supabase 的 {error} 解构），调用方用 try/catch 捕获。
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * 事务：从池里取一条连接，BEGIN → fn(client) → COMMIT / ROLLBACK。
 * fn 内用传入的 client（而非模块级 pool）执行 SQL，保证在同一个事务里。
 * 用法：`await transaction(async c => { await c.query(...); await c.query(...); })`
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 优雅关闭连接池（进程退出前调用，否则请求会 hang）。 */
export async function closePool(): Promise<void> {
  await pool.end();
}
