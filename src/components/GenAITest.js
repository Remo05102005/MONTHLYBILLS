import React, { useState } from 'react';
import { Button, Box, Typography, TextField, Paper, CircularProgress, Alert } from '@mui/material';
import { SmartToy as RobotIcon } from '@mui/icons-material';
import genAIService from '../services/genaiService';

const GenAITest = () => {
  const [testQuery, setTestQuery] = useState('Explain how AI works in a few words');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const testGenAI = async () => {
    setLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await genAIService.generateContent(testQuery, {
        temperature: 0.7,
        maxOutputTokens: 512
      });

      if (result.success) {
        setResponse(result.text);
      } else {
        setError(result.error || 'Failed to generate response');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RobotIcon color="primary" />
        GenAI Service Test
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="Test Query"
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          onClick={testGenAI}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <RobotIcon />}
        >
          {loading ? 'Testing...' : 'Test GenAI'}
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {response && (
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            AI Response:
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {response}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default GenAITest;
