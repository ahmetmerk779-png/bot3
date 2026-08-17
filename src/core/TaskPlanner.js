const Logger = require('../utils/Logger');

class TaskPlanner {
  constructor(bot, llm, mcpServer) {
    this.bot = bot;
    this.llm = llm;
    this.mcp = mcpServer;
    this.isExecuting = false;
  }

  async executeGoal(goal, context = {}) {
    if (this.isExecuting) return Logger.warn('Zaten bir görev yürütülüyor.');
    this.isExecuting = true;
    Logger.info(`🎯 Hedef: ${goal}`);

    try {
      const pos = this.bot.entity.position;
      const state = {
        position: `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`,
        health: Math.round(this.bot.entity.health),
        food: Math.round(this.bot.entity.food),
        inventory: this.bot.inventory.items().map(i => `${i.name}x${i.count}`).join(', ') || 'boş',
      };

      const prompt = `
        Kullanıcı şu hedefi verdi: "${goal}"
        Şu anki durumun: ${JSON.stringify(state)}
        
        Eğer bu hedef için yapabileceğin bir şey varsa, sadece JSON formatında cevap ver:
        {
          "action": "chat" veya "go_to" veya "dig" veya "craft" veya "inventory" veya "follow",
          "params": { ... },
          "message": "Yapmak istediğin eylemle ilgili kısa bir açıklama"
        }
        Eğer hedef zaten tamamlandıysa veya bir eylem gerekmiyorsa "action" alanını "done" yap.
        
        Sadece JSON çıktısı ver, başka metin yazma.
      `;

      const response = await this.llm.ask(prompt);
      let plan;
      try { plan = JSON.parse(response); } catch (e) { plan = { action: 'chat', params: { message: response } }; }

      if (plan.action === 'done') {
        this.bot.chat('✅ Hedef tamamlandı.');
        Logger.success('Hedef tamamlandı.');
        this.isExecuting = false;
        return;
      }

      // Eylemi gerçekleştir
      await this.executeAction(plan);

    } catch (err) {
      Logger.error('Planlama hatası:', err.message);
      this.bot.chat('❌ Bir hata oluştu.');
    }

    this.isExecuting = false;
  }

  async executeAction(plan) {
    const { action, params } = plan;
    switch (action) {
      case 'chat':
        this.bot.chat(params.message || 'Tamam.');
        break;
      case 'go_to': {
        const { x, y, z } = params;
        const target = new Vec3(x, y, z);
        const mcData = require('minecraft-data')(this.bot.version);
        const { Movements } = require('mineflayer-pathfinder');
        const move = new Movements(this.bot.bot, mcData);
        this.bot.bot.pathfinder.setMovements(move);
        await this.bot.bot.pathfinder.goto(target);
        this.bot.chat(`📍 (${x}, ${y}, ${z}) gidildi.`);
        break;
      }
      case 'dig': {
        const blockName = params.blockName || 'stone';
        const mcData = require('minecraft-data')(this.bot.version);
        const blockType = mcData.blocksByName[blockName];
        if (!blockType) { this.bot.chat(`❌ ${blockName} geçerli değil.`); break; }
        const block = this.bot.findBlock({ matching: blockType.id, maxDistance: 32 });
        if (!block) { this.bot.chat(`❌ ${blockName} bulunamadı.`); break; }
        await this.bot.bot.collectBlock.collect(block);
        this.bot.chat(`✅ ${blockName} kazıldı.`);
        break;
      }
      case 'inventory': {
        const items = this.bot.inventory.items();
        if (items.length === 0) this.bot.chat('📭 Envanter boş.');
        else {
          const list = items.map(i => `${i.name} x${i.count}`).join(', ');
          this.bot.chat(`📦 Envanter: ${list}`);
        }
        break;
      }
      default:
        this.bot.chat(`❌ Bilinmeyen eylem: ${action}`);
    }
  }
}

module.exports = TaskPlanner;
