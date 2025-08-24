// services/optimizedChatService.ts - High-Performance Chat Service
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, increment, query, where, orderBy, limit, onSnapshot, FieldValue } from '@react-native-firebase/firestore';
import { 
  Chat, 
  ChatMessage, 
  UserChatListItem, 
  UserRelationship,
  ChatListItem 
} from '../types/models';

type Unsubscribe = () => void;

/**
 * Optimized Chat Service for Performance & Scalability
 * 
 * Key Optimizations:
 * 1. Denormalized chat list for instant loading
 * 2. Minimal document reads with efficient queries
 * 3. Batch operations to reduce write costs
 * 4. Subcollections for scalable relationships
 */
export const OptimizedChatService = {
  
  // =============================================================================
  // CHAT ID GENERATION
  // =============================================================================
  
  generateChatId(userA: string, userB: string): string {
    const [first, second] = [userA, userB].sort();
    return `${first}_${second}`;
  },

  // =============================================================================
  // CHAT LIST OPERATIONS (Using Denormalized Data)
  // =============================================================================

  /**
   * Subscribe to user's chat list - SUPER FAST (single query)
   * Uses denormalized data from /users/{userId}/chatList subcollection
   */
  subscribeToUserChatList(
    userId: string,
    onChange: (chats: ChatListItem[]) => void
  ): Unsubscribe {
    console.log('📱 Subscribing to chat list for user:', userId);
    
    const chatListRef = query(
      collection(getFirestore(), 'users', userId, 'chatList'),
      where('isArchived', '==', false), // Only non-archived chats
      orderBy('updatedAt', 'desc'), // Most recent first
      limit(50) // Limit for performance
    );

    return onSnapshot(chatListRef,
      snapshot => {
        const chatItems: ChatListItem[] = snapshot.docs.map(doc => {
          const data = doc.data() as UserChatListItem;
          
          // Format timestamp
          let timeString = '';
          if (data.lastMessageTime) {
            const date = data.lastMessageTime.toDate();
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            
            if (messageDate.getTime() === today.getTime()) {
              timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              if (messageDate.getTime() === yesterday.getTime()) {
                timeString = 'Yesterday';
              } else {
                timeString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              }
            }
          }

          return {
            id: data.chatId,
            name: data.partnerName,
            avatar: data.partnerPhoto,
            lastMessage: data.lastMessage,
            time: timeString,
            unreadCount: data.unreadCount,
            isOnline: data.partnerOnline,
            isPinned: data.isPinned,
            isArchived: data.isArchived,
            isMuted: data.isMuted,
          };
        });

        console.log('📱 Loaded', chatItems.length, 'chats from denormalized list');
        onChange(chatItems);
      },
      error => {
        console.error('❌ Chat list subscription error:', error);
        onChange([]);
      }
    );
  },

  // =============================================================================
  // FRIEND MANAGEMENT (Using Subcollections)
  // =============================================================================

  /**
   * Get user's friends from relationships subcollection
   * More scalable than array-based approach
   */
  subscribeToUserFriends(
    userId: string,
    onChange: (friends: UserRelationship[]) => void
  ): Unsubscribe {
    const friendsRef = query(
      collection(getFirestore(), 'users', userId, 'relationships'),
      where('type', '==', 'friend'),
      orderBy('name', 'asc')
    );

    return onSnapshot(friendsRef,
      snapshot => {
        const friends = snapshot.docs.map(doc => doc.data() as UserRelationship);
        onChange(friends);
      },
      error => {
        console.error('❌ Friends subscription error:', error);
        onChange([]);
      }
    );
  },

  /**
   * Check if two users are friends (efficient single read)
   */
  async checkFriendship(userId: string, friendId: string): Promise<boolean> {
    try {
      const friendshipDoc = await getDoc(
        doc(getFirestore(), 'users', userId, 'relationships', friendId)
      );
        
      return friendshipDoc.exists() && friendshipDoc.data()?.type === 'friend';
    } catch (error) {
      console.error('❌ Error checking friendship:', error);
      return false;
    }
  },

  // =============================================================================
  // MESSAGE OPERATIONS
  // =============================================================================

  /**
   * Subscribe to messages in a chat (paginated for performance)
   */
  subscribeToMessages(
    chatId: string,
    onChange: (messages: ChatMessage[]) => void,
    limitCount: number = 50
  ): Unsubscribe {
    const messagesRef = query(
      collection(getFirestore(), 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(messagesRef,
      snapshot => {
        const messages = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage))
          .reverse(); // Reverse to show oldest first

        onChange(messages);
      },
      error => {
        console.error('❌ Messages subscription error:', error);
        onChange([]);
      }
    );
  },

  /**
   * Send message with optimized batch operations
   */
  async sendMessage(
    senderId: string,
    senderName: string,
    receiverId: string,
    messageText: string
  ): Promise<void> {
    const chatId = this.generateChatId(senderId, receiverId);
    const batch = getFirestore().batch();
    const timestamp = serverTimestamp();

    try {
      // 1. Create message document
      const messageRef = doc(collection(getFirestore(), 'chats', chatId, 'messages'));

      const messageData: Partial<ChatMessage> = {
        id: messageRef.id,
        senderId,
        timestamp,
        content: {
          text: messageText,
        },
        type: 'text',
        status: 'sent',
      };

      batch.set(messageRef, messageData);

      // 2. Update or create chat document
      const chatRef = doc(getFirestore(), 'chats', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists) {
        // Create new chat
        const chatData: Partial<Chat> = {
          id: chatId,
          type: 'direct',
          participants: [senderId, receiverId],
          participantCount: 2,
          lastMessage: {
            text: messageText,
            senderId,
            senderName,
            timestamp,
            type: 'text',
          },
          participantData: {
            [senderId]: {
              unreadCount: 0,
              lastReadAt: timestamp,
              archived: false,
            },
            [receiverId]: {
              unreadCount: 1,
              lastReadAt: null,
              archived: false,
            },
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        batch.set(chatRef, chatData);
      } else {
        // Update existing chat
        const currentData = chatDoc.data() as Chat;
        const updatedParticipantData = {
          ...currentData.participantData,
          [receiverId]: {
            ...currentData.participantData[receiverId],
            unreadCount: (currentData.participantData[receiverId]?.unreadCount || 0) + 1,
          },
        };

        batch.update(chatRef, {
          lastMessage: {
            text: messageText,
            senderId,
            senderName,
            timestamp,
            type: 'text',
          },
          participantData: updatedParticipantData,
          updatedAt: timestamp,
        });
      }

      // 3. Update denormalized chat lists for both users
      await this.updateChatListsAfterMessage(
        batch,
        chatId,
        senderId,
        senderName,
        receiverId,
        messageText,
        timestamp
      );

      // Commit all changes atomically
      await batch.commit();
      console.log('✅ Message sent successfully');

    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  },

  /**
   * Update denormalized chat lists for both participants
   */
  async updateChatListsAfterMessage(
    batch: any,
    chatId: string,
    senderId: string,
    senderName: string,
    receiverId: string,
    messageText: string,
    timestamp: any
  ): Promise<void> {
    // Get user documents to get names/photos
    const [senderDoc, receiverDoc] = await Promise.all([
      getDoc(doc(getFirestore(), 'users', senderId)),
      getDoc(doc(getFirestore(), 'users', receiverId)),
    ]);

    const senderData = senderDoc.data();
    const receiverData = receiverDoc.data();

    if (!senderData || !receiverData) {
      throw new Error('User data not found');
    }

    // Update sender's chat list
    const senderChatListRef = doc(getFirestore(), 'users', senderId, 'chatList', chatId);

    const senderChatListData: Partial<UserChatListItem> = {
      chatId,
      partnerId: receiverId,
      partnerName: receiverData.name,
      partnerPhoto: receiverData.photo,
      partnerOnline: receiverData.isOnline,
      lastMessage: messageText,
      lastMessageTime: timestamp,
      lastMessageSender: senderId,
      lastMessageType: 'text',
      unreadCount: 0, // Sender doesn't have unread
      lastReadAt: timestamp,
      isPinned: false,
      isArchived: false,
      isMuted: false,
      updatedAt: timestamp,
    };

    // Update receiver's chat list
    const receiverChatListRef = doc(getFirestore(), 'users', receiverId, 'chatList', chatId);

    // Get current receiver chat list item to preserve unread count
    const receiverChatListDoc = await getDoc(receiverChatListRef);
    const currentUnreadCount = receiverChatListDoc.exists() 
      ? (receiverChatListDoc.data() as UserChatListItem).unreadCount || 0
      : 0;

    const receiverChatListData: Partial<UserChatListItem> = {
      chatId,
      partnerId: senderId,
      partnerName: senderData.name,
      partnerPhoto: senderData.photo,
      partnerOnline: senderData.isOnline,
      lastMessage: messageText,
      lastMessageTime: timestamp,
      lastMessageSender: senderId,
      lastMessageType: 'text',
      unreadCount: currentUnreadCount + 1,
      isPinned: receiverChatListDoc.exists() ? (receiverChatListDoc.data() as UserChatListItem).isPinned : false,
      isArchived: false,
      isMuted: receiverChatListDoc.exists() ? (receiverChatListDoc.data() as UserChatListItem).isMuted : false,
      updatedAt: timestamp,
    };

    batch.set(senderChatListRef, senderChatListData, { merge: true });
    batch.set(receiverChatListRef, receiverChatListData, { merge: true });
  },

  /**
   * Mark messages as read and update counters
   */
  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    const batch = getFirestore().batch();
    const timestamp = serverTimestamp();

    try {
      // 1. Update chat document
      const chatRef = doc(getFirestore(), 'chats', chatId);
      batch.update(chatRef, {
        [`participantData.${userId}.unreadCount`]: 0,
        [`participantData.${userId}.lastReadAt`]: timestamp,
      });

      // 2. Update user's chat list
      const chatListRef = doc(getFirestore(), 'users', userId, 'chatList', chatId);

      batch.update(chatListRef, {
        unreadCount: 0,
        lastReadAt: timestamp,
      });

      await batch.commit();
      console.log('✅ Messages marked as read');

    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      throw error;
    }
  },

  // =============================================================================
  // FRIEND REQUEST INTEGRATION
  // =============================================================================

  /**
   * Create friendship and initial chat list entries
   */
  async createFriendship(
    userId: string,
    friendId: string,
    userProfile: any,
    friendProfile: any
  ): Promise<void> {
    const batch = getFirestore().batch();
    const timestamp = serverTimestamp();

    try {
      // 1. Create friendship relationships (both directions)
      const userFriendRef = doc(getFirestore(), 'users', userId, 'relationships', friendId);

      const friendUserRef = doc(getFirestore(), 'users', friendId, 'relationships', userId);

      const userRelationshipData: UserRelationship = {
        id: friendId,
        type: 'friend',
        createdAt: timestamp,
        name: friendProfile.name,
        photo: friendProfile.photo,
        isOnline: friendProfile.isOnline || false,
        lastSeen: friendProfile.lastSeen,
      };

      const friendRelationshipData: UserRelationship = {
        id: userId,
        type: 'friend',
        createdAt: timestamp,
        name: userProfile.name,
        photo: userProfile.photo,
        isOnline: userProfile.isOnline || false,
        lastSeen: userProfile.lastSeen,
      };

      batch.set(userFriendRef, userRelationshipData);
      batch.set(friendUserRef, friendRelationshipData);

      // 2. Update friend counts
      const userRef = doc(getFirestore(), 'users', userId);
      const friendRef = doc(getFirestore(), 'users', friendId);

      batch.update(userRef, {
        friendsCount: increment(1),
        updatedAt: timestamp,
      });

      batch.update(friendRef, {
        friendsCount: increment(1),
        updatedAt: timestamp,
      });

      await batch.commit();
      console.log('✅ Friendship created successfully');

    } catch (error) {
      console.error('❌ Error creating friendship:', error);
      throw error;
    }
  },
};

export type { Chat, ChatMessage, ChatListItem };
