const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { Vec3 } = require('vec3');
const axios = require('axios');
const cheerio = require('cheerio');

class MinecraftServer {
  constructor(bot) {
    this.bot = bot;
    this.server = new McpServer({
      name: 'mineflayer-advanced-bot',
      version: '3.0.0',
    });
    this.registerTools();
  }

  registerTools() {
    // 1. go_to
    this.server.tool('go_to', 'Belirtilen koordinata git', { x: z.number(), y: z.number(), z: z.number() }, async ({ x, y, z }) => {
      const target = new Vec3(x, y, z);
      const mcData = require('minecraft-data')(this.bot.version);
      const { Movements } = require('mineflayer-pathfinder');
      const defaultMove = new Movements(this.bot, mcData);
      this.bot.pathfinder.setMovements(defaultMove);
      try {
        await this.bot.pathfinder.goto(target);
        return { content: [{ type: 'text', text: `✅ (${x}, ${y}, ${z}) koordinatına gidildi.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ Yol bulunamadı: ${err.message}` }] };
      }
    });

    // 2. dig_block
    this.server.tool('dig_block', 'Belirtilen bloğu kaz', { blockName: z.string() }, async ({ blockName }) => {
      const mcData = require('minecraft-data')(this.bot.version);
      const blockType = mcData.blocksByName[blockName];
      if (!blockType) return { content: [{ type: 'text', text: `❌ ${blockName} geçersiz.` }] };
      const block = this.bot.findBlock({ matching: blockType.id, maxDistance: 32 });
      if (!block) return { content: [{ type: 'text', text: `❌ ${blockName} bulunamadı.` }] };
      try {
        await this.bot.collectBlock.collect(block);
        return { content: [{ type: 'text', text: `✅ ${blockName} kazıldı.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ Kazı hatası: ${err.message}` }] };
      }
    });

    // 3. craft_item
    this.server.tool('craft_item', 'Eşya üret', { itemName: z.string(), count: z.number().optional().default(1) }, async ({ itemName, count }) => {
      const mcData = require('minecraft-data')(this.bot.version);
      const item = mcData.itemsByName[itemName];
      if (!item) return { content: [{ type: 'text', text: `❌ ${itemName} geçersiz.` }] };
      const tableBlock = this.bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 32 });
      if (!tableBlock) return { content: [{ type: 'text', text: `❌ Üretim masası bulunamadı.` }] };
      try {
        await this.bot.pathfinder.goto(tableBlock.position);
        const recipes = this.bot.recipesFor(item.id, null, 1, tableBlock);
        if (recipes.length === 0) return { content: [{ type: 'text', text: `❌ Reçete yok.` }] };
        await this.bot.craft(recipes[0], count, tableBlock);
        return { content: [{ type: 'text', text: `✅ ${count} adet ${itemName} üretildi.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ Üretim hatası: ${err.message}` }] };
      }
    });

    // 4. get_inventory
    this.server.tool('get_inventory', 'Envanteri listele', {}, async () => {
      const items = this.bot.inventory.items().map(i => `${i.name}x${i.count}`).join(', ');
      return { content: [{ type: 'text', text: `📦 Envanter: ${items || 'boş'}` }] };
    });

    // 5. place_block
    this.server.tool('place_block', 'Blok yerleştir', { blockName: z.string(), x: z.number(), y: z.number(), z: z.number() }, async ({ blockName, x, y, z }) => {
      const mcData = require('minecraft-data')(this.bot.version);
      const item = mcData.itemsByName[blockName];
      if (!item) return { content: [{ type: 'text', text: `❌ ${blockName} geçersiz.` }] };
      const invItem = this.bot.inventory.findInventoryItem(item.id);
      if (!invItem) return { content: [{ type: 'text', text: `❌ Envanterde ${blockName} yok.` }] };
      const targetPos = new Vec3(x, y, z);
      const refBlock = this.bot.blockAt(targetPos.offset(0, -1, 0));
      if (!refBlock || refBlock.name === 'air') return { content: [{ type: 'text', text: '❌ Altındaki blok hava.' }] };
      await this.bot.equip(invItem, 'hand');
      await this.bot.placeBlock(refBlock, new Vec3(0, 1, 0));
      return { content: [{ type: 'text', text: `✅ ${blockName} yerleştirildi.` }] };
    });

    // 6. web_search (Minecraft Wiki)
    this.server.tool('web_search', 'Minecraft Wiki\'de ara', { query: z.string() }, async ({ query }) => {
      try {
        const searchUrl = `https://minecraft.wiki/w/Special:Search?search=${encodeURIComponent(query)}`;
        const res = await axios.get(searchUrl, { timeout: 10000 });
        const $ = cheerio.load(res.data);
        const link = $('.mw-search-result-heading a').first().attr('href');
        if (!link) return { content: [{ type: 'text', text: `❌ "${query}" için sonuç yok.` }] };
        const pageUrl = `https://minecraft.wiki${link}`;
        const pageRes = await axios.get(pageUrl, { timeout: 10000 });
        const $$ = cheerio.load(pageRes.data);
        const text = $$('p').map((i, el) => $$(el).text().trim()).get().slice(0, 3).join(' ').substring(0, 1500);
        return { content: [{ type: 'text', text: `📄 ${pageUrl}\n\n${text}` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ Web hatası: ${err.message}` }] };
      }
    });

    // 7. start_fishing
    this.server.tool('start_fishing', 'Balık tut', {}, async () => {
      try {
        await this.bot.fish();
        return { content: [{ type: 'text', text: '🎣 Balık yakalandı!' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `❌ Balık tutma hatası: ${err.message}` }] };
      }
    });

    // 8. attack_player
    this.server.tool('attack_player', 'Oyuncuya saldır', { targetName: z.string() }, async ({ targetName }) => {
      const player = this.bot.players[targetName];
      if (!player || !player.entity) return { content: [{ type: 'text', text: `❌ ${targetName} bulunamadı.` }] };
      const sword = this.bot.inventory.items().find(i => i.name.includes('sword'));
      if (sword) await this.bot.equip(sword, 'hand');
      await this.bot.lookAt(player.entity.position.offset(0, 1.5, 0), true);
      this.bot.attack(player.entity);
      return { content: [{ type: 'text', text: `⚔️ ${targetName}'e saldırıldı.` }] };
    });

    // 9. build_house (basit)
    this.server.tool('build_house', 'Basit ev yap', { material: z.string().optional().default('oak_planks') }, async ({ material }) => {
      const mcData = require('minecraft-data')(this.bot.version);
      const plankId = mcData.itemsByName[material]?.id;
      if (!plankId) return { content: [{ type: 'text', text: `❌ ${material} geçersiz.` }] };
      const count = this.bot.inventory.count(plankId);
      if (count < 64) return { content: [{ type: 'text', text: `❌ Yeterli ${material} yok (64 gerekli, mevcut: ${count}).` }] };
      const start = this.bot.entity.position.floored();
      let placed = 0;
      // Duvarlar (5x5, 3 yüksek)
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 5; x++) {
          for (let z = 0; z < 5; z++) {
            if ((x === 0 || x === 4 || z === 0 || z === 4) && !(y === 0 && z === 0 && x === 2)) {
              const pos = start.offset(x, y, z);
              const block = this.bot.blockAt(pos);
              if (!block || block.name === 'air') {
                const ref = this.bot.blockAt(pos.offset(0, -1, 0));
                if (ref && ref.name !== 'air') {
                  const item = this.bot.inventory.findInventoryItem(plankId);
                  if (item) {
                    await this.bot.equip(item, 'hand');
                    await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
                    placed++;
                  }
                }
              }
            }
          }
        }
      }
      // Çatı
      for (let x = 0; x < 5; x++) {
        for (let z = 0; z < 5; z++) {
          const pos = start.offset(x, 3, z);
          const block = this.bot.blockAt(pos);
          if (!block || block.name === 'air') {
            const ref = this.bot.blockAt(pos.offset(0, -1, 0));
            if (ref && ref.name !== 'air') {
              const item = this.bot.inventory.findInventoryItem(plankId);
              if (item) {
                await this.bot.equip(item, 'hand');
                await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
                placed++;
              }
            }
          }
        }
      }
      return { content: [{ type: 'text', text: `🏠 Ev inşa edildi! (${placed} blok yerleştirildi)` }] };
    });

    // 10. start_mining (branch mining)
    this.server.tool('start_mining', 'Maden aç', { length: z.number().optional().default(20) }, async ({ length }) => {
      const start = this.bot.entity.position.floored();
      let dug = 0;
      for (let i = 0; i < length; i++) {
        for (let y = 0; y < 2; y++) {
          const pos = start.offset(i, y, 0);
          const block = this.bot.blockAt(pos);
          if (block && block.name !== 'air' && block.name !== 'bedrock') {
            try { await this.bot.collectBlock.collect(block); dug++; } catch(e) {}
          }
        }
        if (i % 5 === 0 && i > 0) {
          for (let side = -1; side <= 1; side += 2) {
            for (let d = 1; d <= 3; d++) {
              const pos = start.offset(i, 0, side * d);
              const block = this.bot.blockAt(pos);
              if (block && block.name !== 'air' && block.name !== 'bedrock') {
                try { await this.bot.collectBlock.collect(block); dug++; } catch(e) {}
              }
            }
          }
        }
        await this.bot.waitForTicks(2);
      }
      return { content: [{ type: 'text', text: `⛏️ Maden açıldı! ${dug} blok kazıldı.` }] };
    });

    // 11. farm_crops
    this.server.tool('farm_crops', 'Ekin hasat et', { cropType: z.string().optional().default('wheat') }, async ({ cropType }) => {
      const mcData = require('minecraft-data')(this.bot.version);
      const blocks = this.bot.findBlocks({
        matching: (b) => b.name === cropType && b.metadata === 7,
        maxDistance: 32,
        count: 100
      });
      let harvested = 0;
      for (const pos of blocks) {
        const block = this.bot.blockAt(pos);
        if (block) {
          try {
            await this.bot.collectBlock.collect(block);
            harvested++;
            const below = this.bot.blockAt(pos.offset(0, -1, 0));
            if (below && below.name === 'farmland') {
              const seeds = this.bot.inventory.findInventoryItem(mcData.itemsByName.wheat_seeds.id);
              if (seeds) {
                await this.bot.equip(seeds, 'hand');
                await this.bot.placeBlock(below, new Vec3(0, 1, 0));
              }
            }
          } catch(e) {}
        }
      }
      return { content: [{ type: 'text', text: `🌾 ${harvested} adet ${cropType} hasat edildi ve yeniden ekildi.` }] };
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('✅ MCP Sunucusu başlatıldı.');
  }
}

module.exports = MinecraftServer;
