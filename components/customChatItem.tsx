// components/CustomChatItem.tsx
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { CustomText } from '@/components/customText';
import { useThemeContext } from '@/components/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface ChatItem {
  avatar: string;
  name: string;
  message: string;
  time: string;
  unread?: number;
  verified?: boolean;
  online?: boolean;
  emoji?: string;
}

interface ChatItemProps extends Partial<ChatItem> {
  item?: ChatItem;
}

export const CustomChatItem: React.FC<ChatItemProps> = (props) => {
  const { theme } = useThemeContext();
  const source = props.item ?? (props as ChatItem);
  const {
    avatar = '',
    name = '',
    message = '',
    time = '',
    unread,
    verified,
    online,
    emoji,
  } = source;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.background }]}>
      <View style={{ position: 'relative', marginRight: 12 }}>
        <Image source={{ uri: avatar || 'https://via.placeholder.com/50' }} style={{ width: 50, height: 50, borderRadius: 25 }} />
        {online && <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00FF00', borderWidth: 2, borderColor: theme.colors.background }} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CustomText fontWeight="bold" color={theme.colors.text}>{name}{emoji ? ` ${emoji}` : ''}</CustomText>
          {verified && <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={{ marginLeft: 5 }} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {message.startsWith('📷') ? (
            <Ionicons name="camera" size={16} color={theme.colors.secondaryText} style={{ marginRight: 4 }} />
          ) : message.startsWith('🎥') ? (
            <Ionicons name="videocam" size={16} color={theme.colors.secondaryText} style={{ marginRight: 4 }} />
          ) : null}
          <CustomText color={theme.colors.secondaryText} numberOfLines={1} style={{ flex: 1 }}>
            {message.startsWith('📷') ? 'Photo' : message.startsWith('🎥') ? 'Video' : message}
          </CustomText>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.secondaryText}>{time}</CustomText>
        {!!unread && (
          <View style={{ backgroundColor: theme.colors.primary, borderRadius: 15, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5 }}>
            <CustomText fontSize={theme.fonts.sizes.small} color={theme.colors.background}>{unread}</CustomText>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    marginHorizontal: 5,
    marginVertical: 2,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  }
});