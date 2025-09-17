import { NavigationProvider } from '@/app/(services)/navigationService';
import { configureGoogleSignIn } from '@/components/googleSignIn';
import { ThemeProvider } from '@/components/ThemeContext';
import { UserProvider } from '@/components/UserContext';
import { LanguageProvider, initializeLanguage, i18n } from '@/i18n';
import '@/i18n/config';
import SplashScreen from '@/screens/Splash/View';
import { UserServiceSimple } from '@/services/userServiceSimple';
import { Stack } from 'expo-router';
import * as SplashScreenModule from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import 'react-native-reanimated';

// Prevent the default splash screen from auto-hiding
SplashScreenModule.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [initialIsDark, setInitialIsDark] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('RootLayout mounted - app starting');
        await configureGoogleSignIn();

        // Ensure language is initialized before rendering UI
        try {
          const lng = await initializeLanguage();
          await i18n.changeLanguage(lng);
        } catch (langErr) {
          console.warn('Language initialization error:', langErr);
        }

        // Load persisted theme preference early so Splash can reflect it
        try {
          const savedTheme = await AsyncStorage.getItem('user_theme_preference');
          if (savedTheme === 'dark') setInitialIsDark(true);
          else if (savedTheme === 'light') setInitialIsDark(false);
          else setInitialIsDark(true); // default
        } catch (e) {
          console.warn('Failed to read theme preference:', e);
          setInitialIsDark(true);
        }

        // Hide native splash so our React splash (which uses Theme/Language) is visible
        try {
          await SplashScreenModule.hideAsync();
        } catch {}

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
      // Native splash is already hidden earlier once theme/language is ready.
      // Keep this as a no-op to avoid flashing.
      return;
    }
  }, [appIsReady]);

  useEffect(() => {
    if (appIsReady) {
      onLayoutRootView();
    }
  }, [appIsReady, onLayoutRootView]);

  if (!appIsReady) {
    // Render providers so Splash can access Theme/Language contexts
    // If theme hasn't been determined yet, keep native splash visible
    if (typeof initialIsDark === 'undefined') {
      return null;
    }
    return (
      <LanguageProvider>
        <NavigationProvider>
          <UserProvider>
            <ThemeProvider initialIsDark={initialIsDark}>
              <SplashScreen />
            </ThemeProvider>
          </UserProvider>
        </NavigationProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <NavigationProvider>
        <UserProvider>
          <ThemeProvider initialIsDark={initialIsDark}>
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
