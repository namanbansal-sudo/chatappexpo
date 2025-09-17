import * as QuickActions from 'expo-quick-actions';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Types
export interface QuickActionItem {
  title: string;
  subtitle?: string;
  icon: string;
  id: string;
  params: {
    screen: string;
    params?: Record<string, any>;
  };
}

export interface RecentChat {
  id: string;
  name: string;
  lastMessage?: string;
}

// Define your quick actions
export const quickActions: Record<string, QuickActionItem> = {
  newChat: {
    title: 'New Chat',
    subtitle: 'Start a new conversation',
    icon: Platform.OS === 'ios' ? 'compose' : 'ic_chat',
    id: 'new_chat',
    params: { screen: 'new-chat' }
  },
  recentChats: {
    title: 'Recent Chats',
    subtitle: 'View your conversations',
    icon: Platform.OS === 'ios' ? 'message' : 'ic_message',
    id: 'recent_chats',
    params: { screen: 'chats' }
  },
  search: {
    title: 'Search',
    subtitle: 'Find messages and contacts',
    icon: Platform.OS === 'ios' ? 'search' : 'ic_search',
    id: 'search',
    params: { screen: 'search' }
  }
};

// Set up quick actions
export const setupQuickActions = async (): Promise<void> => {
  try {
    if (!isQuickActionsSupported()) return;
    
    await QuickActions.setItems([
      QuickActions.QuickActionItem(quickActions.newChat),
      QuickActions.QuickActionItem(quickActions.recentChats),
      QuickActions.QuickActionItem(quickActions.search),
    ]);
  } catch (error) {
    console.error('Error setting up quick actions:', error);
  }
};

// Check if quick actions are supported
export const isQuickActionsSupported = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

// Handle quick action when app is launched
export const handleQuickAction = (action: QuickActions.Action | null): void => {
  if (!action) return;

  const { id, params } = action;
  
  switch (id) {
    case 'new_chat':
      router.push('/new-chat');
      break;
    case 'recent_chats':
      router.push('/chats');
      break;
    case 'search':
      router.push('/search');
      break;
    default:
      if (id.startsWith('chat_')) {
        const chatId = id.replace('chat_', '');
        router.push({
          pathname: '/chat',
          params: { chatId }
        });
      } else {
        console.log('Unknown quick action:', id);
      }
  }
};

// Get recent chats from storage
export const getRecentChats = async (): Promise<RecentChat[]> => {
  try {
    const recentChats = await AsyncStorage.getItem('recent_chats');
    return recentChats ? JSON.parse(recentChats) : [];
  } catch (error) {
    console.error('Error getting recent chats:', error);
    return [];
  }
};

// Update quick actions with recent chats
export const updateQuickActionsWithRecentChats = async (): Promise<void> => {
  try {
    if (!isQuickActionsSupported()) return;
    
    const recentChats = await getRecentChats();
    const chatActions = recentChats.slice(0, 3).map((chat, index) => 
      QuickActions.QuickActionItem({
        title: chat.name || 'Unknown Chat',
        subtitle: chat.lastMessage || 'No messages',
        icon: Platform.OS === 'ios' ? 'person' : 'ic_person',
        id: `chat_${chat.id}`,
        params: { 
          screen: 'chat', 
          params: { chatId: chat.id } 
        }
      })
    );

    const defaultActions = [
      QuickActions.QuickActionItem(quickActions.newChat),
      QuickActions.QuickActionItem(quickActions.search)
    ];

    await QuickActions.setItems([...defaultActions, ...chatActions]);
  } catch (error) {
    console.error('Error updating quick actions:', error);
  }
};

// Add a recent chat to storage and update quick actions
export const addRecentChat = async (chat: RecentChat): Promise<void> => {
  try {
    const recentChats = await getRecentChats();
    
    // Remove existing chat with same ID if it exists
    const filteredChats = recentChats.filter(c => c.id !== chat.id);
    
    // Add new chat to the beginning of the array
    const updatedChats = [chat, ...filteredChats].slice(0, 10); // Keep only 10 most recent
    
    await AsyncStorage.setItem('recent_chats', JSON.stringify(updatedChats));
    
    // Update quick actions
    await updateQuickActionsWithRecentChats();
  } catch (error) {
    console.error('Error adding recent chat:', error);
  }
};