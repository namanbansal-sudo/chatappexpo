// app/(tabs)/index.tsx
import { AddFriendPopup } from '../../components/AddFriendPopup';
import { CustomChatItem } from '../../components/customChatItem';
import { CustomSearchInput } from '../../components/customSearchInput';
import { CustomText } from '../../components/customText';
import { useThemeContext } from '../../components/ThemeContext';
import { useUser } from '../../components/UserContext';
import { useChatViewModel } from '../../components/useChatViewModel';
import { ChatService } from '../../services/chatService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, RefreshControl, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Optimized Chat Item Component with long press for delete
const AnimatedChatItem = React.memo(
  ({ item, onPress, onLongPress, theme }: { 
    item: any; 
    onPress: (item: any, animatedValue: Animated.Value) => void;
    onLongPress: (item: any) => void;
    theme: any;
  }) => {
    const animatedValue = useRef(new Animated.Value(1)).current;

    const handlePress = useCallback(() => {
      onPress(item, animatedValue);
    }, [item, onPress, animatedValue]);

    const handleLongPress = useCallback(() => {
      onLongPress(item);
    }, [item, onLongPress]);

    return (
      <Animated.View style={{ transform: [{ scale: animatedValue }] }}>
        <TouchableOpacity onPress={handlePress} onLongPress={handleLongPress}>
          <CustomChatItem
            name={item.name}
            avatar={item.avatar}
            message={item.lastMessage}
            time={item.time}
            unread={item.unreadCount}
            online={item.isOnline}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

export default function ChatScreen() {
  const { selectedTab, setSelectedTab, chats, isEmptyChat, loading, tab, setTab, search, setSearch, counts, updating, refreshing, refreshNow } =
    useChatViewModel();
  const { theme } = useThemeContext();
  const { user } = useUser();
  const router = useRouter();
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);

  // Handle long press on chat item to delete chat
  const handleChatLongPress = useCallback((chat: any) => {
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
              // Refresh the chat list
              if (refreshNow) {
                refreshNow();
              }
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert('Error', 'Failed to delete chat. Please try again.');
            }
          },
        },
      ]
    );
  }, [refreshNow]);

  // Removed auto refresh on focus since real-time listeners handle updates
  // useFocusEffect(
  //   useCallback(() => {
  //     if (refreshNow) {
  //       refreshNow();
  //     }
  //   }, [refreshNow])
  // );

  // Filter chats
  const filteredChats = useMemo(
    () =>
      chats.filter(
        (chat) =>
          chat.name.toLowerCase().includes(search.toLowerCase()) &&
          (tab === 'allTab' || (tab === 'unreadTab' && (chat.unreadCount ?? 0) > 0))
      ),
    [chats, search, tab]
  );

  // Handle tab press
  const handleTabPress = (tabKey: string) => {
    setTab(tabKey);
    const tabLabels = {
      allTab: 'All',
      unreadTab: 'Unread', 
      favoritesTab: 'Favorites',
      groupsTab: 'Groups'
    };
    setSelectedTab(tabLabels[tabKey as keyof typeof tabLabels]);
  };

  // Handle chat press
  const handleChatPress = useCallback(
    (chat: any, animatedValue: Animated.Value) => {
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 0.96, duration: 100, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();

      const friendUserId = chat.id.split('_').find((id: string) => id !== user?.uid);

      router.push({
        pathname: '/(screens)/chatroom',
        params: {
          name: chat.name,
          avatar: chat.avatar,
          userId: friendUserId,
        },
      });
    },
    [router, user?.uid]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Search Input */}
      <CustomSearchInput placeholder="Search chats..." value={search} onChangeText={setSearch} />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 }}>
        {[
          { key: 'allTab', label: 'All' },
          { key: 'unreadTab', label: 'Unread' },
          { key: 'favoritesTab', label: 'Favorites' },
          { key: 'groupsTab', label: 'Groups' }
        ].map(({ key, label }) => {
          const count = counts[key as keyof typeof counts];
          return (
            <TouchableOpacity key={key} onPress={() => handleTabPress(key)}>
              <CustomText fontSize={theme.fonts.sizes.regular} color={theme.colors.text}>
                {label} {count !== null ? count : ''}
              </CustomText>
              {selectedTab === label && <View style={{ height: 2, backgroundColor: theme.colors.primary, marginTop: 5, width: '80%' }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Chats */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <CustomText color={theme.colors.secondaryText} style={{ marginTop: 10 }}>
            Loading chats...
          </CustomText>
        </View>
      ) : isEmptyChat ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="chatbubbles-outline" size={80} color={theme.colors.secondaryText} style={{ marginBottom: 20 }} />
          <CustomText fontSize={theme.fonts.sizes.title} color={theme.colors.text}>
            No Chats Yet
          </CustomText>
          <CustomText color={theme.colors.secondaryText} style={{ textAlign: 'center', marginHorizontal: 40 }}>
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
            renderItem={({ item }) => <AnimatedChatItem item={item} onPress={handleChatPress} onLongPress={handleChatLongPress} theme={theme} />}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl tintColor={theme.colors.primary} colors={[theme.colors.primary]} refreshing={refreshing} onRefresh={refreshNow} />
            }
            removeClippedSubviews
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            windowSize={10}
            getItemLayout={(_, index) => ({ length: 80, offset: 80 * index, index })}
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 }}>
                <CustomText color={theme.colors.secondaryText}>No chats found</CustomText>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 120 }}
          />

          {/* Overlay loader */}
          {updating && (
            <Animated.View
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 1000,
              }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 25,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 8,
                  minWidth: 160,
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator size="small" color={theme.colors.background} style={{ marginRight: 10 }} />
                <CustomText color={theme.colors.background} fontSize={theme.fonts.sizes.regular} style={{ fontWeight: '600' }}>
                  Updating...
                </CustomText>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {/* Add Friend Button */}
      <TouchableOpacity
        onPress={() => setShowAddFriendPopup(true)}
        style={{
          position: 'absolute',
          bottom: 80,
          right: 20,
          backgroundColor: theme.colors.primary,
          borderRadius: 30,
          width: 60,
          height: 60,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        <Ionicons name="person-add" size={24} color={theme.colors.background} />
      </TouchableOpacity>

      {/* Add Friend Popup */}
      <AddFriendPopup visible={showAddFriendPopup} onClose={() => setShowAddFriendPopup(false)} />
    </SafeAreaView>
  );
}
