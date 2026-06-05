import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGatewayMiddleware } from '@barry.jiang/dingtalk-aiapp-infra';
import { need_login } from './_core/auth.js';
import contactsRoutes from './official-apis/contactsRoutes.js';
import {createTokenInjectionMiddleware} from "./_core/tokenInjection.js";
import deptRoutes from './official-apis/deptRoutes.js';
import storageRoutes from './official-apis/storageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminDistRoot = resolveAdminDistRoot();

const app = express();

app.use(cors());
app.use(cookieParser());

// Storage upload route must be registered BEFORE express.json() and createGatewayMiddleware(),
// because body-parsing middleware consumes the request stream, which breaks multer's
// multipart/form-data parsing (causes "Unexpected end of form" error).
app.use('/api/storage', need_login, storageRoutes);

app.use(express.json());
app.use(createGatewayMiddleware());

// Token injection must run BEFORE express.static,
// otherwise static middleware serves index.html directly and skips injection.
app.use(createTokenInjectionMiddleware());

app.use(express.static(adminDistRoot));

app.use('/api', need_login);

// 健康检查接口（免登）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 用户信息接口
app.get('/api/user', (req: any, res) => {
  res.json({
    success: true,
    data: {
      corp_id: req.user?.corp_id || 'anonymous',
      emp_id: req.user?.emp_id || 'visitor',
      name: req.user?.name || '访客',
      avatar: req.user?.avatar || '',
      app_id: req.user?.app_id || '',
    }
  });
});


app.use('/api/contacts', contactsRoutes);
app.use('/api/depts', deptRoutes);

import anchorRoutes from './routes/anchorRoutes.js';
import importRoutes from './routes/importRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import authRoutes from './routes/authRoutes.js';
import activityRecommendRoutes from './routes/activityRecommendRoutes.js';
import { ensureChatTables } from './services/chat-service.js';

app.use('/api/anchors', anchorRoutes);
app.use('/api/import', importRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/activity-recommend', activityRecommendRoutes);

// default route (don't modify)
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: adminDistRoot });
});


app.listen(9000, async () => {
  await ensureChatTables();
  console.log('Server running on http://localhost:9000');
});

function resolveAdminDistRoot() {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'apps', 'admin-web', 'dist'),
    path.resolve(__dirname, '..', '..', '..', 'apps', 'admin-web', 'dist'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}
