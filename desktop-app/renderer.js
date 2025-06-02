const { ipcRenderer, shell } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const urgentCheckbox = document.getElementById('urgentCheckbox');
  const statusElement = document.getElementById('status');
  const deviceListElement = document.getElementById('deviceList');
  const openEmulatorBtn = document.getElementById('openEmulator');
  const messageHistoryDiv = document.getElementById('messageHistory');
  const recentMessagesDiv = document.getElementById('recentMessages');
  const usernameInput = document.getElementById('usernameInput');
  const xrIdInput = document.getElementById('xrIdInput');

  // Track cleared messages to avoid duplicates
  const clearedMessages = new Set();

  // Initialize connection status
  statusElement.textContent = 'Connecting';
  statusElement.className = 'connecting';

  ipcRenderer.on('connection-status', (_, status) => {
    statusElement.textContent = status;
    statusElement.className = status.toLowerCase();
  });

  ipcRenderer.on('update-devices', (_, devices) => {
    deviceListElement.innerHTML = devices?.length
      ? devices.map(device => `<li>${device}</li>`).join('')
      : '<li>No devices connected</li>';
  });

  ipcRenderer.on('new-message', (_, message) => {
    addMessageToHistory(message);
    addToRecentMessages(message);
  });

  ipcRenderer.on('message-cleared', (_, data) => {
    if (!clearedMessages.has(data.messageId)) {
      clearedMessages.add(data.messageId);
      addSystemMessage(`Message was cleared by ${data.by}`);
      recentMessagesDiv.innerHTML = '<div class="system-message">Messages cleared</div>';
    }
  });

  sendButton.addEventListener('click', sendMessage);
  
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  openEmulatorBtn.addEventListener('click', () => {
    ipcRenderer.send('open-emulator');
    shell.openExternal('http://localhost:3000/display.html');
  });

  function addMessageToHistory(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.priority || 'normal'}`;
    
    const time = new Date(message.timestamp || new Date());
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = time.toLocaleDateString();
    
    messageElement.innerHTML = `
      <div class="message-header">
        <div class="sender-info">
          <span class="sender-name">${message.sender || 'You'}</span>
          <span class="xr-id">${message.xrId || 'XR-1234'}</span>
        </div>
        <div class="message-time">
          <span class="message-date">${dateString}</span>
          <span class="message-clock">${timeString}</span>
        </div>
      </div>
      <div class="message-content">${message.text}</div>
      ${message.priority === 'urgent' ? '<div class="urgent-badge">URGENT</div>' : ''}
    `;
    
    messageHistoryDiv.appendChild(messageElement);
    messageHistoryDiv.scrollTop = messageHistoryDiv.scrollHeight;
  }

  function addToRecentMessages(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `recent-message ${message.priority || 'normal'}`;
    
    const time = new Date(message.timestamp || new Date());
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    messageElement.innerHTML = `
      <div class="recent-message-header">
        <span class="recent-sender">${message.sender || 'You'}</span>
        <span class="recent-xr-id">${message.xrId || 'XR-1234'}</span>
        <span class="recent-time">${timeString}</span>
      </div>
      <div class="recent-message-content">${message.text}</div>
    `;
    
    recentMessagesDiv.insertBefore(messageElement, recentMessagesDiv.firstChild);
    
    if (recentMessagesDiv.children.length > 5) {
      recentMessagesDiv.removeChild(recentMessagesDiv.lastChild);
    }
  }

  function addSystemMessage(text) {
    const systemElement = document.createElement('div');
    systemElement.className = 'system-message';
    systemElement.textContent = text;
    messageHistoryDiv.appendChild(systemElement);
    messageHistoryDiv.scrollTop = messageHistoryDiv.scrollHeight;
  }

  async function sendMessage() {
    const message = messageInput.value.trim();
    const username = usernameInput.value.trim() || 'Desktop';
    const xrId = xrIdInput.value.trim() || 'XR-1234';
    
    if (message) {
      try {
        const { success } = await ipcRenderer.invoke('send-message', {
          text: message,
          priority: urgentCheckbox.checked ? 'urgent' : 'normal',
          sender: username,
          xrId: xrId
        });
        
        if (success) {
          addMessageToHistory({
            sender: username,
            text: message,
            priority: urgentCheckbox.checked ? 'urgent' : 'normal',
            timestamp: new Date().toISOString(),
            xrId: xrId
          });
          addToRecentMessages({
            sender: username,
            text: message,
            priority: urgentCheckbox.checked ? 'urgent' : 'normal',
            timestamp: new Date().toISOString(),
            xrId: xrId
          });
          messageInput.value = '';
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }
});