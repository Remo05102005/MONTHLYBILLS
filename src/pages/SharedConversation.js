import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  useTheme,
  useMediaQuery,
  Container,
  Card,
  CardContent,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ref, get } from 'firebase/database';
import { realtimeDb } from '../firebase/config';

const SharedConversation = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [conversationData, setConversationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSharedConversation = async () => {
      try {
        // Get the data from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('data');
        const shareId = urlParams.get('share');

        if (shareId) {
          // Load the shared payload from the realtime DB
          try {
            const shareRef = ref(realtimeDb, `public_shares/${shareId}`);
            const snapshot = await get(shareRef);
            if (!snapshot.exists()) {
              setError('Shared conversation not found or has been removed.');
              setLoading(false);
              return;
            }
            const shareRecord = snapshot.val();
            const decodedData = shareRecord.payload || shareRecord.data;
            if (!decodedData || !decodedData.conversations) {
              setError('Invalid shared conversation payload.');
              setLoading(false);
              return;
            }
            setConversationData(decodedData);
            setLoading(false);
            return;
          } catch (dbErr) {
            console.error('Error fetching shared conversation from DB:', dbErr);
            setError('Failed to load shared conversation. Please try again later.');
            setLoading(false);
            return;
          }
        }

        if (!encodedData) {
          setError('No conversation data found in the link');
          setLoading(false);
          return;
        }

        // Decode the data with better error handling
        let decodedData;
        try {
          const decodedString = atob(encodedData);
          decodedData = JSON.parse(decodedString);
        } catch (decodeError) {
          console.error('Decoding error:', decodeError);
          setError('Invalid or corrupted conversation data. The link may be malformed.');
          setLoading(false);
          return;
        }

        // Validate the decoded data
        if (!decodedData.conversations || !Array.isArray(decodedData.conversations)) {
          setError('Invalid conversation format. The data structure is corrupted.');
          setLoading(false);
          return;
        }

        setConversationData(decodedData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading shared conversation:', err);
        setError('Failed to load conversation. Please check the link and try again.');
        setLoading(false);
      }
    };

    loadSharedConversation();
  }, []);

  // Message bubble component
  const MessageBubble = ({ message, isUser }) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
        px: isMobile ? 1 : 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          maxWidth: '90%',
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        {!isUser && (
          <Avatar
            sx={{
              bgcolor: '#1976d2',
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              fontSize: '0.875rem',
            }}
          >
            <SmartToyIcon fontSize="small" />
          </Avatar>
        )}
        
        <Paper
          elevation={2}
          sx={{
            p: isMobile ? 1.5 : 2,
            bgcolor: isUser 
              ? '#1976d2' 
              : '#f5f5f5',
            color: isUser ? 'white' : 'text.primary',
            borderRadius: isUser 
              ? (isMobile ? '16px 16px 4px 16px' : '18px 18px 4px 18px')
              : (isMobile ? '16px 16px 16px 4px' : '18px 18px 18px 4px'),
            position: 'relative',
            maxWidth: '100%',
            wordWrap: 'break-word',
          }}
        >
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              lineHeight: isMobile ? 1.5 : 1.6,
              fontSize: isMobile ? '0.9rem' : '0.95rem'
            }}
          >
            {message.content}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              opacity: 0.7,
              fontSize: '0.75rem',
            }}
          >
            {format(new Date(message.timestamp), 'HH:mm')}
            {message.conversationNumber && (
              <span> • Conv #{message.conversationNumber}</span>
            )}
          </Typography>
        </Paper>
        
        {isUser && (
          <Avatar
            sx={{
              bgcolor: '#1976d2',
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              fontSize: '0.875rem',
              fontWeight: 'bold',
            }}
          >
            <PersonIcon fontSize="small" />
          </Avatar>
        )}
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading conversation...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!conversationData) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          No conversation data available
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SmartToyIcon sx={{ fontSize: isMobile ? 24 : 28 }} />
            <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 600 }}>
              Shared Conversation
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
            {conversationData.title} #{conversationData.sessionNumber}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {conversationData.conversations.length} conversations • 
            Created {format(new Date(conversationData.createdAt), 'MMM dd, yyyy HH:mm')}
          </Typography>
        </CardContent>
      </Card>

      {/* Conversation Messages */}
      <Paper sx={{ p: isMobile ? 1 : 2, minHeight: '400px' }}>
        {conversationData.conversations.map((conversation, index) => (
          <Box key={index}>
            <MessageBubble
              message={{
                content: conversation.query,
                timestamp: conversation.timestamp,
                conversationNumber: conversation.conversationNumber
              }}
              isUser={true}
            />
            <MessageBubble
              message={{
                content: conversation.response,
                timestamp: conversation.timestamp,
                conversationNumber: conversation.conversationNumber
              }}
              isUser={false}
            />
            {index < conversationData.conversations.length - 1 && (
              <Divider sx={{ my: 2, opacity: 0.3 }} />
            )}
          </Box>
        ))}
      </Paper>

      {/* Footer */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          This conversation was shared from Common Man Financial Assistant
        </Typography>
        <Chip 
          label="Shared Conversation" 
          color="primary" 
          size="small" 
          sx={{ mt: 1 }}
        />
      </Box>
    </Container>
  );
};

export default SharedConversation;
