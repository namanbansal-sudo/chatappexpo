// app/(tabs)/_layout.tsx
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/components/ThemeContext';
import { useUser } from '@/components/UserContext';
import { useChatViewModel } from '@/components/useChatViewModel';
import { useRequestViewModel } from '@/components/useRequestViewModel';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLanguage } from '@/i18n';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { theme, isDark } = useThemeContext();
  const { t } = useLanguage();
  const { user } = useUser();
  const { counts } = useChatViewModel();
  const { receivedRequests } = useRequestViewModel();
  const insets = useSafeAreaInsets();

  const [activeIndex, setActiveIndex] = useState(0);
  const animation = useRef(new Animated.Value(0)).current;
  const tabWidth = width / 3;
  
  // Animation values for each tab
  const iconScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1)
  ]).current;
  
  const labelTranslations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;

  const totalUnreadCount = counts ? counts.unreadTab : 0;
  const pendingRequestsCount = receivedRequests
    ? receivedRequests.filter(r => r.status === 'pending').length
    : 0;

  useEffect(() => {
    // Animate the notch position
    Animated.spring(animation, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
    
    // Animate icon scales
    iconScales.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: index === activeIndex ? 1.2 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 5,
      }).start();
    });
    
    // Animate label positions
    labelTranslations.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: index === activeIndex ? -2 : 0,
        useNativeDriver: true,
        tension: 200,
        friction: 5,
      }).start();
    });
  }, [activeIndex]);

  const translateX = animation.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });

  // Notch SVG path
  const Notch = () => (
    <Svg width="80" height="20" viewBox="0 0 80 20">
      <Path
        d="M0,0 
         C15,0 15,20 30,20 
         L50,20 
         C65,20 65,0 80,0 
         L0,0 Z"
        fill={isDark ? theme.colors.tabBackground : theme.colors.tabBackground}
      />
    </Svg>
  );

  const TabBarBackground = () => (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: theme.colors.tabBackground,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        }
      ]}
    >
      {/* Animated notch indicator */}
      <Animated.View
        style={[
          styles.notchContainer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Notch />
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </Animated.View>

      {/* Tab bar content */}
      <View style={styles.tabBarContent}>
        {/* This will be populated by the tab buttons */}
      </View>
    </View>
  );

  const TabButton = ({ 
    route, 
    index, 
    isFocused, 
    options, 
    onPress 
  }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };
    
    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveIndex(index);
      onPress();
    };

    // Get badge count for this tab
    const badgeCount = index === 0 
      ? totalUnreadCount 
      : index === 1 
        ? pendingRequestsCount 
        : 0;

    // Get icon name based on tab index
    const getIconName = () => {
      if (index === 0) {
        return isFocused ? 'bubble.left.fill' : 'bubble.left';
      } else if (index === 1) {
        return isFocused ? 'person.3.fill' : 'person.3';
      } else {
        return isFocused ? 'person.fill' : 'person';
      }
    };

    return (
      <Animated.View 
        style={{ 
          transform: [{ scale: scaleAnim }],
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={styles.tabButton}
        >
          <View style={styles.iconContainer}>
            <Animated.View style={{ 
              transform: [{ scale: iconScales[index] }],
            }}>
              <IconSymbol
                size={24}
                name={getIconName()}
                color={isFocused ? theme.colors.primary : theme.colors.secondaryText}
              />
            </Animated.View>
            
            {badgeCount > 0 && (
              <View style={[
                styles.badge,
                { backgroundColor: '#FF3B30' }
              ]}>
                <Text style={styles.badgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </View>
          
          {/* Label with animation */}
          <Animated.Text 
            style={[
              styles.label,
              { 
                color: isFocused ? theme.colors.primary : theme.colors.secondaryText,
                transform: [{ translateY: labelTranslations[index] }]
              }
            ]}
            numberOfLines={1}
          >
            {options.title}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={props => (
          <View style={styles.tabBarWrapper}>
            <TabBarBackground />
            <View style={[
              styles.tabsContainer, 
              { height: 60, marginBottom: insets.bottom }
            ]}>
              {props.state.routes.map((route, index) => {
                const { options } = props.descriptors[route.key];
                const isFocused = props.state.index === index;
                
                const onPress = () => {
                  const event = props.navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  
                  if (!isFocused && !event.defaultPrevented) {
                    props.navigation.navigate(route.name);
                  }
                };
                
                return (
                  <TabButton
                    key={route.key}
                    route={route}
                    index={index}
                    isFocused={isFocused}
                    options={options}
                    onPress={onPress}
                  />
                );
              })}
            </View>
          </View>
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.chats'),
          }}
        />
        <Tabs.Screen
          name="request"
          options={{
            title: t('tabs.requests'),
          }}
        />
        <Tabs.Screen
          name="setting"
          options={{
            title: t('tabs.profile'),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  notchContainer: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
    width: 80,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: -10,
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
  },
  tabsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});