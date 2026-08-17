const express = require('express');
const cors = require('cors');
const path = require('path');
const { Telegraf } = require('telegraf');
const { createProxyMiddleware } = require('http-proxy-middleware');
const botManager = require('./botManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Statik Dosyaları Sun
app.use(express.static(path.join(__dirname, 'public')));

// Prismarine Viewer Proxy
app.use('/viewer', createProxyMiddleware({
  target: `http://localhost:${botManager.viewerPort}`,
  changeOrigin: true,
  ws: true,
  logLevel: 'silent',
  onError: (req, res) => {
    res.status(503).send('3D Viewer henüz aktif değil. Lütfen bot başlatın.');
  }
}));

// Telegram Bot Entegrasyonu (TELEGRAM_TOKEN tanımlıysa çalışır)
if (process.env.TELEGRAM_TOKEN) {
  const tgBot = new Telegraf(process.env.TELEGRAM_TOKEN);
  tgBot.start((ctx) => ctx.reply('🤖 Bot paneline hoşgeldiniz. /status ve /stop komutları kullanılabilir.'));
  tgBot.command('status', (ctx) => {
    const status = botManager.getStatus();
    if (status.length === 0) return ctx.reply('Aktif bot yok.');
    ctx.reply(status.map(b => `🤖 ${b.username} | Can: ${b.health} | POS: ${b.position ? `${b.position.x},${b.position.y},${b.position.z}` : 'Yok'}`).join('\n'));
  });
  tgBot.command('stop', (ctx) => {
    botManager.stopAll();
    ctx.reply('Tüm botlar durduruldu.');
  });
  tgBot.launch().catch(e => console.error('[Telegram] Hata:', e.message));
}

// REST API
app.get('/api/status', (req, res) => res.json({ bots: botManager.getStatus() }));

app.post('/api/spawn', (req, res) => {
  botManager.spawnBots(req.body);
  res.json({ message: 'Botlar başlatılıyor...' });
});

app.post('/api/stop', (req, res) => {
  botManager.stopAll();
  res.json({ message: 'Tüm botlar durduruldu.' });
});

app.post('/api/chat', (req, res) => {
  botManager.sendChat(req.body.message);
  res.json({ message: 'Mesaj gönderildi.' });
});

app.post('/api/goto', (req, res) => {
  const { x, y, z } = req.body;
  botManager.goto(parseFloat(x), parseFloat(y), parseFloat(z));
  res.json({ message: `Pathfinding Hedefi: (${x}, ${y}, ${z})` });
});

app.post('/api/follow', (req, res) => {
  const ok = botManager.follow(req.body.username);
  if (ok) res.json({ message: `${req.body.username} takip ediliyor.` });
  else res.status(404).json({ message: 'Oyuncu görüş alanında bulunamadı.' });
});

app.post('/api/attack', (req, res) => {
  botManager.attack(req.body.entityName);
  res.json({ message: 'Saldırı komutu iletildi.' });
});

app.post('/api/trash/clear', async (req, res) => {
  await botManager.clearTrash();
  res.json({ message: 'Envanterdeki çöpler temizlendi.' });
});

app.post('/api/equip-armor', async (req, res) => {
  await botManager.equipArmor();
  res.json({ message: 'Zırhlar giyildi.' });
});

app.post('/api/afk/start', (req, res) => {
  botManager.startAfk();
  res.json({ message: 'Anti-AFK başlatıldı.' });
});

app.post('/api/afk/stop', (req, res) => {
  botManager.stopAfk();
  res.json({ message: 'Anti-AFK durduruldu.' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Panel Çalışıyor: http://localhost:${PORT}`);
});
