const Groq = require('groq-sdk');

class LLMClient {
  constructor(apiKey) {
    this.client = new Groq({ apiKey });
  }

  async ask(prompt, model = 'llama3-70b-8192') {
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      return response.choices[0].message.content;
    } catch (err) {
      console.error('Groq API hatası:', err.message);
      throw err;
    }
  }
}

module.exports = LLMClient;
