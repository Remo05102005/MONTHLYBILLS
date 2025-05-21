import React, { createContext, useState, useMemo } from 'react';

export const ThemeContext = createContext({
  mode: 'light',
  setMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState('light');

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 