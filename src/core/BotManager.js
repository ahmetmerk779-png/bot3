// src/core/BotManager.js
const BotClient = require('./BotClient');
const LLMClient = require('./LLMClient');
const TaskPlanner = require('./TaskPlanner');
const MinecraftServer = require('../mcp/MinecraftServer');
const SwarmManager = require('./SwarmManager');
const Logger = require('../utils/Logger');

class BotManager {
  constructor() {
    this.bot = null;
    this.planner = null;
    this.swarm = null;
    this.mcpServer = null;
    this.isRunning = false;
    this.config = null;
  }

  async startBot(config) {
    if (this.isRunning) {
      throw new Error('Bot zaten çalışıyor.');
    }

    this.config = config;
    Logger.info(`🚀 Bot başlatılıyor: ${config.username} -> ${config.host}:${config.port}`);

    // 1. Swarm Manager
    this.swarm = new SwarmManager();
    await this.swarm.init();

    // 2. BotClient
    this.bot = new BotClient({
      host: config.host,
      port: config.port,
      username: config.username,
    });
    await this.bot.start();
    this.swarm.registerBot(this.bot);

    // 3. MCP Sunucusu
    this.mcpServer = new MinecraftServer(this.bot);
    await this.mcpServer.start();

    // 4. LLM ve Planner
    const llmClient = new LLMClient(config.apiKey);
    this.planner = new TaskPlanner(this.bot, llmClient, this.mcpServer, this.swarm);

    // 5. Sohbet dinleyicisi (doğal dil, ! işareti yok)
    this.bot.on('chat', async (username, message) => {
      if (username === this.bot.username) return;
      // Eğer mesaj "ara" ile başlıyorsa web arama yap
      if (message.startsWith('ara ')) {
        const query = message.slice(4);
        const result = await this.mcpServer.server.callTool('web_search', { query });
        if (result && result.content) {
          this.bot.chat(result.content[0].text.substring(0, 200));
        }
        return;
      }
      // Normal komut (doğal dil)
      await this.planner.executeGoalWithMCP(message, { sender: username });
    });

    // 6. Periyodik görsel hafıza
    setInterval(async () => {
      if (this.bot && this.bot.entity) {
        try {
          await this.swarm.memorizeEnvironment(this.bot);
        } catch (e) { /* sessiz */ }
      }
    }, 30000);

    this.isRunning = true;
    Logger.success('✅ Bot başarıyla başlatıldı.');
  }

  async stopBot() {
    if (!this.isRunning) return;
    Logger.info('⏹️ Bot durduruluyor...');
    if (this.bot) {
      this.bot.end();
      this.bot = null;
    }
    this.planner = null;
    this.mcpServer = null;
    this.swarm = null;
    this.isRunning = false;
    Logger.success('✅ Bot durduruldu.');
  }

  async sendCommand(command) {
    if (!this.isRunning || !this.bot) {
      throw new Error('Bot çalışmıyor.');
    }
    // Bot'un chat event'ini tetikle (sanki oyuncu yazmış gibi)
    this.bot.emit('chat', 'Dashboard', command);
  }

  getStatus() {
    if (!this.isRunning || !this.bot || !this.bot.entity) {
      return { online: false };
    }
    const pos = this.bot.entity.position;
    return {
      online: true,
      username: this.bot.username,
      position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
      health: Math.round(this.bot.entity.health),
      food: Math.round(this.bot.entity.food),
      isProcessing: this.planner ? this.planner.isExecuting : false,
      memoryCount: this.swarm ? this.swarm.memory.count() : 0
    };
  }

  async searchMemory(query) {
    if (!this.swarm) return [];
    const all = await this.swarm.memory.table.query().execute();
    return all.filter(r => r.text.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
  }
}

module.exports = BotManager;
