import { jsPDF } from 'jspdf';
import { format, startOfMonth, endOfMonth, getDay } from 'date-fns';

// Accepts transactions, reportDate (Date | 'YYYY-MM' | {year, month})
export const generateMonthlyReport = (transactions, selectedMonth) => {
  // --- Generic month/year parsing ---
  let baseDate;
  if (selectedMonth) {
    if (typeof selectedMonth === 'string' && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      // 'YYYY-MM' format
      const [year, month] = selectedMonth.split('-').map(Number);
      baseDate = new Date(year, month - 1, 1);
    } else if (typeof selectedMonth === 'object' && selectedMonth !== null && 'year' in selectedMonth && 'month' in selectedMonth) {
      // {year, month} format (month: 1-based)
      baseDate = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    } else if (selectedMonth instanceof Date) {
      // Use the provided Date object as is
      baseDate = selectedMonth;
    } else {
      // Fallback to current date if selectedMonth is not recognized
      baseDate = new Date();
    }
  } else {
    // If selectedMonth is falsy (or not provided), default to current date
    baseDate = new Date();
  }

  const doc = new jsPDF();
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);

  // Helper to format numbers safely (no currency, no non-breaking spaces)
  function formatNumber(num) {
    return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 }).replace(/\u00A0/g, ',');
  }

  // Prepare data
  const monthlyTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  // Group by day (ascending)
  const transactionsByDay = {};
  monthlyTransactions.forEach(t => {
    const dayKey = format(new Date(t.date), 'yyyy-MM-dd');
    if (!transactionsByDay[dayKey]) transactionsByDay[dayKey] = [];
    transactionsByDay[dayKey].push(t);
  });
  const sortedDays = Object.keys(transactionsByDay).sort();

  // Summary stats
  const totalIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Key Insights
  let highestExpenseDay = '';
  let highestExpense = 0;
  let mostFrequentCategory = '';
  let mostFrequentCount = 0;
  let daysWithNoTransactions = 0;
  let totalDailyExpense = 0;
  let daysWithExpense = 0;
  let largestTxn = null;
  const categoryCounts = {};
  sortedDays.forEach(date => {
    const expense = transactionsByDay[date].filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    if (expense > highestExpense) {
      highestExpense = expense;
      highestExpenseDay = date;
    }
    if (expense > 0) {
      totalDailyExpense += expense;
      daysWithExpense++;
    }
    if (transactionsByDay[date].length === 0) daysWithNoTransactions++;
    transactionsByDay[date].forEach(t => {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      if (!largestTxn || Number(t.amount) > Number(largestTxn.amount)) largestTxn = t;
    });
  });
  const avgDailyExpense = daysWithExpense > 0 ? totalDailyExpense / daysWithExpense : 0;
  let mostFrequentCat = '';
  let mostFrequentCatCount = 0;
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    if (count > mostFrequentCatCount) {
      mostFrequentCat = cat;
      mostFrequentCatCount = count;
    }
  });
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const expIncRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  // --- PDF Content: First Page (Colorful Professional) ---
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 0;

  // Header bar
  doc.setFillColor(66, 133, 244); // Google Blue
  doc.rect(0, 0, pageWidth, 32, 'F');
  y = 14;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Monthly Financial Report', pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${format(monthStart, 'MMMM yyyy')}`, pageWidth / 2, y, { align: 'center' });
  y += 14;

  // Summary Section with subtle background
  y += 4;
  doc.setFillColor(236, 245, 255); // very light blue
  doc.roundedRect(margin - 4, y, pageWidth - margin * 2 + 8, 44, 6, 6, 'F');
  y += 10;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(66, 133, 244);
  doc.text('Summary:', margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(44, 62, 80);
  const summaryData = [
    ['Total Income', formatNumber(totalIncome)],
    ['Total Expense', formatNumber(totalExpense)],
    ['Net Balance', formatNumber(balance)],
    ['Savings Rate', savingsRate.toFixed(1) + '%'],
    ['Expense/Income Ratio', expIncRatio.toFixed(1) + '%']
  ];
  summaryData.forEach(([label, value]) => {
    doc.text(label + ':', margin, y);
    doc.text(value, margin + 60, y, { align: 'right' });
    y += 7;
  });
  y += 6;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Key Insights Section with subtle background
  doc.setFillColor(245, 245, 250); // very light gray
  doc.roundedRect(margin - 4, y, pageWidth - margin * 2 + 8, 44, 6, 6, 'F');
  y += 10;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(155, 89, 182);
  doc.text('Key Insights:', margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(44, 62, 80);
  const insights = [];
  if (largestTxn) {
    insights.push(`Largest Transaction: ${formatNumber(largestTxn.amount)} (${largestTxn.category}${largestTxn.subcategory ? ' / ' + largestTxn.subcategory : ''}) on ${format(new Date(largestTxn.date), 'dd MMM')}`);
  }
  insights.push(`Highest Expense Day: ${highestExpenseDay ? format(new Date(highestExpenseDay), 'dd MMM yyyy') : '-'}`);
  insights.push(`Most Frequent Category: ${mostFrequentCat || '-'}`);
  insights.push(`Average Daily Expense: ${formatNumber(avgDailyExpense)}`);
  insights.forEach(line => {
    doc.text('- ' + line, margin, y);
    y += 7;
  });

  // --- Card View Pages (Daily Transaction Cards) ---
  if (sortedDays.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('Daily Transactions  ', 20, 20);
    let yCard = 30;
    const cardWidth = 175;
    const cardX = 18;
    const accentColors = [[66, 133, 244], [231, 76, 60], [46, 204, 113], [155, 89, 182], [241, 196, 15], [52, 152, 219], [149, 165, 166]];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    sortedDays.forEach((date, idx) => {
      const trans = transactionsByDay[date];
      const cardHeight = trans.length === 0 ? 54 : 44 + (trans.length * 22) + (trans.filter(t => t.description).length * 8);
      if (yCard + cardHeight > 280) {
        doc.addPage();
        yCard = 20;
      }
      // Minimal, professional outer card: light border, no shadow, 10px radius, white bg
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(1);
      doc.roundedRect(cardX, yCard, cardWidth, cardHeight, 10, 10, 'S'); // border only
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX, yCard, cardWidth, cardHeight, 10, 10, 'F'); // background
      // Accent bar (thin, flat, flush)
      const accent = accentColors[getDay(new Date(date)) % accentColors.length];
      doc.setFillColor(...accent);
      doc.rect(cardX, yCard, cardWidth, 3, 'F');
      // Header: Day of week, date
      doc.setFontSize(11);
      doc.setTextColor(44, 62, 80);
      doc.setFont('helvetica', 'bold');
      doc.text(`${dayNames[getDay(new Date(date))]}, ${format(new Date(date), 'dd MMM yyyy')}`, cardX + 10, yCard + 14);
      // Summary row: Income and Expense only
      const dayIncome = trans.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const dayExpense = trans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(46, 204, 113);
      doc.text('Income', cardX + 10, yCard + 26);
      doc.setFont('helvetica', 'bold');
      doc.text(formatNumber(dayIncome), cardX + 38, yCard + 26, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(231, 76, 60);
      doc.text('Expense', cardX + 60, yCard + 26);
      doc.setFont('helvetica', 'bold');
      doc.text(formatNumber(dayExpense), cardX + 100, yCard + 26, { align: 'right' });
      // Divider line
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.5);
      doc.line(cardX + 8, yCard + 30, cardX + cardWidth - 8, yCard + 30);
      // No transactions
      if (trans.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(127, 140, 141);
        doc.text('No transactions for this day.', cardX + cardWidth / 2, yCard + 46, { align: 'center' });
        yCard += cardHeight + 16;
        return;
      }
      // Transactions as minimal, clean pills
      let transY = yCard + 36;
      trans.forEach(t => {
        // Color dot by category
        const catIdx = accentColors.length > 0 ? (t.category ? t.category.charCodeAt(0) % accentColors.length : 0) : 0;
        const color = accentColors[catIdx];
        // Pill background (white/light gray)
        doc.setFillColor(248, 249, 251);
        doc.roundedRect(cardX + 10, transY, cardWidth - 20, 18, 9, 9, 'F');
        // Category dot
        doc.setFillColor(...color);
        doc.circle(cardX + 16, transY + 9, 2.5, 'F');
        // Category name (with subcategory if present)
        doc.setFontSize(9.5);
        doc.setTextColor(44, 62, 80);
        doc.setFont('helvetica', 'bold');
        let catText = t.category;
        if (t.subcategory) catText += ` / ${t.subcategory}`;
        doc.text(catText, cardX + 22, transY + 12);
        // Amount (right-aligned, bold, color-coded)
        doc.setFontSize(10);
        doc.setTextColor(t.type === 'income' ? 46 : 231, t.type === 'income' ? 204 : 76, t.type === 'income' ? 113 : 60);
        doc.setFont('helvetica', 'bold');
        doc.text(formatNumber(t.amount), cardX + cardWidth - 24, transY + 12, { align: 'right' });
        // Time (if available)
        let timeStr = '';
        if (t.date && t.date.length > 10) {
          const d = new Date(t.date);
          timeStr = format(d, 'HH:mm');
        }
        if (timeStr) {
          doc.setFontSize(7.5);
          doc.setTextColor(127, 140, 141);
          doc.setFont('helvetica', 'normal');
          doc.text(timeStr, cardX + cardWidth - 24, transY + 17, { align: 'right' });
        }
        // Description (smaller, gray, left-aligned, below if present)
        if (t.description) {
          let desc = t.description;
          if (desc.length > 40) desc = desc.slice(0, 37) + '...';
          doc.setFontSize(8);
          doc.setTextColor(127, 140, 141);
          doc.setFont('helvetica', 'normal');
          doc.text(desc, cardX + 22, transY + 17);
        }
        transY += 22;
      });
      yCard += cardHeight + 16;
    });
  }

  // --- Final Page: Auto-generated by Comman Man App ---
  doc.addPage();
  // Accent bar at top
  doc.setFillColor(66, 133, 244);
  doc.rect(0, 0, pageWidth, 10, 'F');
  // Centered message
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(66, 133, 244);
  doc.text('Auto-Generated Report', pageWidth / 2, 60, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(44, 62, 80);
  doc.text('by Comman Man App', pageWidth / 2, 75, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(44, 62, 80);
  doc.text('Developed by Revanth Venkat Pasupuleti', pageWidth / 2, 82, { align: 'center' });
  // Timestamp
  doc.setFontSize(11);
  doc.setTextColor(127, 140, 141);
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, HH:mm:ss')}`, pageWidth / 2, 90, { align: 'center' });
  // Subtle footer
  doc.setDrawColor(236, 245, 255);
  doc.setLineWidth(1.5);
  doc.line(pageWidth / 2 - 30, 110, pageWidth / 2 + 30, 110);

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