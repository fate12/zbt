// PM2 进程配置 —— 主播通 API
// 用法（首次）: pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
// 更新（CI 触发）: pm2 reload deploy/ecosystem.config.cjs --update-env
//
// 注意：本服务含 WebSocket（/api/chat）与启动自动建表，必须 fork 单实例，勿开 cluster。
module.exports = {
  apps: [
    {
      name: 'zhibotong-api',
      cwd: __dirname + '/../services/api',   // /opt/zhibotong/services/api
      script: 'dist/index.js',               // tsc 产物（ESM，由 package.json type:module 标识）
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 9000,
      },
      out_file: '../logs/api-out.log',       // /opt/zhibotong/logs（需提前 mkdir）
      error_file: '../logs/api-error.log',
      merge_logs: true,
      time: true,
    },
  ],
}
