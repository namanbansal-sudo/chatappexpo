import '@testing-library/jest-native/extend-expect';

// ----------------------
// React Navigation
// ----------------------
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
      name: 'TestScreen',
    }),
    useFocusEffect: jest.fn(),
  };
});

// ----------------------
// Expo modules (all are default exports → export empty object as default)
// ----------------------
jest.mock('expo-font', () => ({ __esModule: true, default: {} }));
jest.mock('expo-asset', () => ({ __esModule: true, default: {} }));
jest.mock('expo-av', () => ({ __esModule: true, default: {} }));
jest.mock('expo-image-picker', () => ({ __esModule: true, default: {} }));
jest.mock('expo-file-system', () => ({ __esModule: true, default: {} }));
jest.mock('expo-linear-gradient', () => ({ __esModule: true, default: {} }));

// ----------------------
// Firebase modules (all are default exports → export empty object as default)
// ----------------------
jest.mock('@react-native-firebase/auth', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-firebase/app', () => ({ __esModule: true, default: {} }));

// ----------------------
// AsyncStorage (default export is an object with methods)
// ----------------------
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

// ----------------------
// Reanimated (default export)
// ----------------------
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// ----------------------
// Gesture handler (default export)
// ----------------------
jest.mock('react-native-gesture-handler', () => ({ __esModule: true, default: {} }));

// ----------------------
// Safe area context (named + default exports)
// ----------------------
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    __esModule: true,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
