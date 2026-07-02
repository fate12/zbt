import { Router } from 'express';
import { query } from '../lib/db.js';

const router: Router = Router();

const TABLE = 'anchor_accounts';

router.get('/', async (req: any, res: any) => {
  try {
    const { status, keyword, page = '1', pageSize = '20' } = req.query;
    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const offset = (pageNum - 1) * pageSizeNum;

    // 动态 WHERE：status / keyword 可选，用参数下标避免 SQL 注入
    const where: string[] = [`is_deleted = 'n'`];
    const params: any[] = [];
    if (status && status !== 'all') {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (keyword) {
      params.push(`%${keyword}%`);
      where.push(`account_name ILIKE $${params.length}`);
    }
    const whereClause = where.join(' AND ');

    const [listRows, countRows] = await Promise.all([
      query(
        `SELECT * FROM ${TABLE} WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSizeNum, offset],
      ),
      query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${TABLE} WHERE ${whereClause}`,
        params,
      ),
    ]);

    const total = countRows.length > 0 ? Number(countRows[0].count) : 0;
    res.json({ success: true, data: { list: listRows, total } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const rows = await query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND is_deleted = 'n' LIMIT 1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: any, res: any) => {
  try {
    const { account_name, account_password, track_description, tags, interests, status } = req.body;
    if (!account_name) return res.status(400).json({ success: false, error: 'account_name is required' });

    const rows = await query(
      `INSERT INTO ${TABLE}
        (account_name, account_password, track_description, tags, interests, status, creator_emp_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        account_name,
        account_password || '',
        track_description || '',
        tags ? JSON.stringify(tags) : '[]',
        interests ? JSON.stringify(interests) : '[]',
        status || 'active',
        req.user?.emp_id || '',
      ],
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: any, res: any) => {
  try {
    const fields = ['account_name', 'account_password', 'track_description', 'tags', 'interests', 'status'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(f === 'tags' || f === 'interests' ? JSON.stringify(req.body[f]) : req.body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: '没有可更新的字段' });
    }
    params.push(req.params.id);
    const rows = await query(
      `UPDATE ${TABLE} SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} AND is_deleted = 'n'
       RETURNING *`,
      params,
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    await query(
      `UPDATE ${TABLE} SET is_deleted = 'y', updated_at = NOW() WHERE id = $1 AND is_deleted = 'n'`,
      [req.params.id],
    );
    res.json({ success: true, data: null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
