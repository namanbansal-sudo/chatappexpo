// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/components/ThemeContext';
import { useLanguage } from '@/i18n';
import { useUser } from '@/components/UserContext';
import { useChatViewModel } from '@/components/useChatViewModel';
import { useRequestViewModel } from '@/components/useRequestViewModel';
import { View } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { theme, isDark } = useThemeContext();
  const { t } = useLanguage();
  const { user } = useUser();
  const { counts } = useChatViewModel();
  const { receivedRequests } = useRequestViewModel();
  
  const totalUnreadCount = counts ? counts.unreadTab : 0;
  const pendingRequestsCount = receivedRequests ? receivedRequests.filter(r => r.status === 'pending').length : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.secondaryText,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBackground,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          elevation: isDark ? 3 : 1,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: isDark ? -2 : -1 },
          shadowOpacity: isDark ? 0.2 : 0.1,
          shadowRadius: 3,
        },
        tabBarLabelStyle: {
          fontSize: theme.fonts.sizes.small,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.chats'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              backgroundColor: focused ? (isDark ? '#333333' : '#DDDDDD') : 'transparent',
              borderRadius: 10,
              paddingHorizontal: 6,
              paddingVertical: 5,
              position: 'relative',
            }}>
              <IconSymbol size={18} name={focused ? 'bubble.left.fill' : 'bubble.left'} color={color} />
              {totalUnreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#FF3B30',
                  borderRadius: 10,
                  minWidth: 16,
                  height: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: t('tabs.requests'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              backgroundColor: focused ? (isDark ? '#333333' : '#DDDDDD') : 'transparent',
              borderRadius: 10,
              paddingHorizontal: 2,
              paddingVertical: 5,
              position: 'relative',
            }}>
              <IconSymbol size={28} name={focused ? 'pawprint.fill' : 'pawprint'} color={color} />
              {pendingRequestsCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#FF3B30',
                  borderRadius: 10,
                  minWidth: 16,
                  height: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}>
                    {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              backgroundColor: focused ? (isDark ? '#333333' : '#DDDDDD') : 'transparent',
              borderRadius: 10,
              paddingHorizontal: 2,
            }}>
              <IconSymbol size={28} name={focused ? 'person.fill' : 'person'} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}