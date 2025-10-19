# Advanced AI Assistant Setup Guide

## 🤖 Advanced AI Financial Assistant Integration

Your Common Man app now includes a highly advanced, context-aware AI assistant powered by Google's Gemini API that provides comprehensive financial analysis and personalized insights.

## 🚀 Advanced Features

### **Core Intelligence**
- **Context-Aware Analysis**: AI remembers conversation history and provides personalized responses
- **Timeline Selection**: Analyze data for different periods (this month, last month, 3 months, 6 months, this year, last year, custom range)
- **Session Memory**: Maintains conversation context throughout the session
- **Advanced Prompt Engineering**: Sophisticated prompts for better financial insights

### **User Interface**
- **Multi-Tab Interface**: Chat, Quick Insights, and History tabs
- **Timeline Selector**: Easy switching between different analysis periods
- **Settings Panel**: Customize AI personality and response length
- **Export Functionality**: Download conversation history as JSON
- **Real-time Notifications**: Success/error feedback with snackbars

### **AI Personalities**
- **Professional**: Balanced, business-like responses
- **Friendly**: Warm, encouraging, emoji-rich responses  
- **Analytical**: Data-driven, technical, detailed analysis

### **Response Customization**
- **Brief**: Concise 1-2 sentence responses
- **Moderate**: 1-2 paragraph responses
- **Detailed**: Comprehensive 2-3 paragraph analysis

## 📋 Setup Instructions

### 1. Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Install Dependencies

The required Google GenAI SDK is already installed:

```bash
npm install @google/generative-ai
```

### 3. Configure API Key

The API key is already configured in `src/config/apiKeys.js`:

```javascript
export const GEMINI_API_KEY='your_actual_gemini_api_key_here';
```

**OR** create a `.env` file in your project root directory:

```bash
# Add your Gemini API key
REACT_APP_GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 4. Start the Application

```bash
npm start
```

### 5. Test the AI Assistant

1. Click the floating robot button in the bottom-left corner
2. Use the "GenAI Service Test" section on the home page to verify the API is working
3. Try asking: "What are my top spending categories?"

## 🎯 How to Use

1. **Open AI Assistant**: Click the floating robot button in the bottom-left corner
2. **Ask Questions**: Type natural language questions about your finances
3. **Quick Questions**: Use the suggested quick questions to get started
4. **Get Insights**: The AI will analyze your data and provide personalized advice

## 💬 Advanced Query Examples

### **Basic Analysis**
- "What are my top spending categories this month?"
- "How is my savings rate compared to last month?"
- "Show me my recent transactions"
- "What patterns do you see in my spending?"

### **Advanced Insights**
- "Analyze my spending trends over the last 3 months"
- "Identify potential savings opportunities"
- "What's my financial health score?"
- "Predict my next month's expenses"
- "Suggest investment strategies"
- "How can I optimize my budget?"
- "What are my financial goals progress?"
- "Analyze my income vs expense patterns"

### **Timeline-Specific Queries**
- "Compare this year to last year"
- "Show me my spending patterns for the last 6 months"
- "What was my best saving month this year?"
- "Analyze my December spending habits"

## 🔧 Advanced Technical Details

### **AI Capabilities**
- **Context-Aware Analysis**: Remembers conversation history and provides personalized responses
- **Multi-Timeline Analysis**: Analyze data across different time periods with one click
- **Advanced Financial Metrics**: Calculates savings rates, spending trends, and financial health scores
- **Pattern Recognition**: Identifies spending anomalies and behavioral patterns
- **Predictive Insights**: Provides forecasts based on historical data
- **Comparative Analysis**: Compares different time periods and categories

### **Session Management**
- **Conversation Memory**: Maintains context across multiple queries
- **Session Persistence**: Remembers user preferences and conversation history
- **Export Functionality**: Download complete conversation history as JSON
- **Settings Persistence**: AI personality and response preferences are maintained

### **Data Privacy & Security**
- **Real-time Processing**: All analysis happens in real-time
- **No Data Storage**: No transaction data is stored by the AI service
- **Secure API Calls**: Direct browser-to-Gemini API communication
- **Local Context**: Session data stays in your browser

### **Advanced Prompt Engineering**
- **Contextual Awareness**: Includes conversation history in prompts
- **Personality Adaptation**: Adjusts response style based on user preferences
- **Timeline Context**: Provides appropriate analysis based on selected time period
- **Indian Financial Focus**: Uses Indian currency formatting and financial terminology
- **Actionable Insights**: Generates specific, implementable recommendations

### **Technical Implementation**
- **Google GenAI SDK**: Uses official `@google/generative-ai` package
- **Model**: Gemini 2.5 Flash for optimal performance and speed
- **Service Layer**: Centralized `genaiService.js` for API management
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Rate Limiting**: Built-in safety settings and token management

## 🎨 Advanced UI Features

### **Multi-Tab Interface**
- **Chat Tab**: Main conversation interface with context-aware responses
- **Quick Insights Tab**: Instant financial overview with key metrics
- **History Tab**: Complete conversation history with searchable queries

### **Timeline Selector**
- **This Month**: Current month analysis
- **Last Month**: Previous month comparison
- **Last 3 Months**: Quarterly trend analysis
- **Last 6 Months**: Semi-annual patterns
- **This Year**: Annual overview
- **Last Year**: Year-over-year comparison
- **Custom Range**: User-defined date range

### **Settings Panel**
- **AI Personality**: Choose between Professional, Friendly, or Analytical
- **Response Length**: Brief, Moderate, or Detailed responses
- **Context Memory**: Enable/disable conversation memory
- **Export Options**: Download conversation history

### **Enhanced Features**
- **Message Badge**: Shows number of messages in conversation
- **Typing Indicators**: Advanced typing simulation with progress bars
- **Quick Questions**: Categorized questions for different analysis types
- **Export Functionality**: Download complete conversation as JSON
- **Real-time Notifications**: Success/error feedback system
- **Responsive Design**: Optimized for all screen sizes
- **Smooth Animations**: Professional slide-up dialog with transitions

## 🐛 Troubleshooting

### AI Not Responding
- Check if your API key is correctly set in the `.env` file
- Ensure you have an active internet connection
- Verify the API key has proper permissions

### Slow Responses
- The AI processes complex financial data, so responses may take 1-2 seconds
- Large transaction datasets may take longer to analyze

### Error Messages
- If you see "I'm having trouble processing your request", try rephrasing your question
- Check the browser console for detailed error messages

## 🔄 Updates

The AI assistant will automatically use the latest transaction data from your selected month, ensuring all insights are current and relevant.

## 📱 Mobile Experience

On mobile devices:
- Full-screen chat interface
- Touch-optimized buttons and inputs
- Swipe gestures for easy navigation
- Optimized text sizing for readability

---

**Note**: Make sure to keep your Gemini API key secure and never commit it to version control. The `.env` file should be added to your `.gitignore`.
