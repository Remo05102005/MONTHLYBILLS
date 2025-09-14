import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Fade,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
} from '@mui/material';
import {
  Share as ShareIcon,
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import html2canvas from 'html2canvas';

const ExpenditureList = ({ transactions, selectedMonth, onEditTransaction, onDeleteTransaction }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const shareRef = useRef();

  // Filter transactions for the selected month
  const filteredTransactions = useMemo(() => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);
    return transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  }, [transactions, selectedMonth]);

  // Group transactions by day
  const dailyTransactions = useMemo(() => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);
    const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
    
    const dailyMap = {};
    daysInPeriod.forEach(day => {
      dailyMap[format(day, 'yyyy-MM-dd')] = {
        date: day,
        income: 0,
        expense: 0,
        balance: 0,
        transactions: []
      };
    });
    
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const dayKey = format(date, 'yyyy-MM-dd');
      if (dailyMap[dayKey]) {
        dailyMap[dayKey].transactions.push(transaction);
        if (transaction.type === 'income') {
          dailyMap[dayKey].income += Number(transaction.amount);
        } else {
          dailyMap[dayKey].expense += Number(transaction.amount);
        }
        dailyMap[dayKey].balance = dailyMap[dayKey].income - dailyMap[dayKey].expense;
      }
    });
    
    return Object.values(dailyMap).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredTransactions, selectedMonth]);

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setDayModalOpen(true);
  };

  const handleCloseDayModal = () => {
    setDayModalOpen(false);
    setSelectedDay(null);
  };

  const handleShare = async () => {
    if (!shareRef.current) return;
    
    try {
      const canvas = await html2canvas(shareRef.current, { 
        backgroundColor: null, 
        useCORS: true,
        scale: 2,
        width: 400,
        height: 600
      });
      
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard) {
          try {
            await navigator.clipboard.write([
              new window.ClipboardItem({ 'image/png': blob })
            ]);
            setSuccess('Day summary copied to clipboard!');
          } catch (err) {
            setError('Failed to copy image.');
          }
        } else {
          setError('Clipboard not supported.');
        }
      });
    } catch (err) {
      setError('Failed to generate image.');
    }
  };

  const handleCloseSnackbar = () => {
    setError(null);
    setSuccess(null);
  };

  const formatAmount = (amount) => {
    return Math.round(Number(amount)).toLocaleString('en-IN');
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom sx={{ 
        fontWeight: 'bold', 
        color: 'primary.main',
        mb: 3,
        textAlign: 'center'
      }}>
        Daily Expenditure Overview
      </Typography>

      {/* Mobile-optimized day cards for 6.78-inch screens */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 1.5,
        maxWidth: '100%',
        overflow: 'hidden',
        px: 0.5 // Small padding to prevent edge cutoff
      }}>
        {dailyTransactions.map((day) => (
          <Card
            key={format(day.date, 'yyyy-MM-dd')}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 3,
              },
              borderRadius: 2.5,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              minHeight: '75px',
              maxWidth: '100%',
              width: '100%',
            }}
            onClick={() => handleDayClick(day)}
          >
            <CardContent sx={{ 
              p: 1.5, 
              '&:last-child': { pb: 1.5 },
              maxWidth: '100%',
              overflow: 'hidden'
            }}>
              {/* Date header - optimized for small screens */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 1,
                minHeight: '24px'
              }}>
                <Typography variant="h6" sx={{ 
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  mr: 1
                }}>
                  {format(day.date, 'dd MMM yyyy')}
                </Typography>
                <CalendarIcon sx={{ color: 'primary.main', fontSize: '18px', flexShrink: 0 }} />
              </Box>

              {/* Transaction summary - compact layout */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 0.5,
                gap: 1
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 0.3,
                  flex: 1,
                  minWidth: 0
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    overflow: 'hidden'
                  }}>
                    <TrendingUpIcon sx={{ color: 'success.main', fontSize: '14px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ 
                      color: 'success.main', 
                      fontWeight: 600,
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      ₹{formatAmount(day.income)}
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    overflow: 'hidden'
                  }}>
                    <TrendingDownIcon sx={{ color: 'error.main', fontSize: '14px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ 
                      color: 'error.main', 
                      fontWeight: 600,
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      ₹{formatAmount(day.expense)}
                    </Typography>
                  </Box>
                </Box>

                {/* Balance - compact */}
                <Box sx={{ 
                  textAlign: 'right',
                  minWidth: '70px',
                  flexShrink: 0
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                    Balance
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    color: day.balance >= 0 ? 'success.main' : 'error.main',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    lineHeight: 1.2
                  }}>
                    ₹{formatAmount(day.balance)}
                  </Typography>
                </Box>
              </Box>

              {/* Transaction count - compact footer */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 0.5
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ 
                  fontSize: '11px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  mr: 1
                }}>
                  {day.transactions.length} transaction{day.transactions.length !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="caption" color="primary.main" sx={{ 
                  fontSize: '11px',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  Tap to view
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Day Details Modal */}
      <Dialog
        open={dayModalOpen}
        onClose={handleCloseDayModal}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        TransitionComponent={Fade}
        PaperProps={{ 
          sx: { 
            borderRadius: isMobile ? 0 : 3, 
            overflow: 'hidden',
            maxHeight: '90vh'
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1,
          bgcolor: 'primary.main',
          color: 'white'
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {selectedDay && format(selectedDay.date, 'dd MMM yyyy')}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {selectedDay && selectedDay.transactions.length} transaction{selectedDay && selectedDay.transactions.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <IconButton 
            onClick={handleCloseDayModal} 
            sx={{ color: 'white' }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: 'background.paper', maxHeight: '70vh', overflow: 'auto' }}>
          <div ref={shareRef} style={{ background: 'white', padding: isMobile ? '12px' : '16px' }}>
            {/* Day Summary Header - mobile optimized */}
            <Box sx={{ 
              textAlign: 'center', 
              mb: 2,
              p: isMobile ? 1.5 : 2,
              bgcolor: 'grey.50',
              borderRadius: 2
            }}>
              <Typography variant="h5" sx={{ 
                fontWeight: 'bold', 
                mb: 1,
                fontSize: isMobile ? '18px' : '20px'
              }}>
                {selectedDay && format(selectedDay.date, 'dd MMM yyyy')}
              </Typography>
              <Stack 
                direction={isMobile ? "column" : "row"} 
                spacing={isMobile ? 1.5 : 3} 
                justifyContent="center" 
                sx={{ mb: 2 }}
              >
                <Box sx={{ textAlign: 'center', minWidth: isMobile ? 'auto' : '80px' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '12px' : '14px' }}>
                    Income
                  </Typography>
                  <Typography variant="h6" color="success.main" sx={{ 
                    fontWeight: 'bold',
                    fontSize: isMobile ? '16px' : '18px'
                  }}>
                    ₹{selectedDay && formatAmount(selectedDay.income)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: isMobile ? 'auto' : '80px' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '12px' : '14px' }}>
                    Expense
                  </Typography>
                  <Typography variant="h6" color="error.main" sx={{ 
                    fontWeight: 'bold',
                    fontSize: isMobile ? '16px' : '18px'
                  }}>
                    ₹{selectedDay && formatAmount(selectedDay.expense)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: isMobile ? 'auto' : '80px' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '12px' : '14px' }}>
                    Balance
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: isMobile ? '16px' : '18px',
                      color: selectedDay && selectedDay.balance >= 0 ? 'success.main' : 'error.main'
                    }}
                  >
                    ₹{selectedDay && formatAmount(selectedDay.balance)}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Transactions List - mobile optimized */}
            {selectedDay && selectedDay.transactions.length > 0 ? (
              <List sx={{ p: 0 }}>
                {selectedDay.transactions.map((transaction, index) => (
                  <React.Fragment key={transaction.id}>
                    <ListItem 
                      sx={{ 
                        px: isMobile ? 1 : 2,
                        py: isMobile ? 1 : 1.5,
                        '&:hover': { bgcolor: 'action.hover' },
                        flexDirection: 'column',
                        alignItems: 'stretch'
                      }}
                    >
                      {/* Main transaction info */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        width: '100%',
                        mb: 0.5
                      }}>
                        <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                          <Typography variant="body1" sx={{ 
                            fontWeight: 600,
                            fontSize: isMobile ? '14px' : '15px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.3
                          }}>
                            {transaction.subCategory ? `${transaction.category} - ${transaction.subCategory}` : transaction.category}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ 
                            fontSize: isMobile ? '12px' : '13px',
                            mt: 0.2
                          }}>
                            {format(new Date(transaction.date), 'HH:mm')} • {transaction.type}
                          </Typography>
                        </Box>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          flexShrink: 0
                        }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              color: transaction.type === 'income' ? 'success.main' : 'error.main',
                              fontWeight: 'bold',
                              fontSize: isMobile ? '14px' : '16px'
                            }}
                          >
                            ₹{formatAmount(transaction.amount)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Description and actions row */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        width: '100%'
                      }}>
                        <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                          {transaction.description && (
                            <Typography 
                              variant="body2" 
                              color="text.secondary" 
                              sx={{ 
                                fontSize: isMobile ? '11px' : '12px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.2
                              }}
                            >
                              {transaction.description}
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseDayModal();
                                onEditTransaction(transaction);
                              }}
                              sx={{ 
                                bgcolor: 'primary.light',
                                color: 'white',
                                '&:hover': { bgcolor: 'primary.main' },
                                width: isMobile ? '28px' : '32px',
                                height: isMobile ? '28px' : '32px'
                              }}
                            >
                              <span style={{ fontSize: isMobile ? '12px' : '14px' }}>✏️</span>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseDayModal();
                                onDeleteTransaction(transaction);
                              }}
                              sx={{ 
                                bgcolor: 'error.light',
                                color: 'white',
                                '&:hover': { bgcolor: 'error.main' },
                                width: isMobile ? '28px' : '32px',
                                height: isMobile ? '28px' : '32px'
                              }}
                            >
                              <span style={{ fontSize: isMobile ? '12px' : '14px' }}>🗑️</span>
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                      {index < selectedDay.transactions.length - 1 && <Divider sx={{ mt: 1 }} />}
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 4,
                color: 'text.secondary'
              }}>
                <Typography variant="body1" sx={{ fontSize: isMobile ? '14px' : '16px' }}>
                  No transactions for this day
                </Typography>
              </Box>
            )}
          </div>
        </DialogContent>

        <DialogActions sx={{ 
          p: isMobile ? 1.5 : 2, 
          bgcolor: 'background.paper',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1 : 0
        }}>
          <Button 
            onClick={handleCloseDayModal} 
            color="inherit"
            sx={{ 
              textTransform: 'none',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 2 : 1
            }}
          >
            Close
          </Button>
          <Button 
            onClick={handleShare} 
            variant="contained" 
            startIcon={<ShareIcon />}
            sx={{ 
              textTransform: 'none',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 1 : 2
            }}
          >
            Copy Summary
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!error || !!success}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={error ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {error || success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExpenditureList;
