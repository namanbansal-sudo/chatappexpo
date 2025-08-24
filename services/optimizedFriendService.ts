// services/optimizedFriendService.ts - High-Performance Friend Request Service
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, writeBatch, deleteDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from '@react-native-firebase/firestore';
import { FriendRequest, User } from '../types/models';
import { OptimizedChatService } from './optimizedChatService';

type Unsubscribe = () => void;

/**
 * Optimized Friend Request Service
 * 
 * Key Optimizations:
 * 1. Composite fields for efficient deduplication
 * 2. Denormalized user data to avoid lookups
 * 3. Batch operations for atomic updates
 * 4. Integration with optimized chat service
 */
export const OptimizedFriendService = {

  // =============================================================================
  // FRIEND REQUEST OPERATIONS
  // =============================================================================

  /**
   * Send friend request with deduplication
   */
  async sendFriendRequest(
    senderId: string,
    receiverId: string,
    senderProfile: User,
    receiverProfile: User,
    message?: string
  ): Promise<void> {
    if (senderId === receiverId) {
      throw new Error('Cannot send request to yourself');
    }

    const senderReceiver = `${senderId}_${receiverId}`;
    const batch = getFirestore().batch();

    try {
      // 1. Check if request already exists
      const existingRequestQuery = await getDocs(
        query(
          collection(getFirestore(), 'friendRequests'),
          where('senderReceiver', '==', senderReceiver),
          where('status', '==', 'pending'),
          limit(1)
        )
      );

      if (!existingRequestQuery.empty) {
        throw new Error('Friend request already sent');
      }

      // 2. Check if they're already friends
      const areFriends = await OptimizedChatService.checkFriendship(senderId, receiverId);
      if (areFriends) {
        throw new Error('You are already friends');
      }

      // 3. Create friend request
      const requestRef = doc(collection(getFirestore(), 'friendRequests'));
      const requestData: FriendRequest = {
        id: requestRef.id,
        senderId,
        receiverId,
        status: 'pending',
        timestamp: serverTimestamp(),
        message: message || '',
        senderName: senderProfile.name,
        senderPhoto: senderProfile.photo,
        receiverName: receiverProfile.name,
        receiverPhoto: receiverProfile.photo,
        senderReceiver,
      };

      batch.set(requestRef, requestData);
      await batch.commit();

      console.log('✅ Friend request sent successfully');

    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      throw error;
    }
  },

  /**
   * Subscribe to received friend requests
   */
  subscribeToReceivedRequests(
    userId: string,
    onChange: (requests: FriendRequest[]) => void
  ): Unsubscribe {
    const requestsRef = query(
      collection(getFirestore(), 'friendRequests'),
      where('receiverId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(requestsRef,
      snapshot => {
        const requests = snapshot.docs.map(doc => doc.data() as FriendRequest);
        onChange(requests);
      },
      error => {
        console.error('❌ Received requests subscription error:', error);
        onChange([]);
      }
    );
  },

  /**
   * Subscribe to sent friend requests
   */
  subscribeToSentRequests(
    userId: string,
    onChange: (requests: FriendRequest[]) => void
  ): Unsubscribe {
    const requestsRef = query(
      collection(getFirestore(), 'friendRequests'),
      where('senderId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(requestsRef,
      snapshot => {
        const requests = snapshot.docs.map(doc => doc.data() as FriendRequest);
        onChange(requests);
      },
      error => {
        console.error('❌ Sent requests subscription error:', error);
        onChange([]);
      }
    );
  },

  /**
   * Accept friend request with optimized batch operations
   */
  async acceptFriendRequest(
    requestId: string,
    currentUserId: string,
    refreshUserData?: () => Promise<void>
  ): Promise<void> {
    const batch = getFirestore().batch();

    try {
      // 1. Get the friend request
      const requestRef = doc(getFirestore(), 'friendRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Friend request not found');
      }

      const request = requestDoc.data() as FriendRequest;

      // Verify that current user is the receiver
      if (request.receiverId !== currentUserId) {
        throw new Error('You can only accept requests sent to you');
      }

      // 2. Get user profiles for denormalized data
      const [senderDoc, receiverDoc] = await Promise.all([
        getDoc(doc(getFirestore(), 'users', request.senderId)),
        getDoc(doc(getFirestore(), 'users', request.receiverId)),
      ]);

      if (!senderDoc.exists() || !receiverDoc.exists()) {
        throw new Error('User profiles not found');
      }

      const senderProfile = senderDoc.data() as User;
      const receiverProfile = receiverDoc.data() as User;

      // 3. Update request status
      batch.update(requestRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      // 4. Create friendship using optimized chat service
      await OptimizedChatService.createFriendship(
        request.receiverId,
        request.senderId,
        receiverProfile,
        senderProfile
      );

      await batch.commit();

      // 5. Refresh user data if callback provided
      if (refreshUserData) {
        try {
          await refreshUserData();
          console.log('✅ User context refreshed after accepting request');
        } catch (error) {
          console.error('❌ Failed to refresh user context:', error);
        }
      }

      console.log('✅ Friend request accepted successfully');

    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      throw error;
    }
  },

  /**
   * Reject friend request
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      await updateDoc(
        doc(getFirestore(), 'friendRequests', requestId),
        {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
        }
      );

      console.log('✅ Friend request rejected');

    } catch (error) {
      console.error('❌ Error rejecting friend request:', error);
      throw error;
    }
  },

  /**
   * Cancel sent friend request
   */
  async cancelFriendRequest(requestId: string): Promise<void> {
    try {
      await deleteDoc(
        doc(getFirestore(), 'friendRequests', requestId)
      );

      console.log('✅ Friend request cancelled');

    } catch (error) {
      console.error('❌ Error cancelling friend request:', error);
      throw error;
    }
  },

  // =============================================================================
  // USER SEARCH & DISCOVERY
  // =============================================================================

  /**
   * Search users with optimization for friend status
   */
  async searchUsers(
    searchQuery: string,
    currentUserId: string,
    limitCount: number = 20
  ): Promise<User[]> {
    try {
      // Simple text search - in production you'd use Algolia or similar
      const usersQuery = await getDocs(
        query(
          collection(getFirestore(), 'users'),
          where('name', '>=', searchQuery),
          where('name', '<=', searchQuery + '\uf8ff'),
          limit(limitCount)
        )
      );

      const users = usersQuery.docs
        .map(doc => doc.data() as User)
        .filter(user => user.uid !== currentUserId); // Exclude self

      return users;

    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  },

  /**
   * Get all users (for friend discovery)
   */
  async getAllUsers(
    currentUserId: string,
    limitCount: number = 100
  ): Promise<User[]> {
    try {
      const usersQuery = await getDocs(
        query(
          collection(getFirestore(), 'users'),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        )
      );

      const users = usersQuery.docs
        .map(doc => doc.data() as User)
        .filter(user => user.uid !== currentUserId); // Exclude self

      return users;

    } catch (error) {
      console.error('❌ Error getting all users:', error);
      return [];
    }
  },

  /**
   * Check relationship status between users
   */
  async getRelationshipStatus(
    currentUserId: string,
    targetUserId: string
  ): Promise<{
    isFriend: boolean;
    hasPendingRequest: boolean;
    requestSent: boolean;
    requestReceived: boolean;
  }> {
    try {
      // Check friendship
      const isFriend = await OptimizedChatService.checkFriendship(currentUserId, targetUserId);

      if (isFriend) {
        return {
          isFriend: true,
          hasPendingRequest: false,
          requestSent: false,
          requestReceived: false,
        };
      }

      // Check pending requests
      const [sentRequests, receivedRequests] = await Promise.all([
        getDocs(
          query(
            collection(getFirestore(), 'friendRequests'),
            where('senderId', '==', currentUserId),
            where('receiverId', '==', targetUserId),
            where('status', '==', 'pending'),
            limit(1)
          )
        ),
        getDocs(
          query(
            collection(getFirestore(), 'friendRequests'),
            where('senderId', '==', targetUserId),
            where('receiverId', '==', currentUserId),
            where('status', '==', 'pending'),
            limit(1)
          )
        ),
      ]);

      const requestSent = !sentRequests.empty;
      const requestReceived = !receivedRequests.empty;

      return {
        isFriend: false,
        hasPendingRequest: requestSent || requestReceived,
        requestSent,
        requestReceived,
      };

    } catch (error) {
      console.error('❌ Error checking relationship status:', error);
      return {
        isFriend: false,
        hasPendingRequest: false,
        requestSent: false,
        requestReceived: false,
      };
    }
  },
};

export type { FriendRequest };
