const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { collectBlock } = require('mineflayer-collectblock');
const fishing = require('mineflayer-fishing');
const EventEmitter = require('events');

class BotClient extends EventEmitter {
  constructor() {
    super();
    this.bot = null;
    this.username = null;
    this.host = null;
    this.port = null;
    this.connected = false;
    this.reconnectTimer = null;
  }

  connect(username, host, port) {
    this.username = username;
    this.host = host;
    this.port = port;

    if (this.bot) {
      this.bot.end();
      this.bot = null;
    }

    this.bot = mineflayer.createBot({
      host: this.host,
      port: parseInt(this.port),
      username: this.username,
      // auth: 'microsoft' // Gerekirse ekleyin
    });

    // Eklentiler
    this.bot.loadPlugin(pathfinder);
    this.bot.loadPlugin(collectBlock);
    this.bot.loadPlugin(fishing);

    // Olayları ilet
    this.bot.once('spawn', () => {
      this.connected = true;
      this.emit('spawn');
      console.log(`✅ Bot ${this.username} giriş yaptı!`);
    });

    this.bot.on('chat', (username, message) => {
      this.emit('chat', username, message);
    });

    this.bot.on('error', (err) => {
      this.emit('error', err);
    });

    this.bot.on('end', () => {
      this.connected = false;
      this.emit('end');
      console.log('❌ Bağlantı kesildi, yeniden bağlanmayı deneyeceğim...');
      this.scheduleReconnect();
    });

    // Bot'un diğer tüm özelliklerini doğrudan erişim için proxy yapalım
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (target.bot && prop in target.bot) {
          const value = target.bot[prop];
          if (typeof value === 'function') {
            return value.bind(target.bot);
          }
          return value;
        }
        return undefined;
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.connected && this.host && this.port && this.username) {
        console.log('🔄 Yeniden bağlanılıyor...');
        this.connect(this.username, this.host, this.port);
      }
    }, 5000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.bot) {
      this.bot.end();
      this.bot = null;
    }
    this.connected = false;
  }

  // Bot'un sohbet mesajı gönderme
  chat(message) {
    if (this.bot && this.connected) {
      this.bot.chat(message);
    }
  }

  // Bot durumu
  getStatus() {
    if (!this.bot || !this.connected || !this.bot.entity) {
      return { online: false };
    }
    const pos = this.bot.entity.position;
    return {
      online: true,
      username: this.username,
      host: this.host,
      port: this.port,
      position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
      health: Math.round(this.bot.entity.health),
      food: Math.round(this.bot.entity.food),
      inventory: this.bot.inventory.items().map(i => `${i.name}x${i.count}`)
    };
  }
}

module.exports = BotClient;
