import React, { useMemo } from 'react';
import { View, TouchableOpacity, Modal, Alert, Dimensions, ToastAndroid, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomText } from './customText';
import { useThemeContext } from './ThemeContext';
import { useLanguage } from '@/i18n';
import * as Clipboard from 'expo-clipboard';

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  message: any;
  onDelete: (messageId: string) => void;
  onEdit: (message: any) => void;
  onForward: (message: any) => void;
  position: { x: number; y: number };
  isOwnMessage: boolean;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  visible,
  onClose,
  message,
  onDelete,
  onEdit,
  onForward,
  position,
  isOwnMessage,
}) => {
  const { theme } = useThemeContext();
  const { t } = useLanguage();

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Calculate smart positioning - moved before early return
  const menuWidth = 150;
  const menuHeight = isOwnMessage ? 200 : 120; // Approximate height based on items
  
  const smartPosition = useMemo(() => {
    let x = position.x;
    let y = position.y;
    
    // Adjust horizontal position if menu would go off-screen
    if (x + menuWidth > screenWidth - 20) {
      x = screenWidth - menuWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }
    
    // Adjust vertical position if menu would go off-screen
    if (y + menuHeight > screenHeight - 100) {
      y = position.y - menuHeight - 20; // Show above the touch point
    }
    if (y < 100) {
      y = 100; // Minimum top margin
    }
    
    return { x, y };
  }, [position.x, position.y, screenWidth, screenHeight, menuWidth, menuHeight, isOwnMessage]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.message || message.text || '');
    
    // Show platform-appropriate feedback
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('chat.messageCopied'), ToastAndroid.SHORT);
    } else {
      Alert.alert(t('common.success'), t('chat.messageCopied'), [{ text: t('common.ok') }]);
    }
    
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      t('chat.deleteMessage'),
      t('chat.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            onDelete(message.id);
            onClose();
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    onEdit(message);
    onClose();
  };

  const handleForward = () => {
    onForward(message);
    onClose();
  };

  if (!visible) return null;

  const menuItems = [
    {
      icon: 'copy-outline',
      title: t('chat.copyMessage'),
      onPress: handleCopy,
      show: true,
    },
    {
      icon: 'share-outline',
      title: t('chat.forwardMessage'),
      onPress: handleForward,
      show: true,
    },
    {
      icon: 'create-outline',
      title: t('chat.editMessage'),
      onPress: handleEdit,
      show: isOwnMessage,
    },
    {
      icon: 'trash-outline',
      title: t('chat.deleteMessage'),
      onPress: handleDelete,
      show: isOwnMessage,
    },
  ];

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            position: 'absolute',
            top: smartPosition.y,
            left: smartPosition.x,
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
            minWidth: menuWidth,
            maxWidth: menuWidth + 50,
            zIndex: 1000,
          }}
        >
          {menuItems
            .filter(item => item.show)
            .map((item, index) => (
              <TouchableOpacity
                key={item.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                }}
                onPress={item.onPress}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.title === t('chat.deleteMessage') ? '#ff4444' : theme.colors.text}
                  style={{ marginRight: 12 }}
                />
                <CustomText
                  color={item.title === t('chat.deleteMessage') ? '#ff4444' : theme.colors.text}
                  fontSize={theme.fonts.sizes.regular}
                >
                  {item.title}
                </CustomText>
              </TouchableOpacity>
            ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
