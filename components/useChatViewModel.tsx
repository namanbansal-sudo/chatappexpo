// viewmodels/useChatViewModel.ts
import { UserServiceSimple } from '@/services/userServiceSimple';
import { 
  getFirestore,
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy, 
  limit
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
  const [loading, setLoading] = useState(true);
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

    let unsubscribeChats: (() => void) | null = null;

    const loadChats = async () => {
      try {
        setLoading(true);
        
        // Subscribe to real-time chat updates
        unsubscribeChats = ChatService.subscribeToUserChats(
          user.uid,
          (firebaseChats: ChatSimple[]) => {
            setLoading(false);
            setUpdating(true);
            
            // Use setTimeout with 0ms delay to defer heavy async processing (non-blocking)
            setTimeout(() => {
              (async () => {
              try {
                // Process existing chats with denormalized data only
                const existingChatItems = await Promise.all(
                  firebaseChats.map(async (chat) => {
                    const otherParticipantId = chat.participants.find(id => id !== user.uid);
                    if (!otherParticipantId) return null;
                
                    const otherUser = await UserServiceSimple.getUserById(otherParticipantId);
                    if (!otherUser) return null;
                
                    // Use only denormalized fields from chat doc (no subcollection queries)
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
                
                    // Use denormalized unread count only
                    const unread = (chat as any)?.unreadCount?.[user.uid] ?? (chat as any)?.participantData?.[user.uid]?.unreadCount ?? 0;

                    const item: any = {
                      id: chat.id,
                      name: otherUser.name,
                      avatar: otherUser.photo || "",
                      lastMessage,
                      time: timeString,
                      unreadCount: unread,
                      isOnline: otherUser.isOnline || false,
                    } as ChatListItem;
                    (item as any).__sortTs = sortTs;
                    return item;
                  })
                );

              // Debug log computed results once
              try {
                console.log('[useChatViewModel] Computed chat items:',
                  existingChatItems.map((c) => c && (c as any).id ? {
                    id: (c as any).id,
                    lastMessage: (c as any).lastMessage,
                    time: (c as any).time,
                    unreadCount: (c as any).unreadCount,
                  } : c)
                );
              } catch {}

              // Filter out null values
              const validExistingChats: ChatListItem[] = existingChatItems.filter((c): c is ChatListItem => Boolean(c));
              
              // Get user's friends and create chat items for friends without existing chats
              const friendsList: string[] = (user as any).friends || [];
              const existingChatUserIds = new Set(validExistingChats.map(chat => chat.id.split('_').find(id => id !== user.uid)));
              
              let friendChatItems = await Promise.all(
                friendsList
                  .filter((friendId: string) => !existingChatUserIds.has(friendId)) // Only friends without existing chats
                  .map(async (friendId: string) => {
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
                      } as ChatListItem;
                    } catch (error) {
                      console.error('Error creating friend chat item:', error);
                      return null;
                    }
                  })
              );
              // Enhance friend-only items with actual last message if any exist
              friendChatItems = await Promise.all(
                friendChatItems.map(async (item) => {
                  if (!item) return item;
                  try {
                    const messagesRef = collection(getFirestore(), 'chats', item.id, 'messages');
                    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
                    const snap = await getDocs(messagesQuery);
                    if (!snap.empty) {
                      const data: any = snap.docs[0].data();
                      const lm = data.message || data.text || data.content?.text || data.content?.message || '';
                      let timeStr = '';
                      let sortTs = 0;
                      if (data.timestamp) {
                        const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                        sortTs = date.getTime();
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const mDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        if (mDate.getTime() === today.getTime()) {
                          timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } else {
                          const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
                          timeStr = mDate.getTime() === yesterday.getTime() ? 'Yesterday' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }
                      }
                      // Compute unread for current user
                      let unreadCount = 0;
                      try {
                        const unreadQuery = query(
                          messagesRef,
                          where('receiverId', '==', user.uid),
                          where('status', 'in', ['sent', 'delivered'])
                        );
                        const unreadSnap = await getDocs(unreadQuery);
                        unreadCount = unreadSnap.size;
                      } catch {}
                      const updated: any = { ...item, lastMessage: lm || item.lastMessage, time: timeStr, unreadCount } as ChatListItem;
                      updated.__sortTs = sortTs;
                      return updated;
                    }
                  } catch {}
                  return item;
                })
              );
              
              // Filter out null friend chat items
              const validFriendChats: ChatListItem[] = friendChatItems.filter((c): c is ChatListItem => Boolean(c));
              
              // Combine existing chats with friend chats and sort by recent activity
              const allChats = [...validExistingChats, ...validFriendChats].sort((a: any, b: any) => {
                const ta = a.__sortTs || 0;
                const tb = b.__sortTs || 0;
                return tb - ta;
              });
              
                  setChats(allChats);
                } catch (error) {
                  console.error('Error processing chats:', error);
                } finally {
                  setUpdating(false);
                  setRefreshing(false);
                }
              })();
            }, 0);
          }
        );
      } catch (error) {
        console.error('Error loading chats:', error);
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
