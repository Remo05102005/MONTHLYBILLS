// API Keys Configuration
export const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('REACT_APP_GEMINI_API_KEY is not set. Please set it in your .env file or Netlify environment variables.');
}

// Instructions for setting up the AP
// I key:
// 1. Get your Gemini API key from: https://makersuite.google.com/app/apikey
// 2. Create a .env file in the root directory
// 3. Add: REACT_APP_GEMINI_API_KEY=your_actual_api_key_here
// 4. For production (Netlify), add the environment variable in Netlify dashboard
// 5. Restart the development server.

export default {
  GEMINI_API_KEY,
};
