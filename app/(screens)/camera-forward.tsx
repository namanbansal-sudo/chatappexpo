import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { ForwardMessagePopup } from '@/components/ForwardMessagePopup';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/i18n';
import { uploadToCloudinary } from '@/services/cloudinary';
import { ChatService } from '@/services/chatService';

export default function CameraForwardScreen() {
  const { user } = useUser();
  const { t } = useLanguage();

  const [captured, setCaptured] = useState<{
    uri: string;
    type: 'image' | 'video';
    fileName?: string;
  } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [uploading, setUploading] = useState(false);

  const goHome = useCallback(() => {
    // Replace stack with tabs home
    router.replace('/(tabs)');
  }, []);

  // Launch camera on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('common.permissionRequired'), t('chat.cameraPermissionRequired'));
          return goHome();
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: true,
          quality: 0.8,
        });

        if (!mounted) return;

        if (result.canceled || !result.assets?.[0]) {
          return goHome();
        }

        const asset = result.assets[0];
        const type: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
        setCaptured({ uri: asset.uri, type, fileName: asset.fileName ?? undefined });
        setShowPopup(true);
      } catch (e) {
        console.error('Camera error:', e);
        Alert.alert(t('common.error'), t('chat.cameraError'));
        goHome();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [goHome, t]);

  const handleClose = useCallback(() => {
    setShowPopup(false);
    goHome();
  }, [goHome]);

  const handleForward = useCallback(async (userIds: string[], caption?: string) => {
    if (!captured || !user?.uid) {
      return handleClose();
    }
    try {
      setUploading(true);
      const cloudUrl = await uploadToCloudinary(captured.uri, captured.type);
      const message = {
        id: 'camera_quick_action',
        text: caption || '',
        mediaUrl: cloudUrl,
        mediaType: captured.type,
        fileName: captured.fileName || `${captured.type}_${Date.now()}.${captured.type === 'video' ? 'mp4' : 'jpg'}`,
      } as any;

      await ChatService.forwardMessage(message, userIds, user.uid);
      Alert.alert(t('common.success'), t('chat.messageForwarded'));
    } catch (e) {
      console.error('Forward from camera error:', e);
      Alert.alert(t('common.error'), t('chat.forwardError'));
    } finally {
      setUploading(false);
      handleClose();
    }
  }, [captured, user?.uid, t, handleClose]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      {uploading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <ForwardMessagePopup
        visible={showPopup}
        onClose={handleClose}
        onForward={handleForward}
        enableCaption
      />
    </View>
  );
}
