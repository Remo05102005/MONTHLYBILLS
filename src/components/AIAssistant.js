import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Avatar,
  IconButton,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardActions,
  DialogActions,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  SmartToy as SmartToyIcon,
  History as HistoryIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Share as ShareIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import genaiService from '../services/genaiService';
import { getUserContextData } from '../services/contextService';
import { useAuth } from '../contexts/AuthContext';
import {
  createChatSession,
  saveConversation,
  getChatSessions,
  getChatSession,
  deleteChatSession,
} from '../firebase/sessions';

const SubbaraoChat = ({ transactions, selectedMonth, isOpen, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();
  
  // State management
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTimeline, setSelectedTimeline] = useState('thisMonth');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [currentSessionForShare, setCurrentSessionForShare] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Timeline options
  const timelineOptions = [
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'last3Months', label: 'Last 3 Months' },
    { value: 'last6Months', label: 'Last 6 Months' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  // Initialize chat session when dialog opens
  useEffect(() => {
    if (isOpen && currentUser) {
      console.log('Dialog opened, initializing chat...');
      initializeChat();
    }
  }, [isOpen, currentUser]);

  // Initialize chat
  const initializeChat = async () => {
    try {
      console.log('Creating new session...');
      const sessionId = await createChatSession(currentUser.uid);
      console.log('Session created with ID:', sessionId);
      setCurrentSessionId(sessionId);
      setMessages([]);
      setActiveTab(0);
      await loadChatSessions();
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  // Load chat sessions from Firebase
  const loadChatSessions = async () => {
    if (!currentUser) return;
    
    try {
      console.log('Loading chat sessions...');
      const sessions = await getChatSessions(currentUser.uid);
      console.log('Sessions loaded:', sessions);
      setChatSessions(sessions || []);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  // Load specific session
  const loadSession = async (sessionId) => {
    try {
      console.log('Loading session:', sessionId);
      const session = await getChatSession(currentUser.uid, sessionId);
      console.log('Session loaded:', session);
      
      if (session && session.conversations) {
        // Convert conversations to messages format
        const messagesArray = [];
        session.conversations.forEach(conversation => {
          messagesArray.push({
            type: 'user',
            content: conversation.query,
            timestamp: new Date(conversation.timestamp),
            conversationNumber: conversation.conversationNumber,
            sessionNumber: conversation.sessionNumber
          });
          messagesArray.push({
            type: 'ai',
            content: conversation.response,
            timestamp: new Date(conversation.timestamp),
            conversationNumber: conversation.conversationNumber,
            sessionNumber: conversation.sessionNumber
          });
        });
        
        console.log('Messages loaded:', messagesArray.length);
        setMessages(messagesArray);
        setCurrentSessionId(sessionId);
        setActiveTab(0); // Switch to chat tab
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  // Delete session with confirmation
  const confirmDeleteSession = (sessionId) => {
    setSessionToDelete(sessionId);
    setShowDeleteConfirm(true);
  };

  const deleteSession = async () => {
    if (!sessionToDelete) return;
    
    try {
      await deleteChatSession(currentUser.uid, sessionToDelete);
      await loadChatSessions();
      
      if (currentSessionId === sessionToDelete) {
        await initializeChat();
      }
      
      setSnackbarMessage('Session deleted successfully');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting session:', error);
      setSnackbarMessage('Error deleting session');
      setSnackbarOpen(true);
    } finally {
      setShowDeleteConfirm(false);
      setSessionToDelete(null);
    }
  };

  // Get filtered transactions based on timeline
  const getFilteredTransactions = () => {
    const now = new Date();
    let startDate, endDate;

    switch (selectedTimeline) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = now;
        break;
      case 'last6Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = now;
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = customStartDate;
          endDate = customEndDate;
        } else {
          return transactions;
        }
        break;
      default:
        return transactions;
    }

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentUser || !currentSessionId) {
      console.log('Cannot send message:', { 
        hasMessage: !!inputMessage.trim(), 
        isLoading,
        hasUser: !!currentUser,
        hasSession: !!currentSessionId
      });
      return;
    }

    const messageContent = inputMessage.trim();
    const userMessage = {
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    console.log('Sending message:', messageContent);
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build structured user context (XML + transactions) for the AI
      const context = await getUserContextData(currentUser.uid, {
        timeline: selectedTimeline,
        customStartDate,
        customEndDate,
        query: messageContent,
        userName: currentUser.displayName || currentUser.email || ''
      });

      console.log('Context transactions count:', context.transactions.length);
      console.log('Selected timeline:', selectedTimeline, 'Context dates:', context.start, context.end);

      // Generate AI response with structured XML context injection
      console.log('Calling genaiService.generateFinancialInsight with XML context...');
      // Build a short-term memory buffer from recent messages (last 10)
      const recentMessages = messages.slice(-10).map(m => ({
        type: m.type,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : (m.timestamp || '')
      }));

      const aiResponse = await genaiService.generateFinancialInsight(
        messageContent,
        context.transactions,
        {
          conversationContext: messages.length > 0 ? 
            `Previous conversation:\n${messages.slice(-6).map(m => `${m.type}: ${m.content}`).join('\n')}` : '',
          timeline: selectedTimeline,
          userContextXML: context.xml,
          memoryBuffer: recentMessages
        }
      );

      console.log('AI Response received:', aiResponse);

      const aiMessage = {
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Save conversation to Firebase
      console.log('Saving conversation to Firebase...');
      await saveConversation(currentUser.uid, currentSessionId, messageContent, aiResponse);
      console.log('Conversation saved successfully');
      
      // Reload sessions to update the list
      await loadChatSessions();

    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      
      const errorMessage = {
        type: 'ai',
        content: `Sorry anna, technical problem vachindi. Error: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle timeline change
  const handleTimelineChange = (value) => {
    setSelectedTimeline(value);
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    }
  };

  // Apply custom date range
  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setShowCustomDatePicker(false);
    }
  };

  // Create new chat
  const createNewChat = async () => {
    console.log('Creating new chat...');
    await initializeChat();
    setSnackbarMessage('New chat started');
    setSnackbarOpen(true);
    setActiveTab(0); // Switch to chat tab
  };

  // Generate shareable link for conversation
  const generateShareableLink = async (sessionId) => {
    try {
      // Get the current session data
      const session = await getChatSession(currentUser.uid, sessionId);
      if (!session || !session.conversations || session.conversations.length === 0) {
        setSnackbarMessage('No conversations to share');
        setSnackbarOpen(true);
        return;
      }

      // Create a shareable data object
      const shareableData = {
        sessionId: session.sessionId,
        sessionNumber: session.sessionNumber,
        title: session.title,
        createdAt: session.createdAt,
        conversations: session.conversations.map(conv => ({
          conversationNumber: conv.conversationNumber,
          query: conv.query,
          response: conv.response,
          timestamp: conv.timestamp
        }))
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(shareableData);
      
      // Check if data is too large for URL
      if (jsonString.length > 2000) {
        setSnackbarMessage('Conversation too long to share. Please try with fewer messages.');
        setSnackbarOpen(true);
        return;
      }

      // Encode the data as base64 with error handling
      let encodedData;
      try {
        encodedData = btoa(unescape(encodeURIComponent(jsonString)));
      } catch (encodeError) {
        console.error('Base64 encoding error:', encodeError);
        setSnackbarMessage('Error encoding conversation data');
        setSnackbarOpen(true);
        return;
      }
      
      // Create the shareable link
      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}/shared-conversation?data=${encodedData}`;
      
      setShareableLink(shareableUrl);
      setCurrentSessionForShare(session);
      setShowShareDialog(true);
      
    } catch (error) {
      console.error('Error generating shareable link:', error);
      console.error('Attempting fallback: copy to clipboard if possible');
      try {
        const baseUrl = window.location.origin;
        const fallbackUrl = `${baseUrl}/shared-conversation?session=${sessionId}`;
        await navigator.clipboard.writeText(fallbackUrl);
        setSnackbarMessage('Failed to create link; fallback link copied to clipboard');
      } catch (clipErr) {
        setSnackbarMessage(`Error generating shareable link: ${error.message}`);
      }
      setSnackbarOpen(true);
    }
  };

  // Share link directly
  const shareLink = async () => {
    try {
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: `Shared Conversation: ${currentSessionForShare?.title || 'Chat Session'}`,
          text: `Check out this conversation from my AI assistant:`,
          url: shareableLink
        });
        setSnackbarMessage('Link shared successfully!');
        setSnackbarOpen(true);
      } else {
        // Fallback: show message that sharing is not supported
        setSnackbarMessage('Sharing is not supported on this device. Please copy the link manually.');
        setSnackbarOpen(true);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled the share dialog
        return;
      }
      console.error('Error sharing link:', error);
      setSnackbarMessage('Failed to share link');
      setSnackbarOpen(true);
    }
  };

  // Direct share without opening dialog
  const directShareSession = async (sessionId) => {
    try {
      // Get the session data
      const session = await getChatSession(currentUser.uid, sessionId);
      
      if (!session) {
        setSnackbarMessage('Session not found');
        setSnackbarOpen(true);
        return;
      }

      // Check data size before encoding
      const dataSize = JSON.stringify(session).length;
      if (dataSize > 2000) {
        setSnackbarMessage('Conversation is too long to share. Please try a shorter conversation.');
        setSnackbarOpen(true);
        return;
      }

      // Create shareable data
      const shareableData = {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        title: session.title,
        createdAt: session.createdAt,
        conversations: session.conversations || []
      };

      // Encode the data
      const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(shareableData))));
      
      // Create the shareable link
      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}/shared-conversation?data=${encodedData}`;
      
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: `Shared Conversation: ${session.title}`,
          text: `Check out this conversation from my AI assistant:`,
          url: shareableUrl
        });
        setSnackbarMessage('Link shared successfully!');
        setSnackbarOpen(true);
      } else {
        // Fallback: copy to clipboard automatically and notify
        try {
          await navigator.clipboard.writeText(shareableUrl);
          setSnackbarMessage('Share link copied to clipboard');
        } catch (err) {
          setSnackbarMessage('Sharing is not supported on this device. Please copy the link manually.');
        }
        setSnackbarOpen(true);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled the share dialog
        return;
      }
      console.error('Error sharing session:', error);
      setSnackbarMessage(`Error sharing conversation: ${error.message}`);
      setSnackbarOpen(true);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Message bubble component
  const MessageBubble = ({ message }) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
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
          flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
        }}
      >
        {message.type === 'ai' && (
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
          className="message-enter"
          sx={{
            p: isMobile ? 1.5 : 2,
            bgcolor: message.type === 'user' 
              ? '#1976d2' 
              : '#f5f5f5',
            color: message.type === 'user' ? 'white' : 'text.primary',
            borderRadius: message.type === 'user' 
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
            {format(message.timestamp, 'HH:mm')}
            {message.conversationNumber && (
              <span> • Conv #{message.conversationNumber}</span>
            )}
          </Typography>
        </Paper>
        
        {message.type === 'user' && (
          <Avatar
            sx={{
              bgcolor: '#1976d2',
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              fontSize: '0.875rem',
              fontWeight: 'bold',
            }}
          >
            U
          </Avatar>
        )}
      </Box>
    </Box>
  );

  // Session history item component
  const SessionItem = ({ session }) => (
    <Card 
      sx={{ 
        mb: 1, 
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        }
      }}
      onClick={() => loadSession(session.id)}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ChatIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {session.title} #{session.sessionNumber}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {format(new Date(session.createdAt), 'MMM dd, yyyy HH:mm')}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {session.conversationCount} conversations
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          Session #{session.sessionNumber} • ID: {session.id}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: 0, justifyContent: 'space-between' }}>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            directShareSession(session.id);
          }}
          sx={{ color: 'primary.main' }}
          title="Share conversation"
        >
          <ShareIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            confirmDeleteSession(session.id);
          }}
          sx={{ color: 'error.main' }}
          title="Delete session"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </CardActions>
    </Card>
  );

  return (
    <>
      {/* Animations used by chat bubbles and typing indicator */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes typingDots { 0% { transform: translateY(0); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
        .message-enter { animation: fadeInUp 220ms ease both; }
        .typing-dot { display: inline-block; width: 6px; height: 6px; margin: 0 3px; background: #666; border-radius: 50%; }
      `}</style>

      <Dialog
        open={isOpen}
        onClose={onClose}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            height: isMobile ? '100vh' : '80vh',
            maxHeight: isMobile ? '100vh' : '80vh',
            borderRadius: isMobile ? 0 : 2,
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            bgcolor: '#1976d2',
            color: 'white',
            p: isMobile ? 2 : 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToyIcon sx={{ fontSize: isMobile ? 24 : 28 }} />
            <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 600 }}>
                      Subbarao
              {currentSessionId && (
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                  Session #{chatSessions.find(s => s.id === currentSessionId)?.sessionNumber || 'New'}
                </Typography>
              )}
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ 
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Timeline Selection */}
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: '1px solid #e0e0e0' }}>
          <FormControl fullWidth size={isMobile ? 'medium' : 'small'}>
            <InputLabel>Analysis Period</InputLabel>
            <Select
              value={selectedTimeline}
              onChange={(e) => handleTimelineChange(e.target.value)}
              label="Analysis Period"
            >
              {timelineOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
            sx={{ px: isMobile ? 1 : 2 }}
          >
            <Tab 
              icon={<ChatIcon />} 
              label="Chat" 
              iconPosition={isMobile ? 'top' : 'start'}
              sx={{ minHeight: isMobile ? 72 : 48 }}
            />
            <Tab 
              icon={<HistoryIcon />} 
              label="History" 
              iconPosition={isMobile ? 'top' : 'start'}
              sx={{ minHeight: isMobile ? 72 : 48 }}
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <DialogContent sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 0 && (
            <>
              {/* Messages */}
              <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 1 : 2 }}>
                {messages.length === 0 ? (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 4,
                    color: 'text.secondary'
                  }}>
                    <SmartToyIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Namaste anna! 👋
                    </Typography>
                    <Typography variant="body2">
                      Ask me anything about your finances. I'm here to help!
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message, index) => (
                    <MessageBubble key={index} message={message} />
                  ))
                )}
                {isLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{
                          bgcolor: '#1976d2',
                          width: 32,
                          height: 32,
                        }}
                      >
                        <SmartToyIcon fontSize="small" />
                      </Avatar>
                      <Paper
                        elevation={1}
                        className="message-enter"
                        sx={{
                          p: 1,
                          bgcolor: '#f5f5f5',
                          borderRadius: '16px 16px 16px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 18 }}>
                          <span className="typing-dot" style={{ background: '#999', animation: 'typingDots 0.9s infinite' }}></span>
                          <span className="typing-dot" style={{ background: '#777', animation: 'typingDots 0.9s 0.15s infinite' }}></span>
                          <span className="typing-dot" style={{ background: '#666', animation: 'typingDots 0.9s 0.3s infinite' }}></span>
                        </Box>
                      </Paper>
                    </Box>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Input Area */}
              <Box sx={{ 
                p: isMobile ? 2 : 3, 
                bgcolor: 'background.paper',
                borderTop: '1px solid #e0e0e0',
                position: 'sticky',
                bottom: 0,
              }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <TextField
                    ref={inputRef}
                    fullWidth
                    multiline
                    maxRows={4}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me about your finances..."
                    variant="outlined"
                    size={isMobile ? 'medium' : 'small'}
                    disabled={isLoading}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        fontSize: isMobile ? '16px' : '14px',
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    sx={{
                      minWidth: isMobile ? 48 : 40,
                      height: isMobile ? 48 : 40,
                      borderRadius: 2,
                      bgcolor: '#1976d2',
                      '&:hover': {
                        bgcolor: '#1565c0',
                      },
                      '&:disabled': {
                        bgcolor: 'grey.300',
                      }
                    }}
                  >
                    <SendIcon />
                  </Button>
                </Box>
              </Box>
            </>
          )}

          {activeTab === 1 && (
            <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 2 : 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Chat History
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {currentSessionId && (
                    <Button
                      variant="outlined"
                      startIcon={<ShareIcon />}
                      onClick={() => directShareSession(currentSessionId)}
                      size={isMobile ? 'medium' : 'small'}
                      sx={{ borderRadius: 2 }}
                    >
                      Share
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={createNewChat}
                    size={isMobile ? 'medium' : 'small'}
                    sx={{ borderRadius: 2 }}
                  >
                    New Chat
                  </Button>
                </Box>
              </Box>
              
              {chatSessions.length === 0 ? (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4,
                  color: 'text.secondary'
                }}>
                  <HistoryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    No chat history yet
                  </Typography>
                  <Typography variant="body2">
                    Start a conversation to see your chat history here
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: 0 }}>
                  {chatSessions.map((session) => (
                    <SessionItem key={session.id} session={session} />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Date Range Picker Dialog */}
      <Dialog
        open={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Custom Date Range</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <DatePicker
                label="Start Date"
                value={customStartDate}
                onChange={(newValue) => setCustomStartDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
              <DatePicker
                label="End Date"
                value={customEndDate}
                onChange={(newValue) => setCustomEndDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDatePicker(false)}>
            Cancel
          </Button>
          <Button 
            onClick={applyCustomDateRange}
            variant="contained"
            disabled={!customStartDate || !customEndDate}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Session</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this chat session? This action cannot be undone and will remove all conversations in this session.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button 
            onClick={deleteSession}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Share Conversation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Share this conversation with anyone using the link below:
          </Typography>
          {currentSessionForShare && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {currentSessionForShare.title} #{currentSessionForShare.sessionNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentSessionForShare.conversations.length} conversations • 
                Created {format(new Date(currentSessionForShare.createdAt), 'MMM dd, yyyy')}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            value={shareableLink}
            label="Shareable Link"
            multiline
            rows={3}
            variant="outlined"
            InputProps={{
              readOnly: true,
            }}
            sx={{ mb: 2 }}
          />
          <Typography variant="caption" color="text.secondary">
            Anyone with this link can view the conversation. The link contains all conversation data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShareDialog(false)}>
            Close
          </Button>
          <Button 
            onClick={shareLink}
            variant="contained"
            startIcon={<ShareIcon />}
          >
            Share {/* Direct sharing only */}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SubbaraoChat;