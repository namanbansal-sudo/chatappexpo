// components/CustomButton.tsx
import React, { useMemo } from 'react';
import { StyleProp, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { useThemeContext } from './ThemeContext';
import CustomText from './CustomText';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const CustomButton: React.FC<CustomButtonProps> = React.memo(({ 
  title, 
  onPress, 
  style, 
  textStyle,
  testID = 'custom-button' 
}) => {
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
    <TouchableOpacity 
      testID={testID}
      onPress={onPress} 
      style={buttonStyle}
    >
      <CustomText color={theme.colors.background} fontWeight="bold" style={textStyle}>
        {title}
      </CustomText>
    </TouchableOpacity>
  );
});