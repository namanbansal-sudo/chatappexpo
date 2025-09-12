import '@testing-library/jest-native/extend-expect';

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// Mock Expo modules
jest.mock('expo-font');
jest.mock('expo-asset');
jest.mock('expo-av');
jest.mock('expo-image-picker');
jest.mock('expo-file-system');

// Mock Firebase
jest.mock('@react-native-firebase/auth', () => ());
jest.mock('@react-native-firebase/firestore', () => ());
jest.mock('@react-native-firebase/app', () => ());

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock Google Signin
jest.mock('@react-native-google-signin/google-signin', () => ());

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}));

// Mock your custom services
jest.mock('./services/chatService');
jest.mock('./services/userServiceSimple');
jest.mock('./services/friendRequestService');