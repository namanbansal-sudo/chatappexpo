import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/models';
// import { UserService } from '../services/userService';
import { UserServiceSimple } from '../services/userServiceSimple';
import { ServiceInitializer } from '../services/serviceInitializer';

// Extended user type for authentication data
interface AuthUser extends User {
  displayName?: string;
  photoURL?: string;
  friends?: string[];
}

interface UserContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  loading: boolean;
  saveUserToStorage: (userData: AuthUser) => Promise<void>;
  clearUserFromStorage: () => Promise<void>;
  updateUserOnlineStatus: (isOnline: boolean) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: (_user: AuthUser | null) => {},
  loading: true,
  saveUserToStorage: async (_userData: AuthUser) => {},
  clearUserFromStorage: async () => {},
  updateUserOnlineStatus: async (_isOnline: boolean) => {},
  refreshUserData: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from AsyncStorage on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Initialize Firebase services first
        await ServiceInitializer.initializeAll();
        
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const userData = JSON.parse(userStr) as AuthUser;
          setUser(userData);
          
          // Verify user exists in Firestore and update online status
          if (userData.uid) {
            try {
              console.log('🔍 UserContext DEBUG: Verifying user exists in Firestore:', userData.uid);
              // Use simple service to avoid exists check issues
              console.log('✅ UserContext DEBUG: Ensuring user exists and updating online status');
              await UserServiceSimple.createOrUpdateUser({
                uid: userData.uid,
                name: userData.name || userData.displayName || 'Anonymous',
                email: userData.email || '',
                photoURL: userData.photo || '',
                displayName: userData.displayName || userData.name || 'Anonymous'
              });
              console.log('✅ UserContext DEBUG: User ensured and online status updated');
              
            } catch (error) {
              console.error('❌ UserContext DEBUG: Failed to verify/update user:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const saveUserToStorage = async (userData: AuthUser) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Failed to save user to storage:', error);
    }
  };

  const clearUserFromStorage = async () => {
    try {
      if (user?.uid) {
        await UserServiceSimple.updateOnlineStatus(user.uid, false);
      }
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Failed to clear user from storage:', error);
    }
  };

  const updateUserOnlineStatus = async (isOnline: boolean) => {
    if (user?.uid) {
      try {
        await UserServiceSimple.updateOnlineStatus(user.uid, isOnline);
        setUser(prev => prev ? { ...prev, isOnline } : null);
      } catch (error) {
        console.error('Failed to update online status:', error);
      }
    }
  };

  const refreshUserData = async () => {
    if (user?.uid) {
      try {
        const updatedUser = await UserServiceSimple.getUserById(user.uid);
        if (updatedUser) {
          const mergedUser = { ...user, ...updatedUser };
          setUser(mergedUser);
          await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      loading, 
      saveUserToStorage, 
      clearUserFromStorage,
      updateUserOnlineStatus,
      refreshUserData
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
