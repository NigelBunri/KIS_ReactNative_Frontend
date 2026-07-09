import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Connections'>;

type TabKey = 'mine' | 'requests' | 'discover';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine', label: 'My Network' },
  { key: 'requests', label: 'Requests' },
  { key: 'discover', label: 'Discover People' },
];

type Connection = {
  id: string;
  from_user_id?: string;
  to_user_id?: string;
  status?: string;
  from_user?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    headline?: string | null;
  };
  to_user?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    headline?: string | null;
  };
};

type SuggestedUser = {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
  headline?: string | null;
};

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
};

export default function ConnectionsScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [activeTab, setActiveTab] = useState<TabKey>(route.params?.tab ?? 'mine');

  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  const [requests, setRequests] = useState<Connection[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pendingConnections, setPendingConnections] = useState<Set<string>>(new Set());

  const fetchMyConnections = useCallback(async () => {
    const res = await getRequest(`${ROUTES.connections.list}?status=accepted`, {
      errorMessage: 'Unable to load connections.',
    });
    const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
    setMyConnections(Array.isArray(list) ? list : []);
  }, []);

  const fetchRequests = useCallback(async () => {
    const res = await getRequest(`${ROUTES.connections.list}?status=pending`, {
      errorMessage: 'Unable to load requests.',
    });
    const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
    setRequests(Array.isArray(list) ? list : []);
  }, []);

  const fetchSuggestions = useCallback(async () => {
    const res = await getRequest(ROUTES.connections.peopleYouMayKnow, {
      errorMessage: 'Unable to load suggestions.',
    });
    const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
    setSuggestions(Array.isArray(list) ? list : []);
  }, []);

  const loadTab = useCallback(async (tab: TabKey, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (tab === 'mine') await fetchMyConnections();
      else if (tab === 'requests') await fetchRequests();
      else await fetchSuggestions();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMyConnections, fetchRequests, fetchSuggestions]);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const handleRemove = useCallback((connection: Connection) => {
    Alert.alert('Remove connection', 'Remove this person from your network?', [
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActionLoadingId(connection.id);
          try {
            await deleteRequest(ROUTES.connections.detail(connection.id), {
              errorMessage: 'Could not remove connection.',
            });
            setMyConnections(prev => prev.filter(c => c.id !== connection.id));
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? 'Please try again.');
          } finally {
            setActionLoadingId(null);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const handleAccept = useCallback(async (connection: Connection) => {
    setActionLoadingId(connection.id);
    try {
      await patchRequest(ROUTES.connections.detail(connection.id), { status: 'accepted' });
      setRequests(prev => prev.filter(c => c.id !== connection.id));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleDecline = useCallback(async (connection: Connection) => {
    setActionLoadingId(connection.id);
    try {
      await patchRequest(ROUTES.connections.detail(connection.id), { status: 'rejected' });
      setRequests(prev => prev.filter(c => c.id !== connection.id));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleConnect = useCallback(async (user: SuggestedUser) => {
    setActionLoadingId(user.id);
    try {
      await postRequest(ROUTES.connections.list, { user_id: user.id });
      setPendingConnections(prev => new Set(prev).add(user.id));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const getOtherUser = (connection: Connection) => {
    return connection.from_user ?? connection.to_user ?? null;
  };

  const renderMyConnection = ({ item }: { item: Connection }) => {
    const user = getOtherUser(item);
    const name = user?.display_name ?? 'Unknown';
    const initials = getInitials(name);
    const isLoading = actionLoadingId === item.id;
    return (
      <View style={[styles.userCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={[styles.avatarText, { color: palette.onPrimary }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: palette.text }]}>{name}</Text>
          {user?.headline ? (
            <Text style={[styles.userHeadline, { color: palette.subtext }]} numberOfLines={1}>
              {user.headline}
            </Text>
          ) : null}
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => {
              const otherUser = getOtherUser(item);
              DeviceEventEmitter.emit('chat.open', {
                userId: otherUser?.id ?? '',
                name: otherUser?.display_name ?? '',
                kind: 'dm',
              });
            }}
          >
            <Text style={[styles.smallBtnText, { color: palette.text }]}>Message</Text>
          </Pressable>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => handleRemove(item)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.subtext} />
            ) : (
              <Text style={[styles.smallBtnText, { color: palette.subtext }]}>Remove</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: Connection }) => {
    const user = item.from_user ?? null;
    const name = user?.display_name ?? 'Unknown';
    const initials = getInitials(name);
    const isLoading = actionLoadingId === item.id;
    return (
      <View style={[styles.userCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={[styles.avatarText, { color: palette.onPrimary }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: palette.text }]}>{name}</Text>
          {user?.headline ? (
            <Text style={[styles.userHeadline, { color: palette.subtext }]} numberOfLines={1}>
              {user.headline}
            </Text>
          ) : null}
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: palette.primary }]}
            onPress={() => handleAccept(item)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.onPrimary} />
            ) : (
              <Text style={[styles.smallBtnText, { color: palette.onPrimary }]}>Accept</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => handleDecline(item)}
            disabled={isLoading}
          >
            <Text style={[styles.smallBtnText, { color: palette.subtext }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSuggestion = ({ item }: { item: SuggestedUser }) => {
    const name = item.display_name ?? 'Unknown';
    const initials = getInitials(name);
    const isLoading = actionLoadingId === item.id;
    const isPending = pendingConnections.has(item.id);
    return (
      <View style={[styles.userCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={[styles.avatarText, { color: palette.onPrimary }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: palette.text }]}>{name}</Text>
          {item.headline ? (
            <Text style={[styles.userHeadline, { color: palette.subtext }]} numberOfLines={1}>
              {item.headline}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.smallBtn,
            {
              backgroundColor: isPending ? palette.surface : palette.primary,
              borderColor: palette.border,
            },
          ]}
          onPress={() => !isPending && handleConnect(item)}
          disabled={isLoading || isPending}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={[styles.smallBtnText, { color: isPending ? palette.subtext : palette.onPrimary }]}>
              {isPending ? 'Pending' : 'Connect'}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  const activeData =
    activeTab === 'mine' ? myConnections :
    activeTab === 'requests' ? requests :
    suggestions;

  const activeRender =
    activeTab === 'mine' ? renderMyConnection :
    activeTab === 'requests' ? renderRequest :
    renderSuggestion;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { width: responsive.minTouchTarget, height: responsive.minTouchTarget }]}
        >
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text, fontSize: responsive.headerTitleSize }]}>Network</Text>
        <View style={{ width: responsive.minTouchTarget }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: palette.divider }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabItem, active && { borderBottomColor: palette.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, { color: active ? palette.primary : palette.subtext }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={activeData as any[]}
          keyExtractor={(item) => item.id}
          renderItem={activeRender as any}
          contentContainerStyle={{ padding: responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTab(activeTab, true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <KISIcon name="people" size={40} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                {activeTab === 'mine'
                  ? 'No connections yet'
                  : activeTab === 'requests'
                  ? 'No pending requests'
                  : 'No suggestions right now'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 16,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  userHeadline: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallBtn: {
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
