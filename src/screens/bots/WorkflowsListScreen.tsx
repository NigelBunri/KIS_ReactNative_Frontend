// src/screens/bots/WorkflowsListScreen.tsx
// Lists one bot's no-code workflows (Phase 2) — reached from
// BotDetailScreen. Every workflow here is scoped to exactly one of the
// bot's own resource grants; creating/publishing/pausing all happens
// server-side with the same enforcement as any other bot action.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { MainTabStateBlock } from '@/components/common/MainTabScaffold';

type Workflow = {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'deleted';
  trigger_type: string;
  version: number;
  last_run_at: string | null;
};

const STATUS_COLOR: Record<string, 'success' | 'subtext' | 'gold'> = {
  active: 'success',
  draft: 'subtext',
  paused: 'gold',
};

const TRIGGER_LABEL: Record<string, string> = {
  'message.created': 'New message',
  'member.joined': 'Member joined',
  'member.left': 'Member left',
  schedule: 'Scheduled',
};

export default function WorkflowsListScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;
  const botName: string | undefined = route.params?.botName;

  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const res = await getRequest(ROUTES.bots.workflows(botId), { forceNetwork: isRefresh });
    if (res?.success) setWorkflows(Array.isArray(res.data) ? res.data : []);
    else setWorkflows((prev) => prev ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [botId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const statusColor = (status: string) => (palette as any)[STATUS_COLOR[status] ?? 'subtext'] ?? palette.subtext;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: responsive.pageGutter,
          paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: palette.text }}>Workflows</Text>
          {botName ? <Text style={{ fontSize: 12, color: palette.subtext }}>{botName}</Text> : null}
        </View>
        <View style={{ width: 28 }} />
      </View>

      {loading && workflows === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : (
        <FlatList
          data={workflows ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap, flexGrow: 1 }}
          ListEmptyComponent={
            <MainTabStateBlock
              icon="bolt"
              title="No workflows yet"
              message="Create a no-code workflow to automate welcome messages, auto-replies, moderation and more — no programming needed."
              actionLabel="Create your first workflow"
              onAction={() => navigation.navigate('WorkflowBuilder', { botId, botName })}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('WorkflowDetail', { botId, workflowId: item.id, name: item.name })}
              style={{
                borderWidth: 1, borderColor: palette.divider, borderRadius: 18, backgroundColor: palette.card,
                padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View
                style={{
                  width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primarySoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <KISIcon name="bolt" size={20} color={palette.primaryStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 2 }}>
                  {TRIGGER_LABEL[item.trigger_type] ?? item.trigger_type} · v{item.version}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                  backgroundColor: `${statusColor(item.status)}1A`,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor(item.status) }}>{item.status}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {workflows && workflows.length > 0 ? (
        <View style={{ padding: responsive.pageGutter }}>
          <KISButton
            title="Create a new workflow"
            onPress={() => navigation.navigate('WorkflowBuilder', { botId, botName })}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
