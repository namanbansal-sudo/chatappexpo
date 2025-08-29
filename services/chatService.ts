import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { Chat, ChatMessage, ChatSimple } from '../types/models';

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
      const [senderDoc, receiverDoc] = await Promise.all([getDoc(senderDocRef), getDoc(receiverDocRef)]);
      
      console.log('🧪 Sender document:', {
        exists: senderDoc.exists(),
        data: senderDoc.data(),
        id: senderDoc.id,
      });
      
      console.log('🧪 Receiver document:', {
        exists: receiverDoc.exists(), 
        data: receiverDoc.data(),
        id: receiverDoc.id,
      });
      
      if (senderDoc.exists() && receiverDoc.exists()) {
        const senderFriends = senderDoc.data()?.friends || [];
        const receiverFriends = receiverDoc.data()?.friends || [];
        
        console.log('🧪 Friendship status:', {
          senderFriends,
          receiverFriends,
          senderHasReceiver: senderFriends.includes(receiverId),
          receiverHasSender: receiverFriends.includes(senderId),
        });
      } else {
        throw new Error(`User document(s) not found: sender=${senderDoc.exists()}, receiver=${receiverDoc.exists()}`);
      }
    } catch (error) {
      console.error('🧪 Error testing user documents:', error);
      throw error;
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
    const db = getFirestore();
    const chatQuery = query(collection(db, CHATS), where('participants', 'array-contains', userId));

    const unsubscribe = onSnapshot(chatQuery, {
      next: (snapshot) => {
        const firebaseChats: ChatSimple[] = snapshot.docs.map((d: any) => ({
          id: d.id,
          ...d.data(),
        }));
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
        const items: ChatMessage[] = snapshot.docs.map((docSnap: any) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
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
      if (!snap.exists()) {
        const participants = [currentUserId, otherUserId].sort();
        
        console.log(`🔍 Creating chat document ${chatId} with participants:`, participants);
        
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
        
        await setDoc(chatRef, chatData);
        console.log(`✅ Chat created successfully: ${chatId}`);
      } else {
        console.log(`✅ Chat already exists: ${chatId}`);
      }
    } catch (error) {
      console.error(`❌ Error creating chat ${chatId}:`, error);
      try {
        const retrySnap = await getDoc(chatRef);
        if (!retrySnap.exists()) {
          console.warn(`❌ Chat creation failed, but continuing`);
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
    
    try {
      const senderDocRef = doc(db, 'users', senderId);
      const receiverDocRef = doc(db, 'users', receiverId);
      const [senderSnap, receiverSnap] = await Promise.all([getDoc(senderDocRef), getDoc(receiverDocRef)]);
      
      if (!senderSnap.exists()) throw new Error(`Sender user document not found: ${senderId}`);
      if (!receiverSnap.exists()) throw new Error(`Receiver user document not found: ${receiverId}`);
      
      const senderFriends: string[] = senderSnap.data()?.friends || [];
      if (!senderFriends.includes(receiverId)) throw new Error('You can only chat after the receiver accepts your request.');
    } catch (error) {
      console.error('❌ Error checking user friendship:', error);
      throw error;
    }

    const chatId = this.generateChatId(senderId, receiverId);
    const chatRef = doc(db, CHATS, chatId);
    const messagesRef = collection(db, CHATS, chatId, MESSAGES);
    const newMessageRef = doc(messagesRef);
    
    try {
      await setDoc(newMessageRef, {
        senderId,
        receiverId,
        message,
        type: 'text',
        status: 'sent',
        timestamp: serverTimestamp(),
        chatId,
      });
      
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        const chatData = {
          participants: [senderId, receiverId].sort(),
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          unreadCount: { [senderId]: 0, [receiverId]: 1 },
          createdBy: senderId,
          createdAt: serverTimestamp(),
        };
        await setDoc(chatRef, chatData);
      } else {
        const currentUnreadCount = chatSnap.data()?.unreadCount || {};
        await updateDoc(chatRef, {
          lastMessage: message,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          [`unreadCount.${receiverId}`]: (currentUnreadCount[receiverId] || 0) + 1,
        });
      }
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
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
    
    const updateData: { [key: string]: any } = {};
    updateData[`unreadCount.${userId}`] = 0;
    updateData[`participantData.${userId}`] = { unreadCount: 0 };
    batch.set(chatRef, updateData, { merge: true });
    
    await batch.commit();
  },

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
      updateData[`participantData.${currentUserId}`] = { unreadCount: 0 };
      batch.set(chatRef, updateData, { merge: true });
      await batch.commit();
    } else {
      await setDoc(chatRef, {
        [`unreadCount.${currentUserId}`]: 0,
        [`participantData.${currentUserId}`]: { unreadCount: 0 },
      }, { merge: true });
    }
  },

  async sendMessageWithReply(
    senderId: string,
    receiverId: string,
    message: string,
    replyTo?: { messageId: string; text: string; senderId: string; senderName: string } | null,
    media?: { mediaUrl: string; mediaType: "image" | "video" | "audio"; fileName?: string }
  ): Promise<string> {
    console.log('🔍 sendMessageWithReply called with:', { senderId, receiverId, message, replyTo, media });
    
    try {
      const [senderSnap, receiverSnap] = await Promise.all([
        getDoc(doc(getFirestore(), USERS, senderId)),
        getDoc(doc(getFirestore(), USERS, receiverId)),
      ]);
      
      console.log('🔍 User documents exist:', { 
        senderExists: senderSnap.exists(), 
        receiverExists: receiverSnap.exists(),
      });
      
      if (!senderSnap.exists()) throw new Error(`Sender user document not found: ${senderId}`);
      if (!receiverSnap.exists()) throw new Error(`Receiver user document not found: ${receiverId}`);
      
      const senderFriends: string[] = senderSnap.data()?.friends || [];
      if (!senderFriends.includes(receiverId)) throw new Error('You can only chat after the receiver accepts your request.');
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
      const messageData: any = {
        senderId,
        receiverId,
        timestamp: serverTimestamp(),
        chatId,
        status: 'sent',
      };

      if (media) {
        messageData.mediaUrl = media.mediaUrl;
        messageData.mediaType = media.mediaType;
        messageData.fileName = media.fileName || `${media.mediaType}_${newMessageRef.id}`;
        messageData.text = ""; // Empty text for media messages
        messageData.type = media.mediaType; // Set type to image, video, or audio
      } else {
        messageData.text = message || "";
        messageData.type = 'text';
      }

      if (replyTo) {
        messageData.replyTo = {
          messageId: replyTo.messageId,
          text: replyTo.text,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName,
        };
      }

      console.log('🔍 Creating message document with data:', messageData);
      await setDoc(newMessageRef, messageData);
      console.log('✅ Message document created successfully:', newMessageRef.id);
      
      const chatSnap = await getDoc(chatRef);
      let lastMessage: string;
      if (media) {
        if (media.mediaType === 'image') lastMessage = '📷 Image';
        else if (media.mediaType === 'video') lastMessage = '🎥 Video';
        else if (media.mediaType === 'audio') lastMessage = '🎙️ Audio';
        else lastMessage = 'Media';
      } else {
        lastMessage = message || '';
      }
      
      if (!chatSnap.exists()) {
        console.log('🔍 Creating new chat document...');
        const chatData = {
          participants: [senderId, receiverId].sort(),
          lastMessage,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          unreadCount: { [senderId]: 0, [receiverId]: 1 },
          createdBy: senderId,
          createdAt: serverTimestamp(),
        };
        await setDoc(chatRef, chatData);
        console.log('✅ Chat document created successfully');
      } else {
        console.log('🔍 Updating existing chat document...');
        const currentUnreadCount = chatSnap.data()?.unreadCount || {};
        await updateDoc(chatRef, {
          lastMessage,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: senderId,
          lastMessageId: newMessageRef.id,
          [`unreadCount.${receiverId}`]: (currentUnreadCount[receiverId] || 0) + 1,
        });
        console.log('✅ Chat document updated successfully');
      }

      return newMessageRef.id; // Return the new message ID
    } catch (error) {
      console.error('❌ Error in sendMessageWithReply:', error);
      console.error('❌ Error details:', {
        senderId,
        receiverId,
        message,
        chatId,
        replyTo,
        media,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  },

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting message:', { chatId, messageId });
      const messageRef = doc(getFirestore(), CHATS, chatId, MESSAGES, messageId);
      const messageDoc = await getDoc(messageRef);
      if (!messageDoc.exists()) throw new Error('Message not found');
      await deleteDoc(messageRef);
      console.log('✅ Message deleted successfully');
      
      const db = getFirestore();
      const chatRef = doc(db, CHATS, chatId);
      const remainingMessagesQuery = query(
        collection(db, CHATS, chatId, MESSAGES),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const remainingMessagesSnap = await getDocs(remainingMessagesQuery);
      
      if (remainingMessagesSnap.empty) {
        await updateDoc(chatRef, {
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
        });
      } else {
        const lastMessageDoc = remainingMessagesSnap.docs[0];
        const lastMessageData = lastMessageDoc.data();
        let lastMessage: string;
        if (lastMessageData.mediaType) {
          if (lastMessageData.mediaType === 'image') lastMessage = '📷 Image';
          else if (lastMessageData.mediaType === 'video') lastMessage = '🎥 Video';
          else if (lastMessageData.mediaType === 'audio') lastMessage = '🎙️ Audio';
          else lastMessage = 'Media';
        } else {
          lastMessage = lastMessageData.text || '';
        }
        await updateDoc(chatRef, {
          lastMessage,
          lastMessageTime: lastMessageData.timestamp || serverTimestamp(),
          lastMessageSender: lastMessageData.senderId || '',
          lastMessageId: lastMessageDoc.id,
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  async deleteChat(chatId: string): Promise<void> {
    try {
      const batch = writeBatch(getFirestore());
      const messagesRef = collection(getFirestore(), CHATS, chatId, MESSAGES);
      const messagesSnapshot = await getDocs(messagesRef);
      messagesSnapshot.docs.forEach((docSnap: any) => batch.delete(docSnap.ref));
      const chatRef = doc(getFirestore(), CHATS, chatId);
      batch.delete(chatRef);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  },

  async editMessage(chatId: string, messageId: string, newMessage: string): Promise<void> {
    try {
      const messageRef = doc(getFirestore(), CHATS, chatId, MESSAGES, messageId);
      await updateDoc(messageRef, {
        text: newMessage, // Use 'text' to match messageData structure
        edited: true,
        editedAt: serverTimestamp(),
      });
      
      const messagesRef = collection(getFirestore(), CHATS, chatId, MESSAGES);
      const lastMessageQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
      const lastMessageSnapshot = await getDocs(lastMessageQuery);
      
      if (!lastMessageSnapshot.empty && lastMessageSnapshot.docs[0].id === messageId) {
        const chatRef = doc(getFirestore(), CHATS, chatId);
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

  async forwardMessage(message: any, userIds: string[], senderId: string): Promise<void> {
    try {
      console.log('🔍 Forwarding message:', {
        messageId: message.id,
        text: message.text || '',
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        fileName: message.fileName,
        senderId,
        userIds,
      });
  
      const forwardPromises = userIds.map(async (receiverId) => {
        const chatId = ChatService.generateChatId(senderId, receiverId);
        await ChatService.ensureChatExists(senderId, receiverId);
        const messagesRef = collection(getFirestore(), CHATS, chatId, MESSAGES);
        const messageRef = doc(messagesRef);
  
        const forwardedMessage: any = {
          id: messageRef.id,
          text: message.text || '',
          senderId,
          receiverId,
          timestamp: serverTimestamp(),
          status: 'sent',
          chatId,
          forwarded: true,
          originalMessageId: message.id,
        };
  
        if (message.mediaUrl) {
          forwardedMessage.mediaUrl = message.mediaUrl;
          forwardedMessage.mediaType = message.mediaType || 'text';
          forwardedMessage.fileName = message.fileName || `${message.mediaType}_${messageRef.id}`;
          forwardedMessage.type = message.mediaType; // Set type to image, video, or audio
        } else {
          forwardedMessage.type = 'text';
        }
  
        if (message.replyTo) {
          forwardedMessage.replyTo = {
            messageId: message.replyTo.messageId,
            text: message.replyTo.text,
            senderId: message.replyTo.senderId,
            senderName: message.replyTo.senderName,
          };
        }
  
        console.log('🔍 Creating forwarded message document:', forwardedMessage);
        await setDoc(messageRef, forwardedMessage);
  
        const chatRef = doc(getFirestore(), CHATS, chatId);
        const chatDoc = await getDoc(chatRef);
  
        let lastMessage: string;
        if (message.mediaUrl) {
          if (message.mediaType === 'image') lastMessage = '📷 Image';
          else if (message.mediaType === 'video') lastMessage = '🎥 Video';
          else if (message.mediaType === 'audio') lastMessage = '🎙️ Audio';
          else lastMessage = 'Media';
        } else {
          lastMessage = message.text || '';
        }
  
        if (chatDoc.exists()) {
          console.log('🔍 Updating existing chat document:', chatId);
          await updateDoc(chatRef, {
            lastMessage,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: senderId,
            lastMessageId: messageRef.id,
            [`unreadCount.${receiverId}`]: increment(1),
          });
        } else {
          console.log('🔍 Creating new chat document:', chatId);
          const chatData = {
            participants: [senderId, receiverId].sort(),
            lastMessage,
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
      console.log('✅ Message forwarded successfully to:', userIds);
    } catch (error) {
      console.error('❌ Error forwarding message:', error);
      throw error;
    }
  },
};

export type { Chat, ChatMessage };
