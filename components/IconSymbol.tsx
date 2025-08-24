// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Tab navigation icons
  'bubble.left': 'chat-bubble-outline',
  'bubble.left.fill': 'chat-bubble',
  'pawprint': 'pets',
  'pawprint.fill': 'pets',
  'person': 'person-outline',
  'person.fill': 'person',
  
  // Common chat app icons
  'magnifyingglass': 'search',
  'gearshape': 'settings',
  'gearshape.fill': 'settings',
  'plus': 'add',
  'plus.circle': 'add-circle',
  'plus.circle.fill': 'add-circle',
  'xmark': 'close',
  'xmark.circle': 'close',
  'checkmark': 'check',
  'checkmark.circle': 'check-circle',
  'checkmark.circle.fill': 'check-circle',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'star': 'star-border',
  'star.fill': 'star',
  'bell': 'notifications-none',
  'bell.fill': 'notifications',
  'camera': 'camera-alt',
  'photo': 'photo',
  'video': 'videocam',
  'microphone': 'mic',
  'microphone.fill': 'mic',
  'pencil': 'edit',
  'pencil.circle': 'edit',
  'trash': 'delete',
  'trash.fill': 'delete',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  
  // Communication icons
  'message': 'message',
  'message.fill': 'message',
  'envelope': 'mail',
  'envelope.fill': 'mail',
  'phone': 'phone',
  'phone.fill': 'phone',
  'video.fill': 'videocam',
  'location': 'location-on',
  'location.fill': 'location-on',
  
  // Social icons
  'person.2': 'people',
  'person.2.fill': 'people',
  'person.3': 'group',
  'person.3.fill': 'group',
  'hand.thumbsup': 'thumb-up',
  'hand.thumbsup.fill': 'thumb-up',
  'hand.thumbsdown': 'thumb-down',
  'hand.thumbsdown.fill': 'thumb-down',
  
  // Legacy icons
  'house.fill': 'home',
  'chevron.left.forwardslash.chevron.right': 'code',
  'line.horizontal.3': 'menu',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
