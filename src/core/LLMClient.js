const Groq = require('groq-sdk');

class LLMClient {
  constructor(apiKey) {
    this.groq = new Groq({ apiKey });
  }

  async ask(prompt, systemPrompt = 'Sen yardımcı bir Minecraft asistanısın.') {
    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('LLM Hatası:', error);
      return 'Üzgünüm, şu anda cevap veremiyorum.';
    }
  }
}

module.exports = LLMClient;
