# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a React Native chat application built with Expo and Firebase. The app features real-time messaging, Google authentication, user management, and friend requests, using TypeScript and modern React patterns.

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Start for specific platforms
npm run android          # Android device/emulator
npm run ios             # iOS simulator
npm run web             # Web browser

# Reset project (removes current app and creates blank slate)
npm run reset-project
```

### Code Quality & Building
```bash
# Linting
npm run lint            # ESLint with Expo config

# Build for different environments
eas build --platform android --profile development
eas build --platform android --profile preview
eas build --platform android --profile production
```

## High-Level Architecture

### Expo Router File-Based Routing
The app uses Expo Router v5 with file-based routing for navigation:
- `app/index.tsx` - Root redirects to login screen
- `app/(screens)/` - Authentication and main screens (login, chatroom)
- `app/(tabs)/` - Tab-based navigation screens (request, settings)
- Route groups use parentheses `()` to organize without affecting URL structure

### Firebase Integration Stack
- **Authentication**: Firebase Auth with Google Sign-in integration
- **Database**: Firestore for real-time chat messages and user data
- **Configuration**: 
  - `google-services.json` for Android
  - `GoogleService-Info.plist` for iOS
  - Firebase v9 modular SDK

### Component Architecture
Uses a view-model pattern with custom hooks:
- **ViewModels**: `useChatViewModel`, `useRequestViewModel`, `useProfileViewModel`
- **Context**: `UserContext` for global user state, `ThemeContext` for theming
- **Custom Components**: Reusable UI components with consistent styling

### Key Architectural Patterns
- **Context Providers**: Global state management for user authentication and theming
- **Custom Hooks**: Business logic abstraction in `components/` directory
- **Service Layer**: Firebase operations centralized in `(services)/navigationService.tsx`
- **Component Composition**: Reusable UI components (customButton, customInput, etc.)

## Important Configuration Files

### Firebase Setup
- `app.json` - Expo configuration with Firebase plugins
- `google-services.json` - Android Firebase configuration  
- `GoogleService-Info.plist` - iOS Firebase configuration
- Google Sign-in Web Client ID configured in `components/googleSignIn.js`

### Build Configuration
- `eas.json` - EAS Build configuration with development/preview/production profiles
- `package.json` - React Native 0.79.5, Expo SDK 53, React 19.0.0
- TypeScript support with `tsconfig.json`

## Development Workflow

### Authentication Flow
1. App starts → redirects to `/(screens)/login`
2. Google Sign-in → Firebase Authentication
3. User context populated → Navigate to main app tabs
4. Persistent session management with AsyncStorage

### Chat Architecture
- Real-time messaging via Firestore listeners
- Message state managed through `useChatViewModel`
- Custom chat components for message rendering
- File/media support through Expo APIs

### State Management Pattern
- React Context for global state (user, theme)
- Custom hooks for component-level state and business logic
- Firebase real-time subscriptions for data synchronization

### Testing Development
- Use Expo Go for quick iteration
- Development builds for Firebase testing
- EAS Build for production-ready testing

### Common Development Tasks
- Firebase configuration changes require rebuilding development clients
- Google Sign-in testing requires proper SHA fingerprints in Firebase console
- Real-time features need Firestore security rules configuration
- Asset management through `assets/` directory structure

## Platform-Specific Notes

### Android
- Requires `google-services.json` in root directory
- Package name: `com.naman_bitcot.chatappexpo`
- Edge-to-edge display enabled
- Adaptive icon configuration

### iOS  
- Bundle identifier: `com.naman-bitcot.chatappexpo`
- Requires `GoogleService-Info.plist`
- Google Sign-in URL schemes configured

### Web
- Metro bundler with static output
- Limited Firebase functionality compared to native platforms
