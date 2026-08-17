const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const Logger = require('../utils/Logger');

class WebServer {
  constructor(botManager) {
    this.app = express();
    this.botManager = botManager;
    this.port = process.env.PORT || 3000;

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    this.app.post('/api/config', async (req, res) => {
      const { host, port, username, apiKey } = req.body;
      if (!host || !apiKey) return res.status(400).json({ success: false, error: 'Host ve API anahtarı gerekli.' });
      try {
        await this.botManager.startBot({ host, port, username, apiKey });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    this.app.post('/api/stop', async (req, res) => {
      try { await this.botManager.stopBot(); res.json({ success: true }); }
      catch (err) { res.status(500).json({ success: false, error: err.message }); }
    });

    this.app.post('/api/command', async (req, res) => {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Komut gerekli' });
      try { await this.botManager.sendCommand(command); res.json({ success: true }); }
      catch (err) { res.status(500).json({ success: false, error: err.message }); }
    });

    this.app.get('/api/status', (req, res) => {
      res.json(this.botManager.getStatus());
    });

    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, { cors: { origin: '*' }, transports: ['websocket', 'polling'] });
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      socket.emit('status', this.botManager.getStatus());
      const interval = setInterval(() => {
        socket.emit('status', this.botManager.getStatus());
      }, 5000);
      socket.on('disconnect', () => clearInterval(interval));
    });
  }

  start() {
    this.server.listen(this.port, () => {
      Logger.success(`🌐 Dashboard: http://localhost:${this.port}`);
    });
  }
}

module.exports = WebServer;
