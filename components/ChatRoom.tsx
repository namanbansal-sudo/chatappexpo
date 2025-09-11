"use client";
import { useLanguage } from "@/i18n";
import { ChatService } from "@/services/chatService";
import { uploadToCloudinary } from "@/services/cloudinary";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";
import { Audio, ResizeMode, Video } from "expo-av";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as IntentLauncher from "expo-intent-launcher";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomText } from "./customText";
import { ForwardMessagePopup } from "./ForwardMessagePopup";
import { MessageContextMenu } from "./MessageContextMenu";
import { ShowProfilePopup } from "./ShowProfilePopup"; // Add this import
import { useThemeContext } from "./ThemeContext";
import { useUser } from "./UserContext";

interface SwipeToReplyProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  enabled?: boolean;
}

const SwipeToReply: React.FC<SwipeToReplyProps> = ({
  children,
  onSwipeReply,
  enabled = true,
}) => {
  const { theme } = useThemeContext();
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwiping = useRef(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only activate if it's a horizontal swipe (not vertical scrolling)
      return (
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 &&
        gestureState.dx > 0
      );
    },
    onPanResponderMove: (evt, gestureState) => {
      if (!enabled) return;

      isSwiping.current = true;
      const newTranslateX = Math.min(gestureState.dx, 100); // Limit swipe distance
      translateX.setValue(newTranslateX);
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (!enabled || !isSwiping.current) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        return;
      }

      if (gestureState.dx > 50) {
        onSwipeReply();
      }

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      isSwiping.current = false;
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      isSwiping.current = false;
    },
  });

  const replyIconStyle = {
    opacity: translateX.interpolate({
      inputRange: [20, 50],
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
    transform: [
      {
        scale: translateX.interpolate({
          inputRange: [20, 50],
          outputRange: [0.8, 1],
          extrapolate: "clamp",
        }),
      },
    ],
  };

  return (
    <View style={{ position: "relative" }}>
      {/* Reply icon that appears during swipe */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 20,
            top: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1,
          },
          replyIconStyle,
        ]}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.colors.primary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CustomText color="white" fontSize={16}>
            ↩
          </CustomText>
        </View>
      </Animated.View>

      {/* Message content */}
      <Animated.View
        style={{
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

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
  isDateHeader?: boolean;
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

interface FriendProfile {
  avatar?: string;
  name?: string;
  email?: string;
  designation?: string;
}

function toDateSafe(value: any): Date | null {
  try {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    // Firestore Timestamp
    if (
      typeof value === "object" &&
      typeof (value as any).toDate === "function"
    ) {
      const d = (value as any).toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "number") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      // Try numeric epoch first, then ISO/date string
      const asNum = Number(trimmed);
      const d =
        Number.isFinite(asNum) && trimmed.length >= 11
          ? new Date(asNum)
          : new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function formatTimeSafe(value: any, fallback?: string): string {
  const d = toDateSafe(value);
  if (d) {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  // If we have a fallback time string, use it
  if (fallback && typeof fallback === "string" && fallback.trim()) {
    return fallback;
  }
  // Default to current time if nothing else works
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const showToast = (message: string) => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(t("common.success"), message);
  }
};

function ChatRoom() {
  const params = useLocalSearchParams<ChatRoomParams>();

  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;
  const avatarParam = Array.isArray(params.avatar)
    ? params.avatar[0]
    : params.avatar;
  const userIdParam = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;
  const friendUserIdParam = Array.isArray(params.friendUserId)
    ? params.friendUserId[0]
    : params.friendUserId;

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
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null
  );
  const [forwardPopup, setForwardPopup] = useState<{
    visible: boolean;
    message: Message | null;
  }>({ visible: false, message: null });
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(
    null
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: "image" | "video" | "audio";
  } | null>(null);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<
    Array<{
      uri: string;
      type: "image" | "video";
      fileName: string;
    }>
  >([]);
  const [mediaCaption, setMediaCaption] = useState("");
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, string>>(
    {}
  );
  const [processingMedia, setProcessingMedia] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flatListRef = useRef<FlatList<MessageWithHeader>>(null);

  // Fetch friend profile
  const fetchFriendProfile = useCallback(async () => {
    if (!friendUserId) return;

    setProfileLoading(true);
    try {
      const userRef = doc(getFirestore(), "users", friendUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setFriendProfile({
          avatar: data.photo,
          name: data.name,
          email: data.email,
          designation: data.designation,
        });
      } else {
        setFriendProfile(null);
      }
    } catch (error) {
      console.error("Error fetching friend profile:", error);
      setFriendProfile(null);
      Alert.alert(t("common.error"), t("chat.profileFetchError"));
    } finally {
      setProfileLoading(false);
    }
  }, [friendUserId, t]);

  // -------- Helpers --------
  const getDateHeaderText = (dateLike: any): string => {
    const date = toDateSafe(dateLike);
    if (!date) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (messageDate.getTime() === today.getTime()) return "Today";
    if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";

    const currentYear = now.getFullYear();
    const messageYear = date.getFullYear();

    if (messageYear === currentYear) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const addDateHeaders = (messageList: Message[]): MessageWithHeader[] => {
    console.log(
      "🔍 addDateHeaders called with messageList:",
      messageList.map((m) => ({
        id: m.id,
        timestamp: m.timestamp.toISOString(),
        text: m.text,
        sender: m.sender,
      }))
    );

    if (messageList.length === 0) {
      console.log("📭 Message list is empty, returning empty array");
      return [];
    }

    // Filter out any existing date headers to avoid duplicates
    const regularMessages = messageList.filter(
      (m) => !m.isDateHeader && !m.id?.startsWith("header_")
    );

    // 1. Sort in CHRONOLOGICAL order (oldest first)
    const chronologicalMessages = [...regularMessages].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    console.log(
      "📅 Chronologically sorted messages:",
      chronologicalMessages.map((m) => ({
        id: m.id,
        timestamp: m.timestamp.toISOString(),
        text: m.text,
        sender: m.sender,
      }))
    );

    const out: MessageWithHeader[] = [];
    let lastHeader = "";

    // 2. Process in chronological order to add headers correctly
    for (let i = 0; i < chronologicalMessages.length; i++) {
      const m = chronologicalMessages[i];
      const currentHeader = getDateHeaderText(m.timestamp);

      console.log(`📋 Processing message ${i}:`, {
        id: m.id,
        timestamp: m.timestamp.toISOString(),
        currentHeader,
        lastHeader,
        shouldShowHeader: i === 0 || currentHeader !== lastHeader,
      });

      // Add header before the first message of each date
      const shouldShowHeader = i === 0 || currentHeader !== lastHeader;

      if (shouldShowHeader) {
        console.log(`➕ Adding date header: ${currentHeader}`);
        // Create a date header message
        const dateHeaderMessage: MessageWithHeader = {
          id: `header_${m.timestamp.getTime()}_${i}`,
          text: "",
          sender: "user",
          time: "",
          timestamp: m.timestamp,
          showDateHeader: true,
          dateHeaderText: currentHeader,
          isDateHeader: true,
        };
        out.push(dateHeaderMessage);
        lastHeader = currentHeader;
      }

      // Add the actual message
      console.log(`➕ Adding message: ${m.text || "media"} (${m.id})`);
      out.push({ ...m });
    }

    console.log(
      "✅ Final output with headers:",
      out.map((item) => ({
        id: item.id,
        isDateHeader: item.isDateHeader,
        dateHeaderText: item.dateHeaderText,
        timestamp: item.timestamp.toISOString(),
        text: item.text,
      }))
    );

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

      // reset and start timer
      setRecSeconds(0);
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);

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
      // stop timer
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }

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
    } finally {
      // ensure timer is reset visually
      setRecSeconds(0);
    }
  };

  const playAudio = async (uri: string, messageId: string) => {
    try {
      // If clicking on currently playing audio, pause it
      if (playingAudioId === messageId && currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await currentSound.pauseAsync();
            setPlayingAudioId(null);
          } else {
            await currentSound.playAsync();
            setPlayingAudioId(messageId);
          }
        }
        return;
      }

      // Stop any currently playing audio
      if (currentSound) {
        try {
          const status = await currentSound.getStatusAsync();
          if (status.isLoaded) {
            await currentSound.stopAsync();
          }
          await currentSound.unloadAsync();
        } catch (e) {
          console.log("Error stopping previous sound:", e);
        }
        setCurrentSound(null);
        setPlayingAudioId(null);
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create sound without auto-play first
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: false }
      );

      setCurrentSound(sound);

      // Set up playback status listener before playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setPlayingAudioId(null);
            sound.unloadAsync().catch(console.error);
            setCurrentSound(null);
          }
        }
      });

      // Now play the sound after it's set up
      await sound.playAsync();
      setPlayingAudioId(messageId);
    } catch (error) {
      console.error("Error playing audio:", error);
      Alert.alert(t("common.error"), t("chat.audioPlaybackError"));
      setPlayingAudioId(null);
      setCurrentSound(null);
    }
  };

  const uploadAudio = async (uri: string): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "audio/m4a",
        name: "voice-note.m4a",
      } as any);
      formData.append("upload_preset", "chatsupp_Preset");

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dtwqn1r7v/upload",
        {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "multipart/form-data",
          },
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

    const tempId = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const currentTime = new Date();
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: newMessage.trim(), // Use current input as caption for voice notes
      sender: "user",
      time: currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      timestamp: currentTime,
      mediaUrl: uri,
      mediaType: "audio",
      fileName: "voice-note.m4a",
      isUploading: true,
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.sender === "user" ? user.uid : friendUserId,
            senderName: replyingTo.sender === "user" ? "You" : name,
          }
        : undefined,
    };

    // Add to BEGINNING of array (newest-first order for inverted FlatList)
    const updatedMessages = [optimisticMessage, ...messages];

    // Process with date headers and reverse for display
    const withHeaders = addDateHeaders(updatedMessages);
    const reversedWithHeaders = [...withHeaders].reverse();

    setMessages(reversedWithHeaders);
    setReplyingTo(null);
    const captionText = newMessage.trim(); // Store caption before clearing
    setNewMessage(""); // Clear input after using as caption

    try {
      setUploading(true);
      const cloudinaryUrl = await uploadAudio(uri);

      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
      const newMessageId = await ChatService.sendMessageWithReply(
        user.uid,
        friendUserId,
        captionText, // Send caption text
        replyingTo,
        {
          mediaUrl: cloudinaryUrl,
          mediaType: "audio",
          fileName: "voice-note.m4a",
        }
      );

      // Update the optimistic message with the real messageId
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: newMessageId,
                text: captionText,
                mediaUrl: cloudinaryUrl,
                isUploading: false,
              }
            : m
        )
      );

      // Scroll to bottom (newest message)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error("Error uploading audio:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(captionText); // Restore caption on error
      setReplyingTo(replyingTo); // Restore reply state on error
      Alert.alert(t("common.error"), t("chat.audioUploadError"));
    } finally {
      setUploading(false);
    }
  };

  const formatMsToClock = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const ensureAudioDuration = async (id: string, uri: string) => {
    if (audioDurations[id]) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      const status = await sound.getStatusAsync();
      if (status.isLoaded && typeof status.durationMillis === "number") {
        setAudioDurations((prev) => ({
          ...prev,
          [id]: formatMsToClock(status.durationMillis),
        }));
      }
      await sound.unloadAsync();
    } catch {}
  };

  useEffect(() => {
    messages
      .filter((m) => m.mediaType === "audio" && m.mediaUrl)
      .forEach((m) => ensureAudioDuration(m.id, m.mediaUrl!));
  }, [messages]);

  const getReplyPreviewText = (
    reply: Message["replyTo"] | Message | null | undefined,
    allMsgs: Message[] = messages
  ) => {
    try {
      if (!reply) return "";
      // Try to locate the original message using messageId or id
      // @ts-ignore
      const replyId = (reply?.messageId || (reply as any)?.id) as
        | string
        | undefined;
      const original = replyId
        ? allMsgs.find((m) => m.id === replyId)
        : (reply as any);
      const mediaType = original?.mediaType as
        | "image"
        | "video"
        | "audio"
        | undefined;
      if (mediaType === "image") return "Image";
      if (mediaType === "video") return "Video";
      if (mediaType === "audio") return "Voice note";
      // fallback to provided reply text
      // @ts-ignore
      return (reply as any)?.text || "";
    } catch {
      return "";
    }
  };

  // -------- Realtime subscription --------
  useEffect(() => {
    if (!user?.uid || !friendUserId) {
      console.log("❌ Missing user or friendUserId:", {
        user: user?.uid,
        friendUserId,
      });
      setLoading(false);
      return;
    }

    console.log("🔄 Setting up message subscription for:", {
      user: user.uid,
      friendUserId,
    });
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = ChatService.subscribeToMessages(
        user.uid,
        friendUserId,
        (firebaseMessages: FirebaseChatMessage[]) => {
          console.log(
            "📨 Raw Firebase messages received:",
            firebaseMessages.map((msg) => ({
              id: msg.id,
              timestamp: msg.timestamp,
              text: msg.text || msg.content?.text || msg.message,
              senderId: msg.senderId,
            }))
          );

          const formatted: Message[] = firebaseMessages.map((msg) => {
            const date = toDateSafe(msg.timestamp) ?? new Date();

            const formattedMessage = {
              id: msg.id,
              text: msg.content?.text || msg.message || msg.text || "",
              sender: msg.senderId === user.uid ? "user" : "other",
              time: date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }),
              timestamp: date,
              edited: msg.edited || false,
              mediaUrl: msg.mediaUrl,
              mediaType: msg.mediaType as
                | "image"
                | "video"
                | "audio"
                | undefined,
              replyTo:
                msg.replyTo && typeof msg.replyTo === "object"
                  ? {
                      messageId: msg.replyTo.messageId || msg.replyTo.id || "",
                      text: msg.replyTo.text || "",
                      senderId: msg.replyTo.senderId || "",
                      senderName: msg.replyTo.senderName || "",
                    }
                  : undefined,
            };

            console.log("📝 Formatted message:", formattedMessage);
            return formattedMessage;
          });

          console.log(
            "📋 All formatted messages:",
            formatted.map((m) => ({
              id: m.id,
              timestamp: m.timestamp.toISOString(),
              text: m.text,
              sender: m.sender,
            }))
          );

          // Process with date headers in chronological order
          const withHeaders = addDateHeaders(formatted);

          // For inverted FlatList, we need to reverse the array
          const reversedWithHeaders = [...withHeaders].reverse();

          console.log(
            "🔄 Final reversed messages for display:",
            reversedWithHeaders.map((item) => ({
              id: item.id,
              isDateHeader: item.isDateHeader,
              dateHeaderText: item.dateHeaderText,
              timestamp: item.timestamp?.toISOString(),
              text: item.text,
            }))
          );

          setMessages(reversedWithHeaders);
          setLoading(false);

          if (!initialMessagesLoaded && formatted.length > 0) {
            setInitialMessagesLoaded(true);
            // Scroll to bottom after initial load
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({
                offset: 0,
                animated: true,
              });
            }, 100);
          }

          const chatId = ChatService.generateChatId(user.uid, friendUserId);
          ChatService.markMessagesAsRead(chatId, user.uid)
            .then(() => console.log("✅ Messages marked as read successfully"))
            .catch((error) => {
              console.log("⚠️ Fallback: using markIncomingFromSenderAsRead");
              return ChatService.markIncomingFromSenderAsRead(
                chatId,
                user.uid!,
                friendUserId!
              );
            })
            .catch((error) =>
              console.error("❌ Failed to mark messages as read:", error)
            );
        }
      );
    } catch (e) {
      console.error("Error setting up message listener:", e);
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, [user?.uid, friendUserId]);

  // Remove the entire useEffect block above and replace with:
