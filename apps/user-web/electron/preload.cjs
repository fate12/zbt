// 预加载脚本 —— 当前 user-web 无需任何 Node 能力，保持空桥接。
// contextIsolation 开启，渲染层与 Node 完全隔离；如后续需要 IPC，在此通过 contextBridge 暴露。
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__ZBT_DESKTOP__', {
  isDesktop: true,
  platform: process.platform,
});
