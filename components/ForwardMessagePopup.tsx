import { useLanguage } from "@/i18n";
import { UserServiceSimple } from "@/services/userServiceSimple";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import { CustomSearchInput } from "./customSearchInput";
import { CustomText } from "./CustomText";
import { useThemeContext } from "./ThemeContext";
import { useUser } from "./UserContext";

interface ForwardMessagePopupProps {
  visible: boolean;
  onClose: () => void;
  onForward: (userIds: string[], caption?: string) => void;
  enableCaption?: boolean;
}

interface User {
  id: string;
  name: string;
  photo?: string;
  isOnline?: boolean;
}

export const ForwardMessagePopup: React.FC<ForwardMessagePopupProps> = ({
  visible,
  onClose,
  onForward,
  enableCaption = false,
}) => {
  const { theme } = useThemeContext();
  const { t } = useLanguage();
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState<string>("");

  useEffect(() => {
    if (visible && user?.uid) {
      loadUsers();
    }
  }, [visible, user?.uid]);

  const loadUsers = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      // Get user's friends list
      const friendsList: string[] = (user as any).friends || [];

      const friendsData = await Promise.all(
        friendsList.map(async (friendId) => {
          try {
            const friendUser = await UserServiceSimple.getUserById(friendId);
            if (friendUser) {
              return {
                id: friendId,
                name: friendUser.name,
                photo: friendUser.photo || "",
                isOnline: friendUser.isOnline || false,
              };
            }
            return null;
          } catch (error) {
            console.error("Error loading friend:", error);
            return null;
          }
        })
      );

      setUsers(friendsData.filter(Boolean) as User[]);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleForward = () => {
    if (selectedUsers.size > 0) {
      onForward(Array.from(selectedUsers), caption.trim());
      setSelectedUsers(new Set());
      setSearch("");
      setCaption("");
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedUsers(new Set());
    setSearch("");
    setCaption("");
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal 
      visible={visible} 
      onRequestClose={handleClose} 
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: 20,
            padding: 20,
            width: "90%",
            maxHeight: "80%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <CustomText
              fontSize={theme.fonts.sizes.title}
              color={theme.colors.text}
              style={{ fontWeight: "bold" }}
            >
              {t("chat.forwardMessage")}
            </CustomText>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          {/* Search */}
          <CustomSearchInput
            placeholder={t("chat.searchFriends")}
            value={search}
            onChangeText={setSearch}
            style={{ marginBottom: 15 }}
          />
          {selectedUsers.size > 0 && (
            <View
              style={{
                backgroundColor: theme.colors.primary + "20",
                padding: 10,
                borderRadius: 8,
                marginBottom: 15,
              }}
            >
              <CustomText
                color={theme.colors.primary}
                fontSize={theme.fonts.sizes.small}
              >
                {selectedUsers.size}{" "}
                {selectedUsers.size === 1 ? "friend" : "friends"} selected
              </CustomText>
            </View>
          )}

          {enableCaption && (
            <TextInput
              placeholder={t("Add Caption")}
              placeholderTextColor={theme.colors.secondaryText}
              value={caption}
              onChangeText={setCaption}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: theme.colors.text,
                marginBottom: 15,
              }}
              multiline
            />
          )}

          {/* Users List */}
          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <CustomText
                color={theme.colors.secondaryText}
                style={{ marginTop: 10 }}
              >
                {t("Loading Friends")}
              </CustomText>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: selectedUsers.has(item.id)
                      ? theme.colors.primary + "20"
                      : "transparent",
                    marginBottom: 8,
                  }}
                  onPress={() => toggleUserSelection(item.id)}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: theme.colors.primary + "30",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 12,
                    }}
                  >
                    {item.photo ? (
                      <CustomText color={theme.colors.primary} fontSize={16}>
                        {item.name.charAt(0).toUpperCase()}
                      </CustomText>
                    ) : (
                      <CustomText color={theme.colors.primary} fontSize={16}>
                        {item.name.charAt(0).toUpperCase()}
                      </CustomText>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <CustomText
                      color={theme.colors.text}
                      fontSize={theme.fonts.sizes.regular}
                      style={{ fontWeight: "500" }}
                    >
                      {item.name}
                    </CustomText>
                    {item.isOnline && (
                      <CustomText
                        color={theme.colors.primary}
                        fontSize={theme.fonts.sizes.small}
                      >
                        Online
                      </CustomText>
                    )}
                  </View>

                  {selectedUsers.has(item.id) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Ionicons
                    name="people-outline"
                    size={48}
                    color={theme.colors.secondaryText}
                  />
                  <CustomText
                    color={theme.colors.secondaryText}
                    style={{ marginTop: 10 }}
                  >
                    {search ? t("No Friends Found") : t("No Friends Available")}
                  </CustomText>
                </View>
              }
            />
          )}
          {/* Action Buttons */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
              gap: 12,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: "center",
              }}
              onPress={handleClose}
            >
              <CustomText color={theme.colors.text}>{t("Cancel")}</CustomText>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor:
                  selectedUsers.size > 0
                    ? theme.colors.primary
                    : theme.colors.border,
                alignItems: "center",
              }}
              onPress={handleForward}
              disabled={selectedUsers.size === 0}
            >
              <CustomText
                color={
                  selectedUsers.size > 0
                    ? theme.colors.background
                    : theme.colors.secondaryText
                }
                style={{ fontWeight: "600" }}
              >
                {t("Forward")} ({selectedUsers.size})
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

