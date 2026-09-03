// Call delivery diagnostics — see callDiagnostics.ts. Reachable via a
// long-press on the Calls tab header (see CallsTab.tsx), deliberately not a
// prominent nav item: this needs to work on the real signed release build
// testers actually install, not just __DEV__ builds, so it can't be gated
// behind __DEV__ — but it also shouldn't be advertised to ordinary users.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { openSettings } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { useSocket } from '../../../SocketProvider';
import { callKeepAvailable } from '@/services/calls/callKitService';
import { getCallDiagnostics, clearCallDiagnostics, type CallDiagnosticEvent } from '@/services/calls/callDiagnostics';

const PENDING_KEYS = {
  django: 'KIS_PENDING_PUSH_TOKEN',
  nest: 'KIS_PENDING_NEST_PUSH_TOKEN',
  voip: 'KIS_PENDING_VOIP_PUSH_TOKEN',
} as const;

type PendingState = Record<keyof typeof PENDING_KEYS, boolean>;

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const { palette } = useKISTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: ok === false ? palette.danger : palette.text }]}>{value}</Text>
    </View>
  );
}

export default function CallDiagnosticsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = useKISTheme();
  const { isConnected, currentUserId } = useSocket();
  const [events, setEvents] = useState<CallDiagnosticEvent[]>([]);
  const [pending, setPending] = useState<PendingState>({ django: false, nest: false, voip: false });

  const refresh = useCallback(async () => {
    const [evs, django, nest, voip] = await Promise.all([
      getCallDiagnostics(),
      AsyncStorage.getItem(PENDING_KEYS.django),
      AsyncStorage.getItem(PENDING_KEYS.nest),
      AsyncStorage.getItem(PENDING_KEYS.voip),
    ]);
    setEvents(evs);
    setPending({ django: !!django, nest: !!nest, voip: !!voip });
  }, []);

  useEffect(() => { if (visible) void refresh(); }, [visible, refresh]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Call Diagnostics</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: palette.primary, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={[styles.section, { color: palette.subtext }]}>CURRENT STATE</Text>
          <Row label="Socket" value={isConnected ? 'Connected' : 'Disconnected'} ok={isConnected} />
          <Row label="User" value={currentUserId ? String(currentUserId).slice(0, 8) + '…' : 'Not signed in'} />
          <Row label="CallKeep available" value={callKeepAvailable ? 'Yes' : 'No'} ok={callKeepAvailable} />
          <Row
            label="Push registration pending"
            value={
              !pending.django && !pending.nest && !pending.voip
                ? 'None (all confirmed)'
                : `${pending.django ? 'Django ' : ''}${pending.nest ? 'Nest ' : ''}${pending.voip ? 'VoIP' : ''}`.trim()
            }
            ok={!pending.django && !pending.nest && !pending.voip}
          />

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.section, { color: palette.subtext }]}>RECENT CALL EVENTS (newest first)</Text>
            <Pressable onPress={async () => { await clearCallDiagnostics(); void refresh(); }}>
              <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Clear</Text>
            </Pressable>
          </View>

          {events.length === 0 ? (
            <Text style={[styles.empty, { color: palette.subtext }]}>No call events recorded yet.</Text>
          ) : (
            events.map((e, i) => (
              <View key={i} style={[styles.eventRow, { borderColor: palette.inputBorder }]}>
                <Text style={[styles.eventStage, { color: palette.text }]}>{e.stage}</Text>
                <Text style={[styles.eventMeta, { color: palette.subtext }]}>
                  {new Date(e.at).toLocaleTimeString()}
                  {e.callId ? ` · call ${e.callId.slice(0, 10)}…` : ''}
                  {e.callType ? ` · ${e.callType}` : ''}
                  {e.detail ? ` · ${e.detail}` : ''}
                </Text>
              </View>
            ))
          )}

          <Pressable onPress={refresh} style={[styles.refreshBtn, { borderColor: palette.inputBorder }]}>
            <Text style={{ color: palette.primary, fontWeight: '700' }}>Refresh</Text>
          </Pressable>

          {Platform.OS === 'android' && (
            <View style={styles.batteryNote}>
              <Text style={[styles.section, { color: palette.subtext }]}>BACKGROUND CALLING ON THIS DEVICE</Text>
              <Text style={[styles.batteryText, { color: palette.subtext }]}>
                Some Android manufacturers (Infinix/XOS, Xiaomi/MIUI, Samsung, Huawei among others)
                aggressively kill background apps or block their notifications by default,
                which can stop KIS from ringing when it isn't open. If calls aren't waking this
                device reliably, open Settings and disable battery optimization / enable
                autostart for KIS.
              </Text>
              <Pressable
                onPress={() => openSettings().catch(() => {})}
                style={[styles.refreshBtn, { borderColor: palette.inputBorder, marginTop: 8 }]}
              >
                <Text style={{ color: palette.primary, fontWeight: '700' }}>Open App Settings</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800' },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  eventRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  eventStage: { fontSize: 13, fontWeight: '700' },
  eventMeta: { fontSize: 11, marginTop: 2 },
  refreshBtn: { marginTop: 16, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  batteryNote: { marginTop: 8 },
  batteryText: { fontSize: 12, lineHeight: 18 },
});
