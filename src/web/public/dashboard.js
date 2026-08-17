// dashboard.js
const socket = io();

// Bağlantı durumu
socket.on('connect', () => {
  document.getElementById('connectionStatus').textContent = '✅ Bağlı';
  document.getElementById('connectionStatus').className = 'status-badge online';
});
socket.on('disconnect', () => {
  document.getElementById('connectionStatus').textContent = '❌ Bağlantı Kesildi';
  document.getElementById('connectionStatus').className = 'status-badge offline';
});

// Bot durumu güncellemesi
socket.on('status', (data) => {
  if (!data.online) {
    document.getElementById('botName').textContent = 'Çevrimdışı';
    return;
  }
  document.getElementById('botName').textContent = data.username;
  document.getElementById('botCoords').textContent = `${data.position.x}, ${data.position.y}, ${data.position.z}`;
  document.getElementById('botHealth').textContent = data.health;
  document.getElementById('botFood').textContent = data.food;
  document.getElementById('botBusy').textContent = data.isProcessing ? '✅ Evet' : 'Hayır';
  document.getElementById('botMemory').textContent = data.memoryCount || 0;
});

// Sohbet/Log mesajları
socket.on('chat_message', (msg) => {
  addLog(`${msg.username}: ${msg.message}`, 'chat');
});
socket.on('log', (log) => {
  addLog(`[${log.level}] ${log.message}`, log.level === 'error' ? 'error' : 'system');
});

function addLog(text, type = 'system') {
  const logArea = document.getElementById('chatLog');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

// ★ Botu Başlat (Ayarları gönder)
async function startBot() {
  const host = document.getElementById('configHost').value.trim();
  const port = parseInt(document.getElementById('configPort').value) || 25565;
  const username = document.getElementById('configUsername').value.trim() || 'MegaBot';
  const apiKey = document.getElementById('configApiKey').value.trim();

  if (!host) {
    document.getElementById('configStatus').textContent = '❌ Lütfen sunucu adresini girin.';
    return;
  }
  if (!apiKey) {
    document.getElementById('configStatus').textContent = '❌ Groq API anahtarını girin.';
    return;
  }

  document.getElementById('configStatus').textContent = '⏳ Bot başlatılıyor...';

  const response = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, username, apiKey })
  });

  const data = await response.json();
  if (data.success) {
    document.getElementById('configStatus').textContent = '✅ Bot başlatıldı!';
    addLog('🚀 Bot başlatıldı.', 'system');
  } else {
    document.getElementById('configStatus').textContent = '❌ Hata: ' + data.error;
  }
}

// Botu durdur
async function stopBot() {
  const response = await fetch('/api/stop', { method: 'POST' });
  const data = await response.json();
  if (data.success) {
    document.getElementById('configStatus').textContent = '⏹️ Bot durduruldu.';
    addLog('⏹️ Bot durduruldu.', 'system');
  }
}

// Komut Gönderme (artık ! işareti yok, doğal dil)
function sendCommand(command) {
  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  }).then(res => res.json()).then(data => {
    if (data.success) addLog(`📤 Komut gönderildi: ${command}`, 'system');
  });
}

function sendCustomCommand() {
  const input = document.getElementById('commandInput');
  const cmd = input.value.trim();
  if (!cmd) return;
  sendCommand(cmd);
  input.value = '';
}

document.getElementById('commandInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCustomCommand();
});

// Görsel yenileme
function refreshVision() {
  const img = document.getElementById('visionImage');
  img.src = `/api/vision/latest?t=${Date.now()}`;
  img.style.display = 'block';
  document.getElementById('visionPlaceholder').style.display = 'none';
  addLog('🖼️ Görsel yenilendi', 'system');
}

// Hafıza Ara
async function searchMemory() {
  const query = document.getElementById('memoryQuery').value.trim();
  if (!query) return;
  const res = await fetch('/api/memory/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  const container = document.getElementById('memoryResults');
  container.innerHTML = '';
  if (data.results.length === 0) {
    container.innerHTML = '<div>Sonuç bulunamadı.</div>';
    return;
  }
  data.results.forEach(r => {
    const div = document.createElement('div');
    div.textContent = `📍 ${r.coordinates} | ${r.text.substring(0, 60)}... (${r.botId})`;
    container.appendChild(div);
  });
}
