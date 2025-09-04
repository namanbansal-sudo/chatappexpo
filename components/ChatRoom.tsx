"use client"

import type React from "react"

import { useLanguage } from "@/i18n"
import { ChatService } from "@/services/chatService"
import { uploadToCloudinary } from "@/services/cloudinary"
import { Ionicons } from "@expo/vector-icons"
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore"
import { Audio, ResizeMode, Video } from "expo-av"
import * as Clipboard from "expo-clipboard"
import * as FileSystem from "expo-file-system"
import * as ImagePicker from "expo-image-picker"
import * as MediaLibrary from "expo-media-library"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native"
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler"
import { SafeAreaView } from "react-native-safe-area-context"
import { CustomText } from "./customText"
import { ForwardMessagePopup } from "./ForwardMessagePopup"
import { MessageContextMenu } from "./MessageContextMenu"
import { useThemeContext } from "./ThemeContext"
import { useUser } from "./UserContext"

// Define the params type outside the component
interface ChatRoomParams {
  name?: string | string[]
  avatar?: string | string[]
  userId?: string | string[]
  friendUserId?: string | string[]
  currentUserId?: string | string[]
}

interface Message {
  id: string
  text: string
  sender: "user" | "other"
  time: string
  timestamp: Date
  replyTo?: {
    messageId: string
    text: string
    senderId: string
    senderName: string
  }
  edited?: boolean
  mediaUrl?: string
  mediaType?: "image" | "video" | "audio"
  fileName?: string
  isUploading?: boolean
}

interface MessageWithHeader extends Message {
  showDateHeader?: boolean
  dateHeaderText?: string
}

interface FirebaseChatMessage {
  id: string
  senderId: string
  timestamp: any
  content?: {
    text?: string
  }
  message?: string
  text?: string
  replyTo?: any
  edited?: boolean
  mediaUrl?: string
  mediaType?: "image" | "video" | "audio"
}

interface FriendProfile {
  avatar?: string
  name?: string
  email?: string
  designation?: string
}

function toDateSafe(value: any): Date | null {
  try {
    if (!value) return null
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value
    }
    // Firestore Timestamp
    if (typeof value === "object" && typeof (value as any).toDate === "function") {
      const d = (value as any).toDate()
      return isNaN(d.getTime()) ? null : d
    }
    if (typeof value === "number") {
      const d = new Date(value)
      return isNaN(d.getTime()) ? null : d
    }
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (!trimmed) return null
      // Try numeric epoch first, then ISO/date string
      const asNum = Number(trimmed)
      const d = Number.isFinite(asNum) && trimmed.length >= 11 ? new Date(asNum) : new Date(trimmed)
      return isNaN(d.getTime()) ? null : d
    }
    return null
  } catch {
    return null
  }
}

function formatTimeSafe(value: any, fallback?: string): string {
  const d = toDateSafe(value)
  if (d) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  }
  // If we have a fallback time string, use it
  if (fallback && typeof fallback === 'string' && fallback.trim()) {
    return fallback
  }
  // Default to current time if nothing else works
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

const showToast = (message: string) => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT)
  } else {
    // If you have an in-app toast component, replace this with it.
    // Intentionally no Alert here to honor "only toast" requirement on copy.
    console.log("[toast]", message)
  }
}

