import { useLanguage } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, TouchableOpacity, View } from 'react-native';
import { CustomText } from './CustomText';
import { useThemeContext } from './ThemeContext';

export const LanguageSelector: React.FC = () => {
  const { theme } = useThemeContext();
  const { currentLanguage, availableLanguages, changeLanguage, t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage);

  const handleLanguageSelect = async (languageCode: string) => {
    await changeLanguage(languageCode);
    setIsVisible(false);
  };

  const settingItemStyle = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%' as const,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  };

  const settingIconStyle = {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: 12,
  };

  return (
    <>
      <TouchableOpacity style={settingItemStyle} onPress={() => setIsVisible(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={settingIconStyle}>
            <Ionicons
              name="language"
              size={16}
              color={theme.colors.primary}
            />
          </View>
          <View>
            <CustomText
              fontSize={theme.fonts.sizes.regular}
              color={theme.colors.text}
            >
              {t('profile.language')}
            </CustomText>
            <CustomText
              fontSize={theme.fonts.sizes.small}
              color={theme.colors.secondaryText}
            >
              {currentLang?.nativeName || 'English'}
            </CustomText>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.secondaryText}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: theme.colors.background,
            borderRadius: 20,
            padding: 20,
            width: '90%',
            maxHeight: '70%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <CustomText
                fontSize={theme.fonts.sizes.title}
                color={theme.colors.text}
                style={{ fontWeight: 'bold' }}
              >
                {t('profile.selectLanguage')}
              </CustomText>
              <TouchableOpacity onPress={() => setIsVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Language List */}
            <FlatList
              data={availableLanguages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: currentLanguage === item.code 
                      ? theme.colors.primary + '20' 
                      : 'transparent',
                    marginBottom: 8,
                  }}
                  onPress={() => handleLanguageSelect(item.code)}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.colors.primary + '30',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <CustomText color={theme.colors.primary} fontSize={16}>
                      {item.nativeName.charAt(0)}
                    </CustomText>
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <CustomText
                      color={theme.colors.text}
                      fontSize={theme.fonts.sizes.regular}
                      style={{ fontWeight: '500' }}
                    >
                      {item.nativeName}
                    </CustomText>
                    <CustomText
                      color={theme.colors.secondaryText}
                      fontSize={theme.fonts.sizes.small}
                    >
                      {item.name}
                    </CustomText>
                  </View>

                  {currentLanguage === item.code && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};
