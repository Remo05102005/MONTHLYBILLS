import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  IconButton,
  Paper,
  Select,
  MenuItem,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Stop as StopIcon,
  ContentCopy,
  Add as AddIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import genaiService from '../services/genaiService';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const SubbaraoChat = ({ transactions, selectedMonth, isOpen, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();

  // Styles
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: theme.palette.background.default,
    },
    topBar: {
      padding: theme.spacing(2),
      borderBottom: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      zIndex: 1,
    },
    chatArea: {
      flex: 1,
      overflow: 'auto',
      padding: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    },
    inputArea: {
      padding: theme.spacing(2),
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      position: 'sticky',
      bottom: 0,
    },
    researchAnimation: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: theme.spacing(3),
      borderRadius: theme.shape.borderRadius,
      boxShadow: theme.shadows[4],
      zIndex: 2,
    },
  };

  // State
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState('thisMonth');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [customDateError, setCustomDateError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);

  // Refs
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

  // Effects
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChatSessions();
  }, [currentUser]);

  const loadChatSessions = async () => {
    try {
      const sessions = await getChatSessions(currentUser.uid);
      setChatSessions(sessions);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      setSnackbarMessage('Error loading chat history');
      setSnackbarOpen(true);
    }
  };

  const loadChatSession = async (sessionId) => {
    try {
      const session = await getChatSession(currentUser.uid, sessionId);
      if (session) {
        setMessages(session.messages);
        setCurrentSessionId(sessionId);
        setShowHistoryDrawer(false);
      }
    } catch (error) {
      console.error('Error loading chat session:', error);
      setSnackbarMessage('Error loading chat session');
      setSnackbarOpen(true);
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
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return transactions.filter(transaction => {
      const date = new Date(transaction.date);
      return date >= startDate && date <= endDate;
    });
  };

  // Handlers
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsResearching(true);

    try {
      const filteredTransactions = getFilteredTransactions();
      const response = await genaiService.chatWithAI({
        messages: [...messages, userMessage],
        transactions: filteredTransactions,
        timeline: selectedTimeline,
        startDate: customStartDate,
        endDate: customEndDate,
      });

      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('Error sending message:', error);
      setSnackbarMessage('Error sending message. Please try again.');
      setSnackbarOpen(true);
    } finally {
      setIsResearching(false);
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (isStopping) return;
    setIsStopping(true);
    genaiService.stopGeneration();
    setIsLoading(false);
    setIsResearching(false);
    setIsStopping(false);
  };

  const handleCustomDateChange = (type, value) => {
    if (type === 'start') {
      setCustomStartDate(value);
      setCustomDateError('');
    } else if (type === 'end') {
      setCustomEndDate(value);
      setCustomDateError('');
    } else if (type === 'apply') {
      if (!customStartDate || !customEndDate) {
        setCustomDateError('Please select both start and end dates');
        return;
      }
      if (new Date(customEndDate) < new Date(customStartDate)) {
        setCustomDateError('End date must be after start date');
        return;
      }
      setSelectedTimeline('custom');
      setShowCustomDatePicker(false);
    }
  };

  // Custom Dialog Components
  const CustomDatePickerDialog = ({ open, onClose, startDate, endDate, onDateChange, error }) => (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Select Date Range</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => onDateChange('start', newValue)}
              renderInput={(params) => <TextField {...params} />}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => onDateChange('end', newValue)}
              renderInput={(params) => <TextField {...params} />}
            />
          </LocalizationProvider>
          {error && (
            <Typography color="error">{error}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onDateChange('apply')} color="primary">
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Render sections
  const renderTopBar = () => (
    <Box sx={styles.topBar}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6">AI Assistant</Typography>
          <Stack direction="row" spacing={1}>
            <IconButton
              onClick={() => {
                setMessages([]);
                setCurrentSessionId(null);
              }}
              title="New Chat"
              size="small"
            >
              <AddIcon />
            </IconButton>
            <IconButton
              onClick={() => setShowHistoryDrawer(true)}
              title="Chat History"
              size="small"
            >
              <HistoryIcon />
            </IconButton>
            <Select
              size="small"
              value={selectedTimeline}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'custom') {
                  setShowCustomDatePicker(true);
                } else {
                  setSelectedTimeline(value);
                }
              }}
              sx={{ minWidth: 120 }}
            >
              {timelineOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <IconButton
              onClick={onClose}
              edge="end"
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
        {messages.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Suggested Questions:
            </Typography>
            <Stack spacing={1}>
              {[
                "What are my top spending categories this month?",
                "Compare my expenses with last month",
                "Show me unusual transactions",
                "What's my biggest expense?",
                "Analyze my spending patterns"
              ].map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setInputMessage(suggestion);
                    handleSendMessage();
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {suggestion}
                </Button>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );

  const renderChatArea = () => (
    <Box sx={styles.chatArea}>
      {messages.map((message, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            mb: 2,
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: 2,
              maxWidth: '80%',
              backgroundColor: message.role === 'user' 
                ? theme.palette.primary.light 
                : theme.palette.background.paper,
              color: message.role === 'user'
                ? theme.palette.primary.contrastText
                : theme.palette.text.primary,
            }}
          >
            <Typography>{message.content}</Typography>
          </Paper>
        </Box>
      ))}
      <div ref={messagesEndRef} />
      {isResearching && (
        <Box sx={styles.researchAnimation}>
          <CircularProgress size={40} />
          <Typography variant="h6">Conducting Deep Research</Typography>
          <Typography variant="body2" color="text.secondary">
            Analyzing transactions and patterns...
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderInputArea = () => (
    <Box sx={styles.inputArea}>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          ref={inputRef}
          fullWidth
          multiline
          maxRows={3}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isLoading}
          sx={{ flex: 1 }}
        />
        <IconButton
          color="primary"
          onClick={handleSendMessage}
          disabled={isLoading || !inputMessage.trim()}
        >
          <SendIcon />
        </IconButton>
        {isLoading && (
          <IconButton
            color="secondary"
            onClick={handleStop}
            disabled={isStopping}
          >
            <StopIcon />
          </IconButton>
        )}
      </Stack>
    </Box>
  );

  // Main render
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: styles.container
      }}
    >
      {renderTopBar()}
      {renderChatArea()}
      {renderInputArea()}

      {/* Modals */}
      <CustomDatePickerDialog 
        open={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        startDate={customStartDate}
        endDate={customEndDate}
        onDateChange={handleCustomDateChange}
        error={customDateError}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />

      {/* History Drawer */}
      <Drawer
        anchor="right"
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Chat History</Typography>
              <IconButton onClick={() => setShowHistoryDrawer(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            {chatSessions.map((session) => (
              <Card key={session.id}>
                <CardContent>
                  <Typography variant="subtitle2">
                    {format(new Date(session.timestamp), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                  <Typography variant="body2" noWrap>
                    {session.title || 'Untitled Chat'}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => loadChatSession(session.id)}
                    disabled={currentSessionId === session.id}
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setSessionToDelete(session.id);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Box>
      </Drawer>
    </Dialog>
  );
};

export default SubbaraoChat;