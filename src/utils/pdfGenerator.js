import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
        `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
      ]);
      
      // Add table
      doc.autoTable({
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
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('Common Man', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Financial Management System', pageWidth / 2, 25, { align: 'center' });
    
    // Add report title and date
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    const title = type === 'monthly' ? 'Monthly Financial Report' : 'Financial Insights Report';
    doc.text(title, pageWidth / 2, 55, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, 65, { align: 'center' });
    
    // Add period information
    let currentY = 75;
    if (data.statistics?.period) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Period: ${data.statistics.period.charAt(0).toUpperCase() + data.statistics.period.slice(1)}`, pageWidth / 2, currentY, { align: 'center' });
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
    doc.text(`₹${(data.statistics?.income || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + 5, currentY + 20);
    
    // Expenses box
    doc.setFillColor(231, 76, 60);
    doc.rect(margin + boxWidth + 10, currentY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Expenses', margin + boxWidth + 15, currentY + 8);
    doc.setFontSize(14);
    doc.text(`₹${(data.statistics?.expenses || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + boxWidth + 15, currentY + 20);
    
    currentY += boxHeight + 10;
    
    // Balance box
    doc.setFillColor(52, 152, 219);
    doc.rect(margin, currentY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Net Balance', margin + 5, currentY + 8);
    doc.setFontSize(14);
    doc.text(`₹${(data.statistics?.savings || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + 5, currentY + 20);
    
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
    doc.text(`₹${(data.statistics?.minDailyExpense || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + 5, currentY + 18);
    
    // Max Daily Expense
    doc.setFillColor(230, 126, 34);
    doc.rect(margin + smallBoxWidth + 5, currentY, smallBoxWidth, smallBoxHeight, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Max Daily Expense', margin + smallBoxWidth + 10, currentY + 8);
    doc.setFontSize(12);
    doc.text(`₹${(data.statistics?.maxDailyExpense || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + smallBoxWidth + 10, currentY + 18);
    
    // Avg Daily Expense
    doc.setFillColor(149, 165, 166);
    doc.rect(margin + (smallBoxWidth + 5) * 2, currentY, smallBoxWidth, smallBoxHeight, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Avg Daily Expense', margin + (smallBoxWidth + 5) * 2 + 5, currentY + 8);
    doc.setFontSize(12);
    doc.text(`₹${(data.statistics?.avgDailyExpense || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, margin + (smallBoxWidth + 5) * 2 + 5, currentY + 18);
    
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
          const category = transaction.category || 'Uncategorized';
          categoryExpenses[category] = (categoryExpenses[category] || 0) + Number(transaction.amount);
        }
      });
      
      // Convert to array for table
      const categoryData = Object.entries(categoryExpenses)
        .map(([category, amount]) => [
          category,
          `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
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
        doc.autoTable({
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
      
      // Group transactions by day of week
      const dayOfWeekData = [0, 0, 0, 0, 0, 0, 0]; // 0 = Sunday, 6 = Saturday
      const dayOfWeekLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
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
            dayOfWeekData[dayOfWeek] += Number(transaction.amount) || 0;
          }
        } catch (error) {
          console.error('Error processing transaction date:', error);
        }
      });
      
      // Add bar chart for day of week expenses
      const dayColors = [
        [231, 76, 60], [46, 204, 113], [52, 152, 219], 
        [155, 89, 182], [241, 196, 15], [230, 126, 34], [149, 165, 166]
      ];
      
      currentY = addBarChart(dayOfWeekData, dayOfWeekLabels, 'Expenses by Day of Week', currentY, contentWidth, 60, dayColors);
      
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
      
      // Add monthly data table
      const monthlyTableData = monthKeys.map(key => [
        format(parseISO(key + '-01'), 'MMMM yyyy'),
        `₹${monthlyData[key].income.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `₹${monthlyData[key].expense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `₹${(monthlyData[key].income - monthlyData[key].expense).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `${((monthlyData[key].income - monthlyData[key].expense) / monthlyData[key].income * 100).toFixed(1)}%`
      ]);
      
      doc.autoTable({
        startY: currentY,
        head: [['Month', 'Income', 'Expenses', 'Balance', 'Savings Rate']],
        body: monthlyTableData,
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
          3: { halign: 'right' },
          4: { halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: margin, right: margin }
      });
      
      currentY = doc.lastAutoTable.finalY + 10;
      currentY = addDivider(currentY);
      
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
        { min: 0, max: 100, label: '₹0-100' },
        { min: 101, max: 500, label: '₹101-500' },
        { min: 501, max: 1000, label: '₹501-1000' },
        { min: 1001, max: 5000, label: '₹1001-5000' },
        { min: 5001, max: Infinity, label: '₹5000+' }
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
      
      // Calculate average transaction size
      const totalAmount = data.transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const avgTransactionSize = totalAmount / data.transactions.length;
      
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
        `Average Transaction Size: ₹${avgTransactionSize.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `Most Expensive Category: ${mostExpensiveCategory} (₹${mostExpensiveAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })})`,
        `Day with Highest Expenses: ${highestExpenseDay} (₹${highestExpenseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })})`,
        `Income to Expense Ratio: ${((data.statistics?.income || 0) / (data.statistics?.expenses || 1)).toFixed(2)}`,
        `Daily Average Income: ₹${((data.statistics?.income || 0) / (data.statistics?.daysWithTransactions || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        `Daily Average Expense: ₹${((data.statistics?.expenses || 0) / (data.statistics?.daysWithTransactions || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
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
          `₹${values.income.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          `₹${values.expense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          `₹${(values.income - values.expense).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
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
        doc.autoTable({
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
    
    // Add transactions table
    if (data.transactions?.length > 0) {
      currentY = addSectionTitle('Transaction Details', currentY);
      
      // Format transactions for table
      const tableData = data.transactions
        .map(t => {
          try {
            return [
              safeFormatDate(t.date),
              t.type === 'income' ? 'Income' : 'Expense',
              t.category || 'Uncategorized',
              `₹${(Number(t.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
              t.description || '-'
            ];
          } catch (error) {
            console.error('Error formatting transaction:', error);
            return [
              'Invalid Date',
              t.type === 'income' ? 'Income' : 'Expense',
              t.category || 'Uncategorized',
              `₹${(Number(t.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
              t.description || '-'
            ];
          }
        })
        .sort((a, b) => {
          try {
            const dateA = new Date(a[0]);
            const dateB = new Date(b[0]);
            return dateA - dateB;
          } catch (e) {
            return 0;
          }
        });
      
      doc.autoTable({
        startY: currentY,
        head: [['Date', 'Type', 'Category', 'Amount', 'Description']],
        body: tableData,
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
          3: { halign: 'right' },
          4: { cellWidth: 40 }
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: margin, right: margin }
      });
      
      currentY = doc.lastAutoTable.finalY + 10;
    }
    
    // Add footer
    const footerY = pageHeight - 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Common Man Financial Management System', pageWidth / 2, footerY + 5, { align: 'center' });
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
      period: 'January 2024'
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