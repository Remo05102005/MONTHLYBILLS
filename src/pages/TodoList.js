import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Snackbar,
  Alert,
  Chip,
  Card,
  CardContent,
  Grid,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  SwipeableDrawer,
  Divider,
  Avatar,
  Badge,
  LinearProgress,
  Tooltip,
  CircularProgress,
  Backdrop,
  Skeleton,
  RefreshIndicator,
  SwipeableList,
  SwipeableListItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  PriorityHigh as PriorityHighIcon,
  LowPriority as LowPriorityIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { fetchTodos, addTodoAsync, updateTodoAsync, deleteTodoAsync } from '../store/todoSlice';
import { auth } from '../firebase/config';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import notificationService from '../services/notificationService';

const TodoList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { todos, loading, error: reduxError } = useSelector(state => state.todos);

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState(null);
  const [success, setSuccess] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Refs for mobile interactions
  const listRef = useRef(null);
  const pullRefreshRef = useRef(null);

  // Form data with advanced fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    completed: false,
    priority: 'medium',
    category: 'personal',
    dueDate: null,
    reminderDate: null,
  });

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pull-to-refresh functionality
  const handlePullRefresh = useCallback(async () => {
    if (!isOnline) return;

    setRefreshing(true);
    try {
      await dispatch(fetchTodos());
      setSuccess('Todos refreshed successfully!');
    } catch (err) {
      setLocalError('Failed to refresh todos. Please try again.');
      console.error('Error refreshing todos:', err);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, isOnline]);

  // Check if user came from notification click
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('from') === 'notification') {
      // Scroll to top or highlight recent todos
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location]);

  // Handle notification actions from service worker
  useEffect(() => {
    const handleNotificationAction = (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
        const { action, todoId, data } = event.data;

        switch (action) {
          case 'complete':
            // Mark the todo as complete
            const todoToComplete = todos.find(t => t.id === todoId);
            if (todoToComplete && !todoToComplete.completed) {
              handleToggleComplete(todoToComplete);
              setSuccess('Todo marked as complete from notification!');
            }
            break;
          case 'snooze':
            // Reschedule the reminder (handled by notification service)
            setSuccess('Reminder snoozed for 1 hour!');
            break;
          default:
            break;
        }
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', handleNotificationAction);

    // Also check for pending actions on component mount
    const pendingActions = JSON.parse(localStorage.getItem('pendingNotificationActions') || '[]');
    if (pendingActions.length > 0) {
      pendingActions.forEach(action => {
        if (action.action === 'complete') {
          const todoToComplete = todos.find(t => t.id === action.todoId);
          if (todoToComplete && !todoToComplete.completed) {
            handleToggleComplete(todoToComplete);
          }
        }
      });
      // Clear processed actions
      localStorage.setItem('pendingNotificationActions', '[]');
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleNotificationAction);
    };
  }, [todos]);

  useEffect(() => {
    if (auth.currentUser) {
      dispatch(fetchTodos());
      // Initialize notifications for the user
      notificationService.initializeNotifications(auth.currentUser.uid);
    }
  }, [dispatch]);

  // Update reminders when todos change
  useEffect(() => {
    if (todos.length > 0) {
      notificationService.updateReminders(todos);
    }
  }, [todos]);

  const handleOpenAddModal = (todo = null) => {
    if (todo) {
      setEditingTodo(todo);
      setFormData({
        title: todo.title || '',
        description: todo.description || '',
        completed: todo.completed || false,
        priority: todo.priority || 'medium',
        category: todo.category || 'personal',
        dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
        reminderDate: todo.reminderDate ? new Date(todo.reminderDate) : null,
      });
    } else {
      setEditingTodo(null);
      setFormData({
        title: '',
        description: '',
        completed: false,
        priority: 'medium',
        category: 'personal',
        dueDate: null,
        reminderDate: null,
      });
    }
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingTodo(null);
    setFormData({
      title: '',
      description: '',
      completed: false,
      priority: 'medium',
      category: 'personal',
      dueDate: null,
      reminderDate: null,
    });
  };

  const handleSaveTodo = async () => {
    if (!formData.title.trim()) {
      return;
    }

    const todoData = {
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim(),
      createdAt: editingTodo ? editingTodo.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingTodo) {
        await dispatch(updateTodoAsync({ id: editingTodo.id, todo: todoData }));
        setSuccess('Todo updated successfully!');
      } else {
        await dispatch(addTodoAsync(todoData));
        setSuccess('Todo added successfully!');
      }
      handleCloseModal();
    } catch (err) {
      console.error('Error saving todo:', err);
    }
  };

  const handleToggleComplete = async (todo) => {
    try {
      await dispatch(updateTodoAsync({
        id: todo.id,
        todo: {
          ...todo,
          completed: !todo.completed,
          updatedAt: new Date().toISOString(),
        }
      }));
    } catch (err) {
      console.error('Error updating todo:', err);
    }
  };

  const handleDeleteTodo = async () => {
    if (todoToDelete) {
      try {
        await dispatch(deleteTodoAsync(todoToDelete.id));
        setSuccess('Todo deleted successfully!');
        setDeleteDialogOpen(false);
        setTodoToDelete(null);
      } catch (err) {
        console.error('Error deleting todo:', err);
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSuccess(null);
  };

  // Filter and search todos
  const filteredTodos = todos.filter(todo => {
    const matchesSearch = todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         todo.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'all' || todo.priority === filterPriority;
    const matchesCategory = filterCategory === 'all' || todo.category === filterCategory;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  const pendingTodos = filteredTodos.filter(todo => !todo.completed);
  const completedTodos = filteredTodos.filter(todo => todo.completed);

  // Statistics
  const totalTodos = todos.length;
  const completedCount = todos.filter(todo => todo.completed).length;
  const completionRate = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0;
  const overdueTodos = pendingTodos.filter(todo =>
    todo.dueDate && new Date(todo.dueDate) < new Date()
  ).length;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return <PriorityHighIcon />;
      case 'low': return <LowPriorityIcon />;
      default: return null;
    }
  };

  const TodoItem = ({ todo, isCompleted }) => (
    <Card
      sx={{
        mb: 2,
        borderRadius: 2,
        boxShadow: isMobile ? 1 : 2,
        border: overdueTodos > 0 && !isCompleted ? '2px solid #f44336' : 'none',
        backgroundColor: isCompleted ? 'grey.50' : 'white',
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Checkbox
            checked={todo.completed}
            onChange={() => handleToggleComplete(todo)}
            color="primary"
            sx={{ mt: -0.5 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'medium',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                  color: isCompleted ? 'text.secondary' : 'text.primary',
                  flex: 1,
                  fontSize: isMobile ? '1rem' : '1.25rem',
                }}
              >
                {todo.title}
              </Typography>

              {todo.priority && (
                <Chip
                  icon={getPriorityIcon(todo.priority)}
                  label={todo.priority}
                  size="small"
                  color={getPriorityColor(todo.priority)}
                  variant="outlined"
                />
              )}
            </Box>

            {todo.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {todo.description}
              </Typography>
            )}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {todo.category && (
                <Chip
                  icon={<CategoryIcon />}
                  label={todo.category}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}

              {todo.dueDate && (
                <Chip
                  icon={<DateRangeIcon />}
                  label={`Due: ${format(new Date(todo.dueDate), 'dd MMM yyyy')}`}
                  size="small"
                  color={new Date(todo.dueDate) < new Date() && !isCompleted ? 'error' : 'default'}
                  variant="outlined"
                />
              )}

              {todo.reminderDate && (
                <Chip
                  icon={<ScheduleIcon />}
                  label={format(new Date(todo.reminderDate), 'dd MMM yyyy HH:mm:ss')}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => handleOpenAddModal(todo)}
                sx={{ color: 'primary.main' }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => {
                  setTodoToDelete(todo);
                  setDeleteDialogOpen(true);
                }}
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: 'grey.50',
      pb: isMobile ? 10 : 4
    }}>
      {/* Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        p: isMobile ? 3 : 4,
        pb: isMobile ? 4 : 5
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 'bold' }}>
            📝 Todo List
          </Typography>
          {/* Online/Offline Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isOnline ? 'success.main' : 'error.main',
                boxShadow: '0 0 8px rgba(255,255,255,0.5)'
              }}
            />
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {isOnline ? 'Online' : 'Offline'}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
          Stay organized and never miss a task
        </Typography>

        {/* Stats Cards */}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {totalTodos}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Total Tasks
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {completionRate}%
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Completed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {pendingTodos.length}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Pending
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: overdueTodos > 0 ? '#ffcccb' : 'white' }}>
                  {overdueTodos}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Overdue
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Progress Bar */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
            Overall Progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={completionRate}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'white',
                borderRadius: 4,
              }
            }}
          />
        </Box>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ p: isMobile ? 2 : 3, pt: 3 }}>
        <Card sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  placeholder="Search todos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filterPriority}
                    label="Priority"
                    onChange={(e) => setFilterPriority(e.target.value)}
                  >
                    <MenuItem value="all">All Priorities</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    label="Category"
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    <MenuItem value="personal">Personal</MenuItem>
                    <MenuItem value="work">Work</MenuItem>
                    <MenuItem value="shopping">Shopping</MenuItem>
                    <MenuItem value="health">Health</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            mb: 3,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 'medium',
              fontSize: isMobile ? '0.9rem' : '1rem',
            }
          }}
        >
          <Tab
            label={
              <Badge badgeContent={pendingTodos.length} color="warning" max={99}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <UncheckedIcon />
                  <span>Pending</span>
                </Box>
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={completedTodos.length} color="success" max={99}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon />
                  <span>Completed</span>
                </Box>
              </Badge>
            }
          />
        </Tabs>

        {/* Loading State */}
        {loading && (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3].map((i) => (
              <Card key={i} sx={{ mb: 2, borderRadius: 2 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Skeleton variant="circular" width={24} height={24} sx={{ mt: -0.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1 }} />
                      <Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={80} height={24} />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Error State */}
        {reduxError && !loading && (
          <Card sx={{ m: 2, borderRadius: 2, border: '1px solid', borderColor: 'error.main' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="error" sx={{ mb: 2 }}>
                Failed to load todos
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {reduxError}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => dispatch(fetchTodos())}
                disabled={!isOnline}
              >
                {isOnline ? 'Retry' : 'Offline - Check connection'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Todo Lists */}
        {!loading && !reduxError && activeTab === 0 && (
          <Box ref={listRef}>
            {pendingTodos.length === 0 ? (
              <Card sx={{ textAlign: 'center', py: 6, borderRadius: 2 }}>
                <CardContent>
                  <UncheckedIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No pending todos
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Great job! All caught up.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              pendingTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} isCompleted={false} />
              ))
            )}
          </Box>
        )}

        {!loading && !reduxError && activeTab === 1 && (
          <Box ref={listRef}>
            {completedTodos.length === 0 ? (
              <Card sx={{ textAlign: 'center', py: 6, borderRadius: 2 }}>
                <CardContent>
                  <CheckCircleIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No completed todos yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete some tasks to see them here.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              completedTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} isCompleted={true} />
              ))
            )}
          </Box>
        )}
      </Box>

      {/* Add Todo FAB */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: isMobile ? 80 : 24,
          right: isMobile ? 16 : 24,
          zIndex: 1000,
          width: isMobile ? 60 : 56,
          height: isMobile ? 60 : 56,
        }}
        onClick={() => handleOpenAddModal()}
      >
        <AddIcon />
      </Fab>

      {/* Add/Edit Todo Bottom Sheet (Mobile) or Dialog (Desktop) */}
      {isMobile ? (
        <SwipeableDrawer
          anchor="bottom"
          open={isAddModalOpen}
          onClose={handleCloseModal}
          onOpen={() => {}}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '90vh',
            }
          }}
        >
          <Box sx={{ p: 3 }}>
            <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2, mx: 'auto', mb: 3 }} />
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
              {editingTodo ? 'Edit Todo' : 'Add New Todo'}
            </Typography>

            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              sx={{ mb: 2 }}
              autoFocus
            />

            <TextField
              fullWidth
              label="Description (optional)"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => {
                  const newPriority = e.target.value;
                  // Clear reminder date for low priority
                  const updatedFormData = {
                    ...formData,
                    priority: newPriority,
                    reminderDate: newPriority === 'low' ? null : formData.reminderDate
                  };
                  setFormData(updatedFormData);
                }}
              >
                <MenuItem value="low">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LowPriorityIcon sx={{ color: 'success.main' }} />
                    <Box>
                      <Typography variant="body2">Low</Typography>
                      <Typography variant="caption" color="text.secondary">No notifications</Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="medium">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 'medium' }}>⚠️</Typography>
                    <Box>
                      <Typography variant="body2">Medium</Typography>
                      <Typography variant="caption" color="text.secondary">Gets notifications</Typography>
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem value="high">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PriorityHighIcon sx={{ color: 'error.main' }} />
                    <Box>
                      <Typography variant="body2">High</Typography>
                      <Typography variant="caption" color="text.secondary">Gets notifications</Typography>
                    </Box>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="personal">Personal</MenuItem>
                <MenuItem value="work">Work</MenuItem>
                <MenuItem value="shopping">Shopping</MenuItem>
                <MenuItem value="health">Health</MenuItem>
              </Select>
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateTimePicker
                label="Due Date (optional)"
                value={formData.dueDate}
                onChange={(newValue) => setFormData({ ...formData, dueDate: newValue })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth sx={{ mb: 2 }} />
                )}
                ampm={false}
                inputFormat="dd/MM/yyyy HH:mm"
              />

              {/* Only show reminder picker for medium and high priority */}
              {(formData.priority === 'medium' || formData.priority === 'high') && (
                <Box sx={{ mb: 3 }}>
                  <DateTimePicker
                    label={`Reminder Date & Time ${formData.priority === 'high' ? '(Recommended)' : '(Optional)'}`}
                    value={formData.reminderDate}
                    onChange={(newValue) => setFormData({ ...formData, reminderDate: newValue })}
                    renderInput={(params) => (
                      <TextField {...params} fullWidth />
                    )}
                    ampm={false}
                    inputFormat="dd/MM/yyyy HH:mm:ss"
                    views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                    helperText={
                      formData.priority === 'high'
                        ? "High priority tasks will send notifications even when app is closed"
                        : "Medium priority tasks will send notifications when app is open"
                    }
                  />
                  <Typography variant="caption" color="info.main" sx={{ mt: 1, display: 'block' }}>
                    💡 Notifications will appear with title "COMMON MAN" and body "Reminder for: [task title]"
                  </Typography>
                </Box>
              )}

              {/* Show info for low priority */}
              {formData.priority === 'low' && (
                <Box sx={{
                  p: 2,
                  bgcolor: 'success.light',
                  borderRadius: 1,
                  mb: 3,
                  border: '1px solid',
                  borderColor: 'success.main'
                }}>
                  <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'medium' }}>
                    ℹ️ Low priority tasks don't receive notifications to avoid unnecessary interruptions.
                  </Typography>
                </Box>
              )}
            </LocalizationProvider>

            <Button
              fullWidth
              variant="contained"
              onClick={handleSaveTodo}
              disabled={!formData.title.trim()}
              sx={{ py: 1.5, borderRadius: 2 }}
            >
              {editingTodo ? 'Update Todo' : 'Add Todo'}
            </Button>
          </Box>
        </SwipeableDrawer>
      ) : (
        <Dialog
          open={isAddModalOpen}
          onClose={handleCloseModal}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 'bold' }}>
            {editingTodo ? 'Edit Todo' : 'Add New Todo'}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              sx={{ mb: 2, mt: 1 }}
              autoFocus
            />

            <TextField
              fullWidth
              label="Description (optional)"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mb: 2 }}
            />

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <MenuItem value="personal">Personal</MenuItem>
                    <MenuItem value="work">Work</MenuItem>
                    <MenuItem value="shopping">Shopping</MenuItem>
                    <MenuItem value="health">Health</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateTimePicker
                label="Due Date (optional)"
                value={formData.dueDate}
                onChange={(newValue) => setFormData({ ...formData, dueDate: newValue })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth sx={{ mb: 2 }} />
                )}
                ampm={false}
                inputFormat="dd/MM/yyyy HH:mm"
              />

              <DateTimePicker
                label="Reminder Date & Time (optional)"
                value={formData.reminderDate}
                onChange={(newValue) => setFormData({ ...formData, reminderDate: newValue })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth sx={{ mb: 2 }} />
                )}
                ampm={false}
                inputFormat="dd/MM/yyyy HH:mm:ss"
                views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
              />
            </LocalizationProvider>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button
              onClick={handleSaveTodo}
              variant="contained"
              disabled={!formData.title.trim()}
            >
              {editingTodo ? 'Update Todo' : 'Add Todo'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Delete Todo</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{todoToDelete?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTodo} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{
            width: '100%',
            borderRadius: 2,
            boxShadow: 3
          }}
        >
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TodoList;
