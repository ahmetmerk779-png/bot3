const Logger = require('../utils/Logger');

class TaskPlanner {
  constructor(botClient, llmClient, mcpServer, swarmManager) {
    this.bot = botClient;
    this.llm = llmClient;
    this.mcp = mcpServer;
    this.swarm = swarmManager;
    this.isExecuting = false;
    this.history = [];
  }

  async executeGoal(goal, context = {}) {
    if (this.isExecuting) {
      this.bot.chat('⏳ Zaten bir görev üzerinde çalışıyorum, lütfen bekleyin.');
      return;
    }
    this.isExecuting = true;
    Logger.info(`🎯 Yeni hedef: ${goal}`);

    try {
      // Hedefi anlamak için LLM'e sor
      const toolsList = ['go_to', 'dig_block', 'craft_item', 'get_inventory', 'place_block', 'web_search', 'start_fishing', 'attack_player', 'build_house', 'start_mining', 'farm_crops'];
      
      const prompt = `
        Kullanıcı sana şu hedefi verdi: "${goal}"
        Mevcut konumun: ${JSON.stringify(this.bot.getStatus().position)}
        Kullanabileceğin araçlar: ${toolsList.join(', ')}
        
        Bu hedefi gerçekleştirmek için hangi aracı/araçları kullanmalısın?
        Sadece şu JSON formatında cevap ver:
        {
          "thought": "Hedefi gerçekleştirmek için planın",
          "tool": "kullanılacak araç adı",
          "params": { "param1": "değer" },
          "subGoal": "varsa bir sonraki ara hedef, yoksa null"
        }
        Eğer hedef bir selamlaşma veya sohbet ise "tool" alanını "CHAT" yap ve "params" içine "reply" anahtarı ile cevabını yaz.
      `;

      const response = await this.llm.ask(prompt);
      let plan;
      try {
        plan = JSON.parse(response);
      } catch {
        // JSON parse hatası -> direkt cevap olarak kabul et
        this.bot.chat(response.substring(0, 200));
        this.isExecuting = false;
        return;
      }

      Logger.info(`🧠 Plan: ${plan.thought}`);

      if (plan.tool === 'CHAT') {
        this.bot.chat(plan.params.reply || 'Anladım!');
        this.isExecuting = false;
        return;
      }

      // MCP aracını çağır
      if (this.mcp && this.mcp.server) {
        try {
          const result = await this.mcp.server.callTool(plan.tool, plan.params);
          if (result && result.content) {
            const text = result.content[0]?.text || 'İşlem tamamlandı.';
            this.bot.chat(`✅ ${text}`);
          }
        } catch (err) {
          Logger.error(`❌ MCP aracı hatası: ${err.message}`);
          this.bot.chat(`❌ Bir hata oluştu: ${err.message}`);
        }
      } else {
        // Fallback: doğrudan BotClient üzerinden manuel
        await this.executeManual(plan.tool, plan.params);
      }

      // Varsa alt hedefi de dene (basit zincirleme)
      if (plan.subGoal) {
        setTimeout(() => {
          this.executeGoal(plan.subGoal, context);
        }, 2000);
      }

    } catch (error) {
      Logger.error(`❌ Planlama hatası: ${error.message}`);
      this.bot.chat('❌ Bir şeyler ters gitti, tekrar dener misin?');
    } finally {
      this.isExecuting = false;
    }
  }

  // MCP yoksa manuel fallback (basit)
  async executeManual(tool, params) {
    const { Vec3 } = require('vec3');
    switch(tool) {
      case 'go_to':
        await this.bot.pathfinder.goto(new Vec3(params.x, params.y, params.z));
        break;
      case 'dig_block':
        const block = this.bot.findBlock({ matching: (b) => b.name === params.blockName, maxDistance: 32 });
        if (block) await this.bot.collectBlock.collect(block);
        break;
      case 'chat':
        this.bot.chat(params.message);
        break;
      case 'get_inventory':
        const items = this.bot.inventory.items().map(i => `${i.name}x${i.count}`).join(', ');
        this.bot.chat(`📦 Envanter: ${items}`);
        break;
      default:
        this.bot.chat(`⚠️ Henüz ${tool} işlemini desteklemiyorum.`);
    }
  }
}

module.exports = TaskPlanner;
