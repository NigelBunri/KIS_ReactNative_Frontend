// src/screens/bots/BotsHomeScreen.tsx
// KIS Bot Platform entry point — reached from the Profile tab's "Bot
// Platform" quick action (ProfileScreen.tsx's accountQuickActionItems).
// Eligibility (Business tier and above, apps.bots.services.
// ensure_bot_platform_eligible) is enforced entirely server-side; this
// screen simply surfaces whatever the API returns, including a clear
// 403 upgrade message for an ineligible account rather than trying to
// duplicate that decision on-device.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { MainTabStateBlock } from '@/components/common/MainTabScaffold';

type BotSummary = {
  id: string;
  name: string;
  handle: string;
  status: 'draft' | 'active' | 'paused' | 'suspended' | 'disconnected' | 'deleted';
  kind: string;
  resource_count: number;
};

const STATUS_COLOR: Record<string, 'success' | 'subtext' | 'danger' | 'gold'> = {
  active: 'success',
  draft: 'subtext',
  paused: 'gold',
  suspended: 'danger',
  disconnected: 'danger',
};

export default function BotsHomeScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();

  const [bots, setBots] = useState<BotSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ineligible, setIneligible] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setIneligible(false);
    const res = await getRequest(ROUTES.bots.list, { forceNetwork: isRefresh });
    if (res?.success) {
      setBots(Array.isArray(res.data) ? res.data : []);
    } else if (res?.status === 403) {
      setIneligible(true);
      setBots([]);
    } else {
      setBots((prev) => prev ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const statusColor = (status: string) => {
    const key = STATUS_COLOR[status] ?? 'subtext';
    return (palette as any)[key] ?? palette.subtext;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: responsive.pageGutter,
          paddingTop: 10,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }}>
          Bot Platform
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && bots === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : ineligible ? (
        <View style={{ padding: responsive.pageGutter }}>
          <MainTabStateBlock
            icon="sparkles"
            title="Upgrade to create bots"
            message="The Bot Platform is available on Business plans and above. Upgrade your plan to create and manage your own bots."
            actionLabel="View plans"
            onAction={() => navigation.navigate('Profile')}
          />
        </View>
      ) : (
        <FlatList
          data={bots ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap, flexGrow: 1 }}
          ListEmptyComponent={
            <MainTabStateBlock
              icon="sparkles"
              title="No bots yet"
              message="Create a bot to automate welcome messages, FAQs, or connect your own custom or AI-powered integration."
              actionLabel="Create your first bot"
              onAction={() => navigation.navigate('CreateBot')}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('BotDetail', { botId: item.id, name: item.name })}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 18,
                backgroundColor: palette.card,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: palette.primarySoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <KISIcon name="sparkles" size={20} color={palette.primaryStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 2 }}>
                  @{item.handle} · {item.resource_count} resource{item.resource_count === 1 ? '' : 's'}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                  backgroundColor: `${statusColor(item.status)}1A`,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor(item.status) }}>
                  {item.status}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {!ineligible && bots && bots.length > 0 ? (
        <View style={{ padding: responsive.pageGutter }}>
          <KISButton title="Create a new bot" onPress={() => navigation.navigate('CreateBot')} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
