import { useThemeContext } from '@/components/ThemeContext';
import Waves from '@/components/Waves';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StatusBar, Text, View } from 'react-native';
import styles from './Styles';

const SplashScreen = () => {
  const { theme } = useThemeContext();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            delay,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0c10" />
      <Waves />

      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: '#00f0b5',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
            shadowColor: '#00f0b5',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#0b0c10' }}>
            💬
          </Text>
        </View>

        <Text style={styles.title}>ChatApp</Text>
        <Text style={{ fontSize: 16, color: '#c5c6c7', textAlign: 'center' }}>
          Connect with friends instantly
        </Text>
      </View>

      {/* Typing dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'absolute',
          bottom: 100,
        }}
      >
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#00f0b5',
            marginHorizontal: 5,
            opacity: dot1,
          }}
        />
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#00f0b5',
            marginHorizontal: 5,
            opacity: dot2,
          }}
        />
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#00f0b5',
            marginHorizontal: 5,
            opacity: dot3,
          }}
        />
      </View>
    </View>
  );
};

export default SplashScreen;
