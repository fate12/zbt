import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ENV } from '../_core/env.js';
import { listIndices } from '../services/knowledge-base-service.js';
import { createSupabaseClient } from '../lib/supabase.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const supabase = createSupabaseClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
const router = Router();

// 获取知识库列表
router.get('/indices', async (_req: Request, res: Response) => {
  try {
    const indices = await listIndices();
    res.json({ success: true, data: indices });
  } catch (e: any) {
    console.error('获取知识库列表失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 上传文档到 Supabase Storage（后续由百炼平台处理知识库索引）
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: '请上传文件' });
      return;
    }

    const empId = (req as any).user?.emp_id || 'visitor';
    const fileId = crypto.randomUUID();
    const filePath = `knowledge/${fileId}/${file.originalname}`;

    // 上传到 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(ENV.bucketName)
      .upload(filePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    // 获取公开URL
    const { data: urlData } = supabase.storage.from(ENV.bucketName).getPublicUrl(filePath);

    // 记录文档信息
    const { data: doc, error: dbError } = await supabase
      .from('knowledge_documents')
      .insert({
        id: fileId,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
        status: 'ready',
        file_path: filePath,
        emp_id: empId,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    res.json({ success: true, data: doc });
  } catch (e: any) {
    console.error('上传文档失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取文档列表
router.get('/documents', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (e: any) {
    console.error('获取文档列表失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除文档
router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;

    // 获取文档信息
    const { data: doc } = await supabase
      .from('knowledge_documents')
      .select('file_path')
      .eq('id', docId)
      .single();

    // 删除文件
    if (doc?.file_path) {
      await supabase.storage.from(ENV.bucketName).remove([doc.file_path]);
    }

    // 删除记录
    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', docId);

    if (error) throw error;

    res.json({ success: true });
  } catch (e: any) {
    console.error('删除文档失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
