import { Router } from 'express';
import multer from 'multer';
import { StorageService } from '../services/storage_service.js';
import xlsx from 'xlsx';
import { query, transaction } from '../lib/db.js';

const router: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const TABLE = 'import_records';

const ALLOWED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.pdf', '.docx'];

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

function generateStoragePath(originalFilename: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = getFileExtension(originalFilename);
  return `imports/${timestamp}_${randomStr}${ext}`;
}

const COLUMN_MAPPINGS = {
  account_name: ['主播账号', '账号', '账号名称', '主播名称', '账户名', '用户名', 'account_name', 'name', 'username'],
  account_password: ['密码', '账号密码', '登录密码', 'password', 'account_password'],
  track_description: ['赛道描述', '赛道', '描述', '主赛道', 'track', 'track_description', 'description'],
  tags: ['标签', 'tag', 'tags'],
  interests: ['兴趣偏好', '兴趣', '偏好', '偏好话题', 'interests', 'interest'],
  status: ['状态', 'status', 'state'],
};

function findColumnValue(rowData: Record<string, string>, field: keyof typeof COLUMN_MAPPINGS): string {
  const possibleNames = COLUMN_MAPPINGS[field];
  for (const name of possibleNames) {
    if (rowData[name] !== undefined && rowData[name] !== '') {
      return rowData[name];
    }
  }
  return '';
}

function parseExcelAnchors(buffer: Buffer): { anchors: any[], totalCount: number, errors: any[], headers: string[] } {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) {
      return { anchors: [], totalCount: 0, errors: [{ message: '文件为空或格式不正确' }], headers: [] };
    }

    const headers = data[0].map((h: any) => String(h || '').trim());
    const anchors: any[] = [];
    const errors: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.every((cell: any) => !cell || String(cell).trim() === '')) continue;

      const rowData: Record<string, string> = {};
      headers.forEach((header: string, idx: number) => {
        rowData[header] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
      });

      const accountName = findColumnValue(rowData, 'account_name');
      if (!accountName) {
        errors.push({ row: i + 1, message: '缺少必填字段：主播账号' });
        continue;
      }

      const tagsValue = findColumnValue(rowData, 'tags');
      const interestsValue = findColumnValue(rowData, 'interests');
      const statusValue = findColumnValue(rowData, 'status');

      const anchor: any = {
        account_name: accountName,
        account_password: findColumnValue(rowData, 'account_password'),
        track_description: findColumnValue(rowData, 'track_description'),
        tags: tagsValue ? JSON.stringify(tagsValue.split(',').map((t: string) => t.trim())) : '[]',
        interests: interestsValue ? JSON.stringify(interestsValue.split(',').map((t: string) => t.trim())) : '[]',
        status: ['active', 'paused', 'disabled'].includes(statusValue.toLowerCase()) ? statusValue.toLowerCase() : 'active',
      };

      anchors.push(anchor);
    }

    return { anchors, totalCount: data.length - 1, errors, headers };
  } catch (error: any) {
    return { anchors: [], totalCount: 0, errors: [{ message: `解析失败：${error.message}` }], headers: [] };
  }
}

// ── 公会后台主播列表导入（22 列模板，首列 uid）──────────────────────────────
const PASSWORD_PREFIX = 'zt'; // 默认密码 = 前缀 + uid，如 88586 → zt88586

// Excel 表头 → anchor_accounts 列名（uid 单独处理 → account_name；密码按 uid 生成）
const GUILD_COLUMN_MAP: Record<string, string> = {
  '主播昵称': 'display_name',
  '运营经纪人': 'operation_agent',
  '招募经纪人': 'recruit_agent',
  '房间号': 'room_id',
  '主播类型': 'anchor_type',
  'TOPSTAR等级': 'topstar_level',
  '合作时间': 'cooperation_period',
  '签约时间': 'sign_time',
  '签约状态': 'sign_status',
  '是否繁星主播': 'is_star_anchor',
  '繁星主播星级': 'star_level',
  '星级任务': 'star_task',
  '粉丝数': 'fans_count',
  '近30天流水': 'revenue_30d',
  '距离到期时间': 'expire_in_days',
  '主播礼物收益自提比例': 'gift_withdraw_rate',
  '主播签约金自提比例': 'sign_bonus_rate',
  '主播运营奖惩进自提比例': 'ops_reward_rate',
  '续约状态': 'renew_status',
  '自动续约按钮': 'auto_renew',
  '未开播天数': 'no_broadcast_days',
};

