// PM2 process manager config.
//
// Запуск:
//   pm2 start ecosystem.config.js
//   pm2 save                          # сохранить чтобы рестартилось при ребуте
//
// Управление:
//   pm2 status
//   pm2 logs messanger
//   pm2 restart messanger
//   pm2 stop messanger
//   pm2 reload messanger              # zero-downtime restart
//
module.exports = {
  apps: [
    {
      name: "messanger",
      script: "server.js",
      cwd: "/opt/messanger",
      // Singleton mode (1 экземпляр) — мы ведём stateful WebSocket-сессии
      // в Socket.io, и кластер требует sticky-session балансировки.
      // Если упрёмся в CPU — добавим Redis adapter и поднимем instances.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/pm2/messanger-error.log",
      out_file: "/var/log/pm2/messanger-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Не стартовать заново больше 5 раз за минуту — если падает циклически,
      // пусть упадёт совсем и админ увидит.
      max_restarts: 5,
      min_uptime: "10s",
    },
  ],
};
