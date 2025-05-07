const socket = io();
let username = '';
let group = '';

// Login button handler
document.getElementById('login-btn').onclick = () => {
  const user = document.getElementById('username-select').value;
  const grp = document.getElementById('group-select').value;
  const password = document.getElementById('password-input').value;

  if (user && grp && password === 'password') {
    username = user;
    group = grp;

    updateTopBar();

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('chat-page').style.display = 'flex';
    socket.emit('joinGroup', { username, group });
  } else {
    alert('Select username, group, and enter the correct password!');
  }
};

// Switch group handler
document.getElementById('switch-group-select').onchange = () => {
  const newGroup = document.getElementById('switch-group-select').value;
  if (newGroup) {
    socket.emit('leaveGroup');
    group = newGroup;
    document.getElementById('chat-body').innerHTML = ''; // Clear messages
    updateTopBar();
    socket.emit('joinGroup', { username, group });
  }
};

// Send button handler
document.getElementById('send-btn').onclick = () => {
  const inputField = document.getElementById('chat-input');
  const chatText = inputField.value.trim();

  const match = chatText.match(/^(.+?):\s*(.+)$/);
  if (!match) {
    alert("Use format: WorkOrderID: Amount or Expression (e.g. WO123: 100+50)");
    return;
  }

  const workOrderId = match[1].trim();
  const expression = match[2].trim();

  try {
    const calculatedValue = math.evaluate(expression);
    if (isNaN(calculatedValue)) throw new Error("Invalid number");

    const timestamp = new Date().toISOString();

    socket.emit('newEntry', {
      username,
      group,
      workOrderId,
      expression,
      plusAmount: calculatedValue,
      timestamp
    });

    inputField.value = '';
  } catch (err) {
    alert("Invalid math expression!");
    console.error("Math error:", err);
  }
};

// Allow Enter to send
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('send-btn').click();
  }
});

// Leave button handler
document.getElementById('leave-btn').onclick = () => {
  socket.emit('leaveGroup');
  document.getElementById('chat-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  // Clear group and username
  username = '';
  group = '';
  updateTopBar();
};

// Message handler
socket.on('message', ({ username: sender, workOrderId, expression, total, timestamp }) => {
  // Check if any of the values are undefined
  if (typeof sender === 'undefined' || typeof workOrderId === 'undefined' || typeof expression === 'undefined' || typeof total === 'undefined' || typeof timestamp === 'undefined') {
    console.error("Received undefined data in message:", { sender, workOrderId, expression, total, timestamp });
    return; // Skip this message if any value is undefined
  }

  const messageContainer = document.createElement('div');
  messageContainer.classList.add('message-entry');
  
  // Add class based on whether the message is from the current user or another user
  messageContainer.classList.add(sender === username ? 'user-message' : 'other-message');

  const formattedTimestamp = new Date(timestamp).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const messageContent = document.createElement('div');
  messageContent.innerHTML =
    `<strong>${sender}</strong>: <span class="wo-id">${workOrderId}</span> → ${expression} = ${total}
     <div class="timestamp">${formattedTimestamp}</div>`;

  messageContainer.appendChild(messageContent);
  document.getElementById('chat-body').appendChild(messageContainer);
  document.getElementById('chat-body').scrollTop = document.getElementById('chat-body').scrollHeight;
});


// Group total update
socket.on('updateTotal', (total) => {
  document.getElementById('total-display').innerText = `Group Total: ${total}`;
});

// Export
document.getElementById('export-btn').onclick = async () => {
  if (!group) {
    alert('Please select a group before exporting!');
    return;
  }

  try {
    const response = await fetch(`/export?group=${group}`);
    if (!response.ok) throw new Error("Failed to download");

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `export-${group}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(link.href); // Clean up memory
  } catch (err) {
    alert('Failed to export data.');
    console.error(err);
  }
};

// Search
document.getElementById('search-input').addEventListener('input', () => {
  const searchText = document.getElementById('search-input').value.toLowerCase();
  const messages = document.querySelectorAll('.message-entry');

  messages.forEach(message => {
    const messageText = message.innerText.toLowerCase();
    message.style.display = messageText.includes(searchText) ? 'block' : 'none';
  });
});

// Language support
let currentLang = 'en';
let translations = {};

function loadLanguage(lang) {
  fetch(`/lang/${lang}.json`)
    .then(res => res.json())
    .then(data => {
      translations = data;
      applyTranslations();
    });
}

function applyTranslations() {
  document.querySelector('button#login-btn').innerText = translations.login;
  document.querySelector('option[value=""]').innerText = translations.selectUser;
  document.getElementById('group-select').options[0].innerText = translations.selectGroup;
  document.getElementById('password-input').placeholder = translations.enterPassword;
  document.getElementById('send-btn').innerText = translations.send;
  document.getElementById('export-btn').innerText = translations.export;
  document.getElementById('total-display').innerText = `${translations.groupTotal}: 0`;
  document.getElementById('current-user').innerText = `${translations.currentUser}: ${username}`;
  document.getElementById('current-group').innerText = `${translations.currentGroup}: ${group}`;
}

document.getElementById('language-select').addEventListener('change', async (e) => {
  const lang = e.target.value;
  const res = await fetch(`/lang/${lang}`);
  const translations = await res.json();

  // Then apply translations
  document.querySelector('#login-btn').innerText = translations.login;
  document.querySelector('#leave-btn').innerText = translations.logout;
  document.querySelector('#total-display').innerText = translations.groupTotal;
  document.querySelector('#send-btn').innerText = translations.send;
  document.querySelector('#export-btn').innerText = translations.export;
  document.querySelector('#end-btn').innerText = translations.endgroup;
});

// Helper
function updateTopBar() {
  document.getElementById('current-user').innerText = `Current User: ${username}`;
  document.getElementById('current-group').innerText = `Current Group: ${group}`;
}

// End button handler
document.getElementById('end-btn').onclick = () => {
  if (!group) {
    alert('Please select a group before ending!');
    return;
  }

  // Emit the endGroup event to the server
  socket.emit('endGroup', group); // Send a request to reset totals and clear messages

  // Clear chat messages in the UI
  document.getElementById('chat-body').innerHTML = '';
  
  // Reset the group total display
  document.getElementById('total-display').innerText = 'Group Total: 0';
  
  alert('Group has been reset!');
};

