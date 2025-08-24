// services/chatService.ts
import { 
  getFirestore,
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc,
  addDoc,
  orderBy, 
  limit,
  serverTimestamp,
  arrayUnion,
  increment,
  getDoc,
  writeBatch,
  deleteDoc
} from '@react-native-firebase/firestore';
import { Chat, ChatSimple, ChatMessage } from '../types/models';

type Unsubscribe = () => void;

const CHATS = 'chats';
const MESSAGES = 'messages';
const USERS = 'users';

export const ChatService = {
  // Test function to check user documents
  async testUserDocuments(senderId: string, receiverId: string): Promise<void> {
    console.log('🧪 Testing user documents:', { senderId, receiverId });
    
    try {
      const db = getFirestore();
      const senderDocRef = doc(db, 'users', senderId);
      const receiverDocRef = doc(db, 'users', receiverId);
      const senderDoc = await getDoc(senderDocRef);
      const receiverDoc = await getDoc(receiverDocRef);
      
      console.log('🧪 Sender document:', {
        exists: senderDoc.exists,
        data: senderDoc.data(),
        id: senderDoc.id
      });
      
      console.log('🧪 Receiver document:', {
        exists: receiverDoc.exists, 
        data: receiverDoc.data(),
        id: receiverDoc.id
      });
      
      const senderExists = typeof (senderDoc as any).exists === 'function' ? (senderDoc as any).exists() : (senderDoc as any).exists;
      const receiverExists = typeof (receiverDoc as any).exists === 'function' ? (receiverDoc as any).exists() : (receiverDoc as any).exists;
      if (senderExists && receiverExists) {
        const senderFriends = senderDoc.data()?.friends || [];
        const receiverFriends = receiverDoc.data()?.friends || [];
        
        console.log('🧪 Friendship status:', {
          senderFriends,
          receiverFriends,
          senderHasReceiver: senderFriends.includes(receiverId),
          receiverHasSender: receiverFriends.includes(senderId)
        });
      }
    } catch (error) {
      console.error('🧪 Error testing user documents:', error);
    }
  },
  generateChatId(userA: string, userB: string): string {
    const [first, second] = [userA, userB].sort();
    return `${first}_${second}`;
  },

  async initializeCollections(_uid: string): Promise<void> {
    // No-op placeholder for compatibility. Firestore collections are created on demand.
  },

  subscribeToUserChats(
    userId: string,
    onChange: (chats: ChatSimple[]) => void
  ): Unsubscribe {
    // Avoid requiring composite indexes by not ordering here; the UI can sort after resolving last message times
    const db = getFirestore();
    const chatQuery = query(collection(db, CHATS), where('participants', 'array-contains', userId));

    const unsubscribe = onSnapshot(chatQuery, {
      next: (snapshot) => {
        const docs = snapshot?.docs ?? [];
        const firebaseChats: ChatSimple[] = snapshot.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
        onChange(firebaseChats);
      },
      error: (error) => {
        console.error('subscribeToUserChats error:', error);
        onChange([]);
      },
    });
    return unsubscribe;
  },

  subscribeToMessages(
    userId: string,
    friendUserId: string,
    onChange: (messages: ChatMessage[]) => void
  ): Unsubscribe {
    const chatId = this.generateChatId(userId, friendUserId);
    const db = getFirestore();
    const messagesRef = collection(db, CHATS, chatId, MESSAGES);
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(messagesQuery, {
      next: (snapshot) => {
        const docs = snapshot?.docs ?? [];
        const items: ChatMessage[] = docs.map((docSnap: any) => ({ id: docSnap.id, ...(docSnap.data() as any) }));
        onChange(items);
      },
      error: (error) => {
        console.error('subscribeToMessages error:', error);
        onChange([]);
      },
    });
  },

  async ensureChatExists(currentUserId: string, otherUserId: string): Promise<string> {
    const chatId = this.generateChatId(currentUserId, otherUserId);
    const db = getFirestore();
    const chatRef = doc(db, CHATS, chatId);
    
    try {
      const snap = await getDoc(chatRef);
      if (!snap.exists) {
        // Ensure participants array is properly ordered and contains both users
        const participants = [currentUserId, otherUserId].sort();
        
        console.log(`🔍 Creating chat document ${chatId} with participants:`, participants);
        console.log(`🔍 Current authenticated user: ${currentUserId}`);
        console.log(`🔍 Other user: ${otherUserId}`);
        
        const initialUnreadCount: { [key: string]: number } = {};
        initialUnreadCount[currentUserId] = 0;
        initialUnreadCount[otherUserId] = 0;
        
        const chatData = {
          participants,
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
          unreadCount: initialUnreadCount,
          createdBy: currentUserId,
          createdAt: serverTimestamp(),
        };
        
        console.log(`🔍 Chat data to be created:`, chatData);
        
        await setDoc(chatRef, chatData);
        console.log(`✅ Chat created successfully: ${chatId}`);
      } else {
        console.log(`✅ Chat already exists: ${chatId}`);
      }
    } catch (error) {
      console.error(`❌ Error creating chat ${chatId}:`, error);
      console.error(`❌ Error details:`, {
        currentUserId,
        otherUserId,
        chatId,
        participants: [currentUserId, otherUserId].sort(),
        error: error instanceof Error ? error.message : error
      });
      
      // If creation fails, try to get the document again in case it was created by another process
      try {
        const retrySnap = await getDoc(chatRef);
        if (!retrySnap.exists) {
          console.warn(`❌ Chat creation failed, but continuing - chat will be created when first message is sent`);
          // Don't throw - allow the flow to continue
        } else {
          console.log(`✅ Chat found on retry: ${chatId}`);
        }
      } catch (retryError) {
        console.warn(`❌ Retry also failed, but continuing:`, retryError);
      }
    }
    
    return chatId;
  },

  async sendMessage(senderId: string, receiverId: string, message: string): Promise<void> {
    console.log('🔍 Starting sendMessage:', { senderId, receiverId, message });
    
    const db = getFirestore();
    
    // First, verify that both users exist and are friends
    try {
      const senderDocRef = doc(db, 'users', senderId);
      const receiverDocRef = doc(db, 'users', receiverId);
      const senderSnap = await getDoc(senderDocRef);
      const receiverSnap = await getDoc(receiverDocRef);
      
      if (!senderSnap.exists()) {
        throw new Error(`Sender user document not found: ${senderId}`);
      }
      if (!receiverSnap.exists()) {
        throw new Error(`Receiver user document not found: ${receiverId}`);
      }
      
      const senderFriends: string[] = (senderSnap.data()?.friends || []) as string[];
      console.log('🔍 Sender friends list:', senderFriends);
      
      if (!senderFriends.includes(receiverId)) {
        throw new Error('You can only chat after the receiver accepts your request.');
      }
    } catch (error) {
      console.error('❌ Error checking user friendship:', error);
      throw error;
    }

    const chatId = this.generateChatId(senderId, receiverId);
    console.log('🔍 Generated chatId:', chatId);
    
    const chatRef = doc(db, CHATS, chatId);
    const messagesRef = collection(db, CHATS, chatId, MESSAGES);
    const newMessageRef = doc(messagesRef);
    
    console.log('🔍 References created');

    try {
      // First, let's try to create just the message without transaction
      console.log('🔍 Creating message document...');
      await setDoc(newMessageRef, {
        senderId: senderId,
        receiverId: receiverId,
        message: message,
        type: 'text',
        status: 'sent',
        timestamp: serverTimestamp(),
        chatId: chatId,
      });
      console.log('✅ Message document created successfully');
      
      // Now update or create the chat document
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
        console.log('🔍 Creating new chat document...');
        
        const chatData = {
          participants: [senderId, receiverId].sort(),
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          unreadCount: {
            [senderId]: 0,
            [receiverId]: 1
          },
          createdBy: senderId,
          createdAt: serverTimestamp(),
        };
        
        console.log('🔍 Chat data to create:', JSON.stringify(chatData, null, 2));
        await setDoc(chatRef, chatData);
        console.log('✅ Chat document created successfully');
      } else {
        console.log('🔍 Updating existing chat document...');
        
        const existingData = chatSnap.data() || {};
        const currentUnreadCount = existingData.unreadCount || {};
        
        await updateDoc(chatRef, {
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          [`unreadCount.${receiverId}`]: (currentUnreadCount[receiverId] || 0) + 1,
        });
        console.log('✅ Chat document updated successfully');
      }
      
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      console.error('❌ Error details:', {
        senderId,
        receiverId,
        message,
        chatId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  },

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    const db = getFirestore();
    const chatRef = doc(db, CHATS, chatId);
    const messagesQuery = query(
      collection(db, CHATS, chatId, MESSAGES),
      where('receiverId', '==', userId),
      where('status', 'in', ['sent', 'delivered'])
    );

    const snapshot = await getDocs(messagesQuery);
    const batch = writeBatch(getFirestore());
    snapshot.docs.forEach((docSnap: any) => {
      batch.update(docSnap.ref, { status: 'read' });
    });
    
    // Update unread count safely
    const updateData: { [key: string]: any } = {};
    updateData[`unreadCount.${userId}`] = 0;
    updateData[`participantData.${userId}.unreadCount`] = 0; // keep legacy schema in sync
    batch.set(chatRef, updateData, { merge: true });
    
    await batch.commit();
  },

  /**
   * Best-effort: Mark messages sent by friend as read and reset unread counters for current user.
   * Useful for legacy messages that may not have receiverId populated.
   */
  async markIncomingFromSenderAsRead(chatId: string, currentUserId: string, friendUserId: string): Promise<void> {
    const db = getFirestore();
    const chatRef = doc(db, CHATS, chatId);
    const messagesQuery = query(
      collection(db, CHATS, chatId, MESSAGES),
      where('senderId', '==', friendUserId),
      where('status', 'in', ['sent', 'delivered'])
    );

    const snap = await getDocs(messagesQuery);
    if (!snap.empty) {
      const batch = writeBatch(getFirestore());
      snap.docs.forEach((docSnap: any) => batch.update(docSnap.ref, { status: 'read' }));
      const updateData: { [key: string]: any } = {};
      updateData[`unreadCount.${currentUserId}`] = 0;
      updateData[`participantData.${currentUserId}.unreadCount`] = 0;
      batch.set(chatRef, updateData, { merge: true });
      await batch.commit();
    } else {
      // Even if none matched, still zero out the counters to keep UI consistent
      await setDoc(chatRef, {
        [`unreadCount.${currentUserId}`]: 0,
        [`participantData.${currentUserId}.unreadCount`]: 0,
      } as any, { merge: true });
    }
  },

  async sendMessageWithReply(
    senderId: string, 
    receiverId: string, 
    message: string, 
    replyTo?: { id: string; text: string; sender: 'user' | 'other' } | null
  ): Promise<void> {
    console.log('🔍 sendMessageWithReply called with:', { senderId, receiverId, message, replyTo });
    
    // Enforce that users must be friends before chatting
    try {
      const [senderSnap, receiverSnap] = await Promise.all([
        getDoc(doc(getFirestore(), USERS, senderId)),
        getDoc(doc(getFirestore(), USERS, receiverId)),
      ]);
      
      console.log('🔍 User documents exist:', { 
        senderExists: senderSnap.exists, 
        receiverExists: receiverSnap.exists 
      });
      
      if (!senderSnap.exists) {
        throw new Error(`Sender user document not found: ${senderId}`);
      }
      if (!receiverSnap.exists) {
        throw new Error(`Receiver user document not found: ${receiverId}`);
      }
      
      const senderFriends: string[] = (senderSnap.data()?.friends || []) as string[];
      console.log('🔍 Sender friends list:', senderFriends);
      
      if (!senderFriends.includes(receiverId)) {
        throw new Error('You can only chat after the receiver accepts your request.');
      }
    } catch (error) {
      console.error('❌ Error checking user friendship:', error);
      throw error;
    }

    const chatId = this.generateChatId(senderId, receiverId);
    console.log('🔍 Generated chatId:', chatId);
    
    const db = getFirestore();
    const chatRef = doc(db, CHATS, chatId);
    const messagesRef = collection(db, CHATS, chatId, MESSAGES);
    const newMessageRef = doc(messagesRef);
    
    console.log('🔍 References created');

    try {
      // Create message data
      const messageData: any = {
        senderId: senderId,
        receiverId: receiverId,
        message: message,
        type: 'text',
        status: 'sent',
        timestamp: serverTimestamp(),
        chatId: chatId,
      };

      // Add reply data if replying to a message
      if (replyTo) {
        messageData.replyTo = {
          messageId: replyTo.id,
          text: replyTo.text,
          senderName: replyTo.sender === 'user' ? 'You' : 'Friend', // You can enhance this with actual names
        };
      }

      // Create the message document
      console.log('🔍 Creating message document...');
      await setDoc(newMessageRef, messageData);
      console.log('✅ Message document created successfully');
      
      // Now update or create the chat document
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
        console.log('🔍 Creating new chat document...');
        
        const chatData = {
          participants: [senderId, receiverId].sort(),
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          unreadCount: {
            [senderId]: 0,
            [receiverId]: 1
          },
          createdBy: senderId,
          createdAt: serverTimestamp(),
        };
        
        console.log('🔍 Chat data to create:', JSON.stringify(chatData, null, 2));
        await setDoc(chatRef, chatData);
        console.log('✅ Chat document created successfully');
      } else {
        console.log('🔍 Updating existing chat document...');
        
        const existingData = chatSnap.data() || {};
        const currentUnreadCount = existingData.unreadCount || {};
        
        await updateDoc(chatRef, {
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          [`unreadCount.${receiverId}`]: (currentUnreadCount[receiverId] || 0) + 1,
        });
        console.log('✅ Chat document updated successfully');
      }
      
    } catch (error) {
      console.error('❌ Error in sendMessageWithReply:', error);
      console.error('❌ Error details:', {
        senderId,
        receiverId,
        message,
        chatId,
        replyTo,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  },

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting message:', { chatId, messageId });
      
      const messageRef = doc(getFirestore(), CHATS, chatId, MESSAGES, messageId);
      
      // Check if message exists and belongs to the user
      const messageDoc = await getDoc(messageRef);
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }
      
      // Delete the message
      await deleteDoc(messageRef);
      
      console.log('✅ Message deleted successfully');
      
      // Update last message in chat if this was the last message
      const db = getFirestore();
    const chatRef = doc(db, CHATS, chatId);
      const remainingMessagesQuery = query(
        collection(db, CHATS, chatId, MESSAGES),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const remainingMessagesSnap = await getDocs(remainingMessagesQuery);
      
      if (remainingMessagesSnap.empty) {
        // No messages left, reset chat
        await updateDoc(chatRef, {
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  // Delete entire chat
  deleteChat: async (chatId: string): Promise<void> => {
    try {
      const batch = writeBatch(getFirestore());
      
      // Delete all messages in the chat
      const messagesRef = collection(getFirestore(), 'chats', chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      messagesSnapshot.docs.forEach((docSnap: any) => {
        batch.delete(docSnap.ref);
      });
      
      // Delete the chat document itself
      const chatRef = doc(getFirestore(), 'chats', chatId);
      batch.delete(chatRef);
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  },

  // Edit a message
  editMessage: async (chatId: string, messageId: string, newMessage: string): Promise<void> => {
    try {
      const messageRef = doc(getFirestore(), 'chats', chatId, 'messages', messageId);
      await updateDoc(messageRef, {
        message: newMessage,
        edited: true,
        editedAt: serverTimestamp(),
      });
      
      // Update the chat document's lastMessage if this was the most recent message
      const messagesRef = collection(getFirestore(), 'chats', chatId, 'messages');
      const lastMessageQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
      const lastMessageSnapshot = await getDocs(lastMessageQuery);
      
      if (!lastMessageSnapshot.empty && lastMessageSnapshot.docs[0].id === messageId) {
        const chatRef = doc(getFirestore(), 'chats', chatId);
        await updateDoc(chatRef, {
          lastMessage: newMessage,
          lastMessageId: messageId,
        });
      }
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  },

  // Forward message to multiple users
  forwardMessage: async (message: any, userIds: string[], senderId: string): Promise<void> => {
    try {
      const forwardPromises = userIds.map(async (receiverId) => {
        const chatId = ChatService.generateChatId(senderId, receiverId);
        const messagesRef = collection(getFirestore(), 'chats', chatId, 'messages');
        const messageRef = doc(messagesRef);

        const forwardedMessage = {
          id: messageRef.id,
          message: message.message || message.text || '',
          senderId,
          receiverId,
          timestamp: serverTimestamp(),
          status: 'sent',
          type: 'text',
          chatId,
          forwarded: true,
          originalMessageId: message.id,
        };

        await setDoc(messageRef, forwardedMessage);

        // Update or create chat document
        const chatRef = doc(getFirestore(), 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (chatDoc.exists()) {
          await updateDoc(chatRef, {
            lastMessage: forwardedMessage.message,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: senderId,
            lastMessageId: messageRef.id,
            [`unreadCount.${receiverId}`]: increment(1),
          });
        } else {
          const chatData = {
            participants: [senderId, receiverId].sort(),
            lastMessage: forwardedMessage.message,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: senderId,
            lastMessageId: messageRef.id,
            unreadCount: { [senderId]: 0, [receiverId]: 1 },
            createdBy: senderId,
            createdAt: serverTimestamp(),
          };
          await setDoc(chatRef, chatData);
        }
      });

      await Promise.all(forwardPromises);
    } catch (error) {
      console.error('Error forwarding message:', error);
      throw error;
    }
  },
};

export type { Chat, ChatMessage };


