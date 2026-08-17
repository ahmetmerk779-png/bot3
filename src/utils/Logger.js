// src/utils/Logger.js
const fs = require('fs');
const path = require('path');

class Logger {
  static log(level, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logLine);
    // Dosyaya da yazmak istersen:
    // fs.appendFileSync(path.join(__dirname, '../../logs.txt'), logLine + '\n');
  }

  static info(msg) { this.log('info', msg); }
  static success(msg) { this.log('success', msg); }
  static warn(msg) { this.log('warn', msg); }
  static error(msg) { this.log('error', msg); }
}

module.exports = Logger;
