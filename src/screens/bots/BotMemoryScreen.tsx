// src/screens/bots/BotMemoryScreen.tsx
// Bot Platform Phase 4 — a bot's own operational memory: short notes
// its AI decision step accumulates while operating, distinct from
// Knowledge (owner-supplied reference material). Off by default; an
// owner must explicitly enable it, decide how long notes are kept,
// and separately decide whether raw conversation content may ever be
// retained at all (also off by default). Every note is inspectable
// and deletable, individually or all at once.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { putData } from '@/network/put';
import { deleteRequest } from '@/network/delete';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

type Config = { enabled: boolean; allow_message_content: boolean; retention_days: number };
type Entry = { id: string; subject_user_id: string | null; content: string; source: string; created_at: string; expires_at: string | null };

function SectionCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: any }) {
  return (
    <View style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, borderRadius: 18, padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: '900', color: palette.text }}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange, palette }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; palette: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>{label}</Text>
        <Text style={{ fontSize: 11, color: palette.subtext }}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function BotMemoryScreen() {
  const { palette } = useKISTheme();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;
  const botName: string = route.params?.botName ?? 'Bot';

  const [config, setConfig] = useState<Config | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retentionInput, setRetentionInput] = useState('30');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [configRes, entriesRes] = await Promise.all([
      getRequest(ROUTES.bots.memoryConfig(botId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.memoryEntries(botId), { forceNetwork: isRefresh }),
    ]);
    if (configRes?.success) {
      setConfig(configRes.data);
      setRetentionInput(String(configRes.data?.retention_days ?? 30));
    }
    if (entriesRes?.success) setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
    setLoading(false);
    setRefreshing(false);
  }, [botId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const updateConfig = async (patch: Partial<Config>) => {
    const res: any = await putData(ROUTES.bots.memoryConfig(botId), patch);
    if (res?.success) setConfig(res.data);
  };

  const handleSaveRetention = async () => {
    const days = parseInt(retentionInput || '30', 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      Alert.alert('Invalid retention period', 'Enter a number of days between 1 and 365.');
      return;
    }
    await updateConfig({ retention_days: days });
  };

  const handleDeleteEntry = (entry: Entry) => {
    Alert.alert('Delete this memory?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRequest(ROUTES.bots.memoryEntryDetail(botId, entry.id)); void load(true); } },
    ]);
  };

  const handleDeleteAll = () => {
    Alert.alert('Delete all memory?', 'This bot will forget everything it has remembered so far.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: async () => { await deleteRequest(ROUTES.bots.memoryEntries(botId)); void load(true); } },
    ]);
  };

  if (loading || !config) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primaryStrong} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: palette.text }}>{botName}'s memory</Text>
        <Text style={{ fontSize: 13, color: palette.subtext }}>
          Short notes this bot's AI decision keeps between events (e.g. "this member asked about volunteering") -
          separate from Knowledge, and off by default. Enabling this never retains raw message content on its own.
        </Text>

        <SectionCard title="Settings" palette={palette}>
          <ToggleRow
            label="Enable memory" hint="Let this bot remember short notes from its own AI decisions."
            value={config.enabled} onChange={(v) => updateConfig({ enabled: v })} palette={palette}
          />
          <ToggleRow
            label="Allow message content" hint="Only if enabled separately - lets remembered notes include raw conversation text."
            value={config.allow_message_content} onChange={(v) => updateConfig({ allow_message_content: v })} palette={palette}
          />
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text, marginTop: 4 }}>Keep memory for (days)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <KISTextInput value={retentionInput} onChangeText={setRetentionInput} keyboardType="number-pad" />
            </View>
            <KISButton title="Save" size="sm" onPress={handleSaveRetention} />
          </View>
        </SectionCard>

        <SectionCard title={`Remembered notes (${entries.length})`} palette={palette}>
          {entries.length === 0 ? (
            <Text style={{ fontSize: 13, color: palette.subtext }}>Nothing remembered yet.</Text>
          ) : (
            <>
              {entries.map((e) => (
                <View key={e.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.divider }}>
                  <Text style={{ fontSize: 13, color: palette.text }}>{e.content}</Text>
                  <Text style={{ fontSize: 11, color: palette.subtext }}>
                    {new Date(e.created_at).toLocaleDateString()} · {e.subject_user_id ? 'About a specific person' : 'General note'}
                  </Text>
                  <KISButton title="Delete" size="sm" variant="outline" onPress={() => handleDeleteEntry(e)} />
                </View>
              ))}
              <KISButton title="Delete all memory" variant="danger" onPress={handleDeleteAll} />
            </>
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
