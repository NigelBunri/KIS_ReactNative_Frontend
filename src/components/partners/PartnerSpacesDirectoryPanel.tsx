// src/components/partners/PartnerSpacesDirectoryPanel.tsx
//
// Community Governance > Spaces Directory — every community, group, and
// channel in the organization in one searchable list. No new backend:
// PartnersScreen already loads all three lists for the sidebar, so this
// panel just takes them as props and reuses the same select handlers
// that already navigate to a space (onChannelPress etc.).
import React, { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import type { PartnerChannel, PartnerCommunity, PartnerGroup } from '@/components/partners/partnersTypes';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  channels: PartnerChannel[];
  groups: PartnerGroup[];
  communities: PartnerCommunity[];
  onSelectChannel: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onSelectCommunity: (id: string) => void;
  onClose: () => void;
};

type SpaceKind = 'channel' | 'group' | 'community';
type SpaceRow = { id: string; name: string; kind: SpaceKind };

const KIND_META: Record<SpaceKind, { label: string; icon: string }> = {
  channel: { label: 'Channel', icon: '#' },
  group: { label: 'Group', icon: '👥' },
  community: { label: 'Community', icon: '🏛️' },
};

export default function PartnerSpacesDirectoryPanel({
  isOpen, panelWidth, panelTranslateX, channels, groups, communities,
  onSelectChannel, onSelectGroup, onSelectCommunity, onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<SpaceKind | 'all'>('all');

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const rows: SpaceRow[] = useMemo(() => {
    const all: SpaceRow[] = [
      ...(communities || []).map((c) => ({ id: c.id, name: c.name, kind: 'community' as const })),
      ...(groups || []).map((g) => ({ id: g.id, name: g.name, kind: 'group' as const })),
      ...(channels || []).map((c) => ({ id: c.id, name: c.name, kind: 'channel' as const })),
    ];
    const q = query.trim().toLowerCase();
    return all
      .filter((row) => kindFilter === 'all' || row.kind === kindFilter)
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [channels, groups, communities, query, kindFilter]);

  const selectRow = (row: SpaceRow) => {
    onClose();
    if (row.kind === 'channel') onSelectChannel(row.id);
    else if (row.kind === 'group') onSelectGroup(row.id);
    else onSelectCommunity(row.id);
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Spaces Directory</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Every community, group, and channel</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search spaces…"
            placeholderTextColor={palette.subtext}
            style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, marginTop: 0, marginBottom: 10 }]}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {(['all', 'community', 'group', 'channel'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKindFilter(k)}
                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: kindFilter === k ? palette.primary : palette.borderMuted }}
              >
                <Text style={{ color: kindFilter === k ? palette.primary : palette.text, fontSize: 12 }}>
                  {k === 'all' ? 'All' : `${KIND_META[k].label}s`}
                </Text>
              </Pressable>
            ))}
          </View>

          {rows.length === 0 ? (
            <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No spaces match.</Text>
          ) : (
            rows.map((row) => (
              <Pressable
                key={`${row.kind}-${row.id}`}
                onPress={() => selectRow(row)}
                style={({ pressed }) => [
                  styles.settingsFeatureRow,
                  { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 6, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={{ fontSize: 16, marginRight: 10 }}>{KIND_META[row.kind].icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]} numberOfLines={1}>{row.name}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{KIND_META[row.kind].label}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
