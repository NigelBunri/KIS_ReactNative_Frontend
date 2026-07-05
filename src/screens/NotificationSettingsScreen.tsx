// src/screens/NotificationSettingsScreen.tsx
// Do Not Disturb and push notification preferences screen.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout, type ResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { patchRequest } from '@/network/patch';
import { getRequest } from '@/network/get';

// AsyncStorage keys
const KEY_DND_ENABLED = 'KIS_DND_ENABLED';
const KEY_DND_FROM = 'KIS_DND_FROM';
const KEY_DND_TO = 'KIS_DND_TO';
const KEY_NOTIF_MESSAGES = 'notif_messages';
const KEY_NOTIF_CALLS = 'notif_calls';
const KEY_NOTIF_BIBLE = 'notif_bible';
const KEY_NOTIF_FEED = 'notif_feed';
const KEY_NOTIF_HEALTH = 'notif_health';

export default function NotificationSettingsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // DND
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndFrom, setDndFrom] = useState('22:00');
  const [dndTo, setDndTo] = useState('07:00');

  // Push notification toggles
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifCalls, setNotifCalls] = useState(true);
  const [notifBible, setNotifBible] = useState(true);
  const [notifFeed, setNotifFeed] = useState(true);
  const [notifHealth, setNotifHealth] = useState(true);

  const applyPrefs = useCallback((prefs: Record<string, any>) => {
    // Support both old flat structure and new nested dnd_quiet_hours structure
    const dnd = prefs.dnd_quiet_hours;
    if (dnd !== undefined) {
      if (dnd?.enabled !== undefined) setDndEnabled(Boolean(dnd.enabled));
      if (dnd?.start) setDndFrom(String(dnd.start));
      if (dnd?.end) setDndTo(String(dnd.end));
    } else {
      // Legacy flat keys (backward compat on load)
      if (prefs.dnd_enabled !== undefined) setDndEnabled(Boolean(prefs.dnd_enabled));
      if (prefs.dnd_from) setDndFrom(String(prefs.dnd_from));
      if (prefs.dnd_to) setDndTo(String(prefs.dnd_to));
    }
    if (prefs.notif_messages !== undefined) setNotifMessages(Boolean(prefs.notif_messages));
    if (prefs.notif_calls !== undefined) setNotifCalls(Boolean(prefs.notif_calls));
    if (prefs.notif_bible !== undefined) setNotifBible(Boolean(prefs.notif_bible));
    if (prefs.notif_feed !== undefined) setNotifFeed(Boolean(prefs.notif_feed));
    if (prefs.notif_health !== undefined) setNotifHealth(Boolean(prefs.notif_health));
  }, []);

  // Load from backend first, fall back to AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const res = await getRequest(ROUTES.profilePreferences.me, { errorMessage: '' });
        if (res?.success && res.data?.notification_preferences) {
          applyPrefs(res.data.notification_preferences);
          setLoading(false);
          return;
        }
      } catch { /* fall through to AsyncStorage */ }
      try {
        const [dndEnabledRaw, dndFromRaw, dndToRaw, notifMessagesRaw, notifCallsRaw, notifBibleRaw, notifFeedRaw, notifHealthRaw] =
          await AsyncStorage.multiGet([KEY_DND_ENABLED, KEY_DND_FROM, KEY_DND_TO, KEY_NOTIF_MESSAGES, KEY_NOTIF_CALLS, KEY_NOTIF_BIBLE, KEY_NOTIF_FEED, KEY_NOTIF_HEALTH]);
        const toBool = (pair: readonly [string, string | null], defaultVal: boolean) =>
          pair[1] === null ? defaultVal : pair[1] === 'true';
        setDndEnabled(toBool(dndEnabledRaw, false));
        if (dndFromRaw[1]) setDndFrom(dndFromRaw[1]);
        if (dndToRaw[1]) setDndTo(dndToRaw[1]);
        setNotifMessages(toBool(notifMessagesRaw, true));
        setNotifCalls(toBool(notifCallsRaw, true));
        setNotifBible(toBool(notifBibleRaw, true));
        setNotifFeed(toBool(notifFeedRaw, true));
        setNotifHealth(toBool(notifHealthRaw, true));
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [applyPrefs]);

  const handleSave = useCallback(async () => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (dndEnabled) {
      if (!timeRegex.test(dndFrom)) {
        Alert.alert('Invalid time', 'Quiet Hours "From" must be in HH:MM format (e.g. 22:00).');
        return;
      }
      if (!timeRegex.test(dndTo)) {
        Alert.alert('Invalid time', 'Quiet Hours "Until" must be in HH:MM format (e.g. 07:00).');
        return;
      }
    }

    setSaving(true);
    const prefs = {
      dnd_quiet_hours: { enabled: dndEnabled, start: dndFrom, end: dndTo },
      notif_messages: notifMessages,
      notif_calls: notifCalls,
      notif_bible: notifBible,
      notif_feed: notifFeed,
      notif_health: notifHealth,
    };
    try {
      // Persist to backend (cross-device sync) and local cache simultaneously
      await Promise.allSettled([
        patchRequest(ROUTES.profilePreferences.me, { notification_preferences: prefs }),
        AsyncStorage.multiSet([
          [KEY_DND_ENABLED, String(dndEnabled)],
          [KEY_DND_FROM, dndFrom],
          [KEY_DND_TO, dndTo],
          [KEY_NOTIF_MESSAGES, String(notifMessages)],
          [KEY_NOTIF_CALLS, String(notifCalls)],
          [KEY_NOTIF_BIBLE, String(notifBible)],
          [KEY_NOTIF_FEED, String(notifFeed)],
          [KEY_NOTIF_HEALTH, String(notifHealth)],
        ]),
      ]);
      Alert.alert('Saved', 'Notification settings saved.');
    } catch {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [dndEnabled, dndFrom, dndTo, notifMessages, notifCalls, notifBible, notifFeed, notifHealth]);

  const s = makeStyles(palette, responsive);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[s.root, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <View style={s.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[s.root, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.backBtn}
          >
            <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
          </Pressable>
          <Text style={[s.headerTitle, { color: palette.text }]}>
            Notification Settings
          </Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Do Not Disturb */}
          <View style={[s.section, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
            <Text style={[s.sectionTitle, { color: palette.text }]}>Do Not Disturb</Text>
            <Text style={[s.sectionDesc, { color: palette.subtext }]}>
              Silence all push notifications during set times.
            </Text>
            <View style={s.row}>
              <Text style={[s.rowLabel, { color: palette.text }]}>Enable Do Not Disturb</Text>
              <Switch
                value={dndEnabled}
                onValueChange={setDndEnabled}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.onPrimary}
              />
            </View>
          </View>

          {/* Quiet Hours — only shown when DND enabled */}
          {dndEnabled ? (
            <View style={[s.section, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.sectionTitle, { color: palette.text }]}>Quiet Hours</Text>
              <Text style={[s.sectionDesc, { color: palette.subtext }]}>
                Notifications will be silenced between these times (HH:MM format).
              </Text>
              <View style={s.timeRow}>
                <View style={s.timeField}>
                  <Text style={[s.timeLabel, { color: palette.subtext }]}>From</Text>
                  <TextInput
                    style={[s.timeInput, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.surface }]}
                    value={dndFrom}
                    onChangeText={setDndFrom}
                    placeholder="22:00"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
                <View style={s.timeField}>
                  <Text style={[s.timeLabel, { color: palette.subtext }]}>Until</Text>
                  <TextInput
                    style={[s.timeInput, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.surface }]}
                    value={dndTo}
                    onChangeText={setDndTo}
                    placeholder="07:00"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Push Notifications */}
          <View style={[s.section, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
            <Text style={[s.sectionTitle, { color: palette.text }]}>Push Notifications</Text>
            <Text style={[s.sectionDesc, { color: palette.subtext }]}>
              Choose which notifications you receive.
            </Text>

            <View style={[s.row, { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={s.rowLabelGroup}>
                <Text style={[s.rowLabel, { color: palette.text }]}>Messages</Text>
                <Text style={[s.rowSub, { color: palette.subtext }]}>New chat messages and replies</Text>
              </View>
              <Switch
                value={notifMessages}
                onValueChange={setNotifMessages}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.onPrimary}
              />
            </View>

            <View style={[s.row, { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={s.rowLabelGroup}>
                <Text style={[s.rowLabel, { color: palette.text }]}>Calls</Text>
                <Text style={[s.rowSub, { color: palette.subtext }]}>Incoming voice and video calls</Text>
              </View>
              <Switch
                value={notifCalls}
                onValueChange={setNotifCalls}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.onPrimary}
              />
            </View>

            <View style={[s.row, { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={s.rowLabelGroup}>
                <Text style={[s.rowLabel, { color: palette.text }]}>Bible Updates</Text>
                <Text style={[s.rowSub, { color: palette.subtext }]}>Daily verse and reading reminders</Text>
              </View>
              <Switch
                value={notifBible}
                onValueChange={setNotifBible}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.onPrimary}
              />
            </View>

            <View style={[s.row, { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={s.rowLabelGroup}>
                <Text style={[s.rowLabel, { color: palette.text }]}>Feed Updates</Text>
                <Text style={[s.rowSub, { color: palette.subtext }]}>Broadcasts and channel posts</Text>
              </View>
              <Switch
                value={notifFeed}
                onValueChange={setNotifFeed}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.onPrimary}
              />
            </View>

            <View style={[s.row, { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={s.rowLabelGroup}>
                <Text style={[s.rowLabel, { color: palette.text }]}>Health Reminders</Text>
                <Text style={[s.rowSub, { color: palette.subtext }]}>Appointments and health updates</Text>
              </View>
              <Switch
                value={notifHealth}
                onValueChange={setNotifHealth}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.onPrimary}
              />
            </View>
          </View>
        </ScrollView>

        {/* Save button */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <KISButton
            title={saving ? 'Saving…' : 'Save'}
            disabled={saving}
            onPress={handleSave}
            variant="primary"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, responsive: ResponsiveLayout) {
  const gutter = responsive.pageGutter;
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: gutter,
      paddingTop: 12,
      paddingBottom: 12,
      minHeight: responsive.minTouchTarget,
      borderBottomWidth: 1,
    },
    backBtn: { width: 60, minHeight: responsive.minTouchTarget, justifyContent: 'center' },
    backText: { fontSize: responsive.bodyFontSize, fontWeight: '600' },
    headerTitle: {
      flex: 1,
      fontSize: responsive.bodyFontSize + 3,
      fontWeight: '800',
      textAlign: 'center',
    },
    content: { padding: gutter, gap: 16, paddingBottom: 24 },
    section: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      gap: 10,
    },
    sectionTitle: { fontSize: responsive.bodyFontSize, fontWeight: '800' },
    sectionDesc: { fontSize: responsive.labelFontSize, lineHeight: 18 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
      minHeight: responsive.minTouchTarget,
    },
    rowLabelGroup: { flex: 1, marginRight: 12 },
    rowLabel: { fontSize: responsive.bodyFontSize - 1, fontWeight: '600' },
    rowSub: { fontSize: responsive.labelFontSize, marginTop: 2 },
    timeRow: { flexDirection: 'row', gap: 12 },
    timeField: { flex: 1, gap: 6 },
    timeLabel: { fontSize: responsive.labelFontSize, fontWeight: '700' },
    timeInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: responsive.minTouchTarget,
      fontSize: responsive.bodyFontSize + 1,
      fontWeight: '700',
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
}
