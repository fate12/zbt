import { Router, Request, Response } from 'express';
import { streamActivityRecommendation } from '../services/activity-recommend-service.js';
import {
  getLastActivityRecommend,
  listActivityRecommends,
  deleteActivityRecommend,
  saveActivityRecommend,
} from '../services/chat-service.js';

const router = Router();

// 获取活动推荐历史列表（按时间倒序）
router.get('/history', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const list = await listActivityRecommends(empId, limit);

    res.json({
      success: true,
      data: list.map((item) => ({
        id: item.id,
        content: item.content,
        sources: item.sources || [],
        created_at: item.created_at,
      })),
    });
  } catch (e: any) {
    console.error('获取活动推荐历史失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除单条活动推荐
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    const deleted = await deleteActivityRecommend(req.params.id, empId);
    res.json({ success: true, data: { deleted } });
  } catch (e: any) {
    console.error('删除活动推荐失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取最近的活动推荐
router.get('/last', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    const lastRecommend = await getLastActivityRecommend(empId);

    if (!lastRecommend) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        content: lastRecommend.content,
        sources: lastRecommend.sources,
        created_at: lastRecommend.created_at,
      },
    });
  } catch (e: any) {
    console.error('获取活动推荐失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 活动推荐（SSE 流式返回）
router.post('/', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    const corpId = (req as any).user?.corp_id || '';

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const generator = streamActivityRecommendation(empId);

    let accumulatedContent = '';
    let sources: any[] = [];

    for await (const chunk of generator) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      if (chunk.type === 'content') {
        accumulatedContent += chunk.content || '';
      } else if (chunk.type === 'sources') {
        sources = chunk.sources || [];
      }
    }

    // 保存到数据库后再通知前端完成，确保刷新页面能读到上一次推荐。
    if (accumulatedContent || sources.length > 0) {
      try {
        await saveActivityRecommend(empId, corpId, accumulatedContent, sources);
      } catch (e) {
        console.error('保存活动推荐失败:', e);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e: any) {
    console.error('活动推荐失败:', e);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: e.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: e.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
