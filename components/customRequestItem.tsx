// components/CustomRequestItem.tsx
import { CustomText } from '@/components/CustomText';
import { useThemeContext } from '@/components/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

interface RequestItemProps {
  avatar: string;
  name: string;
  message: string;
  time: string;
  type: 'received' | 'sent';
  status: 'pending' | 'accepted' | 'rejected';
  verified?: boolean;
  online?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  accepting?: boolean;
}

export const CustomRequestItem: React.FC<RequestItemProps> = ({
  avatar,
  name,
  message,
  time,
  type,
  status,
  verified,
  online,
  onAccept,
  onReject,
  onCancel,
  accepting,
}) => {
  const { theme } = useThemeContext();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ position: 'relative', marginRight: 10 }}>
        <Image source={{ uri: avatar || 'https://placeholder.com/50' }} style={{ width: 50, height: 50, borderRadius: 25 }} />
        {online && <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00FF00', borderWidth: 2, borderColor: theme.colors.background }} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CustomText fontWeight="bold" color={theme.colors.text}>{name}</CustomText>
          {verified && <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={{ marginLeft: 5 }} />}
        </View>
        <CustomText color={theme.colors.secondaryText} numberOfLines={1}>{message}</CustomText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.secondaryText}>{time}</CustomText>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
          {type === 'received' ? (
            // Received request - show Accept/Reject buttons
            <>
              <TouchableOpacity onPress={onAccept} style={{ marginRight: 10 }} disabled={!!accepting}>
                {accepting ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={24} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onReject}>
                <Ionicons name="close-circle-outline" size={24} color={theme.colors.secondaryText} />
              </TouchableOpacity>
            </>
          ) : (
            // Sent request - show Cancel button
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  }
});