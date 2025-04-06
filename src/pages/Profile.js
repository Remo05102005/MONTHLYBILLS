import React, { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import { PhotoCamera, Delete } from '@mui/icons-material';
import { resetTransactions } from '../store/transactionSlice';

const Profile = () => {
  const dispatch = useDispatch();
  const [name, setName] = useState(localStorage.getItem('userName') || 'John Doe');
  const [avatar, setAvatar] = useState(localStorage.getItem('userAvatar') || '');
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit
        setError('File size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
        localStorage.setItem('userAvatar', reader.result);
        // Trigger storage event for other components
        window.dispatchEvent(new Event('storage'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (name.trim() === '') {
      setError('Name cannot be empty');
      return;
    }
    localStorage.setItem('userName', name);
    setError('');
    setSuccess(true);
    // Trigger storage event for other components
    window.dispatchEvent(new Event('storage'));
  };

  const handleDeleteAllData = () => {
    setOpenDialog(true);
  };

  const confirmDelete = () => {
    dispatch(resetTransactions());
    localStorage.removeItem('userName');
    localStorage.removeItem('userAvatar');
    setName('John Doe');
    setAvatar('');
    setOpenDialog(false);
    // Trigger storage event for other components
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile Settings
      </Typography>

      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Avatar
              src={avatar}
              sx={{ width: 120, height: 120, mb: 2, cursor: 'pointer' }}
              onClick={handleAvatarClick}
            />
            <input
              type="file"
              accept="image/*"
              hidden
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button
              variant="outlined"
              startIcon={<PhotoCamera />}
              onClick={handleAvatarClick}
            >
              Change Photo
            </Button>
          </Box>

          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={handleNameChange}
            margin="normal"
            error={!!error}
            helperText={error}
          />

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDeleteAllData}
            >
              Delete All Data
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all your data? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error">
            Delete All Data
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccess(false)} severity="success">
          Changes saved successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile; 