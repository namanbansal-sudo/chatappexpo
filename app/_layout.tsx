import { ThemeProvider } from '@/components/ThemeContext';
import { UserProvider } from '@/components/UserContext';
import { LanguageProvider } from '@/i18n';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { NavigationProvider } from '@/app/(services)/navigationService';
import { configureGoogleSignIn } from '@/components/googleSignIn';
import '@/i18n/config'; // Initialize i18n

export default function RootLayout() {

  // const colorScheme = useColorScheme();
  // const [loaded] = useFonts({
  //   SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  // });

  // if (!loaded) {
  //   // Async font loading only occurs in development.
  //   return null;
  // }

  useEffect(() => {
    console.log('RootLayout mounted - app starting');
    // Ensure Google Sign-In is configured once at app start
    try { configureGoogleSignIn(); } catch {}
  }, []);
  

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
