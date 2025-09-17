// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    StatusBar,
    RefreshControl,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddFriendPopup } from '../../components/AddFriendPopup';
import { CustomChatItem } from '../../components/customChatItem';
import { CustomSearchInput } from '../../components/customSearchInput';
import { CustomText } from '../../components/CustomText';
import { useThemeContext } from '../../components/ThemeContext';
import { useChatViewModel } from '../../components/useChatViewModel';
import { useUser } from '../../components/UserContext';
import { ChatService } from '../../services/chatService';
import { User, UserServiceSimple } from '../../services/userServiceSimple';

// ✅ Optimized Chat Item Component
const AnimatedChatItem = React.memo(
  ({ item, onPress, onLongPress, theme }: { 
    item: any; 
    onPress: (item: any, animatedValue: Animated.Value) => void;
    onLongPress: (item: any) => void;
    theme: any;
  }) => {
    const animatedValue = useRef(new Animated.Value(1)).current;

    return (
      <Animated.View style={{ transform: [{ scale: animatedValue }] }}>
        <TouchableOpacity
          onPress={() => onPress(item, animatedValue)}
          onLongPress={() => onLongPress(item)}
        >
          <CustomChatItem
            name={item.name}
            avatar={item.avatar}
            message={item.lastMessage}
            time={item.time}
            unread={item.unreadCount}
            online={item.isOnline} // This will show real-time status
          />
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

export default function ChatScreen() {
  const {
    selectedTab,
    setSelectedTab,
    chats,
    isEmptyChat,
    tab,
    setTab,
    search,
    setSearch,
    counts,
    updating,
    refreshing,
    refreshNow,
  } = useChatViewModel();

  const { theme, isDark } = useThemeContext();
  const { user } = useUser();
  const router = useRouter();
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const [userStatusListeners, setUserStatusListeners] = useState<(() => void)[]>([]);
  const insets = useSafeAreaInsets();

  // ✅ Listen for online status changes of users in chats
  useEffect(() => {
    if (!user?.uid || chats.length === 0) return;

    // Clear previous listeners
    userStatusListeners.forEach(unsubscribe => unsubscribe());
    
    const newListeners: (() => void)[] = [];
    const statusMap: Record<string, boolean> = {};

    // Set up listeners for each chat's friend user
    chats.forEach(chat => {
      const chatUserIds = chat.id.split('_');
      const friendId = chatUserIds.find((id: string) => id !== user.uid);
      
      if (friendId) {
        const unsubscribe = UserServiceSimple.onUserStatusChange(friendId, (userData: User | null) => {
          if (userData) {
            setOnlineStatuses(prev => ({
              ...prev,
              [friendId]: userData.isOnline || false
            }));
          }
        });
        
        newListeners.push(unsubscribe);
      }
    });

    setUserStatusListeners(newListeners);

    return () => {
      newListeners.forEach(unsubscribe => unsubscribe());
    };
  }, [user?.uid, chats]);

// ✅ Enhance chats with real-time online status
const chatsWithOnlineStatus = useMemo(() => {
  const enhancedChats = chats.map(chat => {
    const chatUserIds = chat.id.split('_');
    const friendId = chatUserIds.find((id: string) => id !== user?.uid);
    const isOnline = friendId ? onlineStatuses[friendId] || false : false;
    
    return {
      ...chat,
      isOnline: isOnline
    };
  });
  
  return enhancedChats;
}, [chats, onlineStatuses, user?.uid]);

  // ✅ Delete chat
  const handleChatLongPress = useCallback(
    (chat: any) => {
      Alert.alert(
        'Delete Chat',
        `Are you sure you want to delete the chat with ${chat.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await ChatService.deleteChat(chat.id);
                if (refreshNow) refreshNow();
              } catch (error) {
                console.error('Error deleting chat:', error);
                Alert.alert('Error', 'Failed to delete chat. Please try again.');
              }
            },
          },
        ]
      );
    },
    [refreshNow]
  );

  // ✅ Filter chats
  const filteredChats = useMemo(
    () =>
      chatsWithOnlineStatus.filter(
        (chat) =>
          chat.name.toLowerCase().includes(search.toLowerCase()) &&
          (tab === 'allTab' ||
            (tab === 'unreadTab' && (chat.unreadCount ?? 0) > 0))
      ),
    [chatsWithOnlineStatus, search, tab]
  );

  // ✅ Tab change
  const handleTabPress = (tabKey: string) => {
    setTab(tabKey);
    const tabLabels = {
      allTab: 'All',
      unreadTab: 'Unread',
      favoritesTab: 'Favorites',
      groupsTab: 'Groups',
    };
    setSelectedTab(tabLabels[tabKey as keyof typeof tabLabels]);
  };

  // ✅ Chat press → Go to Chatroom
  const handleChatPress = useCallback(
    (chat: any, animatedValue: Animated.Value) => {
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.96,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      const friendUserId = chat.id
        .split('_')
        .find((id: string) => id !== user?.uid);

      router.push({
        pathname: '/(screens)/chatroom',
        params: {
          name: chat.name,
          avatar: chat.avatar,
          currentUserId: user?.uid,
          friendUserId,
        },
      });
    },
    [router, user?.uid]
  );

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.inputBackground }}
   >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <View style={{ height: insets.top }} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* ✅ Search */}
      <CustomSearchInput
        placeholder="Search chats..."
        value={search}
        onChangeText={setSearch}
      />

      {/* ✅ Tabs */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginBottom: 10,
        }}
      >
        {[
          { key: 'allTab', label: 'All' },
          { key: 'unreadTab', label: 'Unread' },
          { key: 'favoritesTab', label: 'Favorites' },
          { key: 'groupsTab', label: 'Groups' },
        ].map(({ key, label }) => {
          const count = counts[key as keyof typeof counts];
          return (
            <TouchableOpacity key={key} onPress={() => handleTabPress(key)}>
              <CustomText
                fontSize={theme.fonts.sizes.regular}
                color={theme.colors.text}
              >
                {label} {count !== null ? count : ''}
              </CustomText>
              {selectedTab === label && (
                <View
                  style={{
                    height: 2,
                    backgroundColor: theme.colors.primary,
                    marginTop: 5,
                    width: '80%',
                  }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ✅ Chat List */}
      {isEmptyChat ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons
            name="chatbubbles-outline"
            size={80}
            color={theme.colors.secondaryText}
            style={{ marginBottom: 20 }}
          />
          <CustomText fontSize={theme.fonts.sizes.title} color={theme.colors.text}>
            No Chats Yet
          </CustomText>
          <CustomText
            color={theme.colors.secondaryText}
            style={{ textAlign: 'center', marginHorizontal: 40 }}
          >
            Start connecting with friends to begin chatting!
          </CustomText>
          <TouchableOpacity
            onPress={() => setShowAddFriendPopup(true)}
            style={{
              marginTop: 20,
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <CustomText color={theme.colors.background}>Add Friends</CustomText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1, position: 'relative' }}>
          <FlatList
            data={filteredChats}
            renderItem={({ item }) => (
              <AnimatedChatItem
                item={item}
                onPress={handleChatPress}
                onLongPress={handleChatLongPress}
                theme={theme}
              />
            )}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
                refreshing={refreshing}
                onRefresh={refreshNow}
              />
            }
            removeClippedSubviews
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            windowSize={10}
            getItemLayout={(_, index) => ({
              length: 80,
              offset: 80 * index,
              index,
            })}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 50,
                }}
              >
                <CustomText color={theme.colors.secondaryText}>
                  No chats found
                </CustomText>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 120 }}
          />
        </View>
      )}

      {/* ✅ Add Friend Popup */}
      <AddFriendPopup
        visible={showAddFriendPopup}
        onClose={() => setShowAddFriendPopup(false)}
      />
    </View>
  </SafeAreaView>
);
}