export default function ChatRoom() {
  const params = useLocalSearchParams<ChatRoomParams>()

  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name
  const avatarParam = Array.isArray(params.avatar) ? params.avatar[0] : params.avatar
  const userIdParam = Array.isArray(params.userId) ? params.userId[0] : params.userId
  const friendUserIdParam = Array.isArray(params.friendUserId) ? params.friendUserId[0] : params.friendUserId

  const name = nameParam || "Chat"
  const avatar = avatarParam || ""
  const friendUserId = friendUserIdParam || userIdParam

  const { theme } = useThemeContext()
  const { t } = useLanguage()
  const { user } = useUser()
  const router = useRouter()

  const [messages, setMessages] = useState<MessageWithHeader[]>([])
  const [loading, setLoading] = useState(false)
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    message: Message | null
    position: { x: number; y: number }
  }>({ visible: false, message: null, position: { x: 0, y: 0 } })
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [forwardPopup, setForwardPopup] = useState<{
    visible: boolean
    message: Message | null
  }>({ visible: false, message: null })
  const [showMediaOptions, setShowMediaOptions] = useState(false)
  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [audioUri, setAudioUri] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: "image" | "video" | "audio" } | null>(null)
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [audioDurations, setAudioDurations] = useState<Record<string, string>>({})
  const [recSeconds, setRecSeconds] = useState(0)
  const recTimerRef = useRef<NodeJS.Timeout | null>(null)

  const flatListRef = useRef<FlatList<MessageWithHeader>>(null)

  // Fetch friend profile
  const fetchFriendProfile = useCallback(async () => {
    if (!friendUserId) return

    setProfileLoading(true)
    try {
      const userRef = doc(getFirestore(), "users", friendUserId)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        const data = userSnap.data()
        setFriendProfile({
          avatar: data.photo,
          name: data.name,
          email: data.email,
          designation: data.designation,
        })
      } else {
        setFriendProfile(null)
      }
    } catch (error) {
      console.error("Error fetching friend profile:", error)
      setFriendProfile(null)
      Alert.alert(t("common.error"), t("chat.profileFetchError"))
    } finally {
      setProfileLoading(false)
    }
  }, [friendUserId, t])

  // -------- Helpers --------
  const getDateHeaderText = (dateLike: any): string => {
    const date = toDateSafe(dateLike)
    if (!date) return ""

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (messageDate.getTime() === today.getTime()) return "Today"
    if (messageDate.getTime() === yesterday.getTime()) return "Yesterday"

    const currentYear = now.getFullYear()
    const messageYear = date.getFullYear()

    if (messageYear === currentYear) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
  }

  const addDateHeaders = (messageList: Message[]): MessageWithHeader[] => {
    if (messageList.length === 0) return []
    const out: MessageWithHeader[] = []
    let lastHeader = ""

    messageList.forEach((m, index) => {
      const header = getDateHeaderText(m.timestamp)
      const shouldShow = header && (index === 0 || header !== lastHeader)

      if (shouldShow) {
        out.push({ ...m, showDateHeader: true, dateHeaderText: header })
        lastHeader = header
      } else {
        out.push(m)
      }
    })

    return out
  }

  // -------- Audio Functions --------
  const requestPermission = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync()
      return permission.status === "granted"
    } catch (error) {
      console.error("Error requesting audio permissions:", error)
      return false
    }
  }

  const startRecording = async () => {
    try {
      const granted = await requestPermission()
      if (!granted) {
        Alert.alert(t("common.error"), t("chat.microphonePermissionRequired"))
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      // reset and start timer
      setRecSeconds(0)
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current)
        recTimerRef.current = null
      }
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1)
      }, 1000)

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)

      setRecording(recording)
    } catch (error) {
      console.error("Error starting recording:", error)
      Alert.alert(t("common.error"), t("chat.recordingStartError"))
    }
  }

  const stopRecording = async () => {
    if (!recording) return

    try {
      // stop timer
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current)
        recTimerRef.current = null
      }

      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setAudioUri(uri)
      setRecording(null)
      if (uri) {
        console.log("uri", uri)
        await handleAudioUpload(uri)
      }
    } catch (error) {
      console.error("Error stopping recording:", error)
      Alert.alert(t("common.error"), t("chat.recordingStopError"))
    } finally {
      // ensure timer is reset visually
      setRecSeconds(0)
    }
  }

  const playAudio = async (uri: string, messageId: string) => {
    try {
      // If clicking on currently playing audio, pause it
      if (playingAudioId === messageId && currentSound) {
        const status = await currentSound.getStatusAsync()
        if (status.isLoaded) {
          if (status.isPlaying) {
            await currentSound.pauseAsync()
            setPlayingAudioId(null)
          } else {
            await currentSound.playAsync()
            setPlayingAudioId(messageId)
          }
        }
        return
      }

      // Stop any currently playing audio
      if (currentSound) {
        try {
          const status = await currentSound.getStatusAsync()
          if (status.isLoaded) {
            await currentSound.stopAsync()
          }
          await currentSound.unloadAsync()
        } catch (e) {
          console.log("Error stopping previous sound:", e)
        }
        setCurrentSound(null)
        setPlayingAudioId(null)
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })

      // Create sound without auto-play first
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false, isLooping: false })

      setCurrentSound(sound)

      // Set up playback status listener before playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setPlayingAudioId(null)
            sound.unloadAsync().catch(console.error)
            setCurrentSound(null)
          }
        }
      })

      // Now play the sound after it's set up
      await sound.playAsync()
      setPlayingAudioId(messageId)
    } catch (error) {
      console.error("Error playing audio:", error)
      Alert.alert(t("common.error"), t("chat.audioPlaybackError"))
      setPlayingAudioId(null)
      setCurrentSound(null)
    }
  }

  const uploadAudio = async (uri: string) => {
    const formData = new FormData()
    formData.append("file", {
      uri,
      type: "audio/m4a",
      name: "voice-note.m4a",
    } as any)
    formData.append("upload_preset", "chatsupp_Preset")

    try {
      const response = await fetch("https://api.cloudinary.com/v1_1/dtwqn1r7v/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }

      const data = await response.json()
      return data.secure_url
    } catch (error) {
      console.error("Error uploading audio to Cloudinary:", error)
      throw error
    }
  }

  const handleAudioUpload = async (uri: string) => {
    if (!user?.uid || !friendUserId || uploading) return

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const currentTime = new Date()
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: "",
      sender: "user",
      time: currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      timestamp: currentTime,
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
    }

    const updatedMessages = [optimisticMessage, ...messages]
    if (
      messages.length === 0 ||
      getDateHeaderText(optimisticMessage.timestamp) !== getDateHeaderText(messages[0].timestamp)
    ) {
      updatedMessages[0] = {
        ...optimisticMessage,
        showDateHeader: true,
        dateHeaderText: getDateHeaderText(optimisticMessage.timestamp),
      }
    }
    console.log("uri", uri)
    setMessages(updatedMessages)
    setReplyingTo(null)
    setAudioUri(null)

    try {
      setUploading(true)
      const cloudinaryUrl = await uploadAudio(uri)

      await ChatService.testUserDocuments(user.uid, friendUserId)
      await ChatService.ensureChatExists(user.uid, friendUserId)
      const newMessageId = await ChatService.sendMessageWithReply(user.uid, friendUserId, "", replyingTo, {
        mediaUrl: cloudinaryUrl,
        mediaType: "audio",
        fileName: "voice-note.m4a",
      })

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
            : m,
        ),
      )
    } catch (error) {
      console.error("Error uploading audio:", error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      Alert.alert(t("common.error"), t("chat.audioUploadError"))
    } finally {
      setUploading(false)
    }
  }

  const formatMsToClock = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const ensureAudioDuration = async (id: string, uri: string) => {
    if (audioDurations[id]) return
    try {
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false })
      const status = await sound.getStatusAsync()
      if (status.isLoaded && typeof status.durationMillis === "number") {
        setAudioDurations((prev) => ({ ...prev, [id]: formatMsToClock(status.durationMillis) }))
      }
      await sound.unloadAsync()
    } catch {}
  }

  const seeded = (str: string) => {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
    }
    return Math.abs(h)
  }

  const getStaticBars = (seedKey: string, count = 32) => {
    const seed = seeded(seedKey)
    const bars: number[] = []
    for (let i = 0; i < count; i++) {
      const v = Math.abs(Math.sin((seed + i * 31) % 997)) * 16 + 8 // 8-24px
      bars.push(Math.round(v))
    }
    return bars
  }

  const getAnimatedBars = (t: number, count = 36) => {
    const bars: number[] = []
    for (let i = 0; i < count; i++) {
      const v = (Math.sin(t / 2 + i * 0.7) + 1) * 10 + 8 // 8-28px
      bars.push(Math.round(v))
    }
    return bars
  }

  useEffect(() => {
    messages.filter((m) => m.mediaType === "audio" && m.mediaUrl).forEach((m) => ensureAudioDuration(m.id, m.mediaUrl!))
  }, [messages])

  const getReplyPreviewText = (
    reply: Message["replyTo"] | Message | null | undefined,
    allMsgs: Message[] = messages,
  ) => {
    try {
      if (!reply) return ""
      // Try to locate the original message using messageId or id
      // @ts-ignore
      const replyId = (reply?.messageId || (reply as any)?.id) as string | undefined
      const original = replyId ? allMsgs.find((m) => m.id === replyId) : (reply as any)
      const mediaType = original?.mediaType as "image" | "video" | "audio" | undefined
      if (mediaType === "image") return "Image"
      if (mediaType === "video") return "Video"
      if (mediaType === "audio") return "Voice note"
      // fallback to provided reply text
      // @ts-ignore
      return (reply as any)?.text || ""
    } catch {
      return ""
    }
  }

  // -------- Realtime subscription --------
  useEffect(() => {
    if (!user?.uid || !friendUserId) {
      console.log("❌ Missing user or friendUserId:", { user: user?.uid, friendUserId })
      setLoading(false)
      return
    }

    console.log("🔄 Setting up message subscription for:", { user: user.uid, friendUserId })
    let unsubscribe: (() => void) | null = null

    try {
      unsubscribe = ChatService.subscribeToMessages(
        user.uid,
        friendUserId,
        (firebaseMessages: FirebaseChatMessage[]) => {
          console.log("📱 Received messages:", firebaseMessages.length)
          const formatted: Message[] = firebaseMessages.map((msg) => {
            const date = toDateSafe(msg.timestamp) ?? new Date()

            return {
              id: msg.id,
              text: msg.content?.text || msg.message || msg.text || "",
              sender: msg.senderId === user.uid ? "user" : "other",
              time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
              timestamp: date,
              edited: msg.edited || false,
              mediaUrl: msg.mediaUrl,
              mediaType: msg.mediaType as "image" | "video" | "audio" | undefined,
              replyTo:
                msg.replyTo && typeof msg.replyTo === "object"
                  ? {
                      messageId: msg.replyTo.messageId || msg.replyTo.id || "",
                      text: msg.replyTo.text || "",
                      senderId: msg.replyTo.senderId || "",
                      senderName: msg.replyTo.senderName || "",
                    }
                  : undefined,
            }
          })

          const sortedMessages = formatted.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          const withHeaders = addDateHeaders(sortedMessages)
          const reversedWithHeaders = withHeaders.reverse()
          setMessages(reversedWithHeaders)
          setLoading(false)

          if (!initialMessagesLoaded && formatted.length > 0) {
            setInitialMessagesLoaded(true)
          }

          const chatId = ChatService.generateChatId(user.uid, friendUserId)
          ChatService.markMessagesAsRead(chatId, user.uid)
            .then(() => console.log("✅ Messages marked as read successfully"))
            .catch((error) => {
              console.log("⚠️ Fallback: using markIncomingFromSenderAsRead")
              return ChatService.markIncomingFromSenderAsRead(chatId, user.uid!, friendUserId!)
            })
            .catch((error) => console.error("❌ Failed to mark messages as read:", error))
        },
      )
    } catch (e) {
      console.error("Error setting up message listener:", e)
      setLoading(false)
    }

    return () => unsubscribe?.()
  }, [user?.uid, friendUserId])

  useEffect(() => {
    if (!user?.uid || !friendUserId) return
    const chatId = ChatService.generateChatId(user.uid, friendUserId)

    const markAsRead = () => {
      ChatService.markMessagesAsRead(chatId, user.uid!)
        .catch(() => ChatService.markIncomingFromSenderAsRead(chatId, user.uid!, friendUserId!))
        .catch(() => {})
    }

    markAsRead()
    const interval = setInterval(markAsRead, 2000)

    return () => clearInterval(interval)
  }, [user?.uid, friendUserId])

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      if (currentSound) {
        currentSound
          .stopAsync()
          .then(() => {
            currentSound.unloadAsync()
          })
          .catch(console.error)
      }
    }
  }, [currentSound])

  const handleReply = (message: Message) => setReplyingTo(message)

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message)
    setNewMessage(message.text)
    setReplyingTo(null)
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setNewMessage("")
  }

  const handleSaveEdit = useCallback(async () => {
    if (!newMessage.trim() || !editingMessage || !user?.uid || !friendUserId || sending) return

    const messageToSave = newMessage.trim()
    const originalMessage = editingMessage

    setEditingMessage(null)
    setNewMessage("")

    try {
      setSending(true)
      const chatId = ChatService.generateChatId(user.uid, friendUserId)
      await ChatService.editMessage(chatId, originalMessage.id, messageToSave)
    } catch (e) {
      console.error("Error editing message:", e)
      setEditingMessage(originalMessage)
      setNewMessage(messageToSave)
      Alert.alert(t("common.error"), t("chat.editError"))
    } finally {
      setSending(false)
    }
  }, [newMessage, editingMessage, sending, user?.uid, friendUserId])

  const scrollToNewest = useCallback(() => {
    // With inverted FlatList, offset 0 shows the newest message (index 0)
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true })
    })
  }, [])

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user?.uid || !friendUserId || sending) {
      console.warn('⚠️ Cannot send message: missing input or already sending', {
        newMessage,
        userId: user?.uid,
        friendUserId,
        sending,
      });
      return;
    }
  
    if (editingMessage) {
      console.log('🔍 Handling edit instead of send');
      return handleSaveEdit();
    }
  
    const messageToSend = newMessage.trim();
    const replyData = replyingTo;
  
    // Validate replyData
    console.log('🔍 sendMessage replyData:', replyData);
    if (replyData) {
      if (!replyData.id || !replyData.sender || typeof replyData.text !== 'string') {
        console.error('❌ Invalid replyData:', replyData);
        Alert.alert(t('common.error'), t('chat.invalidReplyData'));
        return;
      }
      if (!friendUserId) {
        console.error('❌ friendUserId is missing for replyData:', replyData);
        Alert.alert(t('common.error'), t('chat.missingFriendId'));
        return;
      }
    }
  
    // Create optimistic message
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: messageToSend,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date(),
      replyTo: replyData
        ? {
            messageId: replyData.id,
            text: replyData.text ?? '',
            senderId: replyData.sender === 'user' ? user.uid : friendUserId,
            senderName: replyData.sender === 'user' ? 'You' : name || 'Friend',
          }
        : undefined,
    };
  
    // Update UI optimistically
    const updatedMessages = [optimisticMessage, ...messages];
    if (
      messages.length === 0 ||
      getDateHeaderText(optimisticMessage.timestamp) !== getDateHeaderText(messages[0].timestamp)
    ) {
      updatedMessages[0] = {
        ...optimisticMessage,
        showDateHeader: true,
        dateHeaderText: getDateHeaderText(optimisticMessage.timestamp),
      };
    }
    setMessages(updatedMessages);
    setNewMessage('');
    setReplyingTo(null);
  
    try {
      setSending(true);
      console.log('🔍 Testing user documents and ensuring chat exists...');
      await ChatService.testUserDocuments(user.uid, friendUserId);
      await ChatService.ensureChatExists(user.uid, friendUserId);
  
      // Optional: Validate replyData.id against Firestore (if performance allows)
      if (replyData) {
        const db = getFirestore();
        const chatId = ChatService.generateChatId(user.uid, friendUserId);
        const replyMessageRef = doc(db, 'chats', chatId, 'messages', replyData.id);
        const replyMessageSnap = await getDoc(replyMessageRef);
        if (!replyMessageSnap.exists()) {
          console.error('❌ Reply message not found in Firestore:', replyData.id);
          throw new Error(`Reply message not found: ${replyData.id}`);
        }
        console.log('✅ Reply message validated in Firestore:', replyData.id);
      }
  
      console.log('🔍 Calling sendMessageWithReply with:', {
        senderId: user.uid,
        receiverId: friendUserId,
        message: messageToSend,
        replyTo: replyData
          ? {
              messageId: replyData.id,
              text: replyData.text ?? '',
              senderId: replyData.sender === 'user' ? user.uid : friendUserId,
              senderName: replyData.sender === 'user' ? 'You' : name || 'Friend',
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
              text: replyData.text ?? '',
              senderId: replyData.sender === 'user' ? user.uid : friendUserId,
              senderName: replyData.sender === 'user' ? 'You' : name || 'Friend',
            }
          : null,
      );
  
      console.log('✅ Message sent successfully, ID:', messageId);
  
      // Update the optimistic message with the real messageId
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, id: messageId } : msg
        )
      );
    } catch (e) {
      console.error('❌ Error sending message:', e, {
        senderId: user.uid,
        receiverId: friendUserId,
        message: messageToSend,
        replyData,
      });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(messageToSend);
      setReplyingTo(replyData);
      Alert.alert(t('common.error'), t('chat.sendError'));
    } finally {
      setSending(false);
    }
  }, [newMessage, replyingTo, editingMessage, sending, user?.uid, friendUserId, handleSaveEdit, messages, name]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.uid || !friendUserId) return

    setDeletingMessageId(messageId)
    try {
      const chatId = ChatService.generateChatId(user.uid, friendUserId)
      await ChatService.deleteMessage(chatId, messageId)
    } catch (error) {
      console.error("Error deleting message:", error)
      Alert.alert(t("common.error"), t("chat.deleteError"))
    } finally {
      setDeletingMessageId(null)
    }
  }

  const getPressXY = (e: any) => {
    const ne = (e && e.nativeEvent) || e || {}
    const x = ne.pageX ?? ne.clientX ?? ne.locationX ?? 0
    const y = ne.pageY ?? ne.clientY ?? ne.locationY ?? 0
    return { x, y }
  }

  const handleLongPress = (message: Message, event: any) => {
    const { x, y } = getPressXY(event)
    setContextMenu({ visible: true, message, position: { x, y } })
  }

  const closeContextMenu = () => {
    setContextMenu({ visible: false, message: null, position: { x: 0, y: 0 } })
  }

  const handleContextMenuEdit = (message: Message) => {
    handleEditMessage(message)
    closeContextMenu()
  }

  const handleContextMenuDelete = (messageId: string) => {
    handleDeleteMessage(messageId)
    closeContextMenu()
  }

  const handleContextMenuForward = (message: Message) => {
    setForwardPopup({ visible: true, message })
    closeContextMenu()
  }

  const handleContextMenuCopy = (message: Message) => {
    handleCopy(message)
    closeContextMenu()
  }

  const handleContextMenuDownload = (message: Message) => {
    handleDownload(message)
    closeContextMenu()
  }

  const handleCopy = async (message: Message) => {
    if (message.text) {
      await Clipboard.setStringAsync(message.text)
      showToast(t("chat.messageCopied")) // toast only
    } else if (message.mediaType === "image" && message.mediaUrl) {
      try {
        const fileUri = `${FileSystem.cacheDirectory}temp_image_${Date.now()}.jpg`
        const { uri } = await FileSystem.downloadAsync(message.mediaUrl, fileUri)
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
        await Clipboard.setImageAsync(base64)
        showToast(t("chat.imageCopied")) // toast only
      } catch (error) {
        console.error("Error copying image:", error)
        Alert.alert(t("common.error"), t("chat.copyError"))
      }
    } else if (message.mediaType === "video" && message.mediaUrl) {
      await Clipboard.setStringAsync(message.mediaUrl)
      showToast(t("chat.videoUrlCopied")) // toast only
    } else if (message.mediaType === "audio" && message.mediaUrl) {
      await Clipboard.setStringAsync(message.mediaUrl)
      showToast(t("chat.audioUrlCopied")) // toast only
    } else {
      Alert.alert(t("common.error"), t("chat.nothingToCopy"))
    }
  }

  const handleDownload = async (message: Message) => {
    if (!message.mediaUrl) {
      console.error("No media URL provided for download")
      Alert.alert(t("common.error"), t("chat.downloadError"))
      return
    }

    try {
      console.log("Requesting media library permissions")
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== "granted") {
        console.error("Media library permission denied")
        Alert.alert(t("common.error"), t("chat.permissionRequired"))
        return
      }

      console.log("Downloading file from:", message.mediaUrl)
      const fileExtension = message.mediaType === "image" ? "jpg" : message.mediaType === "video" ? "mp4" : "m4a"
      const fileUri = `${FileSystem.cacheDirectory}media_${Date.now()}.${fileExtension}`
      const downloadResult = await FileSystem.downloadAsync(message.mediaUrl, fileUri)
      console.log("Download result:", { uri: downloadResult.uri, status: downloadResult.status })

      if (downloadResult.status !== 200) {
        console.error("Download failed with status:", downloadResult.status)
        throw new Error(`Download failed with status ${downloadResult.status}`)
      }

      console.log("Saving file to gallery:", downloadResult.uri)
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)
      await MediaLibrary.createAlbumAsync("ChatMedia", asset, false)
      console.log("File saved successfully:", asset)

      Alert.alert(t("common.success"), t("chat.mediaSaved"))
    } catch (error) {
      console.error("Error downloading media:", error)
      Alert.alert(t("common.error"), `${t("chat.downloadError")}: ${(error as Error).message || "Unknown error"}`)
    }
  }

  const handleForwardMessage = async (userIds: string[], message: Message) => {
    setForwardPopup({ visible: false, message: null })

    try {
      console.log("Forwarding message:", message)
      await ChatService.forwardMessage(message, userIds, user?.uid || "")
      Alert.alert(t("common.success"), t("chat.messageForwarded"))
    } catch (error) {
      console.error("Error forwarding message:", error)
      Alert.alert(t("common.error"), t("chat.forwardError"))
    }
  }

  const pickImage = async () => {
    setShowMediaOptions(false)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      await handleMediaUpload(result.assets[0].uri, "image", result.assets[0].fileName || "image.jpg")
    }
  }

  const pickVideo = async () => {
    setShowMediaOptions(false)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      await handleMediaUpload(result.assets[0].uri, "video", result.assets[0].fileName || "video.mp4")
    }
  }

  const takePhoto = async () => {
    setShowMediaOptions(false)
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      await handleMediaUpload(result.assets[0].uri, "image", result.assets[0].fileName || "photo.jpg")
    }
  }

  const handleMediaUpload = async (uri: string, type: "image" | "video", fileName: string) => {
    if (!user?.uid || !friendUserId || uploading) return

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const currentTime = new Date()
    const optimisticMessage: MessageWithHeader = {
      id: tempId,
      text: "",
      sender: "user",
      time: currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      timestamp: currentTime,
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
    }

    const updatedMessages = [optimisticMessage, ...messages]
    if (
      messages.length === 0 ||
      getDateHeaderText(optimisticMessage.timestamp) !== getDateHeaderText(messages[0].timestamp)
    ) {
      updatedMessages[0] = {
        ...optimisticMessage,
        showDateHeader: true,
        dateHeaderText: getDateHeaderText(optimisticMessage.timestamp),
      }
    }
    setMessages(updatedMessages)
    setReplyingTo(null)

    try {
      setUploading(true)
      const cloudinaryUrl = await uploadToCloudinary(uri, type)

      await ChatService.testUserDocuments(user.uid, friendUserId)
      await ChatService.ensureChatExists(user.uid, friendUserId)
      const newMessageId = await ChatService.sendMessageWithReply(user.uid, friendUserId, "", replyingTo, {
        mediaUrl: cloudinaryUrl,
        mediaType: type,
        fileName,
      })

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
            : m,
        ),
      )
    } catch (error) {
      console.error("Error uploading media:", error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      Alert.alert(t("common.error"), t("chat.mediaUploadError"))
    } finally {
      setUploading(false)
    }
  }

  const closeForwardPopup = () => {
    setForwardPopup({ visible: false, message: null })
  }

  const handleProfilePress = () => {
    setShowProfilePopup(true)
    fetchFriendProfile()
  }

  const renderLeftAction = (_message: Message) => null
  // You can also delete renderRightAction if unused; leaving no arrow visuals.

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
  )

  const renderMessage = ({ item }: { item: MessageWithHeader }) => {
    const isUser = item.sender === "user"
    const bubbleBg = isUser ? theme.colors.primary : theme.colors.inputBackground
    const msgColor = isUser ? "#FFFFFF" : theme.colors.text
    const timeColor = isUser ? "rgba(255,255,255,0.8)" : theme.colors.secondaryText

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
                borderLeftColor: isUser ? "rgba(255,255,255,0.5)" : theme.colors.border,
                paddingLeft: 8,
                paddingBottom: 6,
                marginBottom: 6,
                opacity: 0.9,
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
                {getReplyPreviewText(item.replyTo, messages)}
              </CustomText>
            </View>
          )}

          <View>
            {item.mediaUrl && item.mediaType && (
              <TouchableOpacity
                onPress={() => {
                  if (item.mediaType === "audio" && item.mediaUrl) {
                    playAudio(item.mediaUrl, item.id)
                  } else if (item.mediaUrl && item.mediaType) {
                    setSelectedMedia({ url: item.mediaUrl, type: item.mediaType })
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
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      backgroundColor: isUser ? theme.colors.primary : "rgba(255,255,255,0.06)",
                      minWidth: 160,
                      maxWidth: 280,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => item.mediaUrl && playAudio(item.mediaUrl, item.id)}
                      activeOpacity={0.8}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.colors.primary,
                        marginRight: 10,
                      }}
                    >
                      <Ionicons name={playingAudioId === item.id ? "pause" : "play"} size={18} color="white" />
                    </TouchableOpacity>

                    {/* Mini waveform - fixed height bars to avoid distortion */}
                    <View
                      style={{ flex: 1, height: 24, flexDirection: "row", alignItems: "flex-end", marginRight: 10 }}
                    >
                      {[6, 12, 8, 18, 10, 20, 14, 22, 12, 18, 8, 16, 6, 12, 8, 18, 10, 20, 14, 22, 12, 18, 8, 16].map(
                        (h, i) => (
                          <View
                            key={i}
                            style={{
                              width: 2,
                              height: h,
                              borderRadius: 1,
                              marginRight: i === 23 ? 0 : 2,
                              backgroundColor: isUser ? "rgba(255,255,255,0.95)" : theme.colors.primary,
                              opacity: isUser ? 0.95 : 0.85,
                            }}
                          />
                        ),
                      )}
                    </View>

                    {/* Duration on right inside bubble */}
                    <CustomText
                      color={isUser ? "white" : theme.colors.text}
                      style={{ fontVariant: ["tabular-nums"], opacity: isUser ? 0.95 : 0.8 }}
                    >
                      {audioDurations?.[item.id] ?? "0:00"}
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
            {item.text && <CustomText color={msgColor}>{item.text}</CustomText>}
            {deletingMessageId === item.id && (
              <ActivityIndicator
                size="small"
                color={isUser ? "rgba(255,255,255,0.8)" : theme.colors.primary}
                style={{ marginTop: 4, alignSelf: "center" }}
              />
            )}
          </View>

          {item.edited && (
            <CustomText fontSize={10} color={timeColor} style={{ fontStyle: "italic", marginTop: 2 }}>
              {t("chat.edited")}
            </CustomText>
          )}

          <View style={{ flexDirection: "row", justifyContent: isUser ? "flex-end" : "flex-start", marginTop: 4 }}>
            <CustomText fontSize={theme.fonts.sizes.small} color={timeColor}>
              {item.time}
            </CustomText>
          </View>
        </Pressable>
      </View>
    )

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
    )

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
              <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.secondaryText} fontWeight="500">
                {item.dateHeaderText}
              </CustomText>
            </View>
          </View>
        )}

        {/* Swipe triggers reply automatically; no arrow icon is rendered */}
        <Swipeable
          renderLeftActions={() => (
            <View
              style={{
                width: 72,
                backgroundColor: "transparent",
                // let touches pass through this visual-only area
                // @ts-ignore - RN Web accepts this, native ignores safely
                pointerEvents: "none",
              }}
            />
          )}
          overshootLeft={false}
          friction={2}
          leftThreshold={56}
          enabled={!item.isUploading}
          onSwipeableOpen={(direction) => {
            if (direction === "left") {
              handleReply(item)
              // optional: close the panel after setting reply (uncomment if needed)
              // swipeableRef.current?.close()
            }
          }}
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
                    {getReplyPreviewText(item.replyTo, messages)}
                  </CustomText>
                </View>
              )}

              <View>
                {item.mediaUrl && item.mediaType && (
                  <TouchableOpacity
                    onPress={() => {
                      if (item.mediaType === "audio" && item.mediaUrl) {
                        playAudio(item.mediaUrl, item.id)
                      } else if (item.mediaUrl && item.mediaType) {
                        setSelectedMedia({ url: item.mediaUrl, type: item.mediaType })
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
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          backgroundColor: isUser ? theme.colors.primary : "rgba(255,255,255,0.06)",
                          minWidth: 160,
                          maxWidth: 280,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => item.mediaUrl && playAudio(item.mediaUrl, item.id)}
                          activeOpacity={0.8}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.colors.primary,
                            marginRight: 10,
                          }}
                        >
                          <Ionicons name={playingAudioId === item.id ? "pause" : "play"} size={18} color="white" />
                        </TouchableOpacity>

                        {/* Mini waveform - fixed height bars to avoid distortion */}
                        <View
                          style={{ flex: 1, height: 24, flexDirection: "row", alignItems: "flex-end", marginRight: 10 }}
                        >
                          {[
                            6, 12, 8, 18, 10, 20, 14, 22, 12, 18, 8, 16, 6, 12, 8, 18, 10, 20, 14, 22, 12, 18, 8, 16,
                          ].map((h, i) => (
                            <View
                              key={i}
                              style={{
                                width: 2,
                                height: h,
                                borderRadius: 1,
                                marginRight: i === 23 ? 0 : 2,
                                backgroundColor: isUser ? "rgba(255,255,255,0.95)" : theme.colors.primary,
                                opacity: isUser ? 0.95 : 0.85,
                              }}
                            />
                          ))}
                        </View>

                        {/* Duration on right inside bubble */}
                        <CustomText
                          color={isUser ? "white" : theme.colors.text}
                          style={{ fontVariant: ["tabular-nums"], opacity: isUser ? 0.95 : 0.8 }}
                        >
                          {audioDurations?.[item.id] ?? "0:00"}
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
                {item.text && <CustomText color={msgColor}>{item.text}</CustomText>}
                {deletingMessageId === item.id && (
                  <ActivityIndicator
                    size="small"
                    color={isUser ? "rgba(255,255,255,0.8)" : theme.colors.primary}
                    style={{ marginTop: 4, alignSelf: "center" }}
                  />
                )}
              </View>

              {item.edited && (
                <CustomText fontSize={10} color={timeColor} style={{ fontStyle: "italic", marginTop: 2 }}>
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
        </Swipeable>
      </>
    )
  }

  const IOS_HEADER_OFFSET = 90

  const openAttachmentSheet = () => {
    setShowMediaOptions(true)
  }

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
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
              backgroundColor: theme.colors.inputBackground,
            }}
            onPress={handleProfilePress}
          >
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10, padding: 5 }}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Image
              source={{ uri: friendProfile?.avatar || avatar || "https://via.placeholder.com/40" }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                marginRight: 10,
              }}
            />
            <CustomText fontSize={theme.fonts.sizes.regular} color={theme.colors.text}>
              {friendProfile?.name || name}
            </CustomText>
            <View style={{ marginLeft: "auto", flexDirection: "row" }}>
              <TouchableOpacity style={{ paddingHorizontal: 4 }}>
                <Ionicons name="call-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 4 }}>
                <Ionicons name="videocam-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
                  <Ionicons name="chatbubble-outline" size={60} color={theme.colors.secondaryText} />
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
                    {t("chat.sendMessageTo", { name: friendProfile?.name || name })}
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
                    <CustomText fontSize={theme.fonts.sizes.small} color={"#FFA500"} fontWeight="500">
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
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.primary} fontWeight="500">
                      {t("chat.replyingTo")}{" "}
                      {replyingTo.sender === "user" ? t("chat.you") : friendProfile?.name || name}
                    </CustomText>
                    <CustomText
                      fontSize={theme.fonts.sizes.small}
                      color={theme.colors.secondaryText}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {replyingTo?.mediaType ? getReplyPreviewText(replyingTo as any, messages) : replyingTo?.text}
                    </CustomText>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 10 }}>
                    <Ionicons name="close" size={20} color={theme.colors.secondaryText} />
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
                onPress={uploading || recording !== null ? undefined : openAttachmentSheet}
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
                  color={uploading || recording !== null ? theme.colors.secondaryText : theme.colors.primary}
                />
              </TouchableOpacity>

              {recording ? (
                // Recording strip (timer + mini waveform + trash)
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
                  <CustomText color={theme.colors.text} style={{ fontVariant: ["tabular-nums"], marginRight: 10 }}>
                    {`${Math.floor(recSeconds / 60)}:${(recSeconds % 60).toString().padStart(2, "0")}`}
                  </CustomText>
                  <View style={{ flex: 1, height: 20, flexDirection: "row", alignItems: "flex-end", marginRight: 10 }}>
                    {[6, 10, 14, 18, 14, 10, 6, 10, 14, 18, 14, 10].map((h, i) => (
                      <View
                        key={i}
                        style={{
                          width: 2,
                          height: h,
                          borderRadius: 1,
                          marginRight: i === 17 ? 0 : 2,
                          backgroundColor: theme.colors.primary,
                          opacity: 0.9,
                        }}
                      />
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      // discard recording without sending
                      try {
                        if (recording) {
                          try {
                            await recording.stopAndUnloadAsync()
                          } catch (_) {}
                        }
                      } finally {
                        if (recTimerRef.current) {
                          clearInterval(recTimerRef.current)
                          recTimerRef.current = null
                        }
                        setRecording(null)
                        setRecSeconds(0)
                      }
                    }}
                    style={{ padding: 6, marginRight: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("chat.discardRecording") || "Discard recording"}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={recording ? stopRecording : startRecording}
                style={{
                  marginRight: 10,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: recording ? "#25D366" : theme.colors.inputBackground,
                }}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel={
                  recording
                    ? t("chat.sendRecording") || "Send recording"
                    : t("chat.startRecording") || "Start recording"
                }
              >
                <Ionicons
                  name={recording ? "send" : "mic"}
                  size={22}
                  color={recording ? "white" : theme.colors.primary}
                />
              </TouchableOpacity>

              <TextInput
                style={{
                  flex: 1,
                  display: recording ? ("none" as const) : ("flex" as const),
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
                          name: replyingTo.sender === "user" ? t("chat.yourself") : friendProfile?.name || name,
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
                      <CustomText color={theme.colors.text} style={{ marginTop: 8, fontSize: 12 }}>
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
                      <CustomText color={theme.colors.text} style={{ marginTop: 8, fontSize: 12 }}>
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
                      <CustomText color={theme.colors.text} style={{ marginTop: 8, fontSize: 12 }}>
                        {t("chat.video")}
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
              onForward={(userIds) => handleForwardMessage(userIds, forwardPopup.message!)}
            />

            {/* Context Menu */}
            <MessageContextMenu
              visible={contextMenu.visible}
              onClose={closeContextMenu}
              x={contextMenu.position.x}
              y={contextMenu.position.y}
              message={contextMenu.message}
              onEdit={handleContextMenuEdit}
              onDelete={handleContextMenuDelete}
              onForward={handleContextMenuForward}
              onCopy={handleContextMenuCopy}
              onDownload={handleContextMenuDownload}
              isOwnMessage={contextMenu.message?.sender === 'user'}
            />

            {/* Media Preview Modal */}
            <Modal visible={!!selectedMedia} transparent={true} onRequestClose={() => setSelectedMedia(null)}>
              <View
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}
              >
                <TouchableOpacity
                  style={{ position: "absolute", top: 20, right: 20, padding: 10, zIndex: 10 }}
                  onPress={() => setSelectedMedia(null)}
                >
                  <Ionicons name="close-circle" size={30} color="white" />
                </TouchableOpacity>
                {selectedMedia?.type === "image" ? (
                  <Image
                    source={{ uri: selectedMedia.url }}
                    style={{ width: "90%", height: "80%", resizeMode: "contain" }}
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

            {/* Profile Popup */}
            <Modal
              visible={showProfilePopup}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowProfilePopup(false)}
            >
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
                onPress={() => setShowProfilePopup(false)}
              >
                <View style={{ backgroundColor: theme.colors.background, padding: 20, borderRadius: 10, width: "80%" }}>
                  <CustomText
                    fontSize={theme.fonts.sizes.title}
                    color={theme.colors.text}
                    style={{ textAlign: "center", marginBottom: 20 }}
                  >
                    {t("chat.profile")}
                  </CustomText>
                  {profileLoading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                  ) : friendProfile ? (
                    <>
                      <Image
                        source={{ uri: friendProfile.avatar || "https://via.placeholder.com/150" }}
                        style={{ width: 100, height: 100, borderRadius: 50, alignSelf: "center", marginBottom: 10 }}
                      />
                      <CustomText
                        fontSize={theme.fonts.sizes.regular}
                        color={theme.colors.text}
                        style={{ textAlign: "center", marginBottom: 5 }}
                      >
                        {friendProfile.name}
                      </CustomText>
                      <CustomText
                        fontSize={theme.fonts.sizes.small}
                        color={theme.colors.secondaryText}
                        style={{ textAlign: "center", marginBottom: 5 }}
                      >
                        {friendProfile.email}
                      </CustomText>
                      <CustomText
                        fontSize={theme.fonts.sizes.small}
                        color={theme.colors.secondaryText}
                        style={{ textAlign: "center" }}
                      >
                        {friendProfile.designation}
                      </CustomText>
                    </>
                  ) : (
                    <CustomText
                      fontSize={theme.fonts.sizes.regular}
                      color={theme.colors.text}
                      style={{ textAlign: "center" }}
                    >
                      {t("chat.profileNotFound")}
                    </CustomText>
                  )}
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  )
}