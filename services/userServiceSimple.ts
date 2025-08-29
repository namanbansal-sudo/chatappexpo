import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  getFirestore,
  limit,
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
    const { uid, name, email, photoURL } = user;
    const db = getFirestore();
    const userRef = doc(db, USERS, uid);
    const now = serverTimestamp();
    const docSnap = await getDoc(userRef);
    const data: Partial<User> = {
      uid,
      name,
      email,
      photo: photoURL || '',
      designation: 'User',
      isOnline: true,
      lastSeen: now,
    };

    const documentExists = docSnap.exists();
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

    const saved = await getDoc(userRef);
    return saved.data() as User;
  },

  async getUserById(uid: string): Promise<User | null> {
    const db = getFirestore();
    const docRef = doc(db, USERS, uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as User) : null;
  },

  async updateOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, USERS, uid);
    await setDoc(userRef,
      {
        isOnline,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  },

  async updateProfileImage(uid: string, photoURL: string): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, USERS, uid);
    await updateDoc(userRef, {
      photo: photoURL,
      lastSeen: serverTimestamp(),
    });
  },

  async searchUsers(searchQuery: string, excludeUid: string, limitCount = 20): Promise<User[]> {
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
      const user = d.data() as User;
      if (user.uid !== excludeUid) {
        usersMap[user.uid] = user;
      }
    });
    return Object.values(usersMap);
  },

  async getAllUsers(excludeUid: string, limitCount = 50): Promise<User[]> {
    const db = getFirestore();
    const usersCollection = collection(db, USERS);
    const usersQuery = query(usersCollection, limit(limitCount));
    const snap = await getDocs(usersQuery);
    return snap.docs
      .map((d: any) => d.data() as User)
      .filter((u: any) => u.uid !== excludeUid);
  },
};

export type { User };