useEffect(() => {
  if (!user?.uid || !friendUserId) return;
  
  // Only mark as read once on component mount, not repeatedly
  const chatId = ChatService.generateChatId(user.uid, friendUserId);
  
  // Simple one-time mark as read without error handling
  ChatService.markMessagesAsRead(chatId, user.uid!)
    .catch(error => {
      console.log('Mark as read failed (non-critical):', error);
    });
}, [user?.uid, friendUserId]);

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      if (currentSound) {
        currentSound
          .stopAsync()
          .then(() => {
            currentSound.unloadAsync();
          })
          .catch(console.error);
      }
    };
  }, [currentSound]);

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
    if (
      !newMessage.trim() ||
      !editingMessage ||
      !user?.uid ||
      !friendUserId ||
      sending
    )
      return;

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

  // Replace all instances of scrollToEnd with scrollToOffset({offset: 0})
  const scrollToNewest = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const sendMediaMessages = async () => {
    if (
      !user?.uid ||
      !friendUserId ||
      uploading ||
      selectedMediaFiles.length === 0
    )
      return;

    try {
      setUploading(true);
      const captionText = newMessage.trim();
      const mediaFilesToSend = [...selectedMediaFiles];
      setSelectedMediaFiles([]); // Clear media files immediately
      setNewMessage(""); // Clear input field
      setReplyingTo(null); // Clear reply state

      // Create optimistic messages for all media files
      const tempIds = mediaFilesToSend.map(
        (_, index) =>
          `temp_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}_${index}`
      );
      const currentTime = new Date();
      const optimisticMessages: MessageWithHeader[] = mediaFilesToSend.map(
        (mediaFile, index) => ({
          id: tempIds[index],
          text: index === 0 ? captionText : "", // Only first media gets the caption
          sender: "user",
          time: currentTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          timestamp: currentTime,
          mediaUrl: mediaFile.uri,
          mediaType: mediaFile.type,
          fileName: mediaFile.fileName,
          isUploading: true,
          replyTo: replyingTo
            ? {
                messageId: replyingTo.id,
                text: replyingTo.text,
                senderId:
                  replyingTo.sender === "user" ? user.uid : friendUserId,
                senderName: replyingTo.sender === "user" ? "You" : name,
              }
            : undefined,
        })
      );

      // Add all optimistic messages at once
      const updatedMessages = [...optimisticMessages, ...messages];
      const withHeaders = addDateHeaders(updatedMessages);
      const reversedWithHeaders = [...withHeaders].reverse();
      setMessages(reversedWithHeaders);

      // Upload media files sequentially
      for (let i = 0; i < mediaFilesToSend.length; i++) {
        const mediaFile = mediaFilesToSend[i];
        const tempId = tempIds[i];

        try {
          const cloudinaryUrl = await uploadToCloudinary(
            mediaFile.uri,
            mediaFile.type
          );
          await ChatService.testUserDocuments(user.uid, friendUserId);
          await ChatService.ensureChatExists(user.uid, friendUserId);
          const newMessageId = await ChatService.sendMessageWithReply(
            user.uid,
            friendUserId,
            i === 0 ? captionText : "", // Only first media gets the caption
            replyingTo,
            {
              mediaUrl: cloudinaryUrl,
              mediaType: mediaFile.type,
              fileName: mediaFile.fileName,
            }
          );

          // Update the specific optimistic message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: newMessageId,
                    text: i === 0 ? captionText : "",
                    mediaUrl: cloudinaryUrl,
                    isUploading: false,
                  }
                : m
            )
          );
        } catch (error) {
          console.error(`Error uploading media ${i}:`, error);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          throw error;
        }
      }

      // Scroll to bottom after all uploads
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending media messages:", error);
      Alert.alert(t("common.error"), t("chat.mediaSendError"));
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = useCallback(async () => {
    // If we have media files selected, send them instead of text
    if (selectedMediaFiles.length > 0) {
      return sendMediaMessages();
    }

    if (!newMessage.trim() || !user?.uid || !friendUserId || sending) {
      console.warn("⚠️ Cannot send message: missing input or already sending", {
        newMessage,
        userId: user?.uid,
        friendUserId,
        sending,
      });
      return;
    }

    if (editingMessage) {
      return handleSaveEdit();
    }

    const messageToSend = newMessage.trim();
    const replyData = replyingTo;

    // Validate replyData
    if (replyData) {
      if (
        !replyData.id ||
        !replyData.sender ||
        typeof replyData.text !== "string"
      ) {
        console.error("❌ Invalid replyData:", replyData);
        Alert.alert(t("common.error"), t("chat.invalidReplyData"));
        return;
      }
      if (!friendUserId) {
        console.error("❌ friendUserId is missing for replyData:", replyData);
        Alert.alert(t("common.error"), t("chat.missingFriendId"));
        return;
      }
    }

    // Create optimistic message
    const tempId = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const currentTime = new Date();

    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: messageToSend,
      sender: "user",
      time: currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      timestamp: currentTime,
      replyTo: replyData
        ? {
            messageId: replyData.id,
            text: replyData.text ?? "",
            senderId: replyData.sender === "user" ? user.uid : friendUserId,
            senderName: replyData.sender === "user" ? "You" : name || "Friend",
          }
        : undefined,
      isUploading: true, // Add this to identify optimistic messages
    };

    console.log("➕ Adding optimistic message:", optimisticMessage);

    const updatedMessages = [optimisticMessage, ...messages];
    const withHeaders = addDateHeaders(updatedMessages);
    const reversedWithHeaders = [...withHeaders].reverse();

    setMessages(reversedWithHeaders);
    setNewMessage("");
    setReplyingTo(null);

    try {
      setSending(true);
      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);

      if (replyData) {
        const db = getFirestore();
        const chatId = ChatService.generateChatId(user.uid, friendUserId);
        const replyMessageRef = doc(
          db,
          "chats",
          chatId,
          "messages",
          replyData.id
        );
        const replyMessageSnap = await getDoc(replyMessageRef);
        if (!replyMessageSnap.exists()) {
          console.error(
            "❌ Reply message not found in Firestore:",
            replyData.id
          );
          throw new Error(`Reply message not found: ${replyData.id}`);
        }
      }

      console.log("🔍 Calling sendMessageWithReply with:", {
        senderId: user.uid,
        receiverId: friendUserId,
        message: messageToSend,
        replyTo: replyData
          ? {
              messageId: replyData.id,
              text: replyData.text ?? "",
              senderId: replyData.sender === "user" ? user.uid : friendUserId,
              senderName:
                replyData.sender === "user" ? "You" : name || "Friend",
            }
          : undefined,
      });

      const messageId = await ChatService.sendMessageWithReply(
        user.uid,
        friendUserId,
        messageToSend,
        replyData
          ? {
              messageId: replyData.id,
              text: replyData.text ?? "",
              senderId: replyData.sender === "user" ? user.uid : friendUserId,
              senderName:
                replyData.sender === "user" ? "You" : name || "Friend",
            }
          : null
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: messageId, isUploading: false }
            : msg
        )
      );

      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (e) {
      console.error("❌ Error sending message:", e, {
        senderId: user.uid,
        receiverId: friendUserId,
        message: messageToSend,
        replyData,
      });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(messageToSend);
      setReplyingTo(replyData);
      Alert.alert(t("common.error"), t("chat.sendError"));
    } finally {
      setSending(false);
    }
  }, [
    newMessage,
    replyingTo,
    editingMessage,
    sending,
    user?.uid,
    friendUserId,
    handleSaveEdit,
    messages,
    name,
    t,
    addDateHeaders,
    selectedMediaFiles,
    sendMediaMessages,
  ]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.uid || !friendUserId) return;

    // Store the message being deleted for optimistic removal
    const messageToDelete = messages.find((m) => m.id === messageId);
    if (!messageToDelete) return;

    // Optimistically remove the message immediately
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      const chatId = ChatService.generateChatId(user.uid, friendUserId);
      await ChatService.deleteMessage(chatId, messageId);

      // No need to do anything here since we already removed it optimistically
      // The real-time subscription will handle any updates if needed
    } catch (error) {
      console.error("Error deleting message:", error);

      // Re-add the message if deletion failed
      setMessages((prev) => {
        const newMessages = [...prev];
        // Insert the message back in its original position
        // You might want to implement a more sophisticated way to maintain order
        newMessages.unshift(messageToDelete);
        return newMessages;
      });

      Alert.alert(t("common.error"), t("chat.deleteError"));
    }
  };

  const getPressXY = (e: any) => {
    const ne = (e && e.nativeEvent) || e || {};
    // Use the correct touch coordinates for React Native
    const x = ne.pageX ?? ne.locationX ?? 0;
    const y = ne.pageY ?? ne.locationY ?? 0;
    return { x, y };
  };

  const handleLongPress = (message: Message, event: any) => {
    // For React Native, we need to use a different approach to get screen coordinates
    // The event might not have the correct coordinates, so we'll use a ref-based approach

    // First, try to get coordinates from the event
    let x = 0;
    let y = 0;

    if (event?.nativeEvent) {
      // Try different coordinate properties
      x = event.nativeEvent.pageX || event.nativeEvent.locationX || 0;
      y = event.nativeEvent.pageY || event.nativeEvent.locationY || 0;

      // If we still don't have valid coordinates, use screen center as fallback
      if (x === 0 && y === 0) {
        x = 200; // Fallback x position
        y = 300; // Fallback y position
      }
    }

    console.log("Context menu coordinates:", {
      x,
      y,
      event: event?.nativeEvent,
    });
    setContextMenu({ visible: true, message, position: { x, y } });
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
      showToast(t("chat.messageCopied")); // toast only
    } else if (message.mediaType === "image" && message.mediaUrl) {
      try {
        const fileUri = `${
          FileSystem.cacheDirectory
        }temp_image_${Date.now()}.jpg`;
        const { uri } = await FileSystem.downloadAsync(
          message.mediaUrl,
          fileUri
        );
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Clipboard.setImageAsync(base64);
        showToast(t("chat.imageCopied")); // toast only
      } catch (error) {
        console.error("Error copying image:", error);
        Alert.alert(t("common.error"), t("chat.copyError"));
      }
    } else if (message.mediaType === "video" && message.mediaUrl) {
      await Clipboard.setStringAsync(message.mediaUrl);
      showToast(t("chat.videoUrlCopied")); // toast only
    } else if (message.mediaType === "audio" && message.mediaUrl) {
      await Clipboard.setStringAsync(message.mediaUrl);
      showToast(t("chat.audioUrlCopied")); // toast only
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
      // Request permissions first
      const { status, canAskAgain } =
        await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.error("Media library permission denied");

        if (!canAskAgain) {
          // Permission permanently denied, guide user to settings
          Alert.alert(
            t("chat.permissionRequired"),
            t("chat.permissionPermanentlyDenied"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("chat.openSettings"),
                onPress: () => {
                  if (Platform.OS === "ios") {
                    Linking.openURL("app-settings:");
                  } else {
                    IntentLauncher.startActivityAsync(
                      IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS,
                      { data: "package:" + Constants.appId }
                    );
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert(t("common.error"), t("chat.permissionRequired"));
        }
        return;
      }

      // Create appropriate file extension
      const fileExtension =
        message.mediaType === "image"
          ? "jpg"
          : message.mediaType === "video"
          ? "mp4"
          : "m4a";
      const fileName = `ChatMedia_${Date.now()}.${fileExtension}`;

      // Download to cache directory first
      const downloadResult = await FileSystem.downloadAsync(
        message.mediaUrl,
        FileSystem.cacheDirectory + fileName
      );

      console.log("Download result:", {
        uri: downloadResult.uri,
        status: downloadResult.status,
      });

      if (downloadResult.status !== 200) {
        console.error("Download failed with status:", downloadResult.status);
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // For Android, we need to use a different approach
      if (Platform.OS === "android") {
        // Use MediaLibrary to create the asset - this handles Android permissions correctly
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

        // Try to save to appropriate folder based on media type
        let albumName = "ChatMedia";

        if (message.mediaType === "image") {
          albumName = "Pictures/ChatMedia";
        } else if (message.mediaType === "video") {
          albumName = "Movies/ChatMedia";
        } else if (message.mediaType === "audio") {
          albumName = "Music/ChatMedia";
        }

        try {
          // Try to get or create the album
          let album = await MediaLibrary.getAlbumAsync(albumName);
          if (!album) {
            album = await MediaLibrary.createAlbumAsync(
              albumName,
              asset,
              false
            );
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
        } catch (albumError) {
          console.log(
            "Album operation failed, file saved to default location:",
            albumError
          );
          // The file is still saved even if album creation fails
        }

        Alert.alert(t("common.success"), t("chat.mediaSaved"));
      } else {
        // iOS handling
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

        try {
          const album = await MediaLibrary.getAlbumAsync("ChatMedia");
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync("ChatMedia", asset, false);
          }
          Alert.alert(t("common.success"), t("chat.mediaSaved"));
        } catch (albumError) {
          console.log("Album operation failed:", albumError);
          Alert.alert(t("common.success"), t("chat.mediaSavedDefault"));
        }
      }

      // Clean up the cached file
      try {
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      } catch (cleanupError) {
        console.log("Could not clean up cached file:", cleanupError);
      }
    } catch (error) {
      console.error("Error downloading media:", error);

      // More specific error messages
      let errorMessage = t("chat.downloadError");
      if (error instanceof Error) {
        if (
          error.message.includes("permission") ||
          error.message.includes("PERMISSION")
        ) {
          errorMessage = t("chat.permissionRequired");
        } else if (
          error.message.includes("network") ||
          error.message.includes("NETWORK")
        ) {
          errorMessage = t("chat.networkError");
        }
      }

      Alert.alert(
        t("common.error"),
        `${errorMessage}: ${(error as Error).message || "Unknown error"}`
      );
    }
  };

  const handleForwardMessage = async (userIds: string[], message: Message) => {
    setForwardPopup({ visible: false, message: null });

    try {
      await ChatService.forwardMessage(message, userIds, user?.uid || "");
      Alert.alert(t("common.success"), t("chat.messageForwarded"));
    } catch (error) {
      console.error("Error forwarding message:", error);
      Alert.alert(t("common.error"), t("chat.forwardError"));
    }
  };

  // Update the takePhoto function similarly
  const takePhoto = async (mediaType: "image" | "video" = "image") => {
    setShowMediaOptions(false);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:
          mediaType === "video"
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: mediaType === "video" ? undefined : [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newMediaFile = {
          uri: result.assets[0].uri,
          type: mediaType,
          fileName:
            result.assets[0].fileName ||
            `${mediaType}_${Date.now()}.${
              mediaType === "video" ? "mp4" : "jpg"
            }`,
        };

        setSelectedMediaFiles((prev) => [...prev, newMediaFile]);
      }
    } catch (error) {
      console.error("Error taking photo/video:", error);
      Alert.alert(t("common.error"), t("chat.cameraError"));
    }
  };

  const handleMediaUpload = async (
    uri: string,
    type: "image" | "video",
    fileName: string,
    caption: string = "",
    text: string = ""
  ) => {
    if (!user?.uid || !friendUserId) return;

    // Create a unique ID for this specific media upload
    const tempId = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const currentTime = new Date();

    // Create optimistic message with upload indicator
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: text || caption,
      sender: "user",
      time: currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      timestamp: currentTime,
      mediaUrl: uri, // Show local URI first
      mediaType: type,
      fileName,
      isUploading: true, // Mark as uploading
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.sender === "user" ? user.uid : friendUserId,
            senderName: replyingTo.sender === "user" ? "You" : name,
          }
        : undefined,
    };

    // Add to BEGINNING of array (newest-first order for inverted FlatList)
    const updatedMessages = [optimisticMessage, ...messages];

    // Process with date headers and reverse for display
    const withHeaders = addDateHeaders(updatedMessages);
    const reversedWithHeaders = [...withHeaders].reverse();

    setMessages(reversedWithHeaders);

    try {
      const cloudinaryUrl = await uploadToCloudinary(uri, type);

      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
      const newMessageId = await ChatService.sendMessageWithReply(
        user.uid,
        friendUserId,
        text || caption,
        replyingTo,
        {
          mediaUrl: cloudinaryUrl,
          mediaType: type,
          fileName,
        }
      );

      // Update the optimistic message with the real messageId and remove upload indicator
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: newMessageId,
                text: text || caption,
                mediaUrl: cloudinaryUrl,
                isUploading: false, // Remove upload indicator
              }
            : m
        )
      );

      // Scroll to bottom (newest message)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error("Error uploading media:", error);
      // Remove the failed upload from messages
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }
  };

  const closeForwardPopup = () => {
    setForwardPopup({ visible: false, message: null });
  };

  const handleProfilePress = () => {
    setShowProfilePopup(true);
    fetchFriendProfile();
  };

  const renderMessage = ({ item }: { item: MessageWithHeader }) => {
    // Handle date header messages specially
    if (item.isDateHeader) {
      return (
        <View style={{ alignItems: "center", marginVertical: 10 }}>
          <View
            style={{
              backgroundColor: theme.colors.inputBackground,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
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
      );
    }

    const isUser = item.sender === "user";
    const bubbleBg = isUser
      ? theme.colors.primary
      : theme.colors.inputBackground;
    const msgColor = isUser ? "#FFFFFF" : theme.colors.text;
    const timeColor = isUser
      ? "rgba(255,255,255,0.8)"
      : theme.colors.secondaryText;

    const Bubble = (
      <View
        style={{
          marginVertical: 2,
          paddingHorizontal: 10,
        }}
      >
        <Pressable
          onLongPress={(event) => handleLongPress(item, event)}
          delayLongPress={500}
          style={({ pressed }) => ({
            backgroundColor: bubbleBg,
            borderRadius: 14,
            // tweak radii for chat look
            borderTopLeftRadius: isUser ? 14 : 4,
            borderTopRightRadius: isUser ? 4 : 14,
            padding: 10,
            maxWidth: "80%",
            alignSelf: isUser ? "flex-end" : "flex-start",
            marginBottom: 3,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: pressed ? 0.96 : 1,
          })}
          activeOpacity={0.9}
          disabled={deletingMessageId === item.id || item.isUploading}
        >
          {item.replyTo && (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: isUser
                  ? "rgba(255,255,255,0.5)"
                  : theme.colors.border,
                paddingLeft: 8,
                paddingBottom: 6,
                marginBottom: 6,
                opacity: 0.9,
              }}
            >
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={
                  isUser ? "rgba(255,255,255,0.9)" : theme.colors.secondaryText
                }
                fontWeight="500"
              >
                {item.replyTo.senderName}
              </CustomText>
              <CustomText
                fontSize={theme.fonts.sizes.small}
                color={
                  isUser ? "rgba(255,255,255,0.85)" : theme.colors.secondaryText
                }
                numberOfLines={1}
              >
                {getReplyPreviewText(item.replyTo, messages)}
              </CustomText>
            </View>
          )}

          <View>
            {item.mediaUrl && item.mediaType && (
              <TouchableOpacity
                onPress={() => {
                  if (
                    item.mediaType === "audio" &&
                    item.mediaUrl &&
                    !item.isUploading
                  ) {
                    playAudio(item.mediaUrl, item.id);
                  } else if (
                    item.mediaUrl &&
                    item.mediaType &&
                    !item.isUploading
                  ) {
                    setSelectedMedia({
                      url: item.mediaUrl,
                      type: item.mediaType,
                    });
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
                      flexDirection: "column", // Changed to column for vertical layout
                      alignItems: "flex-start", // Align items to the start for better spacing
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      backgroundColor: isUser
                        ? theme.colors.primary
                        : "rgba(255,255,255,0.06)",
                      minWidth: 160,
                      maxWidth: 280,
                    }}
                  >
                    {/* Add loader overlay for uploading voice notes */}
                    {item.isUploading && (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          borderRadius: 16,
                          justifyContent: "center",
                          alignItems: "center",
                          zIndex: 10,
                        }}
                      >
                        <ActivityIndicator size="small" color="white" />
                      </View>
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        width: "100%", // Ensure the row takes full width
                      }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          !item.isUploading &&
                          item.mediaUrl &&
                          playAudio(item.mediaUrl, item.id)
                        }
                        activeOpacity={0.8}
                        disabled={item.isUploading}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isUser
                            ? "rgba(255,255,255,0.2)"
                            : theme.colors.primary,
                          marginRight: 10,
                          opacity: item.isUploading ? 0.5 : 1,
                        }}
                      >
                        {item.isUploading ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons
                            name={playingAudioId === item.id ? "pause" : "play"}
                            size={18}
                            color="white"
                          />
                        )}
                      </TouchableOpacity>

                      {/* Mini waveform - fixed height bars to avoid distortion */}
                      <View
                        style={{
                          // flex: 1,
                          height: 24,
                          flexDirection: "row",
                          alignItems: "flex-end",
                          marginBottom: 8, // Add vertical gap below waveform
                          opacity: item.isUploading ? 0.5 : 1,
                        }}
                      >
                        {[6, 12, 8, 18, 10].map((h, i) => (
                          <View
                            key={i}
                            style={{
                              width: 2,
                              height: h,
                              borderRadius: 1,
                              marginRight: i === 23 ? 0 : 2,
                              backgroundColor: isUser
                                ? "rgba(255,255,255,0.95)"
                                : theme.colors.primary,
                              opacity: isUser ? 0.95 : 0.85,
                            }}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Duration below waveform with background for clarity */}
                    <View
                      style={{
                        backgroundColor: isUser
                          ? "rgba(255,255,255,0.2)"
                          : theme.colors.primary + "20",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        alignSelf: "flex-end", // Align to the right for consistency
                      }}
                    >
                      <CustomText
                        color={isUser ? "white" : theme.colors.text}
                        style={{
                          fontVariant: ["tabular-nums"],
                          fontWeight: "600",
                          opacity: isUser ? 0.95 : 0.8,
                        }}
                      >
                        {item.isUploading
                          ? t("chat.uploading")
                          : audioDurations?.[item.id] ?? "0:00"}
                      </CustomText>
                    </View>
                  </View>
                ) : null}

                {/* This loader is only for images and videos, not audio */}
                {item.isUploading && item.mediaType !== "audio" && (
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
                {!item.isUploading && (
                  <TouchableOpacity
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      backgroundColor: "#FF4D4D", // Filled red
                      borderRadius: 12,
                      width: 20,
                      height: 20,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() => handleDeleteMessage(item.id)}
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
            {item.text && <CustomText color={msgColor}>{item.text}</CustomText>}
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

          <View
            style={{
              flexDirection: "row",
              justifyContent: isUser ? "flex-end" : "flex-start",
              marginTop: 4,
            }}
          >
            <CustomText fontSize={theme.fonts.sizes.small} color={timeColor}>
              {item.time}
            </CustomText>
          </View>
        </Pressable>
      </View>
    );

    // Replace the outer row container View with a Pressable so long-press works anywhere in the row.
    const Row = ({ children }: { children: React.ReactNode }) => (
      <Pressable
        onLongPress={(event) => handleLongPress(item, event)}
        delayLongPress={500}
        style={({ pressed }) => [
          {
            flexDirection: isUser ? "row-reverse" : "row",
            marginVertical: 2,
            paddingHorizontal: 10,
          },
          pressed && { opacity: 0.96, transform: [{ scale: 0.995 }] },
        ]}
      >
        {children}
      </Pressable>
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

        {/* Custom swipe-to-reply functionality */}
        <SwipeToReply
          onSwipeReply={() => handleReply(item)}
          enabled={!item.isUploading}
        >
          <Row>
            {/* ensure any inner Touchable bubble also has press feedback (mirrors the Pressable above) */}
            <TouchableOpacity
              onLongPress={(event) => handleLongPress(item, event)}
              delayLongPress={500}
              activeOpacity={0.96}
              style={{
                backgroundColor: bubbleBg,
                borderRadius: 12,
                padding: 10,
                maxWidth: "70%",
                marginBottom: 3,
              }}
            >
              {item.replyTo && (
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.08)",
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: isUser
                      ? "rgba(255,255,255,0.5)"
                      : theme.colors.primary,
                  }}
                >
                  <CustomText
                    fontSize={theme.fonts.sizes.small}
                    color={
                      isUser
                        ? "rgba(255,255,255,0.9)"
                        : theme.colors.secondaryText
                    }
                    fontWeight="500"
                  >
                    {item.replyTo.senderName}
                  </CustomText>
                  <CustomText
                    fontSize={theme.fonts.sizes.small}
                    color={
                      isUser
                        ? "rgba(255,255,255,0.85)"
                        : theme.colors.secondaryText
                    }
                    numberOfLines={1}
                  >
                    {getReplyPreviewText(item.replyTo, messages)}
                  </CustomText>
                </View>
              )}

              <View>
                {item.mediaUrl && item.mediaType && (
                  <TouchableOpacity
                    onPress={() => {
                      if (item.mediaType === "audio" && item.mediaUrl) {
                        playAudio(item.mediaUrl, item.id);
                      } else if (item.mediaUrl && item.mediaType) {
                        setSelectedMedia({
                          url: item.mediaUrl,
                          type: item.mediaType,
                        });
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
                          flexDirection: "row", // Horizontal layout
                          alignItems: "center",
                          paddingVertical: 8,
                          borderRadius: 16,
                          backgroundColor: isUser
                            ? theme.colors.primary
                            : "rgba(255,255,255,0.06)",
                          minWidth: 160,
                          maxWidth: 280,
                        }}
                      >
                        {/* Add loader overlay for uploading voice notes */}
                        {item.isUploading && (
                          <View
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: "rgba(0,0,0,0.5)",
                              borderRadius: 16,
                              justifyContent: "center",
                              alignItems: "center",
                              zIndex: 10,
                            }}
                          >
                            <ActivityIndicator size="small" color="white" />
                          </View>
                        )}

                        {/* Play button */}
                        <TouchableOpacity
                          onPress={() =>
                            !item.isUploading &&
                            item.mediaUrl &&
                            playAudio(item.mediaUrl, item.id)
                          }
                          activeOpacity={0.8}
                          disabled={item.isUploading}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isUser
                              ? "rgba(255,255,255,0.2)"
                              : theme.colors.primary,
                            marginRight: 10,
                            opacity: item.isUploading ? 0.5 : 1,
                          }}
                        >
                          {item.isUploading ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Ionicons
                              name={
                                playingAudioId === item.id ? "pause" : "play"
                              }
                              size={18}
                              color="white"
                            />
                          )}
                        </TouchableOpacity>

                        {/* Waveform and duration in same row */}
                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          {/* Mini waveform */}
                          <View
                            style={{
                              height: 24,
                              flexDirection: "row",
                              alignItems: "center",
                              flex: 1,
                              marginRight: 8,
                              opacity: item.isUploading ? 0.5 : 1,
                            }}
                          >
                            {[
                              6, 12, 8, 18, 10, 20, 14, 22, 12, 18, 8, 16, 6,
                              12, 8,
                            ].map((h, i) => (
                              <View
                                key={i}
                                style={{
                                  width: 2,
                                  height: h,
                                  borderRadius: 1,
                                  marginRight: i === 23 ? 0 : 2,
                                  backgroundColor: isUser
                                    ? "rgba(255,255,255,0.95)"
                                    : theme.colors.primary,
                                  opacity: isUser ? 0.95 : 0.85,
                                }}
                              />
                            ))}
                          </View>

                          {/* Duration text */}
                          <View
                            style={{
                              backgroundColor: isUser
                                ? "rgba(255,255,255,0.2)"
                                : theme.colors.primary + "20",
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              minWidth: 50, // Ensure consistent width
                              alignItems: "center",
                            }}
                          >
                            <CustomText
                              color={isUser ? "white" : theme.colors.text}
                              style={{
                                fontVariant: ["tabular-nums"],
                                fontWeight: "600",
                                fontSize: theme.fonts.sizes.small,
                                opacity: isUser ? 0.95 : 0.8,
                              }}
                            >
                              {item.isUploading
                                ? t("chat.uploading")
                                : audioDurations?.[item.id] ?? "0:00"}
                            </CustomText>
                          </View>
                        </View>
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
                  <CustomText color={msgColor}>{item.text}</CustomText>
                )}
                {deletingMessageId === item.id && (
                  <ActivityIndicator
                    size="small"
                    color={
                      isUser ? "rgba(255,255,255,0.8)" : theme.colors.primary
                    }
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
                {item.time || formatTimeSafe(item.timestamp)}
              </CustomText>
            </TouchableOpacity>
          </Row>
        </SwipeToReply>
      </>
    );
  };

  const IOS_HEADER_OFFSET = 90;

  const openAttachmentSheet = () => {
    setShowMediaOptions(true);
  };

  const getItemLayout = (data: MessageWithHeader[] | null, index: number) => {
    const item = data ? data[index] : null;
    const headerHeight = item?.showDateHeader ? 70 : 0; // Adjusted for marginVertical: 20 + padding + text height
    const messageHeight = item?.text || item?.mediaUrl ? 120 : 50; // Adjusted for padding, text, and media
    return {
      length: headerHeight + messageHeight,
      offset: (headerHeight + messageHeight) * index,
      index,
    };
  };

  // Simplify the media picking functions - remove all setProcessingMedia calls
  const pickMultipleMedia = async () => {
    setShowMediaOptions(false);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newMediaFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.type === "video" ? "video" : "image",
          fileName:
            asset.fileName ||
            `${asset.type}_${Date.now()}.${
              asset.type === "video" ? "mp4" : "jpg"
            }`,
        }));

        setSelectedMediaFiles((prev) => [...prev, ...newMediaFiles]);
      }
    } catch (error) {
      console.error("Error picking multiple media:", error);
      Alert.alert(t("common.error"), t("chat.mediaSelectionError"));
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShowProfilePopup
        visible={showProfilePopup}
        onClose={() => setShowProfilePopup(false)}
        user={friendProfile}
        loading={profileLoading}
      />
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          edges={["top", "bottom", "left", "right"]}
        >
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
              backgroundColor: theme.colors.inputBackground,
            }}
            onPress={handleProfilePress}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 10, padding: 5 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Image
              source={{
                uri:
                  friendProfile?.avatar ||
                  avatar ||
                  "https://via.placeholder.com/40",
              }}
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
              {friendProfile?.name || name}
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
              FlatList
            </View>
          </TouchableOpacity>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => `${item.id}_${index}`}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 10, paddingTop: 8 }}
            inverted={true}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            nestedScrollEnabled={true}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={21}
            scrollEventThrottle={16}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            getItemLayout={getItemLayout}
            ListEmptyComponent={
              !loading && messages.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 250 }}>
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
                    {t("chat.sendMessageTo", {
                      name: friendProfile?.name || name,
                    })}
                  </CustomText>
                </View>
              ) : null
            }
          />
          <ShowProfilePopup
            visible={showProfilePopup}
            onClose={() => setShowProfilePopup(false)}
            user={friendProfile}
            loading={profileLoading}
          />
          {/* ADD THE MEDIA ATTACHMENT PREVIEW RIGHT HERE */}
          // Usage remains simple
          <MediaAttachmentPreview
            selectedMediaFiles={selectedMediaFiles}
            setSelectedMediaFiles={setSelectedMediaFiles}
            theme={theme}
            uploading={uploading}
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
                      {t("chat.replyingTo")}{" "}
                      {replyingTo.sender === "user"
                        ? t("chat.you")
                        : friendProfile?.name || name}
                    </CustomText>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.secondaryText}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {replyingTo?.mediaType
                        ? getReplyPreviewText(replyingTo as any, messages)
                        : replyingTo?.text}
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
                onPress={
                  uploading || recording !== null
                    ? undefined
                    : openAttachmentSheet
                }
                disabled={uploading || recording !== null}
                style={{
                  marginRight: 10,
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor: theme.colors.inputBackground,
                }}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={
                    uploading || recording !== null
                      ? theme.colors.secondaryText
                      : theme.colors.primary
                  }
                />
              </TouchableOpacity>

              {recording ? (
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    height: 44,
                    paddingHorizontal: 12,
                    backgroundColor: theme.colors.inputBackground,
                    borderRadius: 16,
                    marginRight: 10,
                  }}
                >
                  <CustomText
                    color={theme.colors.text}
                    style={{ fontVariant: ["tabular-nums"], marginRight: 10 }}
                  >
                    {`${Math.floor(recSeconds / 60)}:${(recSeconds % 60)
                      .toString()
                      .padStart(2, "0")}`}
                  </CustomText>
                  <View
                    style={{
                      flex: 1,
                      height: 20,
                      flexDirection: "row",
                      alignItems: "flex-end",
                      marginRight: 10,
                    }}
                  >
                    {[
                      6, 10, 14, 18, 14, 10, 6, 10, 14, 18, 14, 10, 6, 10, 14,
                      18, 14, 10, 6, 10, 14, 18, 14, 10, 6, 10, 14, 18, 14, 10,
                    ].map((h, i) => (
                      <View
                        key={i}
                        style={{
                          width: 2,
                          height: h,
                          borderRadius: 1,
                          marginRight: i === 11 ? 0 : 2,
                          backgroundColor: theme.colors.primary,
                          opacity: 0.9,
                        }}
                      />
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        if (recording) {
                          try {
                            await recording.stopAndUnloadAsync();
                          } catch (_) {}
                        }
                      } finally {
                        if (recTimerRef.current) {
                          clearInterval(recTimerRef.current);
                          recTimerRef.current = null;
                        }
                        setRecording(null);
                        setRecSeconds(0);
                      }
                    }}
                    style={{ padding: 6, marginRight: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      t("chat.discardRecording") || "Discard recording"
                    }
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
                  </TouchableOpacity>
                </View>
              ) : (
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
                    selectedMediaFiles.length > 0
                      ? t("chat.addCaptionOptional")
                      : editingMessage
                      ? t("chat.editYourMessage")
                      : replyingTo
                      ? t("chat.replyTo", {
                          name:
                            replyingTo.sender === "user"
                              ? t("chat.yourself")
                              : friendProfile?.name || name,
                        })
                      : t("chat.typeMessage")
                  }
                  placeholderTextColor={theme.colors.secondaryText}
                  onFocus={() => {}}
                  returnKeyType="send"
                  onSubmitEditing={sendMessage}
                  editable={!uploading && !recording}
                />
              )}

              <TouchableOpacity
                onPress={
                  recording
                    ? stopRecording
                    : newMessage.trim() || selectedMediaFiles.length > 0
                    ? sendMessage
                    : startRecording
                }
                disabled={uploading}
                style={{
                  marginLeft: 10,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    recording ||
                    newMessage.trim() ||
                    selectedMediaFiles.length > 0
                      ? theme.colors.primary
                      : theme.colors.inputBackground,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  recording
                    ? t("chat.sendRecording") || "Send recording"
                    : newMessage.trim() || selectedMediaFiles.length > 0
                    ? t("chat.sendMessage") || "Send message"
                    : t("chat.startRecording") || "Start recording"
                }
              >
                <Ionicons
                  name={
                    recording ||
                    newMessage.trim() ||
                    selectedMediaFiles.length > 0
                      ? "send"
                      : "mic"
                  }
                  size={22}
                  color={
                    recording ||
                    newMessage.trim() ||
                    selectedMediaFiles.length > 0
                      ? "white"
                      : theme.colors.primary
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

                  <View style={{ marginBottom: 15 }}>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.secondaryText}
                      style={{ marginBottom: 10 }}
                    >
                      {t("chat.cameraOptions")}
                    </CustomText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-around",
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => takePhoto("image")}
                        style={{
                          alignItems: "center",
                          padding: 15,
                          borderRadius: 12,
                          backgroundColor: theme.colors.inputBackground,
                          minWidth: 80,
                        }}
                        disabled={uploading}
                      >
                        <Ionicons
                          name="camera"
                          size={24}
                          color={theme.colors.primary}
                        />
                        <CustomText
                          color={theme.colors.text}
                          style={{ marginTop: 8, fontSize: 12 }}
                        >
                          {t("chat.photo")}
                        </CustomText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => takePhoto("video")}
                        style={{
                          alignItems: "center",
                          padding: 15,
                          borderRadius: 12,
                          backgroundColor: theme.colors.inputBackground,
                          minWidth: 80,
                        }}
                        disabled={uploading}
                      >
                        <Ionicons
                          name="videocam"
                          size={24}
                          color={theme.colors.primary}
                        />
                        <CustomText
                          color={theme.colors.text}
                          style={{ marginTop: 8, fontSize: 12 }}
                        >
                          {t("chat.video")}
                        </CustomText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                      paddingTop: 15,
                    }}
                  >
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.secondaryText}
                      style={{ marginBottom: 10 }}
                    >
                      {t("chat.galleryOptions")}
                    </CustomText>
                    <TouchableOpacity
                      onPress={pickMultipleMedia}
                      style={{
                        alignItems: "center",
                        padding: 15,
                        borderRadius: 12,
                        backgroundColor: theme.colors.inputBackground,
                      }}
                      disabled={uploading}
                    >
                      <Ionicons
                        name="images"
                        size={24}
                        color={theme.colors.primary}
                      />
                      <CustomText
                        color={theme.colors.text}
                        style={{ marginTop: 8, fontSize: 12 }}
                      >
                        {t("chat.gallery")}
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
            {/* Forward Modal */}
            <ForwardMessagePopup
              visible={forwardPopup.visible}
              onClose={closeForwardPopup}
              onForward={(userIds) =>
                handleForwardMessage(userIds, forwardPopup.message!)
              }
            />
            {/* Context Menu */}
            <MessageContextMenu
              visible={contextMenu.visible}
              onClose={closeContextMenu}
              position={contextMenu.position}
              message={contextMenu.message}
              onEdit={handleContextMenuEdit}
              onDelete={handleContextMenuDelete}
              onForward={handleContextMenuForward}
              onCopy={handleContextMenuCopy}
              onDownload={handleContextMenuDownload}
              isOwnMessage={contextMenu.message?.sender === "user"}
            />
            {/* Media Preview Modal */}
            <Modal
              visible={!!selectedMedia}
              transparent={true}
              onRequestClose={() => setSelectedMedia(null)}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.9)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    padding: 10,
                    zIndex: 10,
                  }}
                  onPress={() => setSelectedMedia(null)}
                >
                  <Ionicons name="close-circle" size={30} color="white" />
                </TouchableOpacity>
                {selectedMedia?.type === "image" ? (
                  <Image
                    source={{ uri: selectedMedia.url }}
                    style={{
                      width: "90%",
                      height: "80%",
                      resizeMode: "contain",
                    }}
                  />
                ) : selectedMedia?.type === "video" ? (
                  <Video
                    source={{ uri: selectedMedia.url }}
                    style={{ width: "90%", height: "80%" }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping
                  />
                ) : null}
              </View>
            </Modal>
          </View>
        </SafeAreaView>
      {/* </KeyboardAvoidingView> */}
    </GestureHandlerRootView>
  );
}

