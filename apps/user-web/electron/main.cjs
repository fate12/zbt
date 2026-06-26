// Electron 主进程 —— 主播通桌面端壳
// 仅作为 user-web 前端的容器，所有 API 走远程已部署后端（http://120.26.97.178）
const { app, BrowserWindow, protocol, session, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');

// 远程 API 主机（用于按需修正 CORS 响应头，避免改服务端）
const API_HOST = '120.26.97.178';
const isDev = !!process.env.VITE_DEV_SERVER_URL;

// 注册自定义协议 app://，使打包后 BrowserRouter 的深链/刷新不致 404
// （file:// 下 History API 刷新子路由会找不到文件）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true },
  },
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: '主播通',
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // API 暂走 ECS 的 http://120.26.97.178（未配 HTTPS），需放行 insecure content，
      // 否则 secure 的 app:// 页面 fetch http 会被混合内容策略拦截。配域名+HTTPS 后可移除。
      webSecurity: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 入口用根路径而非 index.html：BrowserRouter 以 location.pathname 做路由匹配，
    // 若写成 /index.html 会命中 AppRoutes 的兜底 * 路由 → 显示 404 页。
    // 协议处理器对 '/' 已会回退返回 dist/index.html，故页面正常加载且路由为 '/'。
    mainWindow.loadURL('app://./');
  }

  // 调试：ZBT_DEBUG=1 时把渲染层日志/加载失败打到主进程 stdout，便于排查白屏等问题
  if (process.env.ZBT_DEBUG) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message}${sourceId ? ` (${sourceId}:${line})` : ''}`);
    });
    mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      console.log(`[did-fail-load] code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.log('[render-process-gone]', JSON.stringify(details));
    });
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[did-finish-load] 页面加载完成');
    });
  }

  // 外链在系统浏览器打开，不在壳内跳转
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) {
      require('electron').shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// app:// 协议处理器：从 dist 提供静态资源，缺失资源回退 index.html（SPA 路由）
function registerAppProtocol() {
  const distRoot = path.resolve(__dirname, '..', 'dist');
  protocol.handle('app', (request) => {
    const reqUrl = new URL(request.url);
    let relative = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
    if (relative === '') relative = 'index.html';

    let filePath = path.join(distRoot, relative);
    // 防止路径穿越
    if (!filePath.startsWith(distRoot)) {
      return new Response('Forbidden', { status: 403 });
    }
    // 文件不存在或为目录 → 回退到 index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distRoot, 'index.html');
    }
    return net.fetch(url.pathToFileURL(filePath).toString());
  });
}

// 修正远程 API 的 CORS：桌面端 origin 是 app://.，服务端 ACAO 可能不包含它。
// 由于鉴权走 Authorization 头（非 cookie），这里直接给 API 响应注入 ACAO:* 即可放行。
function installCorsPassthrough() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    if (details.url.includes(API_HOST)) {
      headers['access-control-allow-origin'] = ['*'];
      if (headers['access-control-allow-credentials']) {
        delete headers['access-control-allow-credentials'];
      }
    }
    callback({ responseHeaders: headers });
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  installCorsPassthrough();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 单实例：二次启动聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
