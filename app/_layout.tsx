import { NavigationProvider } from '@/app/(services)/navigationService';
import { configureGoogleSignIn } from '@/components/googleSignIn';
import { ThemeProvider } from '@/components/ThemeContext';
import { UserProvider } from '@/components/UserContext';
import { LanguageProvider } from '@/i18n';
import '@/i18n/config'; // Initialize i18n
import SplashScreen from '@/screens/Splash/View';
import { Stack } from 'expo-router';
import * as SplashScreenModule from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import 'react-native-reanimated';

// Prevent the default splash screen from auto-hiding
SplashScreenModule.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('RootLayout mounted - app starting');
        // Configure Google Sign-In or other async initialization
        await configureGoogleSignIn();
        // Add other async tasks here (e.g., Firebase initialization)
        // Example: await initializeFirebase();
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        // Mark app as ready even if there's an error
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Hide the splash screen when app is ready
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide the default splash screen
      await SplashScreenModule.hideAsync();
    }
  }, [appIsReady]);

  useEffect(() => {
    if (appIsReady) {
      onLayoutRootView();
    }
  }, [appIsReady, onLayoutRootView]);

  // Render custom splash screen until app is ready
  if (!appIsReady) {
    return <SplashScreen />;
  }

  return (
    <LanguageProvider>
      <NavigationProvider>
        <UserProvider>
          <ThemeProvider>
            <Stack initialRouteName="(screens)" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(screens)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </ThemeProvider>
        </UserProvider>
      </NavigationProvider>
    </LanguageProvider>
  );
}