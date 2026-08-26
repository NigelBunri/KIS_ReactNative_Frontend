import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  checkNotifications,
  requestNotifications,
  openSettings,
  RESULTS,
} from 'react-native-permissions';
import { KIS_COLORS } from '@/theme/constants';

// Shown on every app load/foreground until the user actually grants
// notification permission — chat push and incoming-call CallKit wake both
// depend on it, and previously a device could sit with permission denied
// indefinitely with no prompt telling the user why messages/calls never
// arrived while the app was backgrounded.
export default function NotificationPermissionModal() {
  const [visible, setVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const checkingRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const { status } = await checkNotifications();
      if (
        status === RESULTS.GRANTED ||
        status === RESULTS.LIMITED ||
        status === RESULTS.UNAVAILABLE
      ) {
        setVisible(false);
        return;
      }
      setBlocked(status === RESULTS.BLOCKED);
      setVisible(true);
    } catch {
      // Can't determine status — nothing actionable to show.
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void evaluate();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void evaluate();
    });
    return () => sub.remove();
  }, [evaluate]);

  const handlePrimary = useCallback(async () => {
    if (blocked) {
      await openSettings().catch(() => undefined);
      return;
    }
    const { status } = await requestNotifications(['alert', 'badge', 'sound']).catch(
      () => ({ status: RESULTS.DENIED, settings: {} }),
    );
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
      setVisible(false);
    } else if (status === RESULTS.BLOCKED) {
      setBlocked(true);
    }
  }, [blocked]);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Turn on notifications</Text>
          <Text style={styles.message}>
            KIS uses notifications to let you know about new messages and
            calls. Without them, you may miss messages while the app is in
            the background.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handlePrimary}>
            <Text style={styles.primaryText}>
              {blocked ? 'Open Settings' : 'Enable Notifications'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setVisible(false)}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: KIS_COLORS.brand.royalInk,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: KIS_COLORS.brand.gold,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: KIS_COLORS.brand.ivory,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: KIS_COLORS.brand.ivory,
    opacity: 0.85,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: KIS_COLORS.brand.gold,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryText: {
    color: KIS_COLORS.brand.royalInk,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryText: {
    color: KIS_COLORS.brand.ivory,
    opacity: 0.7,
    fontSize: 13,
  },
});
