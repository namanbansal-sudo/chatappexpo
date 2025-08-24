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

    const requestsRef = collection(getFirestore(), REQUESTS);
    const existingQuery = query(
      requestsRef,
      where('senderId', '==', senderId),
      where('receiverId', '==', receiverId),
      where('status', '==', 'pending')
    );
    const q = await getDocs(existingQuery).catch(() => null as any);
    if (q && !q.empty) return; // already pending

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
    const requestsRef = collection(getFirestore(), REQUESTS);
    const q = query(
      requestsRef,
      where('receiverId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot: any) => {
      const docs = snapshot?.docs ?? [];
      onChange(docs.map((d: any) => (d.data() as FriendRequest)));
    }, (error: any) => {
      console.error('subscribeToReceivedRequests error:', error);
      onChange([]);
    });
  },

  subscribeToSentRequests(
    userId: string,
    onChange: (requests: FriendRequest[]) => void
  ): Unsubscribe {
    const requestsRef = collection(getFirestore(), REQUESTS);
    const q = query(
      requestsRef,
      where('senderId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot: any) => {
      const docs = snapshot?.docs ?? [];
      onChange(docs.map((d: any) => (d.data() as FriendRequest)));
    }, (error: any) => {
      console.error('subscribeToSentRequests error:', error);
      onChange([]);
    });
  },

  async acceptFriendRequest(id: string, currentUserId: string, refreshUserData?: () => Promise<void>): Promise<void> {
    const reqRef = doc(getFirestore(), REQUESTS, id);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) return;
    const request = snap.data() as FriendRequest;

    // Verify that the current user is the receiver of this request
    if (request.receiverId !== currentUserId) {
      throw new Error('You can only accept requests sent to you');
    }

    const senderRef = doc(getFirestore(), USERS, request.senderId);
    const receiverRef = doc(getFirestore(), USERS, request.receiverId);

    // Use atomic arrayUnion updates via a batch to avoid long transactions
    const batch = writeBatch(getFirestore());
    batch.update(reqRef, { status: 'accepted' });
    batch.update(senderRef, {
      friends: arrayUnion(request.receiverId),
    });
    batch.update(receiverRef, {
      friends: arrayUnion(request.senderId),
    });
    batch.update(reqRef, { status: 'accepted' });
    await batch.commit();

    // Refresh user data in context to update friends list
    if (refreshUserData) {
      try {
        await refreshUserData();
        console.log('✅ User context refreshed after friend request acceptance');
      } catch (error) {
        console.error('❌ Failed to refresh user context:', error);
      }
    }

    // Create chat room immediately after friend request is accepted
    // This is optional - chat will be created when users first message
    try {
      console.log(`🔍 Creating chat between ${request.senderId} and ${request.receiverId}`);
      console.log(`🔍 Current user ID: ${currentUserId}`);
      
      // Create the chat as the current user (receiver who accepted the request)
      await ChatService.ensureChatExists(currentUserId, request.senderId);
      console.log('✅ Chat created successfully after friend request acceptance');
    } catch (e) {
      console.warn('⚠️ Chat creation after friend request acceptance had issues, but this is not critical:', e);
      // Don't throw here as the friend request was already accepted successfully
      // Chat will be created when users first try to message
    }
  },

  async rejectFriendRequest(id: string): Promise<void> {
    const reqRef = doc(getFirestore(), REQUESTS, id);
    await updateDoc(reqRef, { status: 'rejected' });
  },

  async cancelFriendRequest(id: string): Promise<void> {
    const reqRef = doc(getFirestore(), REQUESTS, id);
    await deleteDoc(reqRef);
  },
};

export type { FriendRequest };


