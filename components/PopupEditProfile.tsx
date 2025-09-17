// components/PopupEditProfile.tsx
import { CustomButton } from '@/components/CustomButton';
import { CustomInput } from '@/components/customInput';
import { CustomText } from '@/components/CustomText';
import { useThemeContext } from '@/components/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

interface PopupEditProfileProps {
  visible: boolean;
  profile: any;
  onSave: (updatedProfile: { name: string; designation: string; email?: string }) => void;
  onClose: () => void;
}

export const PopupEditProfile: React.FC<PopupEditProfileProps> = ({ visible, profile, onSave, onClose }) => {
  const { theme } = useThemeContext();
  
  if (!visible || !profile) return null;
  
  // Get name from displayName or name field
  const getName = () => profile?.displayName || profile?.name || '';
  // Get email from profile
  const getEmail = () => profile?.email || '';
  // Get designation with default value
  const getDesignation = () => profile?.designation || 'User';
  
  const [name, setName] = React.useState(getName());
  const [designation, setDesignation] = React.useState(getDesignation());
  const [email, setEmail] = React.useState(getEmail());

  React.useEffect(() => {
    setName(getName());
    setDesignation(getDesignation());
    setEmail(getEmail());
  }, [profile]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    popup: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
      elevation: 8,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inputContainer: {
      marginBottom: 16,
    },
    emailContainer: {
      marginBottom: 24,
    },
    disabledInput: {
      opacity: 0.6,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    saveButton: {
      flex: 1,
    },
  });

  const handleSave = () => {
    onSave({ name, designation, email });
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
              </View>
              <CustomText fontSize={theme.fonts.sizes.title} fontWeight="bold" color={theme.colors.text}>
                Edit Profile
              </CustomText>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.colors.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <CustomInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor={theme.colors.secondaryText}
            containerStyle={styles.inputContainer}
          />
          
          <CustomInput
            label="Designation"
            value={designation}
            onChangeText={setDesignation}
            placeholder="Enter your designation"
            placeholderTextColor={theme.colors.secondaryText}
            containerStyle={styles.inputContainer}
          />
          
          <View style={[styles.inputContainer, styles.emailContainer]}>
            <CustomInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={theme.colors.secondaryText}
              keyboardType="email-address"
              editable={false}
              inputStyle={styles.disabledInput}
            />
            <CustomText 
              fontSize={theme.fonts.sizes.small} 
              color={theme.colors.secondaryText} 
              style={{ marginTop: 4, fontStyle: 'italic' }}
            >
              Email cannot be changed
            </CustomText>
          </View>
          
          <View style={styles.buttonContainer}>
            <CustomButton
              title="Cancel"
              onPress={onClose}
              style={styles.cancelButton}
              textStyle={{ color: theme.colors.text }}
            />
            <CustomButton
              title="Save Changes"
              onPress={handleSave}
              style={styles.saveButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

