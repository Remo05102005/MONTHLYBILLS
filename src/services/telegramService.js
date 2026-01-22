// Telegram Bot Service for getting chat ID and managing bot interactions

const BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.REACT_APP_TELEGRAM_BOT_USERNAME;

/**
 * Get the Telegram Web App link for the bot
 * Users can click this to start the bot and get their chat_id
 */
export const getBotWebAppLink = () => {
  if (!BOT_USERNAME) return null;
  return `https://t.me/${BOT_USERNAME}`;
};

/**
 * Send a test message to verify bot token
 * This can help users get their chat_id
 */
export const sendTestMessage = async (chatId) => {
  if (!BOT_TOKEN || !chatId) {
    throw new Error('Bot token or chat ID missing');
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: '✅ Test message from your Reminder App! Your chat ID is working correctly.',
      parse_mode: 'Markdown'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API Error: ${error.description}`);
  }

  return response.json();
};

/**
 * Get bot info to verify token is working
 */
export const getBotInfo = async () => {
  if (!BOT_TOKEN) {
    throw new Error('Bot token not configured');
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);

  if (!response.ok) {
    throw new Error('Invalid bot token');
  }

  const data = await response.json();
  return data.result;
};

/**
 * Instructions for users to get their chat_id
 */
export const GET_CHAT_ID_INSTRUCTIONS = `
To get your Telegram Chat ID:

1. **Start a chat with your bot:**
   - Click the "Start Bot" button below
   - Or go to: https://t.me/${BOT_USERNAME || 'YOUR_BOT_USERNAME'}
   - Send /start to the bot

2. **Get your Chat ID:**
   - Send a message to the bot
   - Then visit: https://api.telegram.org/bot${BOT_TOKEN ? BOT_TOKEN : 'YOUR_BOT_TOKEN'}/getUpdates
   - Find your message in the response
   - Copy the "chat.id" value

3. **Test the connection:**
   - Paste your Chat ID below and click "Test Connection"
`;

/**
 * Send a message to a Telegram chat (stub implementation)
 */
export const sendTelegramMessage = async (chatId, message) => {
  console.log('sendTelegramMessage called with:', { chatId, message });
  // TODO: Implement actual Telegram message sending
  return { success: true };
};

/**
 * Get bot updates (stub implementation)
 */
export const getBotUpdates = async () => {
  console.log('getBotUpdates called');
  // TODO: Implement actual bot updates fetching
  return { ok: true, result: [] };
};

/**
 * Send notification when todo is created (stub implementation)
 */
export const sendTodoCreatedNotification = async (chatId, todo) => {
  console.log('sendTodoCreatedNotification called with:', { chatId, todo });
  // TODO: Implement actual notification sending
  return { success: true };
};

/**
 * Schedule a reminder for a todo (stub implementation)
 */
export const scheduleTodoReminder = async (userId, todoId, chatId, todo, dueDate) => {
  console.log('scheduleTodoReminder called with:', { userId, todoId, chatId, todo, dueDate });
  // TODO: Implement actual reminder scheduling
  return { success: true };
};

/**
 * Clear a scheduled reminder (stub implementation)
 */
export const clearScheduledReminder = async (userId, todoId) => {
  console.log('clearScheduledReminder called with:', { userId, todoId });
  // TODO: Implement actual reminder clearing
  return { success: true };
};

/**
 * Update a scheduled reminder (stub implementation)
 */
export const updateScheduledReminder = async (userId, todoId, newDueDate) => {
  console.log('updateScheduledReminder called with:', { userId, todoId, newDueDate });
  // TODO: Implement actual reminder updating
  return { success: true };
};

/**
 * Delete a scheduled reminder (stub implementation)
 */
export const deleteScheduledReminder = async (userId, todoId) => {
  console.log('deleteScheduledReminder called with:', { userId, todoId });
  // TODO: Implement actual reminder deletion
  return { success: true };
};

/**
 * Load scheduled tasks (stub implementation)
 */
export const loadScheduledTasks = async (userId) => {
  console.log('loadScheduledTasks called with:', { userId });
  // TODO: Implement actual scheduled tasks loading
  return { tasks: [] };
};
