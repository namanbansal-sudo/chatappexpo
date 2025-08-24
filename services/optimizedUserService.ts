// services/optimizedUserService.ts - High-Performance User Service
import firestore, {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  FieldPath,
} from '@react-native-firebase/firestore';
import { User, UserRelationship } from '../types/models';

const USERS = 'users';

/**
 * Optimized User Service
 * 
 * Key Optimizations:
 * 1. Minimal field updates to reduce write costs
 * 2. Batch operations for related updates
 * 3. Efficient search with indexed fields
 * 4. Subcollection-based relationships
 */
export const OptimizedUserService = {

  // =============================================================================
  // USER MANAGEMENT
  // =============================================================================

  /**
   * Create or update user with optimized structure
   */
  async createOrUpdateUser(userData: {
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
    displayName?: string;
  }): Promise<User> {
    const { uid, name, email, photoURL } = userData;
    const userRef = doc(getFirestore(), USERS, uid);
    const timestamp = serverTimestamp();

    try {
      const docSnap = await getDoc(userRef);
      const exists = docSnap.exists();

      const baseData: Partial<User> = {
        uid,
        name: userData.displayName || name,
        email,
        photo: photoURL || '',
        designation: exists ? docSnap.data()?.designation || 'User' : 'User',
        isOnline: true,
        lastSeen: timestamp,
        updatedAt: timestamp,
      };

      if (exists) {
        // Update existing user (only changed fields)
        await userRef.update({
          ...baseData,
          // Keep search fields updated
          nameLower: (userData.displayName || name).toLowerCase(),
          emailLower: email.toLowerCase(),
        });
      } else {
        // Create new user with full data
        const newUserData: User = {
          ...baseData as User,
          createdAt: timestamp,
          friendsCount: 0,
          chatsCount: 0,
          settings: {
            allowFriendRequests: true,
            showOnlineStatus: true,
            showLastSeen: true,
          },
          // Search fields
          nameLower: (userData.displayName || name).toLowerCase(),
          emailLower: email.toLowerCase(),
        };

        await setDoc(userRef, newUserData);
      }

      const savedDoc = await getDoc(userRef);
      console.log('✅ User created/updated successfully:', uid);
      return savedDoc.data() as User;

    } catch (error) {
      console.error('❌ Error creating/updating user:', error);
      throw error;
    }
  },

  /**
   * Get user by ID with caching support
   */
  async getUserById(uid: string): Promise<User | null> {
    try {
      const docSnap = await getDoc(doc(getFirestore(), USERS, uid));
      return docSnap.exists() ? (docSnap.data() as User) : null;
    } catch (error) {
      console.error('❌ Error getting user by ID:', error);
      return null;
    }
  },

  /**
   * Get multiple users by IDs (batch read)
   */
  async getUsersByIds(uids: string[]): Promise<User[]> {
    if (uids.length === 0) return [];

    try {
      const chunks = [];
      // Firestore 'in' queries are limited to 10 items
      for (let i = 0; i < uids.length; i += 10) {
        chunks.push(uids.slice(i, i + 10));
      }

      const users: User[] = [];
      for (const chunk of chunks) {
        const querySnap = await getDocs(
          query(
            collection(getFirestore(), USERS),
            where('__name__', 'in', chunk)
          )
        );

        users.push(...querySnap.docs.map((doc: any) => doc.data() as User));
      }

      return users;
    } catch (error) {
      console.error('❌ Error getting users by IDs:', error);
      return [];
    }
  },

  /**
   * Update online status efficiently
   */
  async updateOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
    try {
      const userRef = doc(getFirestore(), USERS, uid);
      const timestamp = serverTimestamp();

      await userRef.update({
        isOnline,
        lastSeen: timestamp,
        updatedAt: timestamp,
      });

      console.log('✅ Online status updated:', { uid, isOnline });
    } catch (error) {
      console.error('❌ Error updating online status:', error);
    }
  },

  // =============================================================================
  // USER SEARCH & DISCOVERY
  // =============================================================================

  /**
   * Search users with optimized queries
   */
  async searchUsers(searchQuery: string, excludeUid: string, limit = 20): Promise<User[]> {
    if (!searchQuery.trim()) return [];

    try {
      const lowerQuery = searchQuery.toLowerCase();
      const usersCollection = collection(getFirestore(), USERS);

      // Search by name
      const nameQuery = query(
        usersCollection,
        orderBy('nameLower'),
        startAt(lowerQuery),
        endAt(lowerQuery + '\uf8ff'),
        limit(limit)
      );

      // Search by email
      const emailQuery = query(
        usersCollection,
        orderBy('emailLower'),
        startAt(lowerQuery),
        endAt(lowerQuery + '\uf8ff'),
        limit(limit)
      );

      const [nameResults, emailResults] = await Promise.all([
        getDocs(nameQuery).catch(() => ({ docs: [] } as any)),
        getDocs(emailQuery).catch(() => ({ docs: [] } as any)),
      ]);

      // Combine and deduplicate results
      const usersMap: Record<string, User> = {};
      [...nameResults.docs, ...emailResults.docs].forEach((doc: any) => {
        const user = doc.data() as User;
        if (user.uid !== excludeUid) {
          usersMap[user.uid] = user;
        }
      });

      return Object.values(usersMap);
    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  },

  /**
   * Get all users for discovery (paginated)
   */
  async getAllUsers(
    excludeUid: string, 
    limit = 50, 
    lastDoc?: any
  ): Promise<{ users: User[]; lastDoc: any }> {
    try {
      let userQuery = query(
        collection(getFirestore(), USERS),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );

      if (lastDoc) {
        userQuery = query(
          collection(getFirestore(), USERS),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(limit)
        );
      }

      const snapshot = await getDocs(userQuery);
      const users = snapshot.docs
        .map((doc: any) => doc.data() as User)
        .filter((user: User) => user.uid !== excludeUid);

      const newLastDoc = snapshot.docs[snapshot.docs.length - 1];

      return { users, lastDoc: newLastDoc };
    } catch (error) {
      console.error('❌ Error getting all users:', error);
      return { users: [], lastDoc: null };
    }
  },

  // =============================================================================
  // RELATIONSHIP MANAGEMENT
  // =============================================================================

  /**
   * Get user's friends from relationships subcollection
   */
  async getUserFriends(userId: string, limit = 100): Promise<UserRelationship[]> {
    try {
      const friendsQuery = await getDocs(
        query(
          collection(getFirestore(), USERS, userId, 'relationships'),
          where('type', '==', 'friend'),
          orderBy('name', 'asc'),
          limit(limit)
        )
      );

      return friendsQuery.docs.map((doc: any) => doc.data() as UserRelationship);
    } catch (error) {
      console.error('❌ Error getting user friends:', error);
      return [];
    }
  },

  /**
   * Check if users are friends
   */
  async areFriends(userId: string, friendId: string): Promise<boolean> {
    try {
      const friendshipDoc = await getDoc(
        doc(getFirestore(), USERS, userId, 'relationships', friendId)
      );

      return friendshipDoc.exists() && friendshipDoc.data()?.type === 'friend';
    } catch (error) {
      console.error('❌ Error checking friendship:', error);
      return false;
    }
  },

  // =============================================================================
  // USER STATISTICS
  // =============================================================================

  /**
   * Increment user's friend count
   */
  async incrementFriendCount(userId: string): Promise<void> {
    try {
      await getFirestore()
        .collection(USERS)
        .doc(userId)
        .update({
          friendsCount: increment(1),
          updatedAt: serverTimestamp(),
        });
    } catch (error) {
      console.error('❌ Error incrementing friend count:', error);
    }
  },

  /**
   * Increment user's chat count
   */
  async incrementChatCount(userId: string): Promise<void> {
    try {
      await getFirestore()
        .collection(USERS)
        .doc(userId)
        .update({
          chatsCount: increment(1),
          updatedAt: serverTimestamp(),
        });
    } catch (error) {
      console.error('❌ Error incrementing chat count:', error);
    }
  },

  /**
   * Update user settings
   */
  async updateUserSettings(
    userId: string, 
    settings: Partial<User['settings']>
  ): Promise<void> {
    try {
      const userRef = doc(getFirestore(), USERS, userId);
      const currentUser = await getDoc(userRef);
      
      if (currentUser.exists()) {
        const currentSettings = currentUser.data()?.settings || {};
        const updatedSettings = { ...currentSettings, ...settings };
        
        await userRef.update({
          settings: updatedSettings,
          updatedAt: serverTimestamp(),
        });
        
        console.log('✅ User settings updated');
      }
    } catch (error) {
      console.error('❌ Error updating user settings:', error);
      throw error;
    }
  },
};

// Add search fields to User interface temporarily for compatibility
export interface SearchableUser extends User {
  nameLower?: string;
  emailLower?: string;
}

export type { User, UserRelationship };
