import React, { useContext, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/auth/PrivateRoute';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ForgotPassword from './components/auth/ForgotPassword';
import ChangePassword from './components/auth/ChangePassword';
import { ThemeProvider, ThemeContext } from './contexts/ThemeContext';

// Components
import Layout from './components/Layout';
// Home is the app's default landing route, so it's kept in the main bundle
// (no lazy-loading flicker on first paint). Every other route is loaded on
// demand — several of them (Weight in particular) statically pull in heavy
// libraries like html2canvas/jsPDF that a Home-page visit should never have
// to download.
import Home from './pages/Home';
const Profile = lazy(() => import('./pages/Profile'));
const SharedConversation = lazy(() => import('./pages/SharedConversation'));
const SubbaraoTimeline = lazy(() => import('./pages/SubbaraoTimeline'));
const TodoList = lazy(() => import('./pages/TodoList'));
const Weight = lazy(() => import('./pages/Weight'));

function AppContent() {
  const { mode } = useContext(ThemeContext);
  const theme = React.useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#dc004e',
        light: '#ff4081',
        dark: '#c51162',
        contrastText: '#ffffff',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#f5f5f5',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
      text: {
        primary: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)',
        secondary: mode === 'dark' ? '#aaa' : 'rgba(0, 0, 0, 0.6)',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    typography: {
      h1: { fontWeight: 600 },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
  }), [mode]);

  const routeFallback = (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Suspense fallback={routeFallback}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/shared-conversation" element={<SharedConversation />} />

            {/* Protected Routes with Layout */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/todo"
              element={
                <PrivateRoute>
                  <Layout>
                    <TodoList />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/weight"
              element={
                <PrivateRoute>
                  <Layout>
                    <Weight />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/change-password"
              element={
                <PrivateRoute>
                  <Layout>
                    <ChangePassword />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/subbarao/timeline"
              element={
                <PrivateRoute>
                  <Layout>
                    <SubbaraoTimeline />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/chat/timeline"
              element={
                <PrivateRoute>
                  <Layout>
                    <SubbaraoTimeline />
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </MuiThemeProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
