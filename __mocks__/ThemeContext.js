import React from 'react';

export const useThemeContext = () => ({
  theme: {
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
    },
  },
});

export const ThemeProvider = ({ children }) => children;