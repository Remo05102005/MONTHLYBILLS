import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';

const Insights = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const transactions = useSelector(state => state.transactions?.transactions || []);

  // Get current month's date range
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get all days in the current month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate daily cumulative balance
  const dailyData = useMemo(() => {
    let cumulativeBalance = 0;
    
    return daysInMonth.map(day => {
      // Get all transactions up to this day
      const dayTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return isWithinInterval(transactionDate, { 
          start: monthStart, 
          end: day 
        });
      });

      // Calculate income and expenses up to this day
      const income = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const expenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Update cumulative balance
      cumulativeBalance = income - expenses;

      return {
        date: format(day, 'MMM dd'),
        balance: cumulativeBalance,
        income,
        expenses
      };
    });
  }, [transactions, monthStart, daysInMonth]);

  // Calculate monthly statistics
  const monthlyStats = useMemo(() => {
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = income - expenses;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;

    return {
      income,
      expenses,
      balance,
      savingsRate,
      transactionCount: monthTransactions.length
    };
  }, [transactions, monthStart, monthEnd]);

  // Calculate category-wise expenses
  const categoryData = useMemo(() => {
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd }) && t.type === 'expense';
    });

    const categoryMap = {};
    monthTransactions.forEach(t => {
      if (!categoryMap[t.category]) {
        categoryMap[t.category] = 0;
      }
      categoryMap[t.category] += Number(t.amount);
    });

    return Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount
    }));
  }, [transactions, monthStart, monthEnd]);

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      <Typography variant="h4" gutterBottom>
        Financial Insights
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cumulative Balance Trend
              </Typography>
              <Box sx={{ height: 400, width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke={theme.palette.primary.main}
                      name="Cumulative Balance"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category-wise Expenses
              </Typography>
              <Box sx={{ height: 300, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    <Bar
                      dataKey="amount"
                      fill={theme.palette.secondary.main}
                      name="Amount"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Income
                  </Typography>
                  <Typography variant="h6" color="primary">
                    ₹{monthlyStats.income.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Expenses
                  </Typography>
                  <Typography variant="h6" color="error">
                    ₹{monthlyStats.expenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Balance
                  </Typography>
                  <Typography variant="h6" color={monthlyStats.balance >= 0 ? 'success.main' : 'error.main'}>
                    ₹{monthlyStats.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Savings Rate
                  </Typography>
                  <Typography variant="h6" color={monthlyStats.savingsRate >= 0 ? 'success.main' : 'error.main'}>
                    {monthlyStats.savingsRate.toFixed(1)}%
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Insights; 