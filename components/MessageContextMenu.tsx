import { useLanguage } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Alert, Dimensions, Modal, TouchableOpacity, View } from 'react-native';
import { CustomText } from './customText';
import { useThemeContext } from './ThemeContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'other';
  time: string;
  timestamp: Date;
  replyTo?: {
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
  };
  edited?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  fileName?: string;
  isUploading?: boolean;
}

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  message: Message | null;
  onDelete: (messageId: string) => void;
  onEdit: (message: Message) => void;
  onForward: (message: Message) => void;
  onCopy: (message: Message) => void;
  onDownload: (message: Message) => void;
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
  onCopy,
  onDownload,
  position,
  isOwnMessage,
}) => {
  const { theme } = useThemeContext();
  const { t } = useLanguage();

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Calculate smart positioning
  const menuWidth = 150;
  const menuItemCount = (isOwnMessage ? 2 : 0) + 2 + (message?.mediaUrl ? 1 : 0); // Edit, Delete, Copy, Forward, Download (if media)
  const menuHeight = menuItemCount * 44 + 16; // Approximate

  const smartPosition = useMemo(() => {
    let x = position.x;
    let y = position.y;

    if (x + menuWidth > screenWidth - 20) {
      x = screenWidth - menuWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }

    if (y + menuHeight > screenHeight - 100) {
      y = position.y - menuHeight - 20;
    }
    if (y < 100) {
      y = 100;
    }

    return { x, y };
  }, [position.x, position.y, screenWidth, screenHeight, menuWidth, menuHeight, isOwnMessage, message?.mediaUrl]);

  const handleCopy = async () => {
    await onCopy(message);
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
    console.log('Edit option pressed for message:', { id: message?.id, text: message?.text, mediaUrl: message?.mediaUrl, isOwnMessage });
    onEdit(message);
    onClose();
  };

  const handleForward = () => {
    onForward(message);
    onClose();
  };

  const handleDownload = () => {
    console.log('Download option pressed for message:', { id: message?.id, mediaUrl: message?.mediaUrl });
    onDownload(message);
    onClose();
  };

  if (!visible || !message) return null;

  console.log('MessageContextMenu rendered with message:', {
    id: message.id,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    hasMedia: !!message.mediaUrl,
    text: message.text,
    isOwnMessage,
  });

  const menuItems = [
    {
      icon: 'copy-outline',
      title: t('chat.copyMessage'),
      onPress: handleCopy,
      show: !!message.text || !!message.mediaUrl, // Show for text or media
    },
    {
      icon: 'download-outline',
      title: t('Download'),
      onPress: handleDownload,
      show: !!message.mediaUrl,
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
      show: isOwnMessage && !message.isUploading, // Show for all own messages, including media to add text
    },
    {
      icon: 'trash-outline',
      title: t('chat.deleteMessage'),
      onPress: handleDelete,
      show: isOwnMessage && !message.isUploading,
    },
  ];

  console.log('Menu items to render:', menuItems.filter(item => item.show).map(item => item.title));

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