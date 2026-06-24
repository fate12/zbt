---
name: zhibotong-package
description: 主播通用户端 APP 打包技能，面向非开发人员。把「主播通」用户端网页（apps/user-web）打包成 Windows 的 .exe 安装包（exe 安装程序，可双击安装到电脑上运行，连远程已部署的后端 API）。触发词：打包、打exe、生成exe、做exe、出安装包、做成安装包、打包成exe、打包成电脑软件、生成桌面程序、主播通打包、主播通exe、用户端打包。快捷关键字：「主播通打包」→一键把用户端打成 Windows exe 安装包（自动累计版本号、自动处理国内网络与中文路径问题）。
---

# 主播通打包技能（给非开发人员用）

这个技能把「主播通」**用户端网页**（`apps/user-web`）打包成一个 **Windows 的 `.exe` 安装包**——双击就能安装到电脑上、像普通软件一样运行。

> 本文件写给两个读者：**你（使用者）** 看得懂每一步在干什么；**AI 助手** 严格照着执行。
> 原则：拿不准就先问你，绝不自己乱来、不做有风险的动作。
> 打包出来的是一个**容器（Electron 壳）**，里面跑的还是网页；所有数据都走远程已部署的后端 `https://zhibotong-api-v2.onrender.com`，**不需要**在本机起后端服务。

---

## 先懂几个词（大白话术语表）

| 词 | 大白话 |
|---|---|
| 用户端 APP | 主播日常用的那个界面（登录、AI 聊天、活动推荐、知识库），代码在 `apps/user-web` |
| 安装包 / .exe | Windows 上双击就能安装的程序文件，装完后桌面会有「主播通」快捷方式 |
| 打包 | 把网页塞进一个「壳」里，变成能安装的桌面软件 |
| 版本号 | 形如 `1.0.0`，每次打包自动往上加（`1.0.0 → 1.0.1`），用来区分不同批次 |
| Node 20 | 打包必须用这个版本的运行环境（项目硬性要求，版本不对会报错） |
| 英文路径 | 文件夹路径里**不能有中文**（如不能放在「未命名文件夹」里），否则打包会失败 |
| 镜像 | 国内从默认地址下载太慢/下不动，换成「淘宝镜像」就快了 |

---

## 关键字速查（在悟空里直接发这几个词就行）

| 你输入 | 会发生什么 |
|---|---|
| **主播通打包** | 一键打包：准备英文路径环境 → 安装依赖 → 打出带新版本号的 Windows `.exe` 安装包 |
| **主播通打包 调试版** | 同上，但用 `NO_BUMP=1`，**不递增版本号**，反复打同一版用于测试 |
| **改桌面图标** | 把你给的 `.ico` 图标换上后重新打包（见「自定义图标」） |

> 也可以用大白话，比如「把主播通做成 exe」「生成个 Windows 安装包」「打个包」。

---

## 操作：打包成 Windows exe 安装包 ｜ 关键字 `主播通打包`

**你要提供什么**：一般什么都不用提供，直接说「主播通打包」即可。

### ⚠️ 三个必须先知道的坑（助手会自动处理，但你要知道为什么会这样）

1. **Node 必须是 20**：悟空的 shell 里 Node 版本可能是 18 或 24，但 Vite 7 要求 Node ≥ 20.19。Node 不对会报 `crypto.hash is not a function`。→ 助手会主动 `nvm use 20.19.0`。
2. **打包路径不能有中文**：如果项目放在 `…/桌面/未命名文件夹/…` 这种带中文的路径里，打包工具的底层扫描器会报莫名其妙的 `ENOENT ... is-hexadecimal` 错误（文件其实存在）。→ 助手会先把项目**复制到一个纯英文路径** `~/zbt-default` 再打包。
3. **国内下载 Electron 很慢/会超时**：默认从 GitHub 下载，国内会卡死。→ 助手会用**淘宝镜像**（`npmmirror.com`）下载，已在项目 `.npmrc` 里配好。

### 第 1 步：定位源项目

和「运维技能」一样，读 `~/.zhibotong-devops.root` 找到项目根目录（里面有 `apps`、`services`、`pnpm-workspace.yaml`）。找不到就问用户拖文件夹进来。

```bash
[ -f ~/.zhibotong-devops.root ] && cat ~/.zhibotong-devops.root
```

### 第 2 步：准备纯英文路径的打包副本（关键）

因为源项目可能在中文路径里，**复制一份到 `~/zbt-default`（纯英文）专门用来打包**。复制时排除体积大的 `node_modules` 和旧产物（后面用淘宝镜像重装，很快）：

```bash
# SRC = 源项目根目录
rm -rf ~/zbt-default
rsync -a --exclude node_modules --exclude dist_electron --exclude 'apps/*/dist' "$SRC"/ ~/zbt-default/
```

> 这一步每次打包都做（保证用的是最新源码）。复制后体积只有几 MB。

### 第 3 步：切到 Node 20（项目要求 20.x）

