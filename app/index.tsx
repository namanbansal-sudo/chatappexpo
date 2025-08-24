import React from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from '@/screens/Splash/View';
import * as ExpoSplashScreen from 'expo-splash-screen';

// Keep the native splash screen visible while we're loading
ExpoSplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCustomSplash, setShowCustomSplash] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        // Hide the native splash screen
        await ExpoSplashScreen.hideAsync();
        
        // Show custom splash for 2 seconds
        setTimeout(() => {
          setShowCustomSplash(false);
        }, 2000);
        
        // Check authentication status
        const saved = await AsyncStorage.getItem('user');
        setIsAuthenticated(!!saved);
        
        // After a delay, hide loading
        setTimeout(() => {
          setIsLoading(false);
        }, 2500); // Slightly longer than custom splash
        
      } catch (e) {
        console.error('Error initializing app:', e);
        setIsAuthenticated(false);
        setIsLoading(false);
        setShowCustomSplash(false);
      }
    };

    initializeApp();
  }, []);

  // Show custom splash screen
  if (showCustomSplash) {
    return <SplashScreen />;
  }

  // Show loading state
  if (isLoading) {
    return <SplashScreen />;
  }

  // Redirect to appropriate screen
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(screens)/login'} />;
}
