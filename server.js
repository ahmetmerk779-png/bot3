const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const botManager = require('./botManager');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// RENDER UYANIK TUTMA (SELF-PING - 10 dakikada bir tetiklenir)
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    axios.get(`${RENDER_EXTERNAL_URL}/health`).catch(() => {});
  }, 10 * 60 * 1000);
}

// TELEGRAM BOT ENTEGRASYONU
if (process.env.TELEGRAM_TOKEN) {
  const tBot = new Telegraf(process.env.TELEGRAM_TOKEN);

  tBot.command('durum', (ctx) => {
    const bots = botManager.getBotStatus();
    if (bots.length === 0) return ctx.reply("Aktif bot bulunmuyor.");
    let msg = "🤖 **BOT STATUS OVERVIEW**\n";
    bots.forEach(b => {
      msg += `• **${b.username}** | Can: ${b.health} | TPS: ${b.tps} | X: ${Math.round(b.position?.x || 0)} Z: ${Math.round(b.position?.z || 0)}\n`;
    });
    ctx.replyWithMarkdown(msg);
  });

  tBot.command('mesaj', (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply("Kullanım: /mesaj <yazı>");
    botManager.sendChat(text);
    ctx.reply(`Sohbete iletildi: ${text}`);
  });

  tBot.command('saldir', (ctx) => {
    const target = ctx.message.text.split(' ')[1];
    if (target) {
      botManager.attackEntity(target);
      ctx.reply(`${target} hedefine saldırı emri verildi.`);
    }
  });

  tBot.command('takip', (ctx) => {
    const target = ctx.message.text.split(' ')[1];
    if (target) {
      botManager.followPlayer(target);
      ctx.reply(`${target} takibe alındı.`);
    }
  });

  tBot.command('cop', async (ctx) => {
    const msg = await botManager.clearTrash();
    ctx.reply(msg);
  });

  tBot.launch();
}

// EXTREME REST API ENDPOINTS (TÜM İŞLEVLER)
app.get('/health', (req, res) => res.status(200).send('OK - Alive'));

app.post('/api/spawn', (req, res) => {
  try {
    botManager.spawnBots(req.body);
    res.json({ success: true, message: "Botlar başlatılıyor." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Temel Eylemler & PVP
app.post('/api/attack', (req, res) => {
  res.json({ success: true, message: botManager.attackEntity(req.body.entityName, req.body.botName || 'all') });
});

app.post('/api/follow', (req, res) => {
  res.json({ success: true, message: botManager.followPlayer(req.body.username, req.body.botName || 'all') });
});

app.post('/api/dig', async (req, res) => {
  const { x, y, z, botName } = req.body;
  res.json({ success: true, message: await botManager.digBlock(x, y, z, botName || 'all') });
});

app.post('/api/collect', async (req, res) => {
  const { blockName, count, botName } = req.body;
  res.json({ success: true, message: await botManager.collectBlockType(blockName, count, botName || 'all') });
});

app.post('/api/equip-armor', async (req, res) => {
  res.json({ success: true, message: await botManager.equipArmor(req.body.botName || 'all') });
});

app.post('/api/drop-item', async (req, res) => {
  const { itemName, amount, botName } = req.body;
  res.json({ success: true, message: await botManager.dropItem(itemName, amount, botName || 'all') });
});

app.post('/api/trash/clear', async (req, res) => {
  res.json({ success: true, message: await botManager.clearTrash(req.body.botName || 'all') });
});

app.post('/api/chest/deposit', async (req, res) => {
  const { x, y, z, filterItems, botName } = req.body;
  res.json({ success: true, message: await botManager.depositToChest(x, y, z, filterItems || [], botName || 'all') });
});

// Otomasyon & Modlar
app.post('/api/afk/start', (req, res) => res.json({ success: true, message: botManager.startAntiAfk(req.body.botName || 'all') }));
app.post('/api/afk/stop', (req, res) => res.json({ success: true, message: botManager.stopAntiAfk(req.body.botName || 'all') }));

app.post('/api/guard/start', (req, res) => {
  const { username, radius, botName } = req.body;
  res.json({ success: true, message: botManager.startGuard(username, radius || 5, botName || 'all') });
});

app.post('/api/fish/start', (req, res) => res.json({ success: true, message: botManager.startFishing(req.body.botName || 'all') }));

app.post('/api/bow/shoot', (req, res) => {
  const { targetUsername, weapon, botName } = req.body;
  res.json({ success: true, message: botManager.shootBow(targetUsername, weapon || 'bow', botName || 'all') });
});

app.post('/api/autocraft', async (req, res) => {
  const { itemName, count, botName } = req.body;
  res.json({ success: true, message: await botManager.autoCraft(itemName, count, botName || 'all') });
});

app.post('/api/goto', (req, res) => {
  const { x, y, z, botName } = req.body;
  res.json({ success: true, message: botManager.goToLocation(x, y, z, botName || 'all') });
});

app.post('/api/chat', (req, res) => {
  res.json({ success: true, message: botManager.sendChat(req.body.message, req.body.botName || 'all') });
});

app.get('/api/status', (req, res) => res.json({ bots: botManager.getBotStatus() }));
app.post('/api/stop', (req, res) => res.json({ success: true, message: botManager.stopBots(req.body.botName || 'all') }));

app.listen(PORT, () => {
  console.log(`[API] Ekstrem Birleşik Bot Sistemi ${PORT} Portunda Aktif.`);
});