function generatePasswordByUid(uid: string): string {
  return `${PASSWORD_PREFIX}${uid}`;
}

// 表头含 'uid' 列即判定为公会主播模板
function isGuildTemplate(headers: string[]): boolean {
  return headers.map(h => h.trim()).includes('uid');
}

function parseGuildAnchors(buffer: Buffer, importSource: string): { anchors: any[], totalCount: number, errors: any[] } {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) {
      return { anchors: [], totalCount: 0, errors: [{ message: '文件为空或格式不正确' }] };
    }

    const headers = data[0].map((h: any) => String(h || '').trim());
    const uidIdx = headers.indexOf('uid');
    const anchors: any[] = [];
    const errors: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.every((cell: any) => !cell || String(cell).trim() === '')) continue;

      const uid = uidIdx >= 0 && row[uidIdx] !== undefined && row[uidIdx] !== null
        ? String(row[uidIdx]).trim()
        : '';
      // uid 必须为纯数字（剔除空 / '-' / 非数字），否则跳过并记错
      if (!uid || uid === '-' || !/^\d+$/.test(uid)) {
        errors.push({ row: i + 1, message: `无效 uid：「${uid || '空'}」，已跳过` });
        continue;
      }

      const rowData: Record<string, string> = {};
      headers.forEach((header: string, idx: number) => {
        rowData[header] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
      });

      // 注意：实际 anchor_accounts 表无 role 列（生产库结构与 init-supabase.sql 的 DDL 不一致），
      // 故不写入 role；公会主播用 import_source 字段标识来源即可。
      const anchor: any = {
        account_name: uid,
        account_password: generatePasswordByUid(uid),
        status: 'active',
        import_source: importSource,
      };
      // 其余列按映射原样存储，'-' 占位统一转空串
      for (const [header, col] of Object.entries(GUILD_COLUMN_MAP)) {
        let v = rowData[header] ?? '';
        if (v === '-') v = '';
        anchor[col] = v;
      }
      anchors.push(anchor);
    }

    return { anchors, totalCount: data.length - 1, errors };
  } catch (error: any) {
    return { anchors: [], totalCount: 0, errors: [{ message: `解析失败：${error.message}` }] };
  }
}

const GUILD_UPSERT_BATCH = 500;

/**
 * 构造多行参数化 INSERT（同批 rows 列结构假定一致，取首行 keys）。
 * 返回 { text, params }；rows 为空时返回 null。
 */
function buildBatchInsert(table: string, rows: Record<string, any>[]): { text: string; params: any[] } | null {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  const placeholders: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const row of rows) {
    const group: string[] = [];
    for (const col of columns) {
      params.push(row[col] ?? null);
      group.push(`$${idx++}`);
    }
    placeholders.push(`(${group.join(', ')})`);
  }
  const colList = columns.join(', ');
  const text = `INSERT INTO ${table} (${colList}) VALUES ${placeholders.join(', ')}`;
  return { text, params };
}

// 分批幂等写入（按 account_name=uid 去重），「先按 uid 删除本批、再插入」放在同一事务里。
// 部分批次失败不中断后续批次。
async function upsertGuildAnchorsInBatches(rows: any[]): Promise<{ successCount: number; failedCount: number; batchErrors: any[] }> {
  const batchErrors: any[] = [];
  let successCount = 0;
  let failedCount = 0;
  for (let i = 0; i < rows.length; i += GUILD_UPSERT_BATCH) {
    const batch = rows.slice(i, i + GUILD_UPSERT_BATCH);
    const batchNo = Math.floor(i / GUILD_UPSERT_BATCH) + 1;
    try {
      const uids = batch.map(r => r.account_name);
      await transaction(async (client) => {
        await client.query(`DELETE FROM anchor_accounts WHERE account_name = ANY($1::text[])`, [uids]);
        const built = buildBatchInsert('anchor_accounts', batch);
        if (built) await client.query(built.text, built.params);
      });
      successCount += batch.length;
    } catch (e: any) {
      batchErrors.push({ batch: batchNo, message: e.message });
      failedCount += batch.length;
    }
  }
  return { successCount, failedCount, batchErrors };
}

