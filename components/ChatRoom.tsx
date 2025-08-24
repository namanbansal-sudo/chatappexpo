// app/(tabs)/chatroom.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CustomText } from './customText';
import { useThemeContext } from './ThemeContext';
import { useLanguage } from '@/i18n';
import { useUser } from './UserContext';
import { useLocalSearchParams } from 'expo-router';
import { ChatService } from '@/services/chatService';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { MessageContextMenu } from './MessageContextMenu';
import { ForwardMessagePopup } from './ForwardMessagePopup';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'other';
  time: string;
  timestamp: Date;
  replyTo?: string;
  edited?: boolean;
}

interface MessageWithHeader extends Message {
  showDateHeader?: boolean;
  dateHeaderText?: string;
}

interface ChatMessage extends Message {
  message?: string;
}

export default function ChatRoom() {
  const params = useLocalSearchParams<{
    name?: string | string[];
    avatar?: string | string[];
    userId?: string | string[];
  }>();

  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;
  const avatarParam = Array.isArray(params.avatar) ? params.avatar[0] : params.avatar;
  const userIdParam = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const name = nameParam || 'Chat';
  const avatar = avatarParam || '';
  const friendUserId = userIdParam;

  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const { user } = useUser();

  const [messages, setMessages] = useState<MessageWithHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    message: Message | null;
    position: { x: number; y: number };
  }>({ visible: false, message: null, position: { x: 0, y: 0 } });
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [forwardPopup, setForwardPopup] = useState<{
    visible: boolean;
    message: Message | null;
  }>({ visible: false, message: null });

  const flatListRef = useRef<FlatList<MessageWithHeader>>(null);

  // -------- Helpers --------
  const getDateHeaderText = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) return 'Today';
    if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';

    const currentYear = now.getFullYear();
    const messageYear = date.getFullYear();

    if (messageYear === currentYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const addDateHeaders = (messageList: Message[]): MessageWithHeader[] => {
    if (messageList.length === 0) return [];
    const out: MessageWithHeader[] = [];
    let lastHeader = '';
    messageList.forEach((m) => {
      const header = getDateHeaderText(m.timestamp);
      if (header !== lastHeader) {
        out.push({ ...m, showDateHeader: true, dateHeaderText: header });
        lastHeader = header;
      } else {
        out.push(m);
      }
    });
    return out;
  };

  // -------- Realtime subscription --------
  useEffect(() => {
    if (!user?.uid || !friendUserId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = ChatService.subscribeToMessages(
        user.uid,
        friendUserId,
        (firebaseMessages: ChatMessage[]) => {
          const formatted: Message[] = firebaseMessages.map((msg) => {
            const date = msg.timestamp?.toDate
              ? msg.timestamp.toDate()
              : msg.timestamp
              ? new Date(msg.timestamp)
              : new Date();
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return {
              id: msg.id,
              text: (msg as any).content?.text || (msg as any).message || (msg as any).text || '',
              sender: msg.senderId === user.uid ? 'user' : 'other',
              time: timeString,
              timestamp: date,
              edited: (msg as any).edited || false,
              replyTo: msg.replyTo
                ? {
                    messageId: (msg.replyTo as any).messageId,
                    text: (msg.replyTo as any).text,
                    senderName: (msg.replyTo as any).senderName || ((msg.replyTo as any).senderId ? 'Friend' : 'You'),
                  }
                : undefined,
            };
          });

          const withHeaders = addDateHeaders(formatted);
          setMessages(withHeaders);
          setLoading(false);

          const chatId = ChatService.generateChatId(user.uid, friendUserId);
          // Mark as read shortly after messages load to ensure we catch any just-delivered ones
          setTimeout(() => {
            ChatService.markMessagesAsRead(chatId, user.uid)
              .then(() => {
                console.log('✅ Messages marked as read successfully');
              })
              .catch(() => {
                console.log('⚠️ Fallback: using markIncomingFromSenderAsRead');
                return ChatService.markIncomingFromSenderAsRead(chatId, user.uid!, friendUserId!);
              })
              .catch((error) => {
                console.error('❌ Failed to mark messages as read:', error);
              });
          }, 100);
        }
      );
    } catch (e) {
      console.error('Error setting up message listener:', e);
      setLoading(false);
    }

    return () => {
      unsubscribe?.();
    };
  }, [user?.uid, friendUserId]);

  // Mark messages as read when entering the chat (optimized)
  useEffect(() => {
    if (!user?.uid || !friendUserId) return;
    const chatId = ChatService.generateChatId(user.uid, friendUserId);
    
    // Single mark as read operation
    ChatService.markMessagesAsRead(chatId, user.uid!)
      .catch(() => ChatService.markIncomingFromSenderAsRead(chatId, user.uid!, friendUserId!))
      .catch(() => {}); // Silent fail for better performance
  }, [user?.uid, friendUserId]);

  // -------- Actions --------
  const handleReply = (message: Message) => setReplyingTo(message);

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setNewMessage(message.text);
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const handleSaveEdit = useCallback(async () => {
    if (!newMessage.trim() || !editingMessage || !user?.uid || !friendUserId || sending) return;

    const messageToSave = newMessage.trim();
    const originalMessage = editingMessage;

    // Clear edit state immediately
    setEditingMessage(null);
    setNewMessage('');

    try {
      setSending(true);
      const chatId = ChatService.generateChatId(user.uid, friendUserId);
      await ChatService.editMessage(chatId, originalMessage.id, messageToSave);
    } catch (e) {
      console.error('Error editing message:', e);
      // Revert on failure
      setEditingMessage(originalMessage);
      setNewMessage(messageToSave);
      Alert.alert('Error', 'Failed to edit message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [newMessage, editingMessage, sending, user?.uid, friendUserId]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user?.uid || !friendUserId || sending) return;

    // If editing, save the edit instead
    if (editingMessage) {
      return handleSaveEdit();
    }

    const messageToSend = newMessage.trim();
    const replyData = replyingTo;

    // Optimistic UI: clear immediately
    setNewMessage('');
    setReplyingTo(null);

    try {
      setSending(true);
      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
      await ChatService.sendMessageWithReply(user.uid, friendUserId, messageToSend, replyData);
    } catch (e) {
      console.error('Error sending message:', e);
      // revert on failure
      setNewMessage(messageToSend);
      setReplyingTo(replyData);
    } finally {
      setSending(false);
    }
  }, [newMessage, replyingTo, editingMessage, sending, user?.uid, friendUserId, handleSaveEdit]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.uid || !friendUserId) return;

    setDeletingMessageId(messageId);
    try {
      const chatId = ChatService.generateChatId(user.uid, friendUserId);
      await ChatService.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleForwardMessage = async (userIds: string[], message: any) => {
    if (!user?.uid) return;

    try {
      await ChatService.forwardMessage(message, userIds, user.uid);
      Alert.alert(t('common.success'), t('chat.messageForwarded'));
    } catch (error) {
      console.error('Error forwarding message:', error);
      Alert.alert(t('common.error'), t('chat.forwardError'));
    }
  };

  const handleLongPress = (message: Message, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setContextMenu({
      visible: true,
      message,
      position: { x: pageX, y: pageY },
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, message: null, position: { x: 0, y: 0 } });
  };

  const handleContextMenuEdit = (message: any) => {
    handleEditMessage(message);
    closeContextMenu();
  };

  const handleContextMenuDelete = (messageId: string) => {
    handleDeleteMessage(messageId);
    closeContextMenu();
  };

  const handleContextMenuForward = (message: any) => {
    setForwardPopup({ visible: true, message });
    closeContextMenu();
  };

  const closeForwardPopup = () => {
    setForwardPopup({ visible: false, message: null });
  };

  // -------- Rendering --------
  const renderRightAction = (message: Message) => (
    <TouchableOpacity
      onPress={() => handleReply(message)}
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        width: 50,
        backgroundColor: theme.colors.primary,
        marginVertical: 2,
        borderRadius: 12,
      }}
    >
      <Ionicons name="arrow-undo" size={20} color="white" />
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: MessageWithHeader }) => {
    const isUser = item.sender === 'user';
    const bubbleBg = isUser ? theme.colors.primary : theme.colors.inputBackground;
    const msgColor = isUser ? '#FFFFFF' : theme.colors.text;
    const timeColor = isUser ? 'rgba(255,255,255,0.8)' : theme.colors.secondaryText;

    const Bubble = (
      <View
        style={{
          flexDirection: isUser ? 'row-reverse' : 'row',
          marginVertical: 2,
          paddingHorizontal: 10,
        }}
      >
        <TouchableOpacity
          onLongPress={(event) => handleLongPress(item, event)}
          delayLongPress={500}
          style={{
            backgroundColor: bubbleBg,
            borderRadius: 12,
            padding: 10,
            maxWidth: '70%',
            marginBottom: 3,
            opacity: deletingMessageId === item.id ? 0.5 : 1,
          }}
          activeOpacity={0.9}
          disabled={deletingMessageId === item.id}
        >
          {item.replyTo && (
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.08)',
                borderRadius: 8,
                padding: 8,
                marginBottom: 8,
                borderLeftWidth: 3,
                borderLeftColor: isUser ? 'rgba(255,255,255,0.5)' : theme.colors.primary,
              }}
            >
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={isUser ? 'rgba(255,255,255,0.9)' : theme.colors.secondaryText}
                fontWeight="500"
              >
                {item.replyTo.senderName}
              </CustomText>
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={isUser ? 'rgba(255,255,255,0.85)' : theme.colors.secondaryText}
                numberOfLines={1}
              >
                {item.replyTo.text}
              </CustomText>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CustomText color={msgColor} style={{ flex: 1 }}>{item.text}</CustomText>
            {deletingMessageId === item.id && (
              <ActivityIndicator 
                size="small" 
                color={isUser ? 'rgba(255,255,255,0.8)' : theme.colors.primary} 
                style={{ marginLeft: 8 }}
              />
            )}
          </View>
          
          {(item as any).edited && (
            <CustomText
              fontSize={theme.fonts.sizes.small}
              color={timeColor}
              style={{ fontStyle: 'italic', marginTop: 2 }}
            >
              edited
            </CustomText>
          )}

          <CustomText
            fontSize={theme.fonts.sizes.small}
            color={timeColor}
            style={{ textAlign: isUser ? 'right' : 'left', marginTop: 2 }}
          >
            {item.time}
          </CustomText>
        </TouchableOpacity>
      </View>
    );

    return (
      <>
        {item.showDateHeader && (
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <View
              style={{
                backgroundColor: theme.colors.inputBackground,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
              }}
            >
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={theme.colors.secondaryText}
                fontWeight="500"
              >
                {item.dateHeaderText}
              </CustomText>
            </View>
          </View>
        )}

        <Swipeable renderRightActions={() => renderRightAction(item)} friction={2} rightThreshold={40}>
          {Bubble}
        </Swipeable>
      </>
    );
  };

  // Keep list scrolled to bottom on new messages
  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Height of your top header area for iOS offset
  const IOS_HEADER_OFFSET = 90; // tweak if needed

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} // use padding on both to avoid hiding on Android
        keyboardVerticalOffset={Platform.OS === 'ios' ? IOS_HEADER_OFFSET : 0}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
              backgroundColor: theme.colors.inputBackground,
            }}
          >
            <Image
              source={{ uri: avatar || 'https://via.placeholder.com/40' }}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
            />
            <CustomText fontSize={theme.fonts.sizes.regular} color={theme.colors.text}>
              {name}
            </CustomText>

            <View style={{ marginLeft: 'auto', flexDirection: 'row' }}>
              <TouchableOpacity style={{ paddingHorizontal: 4 }}>
                <Ionicons name="call-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 4 }}>
                <Ionicons name="videocam-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <CustomText color={theme.colors.secondaryText} style={{ marginTop: 10 }}>
                Loading messages...
              </CustomText>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 10, paddingBottom: 8 }}
              ListEmptyComponent={
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 50,
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={60} color={theme.colors.secondaryText} />
                  <CustomText
                    fontSize={theme.fonts.sizes.title}
                    color={theme.colors.text}
                    style={{ textAlign: 'center', marginTop: 20 }}
                  >
                    Start the conversation
                  </CustomText>
                  <CustomText
                    color={theme.colors.secondaryText}
                    style={{ textAlign: 'center', marginHorizontal: 40, marginTop: 10 }}
                  >
                    Send a message to start chatting with {name}
                  </CustomText>
                </View>
              }
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* Edit/Reply preview + Input */}
          <View>
            {editingMessage && (
              <View
                style={{
                  backgroundColor: theme.colors.inputBackground,
                  marginHorizontal: 10,
                  marginBottom: 8,
                  padding: 12,
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: '#FFA500',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>  
                  <View style={{ flex: 1 }}>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={'#FFA500'}
                      fontWeight="500"
                    >
                      Editing message
                    </CustomText>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.secondaryText}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {editingMessage.text}
                    </CustomText>
                  </View>
                  <TouchableOpacity onPress={handleCancelEdit} style={{ marginLeft: 10 }}>
                    <Ionicons name="close" size={20} color={theme.colors.secondaryText} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {replyingTo && !editingMessage && (
              <View
                style={{
                  backgroundColor: theme.colors.inputBackground,
                  marginHorizontal: 10,
                  marginBottom: 8,
                  padding: 12,
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: theme.colors.primary,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.primary}
                      fontWeight="500"
                    >
                      {t('chat.replyingTo')} {replyingTo.sender === 'user' ? t('chat.you') : name}
                    </CustomText>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.secondaryText}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {replyingTo.text}
                    </CustomText>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 10 }}>
                    <Ionicons name="close" size={20} color={theme.colors.secondaryText} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.inputBackground,
                  borderRadius: 20,
                  padding: 10,
                  color: theme.colors.text,
                  marginRight: 10,
                }}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder={
                  editingMessage
                    ? t('chat.editYourMessage')
                    : replyingTo
                    ? t('chat.replyTo', { name: replyingTo.sender === 'user' ? t('chat.yourself') : name })
                    : t('chat.typeMessage')
                }
                placeholderTextColor={theme.colors.secondaryText}
                onFocus={() => flatListRef.current?.scrollToEnd({ animated: true })}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim()}>
                <Ionicons
                  name={editingMessage ? "checkmark" : "send"}
                  size={24}
                  color={newMessage.trim() ? theme.colors.primary : theme.colors.secondaryText}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Message Context Menu */}
          <MessageContextMenu
            visible={contextMenu.visible}
            onClose={closeContextMenu}
            message={contextMenu.message}
            onDelete={handleContextMenuDelete}
            onEdit={handleContextMenuEdit}
            onForward={handleContextMenuForward}
            position={contextMenu.position}
            isOwnMessage={contextMenu.message?.sender === 'user'}
          />

          {/* Forward Message Popup */}
          <ForwardMessagePopup
            visible={forwardPopup.visible}
            onClose={closeForwardPopup}
            message={forwardPopup.message}
            onForward={handleForwardMessage}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}
