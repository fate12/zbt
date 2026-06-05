import { Router, Request, Response } from 'express';
import { streamActivityRecommendation } from '../services/activity-recommend-service.js';

const router = Router();

// 活动推荐（SSE 流式返回）
router.post('/', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const generator = streamActivityRecommendation(empId);

    for await (const chunk of generator) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
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
