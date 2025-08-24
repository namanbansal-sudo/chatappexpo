// viewmodels/useRequestViewModel.ts
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { RequestListItem, FriendRequest } from '../types/models';
import { useUser } from './UserContext';
import { FriendRequestService } from '@/services/friendRequestService';

export const useRequestViewModel = () => {
  const { user, refreshUserData } = useUser();
  const [requests, setRequests] = useState<RequestListItem[]>([]);
  const [sentRequests, setSentRequests] = useState<RequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Load friend requests from Firebase
  useEffect(() => {
    if (!user?.uid) {
      setRequests([]);
      setSentRequests([]);
      setLoading(false);
      return;
    }

    let unsubscribeReceived: (() => void) | null = null;
    let unsubscribeSent: (() => void) | null = null;

    try {
      setLoading(true);

      // Subscribe to received friend requests
      unsubscribeReceived = FriendRequestService.subscribeToReceivedRequests(
        user.uid,
        (firebaseRequests: FriendRequest[]) => {
          const requestItems: RequestListItem[] = firebaseRequests.map((req) => {
            let timeString = '';
            if (req.timestamp) {
              const date = req.timestamp.toDate ? req.timestamp.toDate() : new Date(req.timestamp);
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const requestDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
              
              if (requestDate.getTime() === today.getTime()) {
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } else {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (requestDate.getTime() === yesterday.getTime()) {
                  timeString = 'Yesterday';
                } else {
                  timeString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
              }
            }

            return {
              id: req.id,
              avatar: req.senderPhoto || '',
              name: req.senderName,
              message: req.message || 'Wants to connect with you',
              time: timeString,
              type: 'received' as const,
              status: req.status,
            };
          });
          setRequests(requestItems);
          setLoading(false);
        }
      );

      // Subscribe to sent friend requests
      unsubscribeSent = FriendRequestService.subscribeToSentRequests(
        user.uid,
        (firebaseRequests: FriendRequest[]) => {
          const requestItems: RequestListItem[] = firebaseRequests.map((req) => {
            let timeString = '';
            if (req.timestamp) {
              const date = req.timestamp.toDate ? req.timestamp.toDate() : new Date(req.timestamp);
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const requestDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
              
              if (requestDate.getTime() === today.getTime()) {
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } else {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (requestDate.getTime() === yesterday.getTime()) {
                  timeString = 'Yesterday';
                } else {
                  timeString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
              }
            }

            return {
              id: req.id,
              avatar: req.receiverPhoto || '',
              name: req.receiverName || req.receiverId,
              message: 'Request sent',
              time: timeString,
              type: 'sent' as const,
              status: req.status,
            };
          });
          setSentRequests(requestItems);
        }
      );
    } catch (error) {
      console.error('Error loading friend requests:', error);
      setLoading(false);
    }

    return () => {
      if (unsubscribeReceived) unsubscribeReceived();
      if (unsubscribeSent) unsubscribeSent();
    };
  }, [user?.uid]);

  const acceptRequest = async (id: string) => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setAcceptingId(id);
      await FriendRequestService.acceptFriendRequest(id, user.uid, refreshUserData);
      Alert.alert('Success', 'Friend request accepted');
      // The request will be automatically removed from the list via the real-time listener
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error?.message || 'Failed to accept request.');
    } finally {
      setAcceptingId(null);
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      await FriendRequestService.rejectFriendRequest(id);
      // The request will be automatically removed from the list via the real-time listener
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      await FriendRequestService.cancelFriendRequest(id);
      // The request will be automatically removed from the list via the real-time listener
    } catch (error) {
      console.error('Error canceling friend request:', error);
    }
  };

  // Get the currently displayed requests based on active tab
  const displayedRequests = activeTab === 'received' ? requests : sentRequests;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh user data to get latest friend requests
      await refreshUserData();
    } catch (error) {
      console.error('Error refreshing requests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return {
    requests: displayedRequests,
    receivedRequests: requests,
    sentRequests,
    loading,
    refreshing,
    search,
    setSearch,
    activeTab,
    setActiveTab,
    acceptingId,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    handleRefresh,
  };
};
