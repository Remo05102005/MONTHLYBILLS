import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateData, getData } from '../firebase/database';
import { backupDatabaseToTelegram } from '../services/notificationService';
import { realtimeDb } from '../firebase/config';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Avatar,
  Alert,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { PhotoCamera, Logout, Settings as SettingsIcon, Backup as BackupIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import ManageSubcategories from '../components/ManageSubcategories';

export default function Profile() {
  const theme = useTheme();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userData, setUserData] = useState({
    displayName: '',
    phoneNumber: '',
    address: '',
    avatar: '',
    telegramUserId: '',
  });
  const [manageSubcategoriesOpen, setManageSubcategoriesOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState('');
  const [backupError, setBackupError] = useState('');

  // Admin Telegram ID from environment variable
  const ADMIN_TELEGRAM_ID = process.env.REACT_APP_ADMIN_CHAT_ID || '5297280058';
  // Bot token with fallback (for private repo - restart dev server to use env variable)
  const BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || '8282272675:AAHMNod-LLgMfMwa8ux2xCumAbN0x54El30';
  // Get database URL directly from Firebase config (not from env which may point to wrong project)
  const DATABASE_URL = realtimeDb.app.options.databaseURL;

  // Check if current user is admin
  const isAdmin = userData.telegramUserId === ADMIN_TELEGRAM_ID;

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await getData(`users/${currentUser.uid}`);
        if (data) {
          setUserData(prevData => ({
            ...prevData,
            ...data
          }));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateData(`users/${currentUser.uid}`, {
        ...userData,
        email: currentUser.email,
        updatedAt: new Date().toISOString()
      });
      setSuccess('Profile updated successfully!');
    } catch (error) {
      setError('Failed to update profile. Please try again.');
      console.error('Error updating profile:', error);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      setError('');
      await logout();
      navigate('/login');
    } catch (error) {
      setError('Failed to log out. Please try again.');
    }
  };

  // Handle database backup to Telegram (Admin only)
  const handleBackupToTelegram = async () => {
    if (!isAdmin) {
      setBackupError('Only admin can perform backup');
      return;
    }

    setBackupLoading(true);
    setBackupError('');
    setBackupSuccess('');

    try {
      await backupDatabaseToTelegram(
        currentUser,
        BOT_TOKEN,
        ADMIN_TELEGRAM_ID,
        DATABASE_URL
      );
      setBackupSuccess('✅ Database backup sent to your Telegram successfully!');
    } catch (error) {
      console.error('Backup error:', error);
      setBackupError(`❌ Backup failed: ${error.message}`);
    }

    setBackupLoading(false);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 2, mb: 2, p: 0 }}>
      <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 4, boxShadow: 6, maxWidth: 480, mx: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar src={userData.avatar} sx={{ width: 90, height: 90, mb: 1 }} />
          <Typography component="h1" variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Profile Settings
          </Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                value={currentUser.email}
                disabled
                variant="outlined"
                sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Display Name"
                name="displayName"
                value={userData.displayName}
                onChange={handleChange}
                variant="outlined"
                sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phoneNumber"
                value={userData.phoneNumber}
                onChange={handleChange}
                variant="outlined"
                sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={userData.address}
                onChange={handleChange}
                multiline
                rows={3}
                variant="outlined"
                sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Telegram User ID (for notifications)"
                name="telegramUserId"
                value={userData.telegramUserId}
                onChange={handleChange}
                variant="outlined"
                placeholder="e.g., 123456789"
                helperText="Required for todo notifications. Get from @userinfobot"
                sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={loading}
                sx={{ borderRadius: 2, py: 1.5, fontWeight: 600, fontSize: '1rem' }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </Grid>
            <Grid item xs={12} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 1 }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/change-password')}
                fullWidth
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                Change Password
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setManageSubcategoriesOpen(true)}
                fullWidth
                startIcon={<SettingsIcon />}
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                Manage Subcategories
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleLogout}
                fullWidth
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                Logout
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Admin Backup Section - Only visible to admin */}
      {isAdmin && (
        <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 4, boxShadow: 6, maxWidth: 480, mx: 'auto', mt: 2 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BackupIcon color="primary" />
            Admin: Database Backup
          </Typography>
          
          {backupError && <Alert severity="error" sx={{ mb: 2 }}>{backupError}</Alert>}
          {backupSuccess && <Alert severity="success" sx={{ mb: 2 }}>{backupSuccess}</Alert>}
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click the button below to backup the entire database and receive it as a JSON file on your Telegram.
          </Typography>
          
          <Button
            variant="contained"
            color="secondary"
            size="large"
            fullWidth
            startIcon={backupLoading ? <CircularProgress size={20} color="inherit" /> : <BackupIcon />}
            onClick={handleBackupToTelegram}
            disabled={backupLoading}
            sx={{ borderRadius: 2, py: 1.5, fontWeight: 600 }}
          >
            {backupLoading ? 'Backing up...' : 'Backup to Telegram'}
          </Button>
        </Paper>
      )}

      {/* Manage Subcategories Dialog */}
      <ManageSubcategories
        open={manageSubcategoriesOpen}
        onClose={() => setManageSubcategoriesOpen(false)}
      />
    </Container>
  );
}