import { Router } from 'express';
import multer from 'multer';
import { StorageService } from '../services/storage_service.js';
import xlsx from 'xlsx';

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const TABLE = 'import_records';
const BUCKET_SUFFIX = undefined;

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
        error: `不支持的文件类型 "${fileExt}"。支持：${ALLOWED_IMPORT_EXTENSIONS.join(', ')}` 
      });
    }

    // Check if a record with the same file_name already exists (for overwrite)
    const { data: existingRecord } = await req.supabase
      .from(TABLE)
      .select('id, file_path')
      .eq('file_name', originalname)
      .eq('is_deleted', 'n')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Determine storage path - reuse existing path for overwrite
    let storagePath: string;
    if (existingRecord?.file_path) {
      const urlParts = existingRecord.file_path.split('/object/public/');
      if (urlParts.length > 1) {
        storagePath = urlParts[1].split('/').slice(1).join('/');
      } else {
        storagePath = existingRecord.file_path;
      }
    } else {
      storagePath = generateStoragePath(originalname);
    }

    const storageService = new StorageService(req.supabase);
    const uploadResult = await storageService.upload(
      storagePath,
      req.file.buffer,
      req.file.mimetype,
      BUCKET_SUFFIX,
    );

    let totalCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let errorLog: any[] = [];

    if (fileExt === '.xlsx' || fileExt === '.xls') {
      const { anchors, totalCount: total, errors } = parseExcelAnchors(req.file.buffer);
      totalCount = total;
      errorLog = errors;

      if (anchors.length > 0) {
        const insertData = anchors.map(a => ({
          ...a,
          creator_emp_id: req.user?.emp_id || '',
        }));
        
        const { error: insertError, data: insertedData } = await req.supabase
          .from('anchor_accounts')
          .insert(insertData)
          .select();

        if (insertError) {
          errorLog.push({ message: `批量插入失败：${insertError.message}`, details: insertError });
          failedCount = anchors.length;
        } else {
          successCount = anchors.length;
        }
      } else if (errors.length === 0) {
        errorLog.push({ message: 'Excel 文件中没有找到有效数据行' });
      }
    }

    const finalStatus = errorLog.length > 0 && successCount === 0 ? 'failed' : 'success';

    if (existingRecord) {
      // Overwrite existing record with same file_name
      const { data, error } = await req.supabase
        .from(TABLE)
        .update({
          file_type: fileExt.replace('.', ''),
          file_path: uploadResult.publicUrl,
          file_size: req.file.size,
          status: finalStatus,
          success_count: successCount,
          fail_count: failedCount,
          error_message: errorLog.length > 0 ? JSON.stringify(errorLog) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;

      await req.supabase.from('operation_logs').insert({
        operation_type: 'import',
        target_type: 'import',
        target_id: String(data.id),
        operation_content: `覆盖上传导入文件：${originalname}，成功${successCount}条，失败${failedCount}条`,
        emp_id: req.user?.emp_id || '',
      });

      res.status(200).json({
        success: true,
        data,
        overwritten: true,
        summary: { totalCount, successCount, failedCount, errors: errorLog }
      });
    } else {
      // Create new import record
      const { data, error } = await req.supabase
        .from(TABLE)
        .insert({
          file_name: originalname,
          file_type: fileExt.replace('.', ''),
          file_path: uploadResult.publicUrl,
          file_size: req.file.size,
          status: finalStatus,
          success_count: successCount,
          fail_count: failedCount,
          error_message: errorLog.length > 0 ? JSON.stringify(errorLog) : null,
          emp_id: req.user?.emp_id || '',
        })
        .select()
        .single();

      if (error) throw error;

      await req.supabase.from('operation_logs').insert({
        operation_type: 'import',
        target_type: 'import',
        target_id: String(data.id),
        operation_content: `上传导入文件：${originalname}，成功${successCount}条，失败${failedCount}条`,
        emp_id: req.user?.emp_id || '',
      });

      res.status(201).json({
        success: true,
        data,
        overwritten: false,
        summary: { totalCount, successCount, failedCount, errors: errorLog }
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

    const { data, error, count } = await req.supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('is_deleted', 'n')
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1);

    if (error) throw error;
    res.json({ success: true, data: data || [], total: count || 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/import/records/:id - Get single import record
router.get('/records/:id', async (req: any, res: any) => {
  try {
    const { data, error } = await req.supabase
      .from(TABLE)
      .select('*')
      .eq('id', req.params.id)
      .eq('is_deleted', 'n')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/import/records/:id/download - Download import file
router.get('/records/:id/download', async (req: any, res: any) => {
  try {
    const { data: record, error } = await req.supabase
      .from(TABLE)
      .select('id, file_name, file_path, file_type, is_deleted')
      .eq('id', req.params.id)
      .eq('is_deleted', 'n')
      .single();

    if (error || !record) {
      return res.status(404).json({ success: false, error: '导入记录不存在' });
    }

    if (!record.file_path) {
      return res.status(400).json({ success: false, error: '该记录没有关联的文件' });
    }

    const encodedFileName = encodeURIComponent(record.file_name);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.redirect(record.file_path);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message || '下载失败' });
  }
});

// DELETE /api/import/records/:id - Delete import record (soft delete)
router.delete('/records/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const { data: record, error: fetchError } = await req.supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', 'n')
      .single();

    if (fetchError || !record) {
      return res.status(404).json({ success: false, error: '导入记录不存在' });
    }

    const { error: deleteError } = await req.supabase
      .from(TABLE)
      .update({ is_deleted: 'y', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) throw deleteError;

    await req.supabase.from('operation_logs').insert({
      operation_type: 'delete',
      target_type: 'import',
      target_id: String(id),
      operation_content: `删除导入记录：${record.file_name}`,
      emp_id: req.user?.emp_id || '',
    });

    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('Delete import record error:', error);
    res.status(500).json({ success: false, error: error.message || '删除失败' });
  }
});

export default router;