> ⚠️ 每条命令都要先加载 nvm 再切版本，否则非交互 shell 会用错版本。

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20.19.0          # 没装过则先 nvm install 20.19.0 --latest-npm
node -v                  # 必须显示 v20.19.0
```

- 机器没装 nvm → 停下告诉用户先装 nvm 并 `nvm install 20.19.0`，**不要**用 18/24 凑合。

### 第 4 步：在英文路径里安装依赖（带淘宝镜像）

```bash
cd ~/zbt-default
corepack enable && corepack prepare pnpm@9.4.0 --activate
pnpm -v                  # 应显示 9.4.0
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
pnpm install
```

- 第一次会下载 Electron 二进制（约 200MB，走镜像几秒到几十秒）；之后 `node_modules` 已存在可跳过 `pnpm install`。

### 第 5 步：一键打包（自动累计版本号 + 出 exe）

```bash
cd ~/zbt-default/apps/user-web
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
pnpm electron:build
```

这一条命令会**依次**做三件事（顺序不能乱）：

1. `node electron/bump-version.cjs` —— 版本号 `patch +1`（如 `1.0.2 → 1.0.3`），写回 `package.json`。
2. `vite build` —— 把网页编译成 `dist/`（**这一步漏了会导致白屏！**）。
3. `electron-builder --win --x64` —— 把 `dist/` + 壳子打包成 Windows NSIS 安装包。

> **版本号控制**（可选环境变量）：
> - 默认 `patch +1`：`1.0.2 → 1.0.3`
> - `BUMP=minor pnpm electron:build`：`1.0.2 → 1.1.0`
> - `BUMP=major pnpm electron:build`：`1.0.2 → 2.0.0`
> - `NO_BUMP=1 pnpm electron:build`：**不递增**，重打当前版本（调试时用，比如连打两次测试）

### 第 6 步：拿到安装包

产物在：

```
~/zbt-default/apps/user-web/dist_electron/主播通 Setup <版本号>.exe
```

例如 `主播通 Setup 1.0.3.exe`（约 78MB）。助手把它**复制一份到源项目的** `apps/user-web/dist_electron/` 方便用户取用：

```bash
mkdir -p "$SRC/apps/user-web/dist_electron"
cp ~/zbt-default/apps/user-web/dist_electron/"主播通 Setup"*.exe "$SRC/apps/user-web/dist_electron/"
```

**怎么算成功**：
- 命令最后看到 `building block map ... 主播通 Setup x.x.x.exe.blockmap` —— 打包成功。
- 检查 `app.asar` 体积 **大于 500KB**（约 535KB）。如果只有几 KB，说明 `dist/` 没打进去 → 装出来是白屏，要回到第 5 步确认先 `vite build` 了。
- 把安装包路径告诉用户，并说明版本号。

---

## 常见错误对照表（助手按这个排查）

| 报错 / 现象 | 原因 | 解决 |
|---|---|---|
| `crypto.hash is not a function` | Node 版本太低（18） | `nvm use 20.19.0` 后重来 |
| `RequestError: connect ETIMEDOUT ... github.com` | 国内下载 Electron 超时 | 加 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 等镜像变量 |
| `ENOENT ... is-hexadecimal`（文件其实存在） | 项目路径含中文 | 必须在 `~/zbt-default` 英文路径打包 |
| 装出来**白屏** | `dist/` 没打进 asar（漏了 `vite build`） | 确认用 `pnpm electron:build`（含 vite build），看 `app.asar` 要 >500KB |
| `port already in use` | 有服务占着端口 | 打包不依赖端口，可忽略；若开发模式 `electron:dev` 才需关掉占用进程 |
| 版本号没变 | 用了 `NO_BUMP=1`，或打的不是最新源 | 正式版去掉 `NO_BUMP`；重新 rsync 源码到 `~/zbt-default` |

---

## 自定义图标（可选）｜ 关键字 `改桌面图标`

默认用 Electron 自带图标。要换成「主播通」自己的图标：

1. 准备一张 **`.ico` 格式**、建议 **256×256 多尺寸** 的图标文件。
2. 放到 `apps/user-web/build/icon.ico`（这个路径和文件名是固定的，工具会自动识别）。
   - 源项目和 `~/zbt-default` 副本里都要放（或 rsync 后再放进去）。
3. 重新执行「第 5 步」打包即可，产物图标会更新。

> 没有 `.ico` 只有 `.png`？让开发帮忙转成 `.ico`（可用在线工具或 `pnpm dlx png-to-ico`），别直接塞 png。

---

## 不签名说明（正常现象，不是错）

打包日志里会出现 `signing is skipped` / `no signing info identified` —— 这是**没买代码签名证书**的正常情况，**不影响使用**。唯一影响：Windows 第一次双击安装时，SmartScreen 会弹「已保护你的电脑」蓝色提示，点 **「更多信息」→「仍要运行」** 即可继续安装。正式对外大规模分发前，建议采购代码签名证书消除该提示。

---

## 安全底线（这些绝对不会做）

- ❌ 不在中文路径里直接打包（会失败）；统一用英文路径 `~/zbt-default` 副本。
- ❌ 不用非 Node 20 的环境凑合打包。
- ❌ 不为了「修问题」去改用户端的业务代码、登录逻辑、接口地址（API 始终连远程 `zhibotong-api-v2.onrender.com`）。
- ❌ 不把 `.env`、密钥、token 等敏感信息打进安装包或写进代码。
- ❌ 不擅自把版本号改成乱七八糟的值；严格用 `bump-version.cjs` 的 semver 递增。
- ✅ 任何拿不准的步骤（比如要不要换图标、要不要递增大版本），**先问你再动手**。
