import React from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [ready, setReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('user');
        setIsAuthenticated(!!saved);
      } catch (e) {
        console.error('Error reading auth state:', e);
        setIsAuthenticated(false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Root layout controls the splash; no UI here until ready
  if (!ready) return null;

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(screens)/login'} />;
}
