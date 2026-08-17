// src/web/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const Logger = require('../utils/Logger');

class WebServer {
  constructor(botManager) {
    this.app = express();
    this.botManager = botManager; // Bot'u başlatma/durdurma yetkisi
    this.port = process.env.PORT || 3000;

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API: Konfigürasyon gönder (Botu başlat)
    this.app.post('/api/config', async (req, res) => {
      const { host, port, username, apiKey } = req.body;
      if (!host || !apiKey) {
        return res.status(400).json({ success: false, error: 'Host ve API anahtarı zorunlu.' });
      }
      try {
        await this.botManager.startBot({ host, port, username, apiKey });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // API: Botu durdur
    this.app.post('/api/stop', async (req, res) => {
      try {
        await this.botManager.stopBot();
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // API: Komut gönder
    this.app.post('/api/command', async (req, res) => {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Komut gerekli' });
      try {
        await this.botManager.sendCommand(command);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // API: Görsel
    this.app.get('/api/vision/latest', (req, res) => {
      const dir = path.join(__dirname, '../../temp_vision');
      if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Görsel yok' });
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().reverse();
      if (files.length === 0) return res.status(404).json({ error: 'Görsel yok' });
      res.sendFile(path.join(dir, files[0]));
    });

    // API: Bot durumu
    this.app.get('/api/status', (req, res) => {
      const status = this.botManager.getStatus();
      res.json(status);
    });

    // API: Hafıza ara
    this.app.post('/api/memory/search', express.json(), async (req, res) => {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: 'Sorgu gerekli' });
      try {
        const results = await this.botManager.searchMemory(query);
        res.json({ results });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Socket.io
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling']
    });

    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      Logger.info(`🟢 Dashboard bağlandı: ${socket.id}`);
      socket.emit('status', this.botManager.getStatus());

      const interval = setInterval(() => {
        socket.emit('status', this.botManager.getStatus());
      }, 5000);

      socket.on('disconnect', () => {
        clearInterval(interval);
        Logger.info(`🔴 Dashboard ayrıldı: ${socket.id}`);
      });
    });
  }

  // Log broadcast
  broadcastLog(level, message) {
    this.io.emit('log', { level, message, timestamp: Date.now() });
  }

  start() {
    this.server.listen(this.port, () => {
      Logger.success(`🌐 Web Dashboard: http://localhost:${this.port}`);
    });
  }
}

module.exports = WebServer;
