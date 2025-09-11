import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc
} from '@react-native-firebase/firestore';
import { User } from '../types/models';

const USERS = 'users';

export const UserServiceSimple = {
  async createOrUpdateUser(user: {
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
    displayName?: string;
  }): Promise<User> {
    try {
      const { uid, name, email, photoURL } = user;
      const db = getFirestore();
      const userRef = doc(db, USERS, uid);
      const now = serverTimestamp();
      
      // Add proper error handling for getDoc
      let docSnap;
      try {
        docSnap = await getDoc(userRef);
      } catch (error) {
        console.error('Error getting user document:', error);
        // If getDoc fails, assume document doesn't exist and create new one
        docSnap = { exists: () => false };
      }

      const data: Partial<User> = {
        uid,
        name,
        email,
        photo: photoURL || '',
        designation: 'User',
        isOnline: true,
        lastSeen: now,
      };

      const documentExists = docSnap && docSnap.exists ? docSnap.exists() : false;
      
      if (documentExists) {
        await updateDoc(userRef, {
          ...data,
          nameLower: name.toLowerCase(),
          emailLower: email.toLowerCase(),
        });
      } else {
        await setDoc(userRef, {
          ...data,
          friends: [],
          createdAt: now,
          nameLower: name.toLowerCase(),
          emailLower: email.toLowerCase(),
        } as User);
      }

      // Get the saved document with error handling
      let saved;
      try {
        saved = await getDoc(userRef);
      } catch (error) {
        console.error('Error fetching saved user:', error);
        // Return the data we tried to save as fallback
        return { ...data, uid, friends: [], createdAt: now } as User;
      }
      
      return saved.exists() ? (saved.data() as User) : ({ ...data, uid, friends: [], createdAt: now } as User);
    } catch (error) {
      console.error('Error in createOrUpdateUser:', error);
      throw error;
    }
  },

  async getUserById(uid: string): Promise<User | null> {
    try {
      const db = getFirestore();
      const docRef = doc(db, USERS, uid);
      const docSnap = await getDoc(docRef);
      
      // Add null check before calling exists()
      return docSnap && docSnap.exists ? (docSnap.data() as User) : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  },

  async updateOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
    try {
      const db = getFirestore();
      const userRef = doc(db, USERS, uid);
      
      // Verify the document exists before updating
      const docSnap = await getDoc(userRef);
      if (docSnap && docSnap.exists()) {
        await setDoc(
          userRef,
          {
            isOnline,
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
        await updateDoc(userRef, {
          isOnline: isOnline,
          lastSeen: serverTimestamp(),
        });
        
      } else {
        console.warn('User document does not exist for online status update:', uid);
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  },

  // 👇 NEW: Realtime listener
  onUserStatusChange(uid: string, callback: (user: User | null) => void) {
    try {
      const db = getFirestore();
      const userRef = doc(db, USERS, uid);

      return onSnapshot(userRef, (docSnap) => {
        if (docSnap && docSnap.exists()) {
          callback(docSnap.data() as User);
        } else {
          callback(null);
        }
      }, (error) => {
        console.error('Error in user status listener:', error);
        callback(null);
      });
    } catch (error) {
      console.error('Error setting up user status listener:', error);
      // Return a dummy unsubscribe function
      return () => {};
    }
  },

  onAllUsersStatusChange(callback: (users: User[]) => void) {
    try {
      const db = getFirestore();
      const usersRef = collection(db, USERS);

      return onSnapshot(usersRef, (snap) => {
        const users = snap.docs.map((d) => d.data() as User);
        callback(users);
      }, (error) => {
        console.error('Error in all users status listener:', error);
        callback([]);
      });
    } catch (error) {
      console.error('Error setting up all users status listener:', error);
      // Return a dummy unsubscribe function
      return () => {};
    }
  },

  async updateProfileImage(uid: string, photoURL: string): Promise<void> {
    try {
      const db = getFirestore();
      const userRef = doc(db, USERS, uid);
      
      // Verify the document exists before updating
      const docSnap = await getDoc(userRef);
      if (docSnap && docSnap.exists()) {
        await updateDoc(userRef, {
          photo: photoURL,
          lastSeen: serverTimestamp(),
        });
      } else {
        console.warn('User document does not exist for profile image update:', uid);
      }
    } catch (error) {
      console.error('Error updating profile image:', error);
      throw error;
    }
  },

  async searchUsers(searchQuery: string, excludeUid: string, limitCount = 20): Promise<User[]> {
    try {
      const db = getFirestore();
      const usersCollection = collection(db, USERS);

      const nameQueryRef = query(
        usersCollection,
        orderBy('nameLower'),
        startAt(searchQuery.toLowerCase()),
        endAt(searchQuery.toLowerCase() + '\uf8ff'),
        limit(limitCount)
      );
      const nameQuerySnap = await getDocs(nameQueryRef).catch(() => ({ docs: [] } as any));

      const emailQueryRef = query(
        usersCollection,
        orderBy('emailLower'),
        startAt(searchQuery.toLowerCase()),
        endAt(searchQuery.toLowerCase() + '\uf8ff'),
        limit(limitCount)
      );
      const emailQuerySnap = await getDocs(emailQueryRef).catch(() => ({ docs: [] } as any));

      const usersMap: Record<string, User> = {};
      [...nameQuerySnap.docs, ...emailQuerySnap.docs].forEach((d) => {
        if (d && d.data) {
          const user = d.data() as User;
          if (user.uid !== excludeUid) {
            usersMap[user.uid] = user;
          }
        }
      });
      return Object.values(usersMap);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  },

  async getAllUsers(excludeUid: string, limitCount = 50): Promise<User[]> {
    try {
      const db = getFirestore();
      const usersCollection = collection(db, USERS);
      const usersQuery = query(usersCollection, limit(limitCount));
      const snap = await getDocs(usersQuery);
      
      return snap.docs
        .filter(doc => doc && doc.data) // Filter out invalid documents
        .map((d: any) => d.data() as User)
        .filter((u: any) => u.uid !== excludeUid);
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  },
};

export type { User };
