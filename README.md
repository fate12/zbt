# 主播通（Zhibotong）

> 最后更新：2026-06-26

## 一、项目总览

主播通是一套**直播主播管理系统**，采用 pnpm monorepo 架构，包含 3 个子项目：

```
┌─────────────────────────────────────────────────────┐
│                    主播通 Workspace                   │
├──────────────┬──────────────┬───────────────────────┤
│  管理后台     │   用户端      │    API 服务            │
│  admin-web   │  user-web    │    api                 │
│  (运营人员)   │  (主播本人)   │    (系统中枢)          │
│  React + Vite │  React + Vite │   Node + Express      │
│  端口 5173    │  端口 5174    │    端口 9000           │
└──────────────┴──────────────┴───────────────────────┘
         │              │               │
         └──────────────┴───────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │   Supabase (PostgreSQL) │
                    │   + 阿里云百炼 AI       │
                    └───────────────────────┘
```

| 子项目 | 面向谁 | 核心用途 |
|--------|--------|----------|
| **管理后台** (admin-web) | 运营人员 | 管理主播账号、批量导入数据 |
| **用户端** (user-web) | 主播本人 | AI 智能问答、活动推荐。可打包为 Windows 桌面应用 |
| **API 服务** (api) | 系统内部 | 承接前后端、连接数据库和 AI 大模型 |

### 仓库目录

```text
apps/
  admin-web/        # 主播管理后台（管理端 SPA）
  user-web/         # 主播通前端（用户端 Web + Electron 桌面版）
services/
  api/              # Node/Express API（同时托管 admin-web 静态页面）
docs/
  SPEC.md           # 产品规格文档（模块、路由、设计令牌）
  SCAFFOLD.md       # admin-web 脚手架约定
supabase/           # 数据库迁移和表定义
deploy/             # ECS 部署脚本、Nginx、PM2 配置
scripts/            # 工具脚本（Excel 转 JSON、知识库生成等）
```

---

## 二、功能详情

### 2.1 管理后台（运营人员使用）

管理后台是运营人员的日常工作台，通过浏览器访问。

**登录** — 账号密码登录，未登录自动跳转登录页

**主播管理（首页）**
- 查看主播列表（分页、筛选）
- 新增主播（账号名、密码、赛道描述、标签、兴趣等）
- 编辑 / 删除主播

**批量导入**
- 上传 Excel / PDF / Word 文件，系统自动解析批量录入
- 支持格式：`.xlsx` / `.xls` / `.pdf` / `.docx`
- 查看导入历史（文件名、状态、成功/失败条数）
- 下载或删除导入记录

### 2.2 用户端（主播使用）

用户端是主播的个人工具，支持浏览器访问和 Windows 桌面安装。

**登录** — 账号密码登录，登录状态保存在浏览器本地

**AI 智能问答（首页）**
- 与 AI 助手多轮对话（基于阿里云百炼 / 通义千问）
- 流式输出，回答逐字显示
- 知识库引用：AI 回答时检索知识库文档，展示引用来源
- 会话管理：多会话切换、新建、删除，历史持久保存

**活动推荐**
- 根据主播的赛道、标签、兴趣，AI 推荐适合参加的活动
- 推荐内容：活动名称、匹配理由、报名条件、报名链接
- 展示匹配的知识库文档（参考来源）
- 历史记录可查看和删除
- 频次控制：同一活动对同一主播有推荐次数上限

**Windows 桌面版** — 基于 Electron 打包为 .exe 安装包，支持自定义安装目录

### 2.3 API 服务（系统中枢）

API 服务不直接面向用户，是连接前端、数据库、AI 的桥梁。

**接口清单：**

