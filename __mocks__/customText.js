import React from 'react';
import { Text } from 'react-native';

export const CustomText = ({ children, style, ...props }) => {
  return React.createElement(Text, { style, ...props }, children);
};