// POST /api/import/upload - Upload file, overwrite if same file_name exists
router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const fileExt = getFileExtension(originalname);

    if (!ALLOWED_IMPORT_EXTENSIONS.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        error: `不支持的文件类型 "${fileExt}"。支持：${ALLOWED_IMPORT_EXTENSIONS.join(', ')}`,
      });
    }

    // Check if a record with the same file_name already exists (for overwrite)
    const existing = await query<{ id: string; file_path: string }>(
      `SELECT id, file_path FROM ${TABLE}
       WHERE file_name = $1 AND is_deleted = 'n'
       ORDER BY created_at DESC LIMIT 1`,
      [originalname],
    );
    const existingRecord = existing[0];

    // OSS object key：file_path 直接存 key（download 时由 getPublicUrl 还原完整 URL）。
    // 覆盖上传时复用旧 key，否则新生成一个。
    const storagePath = existingRecord?.file_path || generateStoragePath(originalname);

    const storageService = new StorageService();
    const uploadResult = await storageService.upload(
      storagePath,
      req.file.buffer,
      req.file.mimetype,
    );

    let totalCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let errorLog: any[] = [];

    if (fileExt === '.xlsx' || fileExt === '.xls') {
      // 读首行表头判定模板类型：公会主播列表（含 uid 列）→ 按 uid upsert；其余 → 旧 6 字段 insert
      let headers: string[] = [];
      try {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const firstRow: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1 });
        headers = firstRow[0] ? firstRow[0].map((h: any) => String(h || '').trim()) : [];
      } catch (_) { /* 读取表头失败则交给具体解析报错 */ }

      if (isGuildTemplate(headers)) {
        const { anchors, totalCount: total, errors } = parseGuildAnchors(req.file.buffer, originalname);
        totalCount = total;
        errorLog = errors;

        if (anchors.length > 0) {
          const upsertRes = await upsertGuildAnchorsInBatches(anchors);
          successCount = upsertRes.successCount;
          failedCount = upsertRes.failedCount;
          if (upsertRes.batchErrors.length > 0) {
            errorLog.push({ message: `部分批次写入失败：${JSON.stringify(upsertRes.batchErrors)}` });
          }
        } else if (errors.length === 0) {
          errorLog.push({ message: 'Excel 文件中没有找到有效数据行' });
        }
      } else {
        const { anchors, totalCount: total, errors } = parseExcelAnchors(req.file.buffer);
        totalCount = total;
        errorLog = errors;

        if (anchors.length > 0) {
          const insertData = anchors.map(a => ({
            ...a,
            creator_emp_id: req.user?.emp_id || '',
          }));

          try {
            const built = buildBatchInsert('anchor_accounts', insertData);
            if (built) await query(built.text, built.params);
            successCount = anchors.length;
          } catch (insertError: any) {
            errorLog.push({ message: `批量插入失败：${insertError.message}`, details: insertError.message });
            failedCount = anchors.length;
          }
        } else if (errors.length === 0) {
          errorLog.push({ message: 'Excel 文件中没有找到有效数据行' });
        }
      }
    }

    const finalStatus = errorLog.length > 0 && successCount === 0 ? 'failed' : 'success';

    if (existingRecord) {
      // Overwrite existing record with same file_name
      const rows = await query(
        `UPDATE ${TABLE}
         SET file_type = $1, file_path = $2, file_size = $3, status = $4,
             success_count = $5, fail_count = $6, error_message = $7, updated_at = $8
         WHERE id = $9
         RETURNING *`,
        [
          fileExt.replace('.', ''),
          uploadResult.filePath,
          req.file.size,
          finalStatus,
          successCount,
          failedCount,
          errorLog.length > 0 ? JSON.stringify(errorLog) : null,
          new Date().toISOString(),
          existingRecord.id,
        ],
      );
      const data = rows[0];

      await query(
        `INSERT INTO operation_logs (operation_type, target_type, target_id, operation_content, emp_id)
         VALUES ($1, $2, $3, $4, $5)`,
        ['import', 'import', String(data.id), `覆盖上传导入文件：${originalname}，成功${successCount}条，失败${failedCount}条`, req.user?.emp_id || ''],
      );

      res.status(200).json({
        success: true,
        data,
        overwritten: true,
        summary: { totalCount, successCount, failedCount, errors: errorLog },
      });
    } else {
      // Create new import record
      const rows = await query(
        `INSERT INTO ${TABLE}
          (file_name, file_type, file_path, file_size, status, success_count, fail_count, error_message, emp_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          originalname,
          fileExt.replace('.', ''),
          uploadResult.filePath,
          req.file.size,
          finalStatus,
          successCount,
          failedCount,
          errorLog.length > 0 ? JSON.stringify(errorLog) : null,
          req.user?.emp_id || '',
        ],
      );
      const data = rows[0];

      await query(
        `INSERT INTO operation_logs (operation_type, target_type, target_id, operation_content, emp_id)
         VALUES ($1, $2, $3, $4, $5)`,
        ['import', 'import', String(data.id), `上传导入文件：${originalname}，成功${successCount}条，失败${failedCount}条`, req.user?.emp_id || ''],
      );

      res.status(201).json({
        success: true,
        data,
        overwritten: false,
        summary: { totalCount, successCount, failedCount, errors: errorLog },
      });
    }
  } catch (error: any) {
    console.error('Import upload error:', error);
    res.status(500).json({ success: false, error: error.message || '上传失败' });
  }
});

// GET /api/import/records - List import records
router.get('/records', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const offset = (page - 1) * size;

    const [listRows, countRows] = await Promise.all([
      query(
        `SELECT * FROM ${TABLE} WHERE is_deleted = 'n' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [size, offset],
      ),
      query<{ count: string }>(`SELECT count(*)::text AS count FROM ${TABLE} WHERE is_deleted = 'n'`, []),
    ]);

    const total = countRows.length > 0 ? Number(countRows[0].count) : 0;
    res.json({ success: true, data: listRows, total });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/import/records/:id - Get single import record
