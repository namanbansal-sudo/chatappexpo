import { useNavigateToChat } from '@/app/(services)/navigationService';
import { CustomText } from '@/components/customText';
import { configureGoogleSignIn, signInWithGoogle, signOutGoogle } from '@/components/googleSignIn';
import { getText } from '@/components/texts';
import { useThemeContext } from '@/components/ThemeContext';
import { useUser } from '@/components/UserContext';
import { UserService } from '@/services/userService';
import { UserServiceSimple } from '@/services/userServiceSimple';
import { ChatService } from '@/services/chatService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, setDoc } from '@react-native-firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from './Styles';

export const LoginScreen: React.FC = () => {
  const { theme } = useThemeContext();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const navigateToChat = useNavigateToChat();
  const { saveUserToStorage } = useUser();

  console.log('user', user);

  useEffect(() => {
    configureGoogleSignIn();
    // Clear any cached account to force chooser next time
    (async () => {
      try {
        await signOutGoogle();
      } catch {}
    })();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      console.log('🔍 DEBUG: Starting Google Sign-in process');
      setLoading(true);
      const userCredential = await signInWithGoogle();
      console.log('✅ DEBUG: Google Auth completed successfully');
      console.log('Signed in user:', userCredential.user);
      const userData = userCredential.user;

      // Initialize collections (user-scoped)
      console.log('🔍 DEBUG: Initializing collections...');
      try {
        await ChatService.initializeCollections(userData.uid);
        console.log('✅ DEBUG: Collections initialized successfully');
      } catch (collectionError) {
        console.error('❌ DEBUG: Error initializing collections:', collectionError);
      }
      
      // Create or update user using the UserService
      console.log('🔍 DEBUG: Creating/updating user document...');
      try {
        const user = await UserServiceSimple.createOrUpdateUser({
          uid: userData.uid,
          name: userData.displayName || 'Anonymous',
          email: userData.email || '',
          photoURL: userData.photoURL || '',
          displayName: userData.displayName || 'Anonymous'
        });
        console.log('✅ DEBUG: User document created/updated successfully');

        // Save user data via UserContext to keep in-memory context in sync
        console.log('🔍 DEBUG: Saving user to UserContext...');
        await saveUserToStorage({
          uid: user.uid,
          name: user.name,
          email: user.email,
          photo: user.photo,
          designation: user.designation,
          isOnline: true,
          displayName: userData.displayName || user.name,
          photoURL: userData.photoURL || user.photo,
          friends: user.friends || [],
        } as any);
        console.log('✅ DEBUG: User saved to UserContext and storage successfully');
        
        // Verify the save
        const savedUser = await AsyncStorage.getItem('user');
        console.log('Verified saved user:', JSON.parse(savedUser || '{}'));
        
        console.log('🔍 DEBUG: Navigating to chat...');
        navigateToChat();
        console.log('✅ DEBUG: Sign-in process completed successfully');
      } catch (userError) {
        console.error('❌ DEBUG: Error in user creation/AsyncStorage:', userError);
        throw userError;
      }
    } catch (error: any) {
      console.error('❌ DEBUG: Overall Google Sign-In Error:', error);
      console.error('❌ DEBUG: Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      Alert.alert('Sign-In Failed', error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      if (user) {
        const userDocRef = doc(getFirestore(), 'users', (user as any).uid);
        await setDoc(userDocRef, { isOnline: false }, { merge: true });
      }
      await signOutGoogle();
      setUser(null);
    } catch (error: any) {
      console.error('Sign-Out Error:', error);
      Alert.alert('Sign-Out Failed', error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CustomText
        fontSize={theme.fonts.sizes.large}
        color={theme.colors.primary}
        fontWeight="bold"
        style={styles.logo}
      >
        {getText('appName')}
      </CustomText>
      <CustomText
        fontSize={theme.fonts.sizes.title}
        color={theme.colors.secondaryText}
        style={styles.title}
      >
        {getText('signInTitle')}
      </CustomText>
      {loading ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.inputBackground + 'CC', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <>
          <TouchableOpacity onPress={handleGoogleSignIn} style={styles.googleButton}>
            <Image
              source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
              style={styles.googleIcon}
            />
            <CustomText color={theme.colors.text} style={styles.googleText}>
              Sign in with Google
            </CustomText>
          </TouchableOpacity>
          {user && (
            <TouchableOpacity onPress={handleSignOut} style={[styles.googleButton, { marginTop: 10 }]}>
              <CustomText color={theme.colors.text} style={styles.googleText}>
                Sign Out
              </CustomText>
            </TouchableOpacity>
          )}
        </>
      )}
    </SafeAreaView>
  );
};