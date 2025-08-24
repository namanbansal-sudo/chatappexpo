// components/CustomText.tsx
import React, { useMemo } from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { useThemeContext } from './ThemeContext';

interface CustomTextProps extends TextProps {
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  color?: string;
  fontSize?: number;
  style?: StyleProp<TextStyle>;
}

export const CustomText: React.FC<CustomTextProps> = React.memo(({
  children,
  fontWeight = 'normal',
  color,
  fontSize,
  style,
  ...props
}) => {
  const { theme } = useThemeContext();
  
  const textStyle = useMemo(() => ({
    color: color || theme.colors.text,
    fontSize: fontSize || theme.fonts.sizes.regular,
    fontWeight: fontWeight,
  }), [color, fontSize, fontWeight, theme.colors.text, theme.fonts.sizes.regular]);
  
  return (
    <Text
      style={[textStyle, style]}
      {...props}
    >
      {children}
    </Text>
  );
});