router.get('/records/:id', async (req: any, res: any) => {
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

// GET /api/import/records/:id/download - Download import file
router.get('/records/:id/download', async (req: any, res: any) => {
  try {
    const rows = await query<{ id: string; file_name: string; file_path: string; file_type: string; is_deleted: string }>(
      `SELECT id, file_name, file_path, file_type, is_deleted FROM ${TABLE} WHERE id = $1 AND is_deleted = 'n' LIMIT 1`,
      [req.params.id],
    );
    const record = rows[0];

    if (!record) {
      return res.status(404).json({ success: false, error: '导入记录不存在' });
    }

    if (!record.file_path) {
      return res.status(400).json({ success: false, error: '该记录没有关联的文件' });
    }

    // file_path 存的是 OSS object key，由 StorageService 还原完整 URL 后重定向
    const publicUrl = new StorageService().getPublicUrl(record.file_path);
    const encodedFileName = encodeURIComponent(record.file_name);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.redirect(publicUrl);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message || '下载失败' });
  }
});

// DELETE /api/import/records/:id - Delete import record (soft delete)
router.delete('/records/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const rows = await query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND is_deleted = 'n' LIMIT 1`,
      [id],
    );
    const record = rows[0];

    if (!record) {
      return res.status(404).json({ success: false, error: '导入记录不存在' });
    }

    await query(
      `UPDATE ${TABLE} SET is_deleted = 'y', updated_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id],
    );

    await query(
      `INSERT INTO operation_logs (operation_type, target_type, target_id, operation_content, emp_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['delete', 'import', String(id), `删除导入记录：${record.file_name}`, req.user?.emp_id || ''],
    );

    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('Delete import record error:', error);
    res.status(500).json({ success: false, error: error.message || '删除失败' });
  }
});

export default router;
