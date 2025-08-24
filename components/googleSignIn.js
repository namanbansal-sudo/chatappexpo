import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

let isConfigured = false;

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: '1033883364384-jlirmds7rkarc7n8lqcsh1mm9fhn8p6a.apps.googleusercontent.com',
    offlineAccess: true,
    forceCodeForRefreshToken: true,
    profileImageSize: 120,
  });
  isConfigured = true;
}

export async function signInWithGoogle() {
  try {
    console.log('🚀 Starting Google Sign-In process...');
    
    if (!isConfigured) {
      configureGoogleSignIn();
    }
    
    // Ensure account chooser is shown by clearing any cached Google account
    try {
      await GoogleSignin.signOut();
      console.log('🧹 Cleared cached Google account');
    } catch (signOutError) {
      console.log('ℹ️ No cached Google account to clear:', signOutError.message);
    }
    
    // Optional: fully disconnect to force consent/account selection when needed
    try {
      await GoogleSignin.revokeAccess();
      console.log('🔓 Revoked previous Google access');
    } catch (revokeError) {
      console.log('ℹ️ No previous Google access to revoke:', revokeError.message);
    }
    
    // Start the Google Sign-In process
    console.log('📱 Launching Google Sign-In UI...');
    const result = await GoogleSignin.signIn();
    
    if (!result || !result.data) {
      throw new Error('Google Sign-In was cancelled or failed');
    }
    
    const idToken = result.data?.idToken;
    if (!idToken) {
      throw new Error('Failed to get ID token from Google Sign-In');
    }
    
    console.log('✅ Google Sign-In successful, got ID token');
    
    // Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    
    // Sign-in with credential
    console.log('🔥 Signing in with Firebase...');
    const firebaseResult = await auth().signInWithCredential(googleCredential);
    
    console.log('✅ Firebase sign-in successful');
    return firebaseResult;
    
  } catch (error) {
    console.error('❌ Google Sign-In Error:', error);
    
    // Provide user-friendly error messages
    if (error.code === 'auth/account-exists-with-different-credential') {
      throw new Error('An account already exists with this email using a different sign-in method.');
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error('The credential is invalid. Please try again.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Google sign-in is not enabled for this app.');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('Your account has been disabled.');
    } else if (error.message?.includes('SIGN_IN_CANCELLED')) {
      throw new Error('Sign-in was cancelled.');
    } else if (error.message?.includes('NETWORK_ERROR')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw error;
  }
}

export async function signOutGoogle() {
  try {
    if (!isConfigured) {
      configureGoogleSignIn();
    }
    
    // Sign out from Google SDK first (this can always be called)
    try {
      await GoogleSignin.signOut();
      console.log('✅ Google SDK sign out successful');
    } catch (googleError) {
      console.warn('⚠️ Google SDK sign out failed:', googleError.message);
      // Continue anyway, this might fail if user wasn't signed in through Google
    }
    
    // Sign out from Firebase Auth only if there's a current user
    const currentUser = auth().currentUser;
    if (currentUser) {
      await auth().signOut();
      console.log('✅ Firebase auth sign out successful');
    } else {
      console.log('ℹ️ No current Firebase user to sign out');
    }
    
  } catch (error) {
    console.error('❌ Sign-out error:', error);
    // Don't throw the error - allow logout to continue
    // The important part is clearing local data
  }
}
