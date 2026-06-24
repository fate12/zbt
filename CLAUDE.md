# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库概览

**主播通 Workspace**（`zhibotong-workspace`）—— 一个 pnpm monorepo，服务于直播主播管理产品。包含三个 package：管理后台、用户端 Web、以及一个同时托管管理后台 SPA 的 Node API。

```
apps/admin-web/   @zhibotong/admin-web  — 主播管理后台（管理端 SPA）
apps/user-web/    @zhibotong/user-web   — 主播通前端（用户端 Web，静态部署）
services/api/     @zhibotong/api        — Node/Express API，同时托管 admin-web/dist
```

- **工具链**：Node `20.x`（见 `.node-version`），pnpm `9.4.0`（通过 corepack），所有 package 均为 `"type": "module"`（ESM）。
- **规格文档**：`docs/SPEC.md`（产品规格：模块、路由、设计令牌 —— *UI 需求的权威来源*）与 `docs/SCAFFOLD.md`（admin-web 脚手架约定 —— 改 `apps/admin-web/src` 前必读）。
- **数据库**：Supabase（Postgres + Storage）。表结构在 `supabase/migration/*.sql`（带编号）与 `supabase/tables/`。

## 常用命令

除特别说明外，均在仓库根目录执行。

```bash
pnpm install
pnpm dev:admin          # admin-web（Vite，/api 代理到 :9000）
pnpm dev:user           # user-web（Vite，端口 5174，/api 代理到 :9000）
pnpm dev:api            # services/api（tsx watch）
pnpm dev:all            # 三个并行启动
pnpm build              # 构建所有 package
pnpm build:admin / build:user / build:api
pnpm lint               # 两个前端 ESLint（api 无 lint 脚本）

# 单 package 内（在对应目录下）：
pnpm dev / pnpm build / pnpm lint / pnpm preview
```

任何 package 都**没有配置测试运行器** —— 不要臆造测试命令。

两个 Vite dev server 都把 `/api` 代理到 `http://localhost:9000`；全栈联调时需同时运行 `pnpm dev:api` 与对应前端。

## 架构

### API 服务（`services/api`）—— 集成中枢

`index.ts` 是组合根。其中几处**中间件顺序约束是承重的**（每处在 `index.ts` 都有注释说明，改动时务必保留）：

1. `/api/storage`（multer multipart）必须挂在 `express.json()` **之前**，否则 body parser 会消费请求流、导致上传失败。
2. `createTokenInjectionMiddleware()` 必须在 `express.static()` **之前**运行，否则静态中间件直接返回 `index.html`，跳过 token 注入。
3. `app.use('/api', need_login)` 对 `/api/*` 全局加鉴权（挂在 static + token 注入**之后**）。

API 从 `apps/admin-web/dist` 提供管理后台 SPA（`resolveAdminDistRoot()` 探测两个相对路径，以兼容源码运行与 `tsc` 输出到 `services/api/dist` 后运行两种场景）。启动时调用 `ensureChatTables()` / `ensureActivityRecommendTable()` 自动建表。

**鉴权（`_core/auth.ts` → `need_login`）**：从 `Authorization` 头 *或* `access_token` cookie 取 Bearer token，然后按顺序尝试两条校验路径：
- **自定义签名 token**（`auth-service.ts verifyCustomToken`，用 `SUPABASE_ANON_KEY` 作为 HMAC 密钥签名，7 天有效期）—— 由 `/api/auth/login` 在主播通 APP 登录流程中签发。
- **Supabase JWT**（通过 `supabase.auth.getUser`）。

成功后挂载 `req.user`（`UserContext`，见 `lib/user-context.ts`）与 `req.supabase`（用调用方 token 限定的客户端，故 RLS 生效）。即使 token 缺失/失败，也会拿到一个 **anon-key Supabase 客户端**，由 RLS 控制匿名读权限。

**免登白名单**：`auth.ts` 中的 `PUBLIC_ROUTES` 是标记免登接口的唯一入口。模式支持 `:param`、`*`（单段）、`**`（多段），以及按方法限定（如 GET 免登、DELETE 需登录）。当前免登：`/health`、`/auth/login`、`/auth/me`、`/chat/**`。未登录的免登请求会得到确定性访客身份 `free_visitor_{APP_ID}`。

