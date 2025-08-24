// types/models.ts - Optimized for Performance & Scalability

/**
 * USER COLLECTION: /users/{userId}
 * Optimized for quick profile lookups and presence management
 */
export interface User {
  uid: string;
  name: string;
  email: string;
  photo: string;
  designation: string;
  isOnline: boolean;
  lastSeen: any; // Firestore timestamp
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp for cache invalidation
  
  // Denormalized data for quick access (updated when changed)
  friendsCount: number; // Total friends count
  chatsCount: number; // Total active chats count
  
  // Privacy settings
  settings?: {
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
    showLastSeen: boolean;
  };
}

/**
 * USER RELATIONSHIPS: /users/{userId}/relationships/{relationshipId}
 * Subcollection for scalable friend management
 */
export interface UserRelationship {
  id: string; // friendUserId
  type: 'friend' | 'blocked';
  createdAt: any; // When friendship was established
  
  // Denormalized friend data for quick access
  name: string;
  photo: string;
  isOnline: boolean;
  lastSeen: any;
}

/**
 * FRIEND REQUESTS: /friendRequests/{requestId}
 * Optimized for quick sender/receiver queries
 */
export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: any;
  message?: string;
  
  // Denormalized data to avoid extra lookups
  senderName: string;
  senderPhoto: string;
  receiverName: string;
  receiverPhoto: string;
  
  // Composite field for efficient querying
  senderReceiver: string; // `${senderId}_${receiverId}` for deduplication
}

/**
 * CHAT ROOMS: /chats/{chatId}
 * Optimized main chat document with minimal data
 */
export interface Chat {
  id: string; // Deterministic: sorted participant IDs joined with '_'
  type: 'direct' | 'group'; // Future-proofing for group chats
  participants: string[]; // Max 2 for direct, more for groups
  participantCount: number; // For quick filtering
  
  // Last message summary (denormalized for chat list)
  lastMessage: {
    text: string;
    senderId: string;
    senderName: string; // Denormalized for display
    timestamp: any;
    type: 'text' | 'image' | 'file' | 'system';
  };
  
  // Per-user metadata
  participantData: {
    [userId: string]: {
      unreadCount: number;
      lastReadAt: any; // Timestamp of last read message
      muteUntil?: any; // For muting notifications
      archived: boolean;
    };
  };
  
  createdAt: any;
  updatedAt: any; // For change detection
  
  // For group chats (future)
  groupInfo?: {
    name: string;
    description?: string;
    photo?: string;
    adminIds: string[];
  };
}

/**
 * MESSAGES: /chats/{chatId}/messages/{messageId}
 * Optimized message subcollection with efficient querying
 */
export interface ChatMessage {
  id: string;
  senderId: string;
  timestamp: any;
  
  // Message content
  content: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio' | 'file';
    fileName?: string;
    fileSize?: number;
  };
  
  type: 'text' | 'image' | 'file' | 'system';
  
  // Message status (only for sender's messages)
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  
  // Thread/reply support (future)
  replyTo?: {
    messageId: string;
    text: string; // Preview of original message
    senderId: string;
  };
  
  // Message reactions (future)
  reactions?: {
    [emoji: string]: string[]; // emoji -> array of user IDs
  };
  
  // For system messages
  systemData?: {
    action: 'user_joined' | 'user_left' | 'chat_created';
    actorId: string;
    targetIds?: string[];
  };
}

/**
 * USER CHAT LIST: /users/{userId}/chatList/{chatId}
 * Denormalized chat list for instant loading
 */
export interface UserChatListItem {
  chatId: string;
  
  // Chat partner info (for direct chats)
  partnerId: string;
  partnerName: string;
  partnerPhoto: string;
  partnerOnline: boolean;
  
  // Last message preview
  lastMessage: string;
  lastMessageTime: any;
  lastMessageSender: string;
  lastMessageType: 'text' | 'image' | 'file' | 'system';
  
  // User-specific data
  unreadCount: number;
  lastReadAt: any;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  
  updatedAt: any; // For sorting and change detection
}

/**
 * PRESENCE TRACKING: /presence/{userId}
 * Separate collection for real-time presence (auto-deleted after timeout)
 */
export interface UserPresence {
  uid: string;
  isOnline: boolean;
  lastSeen: any;
  currentDevice?: string;
  
  // Auto-cleanup
  ttl: any; // Firestore TTL field
}

/**
 * TYPING INDICATORS: /chats/{chatId}/typing/{userId}
 * Ephemeral documents for typing indicators
 */
export interface TypingIndicator {
  userId: string;
  userName: string;
  timestamp: any;
  ttl: any; // Auto-delete after 10 seconds
}

// =============================================================================
// UI HELPER TYPES (unchanged for compatibility)
// =============================================================================

export interface ChatSimple {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  lastMessageSender?: string;
  lastMessageId?: string;
  unreadCount?: { [userId: string]: number };
  createdAt?: any;
  createdBy?: string;
}

export interface ChatListItem {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isOnline: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
}

export interface RequestListItem {
  id: string;
  avatar: string;
  name: string;
  message: string;
  time: string;
  type: 'received' | 'sent';
  status: 'pending' | 'accepted' | 'rejected';
}
