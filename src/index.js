import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Capacitor initialization
const initializeCapacitor = async () => {
  try {
    // Check if running in Capacitor
    if (window.Capacitor) {
      console.log('Running in Capacitor environment');

      // Initialize Capacitor plugins
      const { Capacitor } = await import('@capacitor/core');
      console.log('Capacitor initialized:', Capacitor.getPlatform());

      // Initialize PWA elements for Capacitor
      if (Capacitor.getPlatform() !== 'web') {
        try {
          const { defineCustomElements } = await import('@ionic/pwa-elements/loader');
          defineCustomElements(window);
        } catch (e) {
          console.warn('PWA elements not available:', e);
        }
      }

      return true;
    }
  } catch (error) {
    console.warn('Capacitor initialization failed:', error);
  }
  return false;
};

// Initialize environment-specific features
const initializeEnvironment = async () => {
  const isCapacitor = await initializeCapacitor();

  // Register service worker only for web environment
  if (!isCapacitor && 'serviceWorker' in navigator) {
    try {
    } catch (error) {
      console.log('Service Worker registration failed:', error);
    }
  } else if (isCapacitor) {
    console.log('Skipping service worker registration - using Capacitor native APIs');
  }
};

// Initialize the app
initializeEnvironment().then(() => {
  console.log('Environment initialization complete');
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

reportWebVitals();
