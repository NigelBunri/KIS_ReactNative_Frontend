// src/screens/broadcast/channels/studio/MembershipPerksEditor.tsx
//
// Inline editor for the perks string-array on a membership tier.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { patchRequest } from '@/network/patch';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  tierId: string;
  tierTitle: string;
  initialPerks: string[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MembershipPerksEditor({ tierId, tierTitle, initialPerks }: Props) {
  const { palette } = useKISTheme();
  const [perks, setPerks] = useState<string[]>(initialPerks);
  const [newPerk, setNewPerk] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const addPerk = useCallback(() => {
    const trimmed = newPerk.trim();
    if (!trimmed) return;
    setPerks(prev => [...prev, trimmed]);
    setNewPerk('');
    setDirty(true);
  }, [newPerk]);

  const removePerk = useCallback((idx: number) => {
    setPerks(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await patchRequest(
        ROUTES.broadcasts.membershipTier(tierId),
        { perks },
        { errorMessage: 'Could not save perks.' },
      );
      setDirty(false);
      Alert.alert('Saved', 'Membership perks updated.');
    } catch {
      Alert.alert('Error', 'Could not save perks. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [perks, tierId]);

  return (
    <View style={[styles.container, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <Text style={[styles.heading, { color: palette.text }]}>
        Perks — {tierTitle}
      </Text>

      {perks.length === 0 && (
        <Text style={[styles.emptyText, { color: palette.subtext }]}>No perks added yet.</Text>
      )}

      {perks.map((perk, idx) => (
        <View
          key={idx}
          style={[styles.perkRow, { borderColor: palette.border }]}
        >
          <Text style={[styles.perkBullet, { color: palette.primaryStrong }]}>•</Text>
          <Text style={[styles.perkText, { color: palette.text, flex: 1 }]}>{perk}</Text>
          <Text
            onPress={() => removePerk(idx)}
            style={[styles.removeBtn, { color: '#EF4444' }]}
          >
            ✕
          </Text>
        </View>
      ))}

      {/* Add perk */}
      <View style={styles.addRow}>
        <TextInput
          value={newPerk}
          onChangeText={setNewPerk}
          placeholder="Add a perk..."
          placeholderTextColor={palette.subtext}
          onSubmitEditing={addPerk}
          returnKeyType="done"
          style={[styles.addInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
        />
        <Text
          onPress={addPerk}
          style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
        >
          Add
        </Text>
      </View>

      {/* Save */}
      {dirty && (
        <Text
          onPress={saving ? undefined : handleSave}
          style={[styles.saveBtn, { backgroundColor: palette.text, opacity: saving ? 0.5 : 1 }]}
        >
          {saving ? (
            'Saving...'
          ) : (
            'Save Perks'
          )}
        </Text>
      )}
      {saving && (
        <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 4 }} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  heading: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  emptyText: { fontSize: 12, fontWeight: '600' },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  perkBullet: { fontSize: 16, fontWeight: '900' },
  perkText: { fontSize: 13, fontWeight: '700' },
  removeBtn: { fontSize: 13, fontWeight: '900', paddingHorizontal: 4 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    overflow: 'hidden',
  },
  saveBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
    overflow: 'hidden',
  },
});
