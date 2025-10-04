module.exports = {
  apps: [
    {
      name: 'sav-backend',
      script: './src/server.js',
      cwd: '/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 5000
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_file: 'logs/pm2-combined.log',
      time: true,
      restart_delay: 3000,
      min_uptime: 5000,
      max_restarts: 100,
      kill_timeout: 5000,
      exp_backoff_restart_delay: 100,
      wait_ready: false,
      listen_timeout: 10000
    }
  ]
};