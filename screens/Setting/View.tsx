import { useNavigateToLogin } from "@/app/(services)/navigationService";
import { CustomText } from "@/components/CustomText";
import { signOutGoogle } from "@/components/googleSignIn";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PopupEditProfile } from "@/components/PopupEditProfile";
import { useThemeContext } from "@/components/ThemeContext";
import { useLanguage } from "@/i18n";
import { uploadToCloudinary } from "@/services/cloudinary";
import { UserServiceSimple } from "@/services/userServiceSimple";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
    StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Optimized theme toggle component for instant feedback
const ThemeToggleSection = React.memo(() => {
  const { theme, toggleTheme, isDark } = useThemeContext();
  const { t } = useLanguage();

  const settingItemStyle = useMemo(
    () => ({
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%" as const,
      elevation: 1,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    }),
    [theme]
  );

  const settingIconStyle = useMemo(
    () => ({
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary + "20",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 12,
    }),
    [theme.colors.primary]
  );

  const switchColors = useMemo(
    () => ({
      trackColor: { false: "#E5E7EB", true: theme.colors.primary + "60" },
      thumbColor: isDark ? theme.colors.primary : "#FFFFFF",
      iosBackgroundColor: theme.colors.surface,
    }),
    [isDark, theme.colors.primary, theme.colors.surface]
  );

  return (
    <View style={settingItemStyle}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={settingIconStyle}>
          <Ionicons
            name={isDark ? "moon" : "sunny"}
            size={16}
            color={theme.colors.primary}
          />
        </View>
        <CustomText
          fontSize={theme.fonts.sizes.regular}
          color={theme.colors.text}
        >
          {isDark ? t("profile.darkMode") : t("profile.darkMode")}
        </CustomText>
      </View>
      <Switch
        value={isDark}
        onValueChange={toggleTheme}
        trackColor={switchColors.trackColor}
        thumbColor={switchColors.thumbColor}
        ios_backgroundColor={switchColors.iosBackgroundColor}
      />
    </View>
  );
});

