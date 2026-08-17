const socket = io();

// Bağlantı durumu
socket.on('connect', () => {
  document.getElementById('connectionStatus').textContent = '✅ Bağlı';
});
socket.on('disconnect', () => {
  document.getElementById('connectionStatus').textContent = '❌ Bağlantı Kesildi';
});

// Bot durumu güncelle
socket.on('status', (data) => {
  if (!data || !data.online) {
    document.getElementById('botName').textContent = 'Çevrimdışı';
    return;
  }
  document.getElementById('botName').textContent = data.username;
  document.getElementById('botCoords').textContent = `${data.position.x}, ${data.position.y}, ${data.position.z}`;
  document.getElementById('botHealth').textContent = data.health;
  document.getElementById('botFood').textContent = data.food;
  document.getElementById('botBusy').textContent = data.isProcessing ? '✅ Evet' : 'Hayır';
});

// Sohbet mesajları
socket.on('chat_message', (msg) => {
  addLog(`${msg.username}: ${msg.message}`, 'chat');
});

function addLog(text, type = 'system') {
  const logArea = document.getElementById('chatLog');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

// Sunucuya bağlan
document.getElementById('connectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const host = document.getElementById('host').value.trim();
  const port = parseInt(document.getElementById('port').value);
  if (!username || !host || !port) return alert('Tüm alanları doldurun!');

  const res = await fetch('/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, host, port })
  });
  const data = await res.json();
  if (data.success) {
    addLog(`✅ Bot ${username} bağlanıyor...`, 'system');
  } else {
    addLog(`❌ Hata: ${data.error}`, 'error');
  }
});

// Komut gönder (doğal dil)
async function sendCommand() {
  const input = document.getElementById('commandInput');
  const cmd = input.value.trim();
  if (!cmd) return;
  addLog(`📤 Siz: ${cmd}`, 'system');
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd })
  });
  const data = await res.json();
  if (!data.success) {
    addLog(`❌ Hata: ${data.error}`, 'error');
  }
  input.value = '';
}

document.getElementById('commandInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCommand();
});

function refreshVision() {
  const img = document.getElementById('visionImage');
  img.src = `/api/vision/latest?t=${Date.now()}`;
  img.style.display = 'block';
            }
