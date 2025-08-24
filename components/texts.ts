// locales/localization.ts
export const isHindi = false; // Set to true for Hindi, false for English

export const texts = {
  en: {
    appName: 'ChatsUpp',
    signInTitle: 'Sign in to your account',
    phoneNumber: 'Phone Number',
    rememberMe: 'Remember me',
    signIn: 'Sign in',
    noAccount: "Don't have an account?",
    signUp: 'Sign Up',
    searchPlaceholder: 'Search...',
    allTab: 'All',
    unreadTab: 'Unread',
    favoritesTab: 'Favorites',
    groupsTab: 'Groups',
    noChatsTitle: "You haven't Chat yet",
    noChatsSubtitle: 'Start messaging by tapping the pencil button in the right corner.',
    messages: 'Messages',
    contacts: 'Contacts',
    profile: 'Profile',
  },
  hi: {
    appName: 'चैटसप्',
    signInTitle: 'अपने खाते में साइन इन करें',
    phoneNumber: 'फ़ोन नंबर',
    rememberMe: 'मुझे याद रखें',
    signIn: 'साइन इन',
    noAccount: 'खाता नहीं है?',
    signUp: 'साइन अप',
    searchPlaceholder: 'खोज...',
    allTab: 'सभी',
    unreadTab: 'अपठित',
    favoritesTab: 'पसंदीदा',
    groupsTab: 'समूह',
    noChatsTitle: 'आपने अभी तक चैट नहीं की है',
    noChatsSubtitle: 'दाएं कोने में पेंसिल बटन टैप करके मैसेजिंग शुरू करें।',
    messages: 'संदेश',
    contacts: 'संपर्क',
    profile: 'प्रोफ़ाइल',
  },
};

export function getText(key: keyof typeof texts.en): string {
  return isHindi ? texts.hi[key] : texts.en[key];
}