import { Router, Request, Response } from 'express';
import {
  listSessions,
  createSession,
  deleteSession,
  getMessages,
  streamChat,
} from '../services/chat-service.js';

const router = Router();

// 获取会话列表
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    const sessions = await listSessions(empId);
    res.json({ success: true, data: sessions });
  } catch (e: any) {
    console.error('获取会话列表失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 创建新会话
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    const corpId = (req as any).user?.corp_id || '';
    const { title } = req.body;
    const session = await createSession(empId, corpId, title || '新对话');
    res.json({ success: true, data: session });
  } catch (e: any) {
    console.error('创建会话失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除会话
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const empId = (req as any).user?.emp_id || 'visitor';
    await deleteSession(req.params.id, empId);
    res.json({ success: true });
  } catch (e: any) {
    console.error('删除会话失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取会话消息
router.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const messages = await getMessages(req.params.id);
    res.json({ success: true, data: messages });
  } catch (e: any) {
    console.error('获取消息失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 发送消息（SSE 流式返回）
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ success: false, error: '消息内容不能为空' });
      return;
    }

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sessionId = req.params.id;
    const generator = streamChat(sessionId, content);

    for await (const chunk of generator) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e: any) {
    console.error('聊天失败:', e);
    // 如果还没发送头，返回 JSON 错误
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: e.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: e.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
