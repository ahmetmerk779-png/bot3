// src/memory/VectorMemory.js
const lancedb = require('lanceb');
const path = require('path');
const fs = require('fs');

/**
 * Merkezi vektör veritabanı (LanceDB)
 * Tüm botların hafızasını ortaklaşa kullanmasını sağlar.
 */
class VectorMemory {
  constructor(dbPath = './vectordb') {
    this.dbPath = dbPath;
    this.db = null;
    this.table = null;
    this.initialized = false;
  }

  /**
   * Veritabanı bağlantısını başlat ve 'memories' tablosunu oluştur.
   */
  async init() {
    if (this.initialized) return;

    try {
      // Klasörü oluştur (Render'da persistent disk olmalı)
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }

      this.db = await lancedb.connect(this.dbPath);

      // Tabloyu kontrol et, yoksa oluştur
      const tables = await this.db.tableNames();
      if (!tables.includes('memories')) {
        // Örnek bir veri ile tabloyu oluştur (schema otomatik oluşur)
        await this.db.createTable('memories', [
          {
            id: '0',
            vector: Array(512).fill(0), // CLIP embedding boyutu 512
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
    } catch (err) {
      console.error('❌ Vektör DB bağlantı hatası:', err.message);
      throw err;
    }
  }

  /**
   * Yeni bir anı kaydet (embedding + metin + koordinat)
   * @param {number[]} vector - CLIP embedding (512 boyutlu)
   * @param {string} text - Açıklayıcı metin
   * @param {string} coordinates - "x,y,z" formatında
   * @param {string} botId - Botun kullanıcı adı
   * @returns {Promise<string>} Kaydedilen ID
   */
  async saveMemory(vector, text, coordinates, botId = 'unknown') {
    if (!this.initialized) await this.init();

    const id = `${Date.now()}_${botId.replace(/\s/g, '')}`;
    try {
      await this.table.add([
        {
          id,
          vector,
          text,
          coordinates,
          botId,
          timestamp: Date.now(),
        },
      ]);
      console.log(`💾 Hafıza kaydedildi: ${text.substring(0, 50)}... (${coordinates})`);
      return id;
    } catch (err) {
      console.error('❌ Hafıza kaydedilemedi:', err.message);
      throw err;
    }
  }

  /**
   * Embedding benzerliğine göre hafızada ara (kosinüs benzerliği)
   * @param {number[]} queryVector - Sorgu embedding'i
   * @param {number} limit - Maksimum sonuç sayısı
   * @returns {Promise<Array>} Benzerlik skoru ile birlikte sonuçlar
   */
  async searchMemories(queryVector, limit = 5) {
    if (!this.initialized) await this.init();

    try {
      // LanceDB'de search metodu ile vektör araması
      const results = await this.table.search(queryVector).limit(limit).execute();
      return results.map((r) => ({
        id: r.id,
        text: r.text,
        coordinates: r.coordinates,
        botId: r.botId,
        timestamp: r.timestamp,
        score: r._distance, // LanceDB'de distance (0 = tam benzer)
      }));
    } catch (err) {
      console.error('❌ Hafıza arama hatası:', err.message);
      return [];
    }
  }

  /**
   * Belirli bir koordinat civarındaki tüm hafızaları getir
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius - Yarıçap (blok cinsinden)
   * @returns {Promise<Array>}
   */
  async getMemoriesByCoords(x, y, z, radius = 10) {
    if (!this.initialized) await this.init();

    try {
      const all = await this.table.query().execute();
      return all.filter((r) => {
        const [cx, cy, cz] = r.coordinates.split(',').map(Number);
        const dist = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2 + (cz - z) ** 2);
        return dist < radius;
      });
    } catch (err) {
      console.error('❌ Koordinat sorgu hatası:', err.message);
      return [];
    }
  }

  /**
   * Tüm hafıza sayısını döndür
   */
  async count() {
    if (!this.initialized) await this.init();
    try {
      const all = await this.table.query().execute();
      return all.length;
    } catch {
      return 0;
    }
  }
}

module.exports = VectorMemory;
