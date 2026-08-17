// src/index.js
require('dotenv').config();
const WebServer = require('./web/server');
const BotManager = require('./core/BotManager');
const Logger = require('./utils/Logger');

async function main() {
  Logger.info('🚀 Mega Bot Dashboard Başlatılıyor...');

  // BotManager (botu yönetir, başlangıçta bot çalışmaz)
  const botManager = new BotManager();

  // Web sunucusunu başlat (BotManager'ı enjekte et)
  const webServer = new WebServer(botManager);
  webServer.start();

  Logger.success('✅ Dashboard hazır. Lütfen sunucu bilgilerinizi girip botu başlatın.');
}

main().catch(Logger.error);
