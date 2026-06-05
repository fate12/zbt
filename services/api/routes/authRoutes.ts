import { Router, Request, Response } from 'express';
import { validateCredentials, generateToken, verifyCustomToken } from '../services/auth-service.js';

const router = Router();

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { account_name, account_password } = req.body;
    if (!account_name || !account_password) {
      res.status(400).json({ success: false, error: '请输入账号和密码' });
      return;
    }

    const user = await validateCredentials(account_name, account_password);
    if (!user) {
      res.status(401).json({ success: false, error: '账号或密码错误' });
      return;
    }

    const token = generateToken({
      emp_id: user.emp_id,
      name: user.name,
      corp_id: user.corp_id,
      type: 'zhibotong',
    });

    res.json({
      success: true,
      data: {
        token,
        user: { emp_id: user.emp_id, name: user.name, corp_id: user.corp_id },
      },
    });
  } catch (e: any) {
    console.error('登录失败:', e);
    res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', async (req: any, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.access_token;
  if (!token) {
    res.json({ success: true, data: null });
    return;
  }

  const payload = verifyCustomToken(token);
  if (!payload) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({
    success: true,
    data: {
      emp_id: payload.emp_id,
      name: payload.name,
      corp_id: payload.corp_id,
    },
  });
});

export default router;
