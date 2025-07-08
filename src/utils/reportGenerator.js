import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, parseISO, isValid, isDate, eachDayOfInterval, getDay, getWeek, isWithinInterval } from 'date-fns';

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(num);
};

const formatInt = (num) => {
  return Math.round(Number(num)).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
};

export const generateMonthlyReport = (transactions, month) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);

  // --- First Page: Beautiful Cover ---
  doc.setFillColor(52, 73, 94);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(48);
  doc.text('COMMON MAN', pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Personal Finance Report', pageWidth / 2, pageHeight / 2 + 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });
  doc.addPage();

  // Header
  doc.setFontSize(24);
  doc.setTextColor(44, 62, 80);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANCIAL ANALYSIS REPORT', pageWidth / 2, 25, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(14);
  doc.setTextColor(127, 140, 141);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${format(month, 'MMMM yyyy')}`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, 42, { align: 'center' });
  doc.text('Professional Financial Analysis & Insights', pageWidth / 2, 49, { align: 'center' });
  
  // Filter transactions for the month
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthlyTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date >= monthStart && date <= monthEnd;
  });
  
  // Calculate comprehensive metrics
  const totalIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  
  // Detailed transaction analysis
  const incomeTransactions = monthlyTransactions.filter(t => t.type === 'income');
  const expenseTransactions = monthlyTransactions.filter(t => t.type === 'expense');
  const totalTransactions = monthlyTransactions.length;
  
  // Category-wise detailed analysis
  const categoryExpenses = {};
  const categoryIncome = {};
  const subcategoryExpenses = {};
  
  expenseTransactions.forEach(t => {
    const categoryKey = t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
    categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + Number(t.amount);
    subcategoryExpenses[categoryKey] = (subcategoryExpenses[categoryKey] || 0) + Number(t.amount);
  });
  
  incomeTransactions.forEach(t => {
    categoryIncome[t.category] = (categoryIncome[t.category] || 0) + Number(t.amount);
  });
  
  // Daily analysis
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const dailyExpenses = {};
  const dailyIncome = {};
  const dailyTransactions = {};
  
  daysInMonth.forEach(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    dailyExpenses[dayKey] = 0;
    dailyIncome[dayKey] = 0;
    dailyTransactions[dayKey] = [];
  });
  
  monthlyTransactions.forEach(t => {
    const dayKey = format(new Date(t.date), 'yyyy-MM-dd');
    if (dailyTransactions[dayKey]) {
      dailyTransactions[dayKey].push(t);
      if (t.type === 'income') {
        dailyIncome[dayKey] += Number(t.amount);
      } else {
        dailyExpenses[dayKey] += Number(t.amount);
      }
    }
  });
  
  // Weekly analysis
  const weeklyExpenses = {};
  const weeklyIncome = {};
  
  daysInMonth.forEach(day => {
    const weekKey = `Week ${Math.ceil(day.getDate() / 7)}`;
    const dayKey = format(day, 'yyyy-MM-dd');
    if (!weeklyExpenses[weekKey]) {
      weeklyExpenses[weekKey] = 0;
      weeklyIncome[weekKey] = 0;
    }
    weeklyExpenses[weekKey] += dailyExpenses[dayKey] || 0;
    weeklyIncome[weekKey] += dailyIncome[dayKey] || 0;
  });
  
  // Day of week analysis
  const dayOfWeekExpenses = [0, 0, 0, 0, 0, 0, 0]; // Sunday to Saturday
  const dayOfWeekIncome = [0, 0, 0, 0, 0, 0, 0];
  const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0];
  
  monthlyTransactions.forEach(t => {
    const day = new Date(t.date);
    const dayOfWeek = getDay(day);
    if (t.type === 'income') {
      dayOfWeekIncome[dayOfWeek] += Number(t.amount);
    } else {
      dayOfWeekExpenses[dayOfWeek] += Number(t.amount);
    }
    dayOfWeekCount[dayOfWeek]++;
  });
  
  // Transaction size analysis
  const expenseSizes = expenseTransactions.map(t => Number(t.amount)).sort((a, b) => a - b);
  const incomeSizes = incomeTransactions.map(t => Number(t.amount)).sort((a, b) => a - b);
  
  const avgExpense = expenseSizes.length > 0 ? expenseSizes.reduce((a, b) => a + b, 0) / expenseSizes.length : 0;
  const avgIncome = incomeSizes.length > 0 ? incomeSizes.reduce((a, b) => a + b, 0) / incomeSizes.length : 0;
  const medianExpense = expenseSizes.length > 0 ? expenseSizes[Math.floor(expenseSizes.length / 2)] : 0;
  const medianIncome = incomeSizes.length > 0 ? incomeSizes[Math.floor(incomeSizes.length / 2)] : 0;
  
  // Spending patterns
  const daysWithExpenses = Object.values(dailyExpenses).filter(exp => exp > 0).length;
  const daysWithIncome = Object.values(dailyIncome).filter(inc => inc > 0).length;
  const highestExpenseDay = Object.entries(dailyExpenses).reduce((max, [day, amount]) => amount > max.amount ? { day, amount } : max, { day: '', amount: 0 });
  const highestIncomeDay = Object.entries(dailyIncome).reduce((max, [day, amount]) => amount > max.amount ? { day, amount } : max, { day: '', amount: 0 });
  
  let currentY = 60;
  
  // Executive Summary Section
  currentY = addSectionTitle('EXECUTIVE SUMMARY', currentY);
  const avgExpenditure = totalExpense / daysInMonth.length;
  const summaryData = [
    ['Total Income', formatInt(totalIncome)],
    ['Total Expenses', formatInt(totalExpense)],
    ['Net Savings', formatInt(netSavings)],
    ['Average Expenditure', formatInt(avgExpenditure)],
    ['Savings Rate (%)', savingsRate.toFixed(1)],
    ['Total Transactions', totalTransactions.toString()],
    ['Income Transactions', incomeTransactions.length.toString()],
    ['Expense Transactions', expenseTransactions.length.toString()],
  ];
  
  doc.autoTable({
    startY: currentY,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: { 
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontSize: 12,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 11,
      cellPadding: 6
    },
    columnStyles: { 
      1: { halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: margin, right: margin }
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Detailed Financial Analysis Section
  currentY = addSectionTitle('DETAILED FINANCIAL ANALYSIS', currentY);
  
  // Category-wise expense breakdown
  const sortedCategories = Object.entries(categoryExpenses)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedCategories.length > 0) {
    const categoryData = sortedCategories.map(([category, amount]) => [
      category,
      formatInt(amount),
      `${((amount / totalExpense) * 100).toFixed(1)}`,
      expenseTransactions.filter(t => t.category === category).length.toString()
    ]);
    
    doc.autoTable({
      startY: currentY,
      head: [['Expense Category', 'Amount', 'Percent', 'Transactions']],
      body: categoryData,
      theme: 'grid',
      headStyles: { 
        fillColor: [52, 73, 94],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 10,
        cellPadding: 6
      },
      columnStyles: { 
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      margin: { left: margin, right: margin }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  }
  
  // Subcategory detailed breakdown
  const sortedSubcategories = Object.entries(subcategoryExpenses)
    .sort(([, a], [, b]) => b - a) // Ensure descending order
    .slice(0, 15); // Top 15 subcategories
  
  if (sortedSubcategories.length > 0) {
    const subcategoryData = sortedSubcategories.map(([subcategory, amount]) => [
      subcategory,
      formatInt(amount),
      `${((amount / totalExpense) * 100).toFixed(1)}`
    ]);
    
    doc.autoTable({
      startY: currentY,
      head: [['Detailed Subcategory', 'Amount', 'Percent']],
      body: subcategoryData,
      theme: 'grid',
      headStyles: { 
        fillColor: [231, 76, 60],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 6
      },
      columnStyles: { 
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      margin: { left: margin, right: margin }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  }
  
  // Income Analysis
  if (Object.keys(categoryIncome).length > 0) {
    const incomeData = Object.entries(categoryIncome).map(([category, amount]) => [
      category,
      formatInt(amount),
      `${((amount / totalIncome) * 100).toFixed(1)}`,
      incomeTransactions.filter(t => t.category === category).length.toString()
    ]);
    
    doc.autoTable({
      startY: currentY,
      head: [['Income Source', 'Amount', 'Percent', 'Transactions']],
      body: incomeData,
      theme: 'grid',
      headStyles: { 
        fillColor: [46, 204, 113],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 10,
        cellPadding: 6
      },
      columnStyles: { 
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      margin: { left: margin, right: margin }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  }
  
  // Daily Analysis Section
  currentY = addSectionTitle('DAILY SPENDING PATTERNS', currentY);
  
  const dailyStats = [
    ['Days with Expenses', daysWithExpenses.toString(), `${((daysWithExpenses / daysInMonth.length) * 100).toFixed(1)}`],
    ['Days with Income', daysWithIncome.toString(), `${((daysWithIncome / daysInMonth.length) * 100).toFixed(1)}`],
    ['Avg Daily Expense', formatInt(totalExpense / daysInMonth.length), 'Per day'],
    ['Avg Daily Income', formatInt(totalIncome / daysInMonth.length), 'Per day'],
    ['Highest Expense Day', highestExpenseDay.day ? format(new Date(highestExpenseDay.day), 'dd MMM') : 'None', formatInt(highestExpenseDay.amount)],
    ['Highest Income Day', highestIncomeDay.day ? format(new Date(highestIncomeDay.day), 'dd MMM') : 'None', formatInt(highestIncomeDay.amount)],
  ];
  
  doc.autoTable({
    startY: currentY,
    head: [['Metric', 'Value', 'Details']],
    body: dailyStats,
    theme: 'grid',
    headStyles: { 
      fillColor: [52, 152, 219],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 6
    },
    columnStyles: { 
      1: { halign: 'right' },
      2: { halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: margin, right: margin }
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Weekly Analysis
  currentY = addSectionTitle('WEEKLY TREND ANALYSIS', currentY);
  
  const weeklyData = Object.entries(weeklyExpenses).map(([week, expense]) => [
    week,
    formatInt(expense),
    formatInt(weeklyIncome[week] || 0),
    formatInt((weeklyIncome[week] || 0) - expense)
  ]);
  
  doc.autoTable({
    startY: currentY,
    head: [['Week', 'Expenses', 'Income', 'Net']],
    body: weeklyData,
    theme: 'grid',
    headStyles: { 
      fillColor: [155, 89, 182],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 6
    },
    columnStyles: { 
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: margin, right: margin }
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Day of Week Analysis
  currentY = addSectionTitle('DAY OF WEEK ANALYSIS', currentY);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekData = dayNames.map((day, index) => {
    const expense = dayOfWeekExpenses[index];
    const income = dayOfWeekIncome[index];
    const txCount = dayOfWeekCount[index];
    // Calculate number of expense transactions for this day
    const expenseTxCount = monthlyTransactions.filter(t => getDay(new Date(t.date)) === index && t.type === 'expense').length;
    const avgExpense = expenseTxCount > 0 ? expense / expenseTxCount : 0;
    return [
      day,
      formatInt(expense),
      formatInt(income),
      txCount.toString(),
      formatInt(avgExpense)
    ];
  });

  doc.autoTable({
    startY: currentY,
    head: [['Day', 'Expenses', 'Income', 'Transactions', 'Avg Expense']],
    body: dayOfWeekData,
    theme: 'grid',
    headStyles: { 
      fillColor: [230, 126, 34],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 8,
      halign: 'right',
      valign: 'middle',
    },
    columnStyles: { 
      0: { halign: 'left', cellPadding: 8 },
      1: { halign: 'right', cellPadding: 8 },
      2: { halign: 'right', cellPadding: 8 },
      3: { halign: 'center', cellPadding: 8 },
      4: { halign: 'right', cellPadding: 8 }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 15;
  
  // Transaction Size Analysis
  currentY = addSectionTitle('TRANSACTION SIZE ANALYSIS', currentY);
  
  const transactionStats = [
    ['Avg Expense', formatInt(avgExpense), 'Per transaction'],
    ['Median Expense', formatInt(medianExpense), 'Middle value'],
    ['Avg Income', formatInt(avgIncome), 'Per transaction'],
    ['Median Income', formatInt(medianIncome), 'Middle value'],
    ['Largest Expense', formatInt(Math.max(...expenseSizes)), 'Single transaction'],
    ['Largest Income', formatInt(Math.max(...incomeSizes)), 'Single transaction'],
    ['Smallest Expense', formatInt(Math.min(...expenseSizes)), 'Single transaction'],
    ['Smallest Income', formatInt(Math.min(...incomeSizes)), 'Single transaction'],
  ];
  
  doc.autoTable({
    startY: currentY,
    head: [['Metric', 'Amount', 'Description']],
    body: transactionStats,
    theme: 'grid',
    headStyles: { 
      fillColor: [149, 165, 166],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 6
    },
    columnStyles: { 
      1: { halign: 'right' },
      2: { halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: margin, right: margin }
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Key Insights Section
  currentY = addSectionTitle('KEY INSIGHTS & PATTERNS', currentY);
  
  // Calculate insights
  const avgDailyExpense = totalExpense / daysInMonth.length;
  const highestExpenseCategory = sortedCategories[0] || ['None', 0];
  const expenseTrend = netSavings >= 0 ? 'Positive' : 'Negative';
  const mostExpensiveDay = dayNames[dayOfWeekExpenses.indexOf(Math.max(...dayOfWeekExpenses))];
  const mostIncomeDay = dayNames[dayOfWeekIncome.indexOf(Math.max(...dayOfWeekIncome))];
  
  const insights = [
    `Average Daily Expense: ${formatInt(avgDailyExpense)}`,
    `Highest Expense Category: ${highestExpenseCategory[0]} (${formatInt(highestExpenseCategory[1])})`,
    `Financial Trend: ${expenseTrend} (${savingsRate >= 0 ? 'Savings' : 'Deficit'})`,
    `Transaction Frequency: ${(totalTransactions / daysInMonth.length).toFixed(1)} transactions per day`,
    `Most Expensive Day: ${mostExpensiveDay} (${formatInt(Math.max(...dayOfWeekExpenses))})`,
    `Most Income Day: ${mostIncomeDay} (${formatInt(Math.max(...dayOfWeekIncome))})`,
    `Expense Concentration: ${((highestExpenseCategory[1] / totalExpense) * 100).toFixed(1)}% in top category`,
    `Income Diversity: ${Object.keys(categoryIncome).length} different income sources`,
  ];
  
  insights.forEach((insight, index) => {
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`• ${insight}`, margin, currentY + (index * 6));
  });
  
  currentY += (insights.length * 6) + 15;
  
  // Recommendations Section
  currentY = addSectionTitle('DETAILED RECOMMENDATIONS', currentY);
  
  const recommendations = [];
  
  if (savingsRate < 20) {
    recommendations.push('• Consider increasing savings rate to at least 20% for better financial security');
  }
  
  if (savingsRate < 0) {
    recommendations.push('• Current spending exceeds income - immediate cost-cutting measures recommended');
  }
  
  if (avgDailyExpense > totalIncome / daysInMonth.length * 0.8) {
    recommendations.push('• Daily expenses are high relative to income - review discretionary spending');
  }
  
  if (highestExpenseCategory[1] > totalExpense * 0.4) {
    recommendations.push(`• ${highestExpenseCategory[0]} represents ${((highestExpenseCategory[1] / totalExpense) * 100).toFixed(1)}% of expenses - consider optimization`);
  }
  
  if (daysWithExpenses < daysInMonth.length * 0.5) {
    recommendations.push('• Low transaction frequency - consider tracking all expenses for better analysis');
  }
  
  if (Math.max(...dayOfWeekExpenses) > totalExpense * 0.2) {
    recommendations.push(`• High spending on ${mostExpensiveDay}s - review weekend spending patterns`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('• Excellent financial management! Continue maintaining current spending patterns');
    recommendations.push('• Consider increasing investments for long-term wealth building');
    recommendations.push('• Explore additional income sources to accelerate savings');
  }
  
  recommendations.forEach((rec, index) => {
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(rec, margin, currentY + (index * 6));
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(127, 140, 141);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  // --- Last Page: Thank You ---
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  // Accent line for elegance
  const accentY = pageHeight / 2 - 30;
  doc.setDrawColor(52, 73, 94);
  doc.setLineWidth(1.5);
  doc.line(pageWidth / 2 - 40, accentY, pageWidth / 2 + 40, accentY);
  // Thank You message
  const thankY = pageHeight / 2;
  doc.setTextColor(52, 73, 94);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.text('Thank You', pageWidth / 2, thankY, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(18);
  doc.text('- Revanthvenkat Pasupuleti', pageWidth / 2, thankY + 18, { align: 'center' });
  
  return doc;
};

function addSectionTitle(title, y) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  
  doc.setFontSize(14);
  doc.setTextColor(52, 73, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  
  // Add underline
  doc.setDrawColor(52, 73, 94);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  
  return y + 10;
}

export const generateInsights = (transactions) => {
  const doc = new jsPDF();
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const monthlyTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  const expenses = monthlyTransactions.filter(t => t.type === 'expense');
  const income = monthlyTransactions.filter(t => t.type === 'income');

  // Calculate category-wise expenses
  const categoryTotals = expenses.reduce((acc, t) => {
    const categoryKey = t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
    acc[categoryKey] = (acc[categoryKey] || 0) + Number(t.amount);
    return acc;
  }, {});

  const totalExpense = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Add title
  doc.setFontSize(20);
  doc.text('Comprehensive Financial Insights Report', 20, 20);
  doc.setFontSize(12);
  doc.text(`Period: ${format(monthStart, 'MMMM yyyy')}`, 20, 30);

  // Add expense distribution
  doc.setFontSize(16);
  doc.text('Detailed Expense Distribution', 20, 45);
  doc.setFontSize(12);

  let yPos = 55;
  Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, total]) => {
      const percentage = ((total / totalExpense) * 100).toFixed(1);
      doc.text(`${category}: ${total.toFixed(2)} (${percentage}%)`, 20, yPos);
      yPos += 10;
    });

  // Add income vs expense analysis
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Comprehensive Income vs Expense Analysis', 20, 20);
  doc.setFontSize(12);

  const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0);
  const savingsRate = ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1);

  doc.text(`Total Income: ${totalIncome.toFixed(2)}`, 20, 35);
  doc.text(`Total Expenses: ${totalExpense.toFixed(2)}`, 20, 45);
  doc.text(`Savings Rate: ${savingsRate}%`, 20, 55);

  return doc;
}; 