export default function ProfileScreen() {
  const { theme, toggleTheme, isDark } = useThemeContext();
  const { t } = useLanguage();
  const [user, setUser] = React.useState<any>(null);
  const [isEditVisible, setIsEditVisible] = React.useState(false);
  const [isImageEditVisible, setIsImageEditVisible] = React.useState(false);
  const [showMediaOptions, setShowMediaOptions] = React.useState(false);
  const [selectedMedia, setSelectedMedia] = React.useState<{
    url: string;
    type: "image";
  } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const navigateToLogin = useNavigateToLogin();

  React.useEffect(() => {
    (async () => {
      try {
        console.log("ProfileScreen: Loading user from AsyncStorage...");
        const userStr = await AsyncStorage.getItem("user");
        console.log("ProfileScreen: Raw user string:", userStr);

        if (userStr) {
          const parsedUser = JSON.parse(userStr);
          console.log("ProfileScreen: Parsed user data:", parsedUser);
          setUser(parsedUser);
        } else {
          console.log("ProfileScreen: No user data found in AsyncStorage");
        }
      } catch (error) {
        console.error("ProfileScreen: Error loading user:", error);
      }
    })();
  }, []);

  const handleImageUpdate = useCallback(
    async (newAvatar: string) => {
      if (!user) return;
      try {
        setUploading(true);
        // Update AsyncStorage
        const updated = { ...user, photoURL: newAvatar };
        await AsyncStorage.setItem("user", JSON.stringify(updated));
        // Update Firestore
        await UserServiceSimple.updateProfileImage(user.uid, newAvatar);
        setUser(updated);
      } catch (error) {
        console.error("Error updating profile image:", error);
      } finally {
        setUploading(false);
        setIsImageEditVisible(false);
        setShowMediaOptions(false);
      }
    },
    [user]
  );

  const pickImage = async () => {
    setShowMediaOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setUploading(true);
        const cloudinaryUrl = await uploadToCloudinary(
          result.assets[0].uri,
          "image"
        );
        await handleImageUpdate(cloudinaryUrl);
      } catch (error) {
        console.error("Error uploading image:", error);
      } finally {
        setUploading(false);
      }
    }
  };

  const takePhoto = async () => {
    setShowMediaOptions(false);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setUploading(true);
        const cloudinaryUrl = await uploadToCloudinary(
          result.assets[0].uri,
          "image"
        );
        await handleImageUpdate(cloudinaryUrl);
      } catch (error) {
        console.error("Error uploading image:", error);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleEditProfile = useCallback(() => {
    setIsEditVisible(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setIsEditVisible(false);
  }, []);

  const handleOpenImageEdit = useCallback(() => {
    setShowMediaOptions(true);
  }, []);

  const handleCloseImageEdit = useCallback(() => {
    setIsImageEditVisible(false);
    setShowMediaOptions(false);
  }, []);

  const refreshUserData = useCallback(async () => {
    try {
      console.log("Refreshing user data...");
      const userStr = await AsyncStorage.getItem("user");
      console.log("Refreshed user string:", userStr);

      if (userStr) {
        const parsedUser = JSON.parse(userStr);
        console.log("Refreshed parsed user:", parsedUser);
        setUser(parsedUser);
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, []);

  const clearUserData = useCallback(async () => {
    try {
      await AsyncStorage.removeItem("user");
      setUser(null);
      console.log("User data cleared");
    } catch (error) {
      console.error("Error clearing user data:", error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      console.log("🔄 Starting logout process...");

      // Update user online status
      try {
        const existingUserStr = await AsyncStorage.getItem("user");
        const existingUser = existingUserStr
          ? JSON.parse(existingUserStr)
          : null;
        if (existingUser?.uid) {
          await UserServiceSimple.updateOnlineStatus(existingUser.uid, false);
          console.log("✅ User online status updated to offline");
        }
      } catch (statusError) {
        console.warn(
          "⚠️ Failed to update online status:",
          (statusError as Error).message || statusError
        );
        // Continue with logout even if this fails
      }

      // Sign out from Google and Firebase
      await signOutGoogle();
      console.log("✅ Sign out completed");

      // Clear local storage except preserved preferences (theme & language)
      try {
        const PRESERVED_KEYS = [
          'user_theme_preference',
          'user_language_preference',
        ];
        const keys = await AsyncStorage.getAllKeys();
        const keysToRemove = keys.filter(k => !PRESERVED_KEYS.includes(k));
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
        console.log("✅ Local storage cleared (preserved theme/language)");
      } catch (storageError) {
        console.warn(
          "⚠️ Failed to clear storage selectively:",
          (storageError as Error).message || storageError
        );
        // Best-effort fallback: remove user key only
        try {
          await AsyncStorage.removeItem("user");
        } catch {}
      }

      // Navigate to login
      navigateToLogin();
      console.log("✅ Logout completed successfully");
    } catch (error) {
      console.error("❌ Logout error:", error);

      // Even if logout fails, clear local data (preserving prefs) and navigate to login
      try {
        const PRESERVED_KEYS = [
          'user_theme_preference',
          'user_language_preference',
        ];
        const keys = await AsyncStorage.getAllKeys();
        const keysToRemove = keys.filter(k => !PRESERVED_KEYS.includes(k));
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
      } catch {}

      navigateToLogin();
      console.log("ℹ️ Forced logout completed despite errors");
    }
  }, [navigateToLogin]);

  const handleSaveProfile = useCallback(
    async (updatedProfile: any) => {
      const updated = {
        ...user,
        displayName: updatedProfile.name,
        name: updatedProfile.name,
        designation: updatedProfile.designation || "User",
        email: updatedProfile.email || user?.email,
      };
      await AsyncStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
      setIsEditVisible(false);
    },
    [user]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: 20,
          backgroundColor: theme.colors.background,
          alignItems: "center",
        },
        profileImageContainer: {
          alignItems: "center",
          marginTop: 20,
          marginBottom: 30,
        },
        profileImage: {
          width: 120,
          height: 120,
          borderRadius: 60,
          borderWidth: 3,
          borderColor: theme.colors.primary,
        },
        imageEditButton: {
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.colors.primary,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 2,
          borderColor: theme.colors.background,
        },
        profileImageLoader: {
          width: 120,
          height: 120,
          borderRadius: 60,
          borderWidth: 3,
          borderColor: theme.colors.primary,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.card,
        },
        profileInfoContainer: {
          width: "100%",
          backgroundColor: theme.colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          borderWidth: 1,
          borderColor: theme.colors.border,
          elevation: 2,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        profileHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        },
        profileTextContainer: {
          flex: 1,
          alignItems: "center",
        },
        editButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.primary + "20",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: theme.colors.primary + "30",
        },
        imageEditContainer: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
        },
        imageEditBox: {
          backgroundColor: theme.colors.card,
          borderRadius: 16,
          padding: 24,
          width: "85%",
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        mediaOptionsContainer: {
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingVertical: 20,
          paddingHorizontal: 20,
        },
      }),
    [theme]
  );

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.inputBackground }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      <View style={{ height: insets.top }} />
      <View style={styles.container}>
      {/* Profile Picture - Centered Outside Box */}
      <View style={styles.profileImageContainer}>
        {uploading ? (
          <View style={styles.profileImageLoader}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <TouchableOpacity
            onPress={() =>
              user?.photoURL &&
              setSelectedMedia({ url: user.photoURL, type: "image" })
            }
          >
            <Image
              source={{
                uri:
                  user?.photoURL || user?.avatar || "https://placeholder.com/120",
              }}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.imageEditButton}
          onPress={handleOpenImageEdit}
        >
          <Ionicons name="camera" size={18} color={theme.colors.background} />
        </TouchableOpacity>
      </View>

      {/* Profile Details with Edit Button */}
      <View style={styles.profileInfoContainer}>
        <View style={styles.profileHeader}>
          <View style={styles.profileTextContainer}>
            <CustomText
              fontSize={theme.fonts.sizes.title}
              fontWeight="bold"
              color={theme.colors.text}
              style={{ textAlign: "center", marginBottom: 8 }}
            >
              {user?.displayName || user?.name || "Anonymous"}
            </CustomText>
            <CustomText
              fontSize={theme.fonts.sizes.regular}
              color={theme.colors.secondaryText}
              style={{ textAlign: "center", marginBottom: 4 }}
            >
              {user?.email || "No email"}
            </CustomText>
            <CustomText
              fontSize={theme.fonts.sizes.small}
              color={theme.colors.secondaryText}
              style={{ textAlign: "center" }}
            >
              {user?.designation || "User"}
            </CustomText>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Theme Toggle */}
      <ThemeToggleSection />

      {/* Language Selector */}
      <LanguageSelector />

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          width: "100%",
          backgroundColor: theme.colors.card,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: "center",
          marginTop: 16,
          flexDirection: "row",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name="log-out-outline"
          size={20}
          color={theme.colors.primary}
          style={{ marginRight: 8 }}
        />
        <CustomText
          fontSize={theme.fonts.sizes.regular}
          color={theme.colors.text}
        >
          {t("Logout")}
        </CustomText>
      </TouchableOpacity>

      <PopupEditProfile
        visible={isEditVisible}
        profile={user}
        onSave={handleSaveProfile}
        onClose={handleCloseEdit}
      />

      {/* Media Selection Modal */}
      <Modal
        visible={showMediaOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMediaOptions(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 30,
          }}
          onPress={() => setShowMediaOptions(false)}
        >
          <View
            style={[
              styles.mediaOptionsContainer,
              {
                height: "25%",
                marginVertical: "60%",
              },
            ]}
          >
            <CustomText
              fontSize={theme.fonts.sizes.title}
              color={theme.colors.text}
              style={{ marginBottom: 30, textAlign: "center" }}
            >
              {t("Profile Photo")}
            </CustomText>
            <View
              style={{ flexDirection: "row", justifyContent: "space-around" }}
            >
              <TouchableOpacity
                onPress={takePhoto}
                style={{
                  alignItems: "center",
                  padding: 20,
                  borderRadius: 15,
                  backgroundColor: theme.colors.inputBackground,
                  minWidth: 120,
                }}
                disabled={uploading}
              >
                <Ionicons
                  name="camera"
                  size={30}
                  color={theme.colors.primary}
                />
                <CustomText
                  color={theme.colors.text}
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  {t("Camera")}
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickImage}
                style={{
                  alignItems: "center",
                  padding: 20,
                  borderRadius: 15,
                  backgroundColor: theme.colors.inputBackground,
                  minWidth: 120,
                }}
                disabled={uploading}
              >
                <Ionicons name="image" size={30} color={theme.colors.primary} />
                <CustomText
                  color={theme.colors.text}
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  {t("Gallery")}
                </CustomText>
              </TouchableOpacity>
            </View>
            {uploading && (
              <View style={{ alignItems: "center", marginTop: 20 }}>
                <CustomText color={theme.colors.text}>
                  {t("profile.uploading")}
                </CustomText>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!selectedMedia}
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
        transparent={false}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "black",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {selectedMedia?.type === "image" ? (
            <Image
              source={{ uri: selectedMedia.url }}
              style={{ width: "100%", height: "100%", resizeMode: "contain" }}
            />
          ) : null}
          <TouchableOpacity
            style={{ position: "absolute", top: 40, left: 20 }}
            onPress={() => setSelectedMedia(null)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}