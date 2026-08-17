const mineflayer = require('mineflayer');
const axios = require('axios');
const armorManager = require('mineflayer-armor-manager');
const autoEat = require('mineflayer-auto-eat').default || require('mineflayer-auto-eat');
const toolPlugin = require('mineflayer-tool').plugin;
const { plugin: collectBlockPlugin } = require('mineflayer-collectblock');
const { plugin: pvpPlugin } = require('mineflayer-pvp');
const hawkeye = require('mineflayer-hawkeye');
const autoFish = require('mineflayer-auto-fish');
const autocraft = require('mineflayer-autocraft');
const builder = require('mineflayer-builder').plugin;
const inventoryViewer = require('mineflayer-web-inventory');
const antiafk = require('mineflayer-antiafk');
const guardPlugin = require('mineflayer-guard').plugin;
const tpsPlugin = require('mineflayer-tps')(mineflayer);

const { pathfinder, movements, goals } = require('mineflayer-pathfinder');
const { mineflayer: prismarineViewer } = require('prismarine-viewer');
const Vec3 = require('vec3').Vec3;

const TRASH_ITEMS = ['cobblestone', 'dirt', 'netherrack', 'gravel', 'wheat_seeds', 'short_grass', 'andesite', 'diorite', 'granite'];

class CompleteBotManager {
  constructor() {
    this.bots = new Map();
  }

  spawnBots(config) {
    const { host, port, username, password, count = 1, version = '1.21.11', enableViewer = false, enableWebInventory = true, discordWebhook } = config;

    for (let i = 1; i <= count; i++) {
      const botUsername = count === 1 ? username : `${username}_${i}`;
      if (this.bots.has(botUsername)) continue;

      this._createSingleBotInstance({
        host,
        port: port || 25565,
        username: botUsername,
        password: password || 'Sifre12345',
        version,
        enableViewer: enableViewer && i === 1,
        viewerPort: 3000 + i,
        enableWebInventory,
        inventoryPort: 4000 + i,
        discordWebhook: discordWebhook || null
      });
    }
  }

  _createSingleBotInstance(botConfig) {
    const bot = mineflayer.createBot({
      host: botConfig.host,
      port: botConfig.port,
      username: botConfig.username,
      version: botConfig.version
    });

    // TÜM EKLENTİLER
    bot.loadPlugin(armorManager);
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(autoEat);
    bot.loadPlugin(toolPlugin);
    bot.loadPlugin(collectBlockPlugin);
    bot.loadPlugin(pvpPlugin);
    bot.loadPlugin(hawkeye);
    bot.loadPlugin(autoFish);
    bot.loadPlugin(autocraft);
    bot.loadPlugin(builder);
    bot.loadPlugin(antiafk);
    bot.loadPlugin(guardPlugin);
    bot.loadPlugin(tpsPlugin);

    const botData = { instance: bot, config: botConfig, autoReconnect: true };
    this.bots.set(botConfig.username, botData);

    // OTONOM GİRİŞ VE CHAT
    bot.on('messagestr', (msg) => {
      if (msg.includes('/login')) bot.chat(`/login ${botConfig.password}`);
      if (msg.includes('/register')) bot.chat(`/register ${botConfig.password} ${botConfig.password}`);
      if (msg.includes('TPA')) bot.chat('/tpaccept');
    });

    // AUTO-TOTEM (SOL ELE TAKMA)
    bot.on('health', async () => {
      if (bot.health < 15) {
        const totem = bot.inventory.items().find(i => i.name === 'totem_of_undying');
        const offhandSlot = bot.inventory.slots[45];
        if (totem && (!offhandSlot || offhandSlot.name !== 'totem_of_undying')) {
          try { await bot.equip(totem, 'off-hand'); } catch (e) {}
        }
      }
    });

    // DISCORD BİLDİRİMLERİ & ÖLÜM
    bot.on('death', () => {
      this._sendDiscordAlert(botConfig.discordWebhook, `⚠️ **${bot.username}** öldü! Yeniden doğması bekleniyor...`);
    });

    bot.on('spawn', () => {
      console.log(`[Bot] ${bot.username} oyuna bağlandı.`);
      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new movements(bot, mcData));

      if (bot.autoEat) bot.autoEat.enable();

      if (botConfig.enableWebInventory) {
        try { inventoryViewer(bot, { port: botConfig.inventoryPort, startOpen: false }); } catch (e) {}
      }

      if (botConfig.enableViewer) {
        try { prismarineViewer(bot, { port: botConfig.viewerPort, firstPerson: true }); } catch (err) {}
      }

      this._sendDiscordAlert(botConfig.discordWebhook, `✅ **${bot.username}** sunucuya başarıyla katıldı.`);
    });

