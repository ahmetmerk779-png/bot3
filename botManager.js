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

const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { mineflayer: prismarineViewer } = require('prismarine-viewer');
const Vec3 = require('vec3').Vec3;

const TRASH_ITEMS = ['cobblestone', 'dirt', 'netherrack', 'gravel', 'wheat_seeds', 'short_grass', 'andesite', 'diorite', 'granite'];

function getMcData(version) {
  const mcDataLib = require('minecraft-data');
  try {
    return mcDataLib(version);
  } catch (e) {
    return mcDataLib('1.21.1') || mcDataLib('1.21') || mcDataLib('1.20.1');
  }
}

class CompleteBotManager {
  constructor() {
    this.bots = new Map();
  }

  spawnBots(config) {
    const { host, port, username, password, count = 1, version = '1.21.11', enableViewer = false, enableWebInventory = false, discordWebhook } = config;

    for (let i = 1; i <= count; i++) {
      const botUsername = count === 1 ? username : `${username}_${i}`;
      
      // Temizlik: Var olan eski bot oturumu varsa sonlandır
      if (this.bots.has(botUsername)) {
        this.stopBots(botUsername);
      }

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
      version: botConfig.version,
      checkTimeoutInterval: 60000
    });

    // EKLENTİ YÜKLEMELERİ
    try {
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
    } catch (e) {
      console.error(`[Eklenti Yükleme Hatası - ${botConfig.username}]:`, e.message);
    }

    const botData = { instance: bot, config: botConfig, autoReconnect: true };
    this.bots.set(botConfig.username, botData);

    // OTONOM GİRİŞ VE CHAT
    bot.on('messagestr', (msg) => {
      if (msg.includes('/login')) bot.chat(`/login ${botConfig.password}`);
      if (msg.includes('/register')) bot.chat(`/register ${botConfig.password} ${botConfig.password}`);
      if (msg.includes('TPA') || msg.includes('tpa')) bot.chat('/tpaccept');
    });

    // AUTO-TOTEM (SOL ELE TAKMA)
    bot.on('health', async () => {
      if (bot.health < 15 && bot.inventory) {
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
      console.log(`[Bot] ${bot.username} oyuna başarıyla bağlandı.`);
      
      const mcData = getMcData(bot.version);
      if (mcData && bot.pathfinder) {
        const defaultMove = new Movements(bot, mcData);
        bot.pathfinder.setMovements(defaultMove);
      }

      if (bot.autoEat && typeof bot.autoEat.enable === 'function') {
        try { bot.autoEat.enable(); } catch (e) {}
      }

      // WEB ARAYÜZLERİ (Çökmeleri engellemek için izole edildi)
      if (botConfig.enableWebInventory) {
        try { inventoryViewer(bot, { port: botConfig.inventoryPort, startOpen: false }); } catch (e) {}
      }

      if (botConfig.enableViewer) {
        try { prismarineViewer(bot, { port: botConfig.viewerPort, firstPerson: true }); } catch (err) {}
      }

      this._sendDiscordAlert(botConfig.discordWebhook, `✅ **${bot.username}** sunucuya katıldı.`);
    });

    bot.on('end', (reason) => {
      console.log(`[Bot] ${botConfig.username} ayrıldı. Sebep: ${reason}`);
      bot.removeAllListeners();
      if (botData.autoReconnect) {
        setTimeout(() => {
          if (this.bots.has(botConfig.username)) {
            this._createSingleBotInstance(botConfig);
          }
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

  // --- OTONOM TEMİZLİK & SANDIK ---
  async clearTrash(target = 'all') {
    const targetBots = this._getTargetBots(target);
    let totalDropped = 0;
    for (const bot of targetBots) {
      if (!bot.inventory) continue;
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
            try { await chest.deposit(item.type, null, item.count); } catch (e) {}
          }
        }
        chest.close();
        count++;
      } catch (e) {}
    }
    return `${count} bot (${x}, ${y}, ${z}) sandığına eşyaları aktardı.`;
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
        const mcData = getMcData(bot.version);
        const blockType = mcData.blocksByName[blockName];
        if (!blockType) continue;
        const blocks = bot.findBlocks({ matching: blockType.id, maxDistance: 15, count });
        if (blocks.length > 0 && bot.collectBlock) {
          const targets = blocks.map(p => bot.blockAt(p)).filter(Boolean);
          await bot.collectBlock.collect(targets);
          success++;
        }
      } catch (e) {}
    }
    return `${success} bot ${count}x ${blockName} toplama görevini tamamladı.`;
  }

  // --- TEMEL EYLEMLER ---
  async equipArmor(target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) {
      try { if (bot.armorManager) await bot.armorManager.equipAll(); } catch (e) {}
    }
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
    let count = 0;
    for (const bot of targetBots) {
      const p = bot.players[username]?.entity;
      if (p && bot.pathfinder) {
        bot.pathfinder.setGoal(new goals.GoalFollow(p, 2), true);
        count++;
      }
    }
    return `${count} bot '${username}' oyuncusunu takip ediyor.`;
  }

  attackEntity(entityName, target = 'all') {
    const targetBots = this._getTargetBots(target);
    let count = 0;
    for (const bot of targetBots) {
      const e = bot.nearestEntity(ent => ent.name?.includes(entityName) || ent.username === entityName);
      if (e) {
        if (bot.pvp) bot.pvp.attack(e);
        else bot.attack(e);
        count++;
      }
    }
    return `${count} bot '${entityName}' hedefine saldırdı.`;
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
    return `${count} bot '${username}' çevresinde korumada.`;
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
    return `${targetBots.length} bot balık tutmaya başladı.`;
  }

  async autoCraft(itemName, count = 1, target = 'all') {
    const targetBots = this._getTargetBots(target);
    for (const bot of targetBots) {
      if (bot.autocraft) try { await bot.autocraft.craft(itemName, count); } catch (e) {}
    }
    return `${targetBots.length} bot ${count}x ${itemName} üretti.`;
  }

  goToLocation(x, y, z, target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => bot.pathfinder && bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z)));
    return `${targetBots.length} bot koordinata ilerliyor.`;
  }

  sendChat(message, target = 'all') {
    const targetBots = this._getTargetBots(target);
    targetBots.forEach(bot => bot.chat(message));
    return `Mesaj gönderildi: ${message}`;
  }

  stopBots(target = 'all') {
    if (target === 'all') {
      for (const [name, botData] of this.bots) {
        botData.autoReconnect = false;
        botData.instance.removeAllListeners();
        try { botData.instance.quit(); } catch (e) {}
      }
      this.bots.clear();
      return "Tüm botlar kapatıldı.";
    } else if (this.bots.has(target)) {
      const botData = this.bots.get(target);
      botData.autoReconnect = false;
      botData.instance.removeAllListeners();
      try { botData.instance.quit(); } catch (e) {}
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
        health: b.health || 0,
        food: b.food || 0,
        tps: b.getTps ? b.getTps() : 20,
        position: b.entity?.position ? {
          x: Math.round(b.entity.position.x),
          y: Math.round(b.entity.position.y),
          z: Math.round(b.entity.position.z)
        } : null,
        heldItem: b.heldItem ? b.heldItem.name : 'Boş',
        inventory: b.inventory ? b.inventory.items().map(i => ({ name: i.name, count: i.count })) : []
      });
    }
    return list;
  }
}

module.exports = new CompleteBotManager();
