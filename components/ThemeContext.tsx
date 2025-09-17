import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const lightTheme = {
  colors: {
    primary: '#0D9488', // Teal 600
    primaryDark: '#0F766E', // Teal 700
    background: '#FFFFFF',
    surface: '#F5F5F5',
    card: '#FFFFFF',
    border: '#E0E0E0',
    shadow: '#000000',
    text: '#000000',
    secondaryText: '#808080',
    inputBackground: '#F0F0F0',
    fab: '#0D9488', // Teal 600
    fabIcon: '#FFFFFF',
    tabBackground: '#FFFFFF',
  },
  fonts: {
    sizes: {
      large: 32,
      title: 24,
      regular: 16,
      small: 14,
    },
    weights: {
      bold: 'bold',
      normal: 'normal',
    },
  },
};

const darkTheme = {
  colors: {
    primary: '#0D9488', // Teal 600
    primaryDark: '#0F766E', // Teal 700
    background: '#000000',
    surface: '#1A1A1A',
    card: '#1E1E1E',
    border: '#333333',
    shadow: '#000000',
    text: '#FFFFFF',
    secondaryText: '#B0B0B0',
    inputBackground: '#333333',
    fab: '#0D9488', // Teal 600
    fabIcon: '#FFFFFF',
    tabBackground: '#1A1A1A',
  },
  fonts: {
    sizes: {
      large: 32,
      title: 24,
      regular: 16,
      small: 14,
    },
    weights: {
      bold: 'bold',
      normal: 'normal',
    },
  },
};

export const ThemeContext = createContext({
  theme: darkTheme,
  toggleTheme: () => {},
  isDark: true,
});

export const ThemeProvider = ({ children, initialIsDark }: { children: React.ReactNode, initialIsDark?: boolean }) => {
  const [isDark, setIsDark] = useState(initialIsDark ?? true);
  const THEME_STORAGE_KEY = 'user_theme_preference';

  // Load persisted theme preference on mount (skip if initialIsDark provided)
  useEffect(() => {
    if (typeof initialIsDark === 'boolean') return;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark') {
          setIsDark(true);
        } else if (saved === 'light') {
          setIsDark(false);
        } else if (saved === 'true' || saved === 'false') {
          // Backward compatibility if boolean string was stored
          setIsDark(saved === 'true');
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    })();
  }, [initialIsDark]);

  // Sync with initialIsDark prop updates (from root loader) to prevent flicker
  useEffect(() => {
    if (typeof initialIsDark === 'boolean') {
      setIsDark(initialIsDark);
    }
  }, [initialIsDark]);
  
  const theme = useMemo(() => isDark ? darkTheme : lightTheme, [isDark]);
  
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch((e) =>
        console.warn('Failed to persist theme preference:', e)
      );
      return next;
    });
  }, []);
  
  const value = useMemo(() => ({
    theme,
    toggleTheme,
    isDark
  }), [theme, toggleTheme, isDark]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
