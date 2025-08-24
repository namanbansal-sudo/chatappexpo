// app/(tabs)/request.tsx
import { CustomRequestItem } from '@/components/customRequestItem';
import { CustomSearchInput } from '@/components/customSearchInput';
import { CustomText } from '@/components/customText';
import { useThemeContext } from '@/components/ThemeContext';
import { useLanguage } from '@/i18n';
import { useRequestViewModel } from '@/components/useRequestViewModel';
import { AddFriendPopup } from '@/components/AddFriendPopup';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RequestScreen() {
  const { 
    requests, 
    receivedRequests, 
    sentRequests, 
    loading, 
    refreshing,
    search, 
    setSearch, 
    activeTab, 
    setActiveTab, 
    acceptRequest, 
    rejectRequest, 
    cancelRequest,
    acceptingId,
    handleRefresh,
  } = useRequestViewModel();
  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);

  const filteredRequests = requests.filter(req => 
    req.name.toLowerCase().includes(search.toLowerCase())
  );
  console.log('filteredRequests', filteredRequests)

  const isEmpty = requests.length === 0 && !loading;

  const renderRequestItem = ({ item }: { item: any }) => (
    <CustomRequestItem
      {...item}
      accepting={acceptingId === item.id}
      onAccept={item.type === 'received' ? () => acceptRequest(item.id) : undefined}
      onReject={item.type === 'received' ? () => rejectRequest(item.id) : undefined}
      onCancel={item.type === 'sent' ? () => cancelRequest(item.id) : undefined}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <CustomSearchInput 
        placeholder="Search requests..." 
        value={search} 
        onChangeText={setSearch} 
      />
      
      {/* Tab Navigation */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        marginBottom: 10,
        paddingHorizontal: 20,
      }}>
        <TouchableOpacity 
          onPress={() => setActiveTab('received')}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
        >
          <CustomText 
            color={activeTab === 'received' ? theme.colors.primary : theme.colors.secondaryText}
            fontWeight={activeTab === 'received' ? 'bold' : 'normal'}
          >
            {t('requests.receivedRequests')} ({receivedRequests.length})
          </CustomText>
          {activeTab === 'received' && (
            <View style={{ 
              height: 2, 
              backgroundColor: theme.colors.primary, 
              marginTop: 5, 
              width: '80%' 
            }} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setActiveTab('sent')}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
        >
          <CustomText 
            color={activeTab === 'sent' ? theme.colors.primary : theme.colors.secondaryText}
            fontWeight={activeTab === 'sent' ? 'bold' : 'normal'}
          >
            {t('requests.sentRequests')} ({sentRequests.length})
          </CustomText>
          {activeTab === 'sent' && (
            <View style={{ 
              height: 2, 
              backgroundColor: theme.colors.primary, 
              marginTop: 5, 
              width: '80%' 
            }} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <CustomText color={theme.colors.secondaryText} style={{ marginTop: 10 }}>
            Loading requests...
          </CustomText>
        </View>
      ) : isEmpty ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="people-outline" size={80} color={theme.colors.secondaryText} style={{ marginBottom: 20 }} />
          <CustomText fontSize={theme.fonts.sizes.title} color={theme.colors.text}>
            {activeTab === 'received' ? 'No Received Requests' : 'No Sent Requests'}
          </CustomText>
          <CustomText color={theme.colors.secondaryText} style={{ textAlign: 'center', marginHorizontal: 40 }}>
            {activeTab === 'received' 
              ? 'You have no pending requests. Start connecting with others!' 
              : 'You haven\'t sent any friend requests yet.'}
          </CustomText>
          {activeTab === 'received' && (
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
              <CustomText color={theme.colors.background}>
                Find Friends
              </CustomText>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 }}>
              <CustomText color={theme.colors.secondaryText}>No requests found</CustomText>
            </View>
          }
        />
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
      <AddFriendPopup 
        visible={showAddFriendPopup}
        onClose={() => setShowAddFriendPopup(false)}
      />
    </SafeAreaView>
  );
}
