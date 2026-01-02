import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  format,
  parseISO,
  isValid,
  isDate,
  getDay
} from 'date-fns';

export const generatePDF = (data, type = 'monthly') => {
  try {
    // Create PDF with A4 size
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Helper function to safely format dates
    const safeFormatDate = (dateString) => {
      try {
        // Check if dateString is already a Date object
        if (isDate(dateString)) {
          return format(dateString, 'MMM dd, yyyy');
        }
        
        // Try to parse the date string
        const parsedDate = parseISO(dateString);
        if (isValid(parsedDate)) {
          return format(parsedDate, 'MMM dd, yyyy');
        }
        
        // If parsing fails, try to create a new Date
        const newDate = new Date(dateString);
        if (isValid(newDate)) {
          return format(newDate, 'MMM dd, yyyy');
        }
        
        // If all else fails, return the original string
        return dateString;
      } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
      }
    };
    
    // Helper function to add a section title
    const addSectionTitle = (title, y) => {
      doc.setFillColor(66, 139, 202);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, margin + 5, y + 5.5);
      doc.setTextColor(0, 0, 0);
      return y + 15;
    };
    
    // Helper function to add a divider line
    const addDivider = (y) => {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      return y + 5;
    };
    
    // Helper function to add a simple bar chart
    const addBarChart = (data, labels, title, y, width, height, colors) => {
      // Add title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 7;
      
      // Calculate bar width and spacing
      const barCount = data.length;
      const barWidth = width / barCount * 0.8;
      const spacing = width / barCount * 0.2;
      
      // Find max value for scaling
      const maxValue = Math.max(...data);
      
      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const barHeight = (data[i] / maxValue) * height;
        const x = margin + (i * (barWidth + spacing));
        
        // Draw bar
        doc.setFillColor(colors[i % colors.length][0], colors[i % colors.length][1], colors[i % colors.length][2]);
        doc.rect(x, y + height - barHeight, barWidth, barHeight, 'F');
        
        // Draw label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(labels[i], x + barWidth / 2, y + height + 5, { align: 'center' });
        
        // Draw value
        doc.text(data[i].toString(), x + barWidth / 2, y + height - barHeight - 3, { align: 'center' });
      }
      
      return y + height + 15;
    };
    
    // Helper function to add a simple pie chart
    const addPieChart = (data, labels, title, y, radius, colors) => {
      // Add title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 7;
      
      // Calculate total
      const total = data.reduce((sum, value) => sum + value, 0);
      
      // Instead of trying to draw a pie chart, just create a legend with percentages
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Distribution:', margin, y);
      y += 10;
      
      const legendItemHeight = 8;
      const itemsPerRow = 2;
      const legendItemWidth = contentWidth / itemsPerRow;
      
      for (let i = 0; i < data.length; i++) {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        const x = margin + col * legendItemWidth;
        const itemY = y + row * legendItemHeight;
        
        // Draw color box
        doc.setFillColor(colors[i % colors.length][0], colors[i % colors.length][1], colors[i % colors.length][2]);
        doc.rect(x, itemY, 5, 5, 'F');
        
        // Draw label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${labels[i]}: ${((data[i] / total) * 100).toFixed(1)}%`, x + 10, itemY + 4);
      }
      
      // Calculate how many rows we need
      const rows = Math.ceil(data.length / itemsPerRow);
      y += rows * legendItemHeight + 10;
      
      return y;
    };
    
    // Helper function to add a simple line chart
    const addLineChart = (data, labels, title, y, width, height, color) => {
      // Add title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 7;
      
      // Create table data
      const tableData = data.map((value, index) => [
        labels[index],
        `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
      ]);
      
      // Add table
      autoTable(doc, {
        startY: y,
        head: [['Period', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: color,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: { 
          fontSize: 8,
          cellPadding: 4
        },
        columnStyles: { 
          1: { halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: margin, right: margin }
      });
      
      return doc.lastAutoTable.finalY + 10;
    };
    
    // Add header with logo and title
    doc.setFillColor(52, 73, 94);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('PROFESSIONAL FINANCIAL REPORT', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Certified Financial Analysis & Insights', pageWidth / 2, 25, { align: 'center' });
    
    // Add report title and date
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    const title = type === 'monthly' ? 'Monthly Financial Analysis Report' : 'Financial Insights & Recommendations';
    doc.text(title, pageWidth / 2, 55, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, 65, { align: 'center' });
    
    // Add period information
    let currentY = 75;
    let periodStr = '';
    if (data.statistics?.period) {
      if (typeof data.statistics.period === 'string') {
        periodStr = data.statistics.period.charAt(0).toUpperCase() + data.statistics.period.slice(1);
      } else if (isDate(data.statistics.period)) {
        periodStr = format(data.statistics.period, 'MMMM yyyy');
      } else {
        try {
          periodStr = format(new Date(data.statistics.period), 'MMMM yyyy');
        } catch {
          periodStr = String(data.statistics.period);
        }
      }
      doc.text(`Period: ${periodStr}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
    }
    
    // Add summary section with colored boxes
    currentY = addSectionTitle('Financial Summary', currentY);
    
    // Create summary boxes
    const boxWidth = (contentWidth - 10) / 2;
    const boxHeight = 30;
    
    // Income box
    doc.setFillColor(46, 204, 113);
    doc.rect(margin, currentY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Income', margin + 5, currentY + 8);
    doc.setFontSize(14);
    doc.text(`${(data.statistics?.income || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + 5, currentY + 20);
    
    // Expenses box
    doc.setFillColor(231, 76, 60);
    doc.rect(margin + boxWidth + 10, currentY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Expenses', margin + boxWidth + 15, currentY + 8);
    doc.setFontSize(14);
    doc.text(`${(data.statistics?.expenses || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + boxWidth + 15, currentY + 20);
    
    currentY += boxHeight + 10;
    
    // Balance box
    doc.setFillColor(52, 152, 219);
    doc.rect(margin, currentY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Net Balance', margin + 5, currentY + 8);
    doc.setFontSize(14);
    doc.text(`${(data.statistics?.savings || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + 5, currentY + 20);
    
    // Savings Rate box
    doc.setFillColor(155, 89, 182);
    doc.rect(margin + boxWidth + 10, currentY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Savings Rate', margin + boxWidth + 15, currentY + 8);
    doc.setFontSize(14);
    doc.text(`${(data.statistics?.savingsRate || 0).toFixed(1)}%`, margin + boxWidth + 15, currentY + 20);
    
    currentY += boxHeight + 15;
    currentY = addDivider(currentY);
    
    // Add daily statistics section
    currentY = addSectionTitle('Daily Expenditure Statistics', currentY);
    
    // Create daily stats boxes
    const smallBoxWidth = (contentWidth - 15) / 3;
    const smallBoxHeight = 25;
    
    // Min Daily Expense
    doc.setFillColor(241, 196, 15);
    doc.rect(margin, currentY, smallBoxWidth, smallBoxHeight, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Min Daily Expense', margin + 5, currentY + 8);
    doc.setFontSize(12);
    doc.text(`${(data.statistics?.minDailyExpense || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + 5, currentY + 18);
    
    // Max Daily Expense
    doc.setFillColor(230, 126, 34);
    doc.rect(margin + smallBoxWidth + 5, currentY, smallBoxWidth, smallBoxHeight, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Max Daily Expense', margin + smallBoxWidth + 10, currentY + 8);
    doc.setFontSize(12);
    doc.text(`${(data.statistics?.maxDailyExpense || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + smallBoxWidth + 10, currentY + 18);
    
    // Avg Daily Expense (CORRECTED CALCULATION)
    // Calculate total expenses and divide by total days in the period
    const totalExpenses = data.statistics?.expenses || 0;
    const totalDays = data.statistics?.totalDays || 30; // Default to 30 if not provided
    const correctedAvgDailyExpense = totalDays > 0 ? totalExpenses / totalDays : 0;
    
    doc.setFillColor(149, 165, 166);
    doc.rect(margin + (smallBoxWidth + 5) * 2, currentY, smallBoxWidth, smallBoxHeight, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Avg Daily Expense', margin + (smallBoxWidth + 5) * 2 + 5, currentY + 8);
    doc.setFontSize(12);
    doc.text(`${correctedAvgDailyExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + (smallBoxWidth + 5) * 2 + 5, currentY + 18);
    
    currentY += smallBoxHeight + 10;
    
    // Days with transactions
    doc.setFillColor(189, 195, 199);
    doc.rect(margin, currentY, contentWidth, 20, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Days with Transactions: ${data.statistics?.daysWithTransactions || 0} out of ${data.statistics?.totalDays || 0}`, margin + 5, currentY + 13);
    
    currentY += 25;
    currentY = addDivider(currentY);
    
    // For insights report, add detailed analysis
    if (type === 'insights' && data.transactions?.length > 0) {
      // Calculate category-wise expenses
      const categoryExpenses = {};
      data.transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          const category = transaction.subCategory ? `${transaction.category} - ${transaction.subCategory}` : (transaction.category || 'Uncategorized');
          categoryExpenses[category] = (categoryExpenses[category] || 0) + Number(transaction.amount);
        }
      });
      
      // Convert to array for table
      const categoryData = Object.entries(categoryExpenses)
        .map(([category, amount]) => [
          category,
          `${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          `${((amount / (data.statistics?.expenses || 1)) * 100).toFixed(1)}%`
        ])
        .sort((a, b) => parseFloat(b[1].replace(/[^0-9.-]+/g, '')) - parseFloat(a[1].replace(/[^0-9.-]+/g, '')));
      
      if (categoryData.length > 0) {
        // Add category-wise expenses section
        currentY = addSectionTitle('Category-wise Expenses', currentY);
        
        // Add pie chart for category expenses
        const pieData = categoryData.map(item => parseFloat(item[1].replace(/[^0-9.-]+/g, '')));
        const pieLabels = categoryData.map(item => item[0]);
        const pieColors = [
          [46, 204, 113], [231, 76, 60], [52, 152, 219], [155, 89, 182], 
          [241, 196, 15], [230, 126, 34], [149, 165, 166], [189, 195, 199]
        ];
        
        currentY = addPieChart(pieData, pieLabels, 'Expense Distribution by Category', currentY, 40, pieColors);
        
        // Add table
        autoTable(doc, {
          startY: currentY,
          head: [['Category', 'Amount', 'Percentage']],
          body: categoryData,
          theme: 'grid',
          headStyles: { 
            fillColor: [66, 139, 202],
            textColor: [255, 255, 255],
            fontSize: 12,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 10,
            cellPadding: 5
          },
          columnStyles: { 
            1: { halign: 'right' },
            2: { halign: 'right' }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { left: margin, right: margin }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
        currentY = addDivider(currentY);
      }
      
      // Add day of week analysis
      currentY = addSectionTitle('Day of Week Analysis', currentY);
      
      // Group transactions by day of week and count occurrences
      const dayOfWeekTotals = [0, 0, 0, 0, 0, 0, 0]; // 0 = Sunday, 6 = Saturday
      const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Count of days for each day of week
      const dayOfWeekLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // First, get all unique dates to count occurrences of each day of week
      const uniqueDates = new Set();
      data.transactions.forEach(transaction => {
        try {
          const dateStr = transaction.date;
          if (!dateStr) return;
          
          let dateObj;
          if (isDate(dateStr)) {
            dateObj = dateStr;
          } else {
            try {
              dateObj = parseISO(dateStr);
              if (!isValid(dateObj)) {
                dateObj = new Date(dateStr);
              }
            } catch (e) {
              dateObj = new Date(dateStr);
            }
          }
          
          if (!isValid(dateObj)) return;
          
          const date = format(dateObj, 'yyyy-MM-dd');
          uniqueDates.add(date);
        } catch (error) {
          console.error('Error processing transaction date:', error);
        }
      });
      
      // Count occurrences of each day of week
      uniqueDates.forEach(dateStr => {
        try {
          const dateObj = parseISO(dateStr);
          if (isValid(dateObj)) {
            const dayOfWeek = getDay(dateObj);
            dayOfWeekCounts[dayOfWeek]++;
          }
        } catch (error) {
          console.error('Error processing date for day count:', error);
        }
      });
      
      // Sum expenses by day of week
      data.transactions.forEach(transaction => {
        try {
          const dateStr = transaction.date;
          if (!dateStr) return;
          
          let dateObj;
          if (isDate(dateStr)) {
            dateObj = dateStr;
          } else {
            try {
              dateObj = parseISO(dateStr);
              if (!isValid(dateObj)) {
                dateObj = new Date(dateStr);
              }
            } catch (e) {
              dateObj = new Date(dateStr);
            }
          }
          
          if (!isValid(dateObj)) return;
          
          const dayOfWeek = getDay(dateObj);
          if (transaction.type === 'expense') {
            dayOfWeekTotals[dayOfWeek] += Number(transaction.amount) || 0;
          }
        } catch (error) {
          console.error('Error processing transaction date:', error);
        }
      });
      
      // Calculate averages (total expenses / number of days of that type)
      const dayOfWeekData = dayOfWeekTotals.map((total, index) => 
        dayOfWeekCounts[index] > 0 ? total / dayOfWeekCounts[index] : 0
      );
      
      // Add bar chart for day of week expenses
      const dayColors = [
        [231, 76, 60], [46, 204, 113], [52, 152, 219], 
        [155, 89, 182], [241, 196, 15], [230, 126, 34], [149, 165, 166]
      ];
      
      currentY = addBarChart(dayOfWeekData, dayOfWeekLabels, 'Average Daily Expenses by Day of Week', currentY, contentWidth, 60, dayColors);
      
      // Add monthly trend analysis
      currentY = addSectionTitle('Monthly Trend Analysis', currentY);
      
      // Group transactions by month
      const monthlyData = {};
      data.transactions.forEach(transaction => {
        try {
          const dateStr = transaction.date;
          if (!dateStr) return;
          
          let dateObj;
          if (isDate(dateStr)) {
            dateObj = dateStr;
          } else {
            try {
              dateObj = parseISO(dateStr);
              if (!isValid(dateObj)) {
                dateObj = new Date(dateStr);
              }
            } catch (e) {
              dateObj = new Date(dateStr);
            }
          }
          
          if (!isValid(dateObj)) return;
          
          const monthKey = format(dateObj, 'yyyy-MM');
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { income: 0, expense: 0 };
          }
          
          if (transaction.type === 'income') {
            monthlyData[monthKey].income += Number(transaction.amount) || 0;
          } else {
            monthlyData[monthKey].expense += Number(transaction.amount) || 0;
          }
        } catch (error) {
          console.error('Error processing transaction date:', error);
        }
      });
      
      // Convert to arrays for charts
      const monthKeys = Object.keys(monthlyData).sort();
      const monthlyIncome = monthKeys.map(key => monthlyData[key].income);
      const monthlyExpense = monthKeys.map(key => monthlyData[key].expense);
      const monthlyBalance = monthKeys.map(key => monthlyData[key].income - monthlyData[key].expense);
      const monthLabels = monthKeys.map(key => format(parseISO(key + '-01'), 'MMM yyyy'));
      
      // Add line chart for monthly trends
      currentY = addLineChart(monthlyIncome, monthLabels, 'Monthly Income Trend', currentY, contentWidth, 60, [46, 204, 113]);
      currentY = addLineChart(monthlyExpense, monthLabels, 'Monthly Expense Trend', currentY, contentWidth, 60, [231, 76, 60]);
      currentY = addLineChart(monthlyBalance, monthLabels, 'Monthly Balance Trend', currentY, contentWidth, 60, [52, 152, 219]);
      
      
      // Add transaction frequency analysis
      currentY = addSectionTitle('Transaction Frequency Analysis', currentY);
      
      // Count transactions by type
      const transactionCounts = {
        income: 0,
        expense: 0
      };
      
      data.transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          transactionCounts.income++;
        } else {
          transactionCounts.expense++;
        }
      });
      
      // Add pie chart for transaction types
      const typeData = [transactionCounts.income, transactionCounts.expense];
      const typeLabels = ['Income', 'Expense'];
      const typeColors = [[46, 204, 113], [231, 76, 60]];
      
      currentY = addPieChart(typeData, typeLabels, 'Transaction Type Distribution', currentY, 40, typeColors);
      
      // Add transaction size analysis
      currentY = addSectionTitle('Transaction Size Analysis', currentY);
      
      // Group transactions by size ranges
      const sizeRanges = [
        { min: 0, max: 100, label: '0-100' },
        { min: 101, max: 500, label: '101-500' },
        { min: 501, max: 1000, label: '501-1000' },
        { min: 1001, max: 5000, label: '1001-5000' },
        { min: 5001, max: Infinity, label: '5000+' }
      ];
      
      const sizeData = new Array(sizeRanges.length).fill(0);
      const sizeLabels = sizeRanges.map(range => range.label);
      
      data.transactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        for (let i = 0; i < sizeRanges.length; i++) {
          if (amount >= sizeRanges[i].min && amount <= sizeRanges[i].max) {
            sizeData[i]++;
            break;
          }
        }
      });
      
      // Add bar chart for transaction sizes
      const sizeColors = [
        [46, 204, 113], [52, 152, 219], [155, 89, 182], 
        [241, 196, 15], [231, 76, 60]
      ];
      
      currentY = addBarChart(sizeData, sizeLabels, 'Transaction Size Distribution', currentY, contentWidth, 60, sizeColors);
      
      // Add transaction trends section
      currentY = addSectionTitle('Transaction Trends', currentY);
      
      // Group transactions by date
      const transactionsByDate = {};
      data.transactions.forEach(transaction => {
        try {
          // Safely get the date string
          const dateStr = transaction.date;
          if (!dateStr) return;
          
          // Try to parse the date
          let dateObj;
          if (isDate(dateStr)) {
            dateObj = dateStr;
          } else {
            try {
              dateObj = parseISO(dateStr);
              if (!isValid(dateObj)) {
                dateObj = new Date(dateStr);
              }
            } catch (e) {
              dateObj = new Date(dateStr);
            }
          }
          
          if (!isValid(dateObj)) return;
          
          const date = format(dateObj, 'yyyy-MM-dd');
          if (!transactionsByDate[date]) {
            transactionsByDate[date] = { income: 0, expense: 0 };
          }
          if (transaction.type === 'income') {
            transactionsByDate[date].income += Number(transaction.amount) || 0;
          } else {
            transactionsByDate[date].expense += Number(transaction.amount) || 0;
          }
        } catch (error) {
          console.error('Error processing transaction date:', error);
        }
      });
      
        // Add hidden insights section
      currentY = addSectionTitle('Hidden Insights', currentY);
      
      // Calculate average transaction size with validation
      const validTransactions = data.transactions.filter(t => !isNaN(Number(t.amount)) && Number(t.amount) !== 0);
      const totalAmount = validTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const avgTransactionSize = validTransactions.length > 0 ? totalAmount / validTransactions.length : 0;
      
      // Calculate most expensive category
      let mostExpensiveCategory = 'None';
      let mostExpensiveAmount = 0;
      
      Object.entries(categoryExpenses).forEach(([category, amount]) => {
        if (amount > mostExpensiveAmount) {
          mostExpensiveAmount = amount;
          mostExpensiveCategory = category;
        }
      });
      
      // Calculate day with highest expenses
      let highestExpenseDay = 'None';
      let highestExpenseAmount = 0;
      
      Object.entries(transactionsByDate).forEach(([date, values]) => {
        if (values.expense > highestExpenseAmount) {
          highestExpenseAmount = values.expense;
          highestExpenseDay = safeFormatDate(date);
        }
      });
      
      // Add insights text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const insights = [
        `Average Transaction Size: ${avgTransactionSize.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `Most Expensive Category: ${mostExpensiveCategory} (${mostExpensiveAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })})`,
        `Day with Highest Expenses: ${highestExpenseDay} (${highestExpenseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })})`,
        `Income to Expense Ratio: ${((data.statistics?.income || 0) / (data.statistics?.expenses || 1)).toFixed(2)}`,
        `Daily Average Income: ${((data.statistics?.income || 0) / (data.statistics?.daysWithTransactions || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `Daily Average Expense: ${correctedAvgDailyExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
      ];
      
      insights.forEach((insight, index) => {
        doc.text(insight, margin, currentY + (index * 6));
      });
      
      currentY += insights.length * 6 + 10;
      currentY = addDivider(currentY);
      
      // Convert to array and sort by date
      const trendData = Object.entries(transactionsByDate)
        .map(([date, values]) => [
          safeFormatDate(date),
          `${values.income.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          `${values.expense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          `${(values.income - values.expense).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
        ])
        .sort((a, b) => {
          try {
            const dateA = new Date(a[0]);
            const dateB = new Date(b[0]);
            return dateA - dateB;
          } catch (e) {
            return 0;
          }
        });
      
      if (trendData.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [['Date', 'Income', 'Expense', 'Balance']],
          body: trendData,
          theme: 'grid',
          headStyles: { 
            fillColor: [66, 139, 202],
            textColor: [255, 255, 255],
            fontSize: 12,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 9,
            cellPadding: 4
          },
          columnStyles: { 
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { left: margin, right: margin }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
        currentY = addDivider(currentY);
      }
    }
    
          // Add Comprehensive Financial Analysis & Recommendations
      if (data.transactions?.length > 0) {
        currentY = addSectionTitle('Comprehensive Financial Analysis & Recommendations', currentY);
        
        // Calculate detailed insights
        const totalIncome = data.statistics?.income || 0;
        const totalExpense = data.statistics?.expenses || 0;
        const savingsRate = data.statistics?.savingsRate || 0;
        
        // Use the corrected daily average calculation here as well
        const transactionsByDate = {};
        if (data.transactions?.length > 0) {
          data.transactions.forEach(transaction => {
            try {
              const dateStr = transaction.date;
              if (!dateStr) return;
              
              let dateObj;
              if (isDate(dateStr)) {
                dateObj = dateStr;
              } else {
                try {
                  dateObj = parseISO(dateStr);
                  if (!isValid(dateObj)) {
                    dateObj = new Date(dateStr);
                  }
                } catch (e) {
                  dateObj = new Date(dateStr);
                }
              }
              
              if (!isValid(dateObj)) return;
              
              const date = format(dateObj, 'yyyy-MM-dd');
              if (!transactionsByDate[date]) {
                transactionsByDate[date] = 0;
              }
              if (transaction.type === 'expense') {
                transactionsByDate[date] += Number(transaction.amount) || 0;
              }
            } catch (error) {
              console.error('Error processing transaction date for daily average:', error);
            }
          });
        }
        
        // Calculate the average of daily totals
        const dailyTotals = Object.values(transactionsByDate);
        const correctedAvgDailyExpense = dailyTotals.length > 0 ? 
          dailyTotals.reduce((sum, total) => sum + total, 0) / dailyTotals.length : 0;
        const avgDailyExpense = correctedAvgDailyExpense;
        
        // Transaction analysis
        const incomeTransactions = data.transactions.filter(t => t.type === 'income');
        const expenseTransactions = data.transactions.filter(t => t.type === 'expense');
        const totalTransactions = data.transactions.length;
        
        // Category analysis
        const categoryExpenses = {};
        const categoryIncome = {};
        expenseTransactions.forEach(t => {
          categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + Number(t.amount);
        });
        incomeTransactions.forEach(t => {
          categoryIncome[t.category] = (categoryIncome[t.category] || 0) + Number(t.amount);
        });
        
        // Transaction size analysis
        const expenseSizes = expenseTransactions.map(t => Number(t.amount)).sort((a, b) => a - b);
        const incomeSizes = incomeTransactions.map(t => Number(t.amount)).sort((a, b) => a - b);
        const avgExpense = expenseSizes.length > 0 ? expenseSizes.reduce((a, b) => a + b, 0) / expenseSizes.length : 0;
        const avgIncome = incomeSizes.length > 0 ? incomeSizes.reduce((a, b) => a + b, 0) / incomeSizes.length : 0;
        
        // Generate comprehensive recommendations
        const recommendations = [];
        
        if (savingsRate < 20) {
          recommendations.push('Consider increasing savings rate to at least 20% for better financial security');
        }
        
        if (savingsRate < 0) {
          recommendations.push('Current spending exceeds income - immediate cost-cutting measures recommended');
        }
        
        if (avgDailyExpense > totalIncome / 30 * 0.8) {
          recommendations.push('Daily expenses are high relative to income - review discretionary spending');
        }
        
        if (data.statistics?.maxDailyExpense > totalIncome * 0.3) {
          recommendations.push('Large single-day expenses detected - consider spreading major purchases');
        }
        
        // Category-specific recommendations
        const topExpenseCategory = Object.entries(categoryExpenses).sort(([, a], [, b]) => b - a)[0];
        if (topExpenseCategory && topExpenseCategory[1] > totalExpense * 0.4) {
          recommendations.push(`${topExpenseCategory[0]} represents ${((topExpenseCategory[1] / totalExpense) * 100).toFixed(1)}% of expenses - consider optimization`);
        }
        
        if (Object.keys(categoryIncome).length === 1) {
          recommendations.push('Income is concentrated in one source - consider diversifying income streams');
        }
        
        if (recommendations.length === 0) {
          recommendations.push('Excellent financial management! Continue maintaining current spending patterns');
          recommendations.push('Consider increasing investments for long-term wealth building');
          recommendations.push('Explore additional income sources to accelerate savings');
        }
        
        // Add recommendations
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(52, 73, 94);
        doc.text('Key Recommendations:', margin, currentY);
        currentY += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(44, 62, 80);
        recommendations.forEach((rec, index) => {
          doc.text(rec, margin, currentY + (index * 6));
        });
        
        currentY += recommendations.length * 6 + 15;
        
        // Add comprehensive financial health indicators
        currentY = addSectionTitle('Comprehensive Financial Health Indicators', currentY);
        
        const indicators = [
          ['Savings Rate', `${savingsRate.toFixed(1)}%`, savingsRate >= 20 ? 'Excellent' : savingsRate >= 10 ? 'Good' : 'Needs Improvement'],
          ['Expense to Income Ratio', `${((totalExpense / totalIncome) * 100).toFixed(1)}%`, (totalExpense / totalIncome) <= 0.8 ? 'Healthy' : 'High'],
          ['Average Daily Expense', `${avgDailyExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, avgDailyExpense <= totalIncome / 30 * 0.7 ? 'Controlled' : 'High'],
          ['Transaction Frequency', `${(totalTransactions / (data.statistics?.daysWithTransactions || 1)).toFixed(1)} per day`, 'Normal'],
          ['Average Expense Size', `${avgExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Per transaction'],
          ['Average Income Size', `${avgIncome.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Per transaction'],
          ['Income Sources', Object.keys(categoryIncome).length.toString(), Object.keys(categoryIncome).length > 1 ? 'Diversified' : 'Concentrated'],
          ['Expense Categories', Object.keys(categoryExpenses).length.toString(), 'Active categories']
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Indicator', 'Value', 'Status']],
          body: indicators,
          theme: 'grid',
          headStyles: { 
            fillColor: [52, 73, 94],
            textColor: [255, 255, 255],
            fontSize: 11,
            fontStyle: 'bold'
          },
          styles: { 
            fontSize: 10,
            cellPadding: 5
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
        
        // Add category performance analysis
        currentY = addSectionTitle('Category Performance Analysis', currentY);
        
        const categoryData = Object.entries(categoryExpenses)
          .sort(([, a], [, b]) => b - a)
          .map(([category, amount]) => [
            category,
            `${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
            `${((amount / totalExpense) * 100).toFixed(1)}%`,
            expenseTransactions.filter(t => t.category === category).length.toString()
          ]);
        
        if (categoryData.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Category', 'Amount', 'Percentage', 'Transactions']],
            body: categoryData,
            theme: 'grid',
            headStyles: { 
              fillColor: [231, 76, 60],
              textColor: [255, 255, 255],
              fontSize: 11,
              fontStyle: 'bold'
            },
            styles: { 
              fontSize: 9,
              cellPadding: 4
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
      }
    
    // Add footer
    const footerY = pageHeight - 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Professional Financial Analysis System', pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text(`Page 1 of 1`, pageWidth - margin - 5, footerY + 5, { align: 'right' });
    
    // Save the PDF
    const filename = `financial_${type}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate ${type} report: ${error.message}`);
  }
};

export const generateCategoryAnalysisPDF = (transactions, periodLabel = '') => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Expense Category Analysis', pageWidth / 2, y, { align: 'center' });
  y += 10;
  if (periodLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(periodLabel, pageWidth / 2, y, { align: 'center' });
    y += 10;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Calculate category expenses
  const categoryExpenses = {};
  let total = 0;
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const key = t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
    categoryExpenses[key] = (categoryExpenses[key] || 0) + Number(t.amount);
    total += Number(t.amount);
  });

  // Table data
  const tableData = Object.entries(categoryExpenses)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => [cat, Math.round(amt).toLocaleString('en-IN')]);

  if (tableData.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255], fontSize: 12, fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin }
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.text('No expense data available for this period.', pageWidth / 2, y, { align: 'center' });
    y += 10;
  }

  // Total expenditure
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Total Expenditure: ${Math.round(total).toLocaleString('en-IN')}`, pageWidth / 2, y, { align: 'center' });

  return doc;
};

export const generateWeightReport = (weights, selectedDays = 30, targetWeight = 70) => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Helper function to add a section title
    const addSectionTitle = (title, y) => {
      doc.setFillColor(66, 139, 202);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, margin + 5, y + 5.5);
      doc.setTextColor(0, 0, 0);
      return y + 15;
    };

    // Helper function to add a divider line
    const addDivider = (y) => {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      return y + 5;
    };

    // Calculate weight statistics
    const validWeights = weights.filter(w => w.weight && !isNaN(w.weight));
    const sortedWeights = validWeights.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sortedWeights.length === 0) {
      throw new Error('No valid weight data available');
    }

    const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight || 0;
    const startWeight = sortedWeights[0]?.weight || 0;
    const weightChange = currentWeight - startWeight;
    const avgWeight = sortedWeights.reduce((sum, w) => sum + w.weight, 0) / sortedWeights.length;
    const minWeight = Math.min(...sortedWeights.map(w => w.weight));
    const maxWeight = Math.max(...sortedWeights.map(w => w.weight));

    // Calculate trend (linear regression slope)
    const n = sortedWeights.length;
    const sumX = sortedWeights.reduce((sum, _, i) => sum + i, 0);
    const sumY = sortedWeights.reduce((sum, w) => sum + w.weight, 0);
    const sumXY = sortedWeights.reduce((sum, w, i) => sum + (i * w.weight), 0);
    const sumXX = sortedWeights.reduce((sum, _, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const trendDirection = slope > 0.1 ? 'Increasing' : slope < -0.1 ? 'Decreasing' : 'Stable';

    // --- Cover Page ---
    doc.setFillColor(52, 73, 94);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(38);
    doc.text('WEIGHT', pageWidth / 2, 120, { align: 'center' });
    doc.setFontSize(32);
    doc.text('TRACKER', pageWidth / 2, 155, { align: 'center' });

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(3);
    doc.line(pageWidth / 2 - 70, 175, pageWidth / 2 + 70, 175);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Progress Report & Analysis', pageWidth / 2, 200, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Period: Last ${selectedDays} Days`, pageWidth / 2, 220, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, 250, { align: 'center' });

    doc.addPage();

    // --- Summary Section ---
    let currentY = 30;
    currentY = addSectionTitle('WEIGHT SUMMARY', currentY);

    // Summary statistics
    const summaryData = [
      ['Current Weight', `${currentWeight.toFixed(1)} kg`],
      ['Starting Weight', `${startWeight.toFixed(1)} kg`],
      ['Total Change', `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`],
      ['Average Weight', `${avgWeight.toFixed(1)} kg`],
      ['Target Weight', `${targetWeight} kg`],
      ['Distance to Target', `${(targetWeight - currentWeight).toFixed(1)} kg`],
      ['Trend Direction', trendDirection],
      ['Total Entries', sortedWeights.length.toString()],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 11,
        cellPadding: 8,
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold', textColor: [59, 130, 246] }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // --- Weight History Table ---
    currentY = addSectionTitle('WEIGHT HISTORY', currentY);

    const historyData = sortedWeights.slice(-20).map(weight => [
      format(new Date(weight.date), 'MMM dd, yyyy'),
      `${weight.weight.toFixed(1)} kg`,
      weight.createdAt ? format(new Date(weight.createdAt), 'MMM dd, yyyy') : 'N/A'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Date', 'Weight', 'Recorded']],
      body: historyData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 12,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 6
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // --- Weekly Analysis ---
    currentY = addSectionTitle('WEEKLY ANALYSIS', currentY);

    // Group by weeks
    const weeklyData = {};
    sortedWeights.forEach(weight => {
      const date = new Date(weight.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = format(weekStart, 'MMM dd');

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { weights: [], sum: 0, count: 0 };
      }
      weeklyData[weekKey].weights.push(weight.weight);
      weeklyData[weekKey].sum += weight.weight;
      weeklyData[weekKey].count++;
    });

    const weeklyTableData = Object.entries(weeklyData)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-8) // Last 8 weeks
      .map(([week, data]) => [
        week,
        data.count.toString(),
        `${(data.sum / data.count).toFixed(1)} kg`,
        `${Math.min(...data.weights).toFixed(1)} kg`,
        `${Math.max(...data.weights).toFixed(1)} kg`
      ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Week', 'Entries', 'Average', 'Min', 'Max']],
      body: weeklyTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 6
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // --- Progress Insights ---
    currentY = addSectionTitle('PROGRESS INSIGHTS', currentY);

    const insights = [];

    if (Math.abs(slope) > 0.05) {
      if (slope > 0) {
        insights.push(`Weight is trending upward at ${slope.toFixed(2)} kg/day`);
      } else {
        insights.push(`Weight is trending downward at ${Math.abs(slope).toFixed(2)} kg/day`);
      }
    } else {
      insights.push('Weight is relatively stable with minimal daily changes');
    }

    const targetDiff = targetWeight - currentWeight;
    if (Math.abs(targetDiff) < 2) {
      insights.push('Very close to target weight - excellent progress!');
    } else if (targetDiff > 0) {
      insights.push(`${targetDiff.toFixed(1)} kg to reach target weight`);
    } else {
      insights.push(`${Math.abs(targetDiff).toFixed(1)} kg over target weight`);
    }

    const consistency = sortedWeights.length / selectedDays;
    if (consistency > 0.8) {
      insights.push('Excellent tracking consistency - keep it up!');
    } else if (consistency > 0.5) {
      insights.push('Good tracking consistency - consider more frequent entries');
    } else {
      insights.push('Tracking consistency could be improved for better insights');
    }

    // Add insights text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);

    insights.forEach((insight, index) => {
      doc.text(`• ${insight}`, margin, currentY + (index * 8));
    });

    currentY += insights.length * 8 + 15;

    // --- Footer ---
    const footerY = pageHeight - 20;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Weight Tracker', pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text(`Page 1 of 1`, pageWidth - margin - 5, footerY + 5, { align: 'right' });

    return doc;
  } catch (error) {
    console.error('Error generating weight report:', error);
    throw new Error(`Failed to generate weight report: ${error.message}`);
  }
};

export const generateWeightImage = (weights, selectedDays = 30, targetWeight = 70, chartRef) => {
  return new Promise((resolve, reject) => {
    try {
      if (!chartRef || !chartRef.current) {
        reject(new Error('Chart reference not available'));
        return;
      }

      // Use html2canvas to capture the chart
      html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: false,
      }).then(canvas => {
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to generate image blob'));
            return;
          }

          const filename = `weight_chart_${format(new Date(), 'yyyy-MM-dd')}.png`;
          const file = new File([blob], filename, { type: 'image/png' });

          // Use Web Share API if available
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              title: 'Weight Tracker Chart',
              text: 'Check out my weight progress chart!',
              files: [file]
            }).then(() => {
              resolve(true);
            }).catch((error) => {
              if (error.name !== 'AbortError') {
                console.error('Error sharing image:', error);
                // Fallback to download
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
              }
              resolve(true);
            });
          } else {
            // Fallback to download if Web Share API not supported
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            resolve(true);
          }
        }, 'image/png');
      }).catch(error => {
        console.error('Error generating weight image:', error);
        reject(new Error(`Failed to generate weight image: ${error.message}`));
      });
    } catch (error) {
      console.error('Error in generateWeightImage:', error);
      reject(new Error(`Failed to generate weight image: ${error.message}`));
    }
  });
};

// Test function to generate a sample report
export const testPDFGeneration = () => {
  const sampleData = {
    statistics: {
      income: 50000,
      expenses: 30000,
      savings: 20000,
      savingsRate: 40,
      minDailyExpense: 100,
      maxDailyExpense: 5000,
      avgDailyExpense: 1000,
      daysWithTransactions: 30,
      totalDays: 30,
      period: 'January 2024',
      startDate: format(new Date(), 'MMMM yyyy'),
    },
    transactions: [
      {
        date: '2024-01-01',
        type: 'income',
        category: 'Salary',
        amount: 50000,
        description: 'Monthly salary'
      },
      {
        date: '2024-01-02',
        type: 'expense',
        category: 'Food',
        amount: 1000,
        description: 'Groceries'
      },
      {
        date: '2024-01-03',
        type: 'expense',
        category: 'Transport',
        amount: 500,
        description: 'Fuel'
      }
    ]
  };

  try {
    // Generate both types of reports
    generatePDF(sampleData, 'monthly');
    generatePDF(sampleData, 'insights');
    console.log('PDF generation test completed successfully!');
    return true;
  } catch (error) {
    console.error('PDF generation test failed:', error);
    return false;
  }
};
