import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, Typography, Button, Box, CircularProgress, Alert } from '@mui/material';
import { CheckCircle, Schedule } from '@mui/icons-material';
import Layout from '../components/Layout';
import { cancelReminder, createAdvancedReminder } from '../services/advancedReminderService';
import { AuthContext } from '../contexts/AuthContext';

const ReminderAction = () => {
  const { reminderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [reminderData, setReminderData] = useState(null);

  // In a real implementation, you'd fetch reminder data by ID
  // For now, we'll simulate with mock data
  useEffect(() => {
    // Mock reminder data - in real app, fetch from Firebase
    const mockReminder = {
      id: reminderId,
      title: 'Sample Reminder',
      message: 'This is a sample reminder message',
      priority: 'medium',
      category: 'personal',
      scheduledTime: Date.now() + 3600000 // 1 hour from now
    };
    setReminderData(mockReminder);
  }, [reminderId]);

  const handleDone = async () => {
    setLoading(true);
    setError(null);

    try {
      // Cancel the reminder since it's completed
      await cancelReminder(reminderId);
      setSuccess('Reminder marked as completed! ✅');
      setTimeout(() => {
        navigate('/todo'); // Redirect to todo list
      }, 2000);
    } catch (err) {
      setError('Failed to mark reminder as done. Please try again.');
      console.error('Error marking reminder as done:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create a new reminder for 1 hour later
      const snoozeTime = Date.now() + (60 * 60 * 1000); // 1 hour from now

      // In a real implementation, you'd get the original reminder data and recreate it
      await createAdvancedReminder({
        userId: 'current-user-id', // This should come from auth context
        chatId: 'telegram-chat-id', // This should be stored with the reminder
        title: reminderData?.title || 'Snoozed Reminder',
        message: reminderData?.message || 'Reminder snoozed for 1 hour',
        scheduledTime: snoozeTime,
        type: 'one_time',
        priority: reminderData?.priority || 'medium',
        category: reminderData?.category || 'personal'
      });

      // Cancel the current reminder
      await cancelReminder(reminderId);

      setSuccess('Reminder snoozed for 1 hour! ⏰');
      setTimeout(() => {
        navigate('/todo');
      }, 2000);
    } catch (err) {
      setError('Failed to snooze reminder. Please try again.');
      console.error('Error snoozing reminder:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!reminderData) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Card sx={{ maxWidth: 500, width: '100%', mx: 2 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
              📅 Reminder Action
            </Typography>

            <Box sx={{ mb: 4, p: 3, backgroundColor: 'background.paper', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                {reminderData.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {reminderData.message}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Priority: <strong>{reminderData.priority?.toUpperCase()}</strong> •
                Category: <strong>{reminderData.category}</strong>
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {success}
              </Alert>
            )}

            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<CheckCircle />}
                onClick={handleDone}
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                ✅ Done
              </Button>

              <Button
                variant="outlined"
                color="primary"
                size="large"
                startIcon={<Schedule />}
                onClick={handleSnooze}
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                ⏰ Remind me in 1 hour
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
              Reminder ID: {reminderId}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
};

export default ReminderAction;