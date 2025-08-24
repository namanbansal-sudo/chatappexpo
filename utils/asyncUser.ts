// utils/asyncUser.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'APP_USER';

export const saveUser = async (user: any) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save user:', e);
  }
};

export const getUser = async () => {
  try {
    const userStr = await AsyncStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error('Failed to get user:', e);
    return null;
  }
};

export const removeUser = async () => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error('Failed to remove user:', e);
  }
};
