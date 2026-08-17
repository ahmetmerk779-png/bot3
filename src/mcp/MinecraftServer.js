const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const axios = require('axios');
const cheerio = require('cheerio');

class MinecraftServer {
  constructor(bot) {
    this.bot = bot;
    this.server = new McpServer({ name: 'minecraft-bot', version: '1.0.0' });
    this.registerTools();
  }

  registerTools() {
    this.server.tool(
      'web_search',
      'Minecraft Wiki\'de arama yap.',
      { query: z.string() },
      async ({ query }) => {
        try {
          const url = `https://minecraft.wiki/w/Special:Search?search=${encodeURIComponent(query)}`;
          const res = await axios.get(url, { timeout: 10000 });
          const $ = cheerio.load(res.data);
          const link = $('.mw-search-result-heading a').first().attr('href');
          if (!link) return { content: [{ type: 'text', text: 'Sonuç bulunamadı.' }] };
          const pageRes = await axios.get(`https://minecraft.wiki${link}`, { timeout: 10000 });
          const $$ = cheerio.load(pageRes.data);
          const text = $$('p').first().text().trim().substring(0, 1000);
          return { content: [{ type: 'text', text: `🔍 ${query}\n📄 ${text}` }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Hata: ${err.message}` }] };
        }
      }
    );
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('✅ MCP Sunucusu başlatıldı.');
  }
}

module.exports = MinecraftServer;