    bot.on('end', (reason) => {
      console.log(`[Bot] ${botConfig.username} ayrıldı. Sebeb: ${reason}`);
      if (botData.autoReconnect) {
        setTimeout(() => {
          if (this.bots.has(botConfig.username)) this._createSingleBotInstance(botConfig);
        }, 5000);
      }
    });

    bot.on('error', (err) => console.error(`[Hata] ${botConfig.username}:`, err.message));
  }

  _sendDiscordAlert(url, text) {
    if (url) axios.post(url, { content: text }).catch(() => {});
  }

  _getTargetBots(target = 'all') {
    if (this.bots.size === 0) throw new Error("Aktif bot bulunamadı.");
    if (target !== 'all' && this.bots.has(target)) return [this.bots.get(target).instance];
    return Array.from(this.bots.values()).map(b => b.instance);
  }

  // --- OTONOM ÇÖP TEMİZLEYİCİ ---
  async clearTrash(target = 'all') {
    const targetBots = this._getTargetBots(target);
    let totalDropped = 0;
    for (const bot of targetBots) {
      const itemsToDrop = bot.inventory.items().filter(item => TRASH_ITEMS.includes(item.name));
      for (const item of itemsToDrop) {
        try {
          await bot.toss(item.type, null, item.count);
          totalDropped++;
        } catch (e) {}
      }
    }
    return `${targetBots.length} bot gereksiz çöp eşyaları attı (${totalDropped} slot temizlendi).`;
  }

  // --- SANDIK BOŞALTMA ---
  async depositToChest(x, y, z, filterItems = [], target = 'all') {
    const targetBots = this._getTargetBots(target);
    let count = 0;
    for (const bot of targetBots) {
      try {
        const chestBlock = bot.blockAt(new Vec3(x, y, z));
        if (!chestBlock) continue;
        const chest = await bot.openContainer(chestBlock);
        for (const item of bot.inventory.items()) {
          if (filterItems.length === 0 || filterItems.includes(item.name)) {
            await chest.deposit(item.type, null, item.count);
          }
        }
        chest.close();
        count++;
      } catch (e) {}
    }
    return `${count} bot (${x}, ${y}, ${z}) sandığına eşyaları yatırdı.`;
  }

  // --- KAZMA & BLOK TOPLAMA ---
  async digBlock(x, y, z, target = 'all') {
    const targetBots = this._getTargetBots(target);
    let success = 0;
    for (const bot of targetBots) {
      try {
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block || block.name === 'air') continue;
        if (bot.tool) await bot.tool.equipForBlock(block, {});
        await bot.dig(block);
        success++;
      } catch (e) {}
    }
    return `${success} bot (${x}, ${y}, ${z}) bloğunu kazdı.`;
  }

  async collectBlockType(blockName, count = 1, target = 'all') {
    const targetBots = this._getTargetBots(target);
    let success = 0;
    for (const bot of targetBots) {
      try {
        const mcData = require('minecraft-data')(bot.version);
        const blockType = mcData.blocksByName[blockName];
        if (!blockType) continue;
        const blocks = bot.findBlocks({ matching: blockType.id, maxDistance: 15, count });
        if (blocks.length > 0) {
          const targets = blocks.map(p => bot.blockAt(p)).filter(Boolean);
          await bot.collectBlock.collect(targets);
          success++;
        }
      } catch (e) {}
    }
    return `${success} bot ${count}x ${blockName} topladı.`;
  }

  // --- DİĞER TÜM TEMEL EYLEMLER ---
  async equipArmor(target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) { try { await bot.armorManager.equipAll(); } catch (e) {} }
    return `${targetBots.length} bot zırh giydi.`;
  }

  async dropItem(itemName, amount = 1, target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) {
      try {
        const item = bot.inventory.items().find(i => i.name.includes(itemName));
        if (item) await bot.toss(item.type, null, amount || item.count);
      } catch (e) {}
    }
    return `${targetBots.length} bot eşya attı.`;
  }

  followPlayer(username, target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) {
      const p = bot.players[username]?.entity;
      if (p) bot.pathfinder.setGoal(new goals.GoalFollow(p, 2), true);
    }
    return `${targetBots.length} bot '${username}' oyuncusunu takip ediyor.`;
  }

  attackEntity(entityName, target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) {
      const e = bot.nearestEntity(ent => ent.name?.includes(entityName) || ent.username === entityName);
      if (e) bot.pvp ? bot.pvp.attack(e) : bot.attack(e);
    }
    return `${targetBots.length} bot '${entityName}' hedefine saldırdı.`;
  }

  startAntiAfk(target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => bot.afk && bot.afk.start());
    return `${targetBots.length} bot Anti-AFK modunda.`;
  }

  stopAntiAfk(target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => bot.afk && bot.afk.stop());
    return `${targetBots.length} bot Anti-AFK modunu kapattı.`;
  }

  startGuard(username, radius = 5, target = 'all') {
    const targetBots = this._getTargetBots(target);
    let count = 0;
    for (const bot of targetBots) {
      const p = bot.players[username]?.entity;
      if (p && bot.guard) { bot.guard.setPatrol(p.position, radius); count++; }
    }
    return `${count} bot '${username}' çevresinde nöbette.`;
  }

  shootBow(targetUsername, weapon = 'bow', target = 'all') {
    const targetBots = this._getTargetBots(target);
    let count = 0;
    for (const bot of targetBots) {
      const e = bot.players[targetUsername]?.entity;
      if (e && bot.hawkeye) { bot.hawkeye.autoAttack(e, weapon); count++; }
    }
    return `${count} bot '${targetUsername}' kişisine kilitlendi.`;
  }

  startFishing(target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => { try { bot.fish(); } catch(e){} });
    return `${targetBots.length} bot balık tutuyor.`;
  }

  async autoCraft(itemName, count = 1, target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) {
      if (bot.autocraft) await bot.autocraft.craft(itemName, count);
    }
    return `${targetBots.length} bot ${count}x ${itemName} üretti.`;
  }

  goToLocation(x, y, z, target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z)));
    return `${targetBots.length} bot hedefe ilerliyor.`;
  }

  sendChat(message, target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => bot.chat(message));
    return `Mesaj gönderildi: ${message}`;
  }

  stopBots(target = 'all') {
    if (target === 'all') {
      for (const [_, botData] of this.bots) {
        botData.autoReconnect = false;
        botData.instance.quit();
      }
      this.bots.clear();
      return "Tüm botlar kapatıldı.";
    } else if (this.bots.has(target)) {
      const botData = this.bots.get(target);
      botData.autoReconnect = false;
      botData.instance.quit();
      this.bots.delete(target);
      return `'${target}' kapatıldı.`;
    }
    return "Bot bulunamadı.";
  }

  getBotStatus() {
    const list = [];
    for (const [name, botData] of this.bots) {
      const b = botData.instance;
      list.push({
        username: name,
        health: b.health,
        food: b.food,
        tps: b.getTps ? b.getTps() : 20,
        position: b.entity?.position,
        inventoryPort: botData.config.inventoryPort,
        heldItem: b.heldItem ? b.heldItem.name : 'Boş',
        inventory: b.inventory ? b.inventory.items().map(i => ({ name: i.name, count: i.count })) : []
      });
    }
    return list;
  }
}

module.exports = new CompleteBotManager();
