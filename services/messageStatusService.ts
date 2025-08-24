// services/messageStatusService.ts
import { getFirestore, collection, doc, getDocs, getDoc, updateDoc, writeBatch, query, where, onSnapshot } from '@react-native-firebase/firestore';

const CHATS = 'chats';
const MESSAGES = 'messages';

export const MessageStatusService = {
  /**
   * Mark all messages in a chat as read for the current user
   */
  async markChatAsRead(chatId: string, userId: string): Promise<void> {
    try {
      const batch = getFirestore().batch();
      
      // Update all unread messages to read status
      const messagesQuery = query(
        collection(getFirestore(), CHATS, chatId, MESSAGES),
        where('receiverId', '==', userId),
        where('status', 'in', ['sent', 'delivered'])
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      
      messagesSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'read' });
      });
      
      // Reset unread count for this user in the chat document
      const chatRef = doc(getFirestore(), CHATS, chatId);
      const updateData: { [key: string]: number } = {};
      updateData[`unreadCount.${userId}`] = 0;
      batch.update(chatRef, updateData);
      
      await batch.commit();
      
      console.log(`✅ Marked chat ${chatId} as read for user ${userId}`);
    } catch (error) {
      console.error('❌ Error marking chat as read:', error);
      throw error;
    }
  },

  /**
   * Mark specific messages as read
   */
  async markMessagesAsRead(chatId: string, messageIds: string[], userId: string): Promise<void> {
    try {
      const batch = getFirestore().batch();
      
      // Update specific messages to read status
      for (const messageId of messageIds) {
        const messageRef = doc(getFirestore(), CHATS, chatId, MESSAGES, messageId);
        
        batch.update(messageRef, { status: 'read' });
      }
      
      // Update unread count - we need to count remaining unread messages
      const unreadQuery = query(
        collection(getFirestore(), CHATS, chatId, MESSAGES),
        where('receiverId', '==', userId),
        where('status', 'in', ['sent', 'delivered'])
      );
      
      const unreadSnapshot = await getDocs(unreadQuery);
      const remainingUnreadCount = Math.max(0, unreadSnapshot.size - messageIds.length);
      
      const chatRef = doc(getFirestore(), CHATS, chatId);
      const updateData: { [key: string]: number } = {};
      updateData[`unreadCount.${userId}`] = remainingUnreadCount;
      batch.update(chatRef, updateData);
      
      await batch.commit();
      
      console.log(`✅ Marked ${messageIds.length} messages as read for user ${userId}`);
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      throw error;
    }
  },

  /**
   * Get unread message count for a user in a specific chat
   */
  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    try {
      const chatDoc = await getDoc(doc(getFirestore(), CHATS, chatId));
      
      if (!chatDoc.exists()) {
        return 0;
      }
      
      const chatData = chatDoc.data();
      const unreadCount = chatData?.unreadCount?.[userId] || 0;
      
      return unreadCount;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  },

  /**
   * Get total unread message count across all chats for a user
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      const chatsQuery = query(
        collection(getFirestore(), CHATS),
        where('participants', 'array-contains', userId)
      );
      
      const chatsSnapshot = await getDocs(chatsQuery);
      
      let totalUnread = 0;
      chatsSnapshot.docs.forEach((doc) => {
        const chatData = doc.data();
        const unreadCount = chatData?.unreadCount?.[userId] || 0;
        totalUnread += unreadCount;
      });
      
      return totalUnread;
    } catch (error) {
      console.error('❌ Error getting total unread count:', error);
      return 0;
    }
  },

  /**
   * Subscribe to real-time unread count updates for all user's chats
   */
  subscribeToUnreadCounts(userId: string, onChange: (totalUnread: number) => void): () => void {
    const chatsQuery = query(
      collection(getFirestore(), CHATS),
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(chatsQuery, {
      next: (snapshot) => {
        let totalUnread = 0;
        snapshot.docs.forEach((doc) => {
          const chatData = doc.data();
          const unreadCount = chatData?.unreadCount?.[userId] || 0;
          totalUnread += unreadCount;
        });
        
        onChange(totalUnread);
      },
      error: (error) => {
        console.error('❌ Error subscribing to unread counts:', error);
        onChange(0);
      },
    });

    return unsubscribe;
  },

  /**
   * Mark message as delivered (when received by the app)
   */
  async markMessageAsDelivered(chatId: string, messageId: string): Promise<void> {
    try {
      const messageRef = doc(getFirestore(), CHATS, chatId, MESSAGES, messageId);
      
      await updateDoc(messageRef, { status: 'delivered' });
      
      console.log(`✅ Marked message ${messageId} as delivered`);
    } catch (error) {
      console.error('❌ Error marking message as delivered:', error);
      // Don't throw error for delivery status updates
    }
  },

  /**
   * Subscribe to message status updates for a specific chat
   */
  subscribeToMessageStatus(
    chatId: string,
    userId: string,
    onChange: (unreadCount: number) => void
  ): () => void {
    const chatRef = doc(getFirestore(), CHATS, chatId);

    const unsubscribe = onSnapshot(chatRef, {
      next: (doc) => {
        if (doc.exists()) {
          const chatData = doc.data();
          const unreadCount = chatData?.unreadCount?.[userId] || 0;
          onChange(unreadCount);
        } else {
          onChange(0);
        }
      },
      error: (error) => {
        console.error('❌ Error subscribing to message status:', error);
        onChange(0);
      },
    });

    return unsubscribe;
  },
};

export default MessageStatusService;
