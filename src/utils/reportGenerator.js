import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';


const formatInt = (num) => {
  return Math.round(Number(num)).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
};

export const generateMonthlyReport = (transactions, month) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  // Parse month parameter - handle both string and Date
  let monthDate;
  if (typeof month === 'string') {
    // Try to parse the string as a date
    monthDate = new Date(month);
    if (isNaN(monthDate.getTime())) {
      // If parsing fails, use current month
      monthDate = new Date();
    }
  } else {
    monthDate = month;
  }

  // --- First Page: Professional Cover ---
  // Clean gradient background
  doc.setFillColor(15, 23, 42); // Deep navy blue
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Add subtle pattern overlay with better spacing
  doc.setFillColor(30, 41, 59); // Slightly lighter navy
  for (let i = 0; i < pageWidth; i += 25) {
    for (let j = 0; j < pageHeight; j += 25) {
      if ((i + j) % 50 === 0) {
        doc.rect(i, j, 2, 2, 'F');
      }
    }
  }
  
  // Main title with proper spacing
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.text('FINANCIAL', pageWidth / 2, 120, { align: 'center' });
  doc.setFontSize(32);
  doc.text('ANALYSIS', pageWidth / 2, 155, { align: 'center' });
  
  // Elegant divider line
  doc.setDrawColor(59, 130, 246); // Blue accent
  doc.setLineWidth(3);
  doc.line(pageWidth / 2 - 70, 175, pageWidth / 2 + 70, 175);
  
  // Subtitle with proper spacing
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Monthly Financial Report & Insights', pageWidth / 2, 200, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`Period: ${format(monthDate, 'MMMM yyyy')}`, pageWidth / 2, 220, { align: 'center' });
  
  // Generation info with proper spacing
  doc.setFontSize(11);
  doc.setTextColor(156, 163, 175); // Light gray
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, 250, { align: 'center' });
  doc.text('Professional Financial Analysis & Insights', pageWidth / 2, 265, { align: 'center' });
  
  // Clean design without branding
  
  doc.addPage();

  // Simple header with just period information
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${format(monthDate, 'MMMM yyyy')}`, 20, 20);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, pageWidth - 20, 20, { align: 'right' });
  
  // Filter transactions for the month
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
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
  const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0]; // Count of actual days (Mondays, Tuesdays, etc.)
  
  // Count actual days of each day of week in the month
  daysInMonth.forEach(day => {
    const dayOfWeek = getDay(day);
    dayOfWeekCount[dayOfWeek]++;
  });
  
  // Sum expenses and income by day of week
  monthlyTransactions.forEach(t => {
    const day = new Date(t.date);
    const dayOfWeek = getDay(day);
    if (t.type === 'income') {
      dayOfWeekIncome[dayOfWeek] += Number(t.amount);
    } else {
      dayOfWeekExpenses[dayOfWeek] += Number(t.amount);
    }
  });
  
  // Removed unused transaction size analysis variables
  
  // Spending patterns
  const daysWithExpenses = Object.values(dailyExpenses).filter(exp => exp > 0).length;
  const daysWithIncome = Object.values(dailyIncome).filter(inc => inc > 0).length;
  const highestExpenseDay = Object.entries(dailyExpenses).reduce((max, [day, amount]) => amount > max.amount ? { day, amount } : max, { day: '', amount: 0 });
  const highestIncomeDay = Object.entries(dailyIncome).reduce((max, [day, amount]) => amount > max.amount ? { day, amount } : max, { day: '', amount: 0 });
  
  let currentY = 30; // Simple header, start content earlier
  
  // Executive Summary Section
  currentY = addSectionTitle('EXECUTIVE SUMMARY', currentY);
  const avgExpenditure = totalExpense / daysInMonth.length;
  const summaryData = [
    ['Total Income', formatInt(totalIncome)],
    ['Total Expenses', formatInt(totalExpense)],
    ['Net Savings', formatInt(netSavings)],
    ['Average Expenditure', formatInt(avgExpenditure)],
    ['Savings Rate (%)', savingsRate.toFixed(1)],
  ];
  
  autoTable(doc, {
    startY: currentY,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: { 
      fillColor: [15, 23, 42], // Deep navy
      textColor: [255, 255, 255],
      fontSize: 12,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 11,
      cellPadding: 8,
      textColor: [15, 23, 42] // Deep navy text
    },
    columnStyles: { 
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold', textColor: [59, 130, 246] } // Blue for values
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Light gray
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240], // Light border
    tableLineWidth: 0.5
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Day-wise Transaction Details Table
  currentY = addSectionTitle('DAILY TRANSACTION DETAILS', currentY);
  
  // Prepare transaction data sorted by date
  const sortedTransactions = monthlyTransactions.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });
  
  // Group transactions by date
  const transactionsByDate = {};
  sortedTransactions.forEach(transaction => {
    const dateStr = transaction.date;
    if (!transactionsByDate[dateStr]) {
      transactionsByDate[dateStr] = [];
    }
    transactionsByDate[dateStr].push(transaction);
  });
  
  // Create table data with rowspan for dates and days
  const tableData = [];
  // Removed unused dayShortNames variable
  
  Object.entries(transactionsByDate).forEach(([dateStr, transactions]) => {
    const date = new Date(dateStr);
    // Removed unused dayName variable
    const formattedDate = format(date, 'dd MMM yyyy');
    
    transactions.forEach((transaction, index) => {
      const category = transaction.subCategory ? `${transaction.category} - ${transaction.subCategory}` : transaction.category;
      const amount = formatInt(transaction.amount);
      const type = transaction.type;
      
      if (index === 0) {
        // First transaction of the day - include date with rowspan
        tableData.push([
          { content: formattedDate, rowSpan: transactions.length },
          category,
          transaction.description || '',
          { content: amount, styles: { textColor: type === 'income' ? [46, 204, 113] : [0, 0, 0] } }
        ]);
      } else {
        // Subsequent transactions of the same day - no date column
        tableData.push([
          category,
          transaction.description || '',
          { content: amount, styles: { textColor: type === 'income' ? [46, 204, 113] : [0, 0, 0] } }
        ]);
      }
    });
  });
  
  // Add table using grid theme for automatic width fitting
  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Category', 'Description', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [15, 23, 42], // Deep navy
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 8,
      cellPadding: 6,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [15, 23, 42] // Deep navy text
    },
    columnStyles: { 
      0: { halign: 'center', textColor: [15, 23, 42], fontStyle: 'bold' },
      1: { halign: 'left', textColor: [15, 23, 42] },
      2: { halign: 'left', textColor: [71, 85, 105] }, // Medium gray for descriptions
      3: { halign: 'right', textColor: [15, 23, 42], fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Light gray
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240], // Light border
    tableLineWidth: 0.5,
    didParseCell: function(data) {
      // Handle rowspan for date column
      if (data.column.index === 0) {
        if (data.cell.raw && data.cell.raw.rowSpan) {
          data.cell.rowSpan = data.cell.raw.rowSpan;
        }
      }
      // Handle text color for amount column
      if (data.column.index === 3 && data.cell.raw && data.cell.raw.styles) {
        data.cell.styles.textColor = data.cell.raw.styles.textColor;
      }
    }
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Add page break if needed to prevent cutting
  if (currentY > 250) {
    doc.addPage();
    currentY = 30; // Starting position for new pages
  }
  
  // Removed pie chart section
  
  // Income Analysis
  if (Object.keys(categoryIncome).length > 0) {
    const incomeData = Object.entries(categoryIncome).map(([category, amount]) => [
      category,
      formatInt(amount),
      `${((amount / totalIncome) * 100).toFixed(1)}`,
      incomeTransactions.filter(t => t.category === category).length.toString()
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Income Source', 'Amount', 'Percent', 'Transactions']],
      body: incomeData,
      theme: 'grid',
      headStyles: { 
        fillColor: [34, 197, 94], // Professional green
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 10,
        cellPadding: 8,
        textColor: [15, 23, 42] // Deep navy text
      },
      columnStyles: { 
        0: { halign: 'left', textColor: [15, 23, 42], fontStyle: 'bold' },
        1: { halign: 'right', textColor: [34, 197, 94], fontStyle: 'bold' }, // Green for amounts
        2: { halign: 'right', textColor: [15, 23, 42] },
        3: { halign: 'center', textColor: [15, 23, 42] }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Light gray
      },
      margin: { left: margin, right: margin },
      tableLineColor: [226, 232, 240], // Light border
      tableLineWidth: 0.5
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
  
  autoTable(doc, {
    startY: currentY,
    head: [['Metric', 'Value', 'Details']],
    body: dailyStats,
    theme: 'grid',
    headStyles: { 
      fillColor: [59, 130, 246], // Professional blue
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 8,
      textColor: [15, 23, 42] // Deep navy text
    },
    columnStyles: { 
      0: { halign: 'left', textColor: [15, 23, 42], fontStyle: 'bold' },
      1: { halign: 'right', textColor: [59, 130, 246], fontStyle: 'bold' }, // Blue for values
      2: { halign: 'center', textColor: [71, 85, 105] } // Medium gray for details
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Light gray
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240], // Light border
    tableLineWidth: 0.5
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
  
  autoTable(doc, {
    startY: currentY,
    head: [['Week', 'Expenses', 'Income', 'Net']],
    body: weeklyData,
    theme: 'grid',
    headStyles: { 
      fillColor: [168, 85, 247], // Professional purple
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 8,
      textColor: [15, 23, 42] // Deep navy text
    },
    columnStyles: { 
      0: { halign: 'left', textColor: [15, 23, 42], fontStyle: 'bold' },
      1: { halign: 'right', textColor: [239, 68, 68], fontStyle: 'bold' }, // Red for expenses
      2: { halign: 'right', textColor: [34, 197, 94], fontStyle: 'bold' }, // Green for income
      3: { halign: 'right', textColor: [59, 130, 246], fontStyle: 'bold' } // Blue for net
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Light gray
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240], // Light border
    tableLineWidth: 0.5
  });
  
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Day of Week Analysis
  currentY = addSectionTitle('DAY OF WEEK ANALYSIS', currentY);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekData = dayNames.map((day, index) => {
    const expense = dayOfWeekExpenses[index];
    const income = dayOfWeekIncome[index];
    const dayCount = dayOfWeekCount[index]; // Number of actual days (Mondays, Tuesdays, etc.)
    // Calculate average expense per day occurrence (not per transaction)
    const avgExpense = dayCount > 0 ? expense / dayCount : 0;
    const avgIncome = dayCount > 0 ? income / dayCount : 0;
    return [
      day,
      formatInt(expense),
      formatInt(income),
      dayCount.toString(),
      formatInt(avgExpense),
      formatInt(avgIncome)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Day', 'Expenses', 'Income', 'Days', 'Avg Expense', 'Avg Income']],
    body: dayOfWeekData,
    theme: 'grid',
    headStyles: { 
      fillColor: [249, 115, 22], // Professional orange
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 8,
      halign: 'right',
      valign: 'middle',
      textColor: [15, 23, 42] // Deep navy text
    },
    columnStyles: { 
      0: { halign: 'left', cellPadding: 8, textColor: [15, 23, 42], fontStyle: 'bold' },
      1: { halign: 'right', cellPadding: 8, textColor: [239, 68, 68], fontStyle: 'bold' }, // Red for expenses
      2: { halign: 'right', cellPadding: 8, textColor: [34, 197, 94], fontStyle: 'bold' }, // Green for income
      3: { halign: 'center', cellPadding: 8, textColor: [15, 23, 42] },
      4: { halign: 'right', cellPadding: 8, textColor: [59, 130, 246], fontStyle: 'bold' }, // Blue for avg expense
      5: { halign: 'right', cellPadding: 8, textColor: [34, 197, 94], fontStyle: 'bold' } // Green for avg income
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Light gray
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240], // Light border
    tableLineWidth: 0.5
  });

  // Clean, minimal footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Simple footer line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, doc.internal.pageSize.height - 15, pageWidth - 20, doc.internal.pageSize.height - 15);
    
    // Page number
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 5, { align: 'center' });
  }
  
  // --- Last Page: Classic Report Conclusion ---
  doc.addPage();
  
  // Classic navy background matching the first page
  doc.setFillColor(15, 23, 42); // Deep navy blue
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Add subtle pattern overlay matching first page
  doc.setFillColor(30, 41, 59); // Slightly lighter navy
  for (let i = 0; i < pageWidth; i += 25) {
    for (let j = 0; j < pageHeight; j += 25) {
      if ((i + j) % 50 === 0) {
        doc.rect(i, j, 2, 2, 'F');
      }
    }
  }
  
  // Main conclusion message with classic styling
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.text('REPORT', pageWidth / 2, 120, { align: 'center' });
  doc.setFontSize(32);
  doc.text('CONCLUSION', pageWidth / 2, 155, { align: 'center' });
  
  // Elegant divider line matching first page
  doc.setDrawColor(59, 130, 246); // Blue accent
  doc.setLineWidth(3);
  doc.line(pageWidth / 2 - 70, 175, pageWidth / 2 + 70, 175);
  
  // Professional conclusion text
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for choosing our financial analysis services', pageWidth / 2, 200, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`Period: ${format(monthDate, 'MMMM yyyy')}`, pageWidth / 2, 220, { align: 'center' });
  
  // Author signature with classic styling
  doc.setFontSize(16);
  doc.setFont('helvetica', 'italic');
  doc.text('- Revanthvenkat Pasupuleti', pageWidth / 2, 250, { align: 'center' });
  
  // Generation info with subtle styling
  doc.setFontSize(11);
  doc.setTextColor(156, 163, 175); // Light gray
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, 280, { align: 'center' });
  doc.text('Professional Financial Analysis & Insights', pageWidth / 2, 295, { align: 'center' });
  
  // Clean design without branding
  
  // Contact information in footer style
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(10);
  doc.text('prvenkat113@gmail.com', pageWidth / 2, pageHeight - 23, { align: 'center' });
  
  return doc;
};

function addSectionTitle(title, y) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  
  // Ensure we don't go too close to the top
  if (y < 30) {
    y = 30;
  }
  
  // Classic section title styling
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Deep navy
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  
  // Classic double underline
  doc.setDrawColor(15, 23, 42); // Navy color
  doc.setLineWidth(1);
  doc.line(margin, y + 2, margin + 120, y + 2);
  doc.setDrawColor(59, 130, 246); // Blue accent
  doc.setLineWidth(2);
  doc.line(margin, y + 4, margin + 120, y + 4);
  
  // Classic background highlight
  doc.setFillColor(248, 250, 252); // Light gray
  doc.rect(margin - 8, y - 10, pageWidth - 2 * margin + 16, 18, 'F');
  
  // Re-draw the title and lines on top
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1);
  doc.line(margin, y + 2, margin + 120, y + 2);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(2);
  doc.line(margin, y + 4, margin + 120, y + 4);
  
  return y + 22; // Increased spacing for classic look
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

  return doc;
}; 