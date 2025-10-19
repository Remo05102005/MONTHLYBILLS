# Project Requirements & Dependencies

## **Project Overview**
Common Man - Financial Management Application with AI Assistant (Chitrgupta)

## **Technology Stack**
- **Frontend**: React 18.2.0
- **UI Framework**: Material-UI (MUI) 5.15.10
- **State Management**: Redux Toolkit 2.2.1
- **Routing**: React Router DOM 6.22.1
- **Backend**: Firebase 11.7.3
- **AI Integration**: Google Generative AI 0.24.1
- **PDF Generation**: jsPDF 2.5.1
- **Date Handling**: date-fns 2.30.0

## **Core Dependencies**

### **React & Core**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-scripts": "5.0.1",
  "web-vitals": "^2.1.4"
}
```

### **UI & Styling**
```json
{
  "@mui/material": "^5.15.10",
  "@mui/icons-material": "^5.15.10",
  "@mui/x-date-pickers": "^6.19.4",
  "@emotion/react": "^11.11.3",
  "@emotion/styled": "^11.11.0"
}
```

### **State Management & Routing**
```json
{
  "@reduxjs/toolkit": "^2.2.1",
  "react-redux": "^9.1.0",
  "react-router-dom": "^6.22.1"
}
```

### **Backend & Database**
```json
{
  "firebase": "^11.7.3"
}
```

### **AI & Machine Learning**
```json
{
  "@google/generative-ai": "^0.24.1"
}
```

### **PDF & Document Generation**
```json
{
  "jspdf": "^2.5.1",
  "jspdf-autotable": "^3.8.1",
  "html2canvas": "^1.4.1"
}
```

### **Utilities & Helpers**
```json
{
  "date-fns": "^2.30.0",
  "recharts": "^2.15.2",
  "@react-spring/web": "^10.0.1"
}
```

## **Feature-Specific Dependencies**

### **Financial Management**
- **jsPDF**: PDF report generation
- **jspdf-autotable**: Table formatting in PDFs
- **html2canvas**: Screenshot capture for sharing
- **date-fns**: Date manipulation and formatting
- **recharts**: Financial charts and graphs

### **AI Assistant (Chitrgupta)**
- **@google/generative-ai**: AI conversation generation
- **@google/genai**: Additional AI capabilities
- **Firebase**: Session and conversation storage

### **Authentication & Security**
- **Firebase**: User authentication
- **React Router DOM**: Protected routes

### **UI/UX**
- **Material-UI**: Complete UI component library
- **@mui/x-date-pickers**: Date selection components
- **@emotion**: CSS-in-JS styling
- **@react-spring**: Smooth animations

## **Development Dependencies**

### **Build Tools**
- **react-scripts**: Create React App build system
- **web-vitals**: Performance monitoring

### **Code Quality**
- **ESLint**: Code linting (configured via react-scripts)
- **Prettier**: Code formatting (if configured)

## **Browser Support**
```json
{
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

## **Installation Commands**

### **Initial Setup**
```bash
npm install
```

### **Add New Dependencies**
```bash
# UI Components
npm install @mui/material @mui/icons-material

# State Management
npm install @reduxjs/toolkit react-redux

# Firebase
npm install firebase

# PDF Generation
npm install jspdf jspdf-autotable html2canvas

# AI Integration
npm install @google/generative-ai

# Utilities
npm install date-fns recharts
```

## **Environment Variables Required**

### **Firebase Configuration**
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### **Google AI Configuration**
```env
REACT_APP_GOOGLE_AI_API_KEY=your_google_ai_key
```

## **Deployment Requirements**

### **Netlify Deployment**
- **Build Command**: `npm run build`
- **Publish Directory**: `build`
- **Node Version**: 18.x or higher

### **Environment Setup**
- All environment variables must be configured in Netlify dashboard
- Firebase project must be properly configured
- Google AI API key must be valid

## **Feature Dependencies Matrix**

| Feature | Dependencies |
|---------|-------------|
| **User Authentication** | Firebase, React Router DOM |
| **Financial Transactions** | Firebase, Redux Toolkit, Material-UI |
| **AI Assistant** | Google Generative AI, Firebase, Material-UI |
| **PDF Reports** | jsPDF, jspdf-autotable, html2canvas |
| **Conversation Sharing** | React Router DOM, Material-UI |
| **Date Pickers** | @mui/x-date-pickers, date-fns |
| **Charts & Analytics** | recharts, Material-UI |
| **Responsive Design** | Material-UI, @emotion |

## **Version Compatibility**

### **React 18 Compatibility**
- All dependencies are compatible with React 18
- Material-UI v5 supports React 18
- Redux Toolkit works with React 18
- Firebase v11 supports React 18

### **Node.js Requirements**
- **Minimum**: Node.js 16.x
- **Recommended**: Node.js 18.x or higher
- **npm**: 8.x or higher

## **Security Considerations**

### **API Keys**
- All API keys should be stored in environment variables
- Never commit API keys to version control
- Use Netlify environment variables for production

### **Firebase Security Rules**
- Configure proper Firebase security rules
- Implement user-based access control
- Validate data on both client and server side

## **Performance Optimizations**

### **Bundle Size**
- Material-UI tree-shaking enabled
- Firebase modular imports
- Lazy loading for routes

### **Caching**
- Firebase offline persistence
- Redux state persistence
- Service worker for PWA features

## **Testing Dependencies**

### **Unit Testing**
- **Jest**: Included with react-scripts
- **React Testing Library**: Included with react-scripts

### **Integration Testing**
- **Firebase Emulator**: For local testing
- **Mock Service Worker**: For API mocking

## **Maintenance & Updates**

### **Regular Updates**
- Update dependencies monthly
- Check for security vulnerabilities
- Test after major updates

### **Breaking Changes**
- Material-UI v5 to v6 (when available)
- React 18 to 19 (when available)
- Firebase v11 to v12 (when available)

## **Troubleshooting**

### **Common Issues**
1. **Firebase initialization errors**: Check environment variables
2. **Material-UI styling issues**: Check @emotion dependencies
3. **PDF generation errors**: Check jsPDF and html2canvas versions
4. **AI API errors**: Verify Google AI API key and quotas

### **Debug Commands**
```bash
# Check dependency versions
npm list

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Clean install
rm -rf node_modules package-lock.json
npm install
```

This requirements file ensures all dependencies are properly documented and the project can be set up correctly in any environment.
