// src/memory/VectorMemory.js
const lancedb = require('@lancedb/lancedb');
const path = require('path');
const fs = require('fs');

class VectorMemory {
  constructor(dbPath = './vectordb') {
    this.dbPath = dbPath;
    this.db = null;
    this.table = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
    this.db = await lancedb.connect(this.dbPath);
    const tables = await this.db.tableNames();
    if (!tables.includes('memories')) {
      await this.db.createTable('memories', [
        {
          id: '0',
          vector: Array(512).fill(0),
          text: 'örnek hafıza',
          coordinates: '0,0,0',
          botId: 'system',
          timestamp: Date.now(),
        }
      ]);
      console.log('🗄️ Yeni "memories" tablosu oluşturuldu.');
    }
    this.table = await this.db.openTable('memories');
    this.initialized = true;
    console.log('🗄️ Vektör Veritabanı bağlantısı başarılı.');
  }

  async saveMemory(vector, text, coordinates, botId = 'unknown') {
    if (!this.initialized) await this.init();
    const id = `${Date.now()}_${botId.replace(/\s/g, '')}`;
    await this.table.add([
      { id, vector, text, coordinates, botId, timestamp: Date.now() }
    ]);
    console.log(`💾 Hafıza kaydedildi: ${text.substring(0, 50)}... (${coordinates})`);
    return id;
  }

  async searchMemories(queryVector, limit = 5) {
    if (!this.initialized) await this.init();
    const results = await this.table.search(queryVector).limit(limit).execute();
    return results.map(r => ({
      id: r.id,
      text: r.text,
      coordinates: r.coordinates,
      botId: r.botId,
      timestamp: r.timestamp,
      score: r._distance
    }));
  }

  async getMemoriesByCoords(x, y, z, radius = 10) {
    if (!this.initialized) await this.init();
    const all = await this.table.query().execute();
    return all.filter(r => {
      const [cx, cy, cz] = r.coordinates.split(',').map(Number);
      const dist = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2 + (cz - z) ** 2);
      return dist < radius;
    });
  }

  async count() {
    if (!this.initialized) await this.init();
    const all = await this.table.query().execute();
    return all.length;
  }
}

module.exports = VectorMemory;
