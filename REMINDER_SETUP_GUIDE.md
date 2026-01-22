# Reminder System Setup Guide

This guide will help you complete the setup of the automated reminder system using Firebase and Cloudflare Workers.

## ✅ What We've Built

- ✅ React app with reminder creation UI
- ✅ Firebase Realtime Database integration
- ✅ Cloudflare Worker with cron scheduling
- ✅ Telegram bot integration
- ✅ Test connection functionality

## 🔧 Remaining Setup Steps

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. Choose a name and username for your bot
4. **Save the bot token** - you'll need it later

### 2. Get Your Chat ID

1. Start a chat with your new bot
2. Send any message to the bot
3. Visit this URL in your browser (replace `YOUR_BOT_TOKEN` with your actual token):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Find your message in the JSON response
5. Copy the `chat.id` value (it will be a number like `123456789`)

### 3. Configure Environment Variables

Add these to your `.env` file:

```bash
# Telegram Bot Configuration
REACT_APP_TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
REACT_APP_TELEGRAM_BOT_USERNAME=your_bot_username
```

### 4. Set Firebase Database Rules

Go to Firebase Console → Realtime Database → Rules and set:

```json
{
  "rules": {
    "reminders": {
      ".read": true,
      ".write": true
    }
  }
}
```

### 5. Get Firebase Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. **Keep this secure** - you'll need it for the worker

### 6. Deploy Cloudflare Worker

```bash
# Navigate to the worker directory
cd ../reminder-scheduler

# Login to Cloudflare
wrangler login

# Set secrets (replace with actual values)
wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your bot token when prompted

wrangler secret put FIREBASE_DB_URL
# Paste: https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app

wrangler secret put FIREBASE_SERVICE_ACCOUNT
# Paste the entire JSON content from your service account key file

# Deploy the worker
wrangler deploy
```

### 7. Test the System

1. Go to your app's `/reminders` page
2. Use the "Test Connection" feature with your chat ID
3. Create a reminder for 1-2 minutes in the future
4. Wait for the notification in Telegram

## 📋 File Structure

```
├── src/
│   ├── pages/Reminders.js          # Main reminder UI
│   ├── services/telegramService.js # Telegram bot helpers
│   └── firebase/config.js          # Firebase setup
├── reminder-scheduler/             # Cloudflare Worker
│   ├── src/index.js               # Worker code
│   ├── wrangler.toml             # Worker config
│   └── package.json
└── .env                           # Environment variables
```

## 🚀 How It Works

1. **User creates reminder** in React app
2. **Data stored** in Firebase Realtime Database
3. **Cloudflare Worker runs every minute** via cron trigger
4. **Worker checks for due reminders** and sends Telegram messages
5. **Marks reminders as sent** to prevent duplicates

## 🛠 Troubleshooting

### Worker Deployment Issues
- Make sure all secrets are set correctly
- Check that the service account JSON is valid
- Verify Firebase database URL is correct

### Telegram Issues
- Ensure bot token is correct
- Check that chat ID is valid
- Make sure bot is not blocked by user

### Firebase Issues
- Verify database rules allow read/write
- Check that service account has proper permissions
- Ensure Realtime Database is enabled

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all environment variables are set
3. Test individual components (Telegram connection, Firebase writes)
4. Check Cloudflare Worker logs: `wrangler tail`

## 🎯 Next Steps

- Add reminder editing/deletion
- Implement multiple user support
- Add timezone handling
- Create reminder templates
- Add email fallback notifications