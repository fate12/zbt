# 主播通 · 阿里云 ECS 部署手册（实战版）

> 这份文件记录了**完整、实际验证过**的部署流程 + **所有踩过的坑**。
> **下次重新部署（换正式服务器 / 重装），读这个文件，照着步骤 1→10 做即可。**
>
> 架构：一台 ECS 全托管 —— user-web（nginx 静态）、admin + API（Node 9000，nginx 反代）。文件存储用 Supabase Storage（不在 ECS）。

---

## 前置
- 阿里云账号
- GitHub 仓库 `fate12/zbt`（**public**，clone 免认证）
- API 密钥（从 Render 环境变量 / Supabase / 百炼控制台拿）

## 步骤 1：买 ECS
阿里云控制台 → 云服务器 ECS → 创建实例：
- 计费：**按量付费**（试用/测试，随时可释放）
- 地域：任意（华东1杭州 等）
- 规格：**2核4G**（经济型 e / u1；vite 构建吃内存，2G 会 OOM）
- 镜像：**Ubuntu 22.04**
- 公网 IP：✅ 分配
- 带宽：按使用流量，5Mbps
- 登录方式：**密钥对** → 「创建密钥对」→ **下载 `.pem` 保管好** → 选中
- 安全组：先默认，**第 9 步专门配**（坑见后）

## 步骤 2：连服务器
实例列表 → 点实例 → 「**远程连接**」→ **Workbench 远程连接** → 进黑色终端（`root@...#`）

## 步骤 3：装环境（整段复制粘贴）
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm config set registry https://registry.npmmirror.com
corepack enable
corepack prepare pnpm@9.4.0 --activate
npm install -g pm2
apt install -y nginx
node -v && pnpm -v && pm2 -v && nginx -v   # 验证四个版本号
```

## 步骤 4：拉代码
```bash
mkdir -p /opt/zhibotong
git clone https://github.com/fate12/zbt.git /opt/zhibotong
cd /opt/zhibotong
git pull
ls deploy     # 应看到 deploy-api.sh / ecosystem.config.cjs / nginx.conf / README.md
```

## 步骤 5：配 .env（⚠️ 必须用 nano，坑③）
```bash
nano /opt/zhibotong/services/api/.env
```
在 nano 里粘贴（KEY 见 `services/api/.env.example`，**值从 Render 环境变量复制**）：
```
DASHSCOPE_API_KEY=<从 Render 复制>
DASHSCOPE_MODEL=qwen-plus
EMBEDDING_MODEL=text-embedding-v3
BAILIAN_APP_ID=<从 Render>
BAILIAN_ACTIVITY_INDEX_ID=<从 Render>
BAILIAN_DEFAULT_INDEX_ID=<从 Render>
BAILIAN_WORKSPACE_ID=
BAILIAN_KB_HIT_MIN_SCORE=0.35
SUPABASE_URL=<从 Render>
SUPABASE_ANON_KEY=<从 Render>
SUPABASE_SERVICE_ROLE_KEY=
BUCKET_NAME=zbt
APP_ID=<从 Render>
NODE_ENV=production
```
**Ctrl+O → 回车**（保存）→ **Ctrl+X**（退出），然后验证：
```bash
cat /opt/zhibotong/services/api/.env   # 必须 13 行，每行一个 KEY，不黏连
```

## 步骤 6：装依赖 + 构建
```bash
cd /opt/zhibotong
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:api && pnpm build:admin && pnpm build:user
```

## 步骤 7：启动 API（⚠️ 必须 cd 到 services/api，坑②）
```bash
pm2 delete zhibotong-api 2>/dev/null
cd /opt/zhibotong/services/api
pm2 start dist/index.js --name zhibotong-api
pm2 save
sleep 2
pm2 logs zhibotong-api --lines 15 --nostream
```
日志**不应报错**；若报 `supabaseUrl is required` → .env 没读到（回步骤 5 用 nano 重写）。
```bash
curl http://127.0.0.1:9000/api/health   # 应返回 {"status":"ok"}
```

## 步骤 8：配 nginx
```bash
rm -f /etc/nginx/sites-enabled/default     # 删默认站，避免占 80
cp /opt/zhibotong/deploy/nginx.conf /etc/nginx/conf.d/zhibotong.conf
nginx -t && systemctl reload nginx
```

## 步骤 9：安全组放行（⚠️ 必须在「绑定的默认安全组」，坑①）
ECS → 实例 → 点实例 → 安全组 → 点**这台实例绑定的「默认安全组」** → 入方向 → 手动添加，加 3 条（协议 **TCP** / 源 **0.0.0.0/0** / **IPv4**）：
- `22/22`（SSH）
- `80/80`（user-web 网页）
- `8081/8081`（admin 管理后台）

> 9000 **不要**对公网（只本机 127.0.0.1）。

## 步骤 10：验证访问
- user-web：`http://<公网IP>/`
- admin：`http://<公网IP>:8081/`
- API：`http://<公网IP>/api/auth/me`（返回 JSON）

