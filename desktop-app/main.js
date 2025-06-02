const { app, BrowserWindow, ipcMain } = require('electron');
const WebSocket = require('ws');
const path = require('path');

let mainWindow;
let socket;
let isConnected = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  connectToServer();
}

function connectToServer() {
  if (socket) {
    socket.removeAllListeners();
    socket.close();
  }

  mainWindow.webContents.send('connection-status', 'Connecting');
  isConnected = false;

  socket = new WebSocket('ws://localhost:8080');

  socket.on('open', () => {
    isConnected = true;
    mainWindow.webContents.send('connection-status', 'Connected');
    socket.send(JSON.stringify({
      type: 'identification',
      deviceName: 'Desktop App'
    }));
  });

  socket.on('close', () => {
    if (isConnected) {
      mainWindow.webContents.send('connection-status', 'Disconnected');
      isConnected = false;
    }
    setTimeout(connectToServer, 3000);
  });

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'device_list') {
        mainWindow.webContents.send('update-devices', message.devices || []);
      } else if (message.type === 'message') {
        mainWindow.webContents.send('new-message', message);
      } else if (message.type === 'message_cleared') {
        mainWindow.webContents.send('message-cleared', {
          by: message.by,
          messageId: message.messageId
        });
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ipcMain.handle('send-message', (_, message) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const messageId = Date.now();
      socket.send(JSON.stringify({
        type: 'message',
        ...message,
        timestamp: new Date().toISOString(),
        messageId: messageId
      }));
      return { success: true, messageId };
    }
    return { success: false };
  });

  ipcMain.on('open-emulator', () => {
    if (isConnected) {
      mainWindow.webContents.send('connection-status', 'Connected');
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});