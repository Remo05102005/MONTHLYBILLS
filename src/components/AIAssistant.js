import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardActions,
  DialogActions,
  Alert,
  Snackbar,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  SmartToy as SmartToyIcon,
  History as HistoryIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CalendarMonth as CalendarMonthIcon,
  Info as InfoIcon,
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
  // Ensure transactions is always a usable array
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  
  // State management
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
  const [selectedSessionDetails, setSelectedSessionDetails] = useState(null);
  const [sessionTransactions, setSessionTransactions] = useState({ expenses: [], income: [], startDate: null, endDate: null, totalExpenses: 0, totalIncome: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(null);
  const [swipeStartY, setSwipeStartY] = useState(null);
  const [customDateError, setCustomDateError] = useState('');
  const [listType, setListType] = useState('income');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const swipeRef = useRef(null);

  // Validate custom date range
  useEffect(() => {
    if (selectedTimeline === 'custom') {
      if (customStartDate && customEndDate) {
        if (new Date(customStartDate) > new Date(customEndDate)) {
          setCustomDateError('Start date must be before or equal to End date');
        } else {
          setCustomDateError('');
        }
      } else {
        setCustomDateError('Please select both Start and End date');
      }
    } else {
      setCustomDateError('');
    }
  }, [selectedTimeline, customStartDate, customEndDate]);

  // Initialize chat
  const initializeChat = useCallback(async () => {
    if (!currentUser) return;
    
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
  }, [currentUser]);

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
  }, [isOpen, currentUser, initializeChat]);

  // Handle URL parameters for timeline
  useEffect(() => {
    if (isOpen) {
      const params = new URLSearchParams(window.location.search);
      const start = params.get('start');
      const end = params.get('end');
      
      if (start && end) {
        try {
          const startDate = new Date(start);
          const endDate = new Date(end);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            setSelectedTimeline('custom');
            setCustomStartDate(startDate);
            setCustomEndDate(endDate);
          }
        } catch (error) {
          console.error('Error parsing timeline params:', error);
        }
      }
    }
  }, [isOpen]);

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
          const s = new Date(customStartDate);
          const e = new Date(customEndDate);
          if (s > e) {
            return [];
          }
          startDate = s;
          endDate = e;
        } else {
          return [];
        }
        break;
      default:
        return safeTransactions;
    }

    return safeTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentUser || !currentSessionId || isProcessing) {
      console.log('Cannot send message:', { 
        hasMessage: !!inputMessage.trim(), 
        isLoading,
        isProcessing,
        hasUser: !!currentUser,
        hasSession: !!currentSessionId
      });
      return;
    }
    setIsProcessing(true);

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
      
      // Save conversation to Firebase with timeline data
      console.log('Saving conversation to Firebase...');
      await saveConversation(currentUser.uid, currentSessionId, messageContent, aiResponse, {
        timeline: selectedTimeline,
        customStartDate: customStartDate ? customStartDate.toISOString() : null,
        customEndDate: customEndDate ? customEndDate.toISOString() : null
      });
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

  // Sharing removed: directShareSession/generateShareableLink/shareLink were removed to avoid public share errors

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
  const MessageBubble = ({ message }) => {
    const [isSwipeOpen, setIsSwipeOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const touchStart = useRef(null);
    const touchEnd = useRef(null);
    const minSwipeDistance = 50;
    
    const onTouchStart = (e) => {
      touchEnd.current = null;
      touchStart.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
      touchEnd.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) return;
      const distance = touchStart.current - touchEnd.current;
      const isRightSwipe = distance < -minSwipeDistance;
      
      if (isRightSwipe) {
        // Right swipe for delete action
        setIsSwipeOpen('right');
      } else {
        setIsSwipeOpen(false);
      }
    };

    const handleDetailsClick = () => {
      setShowDetails(true);
    };

    const handleCloseDetails = () => {
      setShowDetails(false);
      setIsSwipeOpen(false);
    };

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
          mb: 1.5,
          px: isMobile ? 1 : 2,
          maxWidth: '100%',
          position: 'relative',
        }}
        onTouchStart={isMobile ? onTouchStart : null}
        onTouchMove={isMobile ? onTouchMove : null}
        onTouchEnd={isMobile ? onTouchEnd : null}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            maxWidth: isMobile ? '80%' : '70%',
            flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
            transform: isSwipeOpen ? 'translateX(-40%)' : 'translateX(0)',
            transition: 'transform 0.3s ease',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {message.type === 'ai' && (
            <Avatar
              sx={{
                bgcolor: '#2196f3',
                width: 28,
                height: 28,
                fontSize: '0.875rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: isMobile ? 'none' : 'flex',
                '& .MuiSvgIcon-root': {
                  fontSize: '1rem'
                }
              }}
            >
              <SmartToyIcon />
            </Avatar>
          )}
          
          <Paper
            elevation={0}
            className="message-enter"
            sx={{
              p: isMobile ? '8px 12px' : '10px 14px',
              bgcolor: message.type === 'user' 
                ? '#2196f3' 
                : '#ffffff',
              color: message.type === 'user' ? 'white' : 'text.primary',
              borderRadius: '12px',
              position: 'relative',
              width: '100%',
              wordWrap: 'break-word',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              border: message.type === 'user' ? 'none' : '1px solid rgba(0,0,0,0.08)',
              '&::before': message.type === 'user' ? {
                content: '""',
                position: 'absolute',
                right: -6,
                bottom: 8,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderWidth: '6px 0 6px 6px',
                borderColor: `transparent transparent transparent #2196f3`
              } : {
                content: '""',
                position: 'absolute',
                left: -6,
                bottom: 8,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderWidth: '6px 6px 6px 0',
                borderColor: `transparent #ffffff transparent transparent`
              }
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                fontSize: '0.875rem',
                letterSpacing: 0.2,
                fontWeight: message.type === 'user' ? 400 : 400
              }}
            >
              {message.content}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.5,
                opacity: 0.8,
                fontSize: '0.7rem',
                color: message.type === 'user' ? 'rgba(255,255,255,0.9)' : 'text.secondary',
              }}
            >
              {format(message.timestamp, 'HH:mm')}
              {message.conversationNumber && (
                <span style={{ marginLeft: 4 }}>• #{message.conversationNumber}</span>
              )}
            </Typography>
          </Paper>
          
          {message.type === 'user' && (
            <Avatar
              sx={{
                bgcolor: '#1976d2',
                width: 28,
                height: 28,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: isMobile ? 'none' : 'flex'
              }}
            >
              U
            </Avatar>
          )}
        </Box>

        {/* Details Button - Visible when swiped left */}
        {message.type === 'ai' && (
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              opacity: isSwipeOpen ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: isSwipeOpen ? 'auto' : 'none',
              zIndex: 0,
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={handleDetailsClick}
              sx={{
                height: '70%',
                borderRadius: '8px 0 0 8px',
              }}
            >
              <InfoIcon sx={{ mr: 1 }} />
              Details
            </Button>
          </Box>
        )}

        {/* Details Panel */}
        {showDetails && message.type === 'ai' && (
          <SwipeableDrawer
            anchor="right"
            open={showDetails}
            onClose={handleCloseDetails}
            onOpen={() => {}}
            PaperProps={{
              sx: {
                width: isMobile ? '80%' : '40%',
                p: 2,
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Message Details</Typography>
              <IconButton onClick={handleCloseDetails}>
                <CloseIcon />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <List>
              <ListItem>
                <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                <ListItemText 
                  primary="Timestamp" 
                  secondary={format(message.timestamp, 'MMM dd, yyyy HH:mm:ss')} 
                />
              </ListItem>
              
              {message.conversationNumber && (
                <ListItem>
                  <ListItemIcon><ChatIcon /></ListItemIcon>
                  <ListItemText 
                    primary="Conversation Number" 
                    secondary={`#${message.conversationNumber}`} 
                  />
                </ListItem>
              )}
              
              {message.sessionNumber && (
                <ListItem>
                  <ListItemIcon><HistoryIcon /></ListItemIcon>
                  <ListItemText 
                    primary="Session Number" 
                    secondary={`#${message.sessionNumber}`} 
                  />
                </ListItem>
              )}
              
              <ListItem>
                <ListItemIcon><SmartToyIcon /></ListItemIcon>
                <ListItemText 
                  primary="Message Type" 
                  secondary={message.type === 'ai' ? 'AI Response' : 'User Query'} 
                />
              </ListItem>
              
              <ListItem>
                <ListItemText 
                  primary="Content Length" 
                  secondary={`${message.content.length} characters`} 
                />
              </ListItem>
            </List>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Full Content:</Typography>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  bgcolor: 'background.default',
                  maxHeight: '200px',
                  overflow: 'auto',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
              </Paper>
            </Box>
          </SwipeableDrawer>
        )}
      </Box>
    );
  };

  // Get session transactions for the timeline - use session's own timeline data
  const getSessionTransactions = async (session) => {
    // Use session's stored timeline if available
    const sessionTimeline = session.timeline || 'thisMonth';
    const sessionCustomStart = session.customStartDate ? new Date(session.customStartDate) : null;
    const sessionCustomEnd = session.customEndDate ? new Date(session.customEndDate) : null;
    
    // Calculate date range for this session
    const now = new Date();
    let startDate, endDate;
    
    switch (sessionTimeline) {
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
        if (sessionCustomStart && sessionCustomEnd) {
          startDate = sessionCustomStart;
          endDate = sessionCustomEnd;
        } else {
          return { expenses: [], income: [], startDate: null, endDate: null, totalExpenses: 0, totalIncome: 0 };
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    // Filter transactions for this session's date range
    const sessionTransactions = safeTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
    
    const expenses = sessionTransactions.filter(t => t.type === 'expense');
    const income = sessionTransactions.filter(t => t.type === 'income');
    
    return {
      expenses: expenses.sort((a, b) => new Date(a.date) - new Date(b.date)),
      income: income.sort((a, b) => new Date(a.date) - new Date(b.date)),
      startDate: sessionTransactions.length ? new Date(Math.min(...sessionTransactions.map(t => new Date(t.date)))) : null,
      endDate: sessionTransactions.length ? new Date(Math.max(...sessionTransactions.map(t => new Date(t.date)))) : null,
      totalExpenses: expenses.reduce((sum, t) => sum + t.amount, 0),
      totalIncome: income.reduce((sum, t) => sum + t.amount, 0)
    };
  };

  // Session history item component
  const SessionItem = ({ session }) => {
    const [isSwipeOpen, setIsSwipeOpen] = useState(false);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [sessionData, setSessionData] = useState({ expenses: [], income: [], startDate: null, endDate: null, totalExpenses: 0, totalIncome: 0 });
    const touchStart = useRef(null);
    const touchEnd = useRef(null);
    const minSwipeDistance = 50;
    
    // Load session-specific transaction data
    useEffect(() => {
      const loadSessionData = async () => {
        const data = await getSessionTransactions(session);
        setSessionData(data);
      };
      loadSessionData();
    }, [session]);
    
    const onTouchStart = (e) => {
      touchEnd.current = null;
      touchStart.current = e.targetTouches[0].clientX;
      setSwipeOffset(0);
    };

    const onTouchMove = (e) => {
      if (!touchStart.current) return;
      const currentX = e.targetTouches[0].clientX;
      touchEnd.current = currentX;
      const distance = touchStart.current - currentX;
      
      // Only allow left swipe (distance > 0) to reveal delete on the right
      if (distance > 0) {
        const offset = -Math.min(100, distance); // translate left up to -100px
        setSwipeOffset(offset);
      }
    };

    const onTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) {
        setSwipeOffset(0);
        setIsSwipeOpen(false);
        return;
      }
      
      const distance = touchStart.current - touchEnd.current;
      
      // Left swipe (finger moved left, distance positive)
      if (distance > minSwipeDistance) {
        // Show delete button - no auto-delete
        setIsSwipeOpen(true);
        setSwipeOffset(-100);
      } else {
        // Reset
        setSwipeOffset(0);
        setIsSwipeOpen(false);
      }
    };

    const handleDelete = (e) => {
      e.stopPropagation();
      confirmDeleteSession(session.id);
      setIsSwipeOpen(false);
      setSwipeOffset(0);
    };

    const handleCardClick = (e) => {
      e.stopPropagation();
      if (isSwipeOpen || swipeOffset < -20) {
        setIsSwipeOpen(false);
        setSwipeOffset(0);
      } else {
        loadSession(session.id);
        setActiveTab(0); // Switch to chat tab when session is loaded
      }
    };

    return (
      <Box 
        sx={{ 
          mb: 1,
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          touchAction: 'pan-y',
        }}
        onTouchStart={isMobile ? onTouchStart : null}
        onTouchMove={isMobile ? onTouchMove : null}
        onTouchEnd={isMobile ? onTouchEnd : null}
        onClick={handleCardClick}
      >
        {/* Delete Action - Right Side */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '112px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'error.main',
            color: 'white',
            transition: 'opacity 0.2s ease',
            opacity: isSwipeOpen || swipeOffset < -30 ? 1 : 0,
            pointerEvents: isSwipeOpen || swipeOffset < -30 ? 'auto' : 'none',
            zIndex: isSwipeOpen || swipeOffset < -30 ? 10 : 1,
            borderRadius: '0 8px 8px 0',
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete(e);
          }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(e); }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <DeleteIcon sx={{ fontSize: 24 }} />
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
              DELETE
            </Typography>
          </Box>
        </Box>

        {/* Main Card */}
        <Card
          sx={{
            flex: 1,
            cursor: 'pointer',
            transition: isMobile ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isMobile ? (
              swipeOffset !== 0 ? `translateX(${swipeOffset}px)` :
              isSwipeOpen ? 'translateX(-100px)' :
              'translateX(0)'
            ) : 'translateX(0)',
            willChange: 'transform',
            '&:hover': {
              transform: !isMobile && 'translateY(-2px)',
              boxShadow: !isMobile && 3,
            },
            bgcolor: 'background.paper',
            boxShadow: isSwipeOpen ? 2 : 1,
            position: 'relative',
            zIndex: (isSwipeOpen || swipeOffset < -30) ? 1 : 2,
            pointerEvents: isMobile && (isSwipeOpen || swipeOffset < -30) ? 'none' : 'auto',
            borderRadius: '8px',
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ChatIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {session.title} #{session.sessionNumber}
              </Typography>
              {sessionData.startDate && (
                <Chip
                  size="small"
                  icon={<CalendarMonthIcon fontSize="small" />}
                  label={format(sessionData.startDate, 'MMM dd')}
                  variant="outlined"
                  sx={{ ml: 'auto' }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarMonthIcon fontSize="inherit" />
              {format(new Date(session.createdAt), 'MMM dd, yyyy HH:mm')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                <TrendingUpIcon fontSize="inherit" />
                ₹{sessionData.totalIncome.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                <TrendingDownIcon fontSize="inherit" />
                ₹{sessionData.totalExpenses.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
                {session.conversationCount} conversations
              </Typography>
            </Box>
          </CardContent>
          {/* History details removed; only delete swipe available */}
        </Card>
      </Box>
    );
  };

  return (
    <>
      {/* Animations used by chat bubbles and typing indicator */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes typingDots { 0% { transform: translateY(0); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
        .message-enter { animation: fadeInUp 220ms ease both; }
        .typing-dot { display: inline-block; width: 6px; height: 6px; margin: 0 3px; background: #666; border-radius: 50%; }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.45);} 70% { box-shadow: 0 0 0 8px rgba(255,255,255,0);} 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0);} }
        @keyframes spinRing { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes scan { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
        @keyframes blink { 0%, 100% { opacity: 0.25;} 50% { opacity: 1;} }
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 ,paddingTop: 3}}>
            {/* Animated AI logo (mobile: same size/position) */}
            <Box sx={{ position: 'relative', width: isMobile ? 28 : 32, height: isMobile ? 28 : 32 }}>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  boxShadow: '0 0 0 0 rgba(255,255,255,0.45)',
                  animation: 'pulseGlow 2.2s ease-in-out infinite',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, rgba(255,255,255,0.0), rgba(255,255,255,0.35), rgba(255,255,255,0.0))',
                  animation: 'spinRing 3s linear infinite',
                  filter: 'blur(0.2px)'
                }}
              />
              <SmartToyIcon sx={{ position: 'absolute', inset: 0, fontSize: isMobile ? 24 : 28 }} />
            </Box>
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

        {/* Combined Timeline and Tabs Row for Mobile */}
        <Box 
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: isMobile ? 1 : 2,
            bgcolor: 'background.paper',
            borderBottom: '1px solid #e0e0e0',
            flexWrap: 'nowrap',
            overflow: 'hidden'
          }}
        >
          {/* Timeline Selection */}
          <FormControl 
            size="small"
            sx={{ 
              minWidth: isMobile ? '40%' : '200px',
              flex: isMobile ? 1 : 'unset'
            }}
          >
            <Select
              value={selectedTimeline}
              onChange={(e) => handleTimelineChange(e.target.value)}
              displayEmpty
              variant="outlined"
              sx={{
                '& .MuiSelect-select': {
                  py: 1,
                  fontSize: isMobile ? '0.875rem' : '1rem'
                }
              }}
            >
              {timelineOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Custom Date Range Inputs */}
          {selectedTimeline === 'custom' && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                <DatePicker
                  label="Start date"
                  value={customStartDate}
                  onChange={(date) => setCustomStartDate(date)}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>to</Typography>
                <DatePicker
                  label="End date"
                  value={customEndDate}
                  onChange={(date) => setCustomEndDate(date)}
                  slotProps={{ textField: { size: 'small' } }}
                />
                {customDateError && (
                  <Typography variant="caption" sx={{ color: 'error.main', ml: 1 }}>
                    {customDateError}
                  </Typography>
                )}
              </Box>
            </LocalizationProvider>
          )}

          {/* Tabs */}
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="standard"
            sx={{ 
              minHeight: 40,
              '& .MuiTabs-flexContainer': {
                gap: 1
              }
            }}
          >
            <Tab 
              icon={<ChatIcon />} 
              label={isMobile ? '' : "Chat"}
              sx={{ 
                minWidth: isMobile ? 48 : 90,
                minHeight: 40,
                p: isMobile ? '6px' : '6px 16px',
              }}
            />
            <Tab 
              icon={<HistoryIcon />} 
              label={isMobile ? '' : "History"}
              sx={{ 
                minWidth: isMobile ? 48 : 90,
                minHeight: 40,
                p: isMobile ? '6px' : '6px 16px',
              }}
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <DialogContent 
          sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column' }}
          ref={swipeRef}
        >
          {activeTab === 0 && (
            <>
              {/* Swipeable Chat Area */}
              <Box 
                sx={{ 
                  flex: 1, 
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  width: '100%',
                }}
              >
                {/* Main Messages Area */}
                <Box 
                  sx={{ 
                    flex: 1, 
                    overflow: 'auto', 
                    p: isMobile ? 1 : 2,
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: drawerOpen ? (isMobile ? 'translateX(-85%)' : 'translateX(-75%)') : 'translateX(0)',
                    width: '100%',
                  }}
                  onTouchStart={(e) => {
                    if (isMobile) {
                      const touch = e.touches[0];
                      swipeRef.current = { startX: touch.clientX, startY: touch.clientY };
                    }
                  }}
                  onTouchMove={(e) => {
                    if (isMobile && swipeRef.current) {
                      const touch = e.touches[0];
                      const deltaX = swipeRef.current.startX - touch.clientX;
                      const deltaY = swipeRef.current.startY - touch.clientY;
                      
                      // Only handle horizontal swipes (ignore vertical scrolling)
                      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
                        e.preventDefault();
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (isMobile && swipeRef.current) {
                      const touch = e.changedTouches[0];
                      const deltaX = swipeRef.current.startX - touch.clientX;
                      
                      // Left swipe
                      if (deltaX > 70) {
                        setDrawerOpen(true);
                      }
                      // Right swipe
                      else if (deltaX < -70) {
                        setDrawerOpen(false);
                      }
                    }
                  }}
                >
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
                      <Typography variant="body2" sx={{ mb: 3 }}>
                        Ask me anything about your finances. I'm here to help!
                      </Typography>
                      
                      {/* Example Prompts */}
                      <Box sx={{ px: 2, maxWidth: 600, mx: 'auto' }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                          Try these example prompts:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ 
                              textTransform: 'none', 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              py: 1.5
                            }}
                            onClick={() => setInputMessage("Analyze unnecessary expenditures in this period")}
                          >
                            💸 Analyze unnecessary expenditures in this period
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ 
                              textTransform: 'none', 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              py: 1.5
                            }}
                            onClick={() => setInputMessage("Give me category and subcategory wise breakdown")}
                          >
                            📊 Category and subcategory wise breakdown
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ 
                              textTransform: 'none', 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              py: 1.5
                            }}
                            onClick={() => setInputMessage("Provide weekly and monthly analysis")}
                          >
                            📅 Weekly and monthly analysis
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ 
                              textTransform: 'none', 
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              py: 1.5
                            }}
                            onClick={() => setInputMessage("Give overall analysis and tips for better financial management")}
                          >
                            💡 Overall analysis and tips
                          </Button>
                        </Box>
                      </Box>
                      
                      <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'text.disabled' }}>
                        Swipe left to see timeline details
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
                  {/* Research overlay when thinking */}
                  {isLoading && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: isMobile ? 8 : 12,
                        right: isMobile ? 8 : 16,
                        width: isMobile ? 120 : 160,
                        height: isMobile ? 54 : 64,
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: 'rgba(25,118,210,0.06)',
                        border: '1px solid',
                        borderColor: 'rgba(25,118,210,0.2)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        zIndex: 20,
                        pointerEvents: 'none'
                      }}
                    >
                      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.8 }}>
                        <Box sx={{ position: 'absolute', top: 8, left: 8, width: '62%', height: 6, bgcolor: 'rgba(25,118,210,0.18)', borderRadius: 1, animation: 'blink 1.6s ease-in-out infinite' }} />
                        <Box sx={{ position: 'absolute', top: 20, left: 8, width: '42%', height: 6, bgcolor: 'rgba(25,118,210,0.18)', borderRadius: 1, animation: 'blink 1.4s 0.2s ease-in-out infinite' }} />
                        <Box sx={{ position: 'absolute', top: 32, left: 8, width: '74%', height: 6, bgcolor: 'rgba(25,118,210,0.18)', borderRadius: 1, animation: 'blink 1.8s 0.1s ease-in-out infinite' }} />
                        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(25,118,210,0.16), transparent)', animation: 'scan 1.8s linear infinite' }} />
                        <Box sx={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', gap: 0.5, opacity: 0.9 }}>
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(25,118,210,0.5)', animation: 'blink 1.2s ease-in-out infinite' }} />
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(25,118,210,0.5)', animation: 'blink 1.2s 0.2s ease-in-out infinite' }} />
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(25,118,210,0.5)', animation: 'blink 1.2s 0.4s ease-in-out infinite' }} />
                        </Box>
                      </Box>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Box>
                
                {/* Timeline Details Panel - Shown when swiped left */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: isMobile ? '85%' : '75%',
                    bgcolor: 'background.paper',
                    boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 10,
                  }}
                >
                  {/* Header with gradient */}
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                      color: 'white',
                      p: 2.5,
                      pb: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CalendarMonthIcon sx={{ fontSize: 28 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Timeline Details
                        </Typography>
                      </Box>
                      <IconButton 
                        onClick={() => setDrawerOpen(false)}
                        sx={{ 
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>
                    
                    {/* Timeline Selection Info */}
                    <Paper 
                      sx={{ 
                        p: 1.5, 
                        mt: 1.5,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          icon={<CalendarMonthIcon />}
                          label={timelineOptions.find(option => option.value === selectedTimeline)?.label || 'All Time'}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.25)',
                            color: 'white',
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                      {selectedTimeline === 'custom' && customStartDate && customEndDate && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', display: 'block', mt: 0.5 }}>
                          {format(customStartDate, 'MMM dd, yyyy')} → {format(customEndDate, 'MMM dd, yyyy')}
                        </Typography>
                      )}
                      {getFilteredTransactions().length > 0 && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block', mt: 0.5 }}>
                          {(() => {
                            const tx = getFilteredTransactions();
                            const times = tx.map(t => new Date(t.date).getTime());
                            const start = new Date(Math.min(...times));
                            const end = new Date(Math.max(...times));
                            return `${format(start, 'MMM dd')} – ${format(end, 'MMM dd, yyyy')}`;
                          })()}
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                  
                  {/* Content Area */}
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
                    {/* Financial Summary Cards */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                      <Paper 
                        sx={{ 
                          flex: 1, 
                          p: 2.5, 
                          background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                          color: 'white',
                          borderRadius: 3,
                          boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TrendingUpIcon sx={{ fontSize: 24 }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.95 }}>
                            Income
                          </Typography>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                          ₹{getFilteredTransactions().filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>
                          {getFilteredTransactions().filter(t => t.type === 'income').length} transactions
                        </Typography>
                      </Paper>
                      <Paper 
                        sx={{ 
                          flex: 1, 
                          p: 2.5, 
                          background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                          color: 'white',
                          borderRadius: 3,
                          boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TrendingDownIcon sx={{ fontSize: 24 }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, opacity: 0.95 }}>
                            Expenses
                          </Typography>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                          ₹{getFilteredTransactions().filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>
                          {getFilteredTransactions().filter(t => t.type === 'expense').length} transactions
                        </Typography>
                      </Paper>
                    </Box>
                    
                    {/* Transaction Lists */}
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary' }}>
                      Transactions
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Button 
                        variant={listType === 'income' ? 'contained' : 'outlined'}
                        color="success"
                        size="medium"
                        startIcon={<TrendingUpIcon />}
                        onClick={() => setListType('income')}
                        sx={{ 
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          px: 2,
                        }}
                      >
                        Income
                      </Button>
                      <Button 
                        variant={listType === 'expense' ? 'contained' : 'outlined'}
                        color="error"
                        size="medium"
                        startIcon={<TrendingDownIcon />}
                        onClick={() => setListType('expense')}
                        sx={{ 
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          px: 2,
                        }}
                      >
                        Expenses
                      </Button>
                    </Box>
                    <Paper 
                      sx={{ 
                        p: 0, 
                        flex: 1, 
                        overflow: 'auto',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        maxHeight: 'calc(100vh - 450px)',
                      }}
                    >
                      <List sx={{ py: 0 }}>
                        {getFilteredTransactions()
                          .filter(t => listType === 'income' ? t.type === 'income' : t.type === 'expense')
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map((transaction, index, arr) => (
                            <React.Fragment key={`${listType}-${index}`}>
                              <ListItem
                                sx={{
                                  py: 1.5,
                                  px: 2,
                                  '&:hover': {
                                    bgcolor: 'action.hover',
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  <Avatar
                                    sx={{
                                      bgcolor: transaction.type === 'income' ? 'success.light' : 'error.light',
                                      width: 36,
                                      height: 36,
                                    }}
                                  >
                                    {transaction.type === 'income' ? 
                                      <TrendingUpIcon sx={{ color: 'white', fontSize: 20 }} /> : 
                                      <TrendingDownIcon sx={{ color: 'white', fontSize: 20 }} />
                                    }
                                  </Avatar>
                                </ListItemIcon>
                                <ListItemText 
                                  primary={
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                      {transaction.description}
                                    </Typography>
                                  }
                                  secondary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary">
                                        {format(new Date(transaction.date), 'MMM dd, yyyy')}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          color: transaction.type === 'income' ? 'success.main' : 'error.main',
                                          fontWeight: 700,
                                          ml: 'auto',
                                        }}
                                      >
                                        {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </ListItem>
                              {index < arr.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                          ))}
                        {getFilteredTransactions().filter(t => listType === 'income' ? t.type === 'income' : t.type === 'expense').length === 0 && (
                          <ListItem sx={{ py: 4 }}>
                            <ListItemText 
                              primary={
                                <Typography variant="body1" color="text.secondary" align="center">
                                  {listType === 'income' ? 'No income transactions' : 'No expense transactions'}
                                </Typography>
                              }
                            />
                          </ListItem>
                        )}
                      </List>
                    </Paper>
                  </Box>
                </Box>
              </Box>

              {/* Input Area */}
              <Box sx={{ 
                p: isMobile ? '8px 12px' : '16px', 
                bgcolor: 'background.paper',
                borderTop: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky',
                bottom: 0,
                boxShadow: '0 -1px 4px rgba(0,0,0,0.05)',
              }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end',paddingBottom: 2 }}>
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
                  {isLoading ? (
                    <Button
                      variant="contained"
                      onClick={() => {
                        setIsLoading(false);
                        setIsProcessing(false);
                      }}
                      sx={{
                        minWidth: '40px',
                        height: '36px',
                        p: 0,
                        borderRadius: '10px',
                        bgcolor: '#ef5350',
                        '&:hover': {
                          bgcolor: '#e53935',
                        }
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 20 }} />
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || isProcessing}
                      sx={{
                        minWidth: '40px',
                        height: '36px',
                        p: 0,
                        borderRadius: '10px',
                        bgcolor: '#2196f3',
                        '&:hover': {
                          bgcolor: '#1976d2',
                        }
                      }}
                    >
                      <SendIcon sx={{ fontSize: 20 }} />
                    </Button>
                  )}
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
                  {/* Share removed to avoid public share errors */}
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

      {/* Share UI removed to avoid createPublicShare errors on some environments */}

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

      {/* Transaction Details Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => {}}
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            bgcolor: 'background.default'
          }
        }}
      >
        {selectedSessionDetails && (
          <>
            {/* Header with accent color */}
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: 'primary.main',
                color: 'white',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ChatIcon />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedSessionDetails.title} #{selectedSessionDetails.sessionNumber}
                  </Typography>
                </Box>
                <IconButton 
                  onClick={() => setDrawerOpen(false)}
                  sx={{ color: 'white' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Created</Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarMonthIcon fontSize="small" />
                    {format(new Date(selectedSessionDetails.createdAt), 'MMM dd, yyyy')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Timeline</Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {sessionTransactions.startDate ? 
                      `${format(sessionTransactions.startDate, 'MMM dd')} - ${format(sessionTransactions.endDate, 'MMM dd')}` :
                      'No transactions'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Summary Cards */}
            <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
              <Card sx={{ flex: 1, bgcolor: 'success.light', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUpIcon />
                    <Typography variant="h6">Income</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    ₹{sessionTransactions.totalIncome.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    {sessionTransactions.income.length} transactions
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, bgcolor: 'error.light', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingDownIcon />
                    <Typography variant="h6">Expenses</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    ₹{sessionTransactions.totalExpenses.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    {sessionTransactions.expenses.length} transactions
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Transactions List */}
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Recent Transactions</Typography>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
                {[...sessionTransactions.income, ...sessionTransactions.expenses]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((transaction, index) => (
                    <Box 
                      key={index}
                      sx={{ 
                        p: 2,
                        borderBottom: index !== sessionTransactions.income.length + sessionTransactions.expenses.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="subtitle1">{transaction.description || 'No description'}</Typography>
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            color: transaction.type === 'income' ? 'success.main' : 'error.main',
                            fontWeight: 600
                          }}
                        >
                          ₹{transaction.amount.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </Typography>
                        <Chip 
                          size="small"
                          label={transaction.type === 'income' ? 'Income' : 'Expense'}
                          color={transaction.type === 'income' ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  ))}
                {sessionTransactions.income.length + sessionTransactions.expenses.length === 0 && (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">No transactions in this period</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </SwipeableDrawer>
    </>
  );
};

export default SubbaraoChat;