import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveData, getData } from '../firebase/database';
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
} from '@mui/material';
import { PhotoCamera, Logout } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

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
  });

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
      await saveData(`users/${currentUser.uid}`, {
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
    </Container>
  );
} 