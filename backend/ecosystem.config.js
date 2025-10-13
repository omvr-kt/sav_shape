module.exports = {
  apps: [
    {
      name: 'sav-backend',
      script: './src/server.js',
      cwd: '/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend',
      instances: 1,
      exec_mode: 'fork',

      // ============================================
      // Configuration de redémarrage automatique ULTRA-ROBUSTE
      // ============================================
      autorestart: true,              // Toujours redémarrer en cas d'arrêt
      watch: false,                   // Désactivé pour éviter les redémarrages intempestifs
      max_memory_restart: '500M',     // Redémarrer si la mémoire dépasse 500M

      // Gestion des crashs et redémarrages
      min_uptime: '10s',              // Temps minimum avant de considérer le démarrage réussi
      max_restarts: 50,               // Nombre maximum de redémarrages en 1 minute
      restart_delay: 2000,            // Délai entre chaque redémarrage (2s)
      exp_backoff_restart_delay: 100, // Augmentation progressive du délai entre redémarrages

      // Timeouts
      kill_timeout: 5000,             // Temps d'attente avant SIGKILL (5s)
      listen_timeout: 10000,          // Temps d'attente pour que l'app écoute (10s)
      wait_ready: false,              // Ne pas attendre le signal ready

      // Variables d'environnement
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 5000,
        TZ: 'Europe/Paris'
      },

      // ============================================
      // Configuration des logs
      // ============================================
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_file: 'logs/pm2-combined.log',
      time: true,                     // Ajouter timestamps aux logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,               // Fusionner les logs en mode cluster

      // ============================================
      // Options avancées de stabilité
      // ============================================
      force: true,                    // Forcer le démarrage même si déjà en cours

      // Gestion de la mémoire et des fuites
      node_args: [
        '--max-old-space-size=450'    // Limiter la heap Node.js à 450M
      ],

      // Événements et hooks
      post_update: ['npm install'],   // Réinstaller les dépendances après update

      // Ignore les erreurs de watch (au cas où)
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '*.log'
      ]
    }
  ]
};