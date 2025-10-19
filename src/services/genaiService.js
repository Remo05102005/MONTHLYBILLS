import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../config/apiKeys';

class GenAIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash"
    });
  }

  async generateContent(prompt, options = {}) {
    try {
      const generationConfig = {
        temperature: options.temperature || 0.7,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
        maxOutputTokens: options.maxOutputTokens || 1024,
        ...options.generationConfig
      };

      const result = await this.model.generateContent(prompt, generationConfig);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  createFinancialPrompt(userQuery, financialData, options = {}) {
    const conversationContext = options.conversationContext || '';
    const personality = options.personality || 'professional';
    const responseLength = options.responseLength || 'detailed';

    const personalityPrompt = personality === 'friendly' 
      ? 'Be warm, encouraging, and use casual language. Use emojis frequently and be very supportive.'
      : personality === 'analytical' 
      ? 'Be highly analytical, data-driven, and technical. Focus on numbers, trends, and detailed analysis.'
      : 'Be professional, knowledgeable, and balanced. Use appropriate business language with occasional emojis.';

    const responseLengthPrompt = responseLength === 'brief'
      ? 'Keep responses very concise (1-2 sentences max).'
      : responseLength === 'detailed'
      ? 'Provide comprehensive analysis (2-3 paragraphs).'
      : 'Provide moderate detail (1-2 paragraphs).';

    return `You are Chitrgupta, the divine accountant and keeper of financial records in Hindu mythology. You are a wise, patient, and knowledgeable financial advisor who speaks in simple, easy-to-understand language for common people. You are like a friendly neighborhood accountant who helps people understand their money matters.

PERSONALITY: You are Chitrgupta - wise, patient, and always helpful. You speak in simple Telugu-English mix that common people understand. You use terms like "anna", "dost", "mee dabbulu", "ela kharchu", "baga undi", "theesukondi", etc. You are very specific and only answer what is asked - no extra information unless requested.

${conversationContext}
FINANCIAL DATA CONTEXT:
- Analysis Period: ${financialData.period} (${financialData.timeline})
- Total Income: ₹${financialData.totalIncome.toLocaleString('en-IN')}
- Total Expenses: ₹${financialData.totalExpenses.toLocaleString('en-IN')}
- Net Savings: ₹${financialData.savings.toLocaleString('en-IN')} (${financialData.savingsRate.toFixed(1)}% savings rate)
- Total Transactions: ${financialData.totalTransactions} (${financialData.incomeTransactions} income, ${financialData.expenseTransactions} expenses)
- Average Daily Expense: ₹${financialData.avgDailyExpense.toLocaleString('en-IN')}
- Average Transaction Size: ₹${financialData.avgTransactionSize.toLocaleString('en-IN')}
- Month-over-Month Change: ${financialData.expenseChange > 0 ? '+' : ''}${financialData.expenseChange.toFixed(1)}%

TOP SPENDING CATEGORIES (with percentages):
${financialData.topCategories.map((item, index) => 
  `${index + 1}. ${item.category}: ₹${item.amount.toLocaleString('en-IN')} (${item.percentage.toFixed(1)}%)`
).join('\n')}

RECENT TRANSACTIONS (Last 15):
${financialData.recentTransactions.map(t => 
  `- ${t.formattedDate}: ${t.type === 'income' ? '+' : '-'}₹${Number(t.amount).toLocaleString('en-IN')} (${t.categoryDisplay})${t.description ? ` - ${t.description}` : ''}`
).join('\n')}

DAILY TRENDS (Last 5 days):
${financialData.dailyTrends.slice(-5).map(day => 
  `${day.date}: Income ₹${day.income.toLocaleString('en-IN')}, Expense ₹${day.expense.toLocaleString('en-IN')}, Net ₹${day.net.toLocaleString('en-IN')} (${day.transactionCount} transactions)`
).join('\n')}

USER QUERY: "${userQuery}"

INSTRUCTIONS:
1. You are Chitrgupta - speak like a wise, friendly accountant who understands common people's money problems
2. Use simple Telugu-English mix: "Mee dabbulu", "ela kharchu", "anna", "dost", "baga undi", "theesukondi"
3. ${responseLengthPrompt}
4. ONLY answer the specific question asked - don't give extra information unless requested
5. Be very specific and direct - no fluff or unnecessary details
6. Use Indian currency format (₹) and simple financial terms
7. If asked about patterns, give specific examples from their actual data
8. If asked for advice, make it simple and actionable for common people
9. Always be encouraging and supportive - like a helpful friend
10. Use actual numbers from their transactions to make your point
11. Keep it simple - avoid complex financial jargon
12. End with a simple follow-up question if appropriate

RESPONSE:`;
  }

  async generateFinancialInsight(userQuery, transactions, options = {}) {
    try {
      console.log('Generating financial insight for:', userQuery);
      console.log('Number of transactions:', transactions.length);

      // Process financial data
      const financialData = this.processFinancialData(transactions, options.timeline || 'thisMonth');
      
      // Create the prompt
      const prompt = this.createFinancialPrompt(userQuery, financialData, options);
      
      console.log('Sending prompt to AI...');
      
      // Generate response
      const response = await this.generateContent(prompt, {
        temperature: 0.7,
        maxOutputTokens: 1024
      });
      
      console.log('AI response received:', response);
      return response;
      
    } catch (error) {
      console.error('Error generating financial insight:', error);
      throw error;
    }
  }

  processFinancialData(transactions, timeline) {
    const now = new Date();
    const totalTransactions = transactions.length;
    
    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
    
    // Transaction counts
    const incomeTransactions = transactions.filter(t => t.type === 'income').length;
    const expenseTransactions = transactions.filter(t => t.type === 'expense').length;
    
    // Averages
    const avgDailyExpense = totalExpenses / Math.max(1, totalTransactions);
    const avgTransactionSize = (totalIncome + totalExpenses) / Math.max(1, totalTransactions);
    
    // Category analysis
    const categoryTotals = {};
    transactions.forEach(t => {
      const category = t.category || 'Other';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { amount: 0, count: 0 };
      }
      categoryTotals[category].amount += Number(t.amount);
      categoryTotals[category].count += 1;
    });
    
    const topCategories = Object.entries(categoryTotals)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: (data.amount / totalExpenses) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    // Recent transactions
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15)
      .map(t => ({
        ...t,
        formattedDate: new Date(t.date).toLocaleDateString('en-IN'),
        categoryDisplay: t.category || 'Other'
      }));
    
    // Daily trends (last 5 days)
    const dailyTrends = [];
    for (let i = 4; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayTransactions = transactions.filter(t => 
        new Date(t.date).toDateString() === date.toDateString()
      );
      
      const dayIncome = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const dayExpense = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      dailyTrends.push({
        date: date.toLocaleDateString('en-IN'),
        income: dayIncome,
        expense: dayExpense,
        net: dayIncome - dayExpense,
        transactionCount: dayTransactions.length
      });
    }
    
    // Month-over-month change (simplified)
    const expenseChange = 0; // Placeholder for now
    
    return {
      period: timeline,
      timeline: timeline,
      totalIncome,
      totalExpenses,
      savings,
      savingsRate,
      totalTransactions,
      incomeTransactions,
      expenseTransactions,
      avgDailyExpense,
      avgTransactionSize,
      expenseChange,
      topCategories,
      recentTransactions,
      dailyTrends
    };
  }
}

// Create a singleton instance
const genAIService = new GenAIService();

export default genAIService;