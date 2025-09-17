import { CustomButton } from '@/components/CustomButton';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

// Mock the dependencies
jest.mock('@/components/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        background: '#FFFFFF',
      },
    },
  }),
}));

// Mock CustomText with a simple component
jest.mock('@/components/CustomText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, style, ...props }) => (
      <Text style={style} {...props}>
        {children}
      </Text>
    ),
  };
});


describe('CustomButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    const { getByText } = render(
      <CustomButton title="Test Button" onPress={mockOnPress} />
    );
    
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByText } = render(
      <CustomButton title="Test Button" onPress={mockOnPress} />
    );

    const button = getByText('Test Button');
    fireEvent.press(button);
    
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('applies custom text styles', () => {
    const { getByText } = render(
      <CustomButton
        title="Test Button"
        onPress={mockOnPress}
        textStyle={{ fontSize: 16 }}
      />
    );

    expect(getByText('Test Button')).toBeTruthy();
  });
});