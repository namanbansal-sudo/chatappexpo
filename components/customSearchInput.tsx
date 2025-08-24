// components/CustomSearchInput.tsx
import React from 'react';
import { TextInput, StyleProp, TextStyle, View, ViewStyle, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeContext } from './ThemeContext';

interface CustomSearchInputProps {
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  value?: string;
  onChangeText?: (text: string) => void;
}

export const CustomSearchInput: React.FC<CustomSearchInputProps> = ({ placeholder, style, inputStyle, value, onChangeText }) => {
  const { theme } = useThemeContext();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.inputBackground }, style]}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.colors.secondaryText}
        style={[styles.input, { color: theme.colors.text }, inputStyle]}
        value={value}
        onChangeText={onChangeText}
      />
      <MaterialIcons name="mic" size={24} color={theme.colors.secondaryText} style={styles.icon} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  icon: {
    marginLeft: 10,
  },
});