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
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import quick actions
import * as QuickActions from 'expo-quick-actions';
import { isQuickActionsSupported, updateQuickActionsWithRecentChats, handleQuickAction, addRecentChat, replaceRecentChats } from '@/utils/quickActions';
import { ChatService } from '@/services/chatService';

// Quick actions logic is centralized in utils/quickActions

import 'react-native-reanimated';

// Prevent the default splash screen from auto-hiding
SplashScreenModule.preventAutoHideAsync();

// Quick actions are defined in utils/quickActions

// isQuickActionsSupported imported from utils/quickActions

// setup handled by updateQuickActionsWithRecentChats from utils

// handleQuickAction imported from utils/quickActions

// Camera handling is done inside ChatRoom via openCamera param

// updateQuickActionsWithRecentChats imported from utils/quickActions

// addRecentChat is provided by utils/quickActions

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [initialIsDark, setInitialIsDark] = useState<boolean | undefined>(undefined);
  const [seededQuickActions, setSeededQuickActions] = useState(false);
  const [pendingQuickAction, setPendingQuickAction] = useState<QuickActions.Action | null>(null);
  const seedingTimerRef = useRef<any>(null);

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

        // Fetch logged-in user UID from storage
        let currentUserUid: string | null = null;
        try {
          const userStr = await AsyncStorage.getItem('user');
          if (userStr) {
            const parsed = JSON.parse(userStr);
            currentUserUid = parsed?.uid ?? null;
          }
        } catch {}
        setUid(currentUserUid);

        if (currentUserUid) {
          // Mark user online at app start
          await UserServiceSimple.updateOnlineStatus(currentUserUid, true);
        }

        // Setup quick actions if supported
        if (isQuickActionsSupported()) {
          await updateQuickActionsWithRecentChats();
        }
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Seed top-3 quick actions from chat list once per app boot
  useEffect(() => {
    if (!appIsReady || !uid || !isQuickActionsSupported() || seededQuickActions) return;

    const unsubscribe = ChatService.subscribeToUserChats(uid, (chats: any[]) => {
      try {
        // Best-effort sort by lastMessageTime desc if present
        const sorted = [...chats].sort((a, b) => {
          const at = (a?.lastMessageTime?.toMillis?.() ?? a?.lastMessageTime?.seconds ?? 0);
          const bt = (b?.lastMessageTime?.toMillis?.() ?? b?.lastMessageTime?.seconds ?? 0);
          return bt - at;
        });

        const top3 = sorted.slice(0, 3);
        (async () => {
          try {
            const prepared: { id: string; name: string; lastMessage?: string; friendUserId: string }[] = [];
            for (const chat of top3) {
              const participants: string[] = chat?.participants || [];
              let friendUserId = participants.find((p) => p !== uid);
              if (!friendUserId && typeof chat?.id === 'string') {
                const [a, b] = chat.id.split('_');
                friendUserId = a === uid ? b : a;
              }
              if (!friendUserId) continue;

              let friendName = chat.name || '';
              try {
                const friendUser = await UserServiceSimple.getUserById(friendUserId);
                if (friendUser?.name) friendName = friendUser.name;
              } catch {}
              prepared.push({
                id: chat.id,
                name: friendName,
                lastMessage: chat.lastMessage || '',
                friendUserId,
              });
            }
            // Atomically replace recents to exactly top N (<=3)
            await replaceRecentChats(prepared);
          } finally {
            // Debounce finalization so we gather multiple rapid snapshots
            if (seedingTimerRef.current) clearTimeout(seedingTimerRef.current);
            seedingTimerRef.current = setTimeout(() => {
              setSeededQuickActions(true);
            }, 1000);
          }
        })();
      } catch {}
    });

    return () => {
      if (seedingTimerRef.current) clearTimeout(seedingTimerRef.current);
      unsubscribe?.();
    };
  }, [appIsReady, uid, seededQuickActions]);

  // Track AppState (foreground/background)
  useEffect(() => {
    if (!uid) return;
  
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        // App came to foreground
        await UserServiceSimple.updateOnlineStatus(uid, true);
        
        // Update quick actions when app comes to foreground
        if (isQuickActionsSupported()) {
          await updateQuickActionsWithRecentChats();
        }
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

  // Handle quick actions
  useEffect(() => {
    if (!isQuickActionsSupported()) return;

    const onQuickAction = (action: QuickActions.Action | null) => {
      if (!action) return;
      if (!appIsReady) {
        setPendingQuickAction(action);
        return;
      }
      handleQuickAction(action);
    };

    // Check if app was launched from a quick action
    if (QuickActions.getInitialQuickAction) {
      QuickActions.getInitialQuickAction()
        .then(onQuickAction)
        .catch(console.error);
    }

    // Listen for quick actions while app is running
    const subscription = QuickActions.addListener(onQuickAction);

    return () => {
      subscription.remove();
    };
  }, [appIsReady]);

  // When app becomes ready, process any pending quick action (cold start case)
  useEffect(() => {
    if (appIsReady && pendingQuickAction) {
      handleQuickAction(pendingQuickAction);
      setPendingQuickAction(null);
    }
  }, [appIsReady, pendingQuickAction]);

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