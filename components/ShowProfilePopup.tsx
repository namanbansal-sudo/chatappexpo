import { useLanguage } from "@/i18n";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { CustomText } from "./customText";
import { useThemeContext } from "./ThemeContext";

interface ShowProfilePopupProps {
  visible: boolean;
  onClose: () => void;
  user: {
    avatar?: string;
    name?: string;
    email?: string;
    designation?: string;
  } | null;
  loading?: boolean;
}

export function ShowProfilePopup({
  visible,
  onClose,
  user,
  loading,
}: ShowProfilePopupProps) {
  const { theme } = useThemeContext();
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View
          style={[
            styles.popupContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.profileContent}>
            {loading ? (
              <CustomText
                fontSize={theme.fonts.sizes.regular}
                color={theme.colors.text}
                style={styles.text}
              >
                {t("common.loading")}
              </CustomText>
            ) : user ? (
              <>
                <Image
                  source={{
                    uri: user.avatar || "https://via.placeholder.com/100",
                  }}
                  style={styles.avatar}
                />
                <CustomText
                  fontSize={theme.fonts.sizes.title}
                  color={theme.colors.text}
                  fontWeight="600"
                  style={styles.text}
                >
                  {user.name || t("common.unknownUser")}
                </CustomText>

                <View style={styles.infoContainer}>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={theme.colors.secondaryText}
                      style={styles.icon}
                    />
                    <CustomText
                      fontSize={theme.fonts.sizes.regular}
                      color={theme.colors.secondaryText}
                      style={styles.text}
                    >
                      {user.email || t("common.noEmail")}
                    </CustomText>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons
                      name="briefcase-outline"
                      size={20}
                      color={theme.colors.secondaryText}
                      style={styles.icon}
                    />
                    <CustomText
                      fontSize={theme.fonts.sizes.regular}
                      color={theme.colors.secondaryText}
                      style={styles.text}
                    >
                      {user.designation || t("common.noDesignation")}
                    </CustomText>
                  </View>
                </View>
              </>
            ) : (
              <CustomText
                fontSize={theme.fonts.sizes.regular}
                color={theme.colors.text}
                style={styles.text}
              >
                {t("common.userNotFound")}
              </CustomText>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContainer: {
    width: "80%",
    borderRadius: 15,
    padding: 20,
    minHeight: "35%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 5,
  },
  profileContent: {
    alignItems: "center",
    paddingTop: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  infoContainer: {
    width: "100%",
    // alignItems: "center",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    width: "100%",
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flexShrink: 1,
  },
});
