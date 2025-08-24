import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation files
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import es from '../locales/es.json';
import zh from '../locales/zh.json';

// Storage key for persisting language preference
const LANGUAGE_STORAGE_KEY = 'user_language_preference';

// Available languages
export const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

// Get device locale
const getDeviceLocale = (): string => {
  const deviceLocales = Localization.getLocales();
  const primaryLocale = deviceLocales[0]?.languageCode || 'en';
  
  // Check if device language is supported
  if (AVAILABLE_LANGUAGES.some(lang => lang.code === primaryLocale)) {
    return primaryLocale;
  }
  
  return 'en'; // Default fallback
};

// Initialize language from storage or device locale
export const initializeLanguage = async (): Promise<string> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && AVAILABLE_LANGUAGES.some(lang => lang.code === savedLanguage)) {
      return savedLanguage;
    }
    
    // Use device locale if no saved preference
    return getDeviceLocale();
  } catch (error) {
    console.error('Error initializing language:', error);
    return 'en';
  }
};

// Initialize i18next
const initI18n = async () => {
  const savedLanguage = await initializeLanguage();
  
  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        hi: { translation: hi },
        es: { translation: es },
        zh: { translation: zh },
      },
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
};

// Change language function
export const changeLanguage = async (languageCode: string): Promise<void> => {
  try {
    if (AVAILABLE_LANGUAGES.some(lang => lang.code === languageCode)) {
      await i18n.changeLanguage(languageCode);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    }
  } catch (error) {
    console.error('Error changing language:', error);
  }
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

// Initialize i18n
initI18n();

// Export i18n instance
export default i18n;