// ... (all your existing code)

// Update the MediaAttachmentPreview component to show loader during processing
// Optimized MediaAttachmentPreview component
const MediaAttachmentPreview = React.memo(
  ({
    selectedMediaFiles,
    setSelectedMediaFiles,
    theme,
    uploading,
  }: {
    selectedMediaFiles: Array<{
      uri: string;
      type: "image" | "video";
      fileName: string;
    }>;
    setSelectedMediaFiles: (files: any) => void;
    theme: any;
    uploading: boolean;
  }) => {
    // Don't show preview during upload or if no media selected
    if (selectedMediaFiles.length === 0 || uploading) return null;

    return (
      <View
        style={{
          backgroundColor: theme.colors.inputBackground,
          padding: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        {/* Close button */}
        <TouchableOpacity
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            backgroundColor: "#CC0000",
            borderRadius: 12,
            width: 24,
            height: 24,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
          }}
          onPress={() => {
            setSelectedMediaFiles([]);
          }}
        >
          <Ionicons name="close" size={16} color="white" />
        </TouchableOpacity>

        {/* Media Preview - Optimized with FlatList for better performance */}
        <FlatList
          data={selectedMediaFiles}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `media-${index}-${item.uri}`}
          renderItem={({ item: media, index }) => (
            <View style={{ margin: 5, position: "relative" }}>
              {media.type === "image" ? (
                <Image
                  source={{ uri: media.uri }}
                  style={{ width: 80, height: 80, borderRadius: 8 }}
                  resizeMode="cover"
                  // Add fadeDuration to make image loading smoother
                  fadeDuration={100}
                />
              ) : (
                <View style={{ position: "relative" }}>
                  <Video
                    source={{ uri: media.uri }}
                    style={{ width: 80, height: 80, borderRadius: 8 }}
                    resizeMode="cover"
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
                    <Ionicons name="play" size={24} color="white" />
                  </View>
                </View>
              )}

              {/* Remove individual media button */}
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  backgroundColor: "#CC0000",
                  borderRadius: 12,
                  width: 20,
                  height: 20,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => {
                  setSelectedMediaFiles((prev) =>
                    prev.filter((_, i) => i !== index)
                  );
                }}
              >
                <Ionicons name="close" size={12} color="white" />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ paddingRight: 30 }} // Space for close button
        />
      </View>
    );
  }
);

export default ChatRoom;
