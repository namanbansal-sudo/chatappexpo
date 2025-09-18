import * as QuickActions from 'expo-quick-actions';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Types
export interface RecentChat {
  id: string;
  name: string;
  lastMessage?: string;
  friendUserId: string;
}

// Define your quick actions - only camera for now
export const quickActions: QuickActions.Action[] = [
  {
    title: 'Camera',
    subtitle: 'Quick capture',
    icon: Platform.OS === 'ios' ? 'camera' : undefined,
    id: 'camera',
    params: { route: 'camera' }
  }
];

// Check if quick actions are supported
export const isQuickActionsSupported = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

// Handle quick action when app is launched
export const handleQuickAction = (action: QuickActions.Action | null): void => {
  if (!action) return;

  const { id, params } = action;
  
  console.log('Quick action triggered:', { id, params });
  
  switch (id) {
    case 'camera':
      // Open standalone camera-forward flow (no chatroom)
      router.push({ pathname: '/(screens)/camera-forward' });
      break;
    default:
      if (id.startsWith('chat_')) {
        const chatId = id.replace('chat_', '');
        // Extract friendUserId from params
        const friendUserId = (params as any)?.friendUserId;
        const name = (params as any)?.name;
        if (friendUserId) {
          router.push({ 
            pathname: '/(screens)/chatroom', 
            params: { friendUserId, name } 
          });
        } else {
          // Fallback: try to fetch from stored recent chats
          (async () => {
            try {
              const recents = await getRecentChats();
              const matched = recents.find(rc => rc.id === chatId);
              if (matched?.friendUserId) {
                router.push({ pathname: '/(screens)/chatroom', params: { friendUserId: matched.friendUserId, name: matched.name } });
              } else {
                console.log('No friendUserId found for chat:', chatId);
                router.push('/(tabs)');
              }
            } catch (e) {
              router.push('/(tabs)');
            }
          })();
        }
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
    
    // Create chat actions for top 3 chats
    const chatActions: QuickActions.Action[] = recentChats.slice(0, 3).map((chat, index) => ({
      title: chat.name || `Chat ${index + 1}`,
      subtitle: chat.lastMessage || 'No messages',
      icon: Platform.OS === 'ios' ? 'person' : undefined,
      id: `chat_${chat.id}`,
      params: { 
        friendUserId: chat.friendUserId,
        chatId: chat.id,
        name: chat.name || `Chat ${index + 1}`
      }
    }));

    // Combine camera action with chat actions
    const allActions = [
      ...quickActions, // camera action
      ...chatActions   // top 3 chat actions
    ];

    console.log('Setting quick actions:', allActions);
    await QuickActions.setItems(allActions);
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

// Replace the recent chats list (atomic) and refresh quick actions
export const replaceRecentChats = async (chats: RecentChat[]): Promise<void> => {
  try {
    const limited = chats.slice(0, 10);
    await AsyncStorage.setItem('recent_chats', JSON.stringify(limited));
    await updateQuickActionsWithRecentChats();
  } catch (error) {
    console.error('Error replacing recent chats:', error);
  }
};