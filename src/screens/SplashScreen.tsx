// src/screens/SplashScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '../theme/useTheme';
import KISText from '@/components/common/KISText';

import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

const DEFAULT_SPLASH_DURATION_MS = 8000; // 👈 change this if you want longer/shorter

type SplashScreenProps = {
  /**
   * Called after the minimum splash duration has elapsed.
   * Parent (App.tsx) decides what to do next (show main app, navigate, etc.).
   */
  onFinish?: () => void;
  /**
   * Optional override for the minimum time (in ms) the splash should stay visible.
   */
  minimumDurationMs?: number;
};

export default function SplashScreen({
  onFinish,
  minimumDurationMs = DEFAULT_SPLASH_DURATION_MS,
}: SplashScreenProps) {
  const { palette, tone } = useKISTheme();

  const logo: ImageSourcePropType = tone === 'dark' ? logoDark : logoLight;

  // Anim values
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const driftC = useRef(new Animated.Value(0)).current;
  const orbitRot = useRef(new Animated.Value(0)).current;

  // 🔁 Core animations
  useEffect(() => {
    // Core pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.045,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.96,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1.0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Background drifts
    const makeDrift = (val: Animated.Value, dur: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: dur,
            delay,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: dur,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

    const driftALoop = makeDrift(driftA, 5000);
    const driftBLoop = makeDrift(driftB, 6500, 300);
    const driftCLoop = makeDrift(driftC, 7800, 600);

    // Orbit
    const orbit = Animated.loop(
      Animated.timing(orbitRot, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulse.start();
    driftALoop.start();
    driftBLoop.start();
    driftCLoop.start();
    orbit.start();

    return () => {
      pulse.stop();
      driftALoop.stop();
      driftBLoop.stop();
      driftCLoop.stop();
      orbit.stop();
    };
  }, [scale, opacity, driftA, driftB, driftC, orbitRot]);

  // ⏱️ Minimum time to stay on splash, then notify parent
  useEffect(() => {
    const timeout = setTimeout(() => {
      // Optional: mark that splash has run at least once
      AsyncStorage.setItem('KIS_SPLASH_SHOWN', 'true').catch(() => {});

      if (onFinish) {
        onFinish();
      }
    }, minimumDurationMs);

    return () => clearTimeout(timeout);
  }, [onFinish, minimumDurationMs]);

  // Interpolations
  const driftAStyle = {
    transform: [
      {
        translateX: driftA.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 12],
        }),
      },
      {
        translateY: driftA.interpolate({
          inputRange: [0, 1],
          outputRange: [8, -8],
        }),
      },
      {
        scale: driftA.interpolate({
          inputRange: [0, 1],
          outputRange: [1.0, 1.05],
        }),
      },
    ],
    opacity: driftA.interpolate({
      inputRange: [0, 1],
      outputRange: [0.05, 0.12],
    }),
  };
  const driftBStyle = {
    transform: [
      {
        translateX: driftB.interpolate({
          inputRange: [0, 1],
          outputRange: [16, -10],
        }),
      },
      {
        translateY: driftB.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 10],
        }),
      },
      {
        scale: driftB.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1.03],
        }),
      },
    ],
    opacity: driftB.interpolate({
      inputRange: [0, 1],
      outputRange: [0.04, 0.1],
    }),
  };
  const driftCStyle = {
    transform: [
      {
        translateX: driftC.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 8],
        }),
      },
      {
        translateY: driftC.interpolate({
          inputRange: [0, 1],
          outputRange: [10, -10],
        }),
      },
      {
        scale: driftC.interpolate({
          inputRange: [0, 1],
          outputRange: [1.02, 1.06],
        }),
      },
    ],
    opacity: driftC.interpolate({
      inputRange: [0, 1],
      outputRange: [0.03, 0.08],
    }),
  };
  const orbitRotateStyle = {
    transform: [
      {
        rotate: orbitRot.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const ringColor =
    tone === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const electronColor = palette.primary ?? '#6EA8FE';

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <StatusBar
        barStyle={tone === 'dark' ? 'light-content' : 'dark-content'}
      />

      {/* background blobs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.blob,
            { backgroundColor: '#000', left: -40, top: -30, borderRadius: 120 },
            driftAStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              backgroundColor: '#000',
              right: -30,
              bottom: 60,
              borderRadius: 140,
            },
            driftBStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              backgroundColor: '#000',
              left: 50,
              bottom: -20,
              borderRadius: 100,
            },
            driftCStyle,
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor:
                tone === 'dark'
                  ? 'rgba(0,0,0,0.20)'
                  : 'rgba(0,0,0,0.08)',
            },
          ]}
        />
      </View>

      <View style={styles.center}>
        <View style={styles.logoStack}>
          <View style={[styles.ring, { borderColor: ringColor }]} />
          <Animated.View style={[styles.orbitContainer, orbitRotateStyle]}>
            <View
              style={[
                styles.electron,
                { backgroundColor: electronColor, shadowColor: electronColor },
              ]}
            />
          </Animated.View>
          <Animated.Image
            source={logo}
            resizeMode="contain"
            style={[styles.logo, { transform: [{ scale }], opacity }]}
          />
        </View>

        <KISText preset="h1" color={palette.text} style={styles.title}>
          kingdom{'\n'}impact social
        </KISText>
        <KISText preset="body" color={palette.subtext} style={styles.subtitle}>
          Connecting Communities in Faith
        </KISText>
      </View>
    </View>
  );
}

const RING_SIZE = 220;
const ELECTRON_SIZE = 10;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  center: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    opacity: 0.08,
  },
  logoStack: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  orbitContainer: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  electron: {
    width: ELECTRON_SIZE,
    height: ELECTRON_SIZE,
    borderRadius: ELECTRON_SIZE / 2,
    marginTop: 2,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  logo: { width: 180, height: 180 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: { marginTop: 12, textAlign: 'center' },
});
