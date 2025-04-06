import { jsPDF } from 'jspdf';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export const generateMonthlyReport = (transactions) => {
  const doc = new jsPDF();
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const monthlyTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  const expenses = monthlyTransactions.filter(t => t.isExpense);
  const income = monthlyTransactions.filter(t => !t.isExpense);

  const totalIncome = income.reduce((sum, t) => sum + t.price, 0);
  const totalExpense = expenses.reduce((sum, t) => sum + t.price, 0);
  const balance = totalIncome - totalExpense;

  // Add title
  doc.setFontSize(20);
  doc.text('Monthly Financial Report', 20, 20);
  doc.setFontSize(12);
  doc.text(`Period: ${format(monthStart, 'MMMM yyyy')}`, 20, 30);

  // Add summary
  doc.setFontSize(16);
  doc.text('Summary', 20, 45);
  doc.setFontSize(12);
  doc.text(`Total Income: ₹${totalIncome.toFixed(2)}`, 20, 55);
  doc.text(`Total Expenses: ₹${totalExpense.toFixed(2)}`, 20, 65);
  doc.text(`Net Balance: ₹${balance.toFixed(2)}`, 20, 75);

  // Add expense breakdown
  doc.setFontSize(16);
  doc.text('Expense Breakdown', 20, 95);
  doc.setFontSize(12);

  const categoryTotals = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.price;
    return acc;
  }, {});

  let yPos = 105;
  Object.entries(categoryTotals).forEach(([category, total]) => {
    doc.text(`${category}: ₹${total.toFixed(2)}`, 20, yPos);
    yPos += 10;
  });

  // Add transaction list
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Transaction List', 20, 20);
  doc.setFontSize(12);

  yPos = 30;
  monthlyTransactions.forEach(t => {
    const text = `${format(new Date(t.date), 'dd/MM/yyyy')} - ${t.category} - ${t.isExpense ? '-' : '+'}₹${t.price.toFixed(2)}`;
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(text, 20, yPos);
    yPos += 10;
  });

  return doc;
};

export const generateInsights = (transactions) => {
  const doc = new jsPDF();
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const monthlyTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  const expenses = monthlyTransactions.filter(t => t.isExpense);
  const income = monthlyTransactions.filter(t => !t.isExpense);

  // Calculate category-wise expenses
  const categoryTotals = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.price;
    return acc;
  }, {});

  const totalExpense = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Add title
  doc.setFontSize(20);
  doc.text('Financial Insights', 20, 20);
  doc.setFontSize(12);
  doc.text(`Period: ${format(monthStart, 'MMMM yyyy')}`, 20, 30);

  // Add expense distribution
  doc.setFontSize(16);
  doc.text('Expense Distribution', 20, 45);
  doc.setFontSize(12);

  let yPos = 55;
  Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, total]) => {
      const percentage = ((total / totalExpense) * 100).toFixed(1);
      doc.text(`${category}: ₹${total.toFixed(2)} (${percentage}%)`, 20, yPos);
      yPos += 10;
    });

  // Add income vs expense analysis
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Income vs Expense Analysis', 20, 20);
  doc.setFontSize(12);

  const totalIncome = income.reduce((sum, t) => sum + t.price, 0);
  const savingsRate = ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1);

  doc.text(`Total Income: ₹${totalIncome.toFixed(2)}`, 20, 35);
  doc.text(`Total Expenses: ₹${totalExpense.toFixed(2)}`, 20, 45);
  doc.text(`Savings Rate: ${savingsRate}%`, 20, 55);

  // Add daily expense trend
  const dailyExpenses = expenses.reduce((acc, t) => {
    const date = format(new Date(t.date), 'dd/MM');
    acc[date] = (acc[date] || 0) + t.price;
    return acc;
  }, {});

  doc.text('Daily Expense Trend', 20, 75);
  yPos = 85;
  Object.entries(dailyExpenses)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .forEach(([date, amount]) => {
      doc.text(`${date}: ₹${amount.toFixed(2)}`, 20, yPos);
      yPos += 10;
    });

  return doc;
}; 