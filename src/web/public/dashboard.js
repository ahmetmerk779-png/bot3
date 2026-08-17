const socket = io();

socket.on('connect', () => {
  document.getElementById('connectionStatus').textContent = '✅ Bağlı';
});
socket.on('disconnect', () => {
  document.getElementById('connectionStatus').textContent = '❌ Bağlantı Kesildi';
});

socket.on('status', (data) => {
  if (!data.online) {
    document.getElementById('botName').textContent = 'Çevrimdışı';
    return;
  }
  document.getElementById('botName').textContent = data.username;
  document.getElementById('botCoords').textContent = `${data.position.x}, ${data.position.y}, ${data.position.z}`;
  document.getElementById('botHealth').textContent = data.health;
  document.getElementById('botFood').textContent = data.food;
  document.getElementById('botBusy').textContent = data.isProcessing ? 'Evet' : 'Hayır';
});

socket.on('chat_message', (msg) => {
  addLog(`${msg.username}: ${msg.message}`, 'chat');
});

function addLog(text, type) { /* ... */ }

async function startBot() {
  const host = document.getElementById('configHost').value.trim();
  const port = parseInt(document.getElementById('configPort').value) || 25565;
  const username = document.getElementById('configUsername').value.trim() || 'MegaBot';
  const apiKey = document.getElementById('configApiKey').value.trim();
  if (!host || !apiKey) return alert('Host ve API anahtarı gerekli.');
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, username, apiKey })
  });
  const data = await res.json();
  if (data.success) addLog('Bot başlatıldı.', 'system');
}

function sendCommand(command) {
  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
}
