// src/screens/QuickLockScreen.tsx
// Full-screen PIN entry overlay shown when app resumes after timeout
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { validatePIN, clearPIN } from '@/services/QuickLockService';
import { useAuth } from '../../App';

const MAX_ATTEMPTS = 5;
const PIN_LENGTH = 6;

type Props = {
  onDismiss: () => void;
};

export default function QuickLockScreen({ onDismiss }: Props) {
  const { setAuth } = useAuth();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
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

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
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

        <View style={styles.numPad}>
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

        <Pressable style={styles.forgotButton} onPress={handleForgotPIN}>
          <Text style={styles.forgotText}>Forgot PIN / Use password</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#AAAAAA',
    marginTop: -12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 8,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#AAAAAA',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  attemptText: {
    color: '#AAAAAA',
    fontSize: 13,
    textAlign: 'center',
  },
  numPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    gap: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: '#3A3A3C',
  },
  keyBlank: {
    width: 80,
    height: 80,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  keyTextSmall: {
    fontSize: 22,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  forgotButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  forgotText: {
    color: '#AAAAAA',
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
