// components/CustomButton.tsx
import React, { useMemo } from 'react';
import { TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useThemeContext } from './ThemeContext';
import { CustomText } from './customText';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const CustomButton: React.FC<CustomButtonProps> = React.memo(({ title, onPress, style, textStyle }) => {
  const { theme } = useThemeContext();
  
  const buttonStyle = useMemo(() => ([
    {
      backgroundColor: theme.colors.primary,
      borderRadius: 50,
      paddingVertical: 15,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    style,
  ]), [theme.colors.primary, style]);
  
  return (
    <TouchableOpacity onPress={onPress} style={buttonStyle}>
      <CustomText color={theme.colors.background} fontWeight="bold" style={textStyle}>
        {title}
      </CustomText>
    </TouchableOpacity>
  );
});