| 接口路径 | 方法 | 说明 | 需登录 |
|----------|------|------|:------:|
| `/api/health` | GET | 健康检查 | ❌ |
| `/api/auth/login` | POST | 登录（返回 token） | ❌ |
| `/api/auth/me` | GET | 获取当前用户信息 | ❌ |
| `/api/anchors` | GET/POST | 主播列表 / 新增主播 | ✅ |
| `/api/anchors/:id` | GET/PUT/DELETE | 主播详情 / 编辑 / 删除 | ✅ |
| `/api/import/upload` | POST | 上传文件批量导入 | ✅ |
| `/api/import/records` | GET | 导入历史 | ✅ |
| `/api/import/records/:id` | GET/DELETE | 导入详情 / 删除 | ✅ |
| `/api/import/records/:id/download` | GET | 下载导入文件 | ✅ |
| `/api/chat/sessions` | GET/POST | 会话列表 / 新建会话 | ✅ |
| `/api/chat/sessions/:id` | DELETE | 删除会话 | ✅ |
| `/api/chat/sessions/:id/messages` | GET/POST | 消息列表 / 发送消息（SSE 流式） | ✅ |
| `/api/activity-recommend` | POST | 请求活动推荐（SSE 流式） | ✅ |
| `/api/activity-recommend/history` | GET | 推荐历史 | ✅ |
| `/api/activity-recommend/last` | GET | 最近一次推荐 | ✅ |
| `/api/activity-recommend/:id` | DELETE | 删除推荐记录 | ✅ |
| `/api/storage` | POST | 文件上传 | ✅ |

**核心能力：** 用户认证（HMAC token，7 天有效）、主播 CRUD、Excel 解析入库、AI 对话（流式）、RAG 知识库（向量检索 + 重排序）、活动推荐（带频次控制）、Supabase 文件存储、管理后台 SPA 托管

---

## 三、技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 | 用户界面构建 |
| 构建工具 | Vite 7 | 开发热更新 + 生产打包 |
| 编程语言 | TypeScript 5 | JavaScript 类型增强 |
| 样式方案 | Tailwind CSS 3 | 原子化 CSS |
| UI 组件（管理后台） | shadcn/ui + Radix UI | 预装 40+ 组件 |
| UI 组件（用户端） | Radix UI | 无样式原语组件 |
| 后端框架 | Express 4 | Node.js Web 服务 |
| 数据库 | Supabase（PostgreSQL） | 云数据库 + 认证 + 存储 |
| 向量扩展 | pgvector | 语义相似度搜索 |
| AI 大模型 | 阿里云百炼（通义千问） | qwen-plus 模型 |
| 向量化模型 | text-embedding-v3 | 1024 维文本向量化 |
| 桌面应用 | Electron | Windows 安装包 |
| 包管理 | pnpm 9.4.0 | monorepo 工作区 |
| 运行时 | Node.js 20 | 服务端运行环境 |

---

## 四、部署方式

### 方式 1：Render（当前生产环境）

```
┌─────────────────────────────────────┐
│              Render 平台             │
├──────────────────┬──────────────────┤
│  zhibotong-api   │  zhibotong-user  │
│  (Node 服务)      │  (静态站点)       │
│  管理后台 + API   │  用户端           │
└──────────────────┴──────────────────┘
```

- 推送到 GitHub → Render 自动构建部署
- 环境变量在 Render 网页控制台配置

### 方式 2：阿里云 ECS 服务器

```
  用户 ──→ :80 ────→ Nginx ──→ 用户端静态页面 + /api 反代
  运营 ──→ :8081 ──→ Nginx ──→ 管理后台 + API（Node :9000）
```

- PM2 管理进程，Nginx 反向代理
- 完整部署文档见 `deploy/README.md`

### 方式 3：GitHub Actions 自动部署

- 推送到 `main` → SSH 到 ECS 自动部署
- PR → 只做构建检查

### 方式 4：Windows 桌面应用（Electron）

- 用户端打包为 `.exe` 安装包

---

## 五、环境变量

### 必需 — Supabase

| 变量名 | 说明 |
|--------|------|
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | 匿名密钥（也用于 token 签名） |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端最高权限密钥 |
| `BUCKET_NAME` | 文件存储桶名称 |

