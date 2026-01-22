import React, { useState, useEffect } from 'react';
import { getDatabase, ref, push, onValue } from 'firebase/database';
import { realtimeDb } from '../firebase/config';
import Layout from '../components/Layout';
import { sendTestMessage, getBotWebAppLink, GET_CHAT_ID_INSTRUCTIONS } from '../services/telegramService';

const Reminders = () => {
  const [reminders, setReminders] = useState([]);
  const [message, setMessage] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    // Load existing reminders
    const remindersRef = ref(realtimeDb, 'reminders');
    const unsubscribe = onValue(remindersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const reminderList = Object.entries(data).map(([id, reminder]) => ({
          id,
          ...reminder
        }));
        setReminders(reminderList);
      } else {
        setReminders([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const createReminder = async (e) => {
    e.preventDefault();
    if (!message || !sendAt || !telegramChatId) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const remindersRef = ref(realtimeDb, 'reminders');
      await push(remindersRef, {
        telegram_chat_id: telegramChatId,
        message: message,
        send_at: new Date(sendAt).getTime(),
        sent: false
      });

      // Clear form
      setMessage('');
      setSendAt('');
      alert('Reminder created successfully!');
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Error creating reminder');
    }
    setLoading(false);
  };

  const testTelegramConnection = async () => {
    if (!testChatId) {
      alert('Please enter a Chat ID to test');
      return;
    }

    setTestingConnection(true);
    try {
      await sendTestMessage(testChatId);
      alert(' Test message sent successfully! Check your Telegram.');
    } catch (error) {
      console.error('Test failed:', error);
      alert(`L Test failed: ${error.message}`);
    }
    setTestingConnection(false);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Reminders</h1>

        {/* Telegram Setup */}
        <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">=€ Telegram Bot Setup</h2>
          <div className="mb-4">
            <p className="text-gray-700 mb-4">Follow these steps to set up your Telegram bot for reminders:</p>
            <div className="bg-white p-4 rounded border mb-4">
              <pre className="text-sm whitespace-pre-wrap">{GET_CHAT_ID_INSTRUCTIONS}</pre>
            </div>
            {getBotWebAppLink() && (
              <a
                href={getBotWebAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
              >
                Start Bot Chat
              </a>
            )}
          </div>

          {/* Test Connection */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Test Telegram Connection</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                className="flex-1 p-2 border rounded"
                placeholder="Enter your Chat ID"
              />
              <button
                onClick={testTelegramConnection}
                disabled={testingConnection}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>

        {/* Create Reminder Form */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Reminder</h2>
          <form onSubmit={createReminder}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Telegram Chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Get this from your Telegram bot"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2 border rounded"
                rows="3"
                placeholder="Enter reminder message"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Send At</label>
              <input
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Reminder'}
            </button>
          </form>
        </div>

        {/* Existing Reminders */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Existing Reminders</h2>
          {reminders.length === 0 ? (
            <p className="text-gray-500">No reminders yet</p>
          ) : (
            <div className="space-y-4">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="border p-4 rounded">
                  <p className="font-semibold">{reminder.message}</p>
                  <p className="text-sm text-gray-600">
                    Send at: {new Date(reminder.send_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Status: {reminder.sent ? 'Sent' : 'Pending'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Reminders;