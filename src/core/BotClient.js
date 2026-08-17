const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { collectBlock } = require('mineflayer-collectblock');
const Logger = require('../utils/Logger');

class BotClient {
  constructor(options) {
    this.options = options;
    this.bot = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.bot = mineflayer.createBot(this.options);
      this.bot.loadPlugin(pathfinder);
      this.bot.loadPlugin(collectBlock);

      this.bot.once('spawn', () => {
        Logger.success(`✅ Bot giriş yaptı: ${this.options.username}`);
        resolve();
      });

      this.bot.on('error', (err) => {
        Logger.error('Bot hatası:', err.message);
        reject(err);
      });

      this.bot.on('end', () => {
        Logger.warn('Bot bağlantısı kesildi.');
      });
    });
  }

  end() {
    if (this.bot) this.bot.end();
  }

  get entity() {
    return this.bot ? this.bot.entity : null;
  }

  get inventory() {
    return this.bot ? this.bot.inventory : null;
  }

  get username() {
    return this.bot ? this.bot.username : null;
  }

  get version() {
    return this.bot ? this.bot.version : null;
  }

  chat(message) {
    if (this.bot) this.bot.chat(message);
  }

  findBlock(options) {
    return this.bot ? this.bot.findBlock(options) : null;
  }

  findBlocks(options) {
    return this.bot ? this.bot.findBlocks(options) : [];
  }

  blockAt(pos) {
    return this.bot ? this.bot.blockAt(pos) : null;
  }

  async waitForTicks(ticks) {
    if (this.bot) await this.bot.waitForTicks(ticks);
  }

  on(event, callback) {
    if (this.bot) this.bot.on(event, callback);
  }

  emit(event, ...args) {
    if (this.bot) this.bot.emit(event, ...args);
  }
}

module.exports = BotClient;
