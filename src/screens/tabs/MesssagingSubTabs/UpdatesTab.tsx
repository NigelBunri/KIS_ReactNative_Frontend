import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Platform,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES, { buildMediaSource, useMediaHeaders } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import NewChannelForm from '@/Module/AddContacts/components/NewChannelForm';
import { Chat } from '@/Module/ChatRoom/messagesUtils';
import Skeleton from '@/components/common/Skeleton';
import KISText from '@/components/common/KISText';
import { launchImageLibrary } from 'react-native-image-picker';
import { refreshFromDeviceAndBackendWithOptions } from '@/Module/AddContacts/contactsService';
import { useSocket } from '../../../../SocketProvider';
import Video from 'react-native-video';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';

type StatusItem = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  uri?: string;
  text?: string;
  durationMs?: number;
  viewed?: boolean;
  style?: {
    bgColor?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
  };
};

type StatusUser = {
  id: string;
  name: string;
  avatar?: string;
  items: StatusItem[];
  userId?: string;
  hasUnseen?: boolean;
};

const SAMPLE_STATUSES: StatusUser[] = [];

const itemDuration = (item: StatusItem) => item.durationMs ?? 5000;

type UpdatesTabProps = {
  searchTerm?: string;
  onOpenChat?: (chat: Chat) => void;
};

