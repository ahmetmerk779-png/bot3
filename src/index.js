require('dotenv').config();
const Logger = require('./utils/Logger');
const BotClient = require('./core/BotClient');
const LLMClient = require('./core/LLMClient');
const TaskPlanner = require('./core/TaskPlanner');
const MinecraftServer = require('./mcp/MinecraftServer');
const SwarmManager = require('./core/SwarmManager');
const WebServer = require('./web/server');

async function main() {
  Logger.info('🚀 Mega Bot + Dashboard Başlatılıyor...');

  // 1. Swarm Manager
  const swarm = new SwarmManager();
  await swarm.init();

  // 2. Bot (henüz bağlanmadı, dashboard üzerinden bağlanacak)
  const botClient = new BotClient();

  // 3. MCP Sunucusu (bot hazır olunca çalışacak)
  let mcpServer = null;
  botClient.on('spawn', async () => {
    if (!mcpServer) {
      mcpServer = new MinecraftServer(botClient.bot);
      await mcpServer.start();
      Logger.success('✅ MCP sunucusu aktif.');
    }
  });

  // 4. LLM & Planner
  const llmClient = new LLMClient(process.env.GROQ_API_KEY);
  const planner = new TaskPlanner(botClient, llmClient, mcpServer, swarm);

  // 5. Web Dashboard
  const webServer = new WebServer(botClient, swarm, planner);
  webServer.start();

  // 6. Periyodik görsel hafıza (bot bağlıysa)
  setInterval(async () => {
    if (botClient.connected && botClient.bot) {
      try {
        await swarm.memorizeEnvironment(botClient);
      } catch (e) {}
    }
  }, 30000);

  Logger.success('✅ Sistem hazır. Dashboard üzerinden sunucu bilgilerini girip bağlanın.');
}

main().catch(Logger.error);
