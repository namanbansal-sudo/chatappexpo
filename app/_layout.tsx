import { NavigationProvider } from '@/app/(services)/navigationService';
import { configureGoogleSignIn } from '@/components/googleSignIn';
import { ThemeProvider } from '@/components/ThemeContext';
import { UserProvider } from '@/components/UserContext';
import { LanguageProvider } from '@/i18n';
import '@/i18n/config';
import SplashScreen from '@/screens/Splash/View';
import { UserServiceSimple } from '@/services/userServiceSimple';
import { Stack } from 'expo-router';
import * as SplashScreenModule from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import 'react-native-reanimated';

// Prevent the default splash screen from auto-hiding
SplashScreenModule.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('RootLayout mounted - app starting');
        await configureGoogleSignIn();

        // TODO: fetch logged-in user UID (from Firebase Auth or your UserContext)
        const currentUserUid = "your-firebase-uid"; 
        setUid(currentUserUid);

        if (currentUserUid) {
          // Mark user online at app start
          await UserServiceSimple.updateOnlineStatus(currentUserUid, true);
        }
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Track AppState (foreground/background)
  useEffect(() => {
    if (!uid) return;
  
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        // App came to foreground
        await UserServiceSimple.updateOnlineStatus(uid, true);
      } else if (nextAppState === "background" || nextAppState === "inactive") {
        // App went to background or became inactive
        await UserServiceSimple.updateOnlineStatus(uid, false);
      }
    });
  
    // Add a beforeunload listener for web (if applicable)
    return () => {
      subscription.remove();
      // Ensure we set offline status when component unmounts (app closes)
      UserServiceSimple.updateOnlineStatus(uid, false).catch(console.error);
    };
  }, [uid]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreenModule.hideAsync();
    }
  }, [appIsReady]);

  useEffect(() => {
    if (appIsReady) {
      onLayoutRootView();
    }
  }, [appIsReady, onLayoutRootView]);

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