export default function UpdatesTab({ searchTerm = '', onOpenChat }: UpdatesTabProps) {
  const { palette } = useKISTheme();
  const { currentUserId } = useSocket();
  const STATUS_BG_COLORS = [
    '#0B1220',
    '#111827',
    '#1F2937',
    '#0F766E',
    '#14532D',
    '#1D4ED8',
    '#4C1D95',
    '#7C2D12',
    '#7F1D1D',
    '#0B3B5B',
  ];
  const STATUS_TEXT_COLORS = [
    '#FFFFFF',
    '#F9FAFB',
    '#E5E7EB',
    '#FDE68A',
    '#111827',
    '#0F172A',
  ];
  const STATUS_FONT_SIZES = [16, 18, 20, 24, 28];
  const STATUS_FONT_FAMILIES = [
    'System',
    'Georgia',
    'Times New Roman',
    'Courier New',
  ];
  const mediaHeaders = useMediaHeaders();
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [statusUsers, setStatusUsers] = useState<StatusUser[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusComposerOpen, setStatusComposerOpen] = useState(false);
  const [statusDraftText, setStatusDraftText] = useState('');
  const [statusDraftAssets, setStatusDraftAssets] = useState<any[]>([]);
  const [statusDraftType, setStatusDraftType] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [suppressMyOpen, setSuppressMyOpen] = useState(false);
  const suppressMyOpenRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const recorderRef = useRef(new AudioRecorderPlayer());
  const mediaDurationRef = useRef(0);
  const mediaFallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMediaProgressRef = useRef(0);
  const [mediaPaused, setMediaPaused] = useState(false);
  const [statusDraftStyle, setStatusDraftStyle] = useState({
    bgColor: STATUS_BG_COLORS[0],
    textColor: STATUS_TEXT_COLORS[0],
    fontSize: STATUS_FONT_SIZES[2],
    fontFamily: STATUS_FONT_FAMILIES[0],
  });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerProgress, setViewerProgress] = useState(0);
  const [pendingOpenUserId, setPendingOpenUserId] = useState<string | null>(null);
  const [viewedMap, setViewedMap] = useState<Record<string, number>>({});
  const [channelPreviewOpen, setChannelPreviewOpen] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<any | null>(null);
  const [channelSubscribing, setChannelSubscribing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const channelsLoadInFlightRef = useRef(false);
  const statusesLoadInFlightRef = useRef(false);
  const channelsLastLoadAtRef = useRef(0);
  const statusesLastLoadAtRef = useRef(0);

  const handleOpenChannel = useCallback(
    (channel: any) => {
      if (!onOpenChat) return;
      const isSubscribed = Boolean(
        channel?.is_subscribed ?? channel?.isSubscribed ?? false,
      );
      if (!isSubscribed) {
        setPreviewChannel(channel);
        setChannelPreviewOpen(true);
        return;
      }
      const conversationId =
        channel?.conversation_id ??
        channel?.conversationId ??
        channel?.conversation?.id ??
        channel?.conversation;
      if (!conversationId) {
        Alert.alert('Channel', 'No chat is linked to this channel yet.');
        return;
      }
      const chat: Chat = {
        id: String(conversationId),
        conversationId: String(conversationId),
        name: channel?.name ?? channel?.title ?? 'Channel',
        kind: 'channel',
        isGroup: true,
        isGroupChat: true,
        avatarUrl: channel?.avatar_url ?? undefined,
        groupId: channel?.id ?? undefined,
        canPost: channel?.can_post ?? channel?.canPost ?? undefined,
        isSubscribed: true,
      };
      onOpenChat(chat);
    },
    [onOpenChat],
  );

  const handleSubscribeChannel = useCallback(async () => {
    if (!previewChannel) return;
    setChannelSubscribing(true);
    const res = await postRequest(
      ROUTES.channels.subscribeChannel(String(previewChannel.id)),
      {},
      { errorMessage: 'Unable to subscribe to channel.' },
    );
    const ok = res?.success ?? true;
    if (!ok) {
      setChannelSubscribing(false);
      return;
    }
    setChannels((prev) =>
      prev.map((ch) =>
        String(ch.id) === String(previewChannel.id)
          ? {
              ...ch,
              is_subscribed: true,
              member_role: res?.data?.role ?? ch?.member_role,
            }
          : ch,
      ),
    );
    const next = {
      ...previewChannel,
      is_subscribed: true,
      member_role: res?.data?.role ?? previewChannel?.member_role,
    };
    setPreviewChannel(next);
    setChannelSubscribing(false);
    setChannelPreviewOpen(false);
    handleOpenChannel(next);
  }, [previewChannel, handleOpenChannel]);

  const loadChannels = useCallback(async () => {
    const now = Date.now();
    if (channelsLoadInFlightRef.current) return;
    if (now - channelsLastLoadAtRef.current < 15000) return;
    channelsLoadInFlightRef.current = true;
    channelsLastLoadAtRef.current = now;
    setChannelsLoading(true);
    const res = await getRequest(ROUTES.channels.getAllChannels, {
      errorMessage: 'Failed to load channels',
    });
    if (res?.success) {
      const list = res?.data?.results ?? res?.data ?? res ?? [];
      setChannels(Array.isArray(list) ? list : []);
    }
    setChannelsLoading(false);
    channelsLoadInFlightRef.current = false;
  }, []);

  React.useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const loadStatuses = useCallback(async () => {
    const now = Date.now();
    if (statusesLoadInFlightRef.current) return;
    if (now - statusesLastLoadAtRef.current < 15000) return;
    statusesLoadInFlightRef.current = true;
    statusesLastLoadAtRef.current = now;
    setStatusesLoading(true);
    try {
      const contacts = await refreshFromDeviceAndBackendWithOptions({});
      const visibleIds = contacts
        .filter((c) => c.isRegistered && c.userId)
        .map((c) => String(c.userId));

      if (currentUserId) visibleIds.push(String(currentUserId));
      const uniqueIds = Array.from(new Set(visibleIds));
      const qs = uniqueIds.length ? `?userIds=${uniqueIds.join(',')}` : '';
      const res = await getRequest(`${ROUTES.statuses.list}${qs}`);
      if (!res?.success) {
        if (Number(res?.status) === 429) return;
        throw new Error(res?.message || 'Unable to load statuses');
      }

      const list = res?.data?.results ?? [];
      const mapped = Array.isArray(list)
        ? list.map((entry: any) => ({
            id: String(entry?.user?.id ?? ''),
            userId: String(entry?.user?.id ?? ''),
            name: entry?.user?.display_name ?? 'User',
            avatar: entry?.user?.avatar_url ?? undefined,
            hasUnseen: Boolean(entry?.has_unseen),
            items: Array.isArray(entry?.items)
              ? entry.items.map((item: any) => ({
                  id: String(item.id),
                  type: item.type,
                  uri: item.file_url ?? undefined,
                  text: item.text ?? undefined,
                  durationMs: item.duration_ms ?? undefined,
                  style: item.style ?? undefined,
                  viewed: Boolean(item.viewed),
                }))
              : [],
          }))
        : [];

      const myItems = mapped.find((u) => u.userId === String(currentUserId))?.items ?? [];
      const otherUsers = mapped.filter((u) => u.userId !== String(currentUserId));

      const merged: StatusUser[] = [
        {
          id: 'me',
          userId: currentUserId ?? undefined,
          name: 'My status',
          items: myItems,
        },
        ...otherUsers,
      ];
      setStatusUsers(merged);
    } catch (e) {
      console.warn('[UpdatesTab] loadStatuses failed', e);
      setStatusUsers([{ id: 'me', name: 'My status', items: [] }]);
    } finally {
      setStatusesLoading(false);
      statusesLoadInFlightRef.current = false;
    }
  }, [currentUserId]);

  React.useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('status.open', (payload: any) => {
      const userId = String(payload?.userId ?? '');
      if (!userId) return;
      setPendingOpenUserId(userId);
    });
    return () => {
      sub.remove();
    };
  }, []);

  const statuses = useMemo(() => {
    if (!searchTerm.trim()) return statusUsers.length ? statusUsers : SAMPLE_STATUSES;
    const q = searchTerm.trim().toLowerCase();
    return (statusUsers.length ? statusUsers : SAMPLE_STATUSES).filter((s) => {
      if (s.id === 'me') return true;
      return s.name.toLowerCase().includes(q);
    });
  }, [searchTerm, statusUsers]);

  const activeUser = useMemo(
    () => statuses.find((u) => u.id === viewerUserId) ?? null,
    [viewerUserId, statuses],
  );

  const currentItem = activeUser?.items?.[viewerIndex] ?? null;
  const viewerMediaSource = buildMediaSource(currentItem?.uri, mediaHeaders);
  const resolveTextStyle = (item?: StatusItem) => ({
    bgColor: item?.style?.bgColor ?? palette.card,
    textColor: item?.style?.textColor ?? palette.text,
    fontSize: item?.style?.fontSize ?? 20,
    fontFamily: item?.style?.fontFamily ?? undefined,
  });
  const isMediaItem = currentItem?.type === 'video' || currentItem?.type === 'audio';

  const ensureMicPermission = useCallback(async () => {
    const perm =
      Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
    let status = await check(perm);
    if (status === RESULTS.DENIED) status = await request(perm);
    return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
  }, []);

  const startRecording = useCallback(async () => {
    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert('Microphone', 'Please allow microphone access to record audio.');
      return;
    }
    setRecordingMs(0);
    setIsRecording(true);
    const path = await recorderRef.current.startRecorder();
    const uri = typeof path === 'string' && path.startsWith('file://') ? path : `file://${path}`;
    recorderRef.current.addRecordBackListener((e: any) => {
      setRecordingMs(e?.currentPosition ?? 0);
    });
    setStatusDraftType('audio');
    setStatusDraftAssets([
      {
        uri,
        type: 'audio/m4a',
        fileName: `status-audio-${Date.now()}.m4a`,
        duration: 0,
      },
    ]);
  }, [ensureMicPermission]);

  const stopRecording = useCallback(async () => {
    try {
      const path = await recorderRef.current.stopRecorder();
      recorderRef.current.removeRecordBackListener();
      setIsRecording(false);
      const uri = typeof path === 'string' && path.startsWith('file://') ? path : `file://${path}`;
      setStatusDraftAssets([
        {
          uri,
          type: 'audio/m4a',
          fileName: `status-audio-${Date.now()}.m4a`,
          duration: Math.round(recordingMs / 1000),
          durationMs: recordingMs,
        },
      ]);
    } catch (e) {
      console.warn('[UpdatesTab] stopRecording failed', e);
      setIsRecording(false);
    }
  }, [recordingMs]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopMediaFallback = useCallback(() => {
    if (mediaFallbackRef.current) {
      clearInterval(mediaFallbackRef.current);
      mediaFallbackRef.current = null;
    }
  }, []);

  const openViewer = useCallback((userId: string) => {
    const target = statuses.find((u) => u.id === userId);
    if (!target || target.items.length === 0) return;
    const lastViewed = viewedMap[userId] ?? 0;
    setViewerUserId(userId);
    setViewerIndex(Math.min(lastViewed, target.items.length - 1));
    setViewerOpen(true);
  }, [statuses, viewedMap]);

  const closeViewer = useCallback(() => {
    stopTimer();
    if (viewerUserId) {
      setViewedMap((prev) => ({
        ...prev,
        [viewerUserId]: viewerIndex,
      }));
    }
    setViewerOpen(false);
    setViewerUserId(null);
    setViewerIndex(0);
    setViewerProgress(0);
  }, [stopTimer, viewerIndex, viewerUserId]);

  const handleNext = useCallback(() => {
    if (!activeUser) return;
    if (viewerIndex + 1 < activeUser.items.length) {
      setViewerIndex((prev) => prev + 1);
    } else {
      const currentIdx = statuses.findIndex((u) => u.id === activeUser.id);
      const nextUser = currentIdx >= 0 ? statuses[currentIdx + 1] : null;
      if (nextUser && nextUser.items.length > 0) {
        setViewerUserId(nextUser.id);
        setViewerIndex(0);
      } else {
        closeViewer();
      }
    }
  }, [activeUser, closeViewer, statuses, viewerIndex]);

  const startTimer = useCallback(() => {
    stopTimer();
    if (!activeUser || !currentItem) return;
    if (isMediaItem) return;
    const duration = itemDuration(currentItem);
    const startedAt = Date.now();
    progressRef.current = 0;
    setViewerProgress(0);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(1, elapsed / duration);
      progressRef.current = next;
      setViewerProgress(next);
      if (next >= 1) {
        handleNext();
      }
    }, 80);
  }, [activeUser, currentItem, handleNext, isMediaItem, stopTimer]);

  const startMediaFallback = useCallback(() => {
    stopMediaFallback();
    if (!currentItem) return;
    const duration = currentItem.durationMs ?? 7000;
    const startedAt = Date.now();
    mediaFallbackRef.current = setInterval(() => {
      const silentForMs = Date.now() - lastMediaProgressRef.current;
      if (silentForMs < 400) return; // onProgress is running
      const elapsed = Date.now() - startedAt;
      const next = Math.min(1, elapsed / duration);
      setViewerProgress(next);
      if (next >= 1) {
        stopMediaFallback();
        handleNext();
      }
    }, 120);
  }, [currentItem, handleNext, stopMediaFallback]);

  React.useEffect(() => {
    if (!pendingOpenUserId) return;
    const target = statuses.find((u) => u.id === pendingOpenUserId);
    if (!target || target.items.length === 0) return;
    openViewer(pendingOpenUserId);
    setPendingOpenUserId(null);
  }, [openViewer, pendingOpenUserId, statuses]);

  const handlePrev = () => {
    if (!activeUser) return;
    if (viewerIndex > 0) {
      setViewerIndex((prev) => prev - 1);
    } else {
      const currentIdx = statuses.findIndex((u) => u.id === activeUser.id);
      const prevUser = currentIdx > 0 ? statuses[currentIdx - 1] : null;
      if (prevUser && prevUser.items.length > 0) {
        setViewerUserId(prevUser.id);
        setViewerIndex(prevUser.items.length - 1);
      }
    }
  };

  React.useEffect(() => {
    setViewerProgress(0);
    mediaDurationRef.current = 0;
    lastMediaProgressRef.current = 0;
    setMediaPaused(false);
    if (viewerOpen) startTimer();
    if (viewerOpen && isMediaItem) startMediaFallback();
    return () => {
      stopTimer();
      stopMediaFallback();
    };
  }, [
    viewerOpen,
    viewerIndex,
    currentItem?.id,
    isMediaItem,
    startMediaFallback,
    startTimer,
    stopMediaFallback,
    stopTimer,
  ]);

  React.useEffect(() => {
    if (!viewerOpen || !currentItem?.id) return;
    const markViewed = async () => {
      if (!currentItem?.id) return;
      await postRequest(ROUTES.statuses.view(currentItem.id), {});
      setStatusUsers((prev) =>
        prev.map((u) => {
          if (u.id !== activeUser?.id) return u;
          const nextItems = u.items.map((item) =>
            item.id === currentItem.id ? { ...item, viewed: true } : item
          );
          const nextHasUnseen = nextItems.some((item) => !item.viewed);
          return { ...u, items: nextItems, hasUnseen: nextHasUnseen };
        })
      );
    };
    markViewed();
  }, [viewerOpen, currentItem?.id, activeUser?.id]);

  const renderStatusThumb = (user: StatusUser) => {
    if (user.id === 'me') {
      const latest = user.items[user.items.length - 1];
      if (latest) {
        if (latest.type === 'image' && latest.uri) {
          return (
            <View style={[styles.statusThumb, { borderColor: palette.divider }]}>
              <Image source={{ uri: latest.uri }} style={styles.statusThumb} />
              <Pressable
                onPress={() => {
                  suppressMyOpenRef.current = true;
                  setSuppressMyOpen(true);
                  setStatusDraftType('text');
                  setStatusDraftText('');
                  setStatusDraftAssets([]);
                  setStatusDraftStyle({
                    bgColor: STATUS_BG_COLORS[0],
                    textColor: STATUS_TEXT_COLORS[0],
                    fontSize: STATUS_FONT_SIZES[2],
                    fontFamily: STATUS_FONT_FAMILIES[0],
                  });
                  setStatusComposerOpen(true);
                }}
                hitSlop={10}
                style={[styles.statusAddBadge, { backgroundColor: palette.primarySoft }]}
              >
                <KISIcon name="add" size={16} color={palette.primaryStrong} />
              </Pressable>
            </View>
          );
        }
        const textStyle = resolveTextStyle(latest);
        return (
          <View
            style={[
              styles.statusThumb,
              { borderColor: palette.divider, backgroundColor: textStyle.bgColor },
            ]}
          >
            <Text
              style={{
                color: textStyle.textColor,
                fontSize: 12,
                fontFamily: textStyle.fontFamily,
              }}
              numberOfLines={2}
            >
              {latest.text ?? 'My status'}
            </Text>
            <Pressable
              onPress={() => {
                suppressMyOpenRef.current = true;
                setSuppressMyOpen(true);
                setStatusDraftType('text');
                setStatusDraftText('');
                setStatusDraftAssets([]);
                setStatusDraftStyle({
                  bgColor: STATUS_BG_COLORS[0],
                  textColor: STATUS_TEXT_COLORS[0],
                  fontSize: STATUS_FONT_SIZES[2],
                  fontFamily: STATUS_FONT_FAMILIES[0],
                });
                setStatusComposerOpen(true);
              }}
              hitSlop={10}
              style={[styles.statusAddBadge, { backgroundColor: palette.primarySoft }]}
            >
              <KISIcon name="add" size={16} color={palette.primaryStrong} />
            </Pressable>
          </View>
        );
      }
      return (
        <View style={[styles.statusThumb, { borderColor: palette.divider }]}>
          <View style={[styles.statusAdd, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name="add" size={16} color={palette.primaryStrong} />
          </View>
        </View>
      );
    }
    const lastViewed = viewedMap[user.id] ?? 0;
    const pickIndex = lastViewed < user.items.length ? lastViewed : 0;
    const item = user.items[pickIndex];
    if (item?.type === 'image' && item?.uri) {
      return (
        <Image
          source={{ uri: item.uri }}
          style={[styles.statusThumb, { borderColor: palette.divider }]}
        />
      );
    }
    if (item?.type === 'video') {
      return (
        <View style={[styles.statusThumb, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          <KISIcon name="video" size={18} color={palette.text} />
        </View>
      );
    }
    if (item?.type === 'audio') {
      return (
        <View style={[styles.statusThumb, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          <KISIcon name="mic" size={18} color={palette.text} />
        </View>
      );
    }
    const textStyle = resolveTextStyle(item);
    return (
      <View
        style={[
          styles.statusThumb,
          { borderColor: palette.divider, backgroundColor: textStyle.bgColor },
        ]}
      >
        <Text
          style={{
            color: textStyle.textColor,
            fontSize: 12,
            fontFamily: textStyle.fontFamily,
          }}
          numberOfLines={2}
        >
          {item?.text ?? 'Status'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Status row */}
        <View style={styles.sectionHeader}>
          <KISText preset="h3" color={palette.text}>
            Status
          </KISText>
          {statusesLoading ? (
            <KISText preset="helper" color={palette.subtext}>
              Loading…
            </KISText>
          ) : null}
        </View>
        {statusesLoading ? (
          <View style={[styles.statusRow, { paddingHorizontal: 16, flexDirection: 'row', gap: 12 }]}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <View key={`status-skel-${idx}`} style={{ width: 86, alignItems: 'center', gap: 6 }}>
                <Skeleton width={70} height={70} radius={18} />
                <Skeleton width={60} height={10} radius={6} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={statuses}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusRow}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (item.id === 'me') {
                    if (suppressMyOpenRef.current || suppressMyOpen) {
                      suppressMyOpenRef.current = false;
                      setSuppressMyOpen(false);
                      return;
                    }
                    if (item.items.length > 0) {
                      openViewer(item.id);
                    } else {
                      setStatusDraftType('text');
                      setStatusDraftText('');
                      setStatusDraftAssets([]);
                      setStatusDraftStyle({
                        bgColor: STATUS_BG_COLORS[0],
                        textColor: STATUS_TEXT_COLORS[0],
                        fontSize: STATUS_FONT_SIZES[2],
                        fontFamily: STATUS_FONT_FAMILIES[0],
                      });
                      setStatusComposerOpen(true);
                    }
                    return;
                  }
                  openViewer(item.id);
                }}
                style={({ pressed }) => [
                  styles.statusCard,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {renderStatusThumb(item)}
                <Text style={{ color: palette.text, fontSize: 12 }} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        )}

        {/* Channels list */}
        <View style={[styles.sectionHeader, { marginTop: 10 }]}>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
            Channels
          </Text>
        </View>
        {channelsLoading ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <View
                key={`channel-skel-${idx}`}
                style={[
                  styles.channelCard,
                  { borderColor: palette.inputBorder, backgroundColor: palette.card },
                ]}
              >
                <View style={styles.channelRow}>
                  <Skeleton width={44} height={44} radius={22} />
                  <View style={styles.channelInfo}>
                    <Skeleton width="60%" height={12} radius={6} />
                    <Skeleton width="90%" height={10} radius={6} style={{ marginTop: 8 }} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          channels
            .filter((ch) => {
              if (!searchTerm.trim()) return true;
              const q = searchTerm.trim().toLowerCase();
              const name = String(ch.name ?? '').toLowerCase();
              const desc = String(ch.description ?? '').toLowerCase();
              return name.includes(q) || desc.includes(q);
            })
            .map((ch) => (
              <Pressable
                key={ch.id}
                onPress={() => handleOpenChannel(ch)}
                style={[
                  styles.channelCard,
                  { borderColor: palette.inputBorder, backgroundColor: palette.card },
                ]}
              >
                <View style={styles.channelRow}>
                  {ch.avatar_url ? (
                    <Image source={{ uri: ch.avatar_url }} style={styles.channelAvatar} />
                  ) : (
                    <View style={[styles.channelAvatar, { backgroundColor: palette.surface }]}>
                      <KISIcon name="megaphone" size={16} color={palette.text} />
                    </View>
                  )}
                  <View style={styles.channelInfo}>
                    <View style={styles.channelHeader}>
                      <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
                        {ch.name}
                      </Text>
                      {ch.partner ? (
                        <Text style={{ color: palette.primaryStrong, fontSize: 11 }}>Partner</Text>
                      ) : null}
                    </View>
                    {ch.description ? (
                      <Text style={{ color: palette.subtext, marginTop: 6 }} numberOfLines={2}>
                        {ch.description}
                      </Text>
                    ) : null}
                    {ch.role || ch.membership_role || ch.access ? (
                      <Text style={{ color: palette.subtext, marginTop: 6, fontSize: 11 }}>
                        {(ch.role ?? ch.membership_role ?? ch.access) as string}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))
        )}
      </ScrollView>

      {/* Floating create channel button */}
      <Pressable
        onPress={() => setShowCreateChannel(true)}
        style={[
          styles.fab,
          { backgroundColor: palette.primary },
        ]}
      >
        <KISIcon name="add" size={18} color={palette.onPrimary} />
      </Pressable>

      {/* Channel preview + subscribe */}
      <Modal visible={channelPreviewOpen} transparent animationType="slide">
        <View style={styles.channelPreviewBackdrop}>
          <Pressable
            style={styles.channelPreviewClose}
            onPress={() => {
              setChannelPreviewOpen(false);
              setPreviewChannel(null);
            }}
          />
          <View style={[styles.channelPreviewCard, { backgroundColor: palette.card }]}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
              {previewChannel?.name ?? 'Channel'}
            </Text>
            {previewChannel?.description ? (
              <Text style={{ color: palette.subtext, marginTop: 6 }}>
                {previewChannel.description}
              </Text>
            ) : null}
            {Array.isArray(previewChannel?.invite_messages) &&
            previewChannel.invite_messages.length > 0 ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {previewChannel.invite_messages.map((msg: string, idx: number) => (
                  <View
                    key={`${previewChannel?.id}-invite-${idx}`}
                    style={[
                      styles.inviteBubble,
                      { backgroundColor: palette.surfaceElevated },
                    ]}
                  >
                    <Text style={{ color: palette.text }}>{msg}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable
              onPress={handleSubscribeChannel}
              style={({ pressed }) => [
                styles.subscribeButton,
                {
                  backgroundColor: palette.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '700' }}>
                {channelSubscribing ? 'Subscribing…' : 'Subscribe'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Create channel modal */}
      <Modal visible={showCreateChannel} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCreateChannel(false)}>
          <View />
        </Pressable>
        <View style={[styles.modalCard, { backgroundColor: palette.bg }]}>
          <NewChannelForm
            palette={palette}
            onSuccess={(created) => {
              setShowCreateChannel(false);
              setChannels((prev) => [created, ...prev]);
            }}
          />
        </View>
      </Modal>

      {/* Status composer */}
      <Modal visible={statusComposerOpen} transparent animationType="slide">
        <View style={styles.composerBackdrop}>
          <View style={[styles.composerCard, { backgroundColor: palette.card }]}>
            <KISText preset="h3" color={palette.text} style={styles.composerTitle}>
              Create status
            </KISText>

            <View style={styles.composerRow}>
              <Pressable
                onPress={async () => {
                  const picked = await launchImageLibrary({
                    mediaType: 'mixed',
                    selectionLimit: 10,
                  });
                  const assets = (picked?.assets ?? []).filter((a) => a?.uri);
                  if (assets.length === 0) return;
                  const type = assets[0].type?.startsWith('video') ? 'video' : 'image';
                  setStatusDraftType(type);
                  setStatusDraftAssets(assets);
                }}
                style={({ pressed }) => [
                  styles.composerAction,
                  { backgroundColor: pressed ? palette.surface : palette.surfaceElevated },
                ]}
              >
                <KISIcon name="image" size={18} color={palette.text} />
                <KISText preset="helper" color={palette.text}>
                  Photo/Video
                </KISText>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (isRecording) {
                    await stopRecording();
                    return;
                  }
                  await startRecording();
                }}
                style={({ pressed }) => [
                  styles.composerAction,
                  { backgroundColor: pressed ? palette.surface : palette.surfaceElevated },
                ]}
              >
                <KISIcon name={isRecording ? 'stop' : 'mic'} size={18} color={palette.text} />
                <KISText preset="helper" color={palette.text}>
                  {isRecording ? 'Stop' : 'Audio'}
                </KISText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStatusDraftType('text');
                  setStatusDraftAssets([]);
                }}
                style={({ pressed }) => [
                  styles.composerAction,
                  { backgroundColor: pressed ? palette.surface : palette.surfaceElevated },
                ]}
              >
                <KISIcon name="edit" size={18} color={palette.text} />
                <KISText preset="helper" color={palette.text}>
                  Text
                </KISText>
              </Pressable>
            </View>

            {statusDraftType === 'text' ? (
              <>
                <TextInput
                  value={statusDraftText}
                  onChangeText={setStatusDraftText}
                  placeholder="Write a status…"
                  placeholderTextColor={palette.subtext}
                  multiline
                  style={[
                    styles.composerInput,
                    {
                      color: statusDraftStyle.textColor,
                      borderColor: palette.inputBorder,
                      backgroundColor: statusDraftStyle.bgColor,
                      fontSize: statusDraftStyle.fontSize,
                      fontFamily: statusDraftStyle.fontFamily,
                    },
                  ]}
                />
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Background</Text>
                  <View style={styles.colorRow}>
                    {STATUS_BG_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() =>
                          setStatusDraftStyle((prev) => ({ ...prev, bgColor: color }))
                        }
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor: color,
                            borderColor:
                              statusDraftStyle.bgColor === color
                                ? palette.primary
                                : 'transparent',
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Text color</Text>
                  <View style={styles.colorRow}>
                    {STATUS_TEXT_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() =>
                          setStatusDraftStyle((prev) => ({ ...prev, textColor: color }))
                        }
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor: color,
                            borderColor:
                              statusDraftStyle.textColor === color
                                ? palette.primary
                                : 'transparent',
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Font size</Text>
                  <View style={styles.choiceRow}>
                    {STATUS_FONT_SIZES.map((size) => (
                      <Pressable
                        key={size}
                        onPress={() =>
                          setStatusDraftStyle((prev) => ({ ...prev, fontSize: size }))
                        }
                        style={[
                          styles.choiceChip,
                          {
                            borderColor:
                              statusDraftStyle.fontSize === size
                                ? palette.primary
                                : palette.inputBorder,
                            backgroundColor: palette.surfaceElevated,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.text, fontSize: 12 }}>{size}px</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Font</Text>
                  <View style={styles.choiceRow}>
                    {STATUS_FONT_FAMILIES.map((family) => (
                      <Pressable
                        key={family}
                        onPress={() =>
                          setStatusDraftStyle((prev) => ({ ...prev, fontFamily: family }))
                        }
                        style={[
                          styles.choiceChip,
                          {
                            borderColor:
                              statusDraftStyle.fontFamily === family
                                ? palette.primary
                                : palette.inputBorder,
                            backgroundColor: palette.surfaceElevated,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.text, fontSize: 12 }}>{family}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            ) : statusDraftType === 'audio' ? (
              <View style={styles.composerPreview}>
                <View style={styles.audioPreview}>
                  <KISIcon name="mic" size={22} color={palette.text} />
                  <Text style={{ color: palette.text }}>
                    {isRecording ? 'Recording…' : 'Audio ready'}
                  </Text>
                  <Text style={{ color: palette.subtext }}>
                    {Math.round(recordingMs / 1000)}s
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.composerPreview}>
                    {statusDraftAssets.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {statusDraftAssets.map((asset, idx) => {
                          const assetVideoSource = buildMediaSource(asset.uri, mediaHeaders);
                          return statusDraftType === 'video' ? (
                            <Video
                              key={`${asset.uri}_${idx}`}
                              source={assetVideoSource ?? { uri: asset.uri }}
                              style={styles.composerPreviewMedia}
                              resizeMode="cover"
                              paused
                            />
                          ) : (
                            <Image
                              key={`${asset.uri}_${idx}`}
                              source={{ uri: asset.uri }}
                              style={styles.composerPreviewMedia}
                            />
                          );
                        })}
                      </ScrollView>
                    ) : (
                  <Text style={{ color: palette.subtext }}>No media selected.</Text>
                )}
              </View>
            )}

            <View style={styles.composerFooter}>
              <Pressable
                onPress={() => setStatusComposerOpen(false)}
                style={({ pressed }) => [
                  styles.composerBtn,
                  { backgroundColor: pressed ? palette.surface : palette.surfaceElevated },
                ]}
              >
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (statusDraftType === 'text' && !statusDraftText.trim()) {
                    Alert.alert('Status', 'Please enter some text.');
                    return;
                  }
                  if (statusDraftType !== 'text' && statusDraftAssets.length === 0) {
                    Alert.alert('Status', 'Please choose a photo or video.');
                    return;
                  }
                  if (statusDraftType === 'text') {
                    const form = new FormData();
                    form.append('type', statusDraftType);
                    form.append('text', statusDraftText.trim());
                    form.append('style', JSON.stringify(statusDraftStyle));
                    const res = await postRequest(ROUTES.statuses.create, form, {
                      errorMessage: 'Failed to create status',
                    });
                    if (!res.success) {
                      console.warn('[UpdatesTab] status post failed', res.data ?? res.message);
                    }
                    if (!res.success) {
                      Alert.alert('Status', res.message || 'Failed to create status');
                      return;
                    }
                  } else {
                    for (const asset of statusDraftAssets) {
                      const form = new FormData();
                      const isVideo = asset.type?.startsWith('video');
                      const isAudio = asset.type?.startsWith('audio');
                      form.append('type', isVideo ? 'video' : isAudio ? 'audio' : 'image');
                      form.append('file', {
                        uri: asset.uri,
                        name: asset.fileName || 'status',
                        type: asset.type || 'application/octet-stream',
                      } as any);
                      const durationMs =
                        typeof asset?.durationMs === 'number'
                          ? asset.durationMs
                          : typeof asset?.duration === 'number'
                          ? asset.duration > 1000
                            ? asset.duration
                            : Math.round(asset.duration * 1000)
                          : undefined;
                      if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
                        form.append('duration_ms', String(Math.round(durationMs)));
                      }
                      const res = await postRequest(ROUTES.statuses.create, form, {
                        errorMessage: 'Failed to create status',
                      });
                      if (!res.success) {
                        console.warn('[UpdatesTab] status post failed', res.data ?? res.message);
                      }
                      if (!res.success) {
                        Alert.alert('Status', res.message || 'Failed to create status');
                        return;
                      }
                    }
                  }
                  setStatusComposerOpen(false);
                  setStatusDraftText('');
                  setStatusDraftAssets([]);
                  await loadStatuses();
                  openViewer('me');
                }}
                style={({ pressed }) => [
                  styles.composerBtn,
                  { backgroundColor: pressed ? palette.primarySoft : palette.primary },
                ]}
              >
                <Text style={{ color: palette.inverseText ?? '#fff' }}>Post</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status viewer */}
      <Modal visible={viewerOpen} transparent animationType="fade">
        <View style={[styles.viewerWrap, { backgroundColor: palette.bg }]}>
          <View style={styles.viewerProgressRow} pointerEvents="auto">
            {(activeUser?.items ?? []).map((item, idx) => {
              const fill =
                idx < viewerIndex ? 1 : idx === viewerIndex ? viewerProgress : 0;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setViewerIndex(idx);
                    setViewerProgress(0);
                  }}
                  style={[
                    styles.progressTrack,
                    { backgroundColor: palette.subtext, opacity: 0.5 },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%`,
                        backgroundColor: palette.text,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.viewerClose} onPress={closeViewer} hitSlop={10}>
            <KISIcon name="close" size={18} color={palette.text} />
          </Pressable>

          <Pressable style={styles.viewerTapZone} onPress={handlePrev} />
          <Pressable style={[styles.viewerTapZone, { right: 0 }]} onPress={handleNext} />

          <View style={styles.viewerContent}>
            {currentItem?.type === 'text' ? (
              <View
                style={[
                  styles.viewerTextCard,
                  { backgroundColor: resolveTextStyle(currentItem).bgColor },
                ]}
              >
                <Text
                  style={{
                    color: resolveTextStyle(currentItem).textColor,
                    fontSize: resolveTextStyle(currentItem).fontSize,
                    fontFamily: resolveTextStyle(currentItem).fontFamily,
                    fontWeight: '700',
                  }}
                >
                  {currentItem?.text ?? 'Status'}
                </Text>
                <Text style={{ color: palette.subtext, marginTop: 12 }}>Text status</Text>
              </View>
            ) : currentItem?.type === 'video' && currentItem?.uri ? (
              <Video
                source={viewerMediaSource ?? { uri: currentItem.uri }}
                style={styles.viewerImage}
                resizeMode="cover"
                paused={!viewerOpen || mediaPaused}
                onLoad={(e) => {
                  mediaDurationRef.current = e.duration ?? 0;
                }}
                onProgress={(e) => {
                  const dur = mediaDurationRef.current || e.seekableDuration || e.playableDuration || 0;
                  if (dur > 0) setViewerProgress(Math.min(1, e.currentTime / dur));
                  lastMediaProgressRef.current = Date.now();
                }}
                onEnd={handleNext}
              />
            ) : currentItem?.type === 'audio' && currentItem?.uri ? (
              <View style={styles.audioViewer}>
                <Video
                  source={viewerMediaSource ?? { uri: currentItem.uri }}
                  style={styles.audioHidden}
                  paused={!viewerOpen || mediaPaused}
                  audioOnly
                  playInBackground
                  ignoreSilentSwitch="ignore"
                  onLoad={(e) => {
                    mediaDurationRef.current = e.duration ?? 0;
                  }}
                  onProgress={(e) => {
                    const dur = mediaDurationRef.current || e.seekableDuration || e.playableDuration || 0;
                    if (dur > 0) setViewerProgress(Math.min(1, e.currentTime / dur));
                    lastMediaProgressRef.current = Date.now();
                  }}
                  onEnd={handleNext}
                />
                <KISIcon name="mic" size={28} color={palette.text} />
                <Text style={{ color: palette.text, fontSize: 16, marginTop: 8 }}>
                  Audio status
                </Text>
                <Pressable
                  onPress={() => setMediaPaused((prev) => !prev)}
                  style={[
                    styles.audioButton,
                    { backgroundColor: palette.surfaceElevated, borderColor: palette.inputBorder },
                  ]}
                >
                  <KISIcon name={mediaPaused ? 'play' : 'pause'} size={18} color={palette.text} />
                  <Text style={{ color: palette.text }}>
                    {mediaPaused ? 'Play' : 'Pause'}
                  </Text>
                </Pressable>
              </View>
            ) : currentItem?.uri ? (
              <Image source={{ uri: currentItem.uri }} style={styles.viewerImage} />
            ) : (
              <View style={[styles.viewerTextCard, { backgroundColor: palette.card }]}>
                <Text style={{ color: palette.subtext }}>No preview</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  statusRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  statusCard: { width: 86, alignItems: 'center', gap: 6 },
  statusThumb: {
    width: 70,
    height: 70,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusAdd: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusAddBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: {
    flex: 1,
  },
  channelHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  channelPreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  channelPreviewClose: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  channelPreviewCard: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  inviteBubble: {
    borderRadius: 14,
    padding: 10,
  },
  subscribeButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 18,
    padding: 16,
  },
  composerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  composerCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 12,
  },
  composerTitle: { fontSize: 18, fontWeight: '700' },
  composerRow: { flexDirection: 'row', gap: 12 },
  composerAction: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  composerInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    textAlignVertical: 'top',
  },
  optionRow: {
    gap: 8,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  composerPreview: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerPreviewMedia: {
    width: 220,
    height: 220,
    borderRadius: 16,
    marginRight: 12,
  },
  audioPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  composerFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  composerBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewerWrap: { flex: 1 },
  viewerProgressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: Platform.select({ ios: 64, android: 36, default: 36 }),
    zIndex: 20,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#fff',
  },
  viewerClose: {
    position: 'absolute',
    top: 36,
    right: 16,
    padding: 8,
    zIndex: 50,
  },
  viewerTapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    left: 0,
    zIndex: 5,
  },
  viewerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  viewerImage: {
    width: '100%',
    height: '75%',
    borderRadius: 24,
  },
  audioViewer: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  audioButton: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioHidden: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  viewerTextCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
});
