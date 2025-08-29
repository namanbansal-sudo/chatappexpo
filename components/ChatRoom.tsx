import { useLanguage } from "@/i18n";
import { ChatService } from "@/services/chatService";
import { uploadToCloudinary } from "@/services/cloudinary";
import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomText } from "./customText";
import { ForwardMessagePopup } from "./ForwardMessagePopup";
import { MessageContextMenu } from "./MessageContextMenu";
import { useThemeContext } from "./ThemeContext";
import { useUser } from "./UserContext";

// Define the params type outside the component
interface ChatRoomParams {
  name?: string | string[];
  avatar?: string | string[];
  userId?: string | string[];
  friendUserId?: string | string[];
  currentUserId?: string | string[];
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "other";
  time: string;
  timestamp: Date;
  replyTo?: {
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
  };
  edited?: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  fileName?: string;
  isUploading?: boolean;
}

interface MessageWithHeader extends Message {
  showDateHeader?: boolean;
  dateHeaderText?: string;
}

interface FirebaseChatMessage {
  id: string;
  senderId: string;
  timestamp: any;
  content?: {
    text?: string;
  };
  message?: string;
  text?: string;
  replyTo?: any;
  edited?: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
}

export default function ChatRoom() {
  const params = useLocalSearchParams<ChatRoomParams>();

  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;
  const avatarParam = Array.isArray(params.avatar) ? params.avatar[0] : params.avatar;
  const userIdParam = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const friendUserIdParam = Array.isArray(params.friendUserId) ? params.friendUserId[0] : params.friendUserId;

  const name = nameParam || "Chat";
  const avatar = avatarParam || "";
  const friendUserId = friendUserIdParam || userIdParam;

  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const { user } = useUser();
  const router = useRouter();

  const [messages, setMessages] = useState<MessageWithHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  const [newMessage, setNewMessage] = useState("");
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
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: "image" | "video" | "audio" } | null>(null);

  const flatListRef = useRef<FlatList<MessageWithHeader>>(null);

  // -------- Helpers --------
  const getDateHeaderText = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) return "Today";
    if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";

    const currentYear = now.getFullYear();
    const messageYear = date.getFullYear();

    if (messageYear === currentYear) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const addDateHeaders = (messageList: Message[]): MessageWithHeader[] => {
    if (messageList.length === 0) return [];
    const out: MessageWithHeader[] = [];

    messageList.forEach((m, index) => {
      const header = getDateHeaderText(m.timestamp);
      if (index === 0 || getDateHeaderText(messageList[index - 1].timestamp) !== header) {
        out.push({ ...m, showDateHeader: true, dateHeaderText: header });
      } else {
        out.push(m);
      }
    });

    return out;
  };

  // -------- Audio Functions --------
  const requestPermission = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      return permission.status === "granted";
    } catch (error) {
      console.error("Error requesting audio permissions:", error);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(t("common.error"), t("chat.microphonePermissionRequired"));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      console.error("Error starting recording:", error);
      Alert.alert(t("common.error"), t("chat.recordingStartError"));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setRecording(null);
      if (uri) {
        await handleAudioUpload(uri);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      Alert.alert(t("common.error"), t("chat.recordingStopError"));
    }
  };

  const playAudio = async (uri: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (error) {
      console.error("Error playing audio:", error);
      Alert.alert(t("common.error"), t("chat.audioPlaybackError"));
    }
  };

  const uploadAudio = async (uri: string) => {
    const formData = new FormData();
    formData.append("file", {
      uri,
      type: "audio/m4a",
      name: "voice-note.m4a",
    } as any); // Type cast to bypass TypeScript issues with FormData
    formData.append("upload_preset", "chatsupp_Preset");

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/upload", // Replace YOUR_CLOUD_NAME with your actual Cloudinary cloud name
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading audio to Cloudinary:", error);
      throw error;
    }
  };

  const handleAudioUpload = async (uri: string) => {
    if (!user?.uid || !friendUserId || uploading) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: "",
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: new Date(),
      mediaUrl: uri,
      mediaType: "audio",
      fileName: "voice-note.m4a",
      isUploading: true,
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.sender === "user" ? user.uid : friendUserId || "",
            senderName: replyingTo.sender === "user" ? "You" : name,
          }
        : undefined,
    };

    const updatedMessages = [optimisticMessage, ...messages];
    if (messages.length === 0 || getDateHeaderText(optimisticMessage.timestamp) !== getDateHeaderText(messages[0].timestamp)) {
      updatedMessages[0] = { ...optimisticMessage, showDateHeader: true, dateHeaderText: getDateHeaderText(optimisticMessage.timestamp) };
    }
    setMessages(updatedMessages);
    setReplyingTo(null);
    setAudioUri(null);

    try {
      setUploading(true);
      const cloudinaryUrl = await uploadAudio(uri);

      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
      const newMessageId = await ChatService.sendMessageWithReply(user.uid, friendUserId, "", replyingTo, {
        mediaUrl: cloudinaryUrl,
        mediaType: "audio",
        fileName: "voice-note.m4a",
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: newMessageId,
                text: "",
                mediaUrl: cloudinaryUrl,
                isUploading: false,
              }
            : m
        )
      );
    } catch (error) {
      console.error("Error uploading audio:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert(t("common.error"), t("chat.audioUploadError"));
    } finally {
      setUploading(false);
    }
  };

  // -------- Realtime subscription --------
  useEffect(() => {
    if (!user?.uid || !friendUserId) {
      console.log("❌ Missing user or friendUserId:", { user: user?.uid, friendUserId });
      setLoading(false);
      return;
    }

    console.log("🔄 Setting up message subscription for:", { user: user.uid, friendUserId });
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = ChatService.subscribeToMessages(user.uid, friendUserId, (firebaseMessages: FirebaseChatMessage[]) => {
        console.log("📱 Received messages:", firebaseMessages.length);
        const formatted: Message[] = firebaseMessages.map((msg) => {
          const date = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp || 0);
          const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return {
            id: msg.id,
            text: msg.content?.text || msg.message || msg.text || "",
            sender: msg.senderId === user.uid ? "user" : "other",
            time: timeString,
            timestamp: date,
            edited: msg.edited || false,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType as "image" | "video" | "audio" | undefined,
            replyTo: msg.replyTo && typeof msg.replyTo === "object"
              ? {
                  messageId: msg.replyTo.messageId || msg.replyTo.id || "",
                  text: msg.replyTo.text || "",
                  senderId: msg.replyTo.senderId || "",
                  senderName: msg.replyTo.senderName || "",
                }
              : undefined,
          };
        });

        const sortedMessages = formatted.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const withHeaders = addDateHeaders(sortedMessages);
        const reversedWithHeaders = withHeaders.reverse();
        setMessages(reversedWithHeaders);
        setLoading(false);

        if (!initialMessagesLoaded && formatted.length > 0) {
          setInitialMessagesLoaded(true);
        }

        const chatId = ChatService.generateChatId(user.uid, friendUserId);
        ChatService.markMessagesAsRead(chatId, user.uid)
          .then(() => console.log("✅ Messages marked as read successfully"))
          .catch((error) => {
            console.log("⚠️ Fallback: using markIncomingFromSenderAsRead");
            return ChatService.markIncomingFromSenderAsRead(chatId, user.uid!, friendUserId!);
          })
          .catch((error) => console.error("❌ Failed to mark messages as read:", error));
      });
    } catch (e) {
      console.error("Error setting up message listener:", e);
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, [user?.uid, friendUserId]);

  useEffect(() => {
    if (!user?.uid || !friendUserId) return;
    const chatId = ChatService.generateChatId(user.uid, friendUserId);

    const markAsRead = () => {
      ChatService.markMessagesAsRead(chatId, user.uid!)
        .catch(() => ChatService.markIncomingFromSenderAsRead(chatId, user.uid!, friendUserId!))
        .catch(() => {});
    };

    markAsRead();
    const interval = setInterval(markAsRead, 2000);

    return () => clearInterval(interval);
  }, [user?.uid, friendUserId]);

  const handleReply = (message: Message) => setReplyingTo(message);

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setNewMessage(message.text);
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNewMessage("");
  };

  const handleSaveEdit = useCallback(async () => {
    if (!newMessage.trim() || !editingMessage || !user?.uid || !friendUserId || sending) return;

    const messageToSave = newMessage.trim();
    const originalMessage = editingMessage;

    setEditingMessage(null);
    setNewMessage("");

    try {
      setSending(true);
      const chatId = ChatService.generateChatId(user.uid, friendUserId);
      await ChatService.editMessage(chatId, originalMessage.id, messageToSave);
    } catch (e) {
      console.error("Error editing message:", e);
      setEditingMessage(originalMessage);
      setNewMessage(messageToSave);
      Alert.alert(t("common.error"), t("chat.editError"));
    } finally {
      setSending(false);
    }
  }, [newMessage, editingMessage, sending, user?.uid, friendUserId]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user?.uid || !friendUserId || sending) return;

    if (editingMessage) return handleSaveEdit();

    const messageToSend = newMessage.trim();
    const replyData = replyingTo;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: messageToSend,
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: new Date(),
      replyTo: replyData
        ? {
            messageId: replyData.id,
            text: replyData.text,
            senderId: replyData.sender === "user" ? user.uid : friendUserId || "",
            senderName: replyData.sender === "user" ? "You" : name,
          }
        : undefined,
    };

    const updatedMessages = [optimisticMessage, ...messages];
    if (messages.length === 0 || getDateHeaderText(optimisticMessage.timestamp) !== getDateHeaderText(messages[0].timestamp)) {
      updatedMessages[0] = { ...optimisticMessage, showDateHeader: true, dateHeaderText: getDateHeaderText(optimisticMessage.timestamp) };
    }
    setMessages(updatedMessages);
    setNewMessage("");
    setReplyingTo(null);

    try {
      setSending(true);
      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
      await ChatService.sendMessageWithReply(user.uid, friendUserId, messageToSend, replyData);
    } catch (e) {
      console.error("Error sending message:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(messageToSend);
      setReplyingTo(replyData);
      Alert.alert(t("common.error"), t("chat.sendError"));
    } finally {
      setSending(false);
    }
  }, [newMessage, replyingTo, editingMessage, sending, user?.uid, friendUserId, handleSaveEdit, messages]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.uid || !friendUserId) return;

    setDeletingMessageId(messageId);
    try {
      const chatId = ChatService.generateChatId(user.uid, friendUserId);
      await ChatService.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert(t("common.error"), t("chat.deleteError"));
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleLongPress = (message: Message, event: any) => {
    console.log("Long press message:", { id: message.id, mediaUrl: message.mediaUrl, mediaType: message.mediaType, text: message.text });
    const { pageX, pageY } = event.nativeEvent;
    setContextMenu({ visible: true, message, position: { x: pageX, y: pageY } });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, message: null, position: { x: 0, y: 0 } });
  };

  const handleContextMenuEdit = (message: Message) => {
    handleEditMessage(message);
    closeContextMenu();
  };

  const handleContextMenuDelete = (messageId: string) => {
    handleDeleteMessage(messageId);
    closeContextMenu();
  };

  const handleContextMenuForward = (message: Message) => {
    setForwardPopup({ visible: true, message });
    closeContextMenu();
  };

  const handleContextMenuCopy = (message: Message) => {
    handleCopy(message);
    closeContextMenu();
  };

  const handleContextMenuDownload = (message: Message) => {
    handleDownload(message);
    closeContextMenu();
  };

  const handleCopy = async (message: Message) => {
    if (message.text) {
      await Clipboard.setStringAsync(message.text);
      Alert.alert(t("common.success"), t("chat.messageCopied"));
    } else if (message.mediaType === "image" && message.mediaUrl) {
      try {
        const fileUri = `${FileSystem.cacheDirectory}temp_image_${Date.now()}.jpg`;
        const { uri } = await FileSystem.downloadAsync(message.mediaUrl, fileUri);
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        await Clipboard.setImageAsync(base64);
        Alert.alert(t("common.success"), t("chat.imageCopied"));
      } catch (error) {
        console.error("Error copying image:", error);
        Alert.alert(t("common.error"), t("chat.copyError"));
      }
    } else if (message.mediaType === "video" && message.mediaUrl) {
      await Clipboard.setStringAsync(message.mediaUrl);
      Alert.alert(t("common.success"), t("chat.videoUrlCopied"));
    } else if (message.mediaType === "audio" && message.mediaUrl) {
      await Clipboard.setStringAsync(message.mediaUrl);
      Alert.alert(t("common.success"), t("chat.audioUrlCopied"));
    } else {
      Alert.alert(t("common.error"), t("chat.nothingToCopy"));
    }
  };

  const handleDownload = async (message: Message) => {
    if (!message.mediaUrl) {
      console.error("No media URL provided for download");
      Alert.alert(t("common.error"), t("chat.downloadError"));
      return;
    }

    try {
      console.log("Requesting media library permissions");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.error("Media library permission denied");
        Alert.alert(t("common.error"), t("chat.permissionRequired"));
        return;
      }

      console.log("Downloading file from:", message.mediaUrl);
      const fileExtension = message.mediaType === "image" ? "jpg" : message.mediaType === "video" ? "mp4" : "m4a";
      const fileUri = `${FileSystem.cacheDirectory}media_${Date.now()}.${fileExtension}`;
      const downloadResult = await FileSystem.downloadAsync(message.mediaUrl, fileUri);
      console.log("Download result:", { uri: downloadResult.uri, status: downloadResult.status });

      if (downloadResult.status !== 200) {
        console.error("Download failed with status:", downloadResult.status);
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      console.log("Saving file to gallery:", downloadResult.uri);
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync("ChatMedia", asset, false);
      console.log("File saved successfully:", asset);

      Alert.alert(t("common.success"), t("chat.mediaSaved"));
    } catch (error) {
      console.error("Error downloading media:", error);
      Alert.alert(t("common.error"), `${t("chat.downloadError")}: ${(error as Error).message || "Unknown error"}`);
    }
  };

  const handleForwardMessage = async (userIds: string[], message: Message) => {
    setForwardPopup({ visible: false, message: null });

    try {
      console.log("Forwarding message:", message);
      await ChatService.forwardMessage(message, userIds, user?.uid || "");
      Alert.alert(t("common.success"), t("chat.messageForwarded"));
    } catch (error) {
      console.error("Error forwarding message:", error);
      Alert.alert(t("common.error"), t("chat.forwardError"));
    }
  };

  const pickImage = async () => {
    setShowMediaOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleMediaUpload(result.assets[0].uri, "image", result.assets[0].fileName || "image.jpg");
    }
  };

  const pickVideo = async () => {
    setShowMediaOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleMediaUpload(result.assets[0].uri, "video", result.assets[0].fileName || "video.mp4");
    }
  };

  const takePhoto = async () => {
    setShowMediaOptions(false);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleMediaUpload(result.assets[0].uri, "image", result.assets[0].fileName || "photo.jpg");
    }
  };

  const handleMediaUpload = async (uri: string, type: "image" | "video", fileName: string) => {
    if (!user?.uid || !friendUserId || uploading) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: "",
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: new Date(),
      mediaUrl: uri,
      mediaType: type,
      fileName,
      isUploading: true,
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.sender === "user" ? user.uid : friendUserId || "",
            senderName: replyingTo.sender === "user" ? "You" : name,
          }
        : undefined,
    };

    const updatedMessages = [optimisticMessage, ...messages];
    if (messages.length === 0 || getDateHeaderText(optimisticMessage.timestamp) !== getDateHeaderText(messages[0].timestamp)) {
      updatedMessages[0] = { ...optimisticMessage, showDateHeader: true, dateHeaderText: getDateHeaderText(optimisticMessage.timestamp) };
    }
    setMessages(updatedMessages);
    setReplyingTo(null);

    try {
      setUploading(true);
      const cloudinaryUrl = await uploadToCloudinary(uri, type);

      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
      const newMessageId = await ChatService.sendMessageWithReply(user.uid, friendUserId, "", replyingTo, {
        mediaUrl: cloudinaryUrl,
        mediaType: type,
        fileName,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: newMessageId,
                text: "",
                mediaUrl: cloudinaryUrl,
                isUploading: false,
              }
            : m
        )
      );
    } catch (error) {
      console.error("Error uploading media:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert(t("common.error"), t("chat.mediaUploadError"));
    } finally {
      setUploading(false);
    }
  };

  const closeForwardPopup = () => {
    setForwardPopup({ visible: false, message: null });
  };

  const renderRightAction = (message: Message) => (
    <TouchableOpacity
      onPress={() => handleReply(message)}
      style={{
        justifyContent: "center",
        alignItems: "center",
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
    const isUser = item.sender === "user";
    const bubbleBg = isUser ? theme.colors.primary : theme.colors.inputBackground;
    const msgColor = isUser ? "#FFFFFF" : theme.colors.text;
    const timeColor = isUser ? "rgba(255,255,255,0.8)" : theme.colors.secondaryText;

    const Bubble = (
      <View
        style={{
          flexDirection: isUser ? "row-reverse" : "row",
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
            maxWidth: "70%",
            marginBottom: 3,
            opacity: deletingMessageId === item.id ? 0.5 : 1,
          }}
          activeOpacity={0.9}
          disabled={deletingMessageId === item.id || item.isUploading}
        >
          {item.replyTo && (
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.08)",
                borderRadius: 8,
                padding: 8,
                marginBottom: 8,
                borderLeftWidth: 3,
                borderLeftColor: isUser ? "rgba(255,255,255,0.5)" : theme.colors.primary,
              }}
            >
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={isUser ? "rgba(255,255,255,0.9)" : theme.colors.secondaryText}
                fontWeight="500"
              >
                {item.replyTo.senderName}
              </CustomText>
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={isUser ? "rgba(255,255,255,0.85)" : theme.colors.secondaryText}
                numberOfLines={1}
              >
                {item.replyTo.text}
              </CustomText>
            </View>
          )}

          <View>
            {item.mediaUrl && item.mediaType && (
              <TouchableOpacity
                onPress={() => {
                  if (item.mediaType === "audio") {
                    item.mediaUrl && playAudio(item.mediaUrl);
                  } else {
                    setSelectedMedia({ url: item.mediaUrl, type: item.mediaType });
                  }
                }}
                disabled={item.isUploading}
                style={{ marginBottom: item.text ? 8 : 0 }}
              >
                {item.mediaType === "image" ? (
                  <Image
                    source={{ uri: item.mediaUrl }}
                    style={{
                      width: 200,
                      height: 150,
                      borderRadius: 8,
                      resizeMode: "cover",
                    }}
                  />
                ) : item.mediaType === "video" ? (
                  <View style={{ position: "relative" }}>
                    <Video
                      source={{ uri: item.mediaUrl }}
                      style={{
                        width: 200,
                        height: 150,
                        borderRadius: 8,
                      }}
                      useNativeControls={false}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "rgba(0,0,0,0.3)",
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="play" size={40} color="white" />
                    </View>
                  </View>
                ) : item.mediaType === "audio" ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: isUser ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                    }}
                  >
                    <Ionicons name="play" size={30} color={isUser ? "white" : theme.colors.primary} />
                    <CustomText
                      color={isUser ? "white" : theme.colors.text}
                      style={{ marginLeft: 8 }}
                    >
                      {t("chat.audioMessage")}
                    </CustomText>
                  </View>
                ) : null}
                {item.isUploading && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      borderRadius: 8,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator size="large" color="white" />
                  </View>
                )}
              </TouchableOpacity>
            )}
            {item.text && (
              <CustomText color={msgColor}>
                {item.text}
              </CustomText>
            )}
            {deletingMessageId === item.id && (
              <ActivityIndicator
                size="small"
                color={isUser ? "rgba(255,255,255,0.8)" : theme.colors.primary}
                style={{ marginTop: 4, alignSelf: "center" }}
              />
            )}
          </View>

          {item.edited && (
            <CustomText
              fontSize={10}
              color={timeColor}
              style={{ fontStyle: "italic", marginTop: 2 }}
            >
              {t("chat.edited")}
            </CustomText>
          )}

          <CustomText
            fontSize={10}
            color={timeColor}
            style={{ textAlign: isUser ? "right" : "left", marginTop: 2 }}
          >
            {item.time}
          </CustomText>
        </TouchableOpacity>
      </View>
    );

    return (
      <>
        {item.showDateHeader && (
          <View style={{ alignItems: "center", marginVertical: 20 }}>
            <View
              style={{
                backgroundColor: theme.colors.inputBackground,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                elevation: 1,
                shadowColor: "#000",
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

        <Swipeable
          renderRightActions={() => renderRightAction(item)}
          friction={2}
          rightThreshold={40}
          enabled={!item.isUploading}
        >
          {Bubble}
        </Swipeable>
      </>
    );
  };

  const IOS_HEADER_OFFSET = 90;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? IOS_HEADER_OFFSET : 0}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          edges={["top", "bottom", "left", "right"]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
              backgroundColor: theme.colors.inputBackground,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 10, padding: 5 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Image
              source={{ uri: avatar || "https://via.placeholder.com/40" }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                marginRight: 10,
              }}
            />
            <CustomText
              fontSize={theme.fonts.sizes.regular}
              color={theme.colors.text}
            >
              {name}
            </CustomText>
            <View style={{ marginLeft: "auto", flexDirection: "row" }}>
              <TouchableOpacity style={{ paddingHorizontal: 4 }}>
                <Ionicons
                  name="call-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 4 }}>
                <Ionicons
                  name="videocam-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => `${item.id}_${index}`}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 10,
              paddingTop: 8,
              flexGrow: 1,
              justifyContent: messages.length === 0 ? "center" : "flex-start",
            }}
            inverted
            ListEmptyComponent={
              !loading && messages.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 50 }}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={60}
                    color={theme.colors.secondaryText}
                  />
                  <CustomText
                    fontSize={theme.fonts.sizes.title}
                    color={theme.colors.text}
                    style={{ textAlign: "center", marginTop: 20 }}
                  >
                    {t("chat.startConversation")}
                  </CustomText>
                  <CustomText
                    color={theme.colors.secondaryText}
                    style={{
                      textAlign: "center",
                      marginHorizontal: 40,
                      marginTop: 10,
                    }}
                  >
                    {t("chat.sendMessageTo", { name })}
                  </CustomText>
                </View>
              ) : null
            }
          />
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
                  borderLeftColor: "#FFA500",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={"#FFA500"}
                      fontWeight="500"
                    >
                      {t("chat.editingMessage")}
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
                  <TouchableOpacity
                    onPress={handleCancelEdit}
                    style={{ marginLeft: 10 }}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={theme.colors.secondaryText}
                    />
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
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.primary}
                      fontWeight="500"
                    >
                      {t("chat.replyingTo")} {replyingTo.sender === "user" ? t("chat.you") : name}
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
                  <TouchableOpacity
                    onPress={() => setReplyingTo(null)}
                    style={{ marginLeft: 10 }}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={theme.colors.secondaryText}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 10,
                paddingTop: 5,
                paddingVertical: 6,
                backgroundColor: theme.colors.background,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowMediaOptions(true)}
                style={{
                  marginRight: 10,
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor: theme.colors.inputBackground,
                }}
                disabled={uploading || recording !== null}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={uploading || recording !== null ? theme.colors.secondaryText : theme.colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={recording ? stopRecording : startRecording}
                style={{
                  marginRight: 10,
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor: recording ? "#FF4D4D" : theme.colors.inputBackground,
                }}
                disabled={uploading}
              >
                <Ionicons
                  name={recording ? "stop" : "mic"}
                  size={24}
                  color={uploading ? theme.colors.secondaryText : recording ? "white" : theme.colors.primary}
                />
              </TouchableOpacity>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.colors.inputBackground,
                  borderRadius: 20,
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.inputBackground,
                  color: theme.colors.text,
                  fontSize: theme.fonts.sizes.regular,
                  maxHeight: 100,
                }}
                multiline
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder={
                  editingMessage
                    ? t("chat.editYourMessage")
                    : replyingTo
                    ? t("chat.replyTo", {
                        name: replyingTo.sender === "user" ? t("chat.yourself") : name,
                      })
                    : t("chat.typeMessage")
                }
                placeholderTextColor={theme.colors.secondaryText}
                onFocus={() => {}}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                editable={!uploading && !recording}
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={!newMessage.trim() || uploading || recording !== null}
                style={{ marginLeft: 10 }}
              >
                <Ionicons
                  name={editingMessage ? "checkmark" : "send"}
                  size={24}
                  color={
                    newMessage.trim() && !uploading && recording === null
                      ? theme.colors.primary
                      : theme.colors.secondaryText
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Media Options Modal */}
            <Modal
              visible={showMediaOptions}
              transparent
              animationType="fade"
              onRequestClose={() => setShowMediaOptions(false)}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  justifyContent: "flex-end",
                }}
                onPress={() => setShowMediaOptions(false)}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.background,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingVertical: 20,
                    paddingHorizontal: 20,
                  }}
                >
                  <CustomText
                    fontSize={theme.fonts.sizes.title}
                    color={theme.colors.text}
                    style={{ marginBottom: 20, textAlign: "center" }}
                  >
                    {t("chat.selectMedia")}
                  </CustomText>
                  <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                    <TouchableOpacity
                      onPress={takePhoto}
                      style={{
                        alignItems: "center",
                        padding: 20,
                        borderRadius: 15,
                        backgroundColor: theme.colors.inputBackground,
                        minWidth: 80,
                      }}
                      disabled={uploading}
                    >
                      <Ionicons name="camera" size={30} color={theme.colors.primary} />
                      <CustomText
                        color={theme.colors.text}
                        style={{ marginTop: 8, fontSize: 12 }}
                      >
                        {t("chat.camera")}
                      </CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickImage}
                      style={{
                        alignItems: "center",
                        padding: 20,
                        borderRadius: 15,
                        backgroundColor: theme.colors.inputBackground,
                        minWidth: 80,
                      }}
                      disabled={uploading}
                    >
                      <Ionicons name="image" size={30} color={theme.colors.primary} />
                      <CustomText
                        color={theme.colors.text}
                        style={{ marginTop: 8, fontSize: 12 }}
                      >
                        {t("chat.gallery")}
                      </CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickVideo}
                      style={{
                        alignItems: "center",
                        padding: 20,
                        borderRadius: 15,
                        backgroundColor: theme.colors.inputBackground,
                        minWidth: 80,
                      }}
                      disabled={uploading}
                    >
                      <Ionicons name="videocam" size={30} color={theme.colors.primary} />
                      <CustomText
                        color={theme.colors.text}
                        style={{ marginTop: 8, fontSize: 12 }}
                      >
                        {t("chat.video")}
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
          <MessageContextMenu
            visible={contextMenu.visible}
            onClose={closeContextMenu}
            message={contextMenu.message}
            onDelete={handleContextMenuDelete}
            onEdit={handleContextMenuEdit}
            onForward={handleContextMenuForward}
            onCopy={handleContextMenuCopy}
            onDownload={handleContextMenuDownload}
            position={contextMenu.position}
            isOwnMessage={contextMenu.message?.sender === "user"}
          />
          <ForwardMessagePopup
            visible={forwardPopup.visible}
            onClose={closeForwardPopup}
            message={forwardPopup.message}
            onForward={handleForwardMessage}
          />
          <Modal
            visible={!!selectedMedia}
            animationType="fade"
            onRequestClose={() => setSelectedMedia(null)}
            transparent={false}
          >
            <View style={{ flex: 1, backgroundColor: "black", justifyContent: "center", alignItems: "center" }}>
              {selectedMedia?.type === "image" ? (
                <Image
                  source={{ uri: selectedMedia.url }}
                  style={{ width: "100%", height: "100%", resizeMode: "contain" }}
                />
              ) : selectedMedia?.type === "video" ? (
                <Video
                  source={{ uri: selectedMedia.url }}
                  style={{ width: "100%", height: "100%" }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                  shouldPlay
                />
              ) : null}
              <TouchableOpacity
                style={{ position: "absolute", top: 40, left: 20 }}
                onPress={() => setSelectedMedia(null)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}