// src/screens/QuickLockScreen.tsx
// Full-screen PIN entry overlay shown when app resumes after timeout
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { validatePIN, clearPIN } from '@/services/QuickLockService';
import { useAuth } from '../../App';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

async function tryBiometricAuth(): Promise<boolean> {
  try {
    const mod = require('react-native-biometrics');
    const rnBiometrics = new (mod.default ?? mod.ReactNativeBiometrics)();
    const { available } = await rnBiometrics.isSensorAvailable();
    if (!available) return false;
    const { success } = await rnBiometrics.simplePrompt({ promptMessage: 'Unlock KIS' });
    return !!success;
  } catch {
    return false;
  }
}

const MAX_ATTEMPTS = 5;
const PIN_LENGTH = 6;

type Props = {
  onDismiss: () => void;
};

export default function QuickLockScreen({ onDismiss }: Props) {
  const { setAuth } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, tokens } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleCorrectPIN = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const handleBiometric = useCallback(async () => {
    const success = await tryBiometricAuth();
    if (success) handleCorrectPIN();
    else setError('Biometric authentication failed. Enter your PIN.');
  }, [handleCorrectPIN]);

  // Check biometric availability and auto-prompt on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = require('react-native-biometrics');
        const rnBiometrics = new (mod.default ?? mod.ReactNativeBiometrics)();
        const { available } = await rnBiometrics.isSensorAvailable();
        if (!cancelled) setBiometricAvailable(!!available);
        if (available && !cancelled) {
          const { success } = await rnBiometrics.simplePrompt({ promptMessage: 'Unlock KIS' });
          if (!cancelled && success) handleCorrectPIN();
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [handleCorrectPIN]);

  const handleWrongPIN = useCallback((nextAttempts: number) => {
    shake();
    setPin('');
    if (nextAttempts >= MAX_ATTEMPTS) {
      setError('Too many wrong attempts. Logging out…');
      // Force full logout
      clearPIN().finally(() => {
        setAuth(false);
      });
    } else {
      setError(`Incorrect PIN. ${MAX_ATTEMPTS - nextAttempts} attempt${MAX_ATTEMPTS - nextAttempts === 1 ? '' : 's'} remaining.`);
    }
  }, [shake, setAuth]);

  const submitPIN = useCallback(async (enteredPin: string) => {
    const valid = await validatePIN(enteredPin);
    const nextAttempts = attempts + 1;
    if (valid) {
      handleCorrectPIN();
    } else {
      setAttempts(nextAttempts);
      handleWrongPIN(nextAttempts);
    }
  }, [attempts, handleCorrectPIN, handleWrongPIN]);

  const pressKey = useCallback((digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      void submitPIN(next);
    }
  }, [pin, submitPIN]);

  const pressDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, []);

  const handleForgotPIN = useCallback(() => {
    clearPIN().finally(() => {
      setAuth(false);
    });
  }, [setAuth]);

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: palette.bg, marginTop: 25,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    container: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: responsive.pageGutter,
      gap: tokens.spacing.lg,
    },
    title: {
      fontSize: tokens.typography.h2,
      fontWeight: tokens.typography.weight.bold,
      color: palette.text,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: tokens.typography.body,
      color: palette.subtext,
      marginTop: -tokens.spacing.sm,
    },
    dotsRow: {
      flexDirection: 'row',
      gap: tokens.spacing.md,
      marginVertical: tokens.spacing.sm,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: palette.subtext,
      backgroundColor: 'transparent',
    },
    dotFilled: {
      backgroundColor: palette.text,
      borderColor: palette.text,
    },
    errorText: {
      color: palette.danger,
      fontSize: tokens.typography.body,
      textAlign: 'center',
      fontWeight: tokens.typography.weight.semibold,
    },
    attemptText: {
      color: palette.subtext,
      fontSize: tokens.typography.helper,
      textAlign: 'center',
    },
    numPad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 264,
      gap: 12,
      marginTop: tokens.spacing.sm,
      justifyContent: 'center',
    },
    key: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyPressed: {
      backgroundColor: palette.surfaceElevated,
    },
    keyBlank: {
      width: 80,
      height: 80,
    },
    keyText: {
      fontSize: 26,
      fontWeight: tokens.typography.weight.medium,
      color: palette.text,
    },
    keyTextSmall: {
      fontSize: 22,
      fontWeight: '400',
      color: palette.text,
    },
    forgotButton: {
      marginTop: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.sm,
    },
    forgotText: {
      color: palette.subtext,
      fontSize: tokens.typography.body,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
  }), [palette, tokens, responsive]);

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]}>
      <View style={[styles.container, { maxWidth: responsive.contentMaxWidth }]}>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>Unlock to continue</Text>

        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {dots.map((filled, i) => (
            <View
              key={i}
              style={[styles.dot, filled && styles.dotFilled]}
            />
          ))}
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {attempts > 0 && attempts < MAX_ATTEMPTS ? (
          <Text style={styles.attemptText}>
            {attempts} failed attempt{attempts === 1 ? '' : 's'}
          </Text>
        ) : null}

        <View style={[styles.numPad, { width: Math.min(windowWidth - 56, 264) }]}>
          {(['1','2','3','4','5','6','7','8','9','','0','del'] as const).map((key, idx) => {
            if (key === '') {
              return <View key={`blank-${idx}`} style={styles.keyBlank} />;
            }
            if (key === 'del') {
              return (
                <Pressable
                  key="del"
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                  onPress={pressDelete}
                >
                  <Text style={styles.keyTextSmall}>⌫</Text>
                </Pressable>
              );
            }
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                onPress={() => pressKey(key)}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            );
          })}
        </View>

        {biometricAvailable && (
          <Pressable
            style={[styles.forgotButton, { marginTop: 4 }]}
            onPress={handleBiometric}
          >
            <Text style={styles.forgotText}>
              {Platform.OS === 'ios' ? '🔒 Use Face ID / Touch ID' : '🔒 Use Biometrics'}
            </Text>
          </Pressable>
        )}

        <Pressable style={styles.forgotButton} onPress={handleForgotPIN}>
          <Text style={styles.forgotText}>Forgot PIN / Use password</Text>
        </Pressable>
      </View>
    </View>
  );
}