---

# ⚠️ 踩过的坑（重点！）

### 坑①：安全组"加了规则但不生效"
- **现象**：80/8081 加了，外网还是超时。
- **原因**：规则加到了别的安全组，不是实例**绑定**的那个。
- **解决**：从「实例详情 → 安全组」进**绑定的默认安全组**，在那里加（步骤 9）。

### 坑②：API 报 `supabaseUrl is required` 崩溃
- **现象**：pm2 start 后日志报错，API 反复崩，/api 返回 502。
- **原因**：代码 `import 'dotenv/config'` 读的是**当前目录**的 .env；启动目录不对就找不到 .env → SUPABASE_URL 空 → 崩。
- **解决**：**必须 `cd /opt/zhibotong/services/api` 再 `pm2 start dist/index.js`**（步骤 7）。

### 坑③：Workbench 粘贴会"吃换行 + 截断长命令"
- **现象**：用 `printf '...\n...'` 或多个 `echo` 写 .env，换行全丢（13 行黏成一坨）；用 base64 长命令被截断。
- **原因**：阿里云 Workbench 终端的粘贴机制问题。
- **解决**：**写 .env 一律用 `nano` 编辑器**（步骤 5），粘贴纯文本会保留换行。

### 坑④：OSS 默认域名会"强制下载"
- **现象**：想用 OSS 自带域名托管网页，浏览器直接下载、不渲染。
- **原因**：阿里云规定 OSS 默认域名访问强制下载，要在线看必须绑**已备案的自定义域名**。
- **解决**：本项目用 ECS 全托管（nginx 发静态），不用 OSS。OSS bucket 闲置，以后有备案域名再考虑。

---

# 常用运维命令
```bash
pm2 status                                   # 看 API 状态（online？restarts 涨？）
pm2 logs zhibotong-api --lines 50 --nostream # 看日志
pm2 restart zhibotong-api                    # 重启 API
systemctl reload nginx                       # 改 nginx 配置后重载
curl http://127.0.0.1:9000/api/health        # 验证 API
```

# 更新代码后重新部署（手动）
```bash
cd /opt/zhibotong && git pull
pnpm build:api && pnpm build:admin && pnpm build:user
cd /opt/zhibotong/services/api && pm2 restart zhibotong-api
```
（配好 GitHub Actions 后，push 代码会自动执行这步，见下方）

---

# 验证清单
- [ ] `http://<IP>/` 网页打开
- [ ] `http://<IP>/api/auth/me` 返回 JSON
- [ ] `http://<IP>:8081/` 管理后台打开
- [ ] `pm2 status`：zhibotong-api **online**，restarts 不涨
- [ ] 浏览器登录成功

---

## 下次重新部署
换正式服务器时，从头照**步骤 1→10** 做一遍。代码在 GitHub，密钥从 Render/控制台拿，半小时搞定。
**记住 4 个坑**（安全组绑定的组、pm2 在 services/api 启动、.env 用 nano、OSS 不能直接用），就不会重蹈覆辙。

## GitHub Actions 自动部署（可选，配好后 push 即部署）
1. 在 GitHub 仓库 Settings → Secrets 加 3 个：
   - `ECS_HOST` = 公网 IP
   - `ECS_USER` = `root`（Workbench 登录名）
   - `ECS_SSH_PRIVATE_KEY` = 创建 ECS 时下载的 `.pem` 私钥**完整内容**
2. 以后 push 到 main，GitHub 会自动 SSH 到 ECS 跑 `deploy/deploy-api.sh`（git pull + build + pm2 reload）
> ⚠️ 注意：CI 通过 SSH 执行时，也要确保在 `services/api` 目录重启（`deploy-api.sh` 已处理）。
