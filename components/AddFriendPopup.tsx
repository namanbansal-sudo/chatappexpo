// components/AddFriendPopup.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '../types/models';
import { CustomText } from './customText';
import { useThemeContext } from './ThemeContext';
import { useUser } from './UserContext';
import { UserServiceSimple } from '@/services/userServiceSimple';
import { FriendRequestService } from '@/services/friendRequestService';

interface AddFriendPopupProps {
  visible: boolean;
  onClose: () => void;
}

interface SearchResultUser extends User {
  isAlreadyFriend: boolean;
  hasRequestSent: boolean;
}

export const AddFriendPopup: React.FC<AddFriendPopupProps> = ({ visible, onClose }) => {
  const { theme } = useThemeContext();
  const { user: currentUser, refreshUserData } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [allUsers, setAllUsers] = useState<SearchResultUser[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]); // receiverIds
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  const enhanceUsers = async (users: User[]): Promise<SearchResultUser[]> => {
    const currentFriends = currentUser?.friends || [];
    return users.map((user) => ({
      ...user,
      isAlreadyFriend: currentFriends.includes(user.uid),
      hasRequestSent: sentRequests.includes(user.uid),
    }));
  };

  const handleSearch = async (query: string) => {
    if (!currentUser?.uid) return;
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      console.log('AddFriendPopup search start', query);
      const users = await UserServiceSimple.searchUsers(query.trim(), currentUser.uid);
      console.log('AddFriendPopup search results count', users.length);
      const enhancedUsers = await enhanceUsers(users);
      setSearchResults(enhancedUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUser: SearchResultUser) => {
    if (!currentUser?.uid) {
      Alert.alert('Error', 'Please log in to send friend requests.');
      return;
    }

    try {
      setSendingRequest(targetUser.uid);
      
      await FriendRequestService.sendFriendRequest(
        currentUser.uid,
        targetUser.uid,
        {
          uid: currentUser.uid,
          name: (currentUser as any).name || (currentUser as any).displayName || 'Unknown',
          email: (currentUser as any).email || '',
          photo: (currentUser as any).photoURL || (currentUser as any).photo || '',
          designation: (currentUser as any).designation || 'User',
          isOnline: true,
        },
        {
          uid: targetUser.uid,
          name: targetUser.name,
          email: targetUser.email,
          photo: targetUser.photo,
        }
      );

      // Update the search result to show request sent
      setSearchResults(prev => 
        prev.map(user => 
          user.uid === targetUser.uid 
            ? { ...user, hasRequestSent: true }
            : user
        )
      );

      // Also update the all users list
      setAllUsers(prev =>
        prev.map(user =>
          user.uid === targetUser.uid
            ? { ...user, hasRequestSent: true }
            : user
        )
      );

      Alert.alert('Success', `Friend request sent to ${targetUser.name}!`);
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', error.message || 'Failed to send friend request. Please try again.');
    } finally {
      setSendingRequest(null);
    }
  };

  const renderUserItem = ({ item }: { item: SearchResultUser }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.inputBackground,
    }}>
      <Image
        source={{ uri: item.photo || 'https://via.placeholder.com/50' }}
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          marginRight: 15,
        }}
      />
      
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CustomText fontSize={theme.fonts.sizes.regular} color={theme.colors.text}>
            {item.name}
          </CustomText>
          {item.isOnline && (
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#4CAF50',
              marginLeft: 8,
            }} />
          )}
        </View>
        <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.secondaryText}>
          {item.email}
        </CustomText>
      </View>

      {item.isAlreadyFriend ? (
        <View style={{
          backgroundColor: theme.colors.secondaryText,
          paddingHorizontal: 15,
          paddingVertical: 8,
          borderRadius: 20,
        }}>
          <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.background}>
            Friend
          </CustomText>
        </View>
      ) : item.hasRequestSent ? (
        <View style={{
          backgroundColor: theme.colors.inputBackground,
          paddingHorizontal: 15,
          paddingVertical: 8,
          borderRadius: 20,
        }}>
          <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.secondaryText}>
            Request Sent
          </CustomText>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => handleSendRequest(item)}
          disabled={sendingRequest === item.uid}
          style={{
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 15,
            paddingVertical: 8,
            borderRadius: 20,
            opacity: sendingRequest === item.uid ? 0.5 : 1,
          }}
        >
          {sendingRequest === item.uid ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.background}>
              Send Request
            </CustomText>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const resetState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setLoading(false);
    setSendingRequest(null);
    setAllUsers([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Fetch sent requests once and subscribe for live updates
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribeSent = FriendRequestService.subscribeToSentRequests(
      currentUser.uid,
      (requests) => {
        setSentRequests(requests.map((r) => r.receiverId));
      }
    );
    return () => unsubscribeSent();
  }, [currentUser?.uid]);

  // Fetch all users on open and when popup becomes visible
  useEffect(() => {
    const fetchAll = async () => {
      if (!currentUser?.uid || !visible) return;
      setLoading(true);
      try {
        // Refresh user data to get latest friends list
        await refreshUserData();
        
        const users = await UserServiceSimple.getAllUsers(currentUser.uid, 100);
        console.log('AddFriendPopup all users count', users.length);
        const enhanced = await enhanceUsers(users);
        setAllUsers(enhanced);
      } catch (e) {
        console.error('Error loading users:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [visible, currentUser?.uid, currentUser?.friends?.length, sentRequests.length]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 15,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.inputBackground,
        }}>
          <TouchableOpacity onPress={handleClose} style={{ marginRight: 15 }}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <CustomText fontSize={theme.fonts.sizes.title} color={theme.colors.text}>
            Add Friend
          </CustomText>
        </View>

        {/* Search Input */}
        <View style={{ padding: 15 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.inputBackground,
            borderRadius: 25,
            paddingHorizontal: 15,
            paddingVertical: 10,
          }}>
            <Ionicons name="search" size={20} color={theme.colors.secondaryText} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 10,
                color: theme.colors.text,
                fontSize: theme.fonts.sizes.regular,
              }}
              placeholder="Search by name or email..."
              placeholderTextColor={theme.colors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loading && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
          </View>
        </View>

        {/* Results */}
        <View style={{ flex: 1 }}>
          {(searchQuery.trim() ? searchResults.length > 0 : allUsers.length > 0) ? (
            <FlatList
              data={searchQuery.trim() ? searchResults : allUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.uid}
              showsVerticalScrollIndicator={false}
            />
          ) : searchQuery.trim() && !loading ? (
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 40,
            }}>
              <Ionicons name="search" size={80} color={theme.colors.secondaryText} />
              <CustomText
                fontSize={theme.fonts.sizes.title}
                color={theme.colors.text}
                style={{ textAlign: 'center', marginTop: 20, marginBottom: 10 }}
              >
                No users found
              </CustomText>
              <CustomText
                fontSize={theme.fonts.sizes.regular}
                color={theme.colors.secondaryText}
                style={{ textAlign: 'center' }}
              >
                Try searching with a different name or email
              </CustomText>
            </View>
          ) : !searchQuery.trim() ? (
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 40,
            }}>
              <Ionicons name="people" size={80} color={theme.colors.secondaryText} />
              <CustomText
                fontSize={theme.fonts.sizes.title}
                color={theme.colors.text}
                style={{ textAlign: 'center', marginTop: 20, marginBottom: 10 }}
              >
                Find Friends
              </CustomText>
              <CustomText
                fontSize={theme.fonts.sizes.regular}
                color={theme.colors.secondaryText}
                style={{ textAlign: 'center' }}
              >
                Browse the list or search by name/email to send friend requests
              </CustomText>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
};