### 必需 — AI 功能

| 变量名 | 说明 |
|--------|------|
| `DASHSCOPE_API_KEY` | 阿里云百炼 API 密钥 |
| `BAILIAN_APP_ID` | 百炼应用 ID |

### 可选 — AI 增强

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DASHSCOPE_MODEL` | 对话模型 | `qwen-plus` |
| `EMBEDDING_MODEL` | 向量化模型 | `text-embedding-v3` |
| `BAILIAN_WORKSPACE_ID` | 百炼工作空间 ID | — |
| `BAILIAN_DEFAULT_INDEX_ID` | 默认知识库索引 ID | — |
| `BAILIAN_ACTIVITY_INDEX_ID` | 活动推荐知识库索引 ID | — |
| `BAILIAN_KB_HIT_MIN_SCORE` | 知识库命中最低分数（0~1） | `0.35` |

### 应用配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `APP_ID` | 应用标识 | — |
| `PORT` | API 服务端口 | `9000` |
| `NODE_ENV` | 运行环境 | `development` |
| `VITE_API_BASE_URL` | 用户端 API 地址 | 开发时自动代理，生产需手动设置 |

### GitHub Actions 部署

| 变量名 | 说明 |
|--------|------|
| `ECS_HOST` | ECS 服务器公网 IP |
| `ECS_USER` | SSH 登录用户名 |
| `ECS_SSH_PRIVATE_KEY` | SSH 私钥 |

---

## 六、数据库表

### 核心表

| 表名 | 用途 |
|------|------|
| `anchor_accounts` | 主播账号（账号名、密码、赛道、标签、兴趣） |
| `chat_sessions` | AI 对话会话 |
| `chat_messages` | 对话消息记录 |
| `knowledge_documents` | 知识库文档 |
| `knowledge_chunks` | 文档向量切片（pgvector 语义搜索） |
| `activity_recommends` | 活动推荐历史 |
| `activity_recommend_counts` | 推荐频次控制 |
| `import_records` | 文件导入记录 |
| `operation_logs` | 操作日志 |
| `profiles` | 用户档案 |

---

## 七、已知问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 无自动化测试 | 改代码后无法自动验证 | 重要改动前手动测试核心流程 |
| 密码明文存储 | 数据泄露风险 | 生产环境应改为哈希加密 |
| 腾讯文档同步未接入 | 配置变量存在但功能不可用 | 如需使用需额外开发 |
| 知识库页面未开放 | 有源码但未注册路由 | 如需使用需在路由中添加 |
| 废弃路由文件 | bookRoutes、knowledgeRoutes 未挂载 | 不影响运行，可忽略 |
| 管理后台页面较少 | 仅有主播管理和导入 | 可根据需求扩展 |

---

## 八、本地开发

```bash
# 安装依赖
pnpm install

# 启动全部服务
pnpm dev:all

# 或单独启动：
pnpm dev:admin    # 管理后台 → http://localhost:5173
pnpm dev:user     # 用户端   → http://localhost:5174
pnpm dev:api      # API 服务 → http://localhost:9000

# 构建
pnpm build        # 构建全部
pnpm build:admin  # 仅管理后台
pnpm build:user   # 仅用户端
pnpm build:api    # 仅 API

# 代码检查
pnpm lint
```

> 首次启动前需配置 `.env` 文件，参考 `services/api/.env.example`

## 九、文档索引

| 文档 | 用途 |
|------|------|
| [docs/SPEC.md](docs/SPEC.md) | 产品规格（模块、路由、设计令牌） |
| [docs/SCAFFOLD.md](docs/SCAFFOLD.md) | admin-web 脚手架约定（改代码前必读） |
| [deploy/README.md](deploy/README.md) | ECS 部署手册（完整步骤 + 踩坑记录） |
| [services/api/CONTACTS_API.md](services/api/CONTACTS_API.md) | 通讯录 API 接口文档 |
