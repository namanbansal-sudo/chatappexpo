import { useLanguage } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Alert, Dimensions, Modal, TouchableOpacity, View } from 'react-native';
import type { Message } from './ChatRoom';
import { CustomText } from './CustomText';
import { useThemeContext } from './ThemeContext';

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
  onDelete: (messageId: string) => void;
  onEdit: (message: Message) => void;
  onForward: (message: Message) => void;
  onCopy: (message: Message) => void;
  onDownload: (message: Message) => void;
  position: { x: number; y: number } | undefined;
  isOwnMessage: boolean;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  visible,
  onClose,
  message,
  onDelete,
  onEdit,
  onForward,
  onCopy,
  onDownload,
  position = { x: 0, y: 0 },
  isOwnMessage,
}) => {
  const { theme } = useThemeContext();
  const { t } = useLanguage();

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Calculate smart positioning
  const menuWidth = 150;
  
  // Check if message has any media (image, video, or audio)
  const hasMedia = !!message?.mediaUrl && ['image', 'video', 'audio'].includes(message.mediaType || '');
  
  // Count menu items that will actually be shown
  const menuItemCount = [
    !!message?.text || !!message?.mediaUrl, // Copy
    hasMedia, // Download
    true, // Forward
    isOwnMessage && !!message?.text && !message.isUploading, // Edit (allow media messages with captions)
    isOwnMessage && !message?.isUploading, // Delete
  ].filter(Boolean).length;
  
  const menuHeight = menuItemCount * 44 + 16;

  const smartPosition = useMemo(() => {
    let x = position.x ?? 0;
    let y = position.y ?? 0;

    // Horizontal positioning with better edge detection
    if (x + menuWidth > screenWidth - 20) {
      // If menu would go off right edge, position it to the left of touch point
      x = Math.max(20, x - menuWidth - 10);
    }
    if (x < 20) {
      x = 20;
    }

    // Vertical positioning with better edge detection
    if (y + menuHeight > screenHeight - 100) {
      // If menu would go off bottom edge, position it above touch point
      y = Math.max(100, y - menuHeight - 20);
    }
    if (y < 100) {
      y = 100;
    }

    // Additional safety check - ensure menu stays within screen bounds
    x = Math.min(Math.max(x, 20), screenWidth - menuWidth - 20);
    y = Math.min(Math.max(y, 100), screenHeight - menuHeight - 100);

    return { x, y };
  }, [position, screenWidth, screenHeight, menuWidth, menuHeight]);

  const handleCopy = async () => {
    await onCopy(message!);
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
            onDelete(message?.id || '');
            onClose();
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    onEdit(message!);
    onClose();
  };

  const handleForward = () => {
    onForward(message!);
    onClose();
  };

  const handleDownload = () => {
    onDownload(message!);
    onClose();
  };

  if (!visible || !message) return null;

  const menuItems = [
    {
      icon: 'copy-outline',
      title: t('chat.copyMessage'),
      onPress: handleCopy,
      show: !!message.text || !!message.mediaUrl,
    },
    {
      icon: 'download-outline',
      title: t('Download'),
      onPress: handleDownload,
      show: hasMedia,
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
      // Allow editing messages with text content (including media messages with captions)
      show: isOwnMessage && !!message.text && !message.isUploading,
    },
    {
      icon: 'trash-outline',
      title: t('chat.deleteMessage'),
      onPress: handleDelete,
      show: isOwnMessage && !message.isUploading,
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
                accessibilityLabel={item.title}
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