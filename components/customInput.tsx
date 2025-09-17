// components/CustomInput.tsx
import React from 'react';
import { StyleProp, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { CustomText } from './CustomText';
import { useThemeContext } from './ThemeContext';

interface CustomInputProps extends TextInputProps {
  label?: string;
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  prefix,
  containerStyle,
  inputStyle,
  ...props
}) => {
  const { theme } = useThemeContext();
  
  return (
    <View style={containerStyle}>
      {label && <CustomText color={theme.colors.secondaryText} fontSize={theme.fonts.sizes.small} style={{ marginBottom: 5 }}>{label}</CustomText>}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.inputBackground,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 15,
        }}
      >
        {prefix && <CustomText color={theme.colors.text} style={{ marginRight: 10 }}>{prefix}</CustomText>}
        <TextInput
          style={[{ flex: 1, color: theme.colors.text }, inputStyle]}
          {...props}
        />
      </View>
    </View>
  );
};
