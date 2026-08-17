require('dotenv').config();
const WebServer = require('./web/server');
const BotManager = require('./core/BotManager');
const Logger = require('./utils/Logger');

async function main() {
  Logger.info('🚀 Bot Dashboard Başlatılıyor...');
  const botManager = new BotManager();
  const webServer = new WebServer(botManager);
  webServer.start();
  Logger.success('✅ Dashboard hazır. Sunucu bilgilerini girip botu başlatın.');
}

main().catch(Logger.error);
