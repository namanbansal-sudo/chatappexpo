import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry?: number;
}

class CacheService {
  private memoryCache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_EXPIRY = 5 * 60 * 1000; // 5 minutes

  // Memory cache operations (fastest)
  setMemory<T>(key: string, data: T, expiry?: number): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.DEFAULT_EXPIRY
    });
  }

  getMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (item.expiry && (now - item.timestamp) > item.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.data;
  }

  // Persistent cache operations
  async set<T>(key: string, data: T, expiry?: number): Promise<void> {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.DEFAULT_EXPIRY
    };

    // Store in memory cache
    this.setMemory(key, data, expiry);

    // Store in persistent storage
    try {
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to cache to storage:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryData = this.getMemory<T>(key);
    if (memoryData) return memoryData;

    // Check persistent storage
    try {
      const stored = await AsyncStorage.getItem(`cache_${key}`);
      if (!stored) return null;

      const item: CacheItem<T> = JSON.parse(stored);
      const now = Date.now();

      if (item.expiry && (now - item.timestamp) > item.expiry) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }

      // Restore to memory cache
      this.setMemory(key, item.data, item.expiry);
      return item.data;
    } catch (error) {
      console.warn('Failed to get from cache:', error);
      return null;
    }
  }

  // Chat-specific cache methods
  async setChatList(userId: string, chats: any[]): Promise<void> {
    await this.set(`chats_${userId}`, chats, 5 * 60 * 1000); // 5 minutes
    // Also cache in memory for instant access
    this.setMemory(`chats_${userId}`, chats, 60 * 1000); // 1 minute in memory
  }

  async getChatList(userId: string): Promise<any[] | null> {
    return await this.get(`chats_${userId}`);
  }

  async setChatMessages(chatId: string, messages: any[]): Promise<void> {
    await this.set(`messages_${chatId}`, messages, 15 * 60 * 1000); // 15 minutes
    // Cache recent messages in memory for instant loading
    this.setMemory(`messages_${chatId}`, messages, 2 * 60 * 1000); // 2 minutes in memory
  }

  async getChatMessages(chatId: string): Promise<any[] | null> {
    return await this.get(`messages_${chatId}`);
  }

  // Cache last scroll position for each chat
  setLastScrollPosition(chatId: string, position: number): void {
    this.setMemory(`scroll_${chatId}`, position, 30 * 60 * 1000); // 30 minutes
  }

  getLastScrollPosition(chatId: string): number | null {
    return this.getMemory(`scroll_${chatId}`);
  }

  // Cache unread counts
  setUnreadCounts(userId: string, counts: any): void {
    this.setMemory(`unread_${userId}`, counts, 30 * 1000); // 30 seconds for real-time feel
  }

  getUnreadCounts(userId: string): any | null {
    return this.getMemory(`unread_${userId}`);
  }

  // Optimistic message caching
  addOptimisticMessage(chatId: string, message: any): void {
    const cached = this.getMemory<any[]>(`messages_${chatId}`) || [];
    const updated = [...cached, message];
    this.setMemory(`messages_${chatId}`, updated, 2 * 60 * 1000);
  }

  removeOptimisticMessage(chatId: string, tempId: string): void {
    const cached = this.getMemory<any[]>(`messages_${chatId}`);
    if (cached && Array.isArray(cached)) {
      const filtered = cached.filter((msg: any) => msg.id !== tempId);
      this.setMemory(`messages_${chatId}`, filtered, 2 * 60 * 1000);
    }
  }

  async setUserData(userId: string, userData: any): Promise<void> {
    await this.set(`user_${userId}`, userData, 30 * 60 * 1000); // 30 minutes
  }

  async getUserData(userId: string): Promise<any | null> {
    return await this.get(`user_${userId}`);
  }

  // Clear specific cache
  async clearCache(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  // Clear all cache
  async clearAllCache(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear all cache:', error);
    }
  }

  // Preload cache with optimistic data
  preloadChatList(userId: string, chats: any[]): void {
    this.setMemory(`chats_${userId}`, chats, 30 * 1000); // 30 seconds for immediate use
  }

  preloadMessages(chatId: string, messages: any[]): void {
    this.setMemory(`messages_${chatId}`, messages, 60 * 1000); // 1 minute for immediate use
  }
}

export const cacheService = new CacheService();
