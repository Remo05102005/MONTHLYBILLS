import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import { SmartToy as RobotIcon } from '@mui/icons-material';

const AITestButton = ({ onTestAI }) => {
  return (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Test AI Assistant
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Click the robot button in the bottom-left corner to test the AI assistant
      </Typography>
      <Button
        variant="contained"
        startIcon={<RobotIcon />}
        onClick={onTestAI}
        sx={{
          bgcolor: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
          '&:hover': {
            bgcolor: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)',
          },
        }}
      >
        Open AI Assistant
      </Button>
    </Box>
  );
};

export default AITestButton;
