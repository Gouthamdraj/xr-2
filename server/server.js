const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080, clientTracking: true });

console.log("WebSocket server running on ws://localhost:8080");

const clients = new Set();
const messageHistory = [];

const heartbeat = (ws) => {
  ws.isAlive = true;
};

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);
  ws.isAlive = true;
  
  ws.on('pong', () => heartbeat(ws));
  ws.on('error', (error) => console.error('WS Error:', error));

  // Send history to new connections
  if (messageHistory.length > 0) {
    ws.send(JSON.stringify({
      type: 'message_history',
      messages: messageHistory.slice(-10)
    }));
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      if (data.type === 'identification') {
        ws.deviceName = data.deviceName || 'Unknown Device';
        broadcastDeviceList();
        return;
      }
      
      if (data.type === 'message') {
        const messageWithId = {
          ...data,
          id: Date.now()
        };
        messageHistory.push(messageWithId);
        
        clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            console.log('Forwarding to:', client.deviceName);
            client.send(JSON.stringify(messageWithId));
          }
        });
      }
      
      if (data.type === 'clear_confirmation') {
        clients.forEach(client => {
          if (client.deviceName === 'Desktop App') {
            client.send(JSON.stringify({
              type: 'message_cleared',
              by: data.device,
              timestamp: new Date().toISOString()
            }));
          }
        });
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    broadcastDeviceList();
  });
});

function broadcastDeviceList() {
  const deviceList = Array.from(clients)
    .filter(client => client.deviceName)
    .map(client => client.deviceName);
  
  const message = JSON.stringify({
    type: 'device_list',
    devices: deviceList
  });
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Heartbeat check every 30 seconds
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close();
  process.exit();
});