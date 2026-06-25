#!/usr/bin/env bash
# ECS 上 API + admin-web 部署脚本（由 GitHub Actions 通过 SSH 触发）。
#
# 前提（首次手动完成，见 deploy/README.md）：
#   - 本仓库已 git clone 到 /opt/zhibotong
#   - 已安装 Node 20 + pnpm@9.4.0 + pm2
#   - services/api/.env 已配好真实密钥（.env 在 .gitignore，git reset 不会动它）
#   - 已执行 pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
set -euo pipefail

cd /opt/zhibotong

echo "==> 拉取最新代码"
git fetch --all --prune
git reset --hard origin/main

echo "==> 安装依赖（--ignore-scripts 避开 husky/electron）"
pnpm install --frozen-lockfile --ignore-scripts

echo "==> 构建 api、admin-web、user-web"
pnpm build:api
pnpm build:admin
pnpm build:user

echo "==> 重启 api（pm2 零停机；必须 cd 到 services/api，否则 dotenv 读不到 .env）"
cd /opt/zhibotong/services/api
pm2 reload zhibotong-api --update-env

echo "==> 部署完成"
pm2 status
