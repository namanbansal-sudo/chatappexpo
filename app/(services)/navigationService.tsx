import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { useCallback, createContext, useContext, ReactNode, useEffect } from 'react';

// Navigation context for sharing navigation state
interface NavigationContextType {
  navigate: (route: string, params?: any) => void;
  replace: (route: string, params?: any) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  navigateToTab: (tabName: string) => void;
  navigateToScreen: (screenName: string, params?: any) => void;
  reset: (route: string) => void;
  getCurrentRoute: () => string | undefined;
  getParams: () => any;
  router: any;
  navigation: any;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Navigation provider component
export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    console.log('NavigationProvider mounted - router:', !!router, 'navigation:', !!navigation);
  }, [router, navigation]);

  const navigate = useCallback((route: string, params?: any) => {
    console.log('NavigationService - navigate called with route:', route);
    if (router) {
      console.log('NavigationService - router exists, calling push');
      router.push({ pathname: route as any, params });
    } else {
      console.log('NavigationService - router is undefined');
    }
  }, [router]);

  const replace = useCallback((route: string, params?: any) => {
    console.log('NavigationService - replace called with route:', route);
    if (router) {
      console.log('NavigationService - router exists, calling replace');
      router.replace({ pathname: route as any, params });
    } else {
      console.log('NavigationService - router is undefined');
    }
  }, [router]);

  const goBack = useCallback(() => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (router) {
      router.back();
    }
  }, [navigation, router]);

  const canGoBack = useCallback(() => {
    return navigation?.canGoBack() || false;
  }, [navigation]);

  const navigateToTab = useCallback((tabName: string) => {
    navigate(`/(tabs)/${tabName}`);
  }, [navigate]);

  const navigateToScreen = useCallback((screenName: string, params?: any) => {
    navigate(`/(screens)/${screenName}`, params);
  }, [navigate]);

  const reset = useCallback((route: string) => {
    if (router) {
      router.replace(route as any);
    }
  }, [router]);

  const getCurrentRoute = useCallback(() => {
    // Note: getCurrentRoute is not available in expo-router
    // You can use usePathname() hook instead if needed
    return undefined;
  }, []);

  const getParams = useCallback(() => {
    // Note: getCurrentRoute is not available in expo-router
    // You can use useLocalSearchParams() hook instead if needed
    return {};
  }, []);

  const value: NavigationContextType = {
    navigate,
    replace,
    goBack,
    canGoBack,
    navigateToTab,
    navigateToScreen,
    reset,
    getCurrentRoute,
    getParams,
    router,
    navigation,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

// Hook for using navigation service
export const useNavigationService = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationService must be used within a NavigationProvider');
  }
  return context;
};

// Hook for getting search params
export const useSearchParams = () => {
  return useLocalSearchParams();
};

// Hook for getting route params
export const useRouteParams = () => {
  return useLocalSearchParams();
};

// Predefined navigation routes
export const ROUTES = {
  // Screens
  LOGIN: '/(screens)/login',
  CHATROOM: '/(screens)/chatroom',
  NOT_FOUND: '+not-found',
  
  // Tabs
  HOME: '/(tabs)',
  CHAT: '/(tabs)',
  REQUEST: '/(tabs)/request',
  SETTING: '/(tabs)/setting',
  
  // Dynamic routes
  CHAT_ROOM: (roomId: string) => `/(tabs)/chat/${roomId}`,
  USER_PROFILE: (userId: string) => `/(tabs)/profile/${userId}`,
} as const;

// Debug: Log the routes to see their values
console.log('NavigationService - ROUTES loaded:', ROUTES);
console.log('NavigationService - ROUTES.CHAT value:', ROUTES.CHAT);

// Navigation types
export type RouteName = keyof typeof ROUTES;
export type TabRoute = 'index' | 'request' | 'setting';

// Utility functions for common navigation patterns (these now use the hook internally)
export const useNavigateToLogin = () => {
  const { navigate } = useNavigationService();
  return useCallback((params?: any) => {
    navigate(ROUTES.LOGIN, params);
  }, [navigate]);
};

export const useNavigateToHome = () => {
  const { navigate } = useNavigationService();
  return useCallback((params?: any) => {
    navigate(ROUTES.HOME, params);
  }, [navigate]);
};

export const useNavigateToChat = () => {
  const { replace } = useNavigationService();
  return useCallback((params?: any) => {
    console.log('useNavigateToChat - calling replace with ROUTES.CHAT:', ROUTES.CHAT);
    replace(ROUTES.CHAT, params);
  }, [replace]);
};

export const useNavigateToRequest = () => {
  const { navigate } = useNavigationService();
  return useCallback((params?: any) => {
    navigate(ROUTES.REQUEST, params);
  }, [navigate]);
};

export const useNavigateToSetting = () => {
  const { navigate } = useNavigationService();
  return useCallback((params?: any) => {
    navigate(ROUTES.SETTING, params);
  }, [navigate]);
};

export const useNavigateToTab = () => {
  const { navigateToTab } = useNavigationService();
  return useCallback((tabName: TabRoute) => {
    navigateToTab(tabName);
  }, [navigateToTab]);
};

export const useGoBack = () => {
  const { goBack } = useNavigationService();
  return useCallback(() => {
    goBack();
  }, [goBack]);
};

export const useCanGoBack = () => {
  const { canGoBack } = useNavigationService();
  return useCallback(() => {
    return canGoBack();
  }, [canGoBack]);
};

// Legacy utility functions for backward compatibility (these will work if used within NavigationProvider)
export const navigateToLogin = (params?: any) => {
  // This will only work if called from within a component that uses NavigationProvider
  console.warn('navigateToLogin should be used with useNavigateToLogin hook instead');
};

export const navigateToHome = (params?: any) => {
  console.warn('navigateToHome should be used with useNavigateToHome hook instead');
};

export const navigateToChat = (params?: any) => {
  console.warn('navigateToChat should be used with useNavigateToChat hook instead');
};

export const navigateToRequest = (params?: any) => {
  console.warn('navigateToRequest should be used with useNavigateToRequest hook instead');
};

export const navigateToSetting = (params?: any) => {
  console.warn('navigateToSetting should be used with useNavigateToSetting hook instead');
};

export const navigateToTab = (tabName: TabRoute) => {
  console.warn('navigateToTab should be used with useNavigateToTab hook instead');
};

export const goBack = () => {
  console.warn('goBack should be used with useGoBack hook instead');
};

export const canGoBack = () => {
  console.warn('canGoBack should be used with useCanGoBack hook instead');
};
