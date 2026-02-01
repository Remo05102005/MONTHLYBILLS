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
      console.log('=== GENAI SERVICE FULL DEBUG ===');
      console.log('Prompt length:', prompt.length);
      console.log('Prompt content:');
      console.log(prompt);
      console.log('=== END PROMPT ===');
      
      console.log('Options:', options);
      
      const generationConfig = {
        temperature: options.temperature || 0.7,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
        maxOutputTokens: options.maxOutputTokens || 4096, // Increased from 2048 to 4096 for nutrient data
        ...options.generationConfig
      };

      console.log('Generation config:', generationConfig);
      console.log('Creating contents array...');
      const contents = [{ role: 'user', parts: [{ text: prompt }] }];
      console.log('Contents:', contents);
      
      const result = await this.model.generateContent({
        contents: contents,
        generationConfig: generationConfig
      });
      console.log('Raw result:', result);
      
      const response = await result.response;
      console.log('Response object:', response);
      
      if (!response) {
        console.error('GenAI Service: No response received from API');
        return null;
      }
      
      const text = response.text();
      console.log('=== GENERATED TEXT FULL DEBUG ===');
      console.log('Text length:', text.length);
      console.log('Text content:');
      console.log(text);
      console.log('=== END GENERATED TEXT ===');
      
      return text;
    } catch (error) {
      console.error('GenAI Service: Error generating content:', error);
      console.error('GenAI Service: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  createFinancialPrompt(userQuery, financialData, options = {}) {
    const conversationContext = options.conversationContext || '';
    const personality = options.personality || 'professional';
    const responseLength = options.responseLength || 'detailed';
    const userContextXML = options.userContextXML || '';
    const memoryBuffer = options.memoryBuffer || [];

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

    // Build an XML-structured prompt for more reliable parsing and control
    // It includes the user-provided structured context (transactions, user info)
    // and a small set of few-shot examples to help the model respond in the desired style.

    const examples = `
<examples>
  <example>
    <query>Why did I spend more this month?</query>
    <response>It appears your grocery and transport costs rose due to 3 large transactions on 10th-12th. Suggest cutting two non-essential trips per week.</response>
  </example>
  <example>
    <query>How much did I save last month?</query>
    <response>Your savings were ₹2,500 which is 12% of your income. Consider planning for recurring subscriptions.</response>
  </example>
</examples>`;

    const xmlPrompt = `<?xml version="1.0" encoding="utf-8"?>
<system>
  <assistant name="Subbarao" role="financial_assistant" personality="${personality}" responseLength="${responseLength}">
    <description>Subbarao is a friendly, plain-language financial assistant who speaks in simple Telugu-English mix for common people. Give clear, actionable advice and always reference actual numbers from the user's data when possible.</description>
  </assistant>
  ${userContextXML}
  <memoryBuffer>
    ${memoryBuffer.map(m => `<mem role="${m.type || 'user'}" timestamp="${m.timestamp || ''}">${(m.content || '').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</mem>`).join('\n')}
  </memoryBuffer>
  <financialSummary>
    <analysisPeriod label="${financialData.period}">${financialData.timeline}</analysisPeriod>
    <totals>
      <totalIncome>₹${financialData.totalIncome.toLocaleString('en-IN')}</totalIncome>
      <totalExpenses>₹${financialData.totalExpenses.toLocaleString('en-IN')}</totalExpenses>
      <netSavings>₹${financialData.savings.toLocaleString('en-IN')}</netSavings>
      <savingsRate>${financialData.savingsRate.toFixed(1)}</savingsRate>
      <totalTransactions>${financialData.totalTransactions}</totalTransactions>
    </totals>
    <topCategories>
      ${financialData.topCategories.map(item => `<category name="${item.category}">${item.amount}</category>`).join('\n')}
    </topCategories>
    <recentTransactions>
      ${financialData.recentTransactions.map(t => `<transaction date="${t.formattedDate}" type="${t.type}" amount="${Number(t.amount)}" category="${t.categoryDisplay}">${t.description || ''}</transaction>`).join('\n')}
    </recentTransactions>
  </financialSummary>
  <userQuery>${userQuery}</userQuery>
  ${examples}
</system>

INSTRUCTIONS:
1. Respond in simple Telugu-English with friendly tone. Use small, actionable steps.
2. Reference actual numbers from the <financialSummary> when explaining patterns or advice.
3. If the user asks for time-based filters, ensure transactions referenced match the requested period.
4. Keep the response ${responseLengthPrompt}
5. End with a concise follow-up question when helpful.

RESPONSE:`;

    return xmlPrompt;
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