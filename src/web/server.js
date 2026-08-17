const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const Logger = require('../utils/Logger');

class WebServer {
  constructor(botClient, swarmManager, planner) {
    this.app = express();
    this.bot = botClient;
    this.swarm = swarmManager;
    this.planner = planner;
    this.port = process.env.PORT || 3000;

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API: Bot durumu
    this.app.get('/api/status', (req, res) => {
      res.json(this.bot.getStatus());
    });

    // API: Sunucu ayarlarını güncelle (botu yeniden bağla)
    this.app.post('/api/connect', express.json(), (req, res) => {
      const { username, host, port } = req.body;
      if (!username || !host || !port) {
        return res.status(400).json({ error: 'Eksik bilgi' });
      }
      try {
        this.bot.disconnect();
        this.bot.connect(username, host, port);
        res.json({ success: true, message: `Bot ${username} bağlanıyor...` });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: Komut gönder (doğal dil)
    this.app.post('/api/command', express.json(), async (req, res) => {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Komut gerekli' });
      try {
        await this.planner.executeGoal(command);
        res.json({ success: true, message: `Komut alındı: ${command}` });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: Görsel hafıza
    this.app.get('/api/vision/latest', (req, res) => {
      const dir = path.join(__dirname, '../../temp_vision');
      if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Görsel yok' });
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().reverse();
      if (files.length === 0) return res.status(404).json({ error: 'Görsel yok' });
      res.sendFile(path.join(dir, files[0]));
    });

    // HTTP + Socket.io
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling']
    });

    this.setupSocket();
  }

  setupSocket() {
    this.io.on('connection', (socket) => {
      Logger.info('🟢 Dashboard bağlandı');
      socket.emit('status', this.bot.getStatus());

      const interval = setInterval(() => {
        socket.emit('status', this.bot.getStatus());
      }, 3000);

      // Bot sohbet mesajlarını dashboard'a gönder
      const chatHandler = (username, message) => {
        socket.emit('chat_message', { username, message, timestamp: Date.now() });
      };
      this.bot.on('chat', chatHandler);

      socket.on('disconnect', () => {
        this.bot.removeListener('chat', chatHandler);
        clearInterval(interval);
        Logger.info('🔴 Dashboard ayrıldı');
      });
    });
  }

  start() {
    this.server.listen(this.port, () => {
      Logger.success(`🌐 Dashboard: http://localhost:${this.port}`);
    });
  }
}

module.exports = WebServer;
