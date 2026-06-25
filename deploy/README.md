# 主播通 · 阿里云 ECS 部署指南

user-web、admin-web、API **全部跑在一台阿里云 ECS** 上。先跑通用公网 IP,以后有域名再绑。

CI 自动部署见 [`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)。

## 架构（ECS 全托管）
```
ECS（Linux）
├─ Node(127.0.0.1:9000)  ── /api/*  +  admin-web（含 token 注入 + SPA fallback）
└─ Nginx
   ├─ :80   /        → user-web 静态（apps/user-web/dist）
   │        /api/    → 反代 Node
   └─ :8081 /        → 反代 Node（admin-web + 它的 /api）
```
- **user-web**：`http://<ECS_IP>/`（Nginx 直接发静态文件）
- **admin**：`http://<ECS_IP>:8081/`
- **API**：user-web 同源调 `/api`，不用单独地址
- **文件存储**：沿用 Supabase Storage（本次不动）

> OSS bucket(`zbt-user`)已开但暂不用——OSS 默认域名会强制下载，需自有备案域名才能当网站用。**以后有域名可切回 OSS+CDN**，代码已预留切换余地。

---

## 一、买 ECS
- 阿里云控制台 → 云服务器 ECS → 创建实例
- 系统：**Ubuntu 22.04**
- 规格：2 核 4G 起步够用（按预算）
- **带宽**：选「按使用流量」或固定带宽（user-web 静态走 ECS 流量，别太小）
- 安全组开放：**22(SSH)、80、8081**（**9000 不要对公网**）
- 记下：**公网 IP**、**SSH 登录用户名**（如 `root` / `ubuntu`）、**SSH 密钥或密码**

## 二、ECS 环境初始化（一次性）
SSH 登录 ECS 后执行：
```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# pnpm 9.4.0
corepack enable && corepack prepare pnpm@9.4.0 --activate
# pm2 + nginx
sudo npm install -g pm2
sudo apt install -y nginx

# 拉代码
sudo mkdir -p /opt/zhibotong && sudo chown $USER /opt/zhibotong
git clone <仓库地址> /opt/zhibotong
cd /opt/zhibotong

# API 密钥（复制真实值，绝不提交）
cp services/api/.env.example services/api/.env
vim services/api/.env          # 填 Supabase / 百炼 / APP_ID 等

mkdir -p logs                  # PM2 日志目录

# 构建 + 启动
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:api && pnpm build:admin && pnpm build:user
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup        # 开机自启

# Nginx
sudo cp deploy/nginx.conf /etc/nginx/conf.d/zhibotong.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 三、配置 GitHub Secrets（只需 3 个）
仓库 **Settings → Secrets → Actions**：

| Secret | 值 |
|---|---|
| `ECS_HOST` | ECS 公网 IP |
| `ECS_USER` | SSH 用户（`root` / `ubuntu`） |
| `ECS_SSH_PRIVATE_KEY` | SSH 私钥（**完整内容**，含 `-----BEGIN…` / `-----END…` 行） |

> 用密码登录 ECS 的话，需改用密钥：在 ECS 放公钥、私钥填进 Secret（GitHub 只支持密钥免密 SSH）。
> API 的 `.env` 放 ECS，不进 GitHub。

## 四、首次部署
1. 把本分支（`migrate/oss-deploy`）改动**合并到 main**（ECS 的 `git pull origin/main` 需 main 上已有 `deploy/`）
2. push 到 main → GitHub Actions 的 `deploy` job 自动跑：SSH 到 ECS → git pull → build 全部 → pm2 reload
3. 等 Actions 转绿

## 五、验证
- **user-web**：`http://<ECS_IP>/` 打开网页；刷新 `/chat` 等子路由不 404
- **admin**：`http://<ECS_IP>:8081/`；登录回跳带 `?access_token=` 时注入正常
- **API**：`curl http://<ECS_IP>/api/health` 返回 `{"status":"ok"}`
- **上传**：走 Supabase Storage，行为同迁移前

## 六、收尾待办
- [ ] 桌面端打包：更新 `apps/user-web/package.json` 的 `electron:dev`/`electron:build` API 域名（当前仍为 `onrender`，迁移后换成 `http://<ECS_IP>` 或域名）
- [ ] 稳定后停用 Render 两个服务
- [ ] 有域名后：给 ECS 绑域名 + HTTPS（certbot），并可选切回 OSS+CDN

## 七、常见坑
- **pm2 启动失败** → 看 `logs/api-error.log`；多是 `.env` 缺变量
- **user-web 404/空白** → 确认 ECS 上 `pnpm build:user` 已产出 `apps/user-web/dist`
- **admin 502** → Node 没起；`pm2 status` 看，`pm2 logs` 排查
- **SSH 连不上** → 安全组 22 端口、密钥是否正确
- **端口不通** → 安全组确认 80/8081 放通
