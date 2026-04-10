import { GoogleGenerativeAI } from "@google/generative-ai";
   import { GEMINI_API_KEY } from '../config/apiKeys';
   
   class GenAIService {
     constructor() {
       this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
       this.model = this.genAI.getGenerativeModel({ 
         model: "gemini-2.5-flash"
       });
       this.abortController = null;
       this.cache = new Map();
       this.metrics = [];
     }
   
     /**
      * Get AI response with full feature set
      */
     async getResponse(userQuery, transactions, options = {}) {
       const startTime = Date.now();
       const cacheKey = this.hashQuery(userQuery, transactions.length);
       
       // Check cache
       if (this.cache.has(cacheKey) && !options.skipCache) {
         this.trackMetric('cache_hit', userQuery, 0, 0, true);
         return this.cache.get(cacheKey);
       }
       
       // Cancel previous request
       if (this.abortController) {
         this.abortController.abort();
       }
       this.abortController = new AbortController();
       
       try {
         // Smart context pruning
         const relevantTxns = this.pruneContext(userQuery, transactions);
         const financialData = this.summarizeTransactions(relevantTxns);
         
         // Try streaming first, fallback to regular
         let response;
         if (options.onStreamChunk) {
           response = await this.streamResponse(userQuery, financialData, options);
         } else {
           response = await this.regularResponse(userQuery, financialData, options);
         }
         
         // Parse structured JSON if requested
         if (options.structured) {
           response = this.parseStructuredResponse(response);
         }
         
         // Cache result
         if (!options.skipCache) {
           this.cache.set(cacheKey, response);
           setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000); // 5min TTL
         }
         
         // Track metrics
         const duration = Date.now() - startTime;
         this.trackMetric('success', userQuery, duration, response.length, false);
         
         return response;
         
       } catch (error) {
         if (error.name === 'AbortError') {
           return '[Cancelled]';
         }
         this.trackMetric('error', userQuery, Date.now() - startTime, 0, false);
         console.error('AI error:', error);
         return 'Sorry, I had trouble with that. Please try again!';
       }
     }
   
     /**
      * Stream response for real-time display
      */
     async streamResponse(query, data, options) {
       const prompt = this.buildPrompt(query, data, options);
       
       const result = await this.model.generateContentStream({
         contents: [{ role: 'user', parts: [{ text: prompt }] }],
         generationConfig: {
           temperature: 0.7,
           // No maxOutputTokens - let LLM use full capacity
         }
       });
       
       let fullText = '';
       
       for await (const chunk of result.stream) {
         // Check for cancellation
         if (this.abortController.signal.aborted) {
           throw new Error('AbortError');
         }
         
         const text = chunk.text();
         fullText += text;
         
         // Call stream handler if provided
         if (options.onStreamChunk) {
           options.onStreamChunk(text, fullText);
         }
       }
       
       return fullText;
     }
   
     /**
      * Regular non-streaming response
      */
     async regularResponse(query, data, options) {
       const prompt = this.buildPrompt(query, data, options);
       
       const result = await this.model.generateContent({
         contents: [{ role: 'user', parts: [{ text: prompt }] }],
         generationConfig: {
           temperature: 0.7,
           // No maxOutputTokens - let LLM use full capacity
         }
       });
       
       return result.response.text();
     }
   
     /**
      * Cancel ongoing request
      */
     cancel() {
       if (this.abortController) {
         this.abortController.abort();
         this.abortController = null;
       }
     }
   
     /**
      * Build prompt with optional structured output
      */
     buildPrompt(query, data, options) {
       const basePrompt = `You are Subbarao, a friendly and analytical financial companion who helps common people understand their money.

   Your Style:
   - Warm and encouraging (use "అన్నా", "ఓకే", "చూద్దాం")
   - Data-driven with specific numbers
   - Clear explanations without jargon
   - Practical, actionable advice
   - Use emojis naturally
   - End with a thoughtful follow-up question
   
   FINANCIAL SUMMARY:
   - Income: ₹${data.totalIncome.toLocaleString()}
   - Expenses: ₹${data.totalExpenses.toLocaleString()}
   - Savings: ₹${data.savings.toLocaleString()}
   - Rate: ${data.savingsRate}%
   
   TOP CATEGORIES:
   ${data.topCategories.map(c => `- ${c.category}: ₹${c.amount.toLocaleString()}`).join('\n')}
   
   RECENT:
   ${data.recentTransactions.slice(0, 5).map(t => `- ${t.date}: ${t.type} ₹${t.amount}`).join('\n')}
   
   QUESTION: "${query}"`;
   
       if (options.structured) {
         return `${basePrompt}
   
   Respond ONLY in this JSON format:
   {
     "explanation": "human-friendly answer with emojis",
     "keyNumbers": ["₹X income", "₹Y expenses"],
     "chartData": [{"label": "Category", "value": 123}],
     "insights": ["insight 1", "insight 2"],
     "followUpQuestion": "question to ask user"
   }`;
       }
   
       return `${basePrompt}
   
   Give a helpful response that:
   1. Answers the question with specific numbers
   2. Provides one practical insight
   3. Ends with a follow-up question`;
     }
   
     /**
      * Smart context pruning based on query intent
      */
     pruneContext(query, transactions) {
       const q = query.toLowerCase();
       
       // Intent-based filtering
       if (q.includes('food') || q.includes('grocery')) {
         return transactions.filter(t => 
           (t.category || '').toLowerCase().includes('food') ||
           (t.description || '').toLowerCase().includes('food')
         );
       }
       
       if (q.includes('big') || q.includes('large') || q.includes('highest')) {
         return transactions
           .filter(t => Number(t.amount) > 1000)
           .sort((a, b) => Number(b.amount) - Number(a.amount));
       }
       
       if (q.includes('recent') || q.includes('last') || q.includes('this week')) {
         const cutoff = new Date();
         cutoff.setDate(cutoff.getDate() - 7);
         return transactions.filter(t => new Date(t.date) >= cutoff);
       }
       
       // Default: return all but limit to prevent bloat
       return transactions.slice(0, 100);
     }
   
     /**
      * Summarize transaction data
      */
     summarizeTransactions(transactions) {
       const income = transactions
         .filter(t => t.type === 'income')
         .reduce((sum, t) => sum + Number(t.amount), 0);
       
       const expenses = transactions
         .filter(t => t.type === 'expense')
         .reduce((sum, t) => sum + Number(t.amount), 0);
       
       const categoryMap = {};
       transactions.forEach(t => {
         const cat = t.category || 'Other';
         categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
       });
   
       return {
         totalIncome: income,
         totalExpenses: expenses,
         savings: income - expenses,
         savingsRate: income > 0 ? (((income - expenses) / income) * 100).toFixed(1) : 0,
         totalTransactions: transactions.length,
         topCategories: Object.entries(categoryMap)
           .map(([cat, amt]) => ({ category: cat, amount: amt }))
           .sort((a, b) => b.amount - a.amount)
           .slice(0, 5),
         recentTransactions: transactions
           .sort((a, b) => new Date(b.date) - new Date(a.date))
           .slice(0, 10)
           .map(t => ({
             date: new Date(t.date).toLocaleDateString('en-IN'),
             type: t.type,
             amount: Number(t.amount).toLocaleString(),
             category: t.category || 'Other'
           }))
       };
     }
   
     /**
      * Parse structured JSON response
      */
     parseStructuredResponse(text) {
       try {
         // Extract JSON from markdown code blocks if present
         const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                          text.match(/\{[\s\S]*\}/);
         
         if (jsonMatch) {
           return JSON.parse(jsonMatch[1] || jsonMatch[0]);
         }
       } catch (e) {
         console.warn('Failed to parse structured response, returning raw');
       }
       return { explanation: text, raw: true };
     }
   
     /**
      * Generate cache key
      */
     hashQuery(query, txnCount) {
       // Simple hash for cache key
       let hash = 0;
       const str = query + txnCount;
       for (let i = 0; i < str.length; i++) {
         const char = str.charCodeAt(i);
         hash = ((hash << 5) - hash) + char;
         hash = hash & hash;
       }
       return hash.toString();
     }
   
     /**
      * Track usage metrics
      */
     trackMetric(status, query, duration, responseLength, cached) {
       const metric = {
         timestamp: new Date().toISOString(),
         status,
         queryType: this.inferQueryType(query),
         durationMs: duration,
         responseLength,
         cached
       };
       this.metrics.push(metric);
       
       // Keep last 100 metrics only
       if (this.metrics.length > 100) {
         this.metrics.shift();
       }
       
       console.log('[AI Metric]', metric);
     }
   
     /**
      * Infer query type for analytics
      */
     inferQueryType(query) {
       const q = query.toLowerCase();
       if (q.includes('spend')) return 'spending_analysis';
       if (q.includes('save')) return 'savings_query';
       if (q.includes('budget')) return 'budget_help';
       if (q.includes('compare')) return 'comparison';
       return 'general';
     }
   
     /**
      * Get metrics summary
      */
     getMetrics() {
       const total = this.metrics.length;
       const successes = this.metrics.filter(m => m.status === 'success').length;
       const cached = this.metrics.filter(m => m.cached).length;
       const avgDuration = total > 0 
         ? this.metrics.reduce((a, b) => a + b.durationMs, 0) / total 
         : 0;
       
       return {
         totalQueries: total,
         successRate: total > 0 ? (successes / total * 100).toFixed(1) : 0,
         cacheHitRate: total > 0 ? (cached / total * 100).toFixed(1) : 0,
         averageResponseTime: avgDuration.toFixed(0) + 'ms',
         recentQueries: this.metrics.slice(-10)
       };
     }
   
    // Legacy compatibility
    async generateFinancialInsight(query, transactions, options) {
      return this.getResponse(query, transactions, options);
    }
  
    // Legacy compatibility for direct content generation
    async generateContent(prompt, options = {}) {
      try {
        const generationConfig = {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxOutputTokens,
          ...options.generationConfig
        };
  
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: generationConfig
        });
        
        return result.response.text();
      } catch (error) {
        console.error('GenAI error:', error);
        throw error;
      }
    }
  }
   
   const genAIService = new GenAIService();
   export default genAIService;
