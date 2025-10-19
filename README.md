# Common Man - Financial Management App

A comprehensive financial management application with AI-powered assistant (Chitrgupta) for tracking expenses, generating reports, and providing financial insights.

## 🚀 Live Demo

**Production URL**: [https://aadhayavyaya.netlify.app/](https://aadhayavyaya.netlify.app/)

## ✨ Features

### 💰 Financial Management
- **Transaction Tracking**: Add, edit, and delete income/expense transactions
- **Category Management**: Organize transactions by categories and subcategories
- **Monthly Reports**: Generate detailed PDF reports
- **Expense Analysis**: Visual charts and spending insights
- **Date Range Filtering**: Analyze specific time periods

### 🤖 AI Assistant (Chitrgupta)
- **Smart Financial Advice**: AI-powered financial insights
- **Conversation History**: Save and manage chat sessions
- **Share Conversations**: Generate shareable links for conversations
- **Session Management**: Organize conversations with serial numbering
- **Real-time Chat**: Interactive financial guidance

### 📊 Analytics & Reports
- **PDF Generation**: Export financial reports and summaries
- **Category Breakdown**: Detailed spending analysis
- **Savings Tracking**: Monitor income vs expenses
- **Trend Analysis**: Track financial patterns over time

### 🔐 Security & Authentication
- **Firebase Authentication**: Secure user login/signup
- **Data Privacy**: User-specific data isolation
- **Session Management**: Secure conversation storage

## 🛠️ Technology Stack

- **Frontend**: React 18.2.0
- **UI Framework**: Material-UI (MUI) 5.15.10
- **State Management**: Redux Toolkit 2.2.1
- **Backend**: Firebase 11.7.3
- **AI Integration**: Google Generative AI 0.24.1
- **PDF Generation**: jsPDF 2.5.1
- **Routing**: React Router DOM 6.22.1

## 📦 Installation & Setup

### Prerequisites
- Node.js 16.x or higher
- npm 8.x or higher
- Firebase project
- Google AI API key

### 1. Clone the Repository
```bash
git clone <repository-url>
cd MONTHLYBILLS
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Google AI Configuration
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
```

### 4. Start Development Server
```bash
npm start
```

The app will open at `http://localhost:3000`

## 🚀 Deployment

### Netlify Deployment
1. **Build Command**: `npm run build`
2. **Publish Directory**: `build`
3. **Node Version**: 18.x

### Environment Variables (Netlify Dashboard)
Set these in Site Settings > Environment Variables:
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_GEMINI_API_KEY`

## 📱 Usage

### Getting Started
1. **Sign Up/Login**: Create an account or login
2. **Add Transactions**: Click the + button to add income/expenses
3. **View Analytics**: Check your financial overview and insights
4. **AI Assistant**: Click the AI button to chat with Chitrgupta
5. **Generate Reports**: Create PDF reports for your finances

### AI Assistant Features
- **Ask Questions**: "What's my total spending this month?"
- **Get Insights**: "Which category has the highest expenses?"
- **Share Conversations**: Generate shareable links
- **Session History**: View and continue previous conversations

### Report Generation
- **Monthly Reports**: Comprehensive financial summaries
- **Expense Analysis**: Category-wise spending breakdown
- **Daily Summaries**: Individual day transaction details

## 🔧 Development

### Available Scripts
```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run eject      # Eject from Create React App
```

### Project Structure
```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── AIAssistant.js  # AI chat interface
│   └── ...
├── contexts/           # React contexts
├── firebase/           # Firebase configuration
├── pages/              # Page components
├── services/           # API services
├── store/              # Redux store
└── utils/              # Utility functions
```

## 🔐 Security

### API Keys
- All API keys are stored in environment variables
- Never commit `.env` files to version control
- Use different keys for development and production

### Firebase Security
- Configure Firebase security rules
- Implement user-based access control
- Validate data on both client and server side

## 🐛 Troubleshooting

### Common Issues
1. **Firebase initialization errors**: Check environment variables
2. **AI API errors**: Verify Google AI API key and quotas
3. **PDF generation errors**: Check jsPDF and html2canvas versions
4. **Build failures**: Ensure all dependencies are installed

### Debug Commands
```bash
npm list              # Check dependency versions
npm audit             # Check for vulnerabilities
npm audit fix         # Fix vulnerabilities
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions, please open an issue in the repository.

---

**Built with ❤️ for better financial management**