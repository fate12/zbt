# 主播通 Workspace

当前仓库已整理为一个 `pnpm workspace`，按职责拆分为三个应用：

```text
apps/
  admin-web/   # 主播管理后台
  user-web/    # 主播通前端
services/
  api/         # Node/Express API
docs/
  SCAFFOLD.md
  SPEC.md
supabase/
```

## 常用命令

```bash
pnpm install
pnpm dev:admin
pnpm dev:user
pnpm dev:api
pnpm build
pnpm lint
```

## 说明

- `services/api` 当前默认服务 `apps/admin-web/dist`
- 旧的根目录前端源码已经迁移到 `apps/admin-web`
- 文档从根目录收敛到 `docs/`
