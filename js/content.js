// content.js - Content script for Teams Notification Email Sender

// Store the latest message to avoid duplicate notifications
let lastLatestPreview = "";
let searchTerm = "devin"; // Default search term, will be updated from storage

// Initialize from storage
chrome.storage.local.get(['emailConfig', 'isEnabled'], (result) => {
  if (result.emailConfig && result.emailConfig.searchTerm) {
    searchTerm = result.emailConfig.searchTerm;
  }
  
  // Start monitoring if enabled
  if (result.isEnabled !== false) {
    initializeMonitoring();
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    // Respond to ping to indicate content script is running
    sendResponse({ status: 'active' });
    return true;
  } else if (message.type === 'UPDATE_CONFIG') {
    // Update configuration
    if (message.config && message.config.searchTerm) {
      searchTerm = message.config.searchTerm;
    }
    sendResponse({ status: 'updated' });
    return true;
  }
});

// Helper function to parse a timestamp string into a Date object.
function parseTimestamp(tsText) {
  const now = new Date();
  tsText = tsText.trim();
  if (tsText.includes(':')) {
    // Format like "2:18 PM" – assume today's date.
    return new Date(`${now.toDateString()} ${tsText}`);
  } else {
    // Format like "3/26" – assume it's MM/DD for the current year.
    const match = tsText.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (match) {
      const month = match[1].padStart(2, '0');
      const day = match[2].padStart(2, '0');
      return new Date(`${now.getFullYear()}-${month}-${day}`);
    }
  }
  return null;
}

// Function to check for the latest chat message and update if changed.
function checkLatestChat() {
  const chatsContainer = document.querySelector('div[aria-label="Chats"]');
  if (!chatsContainer) {
    console.log("Chats container not found.");
    return;
  }

  // Get all chat items.
  const chatItems = chatsContainer.querySelectorAll('div.chatListItem_mainMedia');

  let latestPreviewSpan = null;
  let latestTime = null;
  let senderName = "";

  // Iterate over chat items to find the latest one.
  chatItems.forEach(chatItem => {
    const tsSpan = chatItem.querySelector('span[data-aa-class="ChatListTimeStamp"]');
    const previewSpan = chatItem.querySelector('span[data-tid="chat-list-item-preview-message"]');
    
    // Try to get sender name
    const nameElement = chatItem.querySelector('span[data-tid="chat-list-item-title"]');
    const currentSenderName = nameElement ? nameElement.textContent.trim() : "Unknown";
    
    if (tsSpan && previewSpan) {
      const tsText = tsSpan.textContent;
      const tsDate = parseTimestamp(tsText);
      if (tsDate) {
        if (!latestTime || tsDate > latestTime) {
          latestTime = tsDate;
          latestPreviewSpan = previewSpan;
          senderName = currentSenderName;
        }
      }
    }
  });

  if (latestPreviewSpan) {
    const latestPreviewText = latestPreviewSpan.textContent.trim();
    
    // Only process if this is a new message
    if (latestPreviewText !== lastLatestPreview) {
      console.log("Latest message updated:", latestPreviewText);
      lastLatestPreview = latestPreviewText;
      
      // Check if message contains the search term (case insensitive)
      if (latestPreviewText.toLowerCase().includes(searchTerm.toLowerCase())) {
        console.log(`Message contains "${searchTerm}".`);
        
        // Send message to background script
        chrome.runtime.sendMessage({
          type: 'TEAMS_MESSAGE_DETECTED',
          messageText: latestPreviewText,
          sender: senderName,
          timestamp: latestTime ? latestTime.toISOString() : new Date().toISOString()
        });
      } else {
        console.log(`Message does not contain "${searchTerm}".`);
      }
    }
  }
}

// Function to start monitoring Teams messages
function initializeMonitoring() {
  console.log("Teams notification monitoring initialized");
  
  // Run the check immediately, then every 10 seconds
  checkLatestChat();
  setInterval(checkLatestChat, 10000);
  
  // Add a visual indicator that the extension is active
  const indicator = document.createElement('div');
  indicator.style.position = 'fixed';
  indicator.style.bottom = '10px';
  indicator.style.right = '10px';
  indicator.style.width = '10px';
  indicator.style.height = '10px';
  indicator.style.borderRadius = '50%';
  indicator.style.backgroundColor = 'green';
  indicator.style.zIndex = '9999';
  indicator.title = 'Teams Notification Email Sender is active';
  document.body.appendChild(indicator);
}

// Initialize when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Teams to fully load its UI
    setTimeout(initializeMonitoring, 3000);
  });
} else {
  // DOM is already ready
  setTimeout(initializeMonitoring, 3000);
}