**路由注册**：`index.ts` 仅挂载以下路由 —— `/api/anchors`、`/api/import`、`/api/auth`、`/api/chat`、`/api/activity-recommend`，以及 `/api/storage`。**`routes/bookRoutes.ts` 与 `routes/knowledgeRoutes.ts` 虽存在但未被注册** —— 除非本次任务就是要把它们接上，否则视作废弃/未用代码。

**AI / RAG 层**（均在 `services/api/services/`，环境变量走 `_core/env.ts` 的 `ENV`）：
- `bailian-app-service.ts` —— 阿里云百炼 DashScope 应用对话（流式）。
- `knowledge-base-service.ts` —— 基于百炼知识索引的 RAG 检索（`BAILIAN_DEFAULT_INDEX_ID`、`BAILIAN_ACTIVITY_INDEX_ID`）。
- `chat-service.ts` —— 聊天会话/消息持久化 + RAG 编排。
- `activity-recommend-service.ts` + `activity-recommend-count-service.ts` —— 活动推荐，带按用户的频次上限，本地按「板块」精确匹配知识索引。

`ENV`（`_core/env.ts`）是所有三方配置的**唯一来源**，按 provider 分组。每个变量的含义见 `services/api/.env.example`。除健康检查外必需：Supabase 三件套 + `APP_ID`；AI 功能还需 DashScope/百炼相关变量。

### 前端应用

两者均为 **React 18 + Vite 7 + TypeScript 5 + Tailwind CSS 3**，`@/*` → `./src/*` 别名（在 `tsconfig.app.json` 与 `vite.config.ts` 中均已配置）。ESLint 9 flat config 在仓库根 `eslint.config.js`；`@typescript-eslint/no-explicit-any` 与 `no-unused-vars` 均**关闭**。

**`admin-web`** 额外使用 shadcn/ui（Radix 原语在 `src/components/ui/`）、Recharts、next-themes。是管理后台（主播、活动、导入、统计、同步、设置，详见 `docs/SPEC.md`）。按 `docs/SCAFFOLD.md`：所有 shadcn/ui 组件已预装（不要重新生成）；全局样式/CSS 变量只写在 `src/app.css`（不要再建其他 css 文件）；`app.tsx` 中的 `AppProviders` + `BrowserRouter` 不可移除；`main.tsx` 副作用导入 `ai-app-client`，它会注入全局 fetch 拦截器。`lib/auth.ts` 取 token 时优先 `window.__SUPABASE_ACCESS_TOKEN__`，其次 `access_token` cookie；API 调用走 `lib/api.ts` 的 `apiFetch`。

**`user-web`** 是轻量公开应用（登录、聊天、活动推荐、知识库页面）。**不**使用 `ai-app-client`；自带 `lib/api.ts`（`resolveApiUrl` / `apiFetch`）。API base 解析：环境变量 `VITE_API_BASE_URL`，生产环境回退到 `https://zhibotong-api-v2.onrender.com`，开发环境回退到同源（`''`，依赖 Vite 代理）。token 来自 `lib/auth.ts` 的 `getToken()`。

## 部署（Render）

`render.yaml` 定义两个服务：
- **`zhibotong-api-v2`**（Node web）：构建 `admin-web` + `api`，运行 `cd services/api && node dist/index.js`。密钥（Supabase、DashScope/百炼、APP_ID）为 Render 侧环境变量（`sync: false`）。
- **`zhibotong-user`**（static）：构建 `user-web`，发布 `apps/user-web/dist`，SPA rewrite `/* → /index.html`。部署时需在此设置 `VITE_API_BASE_URL`。

构建用 `corepack` 锁定 `pnpm@9.4.0`，并加 `--ignore-scripts`（husky 此前曾破坏 Render 部署 —— CI 中请保持禁用脚本）。

## 约定

- 本仓库内的文件/目录名与注释为中文 —— 改动时请沿用该风格。
- `.npmrc` 把 registry 锁定到 `https://registry.npmmirror.com`（淘宝镜像）；不要"修正"成 npmjs。
- migration 带编号（`supabase/migration/0NN_*.sql`）；新增 schema 应沿用编号，并尽量幂等（`IF NOT EXISTS`），因为 API 启动时也会自动建核心表。
