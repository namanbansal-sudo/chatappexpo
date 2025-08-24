// Main i18n exports
export { default as i18n } from './config';
export { 
  AVAILABLE_LANGUAGES, 
  changeLanguage, 
  getCurrentLanguage, 
  initializeLanguage 
} from './config';
export { 
  LanguageProvider, 
  useLanguage 
} from './context/LanguageContext';
export type { default as LanguageContext } from './context/LanguageContext';
