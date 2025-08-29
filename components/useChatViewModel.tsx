// viewmodels/useChatViewModel.ts
import { UserServiceSimple } from '@/services/userServiceSimple';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where
} from '@react-native-firebase/firestore';
import { useEffect, useState } from 'react';
import { ChatService } from '../services/chatService';
import { Chat, ChatListItem, ChatSimple } from '../types/models';
import { useUser } from './UserContext';

interface ChatCounts {
  allTab: number;
  unreadTab: number;
  favoritesTab: number | null;
  groupsTab: number | null;
}

export const useChatViewModel = () => {
  const { user } = useUser();
  const [selectedTab, setSelectedTab] = useState('All');
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('allTab');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Load chats from Firebase and combine with friends list
  useEffect(() => {
    if (!user?.uid) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribeChats: (() => void) | null = null;

    const loadChats = async () => {
      try {
        console.log('🔄 Setting up real-time chat subscription for user:', user.uid);
        // Subscribe to real-time chat updates immediately
        unsubscribeChats = ChatService.subscribeToUserChats(
          user.uid,
          (firebaseChats: ChatSimple[]) => {
            console.log('📱 Real-time chat update received:', firebaseChats.length, 'chats');
            // Process immediately without setTimeout to ensure real-time updates
            processChats(firebaseChats);
          }
        );
      } catch (error) {
        console.error('Error loading chats:', error);
        setLoading(false);
      }
    };

    const processChats = async (firebaseChats: ChatSimple[]) => {
      try {
        console.log('🔄 Processing', firebaseChats.length, 'Firebase chats');
        
        // Process existing chats with proper async handling
        const existingChatItems: ChatListItem[] = [];
        
        // Process chats in parallel for better performance
        const chatPromises = firebaseChats.map(async (chat) => {
          const otherParticipantId = chat.participants.find(id => id !== user.uid);
          if (!otherParticipantId) return null;
          
          try {
            const otherUser = await UserServiceSimple.getUserById(otherParticipantId);
            if (!otherUser) return null;
            
            // Use denormalized data for instant display
            let lastMessage = "Start a conversation";
            let timeString = "";
            let sortTs = 0;

            const anyChat: any = chat as any;
            const lmValue = anyChat?.lastMessage;
            const lmTimeValue = anyChat?.lastMessageTime ?? anyChat?.lastMessage?.timestamp;

            const lmText = typeof lmValue === 'string' ? lmValue : (lmValue?.text ?? lmValue?.message ?? undefined);
            if (lmText && lmText.trim().length > 0) {
              lastMessage = lmText;
            }

            if (lmTimeValue) {
              const date = lmTimeValue.toDate ? lmTimeValue.toDate() : new Date(lmTimeValue);
              sortTs = date.getTime();
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

              if (messageDate.getTime() === today.getTime()) {
                timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              } else {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (messageDate.getTime() === yesterday.getTime()) {
                  timeString = "Yesterday";
                } else {
                  timeString = date.toLocaleDateString([], { month: "short", day: "numeric" });
                }
              }
            }
            
            // Use denormalized unread count
            const unread = (chat as any)?.unreadCount?.[user.uid] ?? (chat as any)?.participantData?.[user.uid]?.unreadCount ?? 0;

            const item: ChatListItem = {
              id: chat.id,
              name: otherUser.name,
              avatar: otherUser.photo || "",
              lastMessage,
              time: timeString,
              unreadCount: unread,
              isOnline: otherUser.isOnline || false,
            };
            (item as any).__sortTs = sortTs;
            return item;
          } catch (error) {
            console.error('Error processing chat:', error);
            return null;
          }
        });

        const resolvedChats = await Promise.all(chatPromises);
        existingChatItems.push(...resolvedChats.filter(Boolean) as ChatListItem[]);

        // Get user's friends and create chat items for friends without existing chats
        const friendsList: string[] = (user as any).friends || [];
        const existingChatUserIds = new Set(existingChatItems.map(chat => chat.id.split('_').find(id => id !== user.uid)));
        
        const friendPromises = friendsList
          .filter(friendId => !existingChatUserIds.has(friendId))
          .map(async (friendId) => {
            try {
              const friendUser = await UserServiceSimple.getUserById(friendId);
              if (!friendUser) return null;
              
              const chatId = ChatService.generateChatId(user.uid, friendId);
              
              return {
                id: chatId,
                name: friendUser.name,
                avatar: friendUser.photo || '',
                lastMessage: 'Start a conversation',
                time: '',
                unreadCount: 0,
                isOnline: friendUser.isOnline || false,
              };
            } catch (error) {
              console.error('Error creating friend chat item:', error);
              return null;
            }
          });

        const friendChatItems = await Promise.all(friendPromises);
        const validFriendChats = friendChatItems.filter(Boolean) as ChatListItem[];
        
        // Combine and sort chats
        const allChats = [...existingChatItems, ...validFriendChats].sort((a: any, b: any) => {
          const ta = a.__sortTs || 0;
          const tb = b.__sortTs || 0;
          return tb - ta;
        });
        
        console.log('✅ Processed chats:', allChats.length, 'total chats');
        setChats(allChats);
      } catch (error) {
        console.error('Error processing chats:', error);
      } finally {
        setUpdating(false);
        setRefreshing(false);
        setLoading(false);
      }
    };

    loadChats();

    return () => {
      if (unsubscribeChats) {
        unsubscribeChats();
      }
    };
  }, [user?.uid]);

  // Manual refresh: one-off fetch to rebuild chat list with latest snapshots
  const refreshNow = async () => {
    if (!user?.uid) return;
    try {
      setRefreshing(true);
      setUpdating(true);
      const chatsRef = collection(getFirestore(), 'chats');
      const chatsQuery = query(chatsRef, where('participants', 'array-contains', user.uid));
      const snap = await getDocs(chatsQuery);
      const firebaseChats: Chat[] = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
      // Reuse core of mapping by simulating a one-time callback
      const items = await Promise.all(
        firebaseChats.map(async (chat) => {
          const otherParticipantId = chat.participants.find(id => id !== user.uid);
          if (!otherParticipantId) return null as any;
          const otherUser = await UserServiceSimple.getUserById(otherParticipantId);
          if (!otherUser) return null as any;
          let lastMessage = 'Start a conversation';
          let timeString = '';
          let sortTs = 0;
          try {
            const messagesRef = collection(getFirestore(), 'chats', chat.id, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
            const ms = await getDocs(messagesQuery);
            if (!ms.empty) {
              const data: any = ms.docs[0].data();
              lastMessage = data.message || data.text || data.content?.text || data.content?.message || lastMessage;
              if (data.timestamp) {
                const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                sortTs = date.getTime();
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                timeString = d0.getTime() === today.getTime()
                  ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              }
            }
          } catch {}
          const unread = (chat as any)?.unreadCount?.[user.uid] ?? (chat as any)?.participantData?.[user.uid]?.unreadCount ?? 0;
          const item: any = {
            id: chat.id,
            name: otherUser.name,
            avatar: otherUser.photo || '',
            lastMessage,
            time: timeString,
            unreadCount: unread,
            isOnline: otherUser.isOnline || false,
          } as ChatListItem;
          item.__sortTs = sortTs;
          return item;
        })
      );
      const valid = items.filter(Boolean) as any[];

      // Friend fallback for users without existing chat docs
      const friendsList: string[] = ((user as any).friends || []) as string[];
      const existingChatUserIds = new Set(
        valid.map((c: any) => (c.id as string).split('_').find((id: string) => id !== user.uid))
      );
      const friendFallback = await Promise.all(
        friendsList
          .filter((fid) => !existingChatUserIds.has(fid))
          .map(async (fid) => {
            try {
              const friendUser = await UserServiceSimple.getUserById(fid);
              if (!friendUser) return null as any;
              const chatId = ChatService.generateChatId(user.uid, fid);
              // Try to fetch last message if any exists
              let lastMessage = 'Start a conversation';
              let timeString = '';
              let sortTs = 0;
              try {
                const messagesRef = collection(getFirestore(), 'chats', chatId, 'messages');
                const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
                const ms = await getDocs(messagesQuery);
                if (!ms.empty) {
                  const data: any = ms.docs[0].data();
                  lastMessage = data.message || data.text || data.content?.text || data.content?.message || lastMessage;
                  if (data.timestamp) {
                    const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                    sortTs = date.getTime();
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    timeString = d0.getTime() === today.getTime()
                      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  }
                }
              } catch {}
              const fallback: any = {
                id: chatId,
                name: friendUser.name,
                avatar: friendUser.photo || '',
                lastMessage,
                time: timeString,
                unreadCount: 0,
                isOnline: friendUser.isOnline || false,
              } as ChatListItem;
              fallback.__sortTs = sortTs;
              return fallback;
            } catch {
              return null as any;
            }
          })
      );

      const combined = [...valid, ...friendFallback.filter(Boolean)] as any[];
      combined.sort((a: any, b: any) => (b.__sortTs || 0) - (a.__sortTs || 0));
      setChats(combined as ChatListItem[]);
    } catch (e) {
      console.error('Manual refresh failed:', e);
    } finally {
      setRefreshing(false);
      setUpdating(false);
    }
  };

  // Calculate counts
  const counts: ChatCounts = {
    allTab: chats.length,
    unreadTab: chats.reduce((sum, chat) => sum + chat.unreadCount, 0),
    favoritesTab: null, // Can implement favorites later
    groupsTab: null, // Can implement groups later
  };

  // Check if chats are empty (avoid flashing empty state during manual refresh)
  const isEmptyChat = chats.length === 0 && !loading && !refreshing;

  return {
    chats,
    selectedTab,
    setSelectedTab,
    isEmptyChat,
    loading,
    tab,
    setTab,
    search,
    setSearch,
    counts,
    refreshing,
    refreshNow,
    updating,
  };
};
