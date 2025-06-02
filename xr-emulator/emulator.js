const messageDisplay = document.getElementById('messageDisplay');
const connectionStatus = document.querySelector('.connection-status');
const voiceStatus = document.querySelector('.voice-status');
const batteryElement = document.querySelector('.battery');
const currentTimeElement = document.getElementById('currentTime');

let socket;
const messageHistory = [];
const notificationSound = {
  play: () => Promise.resolve() // No sound, but no errors
};
const wearerName = 'Dr Dan'; // Added wearer name as shown in image
const xrGlassesId = 'XR-1234'; // Added XR Glasses ID as shown in image

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  setupVoiceRecognition();
  simulateBattery();
  updateClock();
  setInterval(updateClock, 60000);
});

function updateClock() {
  const now = new Date();
  currentTimeElement.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function connectWebSocket() {
  if (socket) socket.close();

  socket = new WebSocket('ws://127.0.0.1:8080');

  socket.onopen = () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.remove('disconnected');
    connectionStatus.classList.add('connected');
    
    socket.send(JSON.stringify({
      type: 'identification',
      deviceName: 'XR Glasses Emulator',
      wearerName: wearerName, // Added wearer name to identification
      xrId: xrGlassesId // Added XR Glasses ID to identification
    }));
  };

  socket.onclose = () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      if (data.type === 'message') {
        displayMessage(data);
      } else if (data.type === 'message_history') {
        data.messages.forEach(msg => displayMessage(msg, false));
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  };
}

function displayMessage(message, playSound = true) {
  messageHistory.push(message);
  if (messageHistory.length > 10) messageHistory.shift();

  if (playSound) {
    notificationSound.play().catch(e => console.log('Audio error:', e));
  }

  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.priority || 'normal'}`;
  messageElement.innerHTML = `
    <div class="message-header">
      <div class="sender-info">
        <span class="message-sender">${message.sender || 'System'}</span>
        ${message.xrId ? `<span class="xr-id">${message.xrId}</span>` : ''}
      </div>
      <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
    </div>
    <div class="message-text">${message.text}</div>
    ${message.priority === 'urgent' ? '<div class="urgent-indicator">URGENT</div>' : ''}
  `;
  
  messageDisplay.innerHTML = '';
  messageDisplay.appendChild(messageElement);
}

function setupVoiceRecognition() {
  if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      voiceStatus.textContent = 'Voice: Listening...';
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length-1][0].transcript.toLowerCase();
      if (transcript.includes('clear message')) {
        clearDisplay();
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'clear_confirmation',
            device: 'XR Glasses',
            wearerName: wearerName, // Added wearer name to clear confirmation
            xrId: xrGlassesId // Added XR Glasses ID to clear confirmation
          }));
        }
      }
      else if (transcript.includes('show history')) {
        displayMessageHistory();
      }
    };
    
    recognition.onerror = (event) => {
      voiceStatus.textContent = `Voice: Error (${event.error})`;
      setTimeout(() => recognition.start(), 1000);
    };
    
    recognition.onend = () => recognition.start();
    recognition.start();
  } else {
    voiceStatus.textContent = 'Voice: Not supported';
  }
}

function displayMessageHistory() {
  if (messageHistory.length === 0) {
    messageDisplay.innerHTML = '<div class="welcome-message">No message history</div>';
    return;
  }

  messageDisplay.innerHTML = '<h3>Message History</h3>';
  messageHistory.forEach(msg => {
    const messageElement = document.createElement('div');
    messageElement.className = `message history-item ${msg.priority || 'normal'}`;
    messageElement.innerHTML = `
      <div class="message-header">
        <div class="sender-info">
          <span class="message-sender">${msg.sender || 'System'}</span>
          ${msg.xrId ? `<span class="xr-id">${msg.xrId}</span>` : ''}
        </div>
        <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="message-text">${msg.text}</div>
    `;
    messageDisplay.appendChild(messageElement);
  });
}

function clearDisplay() {
  messageDisplay.innerHTML = '<div class="welcome-message">Message cleared</div>';
  voiceStatus.textContent = 'Voice: Message cleared';
  setTimeout(() => voiceStatus.textContent = 'Voice: Ready', 2000);
}

function simulateBattery() {
  let battery = 83;
  batteryElement.textContent = `${battery}%`;
  
  setInterval(() => {
    battery = Math.max(0, battery - 1);
    batteryElement.textContent = `${battery}%`;
    batteryElement.className = battery < 20 ? 'battery low' : 'battery';
  }, 60000);
}