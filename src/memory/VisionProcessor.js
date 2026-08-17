// src/memory/VisionProcessor.js
const { createCanvas } = require('canvas');
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
const path = require('path');

/**
 * CLIP modeli ile görsel işleme ve embedding çıkarma
 * Botun etrafındaki blokları 2D harita olarak çizer.
 */
class VisionProcessor {
  constructor() {
    this.embedder = null;
    this.initialized = false;
    this.tempDir = path.join(__dirname, '../../temp_vision');
  }

  /**
   * CLIP modelini yükle (ilk çağrıda indirir, sonra cache'den kullanır)
   * @param {string} model - Xenova'daki model adı
   */
  async init(model = 'Xenova/clip-vit-base-patch32') {
    if (this.initialized) return;

    console.log('🖼️ CLIP modeli yükleniyor (ilk seferde 1-2 dakika sürebilir)...');

    try {
      this.embedder = await pipeline('feature-extraction', model);
      this.initialized = true;

      // Geçici klasörü oluştur
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      console.log('✅ Görsel işleme modeli hazır.');
    } catch (err) {
      console.error('❌ CLIP modeli yüklenemedi:', err.message);
      throw err;
    }
  }

  /**
   * Bot'un etrafındaki blokları 2D renkli harita olarak çizer.
   * @param {object} bot - Mineflayer bot instance'ı
   * @param {number} radius - Görüş yarıçapı (blok cinsinden, varsayılan 8)
   * @returns {string} Kaydedilen PNG dosyasının yolu
   */
  captureWorldAsImage(bot, radius = 8) {
    if (!bot || !bot.entity) {
      throw new Error('Bot geçersiz veya spawn olmamış.');
    }

    const size = radius * 2 + 1;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const pos = bot.entity.position.floored();

    // Blok -> Renk eşleştirme tablosu (Minecraft renkleri)
    const colorMap = {
      air: '#FFFFFF',
      grass_block: '#7CB342',
      dirt: '#8D6E63',
      stone: '#9E9E9E',
      oak_log: '#6D4C41',
      oak_planks: '#D7A86E',
      oak_leaves: '#4CAF50',
      water: '#2196F3',
      bedrock: '#424242',
      diamond_ore: '#00BCD4',
      iron_ore: '#FFC107',
      gold_ore: '#FFD700',
      coal_ore: '#212121',
      redstone_ore: '#F44336',
      emerald_ore: '#4CAF50',
      sand: '#FDD835',
      gravel: '#BDBDBD',
      cobblestone: '#757575',
      brick: '#C62828',
      netherrack: '#6D1A1A',
      obsidian: '#1A1A2E',
      crafting_table: '#5D4037',
      furnace: '#4E342E',
      chest: '#8D6E63',
      glass: '#B3E5FC',
      // ... daha fazla blok eklenebilir
    };

    // Haritayı çiz
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const block = bot.blockAt(pos.offset(x, 0, z));
        const color = colorMap[block?.name] || '#FF00FF'; // Bilinmeyen blok -> Magenta
        ctx.fillStyle = color;
        ctx.fillRect(x + radius, z + radius, 1, 1);
      }
    }

    // Sınır çizgisi ekle
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.1;
    ctx.strokeRect(0, 0, size, size);

    // Dosyayı kaydet
    const timestamp = Date.now();
    const filename = `vision_${timestamp}.png`;
    const filePath = path.join(this.tempDir, filename);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);

    console.log(`📸 Görsel yakalandı: ${filename}`);
    return filePath;
  }

  /**
   * Bir görsel dosyasından CLIP embedding (vektör) çıkar.
   * @param {string} imagePath - PNG dosya yolu
   * @returns {Promise<number[]>} 512 boyutlu embedding
   */
  async getImageEmbedding(imagePath) {
    if (!this.initialized) await this.init();

    try {
      // Dosyayı oku
      const imageBuffer = fs.readFileSync(imagePath);

      // CLIP modeline ver (base64 veya buffer olarak)
      const result = await this.embedder(imageBuffer, { pooling: 'mean' });

      // Float32Array'den normal diziye çevir
      return Array.from(result.data);
    } catch (err) {
      console.error('❌ Embedding çıkarılamadı:', err.message);
      throw err;
    }
  }

  /**
   * Bot'un etrafını görüntüleyip embedding'ini döndür (tek adımda)
   * @param {object} bot - Mineflayer bot
   * @param {number} radius
   * @returns {Promise<{ imagePath: string, embedding: number[] }>}
   */
  async captureAndEmbed(bot, radius = 8) {
    const imagePath = this.captureWorldAsImage(bot, radius);
    const embedding = await this.getImageEmbedding(imagePath);
    return { imagePath, embedding };
  }

  /**
   * Eski görselleri temizle (disk alanı için)
   * @param {number} keepCount - Kaç adet en son görsel saklansın
   */
  cleanOldImages(keepCount = 50) {
    if (!fs.existsSync(this.tempDir)) return;

    const files = fs
      .readdirSync(this.tempDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => ({
        name: f,
        path: path.join(this.tempDir, f),
        time: fs.statSync(path.join(this.tempDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Eski görsel silindi: ${file.name}`);
      }
    }
  }
}

module.exports = VisionProcessor;
