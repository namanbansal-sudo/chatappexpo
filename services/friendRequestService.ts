// services/friendRequestService.ts
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  serverTimestamp
} from '@react-native-firebase/firestore';
import { FriendRequest } from '../types/models';
import { ChatService } from './chatService';

type Unsubscribe = () => void;

const REQUESTS = 'friendRequests';
const USERS = 'users';
const CHATS = 'chats';

export const FriendRequestService = {
  async sendFriendRequest(
    senderId: string,
    receiverId: string,
    senderProfile: {
      uid: string;
      name: string;
      email: string;
      photo: string;
      designation?: string;
      isOnline?: boolean;
    },
    receiverProfile?: {
      uid: string;
      name: string;
      email: string;
      photo: string;
    },
    message?: string
  ): Promise<void> {
    if (senderId === receiverId) {
      throw new Error('Cannot send request to yourself');
    }

    const db = getFirestore();
    const requestsRef = collection(db, REQUESTS);
    
    // Check if request already exists
    const existingQuery = query(
      requestsRef,
      where('senderId', '==', senderId),
      where('receiverId', '==', receiverId),
      where('status', 'in', ['pending', 'accepted'])
    );
    
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      const existingRequest = existingSnapshot.docs[0].data() as FriendRequest;
      if (existingRequest.status === 'pending') {
        throw new Error('Friend request already sent');
      }
      if (existingRequest.status === 'accepted') {
        throw new Error('You are already friends');
      }
    }

    const reqRef = doc(requestsRef);
    await setDoc(reqRef, {
      id: reqRef.id,
      senderId,
      receiverId,
      senderName: senderProfile.name,
      senderPhoto: senderProfile.photo,
      senderEmail: senderProfile.email,
      receiverName: receiverProfile?.name || '',
      receiverPhoto: receiverProfile?.photo || '',
      receiverEmail: receiverProfile?.email || '',
      status: 'pending',
      message: message || '',
      timestamp: serverTimestamp(),
      senderReceiver: `${senderId}_${receiverId}`,
    } as FriendRequest);
  },

  subscribeToReceivedRequests(
    userId: string,
    onChange: (requests: FriendRequest[]) => void
  ): Unsubscribe {
    const db = getFirestore();
    const requestsRef = collection(db, REQUESTS);
    const q = query(
      requestsRef,
      where('receiverId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    
    return onSnapshot(q, 
      (snapshot) => {
        const requests: FriendRequest[] = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
        });
        onChange(requests);
      },
      (error) => {
        console.error('subscribeToReceivedRequests error:', error);
        onChange([]);
      }
    );
  },

  subscribeToSentRequests(
    userId: string,
    onChange: (requests: FriendRequest[]) => void
  ): Unsubscribe {
    const db = getFirestore();
    const requestsRef = collection(db, REQUESTS);
    const q = query(
      requestsRef,
      where('senderId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    
    return onSnapshot(q, 
      (snapshot) => {
        const requests: FriendRequest[] = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() } as FriendRequest);
        });
        onChange(requests);
      },
      (error) => {
        console.error('subscribeToSentRequests error:', error);
        onChange([]);
      }
    );
  },

  async acceptFriendRequest(id: string, currentUserId: string, refreshUserData?: () => Promise<void>): Promise<void> {
    const db = getFirestore();
    const reqRef = doc(db, REQUESTS, id);
    
    // First verify the request exists and current user is the receiver
    const snap = await getDoc(reqRef);
    if (!snap.exists()) {
      throw new Error('Friend request not found');
    }

    const request = snap.data() as FriendRequest;
    
    // Verify that the current user is the receiver of this request
    if (request.receiverId !== currentUserId) {
      throw new Error('You can only accept requests sent to you');
    }

    // Verify the request is still pending
    if (request.status !== 'pending') {
      throw new Error('This request has already been processed');
    }

    try {
      // Use a batch for atomic operations
      const batch = writeBatch(db);

      // 1. Update the friend request status
      batch.update(reqRef, { 
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });

      // 2. Add to sender's friends list (using subcollection approach)
      const senderFriendRef = doc(db, USERS, request.senderId, 'friends', currentUserId);
      batch.set(senderFriendRef, {
        friendId: currentUserId,
        friendName: '', // Will be populated by the listener
        friendPhoto: '', // Will be populated by the listener
        addedAt: serverTimestamp()
      });

      // 3. Add to receiver's friends list
      const receiverFriendRef = doc(db, USERS, currentUserId, 'friends', request.senderId);
      batch.set(receiverFriendRef, {
        friendId: request.senderId,
        friendName: request.senderName,
        friendPhoto: request.senderPhoto,
        addedAt: serverTimestamp()
      });

      // Execute the batch
      await batch.commit();
      console.log('✅ Friend request accepted successfully');

      // Refresh user data
      if (refreshUserData) {
        try {
          await refreshUserData();
          console.log('✅ User context refreshed');
        } catch (refreshError) {
          console.error('❌ Failed to refresh user context:', refreshError);
        }
      }

      // Create chat room (optional - can be lazy loaded)
      try {
        await ChatService.ensureChatExists(currentUserId, request.senderId);
        console.log('✅ Chat created successfully');
      } catch (chatError) {
        console.warn('⚠️ Chat creation had minor issues:', chatError);
      }

    } catch (error: any) {
      console.error('❌ Error in acceptFriendRequest:', error);
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied. Please check your Firestore security rules.');
      } else if (error.code === 'not-found') {
        throw new Error('User document not found. The user may have been deleted.');
      } else {
        throw new Error(error.message || 'Failed to accept friend request');
      }
    }
  },

  async rejectFriendRequest(id: string): Promise<void> {
    const db = getFirestore();
    const reqRef = doc(db, REQUESTS, id);
    
    // Verify the request exists
    const snap = await getDoc(reqRef);
    if (!snap.exists()) {
      throw new Error('Friend request not found');
    }

    await updateDoc(reqRef, { 
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });
  },

  async cancelFriendRequest(id: string): Promise<void> {
    const db = getFirestore();
    const reqRef = doc(db, REQUESTS, id);
    
    // Verify the request exists
    const snap = await getDoc(reqRef);
    if (!snap.exists()) {
      throw new Error('Friend request not found');
    }

    await deleteDoc(reqRef);
  },

  // Helper method to check if users are already friends
  async areUsersFriends(userId1: string, userId2: string): Promise<boolean> {
    const db = getFirestore();
    
    try {
      // Check both directions since friendship is bidirectional
      const friendRef1 = doc(db, USERS, userId1, 'friends', userId2);
      const friendRef2 = doc(db, USERS, userId2, 'friends', userId1);
      
      const [friendSnap1, friendSnap2] = await Promise.all([
        getDoc(friendRef1),
        getDoc(friendRef2)
      ]);
      
      return friendSnap1.exists() || friendSnap2.exists();
    } catch (error) {
      console.error('Error checking friendship status:', error);
      return false;
    }
  }
};

export type { FriendRequest };