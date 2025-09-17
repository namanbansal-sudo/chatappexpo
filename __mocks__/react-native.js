const React = require('react');

const View = ({ children, testID, style, ...props }) => {
  return React.createElement('View', { testID, style, ...props }, children);
};

const Text = ({ children, testID, style, ...props }) => {
  return React.createElement('Text', { testID, style, ...props }, children);
};

const TouchableOpacity = ({ children, onPress, testID, style, ...props }) => {
  return React.createElement('TouchableOpacity', { 
    testID, 
    style, 
    onPress,
    ...props 
  }, children);
};

module.exports = {
  View,
  Text,
  TouchableOpacity,
  StyleSheet: {
    create: (styles) => styles,
  },
};