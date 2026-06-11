// src/screens/broadcast/channels/studio/SimulcastPanel.tsx
//
// SimulCast (multi-stream) manager — manage RTMP targets for a live stream.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type TargetStatus = 'idle' | 'streaming' | 'error';

type SimulcastTarget = {
  id: string;
  platform: string;
  label: string;
  rtmp_url?: string;
  status: TargetStatus;
};

type Platform = 'YouTube' | 'Twitch' | 'Facebook' | 'Instagram' | 'TikTok' | 'Custom';

type Props = {
  streamId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = ['YouTube', 'Twitch', 'Facebook', 'Instagram', 'TikTok', 'Custom'];

const PLATFORM_SHORT: Record<Platform, string> = {
  YouTube: 'YT',
  Twitch: 'TW',
  Facebook: 'FB',
  Instagram: 'IG',
  TikTok: 'TK',
  Custom: '~',
};

const STATUS_COLOR: Record<TargetStatus, string> = {
  idle: '#94A3B8',
  streaming: '#22C55E',
  error: '#EF4444',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SimulcastPanel({ streamId }: Props) {
  const { palette } = useKISTheme();
  const [targets, setTargets] = useState<SimulcastTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Form state
  const [formPlatform, setFormPlatform] = useState<Platform>('YouTube');
  const [formLabel, setFormLabel] = useState('');
  const [formRtmp, setFormRtmp] = useState('');
  const [formKey, setFormKey] = useState('');

  const fetchTargets = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.liveStreamSimulcast(streamId),
        { errorMessage: '' },
      );
      const raw: SimulcastTarget[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setTargets(raw);
    } catch {
      // silently fail — list may be empty on first open
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    void fetchTargets();
  }, [fetchTargets]);

  const resetForm = () => {
    setFormPlatform('YouTube');
    setFormLabel('');
    setFormRtmp('');
    setFormKey('');
  };

  const handleAdd = useCallback(async () => {
    if (!formRtmp.trim()) {
      Alert.alert('RTMP URL required', 'Please enter the RTMP ingest URL.');
      return;
    }
    if (!formKey.trim()) {
      Alert.alert('Stream Key required', 'Please enter the stream key.');
      return;
    }
    setAdding(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.liveStreamSimulcast(streamId),
        {
          platform: formPlatform,
          label: formLabel.trim() || formPlatform,
          rtmp_url: formRtmp.trim(),
          stream_key: formKey.trim(),
        },
        { errorMessage: 'Could not add target.' },
      );
      if (res?.data || res?.id) {
        resetForm();
        setShowForm(false);
        await fetchTargets();
      } else {
        Alert.alert('Error', res?.message ?? 'Could not add simulcast target.');
      }
    } catch {
      Alert.alert('Error', 'Could not add simulcast target. Please try again.');
    } finally {
      setAdding(false);
    }
  }, [fetchTargets, formKey, formLabel, formPlatform, formRtmp, streamId]);

  const handleRemove = useCallback(async (target: SimulcastTarget) => {
    Alert.alert('Remove target?', `Remove "${target.label}" from simulcast?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(target.id);
          try {
            await postRequest(
              `${ROUTES.broadcasts.liveStreamSimulcast(streamId)}${target.id}/remove/`,
              {},
              { errorMessage: '' },
            ).catch(() => {});
            await fetchTargets();
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  }, [fetchTargets, streamId]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      {/* Info note */}
      <View style={[styles.noteRow, { backgroundColor: palette.surfaceElevated ?? palette.card, borderColor: palette.border }]}>
        <Text style={[styles.noteText, { color: palette.subtext }]}>
          These targets will receive your stream when you go live.
        </Text>
      </View>

      {/* Add Target button */}
      <Pressable
        onPress={() => setShowForm(prev => !prev)}
        style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
      >
        <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Add Target'}</Text>
      </Pressable>

      {/* Add form */}
      {showForm && (
        <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Simulcast Target</Text>

          {/* Platform selector */}
          <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Platform</Text>
          <View style={styles.platformRow}>
            {PLATFORMS.map(p => {
              const active = formPlatform === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setFormPlatform(p)}
                  style={[
                    styles.platformPill,
                    {
                      backgroundColor: active ? palette.primaryStrong : palette.surface,
                      borderColor: active ? palette.primaryStrong : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.platformPillText, { color: active ? '#fff' : palette.text }]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Label (optional)</Text>
          <TextInput
            value={formLabel}
            onChangeText={setFormLabel}
            placeholder={`My ${formPlatform} stream`}
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />

          <Text style={[styles.fieldLabel, { color: palette.subtext }]}>RTMP URL</Text>
          <TextInput
            value={formRtmp}
            onChangeText={setFormRtmp}
            placeholder="rtmp://live.example.com/app"
            placeholderTextColor={palette.subtext}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />

          <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Stream Key</Text>
          <TextInput
            value={formKey}
            onChangeText={setFormKey}
            placeholder="••••••••••••"
            placeholderTextColor={palette.subtext}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />

          <Pressable
            onPress={handleAdd}
            disabled={adding}
            style={[styles.submitBtn, { backgroundColor: palette.primaryStrong }]}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Add</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Target list */}
      {targets.length === 0 ? (
        <View style={[styles.emptyState, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No simulcast targets yet. Add one above.
          </Text>
        </View>
      ) : (
        targets.map(target => {
          const statusColor = STATUS_COLOR[target.status] ?? STATUS_COLOR.idle;
          const short = PLATFORM_SHORT[target.platform as Platform] ?? target.platform.slice(0, 2).toUpperCase();
          return (
            <View
              key={target.id}
              style={[styles.targetCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={[styles.platformIcon, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
                <Text style={[styles.platformIconText, { color: palette.primaryStrong }]}>
                  {short}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.targetLabel, { color: palette.text }]} numberOfLines={1}>
                  {target.label}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {target.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleRemove(target)}
                disabled={removingId === target.id}
                style={styles.removeBtn}
              >
                {removingId === target.id ? (
                  <ActivityIndicator size="small" color={palette.subtext} />
                ) : (
                  <Text style={[styles.removeBtnText, { color: '#EF4444' }]}>Remove</Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  noteRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  noteText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  addBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  formCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  formTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  platformPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  platformPillText: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  submitBtn: {
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformIconText: { fontSize: 13, fontWeight: '900' },
  targetLabel: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '800' },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  removeBtnText: { fontSize: 12, fontWeight: '800' },
  emptyState: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
