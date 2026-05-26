// src/screens/SetupPINScreen.tsx
// Two-step PIN creation screen
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { setPIN } from '@/services/QuickLockService';

const PIN_LENGTH = 6;

type Step = 'enter' | 'confirm';

export default function SetupPINScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<Step>('enter');
  const [firstPIN, setFirstPIN] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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

  const advanceWithDigit = useCallback(async (currentPin: string) => {
    if (step === 'enter') {
      setFirstPIN(currentPin);
      setPin('');
      setStep('confirm');
    } else {
      // Confirm step
      if (currentPin !== firstPIN) {
        shake();
        setPin('');
        setError('PINs do not match. Try again.');
        return;
      }
      setSaving(true);
      try {
        await setPIN(currentPin);
        navigation.goBack();
      } catch (e: any) {
        setError(e?.message || 'Failed to save PIN.');
      } finally {
        setSaving(false);
      }
    }
  }, [step, firstPIN, shake, navigation]);

  const pressKey = useCallback((digit: string) => {
    if (saving) return;
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      void advanceWithDigit(next);
    }
  }, [pin, saving, advanceWithDigit]);

  const pressDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, []);

  const resetToStart = useCallback(() => {
    setStep('enter');
    setFirstPIN('');
    setPin('');
    setError('');
  }, []);

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>
          {step === 'enter' ? 'Set Quick Lock PIN' : 'Confirm Your PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'enter'
            ? 'Enter a 6-digit PIN to lock the app'
            : 'Enter the same PIN again to confirm'}
        </Text>

        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {step === 'confirm' ? (
          <Pressable onPress={resetToStart} style={styles.retryButton}>
            <Text style={styles.retryText}>Start over</Text>
          </Pressable>
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
                  disabled={saving}
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
                disabled={saving}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#AAAAAA',
    fontSize: 16,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
    marginTop: -40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
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
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryText: {
    color: '#AAAAAA',
    fontSize: 14,
    textDecorationLine: 'underline',
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
});
