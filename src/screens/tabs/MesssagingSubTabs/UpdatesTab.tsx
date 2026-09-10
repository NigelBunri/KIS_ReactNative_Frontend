import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import ROUTES, { buildMediaSource, useMediaHeaders } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import NewChannelForm from '@/Module/AddContacts/components/NewChannelForm';
import { Chat } from '@/Module/ChatRoom/messagesUtils';
import Skeleton from '@/components/common/Skeleton';
import KISText from '@/components/common/KISText';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadStatusMedia, type StatusMediaPurpose } from '@/services/uploadStatusMedia';
import {
  refreshFromDeviceAndBackendWithOptions,
  type KISContact,
} from '@/Module/AddContacts/contactsService';
import { useSocket } from '../../../../SocketProvider';
import Video from 'react-native-video';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';
import { useRawTopInset } from '@/hooks/useSafeTopInset';
import type { ScrollableHandle } from '@/hooks/useHeaderDragToScroll';

type StatusVisibility = 'contacts' | 'contacts_except' | 'only_share_with';
type StatusReplyPermission = 'contacts' | 'nobody';

type StatusItem = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  uri?: string;
  text?: string;
  durationMs?: number;
  createdAt?: string;
  viewed?: boolean;
  visibility?: StatusVisibility;
  audienceUserIds?: string[];
  replyPermission?: StatusReplyPermission;
  replyAllowed?: boolean;
  style?: {
    bgColor?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
  };
};

type StatusUser = {
  id: string;
  name: string;
  avatar?: string;
  items: StatusItem[];
  userId?: string;
  hasUnseen?: boolean;
  isMuted?: boolean;
};

const SAMPLE_STATUSES: StatusUser[] = [];

// Every world-standard status/story viewer (WhatsApp, Instagram, Snapchat)
// shows "who and when" right under the progress bars - the viewer here had
// no such header at all before, so there was no way to tell whose status
// you were looking at or how recent it was without backing out.
function timeAgo(isoString?: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  if (!Number.isFinite(diff) || diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const itemDuration = (item: StatusItem) => item.durationMs ?? 5000;
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

const normalizeAudienceIds = (value: any): string[] => {
  if (!value) return [];
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : value.split(',');
        } catch {
          return value.split(',');
        }
      })()
    : [];
  return Array.from(
    new Set(
      source
        .map(item => String(item ?? '').trim())
        .filter(Boolean),
    ),
  );
};

const appendStatusAudienceFields = (
  form: FormData,
  visibility: StatusVisibility,
  userIds: string[],
) => {
  const normalized = normalizeAudienceIds(userIds);
  form.append('visibility', visibility);
  form.append('audience_mode', visibility);
  if (visibility === 'contacts' || normalized.length === 0) return;

  const serialized = JSON.stringify(normalized);
  form.append('target_user_ids', serialized);
  if (visibility === 'contacts_except') {
    form.append('excluded_user_ids', serialized);
    form.append('except_user_ids', serialized);
  } else if (visibility === 'only_share_with') {
    form.append('allowed_user_ids', serialized);
    form.append('only_user_ids', serialized);
  }
};

// JSON equivalent of appendStatusAudienceFields, for status media created
// via media_id (direct-to-S3 flow) instead of multipart `file`. Same field
// names, same aliasing — StatusCreateSerializer.validate() reads either
// shape identically.
const buildStatusAudienceJsonFields = (
  visibility: StatusVisibility,
  userIds: string[],
): Record<string, unknown> => {
  const normalized = normalizeAudienceIds(userIds);
  const fields: Record<string, unknown> = {
    visibility,
    audience_mode: visibility,
  };
  if (visibility === 'contacts' || normalized.length === 0) return fields;
  fields.target_user_ids = normalized;
  if (visibility === 'contacts_except') {
    fields.excluded_user_ids = normalized;
    fields.except_user_ids = normalized;
  } else if (visibility === 'only_share_with') {
    fields.allowed_user_ids = normalized;
    fields.only_user_ids = normalized;
  }
  return fields;
};

type UpdatesTabProps = {
  searchTerm?: string;
  onOpenChat?: (chat: Chat) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

// Rectangular story-tray card (Facebook Stories-style) rather than a small
// circular ring - a bigger, more scannable preview of the actual photo/
// video/text content, with the person's name overlaid at the bottom on its
// own gradient scrim instead of a separate caption line beneath the card.
// Unseen keeps this app's warm gold gradient frame; already-seen gets a
// plain muted frame - same "something new here" convention the previous
// circular ring used, just applied to a rounded rectangle instead.
function StatusCard({
  width,
  height,
  hasUnseen,
  palette,
  label,
  children,
}: {
  width: number;
  height: number;
  hasUnseen: boolean;
  palette: ReturnType<typeof useKISTheme>['palette'];
  label?: string;
  children: React.ReactNode;
}) {
  const frameWidth = 3;
  const gapWidth = 3;
  const cornerRadius = 20;
  const innerWidth = width - (frameWidth + gapWidth) * 2;
  const innerHeight = height - (frameWidth + gapWidth) * 2;
  const innerRadius = Math.max(cornerRadius - (frameWidth + gapWidth), 12);

  const inner = (
    <View
      style={{
        width: width - frameWidth * 2,
        height: height - frameWidth * 2,
        borderRadius: cornerRadius - frameWidth,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: innerWidth,
          height: innerHeight,
          borderRadius: innerRadius,
          overflow: 'hidden',
        }}
      >
        {children}
        {label ? (
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '48%',
              justifyContent: 'flex-end',
              paddingHorizontal: 8,
              paddingBottom: 8,
            }}
          >
            <Text
              numberOfLines={2}
              style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}
            >
              {label}
            </Text>
          </LinearGradient>
        ) : null}
      </View>
    </View>
  );

  const frameStyle = {
    width,
    height,
    borderRadius: cornerRadius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (!hasUnseen) {
    return (
      <View
        style={[frameStyle, { borderWidth: frameWidth, borderColor: palette.divider }]}
      >
        {inner}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[palette.goldReadable, palette.primaryStrong, palette.goldDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={frameStyle}
    >
      {inner}
    </LinearGradient>
  );
}

const UpdatesTab = forwardRef<ScrollableHandle, UpdatesTabProps>(function UpdatesTab({
  searchTerm = '',
  onOpenChat,
  onScroll,
}: UpdatesTabProps, ref) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  // Raw device inset (status bar/notch/Dynamic Island), Android-15+-bug-
  // corrected - used for the Status viewer's overlay controls below, since
  // that's a modal presented as its own full-screen surface and needs to
  // clear the real status bar itself. The screen body below does NOT also
  // add useSafeTopInset() on top of this - this tab already renders below
  // MessagesScreen's own header and the Chats/Updates/Calls/Hub tab bar,
  // both of which already account for the safe area, so stacking a second
  // full inset here was pure dead space between the tab bar and this
  // screen's content (ChatsTab, the sibling tab, has none either).
  const viewerTopInset = useRawTopInset();
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => ({
    scrollTo: (opts) => scrollRef.current?.scrollTo(opts),
  }), []);
  const { currentUserId } = useSocket();
  const mediaHeaders = useMediaHeaders();
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  // "Loading more" (pagination) is visually distinct from the initial/
  // search skeleton load — a spinner at the bottom of an already-visible
  // list, not a full-list skeleton replacing real content the user is
  // looking at.
  const [channelsLoadingMore, setChannelsLoadingMore] = useState(false);
  const [channelsNextPageUrl, setChannelsNextPageUrl] = useState<string | null>(null);
  const [channelsError, setChannelsError] = useState(false);
  // Backend-search results are kept separate from the plain discovery list
  // rather than reusing `channels` for both — clearing the search must
  // restore exactly the discovery list that was already loaded (no refetch
  // needed), and a slow in-flight search response must never stomp on the
  // discovery list if the user cleared the query before it returned.
  const [channelSearchResults, setChannelSearchResults] = useState<any[] | null>(null);
  const [channelSearchLoading, setChannelSearchLoading] = useState(false);
  const channelSearchRequestIdRef = useRef(0);
  const channelSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [statusUsers, setStatusUsers] = useState<StatusUser[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusComposerOpen, setStatusComposerOpen] = useState(false);
  const [statusManageOpen, setStatusManageOpen] = useState(false);
  const [deletingStatusItemId, setDeletingStatusItemId] = useState<string | null>(null);
  // Guards the publish button against double-tap: the direct-to-S3 flow for
  // image/video/audio statuses is now a multi-step (initiate -> PUT ->
  // confirm -> create) round trip per asset, taking noticeably longer than
  // the old single multipart POST, so the risk of a duplicate submission on
  // a second tap is materially higher than before this migration.
  const [isPublishingStatus, setIsPublishingStatus] = useState(false);
  const [statusDraftText, setStatusDraftText] = useState('');
  const [statusDraftAssets, setStatusDraftAssets] = useState<any[]>([]);
  const [statusDraftType, setStatusDraftType] = useState<
    'text' | 'image' | 'video' | 'audio'
  >('text');
  const [statusDraftVisibility, setStatusDraftVisibility] =
    useState<StatusVisibility>('contacts');
  const [statusDraftReplyPermission, setStatusDraftReplyPermission] =
    useState<StatusReplyPermission>('contacts');
  const [statusDraftTargetUserIds, setStatusDraftTargetUserIds] = useState<
    string[]
  >([]);
  const [statusAudienceContacts, setStatusAudienceContacts] = useState<
    KISContact[]
  >([]);
  const [suppressMyOpen, setSuppressMyOpen] = useState(false);
  const suppressMyOpenRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const recorderRef = useRef(new AudioRecorderPlayer());
  const mediaDurationRef = useRef(0);
  const mediaFallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMediaProgressRef = useRef(0);
  const [mediaPaused, setMediaPaused] = useState(false);
  // Mirrors mediaPaused into a ref so startTimer's setInterval closure (fixed
  // at the moment the interval was created) reads the CURRENT paused state
  // each tick instead of whatever it was when startTimer last ran.
  const mediaPausedRef = useRef(false);
  React.useEffect(() => { mediaPausedRef.current = mediaPaused; }, [mediaPaused]);
  // Lets a text/image status's auto-advance timer pause "in place" during a
  // hold instead of losing its progress: elapsed time excludes however long
  // was spent paused, rather than the progress bar jumping forward the
  // instant a hold releases.
  const pausedMsRef = useRef(0);
  const pauseBeganAtRef = useRef<number | null>(null);
  const [statusDraftStyle, setStatusDraftStyle] = useState({
    bgColor: STATUS_BG_COLORS[0],
    textColor: STATUS_TEXT_COLORS[0],
    fontSize: STATUS_FONT_SIZES[2],
    fontFamily: STATUS_FONT_FAMILIES[0],
    textAlign: 'center' as 'left' | 'center' | 'right',
    bold: false,
    italic: false,
  });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerProgress, setViewerProgress] = useState(0);
  const [pendingOpenUserId, setPendingOpenUserId] = useState<string | null>(
    null,
  );
  // Which image status item has actually finished loading - derived
  // (not effect-mirrored) so it's never a render behind the real
  // currentItem: as soon as viewerIndex/currentItem changes to a new
  // image whose id doesn't match this yet, imageReady below is false on
  // that very render, no transient "starts timer for old id" flash.
  const [readyImageId, setReadyImageId] = useState<string | null>(null);
  // "Read more" state for long text statuses - textTruncated only flips
  // true once RN's own onTextLayout confirms the collapsed text actually
  // overflows the clamp (font size/screen width dependent, so a length
  // heuristic on the raw string would be wrong in either direction).
  const [textExpanded, setTextExpanded] = useState(false);
  const [textTruncated, setTextTruncated] = useState(false);
  const TEXT_STATUS_COLLAPSED_LINES = 6;
  const [channelPreviewOpen, setChannelPreviewOpen] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<any | null>(null);
  const [channelSubscribing, setChannelSubscribing] = useState(false);
  const [channelDetailOpen, setChannelDetailOpen] = useState(false);
  const [channelDetail, setChannelDetail] = useState<any | null>(null);
  const [channelDetailLoading, setChannelDetailLoading] = useState(false);
  const [channelFollowBusy, setChannelFollowBusy] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const videoRef = useRef<any>(null);
  const seekBarWidthRef = useRef(0);
  const [viewerReplyText, setViewerReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  // Replaces the native Alert.alert(...) this screen used for both the
  // "More"/status-options menu and the delete-confirmation - a system
  // dialog with default OS chrome looks completely out of place popping up
  // over a full-bleed, custom-themed story viewer. One themed bottom sheet
  // drives both.
  const [actionSheet, setActionSheet] = useState<{
    title?: string;
    subtitle?: string;
    options: { key: string; label: string; icon?: KISIconName; destructive?: boolean; onPress: () => void }[];
  } | null>(null);
  // Same reasoning for "Seen by" - it used to be a native Alert.alert with
  // viewer names joined by '\n', not even a real list.
  const [seenBySheetOpen, setSeenBySheetOpen] = useState(false);
  const [seenByViewers, setSeenByViewers] = useState<any[]>([]);
  const [seenByLoading, setSeenByLoading] = useState(false);
  // Hold-to-pause: every world-standard story viewer pauses playback while
  // the viewer is pressed down anywhere on the media (not just the
  // dedicated video/audio controls this screen already had) and resumes on
  // release, distinct from a quick tap which should still advance/rewind.
  // holdTimerRef fires after a short threshold so a fast tap-to-navigate
  // never visibly flickers into a pause first; wasHoldingRef records
  // whether THIS press turned into a real hold, so release only treats it
  // as "just resume" (not also a navigation) when it did.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHoldingRef = useRef(false);
  // Separate from the hold-to-pause gesture above: set while the reply
  // input is focused or "Read more" is expanded, so a hold-tap elsewhere
  // releasing doesn't resume playback out from under either of those.
  const manualPauseRef = useRef(false);
  // Stable per-attempt id for the status-reply idempotency key (see
  // handleSendReply below) - generated lazily on first send, reused if the
  // same tap fires twice before `sendingReply` disables the button, and
  // cleared once the reply actually succeeds or the user moves to a
  // different status, so the next real reply gets its own fresh id.
  const replyClientIdRef = useRef<string | null>(null);
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

  // Single place that keeps every copy of a channel object (the plain
  // discovery list, an active search-results list, the subscribe-preview
  // modal, and the detail sheet) in sync after a follow/unfollow — so a
  // user who unfollows from the detail sheet immediately sees the list
  // card update too, with no refetch and no stale duplicate state.
  const applyChannelPatch = useCallback(
    (channelId: string, patch: Record<string, any>) => {
      const merge = (ch: any) =>
        String(ch.id) === String(channelId) ? { ...ch, ...patch } : ch;
      setChannels(prev => prev.map(merge));
      setChannelSearchResults(prev => (prev ? prev.map(merge) : prev));
      setPreviewChannel((prev: any) =>
        prev && String(prev.id) === String(channelId) ? { ...prev, ...patch } : prev,
      );
      setChannelDetail((prev: any) =>
        prev && String(prev.id) === String(channelId) ? { ...prev, ...patch } : prev,
      );
    },
    [],
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
    const patch = {
      is_subscribed: true,
      member_role: res?.data?.role ?? previewChannel?.member_role,
    };
    applyChannelPatch(String(previewChannel.id), patch);
    const next = { ...previewChannel, ...patch };
    setPreviewChannel(next);
    setChannelSubscribing(false);
    setChannelPreviewOpen(false);
    handleOpenChannel(next);
  }, [previewChannel, handleOpenChannel, applyChannelPatch]);

  // Unfollow — idempotent on the backend (see apps/channels/views.py
  // unsubscribe()), so a duplicate tap or a retried request after a
  // dropped response is always safe. Optimistic with rollback: the sheet
  // stays open so the user sees the state change land immediately.
  const handleUnsubscribeChannel = useCallback(
    async (channel: any) => {
      if (!channel?.id || channelFollowBusy) return;
      setChannelFollowBusy(true);
      const previousRole = channel.member_role;
      applyChannelPatch(String(channel.id), { is_subscribed: false, member_role: null });
      const res = await postRequest(
        ROUTES.channels.unsubscribeChannel(String(channel.id)),
        {},
        { errorMessage: 'Unable to unfollow channel.' },
      );
      const ok = res?.success ?? true;
      if (!ok) {
        // Rollback — the request genuinely failed (network/server error),
        // not merely "already unsubscribed" (that path returns success).
        applyChannelPatch(String(channel.id), {
          is_subscribed: true,
          member_role: previousRole,
        });
      }
      setChannelFollowBusy(false);
    },
    [applyChannelPatch, channelFollowBusy],
  );

  const handleFollowChannel = useCallback(
    async (channel: any) => {
      if (!channel?.id || channelFollowBusy) return;
      setChannelFollowBusy(true);
      const res = await postRequest(
        ROUTES.channels.subscribeChannel(String(channel.id)),
        {},
        { errorMessage: 'Unable to follow channel.' },
      );
      const ok = res?.success ?? true;
      if (ok) {
        applyChannelPatch(String(channel.id), {
          is_subscribed: true,
          member_role: res?.data?.role ?? channel?.member_role,
        });
      }
      setChannelFollowBusy(false);
    },
    [applyChannelPatch, channelFollowBusy],
  );

  // Channel detail sheet — avatar/name/description/follower count/
  // owner info/follow-unfollow, per Phase 3 Priority 3. Opens instantly
  // with whatever's already in the list (no blank flash), then fills in
  // the detail-only fields (owner_display_name, subscriber_count) from
  // the real detail endpoint, which also re-confirms is_subscribed —
  // catching any drift if state changed elsewhere since the list loaded.
  const openChannelDetail = useCallback(async (channel: any) => {
    setChannelDetail(channel);
    setChannelDetailOpen(true);
    setChannelDetailLoading(true);
    const res = await getRequest(ROUTES.channels.getChannelById(String(channel.id)), {
      errorMessage: 'Failed to load channel details',
    });
    if (res?.success && res?.data) {
      setChannelDetail((prev: any) =>
        prev && String(prev.id) === String(channel.id) ? { ...prev, ...res.data } : prev,
      );
    }
    setChannelDetailLoading(false);
  }, []);

  const loadChannels = useCallback(async (force = false) => {
    const now = Date.now();
    if (channelsLoadInFlightRef.current) return;
    if (!force && now - channelsLastLoadAtRef.current < 15000) return;
    channelsLoadInFlightRef.current = true;
    channelsLastLoadAtRef.current = now;
    setChannelsLoading(true);
    setChannelsError(false);
    const res = await getRequest(ROUTES.channels.getAllChannels, {
      errorMessage: 'Failed to load channels',
    });
    if (res?.success) {
      const list = res?.data?.results ?? res?.data ?? res ?? [];
      setChannels(Array.isArray(list) ? list : []);
      // DRF's standard pagination shape: a full next-page URL or null —
      // passed straight back into getRequest for "load more" rather than
      // this screen reconstructing a page number/query string itself.
      setChannelsNextPageUrl(res?.data?.next ?? null);
    } else {
      setChannelsError(true);
    }
    setChannelsLoading(false);
    channelsLoadInFlightRef.current = false;
  }, []);

  const loadMoreChannels = useCallback(async () => {
    if (!channelsNextPageUrl || channelsLoadingMore || channelSearchResults !== null) return;
    setChannelsLoadingMore(true);
    const res = await getRequest(channelsNextPageUrl, {
      errorMessage: 'Failed to load more channels',
    });
    if (res?.success) {
      const list = res?.data?.results ?? [];
      setChannels((prev) => {
        // The backend's own dedupe guarantee (deterministic subscriber_count
        // DESC / created_at DESC / id ordering, see apps/channels/views.py)
        // is what actually prevents duplicate/missing rows across pages —
        // this id-based merge is a defensive second layer, not the primary
        // fix, in case a channel's subscriber_count changed between page
        // loads and shifted its sort position.
        const seen = new Set(prev.map((c: any) => c.id));
        const next = Array.isArray(list) ? list.filter((c: any) => !seen.has(c.id)) : [];
        return [...prev, ...next];
      });
      setChannelsNextPageUrl(res?.data?.next ?? null);
    }
    setChannelsLoadingMore(false);
  }, [channelsNextPageUrl, channelsLoadingMore, channelSearchResults]);

  const runChannelSearch = useCallback(async (query: string) => {
    const requestId = ++channelSearchRequestIdRef.current;
    setChannelSearchLoading(true);
    const res = await getRequest(ROUTES.channels.getAllChannels, {
      params: { q: query },
      errorMessage: 'Failed to search channels',
    });
    // Stale-response guard: if a newer search (or a query clear) started
    // after this request went out, its result must never overwrite
    // whatever the newer request already produced.
    if (requestId !== channelSearchRequestIdRef.current) return;
    if (res?.success) {
      const list = res?.data?.results ?? [];
      setChannelSearchResults(Array.isArray(list) ? list : []);
    } else {
      setChannelSearchResults([]);
    }
    setChannelSearchLoading(false);
  }, []);

  // Debounced backend search — real query to the backend (which applies
  // the exact same privacy/visibility filtering as plain discovery, see
  // apps/channels/views.py::get_queryset), not a client-side filter over
  // whatever page happened to already be loaded. Clearing the query
  // restores the plain discovery list instantly, with no refetch.
  React.useEffect(() => {
    const query = searchTerm.trim();
    if (channelSearchDebounceRef.current) clearTimeout(channelSearchDebounceRef.current);
    if (!query) {
      channelSearchRequestIdRef.current += 1; // invalidate any in-flight search
      setChannelSearchResults(null);
      setChannelSearchLoading(false);
      return;
    }
    channelSearchDebounceRef.current = setTimeout(() => {
      runChannelSearch(query);
    }, 350);
    return () => {
      if (channelSearchDebounceRef.current) clearTimeout(channelSearchDebounceRef.current);
    };
  }, [searchTerm, runChannelSearch]);

  React.useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const isChannelSearchActive = searchTerm.trim().length > 0;
  const displayedChannels = channelSearchResults ?? channels;

  const resetStatusDraft = useCallback(() => {
    setStatusDraftType('text');
    setStatusDraftText('');
    setStatusDraftAssets([]);
    setStatusDraftVisibility('contacts');
    setStatusDraftReplyPermission('contacts');
    setStatusDraftTargetUserIds([]);
    setStatusDraftStyle({
      bgColor: STATUS_BG_COLORS[0],
      textColor: STATUS_TEXT_COLORS[0],
      fontSize: STATUS_FONT_SIZES[2],
      fontFamily: STATUS_FONT_FAMILIES[0],
      textAlign: 'center',
      bold: false,
      italic: false,
    });
  }, []);

  const openStatusComposer = useCallback(() => {
    resetStatusDraft();
    setStatusComposerOpen(true);
  }, [resetStatusDraft]);

  // The "+" on the user's own status thumb used to always jump straight to
  // a blank composer, even after they already had active items - so adding
  // a second update meant losing any sense that the first one still
  // existed, and there was no way to remove one short of it expiring.
  // WhatsApp's own "add to status" affordance opens a manage view over
  // your existing items instead of a blank slate; this is that view.
  const openAddOrManageStatus = useCallback(() => {
    const myItems = statusUsers.find(u => u.id === 'me')?.items ?? [];
    if (myItems.length > 0) {
      setStatusManageOpen(true);
    } else {
      openStatusComposer();
    }
  }, [statusUsers, openStatusComposer]);

  const loadStatuses = useCallback(async (force = false) => {
    const now = Date.now();
    if (statusesLoadInFlightRef.current) return;
    // The 15s throttle exists to stop e.g. focus-triggered background
    // refreshes from hammering the endpoint - but it was also silently
    // swallowing the explicit refresh right after posting a new status
    // (almost always well within 15s of the tab's initial mount-time
    // load), so the newly created status never made it into statusUsers.
    // The next tap on "My status" then still saw items.length === 0 and
    // routed back to the composer instead of the viewer - "not even able
    // to see their own status without being taken to the create page."
    // `force` lets a call that just did something (create, delete, pull-
    // to-refresh) always go through.
    if (!force && now - statusesLastLoadAtRef.current < 15000) return;
    statusesLoadInFlightRef.current = true;
    statusesLastLoadAtRef.current = now;
    setStatusesLoading(true);
    try {
      const contacts = await refreshFromDeviceAndBackendWithOptions({});
      setStatusAudienceContacts(
        contacts.filter(contact =>
          Boolean(contact.isRegistered && contact.userId),
        ),
      );
      const res = await getRequest(ROUTES.statuses.list);
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
                  createdAt: item.created_at ?? undefined,
                  style: item.style ?? undefined,
                  viewed: Boolean(item.viewed),
                  visibility: item.visibility ?? 'contacts',
                  audienceUserIds: normalizeAudienceIds(
                    item.audience_user_ids ??
                      item.target_user_ids ??
                      item.allowed_user_ids ??
                      item.excluded_user_ids,
                  ),
                  replyPermission: item.reply_permission ?? 'contacts',
                  replyAllowed: Boolean(item.reply_allowed),
                }))
              : [],
            isMuted: Boolean(entry?.is_muted),
          }))
        : [];

      const myItems =
        mapped.find(u => u.userId === String(currentUserId))?.items ?? [];
      const otherUsers = mapped.filter(u => u.userId !== String(currentUserId));

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

      // Broadcast a summary so the conversation list can render story rings
      const statusMap: Record<string, { hasStatus: boolean; hasUnseen: boolean }> = {};
      otherUsers.forEach(u => {
        if (u.userId) statusMap[u.userId] = { hasStatus: u.items.length > 0, hasUnseen: u.hasUnseen };
      });
      DeviceEventEmitter.emit('status.loaded', statusMap);
    } catch (e) {
      console.warn('[UpdatesTab] loadStatuses failed', e);
      // A transient failure (e.g. reopening the app before connectivity is
      // back) used to wipe every already-loaded status - including the
      // user's own - down to an empty stub, which read as "everything's
      // gone blank" until the next successful reload cleared it. Keep
      // whatever was already on screen and only fall back to the empty
      // stub if nothing had ever loaded yet.
      setStatusUsers(prev =>
        prev.length ? prev : [{ id: 'me', name: 'My status', items: [] }],
      );
    } finally {
      setStatusesLoading(false);
      statusesLoadInFlightRef.current = false;
    }
  }, [currentUserId]);

  const deleteStatusItem = useCallback(
    (item: StatusItem) => {
      Alert.alert(
        'Remove this status?',
        'This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setDeletingStatusItemId(item.id);
              try {
                const res = await deleteRequest(ROUTES.statuses.detail(item.id), {
                  errorMessage: 'Unable to remove status.',
                });
                if (!res?.success && res?.status !== 404) {
                  Alert.alert('Remove failed', res?.message || 'Unable to remove this status. Please try again.');
                  return;
                }
                // Update local state immediately (don't wait on a refetch to
                // reflect a delete that already succeeded) and reconcile
                // with the server right after - same "explicit action, no
                // false-throttle" pattern as the post-create refresh.
                setStatusUsers(prev =>
                  prev.map(u =>
                    u.id === 'me'
                      ? { ...u, items: u.items.filter(existing => existing.id !== item.id) }
                      : u,
                  ),
                );
                await loadStatuses(true);
              } finally {
                setDeletingStatusItemId(null);
              }
            },
          },
        ],
      );
    },
    [loadStatuses],
  );

  React.useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    statusesLastLoadAtRef.current = 0;
    const query = searchTerm.trim();
    await Promise.all([
      loadChannels(true),
      query ? runChannelSearch(query) : Promise.resolve(),
      loadStatuses(),
    ]);
    setRefreshing(false);
  }, [loadChannels, loadStatuses, runChannelSearch, searchTerm]);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'status.open',
      (payload: any) => {
        const userId = String(payload?.userId ?? '');
        if (!userId) return;
        setPendingOpenUserId(userId);
      },
    );
    return () => {
      sub.remove();
    };
  }, []);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('status.create', () => {
      openStatusComposer();
    });
    return () => {
      sub.remove();
    };
  }, [openStatusComposer]);

  const statuses = useMemo(() => {
    if (!searchTerm.trim())
      return statusUsers.length ? statusUsers : SAMPLE_STATUSES;
    const q = searchTerm.trim().toLowerCase();
    return (statusUsers.length ? statusUsers : SAMPLE_STATUSES).filter(s => {
      if (s.id === 'me') return true;
      return s.name.toLowerCase().includes(q);
    });
  }, [searchTerm, statusUsers]);

  const activeUser = useMemo(
    () => statuses.find(u => u.id === viewerUserId) ?? null,
    [viewerUserId, statuses],
  );

  const availableAudienceContacts = useMemo(
    () =>
      statusAudienceContacts
        .filter(
          contact =>
            contact.userId &&
            String(contact.userId) !== String(currentUserId ?? ''),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [currentUserId, statusAudienceContacts],
  );

  const currentItem = activeUser?.items?.[viewerIndex] ?? null;
  React.useEffect(() => {
    // Switching to a different status abandons any in-progress reply
    // attempt - the next send on the new status must get its own fresh
    // idempotency key, not reuse one scoped to whatever was open before.
    replyClientIdRef.current = null;
  }, [currentItem?.id]);
  const viewerMediaSource = buildMediaSource(currentItem?.uri, mediaHeaders);
  const resolveTextStyle = (item?: StatusItem) => ({
    bgColor: item?.style?.bgColor ?? palette.card,
    textColor: item?.style?.textColor ?? palette.text,
    fontSize: item?.style?.fontSize ?? 20,
    fontFamily: item?.style?.fontFamily ?? undefined,
    textAlign: item?.style?.textAlign ?? 'center',
    bold: item?.style?.bold ?? false,
    italic: item?.style?.italic ?? false,
  });
  const isMediaItem =
    currentItem?.type === 'video' || currentItem?.type === 'audio';
  // Gates the auto-advance timer for image items on the picture actually
  // being on screen - previously the progress bar started counting down
  // the instant viewerIndex changed, regardless of whether the <Image>
  // below it had finished loading, so a slow-loading picture and its
  // segment fill were never actually in sync with each other.
  const isImageItem = currentItem?.type === 'image';
  const imageReady = !isImageItem || readyImageId === currentItem?.id;

  const ensureMicPermission = useCallback(async () => {
    const perm =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
    let status = await check(perm);
    if (status === RESULTS.DENIED) status = await request(perm);
    return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
  }, []);

  const startRecording = useCallback(async () => {
    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert(
        'Microphone',
        'Please allow microphone access to record audio.',
      );
      return;
    }
    setRecordingMs(0);
    setIsRecording(true);
    const recordingPath = `${RNFS.CachesDirectoryPath}/kis-status-${Date.now()}.m4a`;
    // Android's native module passes this straight to MediaRecorder.setOutputFile(),
    // which expects a plain filesystem path, not a URI — a "file://" prefix there
    // produces a bogus literal path, silently corrupting the recording (see the
    // identical fix + explanation in HoldToLockComposer.tsx's startRecording()).
    // iOS's native module explicitly detects and correctly parses "file://", so
    // only add it there.
    const recorderPath = Platform.OS === 'android' ? recordingPath : `file://${recordingPath}`;
    const path = await recorderRef.current.startRecorder(recorderPath);
    const uri =
      typeof path === 'string' && path.startsWith('file://')
        ? path
        : `file://${path}`;
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
      const uri =
        typeof path === 'string' && path.startsWith('file://')
          ? path
          : `file://${path}`;
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

  const openViewer = useCallback(
    (userId: string, startIndex?: number) => {
      const target = statuses.find(u => u.id === userId);
      if (!target || target.items.length === 0) return;
      if (typeof startIndex === 'number') {
        // Explicit index requested (e.g. tapping a specific item from the
        // manage-status list) - honor it over the resume heuristic below.
        setViewerUserId(userId);
        setViewerIndex(Math.max(0, Math.min(startIndex, target.items.length - 1)));
        setViewerOpen(true);
        return;
      }
      // Resume at the first item that hasn't been viewed yet (matching each
      // item's own server-tracked `viewed` flag) - not "whatever index the
      // viewer happened to be on when it last closed". That distinction is
      // exactly what was breaking backward navigation: once every item had
      // been viewed, the old index-based bookmark pointed at the LAST item
      // (wherever an auto-advance-to-close or a manual close last left it),
      // so every subsequent open landed back on the last item instead of
      // the start of the sequence - "viewed everything once" permanently
      // meant "can only ever reopen at the end" until the items themselves
      // changed. Falls back to the first item once nothing is unviewed,
      // same as reviewing your own already-seen status from the start.
      const firstUnviewedIndex = target.items.findIndex(item => !item.viewed);
      setViewerUserId(userId);
      setViewerIndex(firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0);
      setViewerOpen(true);
    },
    [statuses],
  );

  const closeViewer = useCallback(() => {
    stopTimer();
    setViewerOpen(false);
    setViewerUserId(null);
    setViewerIndex(0);
    setViewerProgress(0);
  }, [stopTimer]);

  const handleStatusAudienceToggle = useCallback((userId: string) => {
    setStatusDraftTargetUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(value => value !== userId)
        : [...prev, userId],
    );
  }, []);

  const handleStatusActionMenu = useCallback(() => {
    if (
      !activeUser?.userId ||
      activeUser.userId === currentUserId ||
      !currentItem?.id
    )
      return;
    const statusAuthorId = String(activeUser.userId);
    const muteLabel = activeUser.isMuted ? 'Unmute statuses' : 'Mute statuses';

    setActionSheet({
      title: activeUser.name,
      options: [
        {
          key: 'mute',
          label: muteLabel,
          icon: activeUser.isMuted ? 'volume-2' : 'volume-mute',
          onPress: async () => {
            setActionSheet(null);
            const route = activeUser.isMuted
              ? ROUTES.statuses.unmute
              : ROUTES.statuses.mute;
            const res = await postRequest(
              route,
              { user_id: statusAuthorId },
              {
                errorMessage: `Unable to ${
                  activeUser.isMuted ? 'unmute' : 'mute'
                } statuses.`,
              },
            );
            if (!res?.success) return;
            await loadStatuses(true);
            if (activeUser.isMuted) {
              return;
            }
            closeViewer();
          },
        },
        {
          key: 'report',
          label: 'Report status',
          icon: 'report',
          onPress: async () => {
            setActionSheet(null);
            const res = await postRequest(
              ROUTES.statuses.report(currentItem.id),
              { reason: 'status_report' },
              { errorMessage: 'Unable to report status.' },
            );
            if (res?.success) {
              Alert.alert('Status', 'This status has been reported.');
            }
          },
        },
        {
          key: 'block',
          label: 'Block user',
          icon: 'shield',
          destructive: true,
          onPress: async () => {
            setActionSheet(null);
            const res = await postRequest(
              ROUTES.moderation.userBlocks,
              { blocked: statusAuthorId, reason: 'status_block' },
              { errorMessage: 'Unable to block this user.' },
            );
            if (!res?.success) return;
            closeViewer();
            await loadStatuses(true);
          },
        },
      ],
    });
  }, [activeUser, closeViewer, currentItem?.id, currentUserId, loadStatuses]);

  const handleNext = useCallback(() => {
    if (!activeUser) return;
    if (viewerIndex + 1 < activeUser.items.length) {
      setViewerIndex(prev => prev + 1);
    } else {
      const currentIdx = statuses.findIndex(u => u.id === activeUser.id);
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
    pausedMsRef.current = 0;
    pauseBeganAtRef.current = null;
    progressRef.current = 0;
    setViewerProgress(0);
    timerRef.current = setInterval(() => {
      // Hold-to-pause: skip this tick entirely while paused, so the
      // progress bar freezes in place instead of the elapsed-time math
      // jumping forward by however long the hold lasted once released.
      if (mediaPausedRef.current) return;
      const elapsed = Date.now() - startedAt - pausedMsRef.current;
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
    const target = statuses.find(u => u.id === pendingOpenUserId);
    if (!target || target.items.length === 0) return;
    openViewer(pendingOpenUserId);
    setPendingOpenUserId(null);
  }, [openViewer, pendingOpenUserId, statuses]);

  const handlePrev = () => {
    if (!activeUser) return;
    if (viewerIndex > 0) {
      setViewerIndex(prev => prev - 1);
    } else {
      const currentIdx = statuses.findIndex(u => u.id === activeUser.id);
      const prevUser = currentIdx > 0 ? statuses[currentIdx - 1] : null;
      if (prevUser && prevUser.items.length > 0) {
        setViewerUserId(prevUser.id);
        setViewerIndex(prevUser.items.length - 1);
      }
    }
  };

  const handleSendReply = useCallback(async () => {
    const text = viewerReplyText.trim();
    if (!text || !currentItem?.id) return;
    setSendingReply(true);
    try {
      if (!replyClientIdRef.current) {
        replyClientIdRef.current = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }
      await postRequest(ROUTES.statuses.reply(currentItem.id), {
        text,
        client_id: replyClientIdRef.current,
      });
      setViewerReplyText('');
      replyClientIdRef.current = null;
    } finally {
      setSendingReply(false);
    }
  }, [currentItem?.id, viewerReplyText]);

  const seekPanResponder = useMemo(() => {
    if (currentItem?.type !== 'video') return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const w = seekBarWidthRef.current;
        if (!w || !mediaDurationRef.current) return;
        const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / w));
        const seekTo = ratio * mediaDurationRef.current;
        videoRef.current?.seek?.(seekTo);
        setViewerProgress(ratio);
      },
      onPanResponderMove: (evt) => {
        const w = seekBarWidthRef.current;
        if (!w || !mediaDurationRef.current) return;
        const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / w));
        const seekTo = ratio * mediaDurationRef.current;
        videoRef.current?.seek?.(seekTo);
        setViewerProgress(ratio);
      },
    });
  }, [currentItem?.type]);

  // Hold-to-pause on the left/right/middle tap zones - press-and-hold
  // anywhere pauses playback (text timer or video/audio) in place; a quick
  // tap still navigates. A short threshold before the hold "commits" means
  // a fast tap never visibly flickers into a pause first.
  const handleTapHoldStart = useCallback(() => {
    wasHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      wasHoldingRef.current = true;
      pauseBeganAtRef.current = Date.now();
      setMediaPaused(true);
    }, 180);
  }, []);
  const handleTapHoldEnd = useCallback((navigate: () => void) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (wasHoldingRef.current) {
      if (pauseBeganAtRef.current) {
        pausedMsRef.current += Date.now() - pauseBeganAtRef.current;
        pauseBeganAtRef.current = null;
      }
      // Don't resume out from under a still-active manual pause (typing a
      // reply, or "Read more" expanded) just because a hold-tap elsewhere
      // on the screen happened to release at the same moment.
      if (!manualPauseRef.current) setMediaPaused(false);
      wasHoldingRef.current = false;
      return; // a hold, not a tap - don't also navigate on release
    }
    navigate();
  }, []);

  // Manual pause (reply typing, "Read more" expanded) - same underlying
  // pause/elapsed-time-accounting mechanism as hold-to-pause, just started
  // and ended explicitly instead of on press-in/press-out.
  const beginManualPause = useCallback(() => {
    manualPauseRef.current = true;
    if (!mediaPausedRef.current) {
      pauseBeganAtRef.current = Date.now();
      setMediaPaused(true);
    }
  }, []);
  const endManualPause = useCallback(() => {
    manualPauseRef.current = false;
    if (pauseBeganAtRef.current) {
      pausedMsRef.current += Date.now() - pauseBeganAtRef.current;
      pauseBeganAtRef.current = null;
    }
    setMediaPaused(false);
  }, []);

  // Swipe-down-to-dismiss - the other world-standard story-viewer gesture
  // this screen had no equivalent of (close button only, before). Only
  // claims the gesture once a real, dominant downward drag is underway
  // (onMoveShouldSetPanResponderCapture, not onStartShouldSetPanResponder),
  // which is what lets ordinary taps on the zones/buttons beneath pass
  // straight through untouched - a tap never moves enough to satisfy this.
  const viewerDragY = useRef(new Animated.Value(0)).current;
  const dismissPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
          gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) viewerDragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > 120) {
            Animated.timing(viewerDragY, {
              toValue: 800,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              viewerDragY.setValue(0);
              closeViewer();
            });
          } else {
            Animated.spring(viewerDragY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(viewerDragY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        },
      }),
    [closeViewer, viewerDragY],
  );

  React.useEffect(() => {
    setTextExpanded(false);
    setTextTruncated(false);
  }, [currentItem?.id]);

  React.useEffect(() => {
    setViewerProgress(0);
    mediaDurationRef.current = 0;
    lastMediaProgressRef.current = 0;
    setMediaPaused(false);
    // Text/video/audio start counting immediately as before; an image
    // item only starts once imageReady flips true for this exact item
    // (see the <Image> onLoadEnd/onError below), so the segment begins
    // filling right as the picture appears instead of while it's still
    // loading.
    if (viewerOpen && imageReady) startTimer();
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
    imageReady,
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
      setStatusUsers(prev =>
        prev.map(u => {
          if (u.id !== activeUser?.id) return u;
          const nextItems = u.items.map(item =>
            item.id === currentItem.id ? { ...item, viewed: true } : item,
          );
          const nextHasUnseen = nextItems.some(item => !item.viewed);
          return { ...u, items: nextItems, hasUnseen: nextHasUnseen };
        }),
      );
    };
    markViewed();
  }, [viewerOpen, currentItem?.id, activeUser?.id]);

  // Same story-ring convention on every thumb below: a bold accent ring
  // means there's something new to see, a plain divider frame means it's
  // already been seen (or, for 'me' with no status yet, that there's
  // nothing there at all) - this distinction existed in the data
  // (hasUnseen/viewed) but nothing was actually rendering it before.
  const STATUS_CARD_WIDTH = responsive.isWatch ? 78 : 110;
  const STATUS_CARD_HEIGHT = responsive.isWatch ? 118 : 172;

  const renderStatusThumb = (user: StatusUser) => {
    const addBadge = (
      <Pressable
        onPress={() => {
          suppressMyOpenRef.current = true;
          setSuppressMyOpen(true);
          openAddOrManageStatus();
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add or manage status"
        style={[
          styles.statusAddBadge,
          { backgroundColor: palette.primaryStrong, borderColor: palette.bg },
        ]}
      >
        <KISIcon name="add" size={16} color={palette.onPrimary} />
      </Pressable>
    );
    const thumbFill = { width: '100%' as const, height: '100%' as const, alignItems: 'center' as const, justifyContent: 'center' as const };

    if (user.id === 'me') {
      const latest = user.items[user.items.length - 1];
      if (latest) {
        const content =
          latest.type === 'image' && latest.uri ? (
            <Image source={{ uri: latest.uri }} style={thumbFill} resizeMode="cover" />
          ) : (
            (() => {
              const textStyle = resolveTextStyle(latest);
              return (
                <View style={[thumbFill, { backgroundColor: textStyle.bgColor, padding: 8 }]}>
                  <Text
                    style={{ color: textStyle.textColor, fontSize: 13, fontFamily: textStyle.fontFamily, textAlign: textStyle.textAlign, fontWeight: textStyle.bold ? '800' : '600', fontStyle: textStyle.italic ? 'italic' : 'normal' }}
                    numberOfLines={4}
                  >
                    {latest.text ?? 'My status'}
                  </Text>
                </View>
              );
            })()
          );
        return (
          <View>
            <StatusCard
              width={STATUS_CARD_WIDTH}
              height={STATUS_CARD_HEIGHT}
              hasUnseen={Boolean(user.hasUnseen)}
              palette={palette}
              label="My status"
            >
              {content}
            </StatusCard>
            {addBadge}
          </View>
        );
      }
      return (
        <View
          style={{
            width: STATUS_CARD_WIDTH,
            height: STATUS_CARD_HEIGHT,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: palette.divider,
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <View
            style={[styles.statusAdd, { backgroundColor: palette.primarySoft }]}
          >
            <KISIcon name="add" size={16} color={palette.primaryStrong} />
          </View>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>My status</Text>
        </View>
      );
    }

    // Same "first unviewed, else the first item" rule openViewer() uses -
    // keeps the thumbnail preview in sync with whatever item tapping it
    // will actually open the viewer to.
    const firstUnviewedIndex = user.items.findIndex(entry => !entry.viewed);
    const pickIndex = firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0;
    const item = user.items[pickIndex];
    let content: React.ReactNode;
    if (item?.type === 'image' && item?.uri) {
      content = <Image source={{ uri: item.uri }} style={thumbFill} resizeMode="cover" />;
    } else if (item?.type === 'video') {
      content = (
        <View style={[thumbFill, { backgroundColor: palette.card }]}>
          <KISIcon name="video" size={24} color={palette.text} />
        </View>
      );
    } else if (item?.type === 'audio') {
      content = (
        <View style={[thumbFill, { backgroundColor: palette.card }]}>
          <KISIcon name="mic" size={24} color={palette.text} />
        </View>
      );
    } else {
      const textStyle = resolveTextStyle(item);
      content = (
        <View style={[thumbFill, { backgroundColor: textStyle.bgColor, padding: 8 }]}>
          <Text
            style={{ color: textStyle.textColor, fontSize: 13, fontFamily: textStyle.fontFamily, textAlign: textStyle.textAlign, fontWeight: textStyle.bold ? '800' : '600', fontStyle: textStyle.italic ? 'italic' : 'normal' }}
            numberOfLines={4}
          >
            {item?.text ?? 'Status'}
          </Text>
        </View>
      );
    }
    return (
      <StatusCard
        width={STATUS_CARD_WIDTH}
        height={STATUS_CARD_HEIGHT}
        hasUnseen={Boolean(user.hasUnseen)}
        palette={palette}
        label={user.name}
      >
        {content}
      </StatusCard>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: responsive.isWatch ? 90 : 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primaryStrong}
          />
        }
      >
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
          <View
            style={[
              styles.statusRow,
              { paddingHorizontal: 16, flexDirection: 'row', gap: 12 },
            ]}
          >
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={`status-skel-${idx}`}>
                <Skeleton
                  width={responsive.isWatch ? 78 : 110}
                  height={responsive.isWatch ? 118 : 172}
                  radius={20}
                />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
            data={statuses}
            horizontal
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusRow}
            ListEmptyComponent={
              <Text style={{ color: palette.subtext, paddingHorizontal: 16, paddingVertical: 8 }}>
                No updates yet.
              </Text>
            }
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
                      openStatusComposer();
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
              </Pressable>
            )}
          />
        )}

        {/* Channels list */}
        <View style={[styles.sectionHeader, { marginTop: 10 }]}>
          <Text
            style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}
          >
            Channels
          </Text>
        </View>
        {(channelsLoading && channels.length === 0) ||
        (isChannelSearchActive && channelSearchLoading && channelSearchResults === null) ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <View
                key={`channel-skel-${idx}`}
                style={[
                  styles.channelCard,
                  {
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.card,
                  },
                ]}
              >
                <View style={styles.channelRow}>
                  <Skeleton width={44} height={44} radius={22} />
                  <View style={styles.channelInfo}>
                    <Skeleton width="60%" height={12} radius={6} />
                    <Skeleton
                      width="90%"
                      height={10}
                      radius={6}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : channelsError && channels.length === 0 && !isChannelSearchActive ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center', gap: 10 }}>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              Couldn't load channels.
            </Text>
            <Pressable
              onPress={() => loadChannels(true)}
              style={[styles.subscribeButton, { backgroundColor: palette.primary }]}
            >
              <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        ) : displayedChannels.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              {isChannelSearchActive
                ? 'No channels match your search.'
                : 'No channels yet.'}
            </Text>
          </View>
        ) : (
          <>
          {displayedChannels
            .map(ch => (
              <Pressable
                key={ch.id}
                onPress={() => handleOpenChannel(ch)}
                style={[
                  styles.channelCard,
                  {
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.card,
                  },
                ]}
              >
                <View style={styles.channelRow}>
                  {ch.avatar_url ? (
                    <Image
                      source={{ uri: ch.avatar_url }}
                      style={styles.channelAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.channelAvatar,
                        { backgroundColor: palette.surface },
                      ]}
                    >
                      <KISIcon
                        name="megaphone"
                        size={16}
                        color={palette.text}
                      />
                    </View>
                  )}
                  <View style={styles.channelInfo}>
                    <View style={styles.channelHeader}>
                      <Text
                        style={{
                          color: palette.text,
                          fontWeight: '700',
                          fontSize: 15,
                        }}
                      >
                        {ch.name}
                      </Text>
                      {ch.partner ? (
                        <Text
                          style={{ color: palette.primaryStrong, fontSize: 11 }}
                        >
                          Partner
                        </Text>
                      ) : null}
                    </View>
                    {ch.description ? (
                      <Text
                        style={{ color: palette.subtext, marginTop: 6 }}
                        numberOfLines={2}
                      >
                        {ch.description}
                      </Text>
                    ) : null}
                    {ch.role || ch.membership_role || ch.access ? (
                      <Text
                        style={{
                          color: palette.subtext,
                          marginTop: 6,
                          fontSize: 11,
                        }}
                      >
                        {(ch.role ?? ch.membership_role ?? ch.access) as string}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => openChannelDetail(ch)}
                    hitSlop={10}
                    style={{ padding: 6, marginLeft: 4 }}
                  >
                    <KISIcon name="info" size={18} color={palette.subtext} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          {!isChannelSearchActive && channelsNextPageUrl ? (
            <Pressable
              onPress={loadMoreChannels}
              disabled={channelsLoadingMore}
              style={{
                marginHorizontal: 16,
                marginTop: 4,
                paddingVertical: 12,
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: palette.inputBorder,
              }}
            >
              {channelsLoadingMore ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>
                  Load more channels
                </Text>
              )}
            </Pressable>
          ) : null}
          </>
        )}
      </ScrollView>

      {/* Floating create channel button */}
      <Pressable
        onPress={() => setShowCreateChannel(true)}
        style={[styles.fab, { backgroundColor: palette.primary, right: responsive.pageGutter, width: responsive.isWatch ? 46 : 52, height: responsive.isWatch ? 46 : 52, borderRadius: responsive.isWatch ? 23 : 26 }]}
      >
        <KISIcon name="add" size={18} color={palette.onPrimary} />
      </Pressable>

      {/* Channel preview + subscribe */}
      <Modal visible={channelPreviewOpen} transparent animationType="slide">
        <View style={[styles.channelPreviewBackdrop, { backgroundColor: palette.royalInk }]}>
          <Pressable
            style={styles.channelPreviewClose}
            onPress={() => {
              setChannelPreviewOpen(false);
              setPreviewChannel(null);
            }}
          />
          <View
            style={[
              styles.channelPreviewCard,
              { backgroundColor: palette.card },
            ]}
          >
            <Text
              style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}
            >
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
                {previewChannel.invite_messages.map(
                  (msg: string, idx: number) => (
                    <View
                      key={`${previewChannel?.id}-invite-${idx}`}
                      style={[
                        styles.inviteBubble,
                        { backgroundColor: palette.surfaceElevated },
                      ]}
                    >
                      <Text style={{ color: palette.text }}>{msg}</Text>
                    </View>
                  ),
                )}
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
              <Text
                style={{
                  color: palette.onPrimary,
                  fontWeight: '700',
                }}
              >
                {channelSubscribing ? 'Subscribing…' : 'Subscribe'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Channel detail sheet: avatar, description, follower state,
          owner info, follow/unfollow — Phase 3 Priority 3. Deliberately
          no cover image (not part of this product's identity, and not
          something WhatsApp Channels have either). */}
      <Modal visible={channelDetailOpen} transparent animationType="slide">
        <View style={[styles.channelPreviewBackdrop, { backgroundColor: palette.royalInk }]}>
          <Pressable
            style={styles.channelPreviewClose}
            onPress={() => {
              setChannelDetailOpen(false);
              setChannelDetail(null);
            }}
          />
          <View style={[styles.channelPreviewCard, { backgroundColor: palette.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {channelDetail?.avatar_url ? (
                <Image
                  source={{ uri: channelDetail.avatar_url }}
                  style={styles.channelAvatar}
                />
              ) : (
                <View style={[styles.channelAvatar, { backgroundColor: palette.surface }]}>
                  <KISIcon name="megaphone" size={18} color={palette.text} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
                  {channelDetail?.name ?? 'Channel'}
                </Text>
                {channelDetail?.partner ? (
                  <Text style={{ color: palette.primaryStrong, fontSize: 11 }}>Partner</Text>
                ) : null}
              </View>
            </View>

            {channelDetail?.description ? (
              <Text style={{ color: palette.subtext, marginTop: 12 }}>
                {channelDetail.description}
              </Text>
            ) : null}

            <View style={{ marginTop: 14, gap: 6 }}>
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                {typeof channelDetail?.subscriber_count === 'number'
                  ? `${channelDetail.subscriber_count} follower${channelDetail.subscriber_count === 1 ? '' : 's'}`
                  : channelDetailLoading
                    ? 'Loading followers…'
                    : ''}
              </Text>
              {channelDetail?.owner_display_name ? (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>
                  Owned by {channelDetail.owner_display_name}
                </Text>
              ) : null}
              {channelDetail?.is_subscribed && channelDetail?.member_role ? (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>
                  Your role: {channelDetail.member_role}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={() =>
                channelDetail?.is_subscribed
                  ? handleUnsubscribeChannel(channelDetail)
                  : handleFollowChannel(channelDetail)
              }
              disabled={channelFollowBusy || channelDetail?.member_role === 'owner'}
              style={({ pressed }) => [
                styles.subscribeButton,
                {
                  backgroundColor: channelDetail?.is_subscribed
                    ? palette.surfaceElevated
                    : palette.primary,
                  opacity: pressed || channelFollowBusy ? 0.75 : 1,
                  marginTop: 16,
                },
              ]}
            >
              <Text
                style={{
                  color: channelDetail?.is_subscribed ? palette.text : palette.onPrimary,
                  fontWeight: '700',
                }}
              >
                {channelDetail?.member_role === 'owner'
                  ? 'You own this channel'
                  : channelFollowBusy
                    ? 'Please wait…'
                    : channelDetail?.is_subscribed
                      ? 'Following · Tap to unfollow'
                      : 'Follow'}
              </Text>
            </Pressable>

            {channelDetail?.is_subscribed ? (
              <Pressable
                onPress={() => {
                  setChannelDetailOpen(false);
                  handleOpenChannel(channelDetail);
                }}
                style={({ pressed }) => [
                  styles.subscribeButton,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: palette.inputBorder,
                    opacity: pressed ? 0.75 : 1,
                    marginTop: 8,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>Open channel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Create channel modal */}
      <Modal visible={showCreateChannel} transparent animationType="fade">
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: palette.royalInk }]}
          onPress={() => setShowCreateChannel(false)}
        >
          <View />
        </Pressable>
        <View style={[styles.modalCard, { backgroundColor: palette.bg, }]}>
          <NewChannelForm
            palette={palette}
            onSuccess={created => {
              setShowCreateChannel(false);
              setChannels(prev => [created, ...prev]);
            }}
          />
        </View>
      </Modal>

      {/* Manage status - opened instead of a blank composer when the user
          already has active items (see openAddOrManageStatus above), so
          adding another update loads and shows what's already posted
          rather than silently starting over. */}
      <Modal visible={statusManageOpen} transparent animationType="slide" onRequestClose={() => setStatusManageOpen(false)}>
        <View style={[styles.composerBackdrop, { backgroundColor: palette.royalInk }]}>
          <View style={[styles.composerCard, { backgroundColor: palette.card }]}>
            <KISText preset="h3" color={palette.text} style={styles.composerTitle}>
              My Status
            </KISText>
            <Text style={{ color: palette.subtext }}>
              {(statusUsers.find(u => u.id === 'me')?.items.length ?? 0)} active{' '}
              {(statusUsers.find(u => u.id === 'me')?.items.length ?? 0) === 1 ? 'update' : 'updates'} - tap one to
              view it, or remove it below.
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(statusUsers.find(u => u.id === 'me')?.items ?? []).map((item, idx) => {
                const itemTextStyle = resolveTextStyle(item);
                const deleting = deletingStatusItemId === item.id;
                return (
                  <View
                    key={item.id}
                    style={[styles.manageStatusRow, { borderColor: palette.divider }]}
                  >
                    <Pressable
                      style={styles.manageStatusInfo}
                      disabled={deleting}
                      onPress={() => {
                        setStatusManageOpen(false);
                        openViewer('me', idx);
                      }}
                    >
                      {item.type === 'image' && item.uri ? (
                        <Image source={{ uri: item.uri }} style={styles.manageStatusThumb} />
                      ) : (
                        <View
                          style={[
                            styles.manageStatusThumb,
                            { backgroundColor: item.type === 'text' ? itemTextStyle.bgColor : palette.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
                          ]}
                        >
                          <KISIcon
                            name={item.type === 'video' ? 'video' : item.type === 'audio' ? 'mic' : 'chat'}
                            size={16}
                            color={item.type === 'text' ? itemTextStyle.textColor : palette.text}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '700' }} numberOfLines={1}>
                          {item.type === 'text' ? item.text || 'Text update' : `${item.type[0].toUpperCase()}${item.type.slice(1)} update`}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                          {item.visibility === 'contacts_except'
                            ? 'My contacts except...'
                            : item.visibility === 'only_share_with'
                            ? 'Only share with...'
                            : 'My contacts'}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteStatusItem(item)}
                      disabled={deleting}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove this status"
                      style={styles.manageStatusDelete}
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color={palette.subtext} />
                      ) : (
                        <KISIcon name="trash" size={18} color={palette.subtext} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.composerFooter}>
              <Pressable
                onPress={() => setStatusManageOpen(false)}
                style={({ pressed }) => [
                  styles.composerBtn,
                  { backgroundColor: pressed ? palette.surface : palette.surfaceElevated },
                ]}
              >
                <Text style={{ color: palette.text }}>Done</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStatusManageOpen(false);
                  openStatusComposer();
                }}
                style={({ pressed }) => [
                  styles.composerBtn,
                  { backgroundColor: pressed ? palette.primaryStrong : palette.primary },
                ]}
              >
                <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Add another</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status composer */}
      <Modal visible={statusComposerOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.composerBackdrop, { backgroundColor: palette.royalInk }]}>
          <View
            style={[styles.composerCard, { backgroundColor: palette.card }]}
          >
            <KISText
              preset="h3"
              color={palette.text}
              style={styles.composerTitle}
            >
              {/* "Create" only makes sense the first time - once the user
                  already has an active status, this same composer is really
                  posting another update to it, not starting from scratch. */}
              {(statusUsers.find(u => u.id === 'me')?.items.length ?? 0) > 0
                ? 'Add to status'
                : 'Create status'}
            </KISText>

            <View style={styles.composerRow}>
              <Pressable
                onPress={async () => {
                  const picked = await launchImageLibrary({
                    mediaType: 'mixed',
                    selectionLimit: 10,
                  });
                  const assets = (picked?.assets ?? []).filter(a => a?.uri);
                  if (assets.length === 0) return;
                  const type = assets[0].type?.startsWith('video')
                    ? 'video'
                    : 'image';
                  setStatusDraftType(type);
                  setStatusDraftAssets(assets);
                }}
                style={({ pressed }) => [
                  styles.composerAction,
                  {
                    backgroundColor: pressed
                      ? palette.surface
                      : palette.surfaceElevated,
                  },
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
                  {
                    backgroundColor: pressed
                      ? palette.surface
                      : palette.surfaceElevated,
                  },
                ]}
              >
                <KISIcon
                  name={isRecording ? 'stop' : 'mic'}
                  size={18}
                  color={palette.text}
                />
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
                  {
                    backgroundColor: pressed
                      ? palette.surface
                      : palette.surfaceElevated,
                  },
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
                      textAlign: statusDraftStyle.textAlign,
                      fontWeight: statusDraftStyle.bold ? '800' : '400',
                      fontStyle: statusDraftStyle.italic ? 'italic' : 'normal',
                    },
                  ]}
                />
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Background
                  </Text>
                  <View style={styles.colorRow}>
                    {STATUS_BG_COLORS.map(color => (
                      <Pressable
                        key={color}
                        onPress={() =>
                          setStatusDraftStyle(prev => ({
                            ...prev,
                            bgColor: color,
                          }))
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
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Text color
                  </Text>
                  <View style={styles.colorRow}>
                    {STATUS_TEXT_COLORS.map(color => (
                      <Pressable
                        key={color}
                        onPress={() =>
                          setStatusDraftStyle(prev => ({
                            ...prev,
                            textColor: color,
                          }))
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
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Font size
                  </Text>
                  <View style={styles.choiceRow}>
                    {STATUS_FONT_SIZES.map(size => (
                      <Pressable
                        key={size}
                        onPress={() =>
                          setStatusDraftStyle(prev => ({
                            ...prev,
                            fontSize: size,
                          }))
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
                        <Text style={{ color: palette.text, fontSize: 12 }}>
                          {size}px
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Font
                  </Text>
                  <View style={styles.choiceRow}>
                    {STATUS_FONT_FAMILIES.map(family => (
                      <Pressable
                        key={family}
                        onPress={() =>
                          setStatusDraftStyle(prev => ({
                            ...prev,
                            fontFamily: family,
                          }))
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
                        <Text style={{ color: palette.text, fontSize: 12 }}>
                          {family}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Align
                  </Text>
                  <View style={styles.choiceRow}>
                    {(['left', 'center', 'right'] as const).map(align => (
                      <Pressable
                        key={align}
                        onPress={() =>
                          setStatusDraftStyle(prev => ({
                            ...prev,
                            textAlign: align,
                          }))
                        }
                        style={[
                          styles.choiceChip,
                          {
                            borderColor:
                              statusDraftStyle.textAlign === align
                                ? palette.primary
                                : palette.inputBorder,
                            backgroundColor: palette.surfaceElevated,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.text, fontSize: 12, textTransform: 'capitalize' }}>
                          {align}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.optionRow}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Style
                  </Text>
                  <View style={styles.choiceRow}>
                    <Pressable
                      onPress={() =>
                        setStatusDraftStyle(prev => ({
                          ...prev,
                          bold: !prev.bold,
                        }))
                      }
                      style={[
                        styles.choiceChip,
                        {
                          borderColor: statusDraftStyle.bold
                            ? palette.primary
                            : palette.inputBorder,
                          backgroundColor: palette.surfaceElevated,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800' }}>
                        B
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setStatusDraftStyle(prev => ({
                          ...prev,
                          italic: !prev.italic,
                        }))
                      }
                      style={[
                        styles.choiceChip,
                        {
                          borderColor: statusDraftStyle.italic
                            ? palette.primary
                            : palette.inputBorder,
                          backgroundColor: palette.surfaceElevated,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 13, fontStyle: 'italic' }}>
                        I
                      </Text>
                    </Pressable>
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
                      const assetVideoSource = buildMediaSource(
                        asset.uri,
                        mediaHeaders,
                      );
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
                  <Text style={{ color: palette.subtext }}>
                    No media selected.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.composerFooter}>
              <Pressable
                disabled={isPublishingStatus}
                onPress={() => {
                  if (isPublishingStatus) return;
                  setStatusComposerOpen(false);
                  resetStatusDraft();
                }}
                style={({ pressed }) => [
                  styles.composerBtn,
                  {
                    backgroundColor: pressed
                      ? palette.surface
                      : palette.surfaceElevated,
                    opacity: isPublishingStatus ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isPublishingStatus}
                onPress={async () => {
                  if (isPublishingStatus) return;
                  if (statusDraftType === 'text' && !statusDraftText.trim()) {
                    Alert.alert('Status', 'Please enter some text.');
                    return;
                  }
                  if (
                    statusDraftType !== 'text' &&
                    statusDraftAssets.length === 0
                  ) {
                    Alert.alert('Status', 'Please choose a photo or video.');
                    return;
                  }
                  if (
                    statusDraftVisibility !== 'contacts' &&
                    statusDraftTargetUserIds.length === 0
                  ) {
                    Alert.alert(
                      'Status',
                      'Choose at least one contact for this audience.',
                    );
                    return;
                  }
                  setIsPublishingStatus(true);
                  try {
                    if (statusDraftType === 'text') {
                      const form = new FormData();
                      form.append('type', statusDraftType);
                      form.append('text', statusDraftText.trim());
                      form.append('style', JSON.stringify(statusDraftStyle));
                      appendStatusAudienceFields(
                        form,
                        statusDraftVisibility,
                        statusDraftTargetUserIds,
                      );
                      form.append('reply_permission', statusDraftReplyPermission);
                      const res = await postRequest(
                        ROUTES.statuses.create,
                        form,
                        {
                          errorMessage: 'Failed to create status',
                        },
                      );
                      if (!res.success) {
                        console.warn(
                          '[UpdatesTab] status post failed',
                          res.data ?? res.message,
                        );
                        Alert.alert(
                          'Status',
                          res.message || 'Failed to create status',
                        );
                        return;
                      }
                    } else {
                      // Direct-to-S3: each asset is uploaded (initiate -> PUT
                      // -> confirm) to get a stable mediaId, then the status
                      // is created from JSON referencing that mediaId — the
                      // file's bytes never pass through Django. See
                      // src/services/uploadStatusMedia.ts and
                      // apps/statuses/status_media.py.
                      for (const asset of statusDraftAssets) {
                        const isVideo = asset.type?.startsWith('video');
                        const isAudio = asset.type?.startsWith('audio');
                        const statusType = isVideo ? 'video' : isAudio ? 'audio' : 'image';
                        const purpose: StatusMediaPurpose = isVideo
                          ? 'status_video'
                          : isAudio
                          ? 'status_audio'
                          : 'status_image';

                        let mediaId: string;
                        try {
                          const uploaded = await uploadStatusMedia({
                            purpose,
                            file: {
                              uri: asset.uri,
                              name: asset.fileName || 'status',
                              type: asset.type || 'application/octet-stream',
                              size: asset.fileSize ?? asset.size,
                            },
                          });
                          mediaId = uploaded.mediaId;
                        } catch (uploadErr: any) {
                          Alert.alert(
                            'Status',
                            uploadErr?.message || 'Failed to upload status media',
                          );
                          return;
                        }

                        const durationMs =
                          typeof asset?.durationMs === 'number'
                            ? asset.durationMs
                            : typeof asset?.duration === 'number'
                            ? asset.duration > 1000
                              ? asset.duration
                              : Math.round(asset.duration * 1000)
                            : undefined;

                        const body: Record<string, unknown> = {
                          type: statusType,
                          media_id: mediaId,
                          reply_permission: statusDraftReplyPermission,
                          ...buildStatusAudienceJsonFields(
                            statusDraftVisibility,
                            statusDraftTargetUserIds,
                          ),
                        };
                        if (
                          typeof durationMs === 'number' &&
                          Number.isFinite(durationMs) &&
                          durationMs > 0
                        ) {
                          body.duration_ms = Math.round(durationMs);
                        }

                        const res = await postRequest(
                          ROUTES.statuses.create,
                          body,
                          {
                            errorMessage: 'Failed to create status',
                          },
                        );
                        if (!res.success) {
                          console.warn(
                            '[UpdatesTab] status post failed',
                            res.data ?? res.message,
                          );
                          Alert.alert(
                            'Status',
                            res.message || 'Failed to create status',
                          );
                          return;
                        }
                      }
                    }
                    setStatusComposerOpen(false);
                    resetStatusDraft();
                    await loadStatuses(true);
                    openViewer('me');
                  } finally {
                    setIsPublishingStatus(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.composerBtn,
                  {
                    backgroundColor: pressed
                      ? palette.primarySoft
                      : palette.primary,
                    opacity: isPublishingStatus ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: palette.onPrimary }}>
                  {isPublishingStatus ? 'Posting…' : 'Post'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.optionRow}>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Audience
              </Text>
              <View style={styles.choiceRow}>
                {[
                  ['contacts', 'My contacts'],
                  ['contacts_except', 'Contacts except'],
                  ['only_share_with', 'Only share with'],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setStatusDraftVisibility(value as StatusVisibility);
                      setStatusDraftTargetUserIds([]);
                    }}
                    style={[
                      styles.choiceChip,
                      {
                        borderColor:
                          statusDraftVisibility === value
                            ? palette.primary
                            : palette.inputBorder,
                        backgroundColor: palette.surfaceElevated,
                      },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 12 }}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.optionRow}>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Replies
              </Text>
              <View style={styles.choiceRow}>
                {[
                  ['contacts', 'Contacts'],
                  ['nobody', 'Nobody'],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setStatusDraftReplyPermission(
                        value as StatusReplyPermission,
                      )
                    }
                    style={[
                      styles.choiceChip,
                      {
                        borderColor:
                          statusDraftReplyPermission === value
                            ? palette.primary
                            : palette.inputBorder,
                        backgroundColor: palette.surfaceElevated,
                      },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 12 }}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {statusDraftVisibility !== 'contacts' ? (
              <View style={styles.optionRow}>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Selected contacts
                </Text>
                <View style={styles.choiceRow}>
                  {availableAudienceContacts.length > 0 ? (
                    availableAudienceContacts.map(contact => {
                      const contactUserId = String(contact.userId);
                      const selected =
                        statusDraftTargetUserIds.includes(contactUserId);
                      return (
                        <Pressable
                          key={contactUserId}
                          onPress={() =>
                            handleStatusAudienceToggle(contactUserId)
                          }
                          style={[
                            styles.choiceChip,
                            {
                              borderColor: selected
                                ? palette.primary
                                : palette.inputBorder,
                              backgroundColor: selected
                                ? palette.primarySoft
                                : palette.surfaceElevated,
                            },
                          ]}
                        >
                          <Text style={{ color: palette.text, fontSize: 12 }}>
                            {contact.name}
                          </Text>
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={{ color: palette.subtext }}>
                      No registered contacts available for custom status
                      audiences.
                    </Text>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Status viewer */}
      {/* statusBarTranslucent matters specifically for Android inset
          correctness here - ActiveCallScreen.tsx's own full-screen Modal
          (the other place in this app driving overlay controls off
          useSafeAreaInsets() inside a Modal) sets the same prop. Without
          it, useSafeAreaInsets().top can read back near-zero on Android
          inside a Modal since the OS may already be reserving the status-
          bar area itself rather than reporting it as an inset to measure. */}
      <Modal visible={viewerOpen} transparent animationType="fade" statusBarTranslucent>
        {/* Not SafeAreaView here - a Modal presents as its own full-screen
            native surface, and SafeAreaView's automatic top-edge padding was
            unreliable in that context (most visibly on Android, where
            SafeAreaView commonly reads a near-zero inset unless edge-to-edge
            is fully configured - the same class of bug useRawTopInset()
            already works around for the rest of the app). Driving the close
            button, progress bar, and menu button off viewerTopInset directly
            - the same pattern already used for ActiveCallScreen's own
            full-screen overlay controls - so this box is correct on both
            platforms and every notch/Dynamic Island/status-bar
            configuration regardless of how the Modal itself renders. */}
        <Animated.View
          style={[
            styles.viewerWrap,
            {
              backgroundColor: palette.bg,
              transform: [{ translateY: viewerDragY }],
              opacity: viewerDragY.interpolate({
                inputRange: [0, 300],
                outputRange: [1, 0.4],
                extrapolate: 'clamp',
              }),
            },
          ]}
          {...dismissPanResponder.panHandlers}
        >
          {/* Full-bleed photo/video layer - sits behind the scrim, progress
              bar, and header (all zIndex 10+) so images and videos fill the
              entire screen edge to edge like every other world-standard
              story viewer, instead of floating as a padded rounded card in
              the middle of the screen. Text/audio keep their own centered
              card below since they were never the ones asked to go
              full-bleed. */}
          {currentItem?.type === 'video' && currentItem?.uri ? (
            <Video
              ref={videoRef}
              source={viewerMediaSource ?? { uri: currentItem.uri }}
              style={styles.viewerMediaFill}
              resizeMode="cover"
              paused={!viewerOpen || mediaPaused}
              onLoad={e => {
                mediaDurationRef.current = e.duration ?? 0;
              }}
              onProgress={e => {
                const dur =
                  mediaDurationRef.current ||
                  e.seekableDuration ||
                  e.playableDuration ||
                  0;
                if (dur > 0)
                  setViewerProgress(Math.min(1, e.currentTime / dur));
                lastMediaProgressRef.current = Date.now();
              }}
              onEnd={handleNext}
            />
          ) : currentItem?.type === 'image' && currentItem?.uri ? (
            <>
              <Image
                source={{ uri: currentItem.uri }}
                style={styles.viewerMediaFill}
                resizeMode="cover"
                onLoadEnd={() => setReadyImageId(currentItem.id)}
                onError={() => setReadyImageId(currentItem.id)}
              />
              {!imageReady ? (
                <View style={styles.viewerImageLoading}>
                  <ActivityIndicator color={palette.goldReadable} />
                </View>
              ) : null}
            </>
          ) : null}

          {/* Top gradient scrim - keeps the progress bars/header legible
              over any bright photo/video content, the same way every
              world-standard story viewer darkens the top edge rather than
              relying on the raw media contrast alone. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            style={styles.viewerTopScrim}
            pointerEvents="none"
          />

          <View
            style={[styles.viewerProgressRow, { paddingTop: viewerTopInset + 12 }]}
            pointerEvents="auto"
          >
            {(activeUser?.items ?? []).map((item, idx) => {
              const fill =
                idx < viewerIndex
                  ? 1
                  : idx === viewerIndex
                  ? viewerProgress
                  : 0;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setViewerIndex(idx);
                    setViewerProgress(0);
                  }}
                  style={styles.progressTrack}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(
                          Math.max(0, Math.min(1, fill)) * 100,
                        )}%`,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Who/when header - every world-standard status/story viewer
              shows this prominently under the progress bar; there was
              previously no way to tell whose status you were looking at,
              or how recent it was, without backing out to the list. */}
          {activeUser ? (
            <View style={styles.viewerHeaderRow} pointerEvents="none">
              <View style={[styles.viewerHeaderAvatar, { backgroundColor: palette.surfaceElevated }]}>
                {activeUser.avatar ? (
                  <Image source={{ uri: activeUser.avatar }} style={styles.viewerHeaderAvatarImg} />
                ) : (
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: 14 }}>
                    {(activeUser.name || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ marginLeft: 10, flexShrink: 1 }}>
                <Text style={styles.viewerHeaderName} numberOfLines={1}>
                  {activeUser.id === 'me' ? 'My status' : activeUser.name}
                </Text>
                {currentItem?.createdAt ? (
                  <Text style={styles.viewerHeaderTime}>{timeAgo(currentItem.createdAt)}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <Pressable
            style={[styles.viewerClose, { top: viewerTopInset + 8 }]}
            onPress={closeViewer}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <KISIcon name="close" size={18} color={palette.text} />
          </Pressable>
          {activeUser?.userId && activeUser.userId !== currentUserId ? (
            <Pressable
              style={[
                styles.viewerMenuButton,
                {
                  top: viewerTopInset + 42,
                  backgroundColor: palette.surfaceElevated,
                  borderColor: palette.inputBorder,
                },
              ]}
              onPress={handleStatusActionMenu}
            >
              <Text
                style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}
              >
                More
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.viewerTapZone}
            onPressIn={handleTapHoldStart}
            onPressOut={() => handleTapHoldEnd(handlePrev)}
          />
          <Pressable
            style={[styles.viewerTapZone, { left: '50%' }]}
            onPressIn={handleTapHoldStart}
            onPressOut={() => handleTapHoldEnd(handleNext)}
          />

          <View style={styles.viewerContent}>
            {currentItem?.type === 'text' ? (
              <View
                style={[
                  styles.viewerTextCard,
                  { backgroundColor: resolveTextStyle(currentItem).bgColor },
                ]}
              >
                {textExpanded ? (
                  <ScrollView style={{ maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
                    <Text
                      style={{
                        color: resolveTextStyle(currentItem).textColor,
                        fontSize: resolveTextStyle(currentItem).fontSize,
                        fontFamily: resolveTextStyle(currentItem).fontFamily,
                        textAlign: resolveTextStyle(currentItem).textAlign,
                        fontWeight: resolveTextStyle(currentItem).bold ? '800' : '600',
                        fontStyle: resolveTextStyle(currentItem).italic ? 'italic' : 'normal',
                      }}
                    >
                      {currentItem?.text ?? 'Status'}
                    </Text>
                  </ScrollView>
                ) : (
                  <Text
                    numberOfLines={TEXT_STATUS_COLLAPSED_LINES}
                    onTextLayout={e => {
                      if (e.nativeEvent.lines.length >= TEXT_STATUS_COLLAPSED_LINES) {
                        setTextTruncated(true);
                      }
                    }}
                    style={{
                      color: resolveTextStyle(currentItem).textColor,
                      fontSize: resolveTextStyle(currentItem).fontSize,
                      fontFamily: resolveTextStyle(currentItem).fontFamily,
                      textAlign: resolveTextStyle(currentItem).textAlign,
                      fontWeight: resolveTextStyle(currentItem).bold ? '800' : '600',
                      fontStyle: resolveTextStyle(currentItem).italic ? 'italic' : 'normal',
                    }}
                  >
                    {currentItem?.text ?? 'Status'}
                  </Text>
                )}
                {textTruncated ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      if (textExpanded) {
                        setTextExpanded(false);
                        endManualPause();
                      } else {
                        setTextExpanded(true);
                        beginManualPause();
                      }
                    }}
                  >
                    <Text style={{ color: palette.subtext, marginTop: 8, fontWeight: '700' }}>
                      {textExpanded ? 'Show less' : 'more'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : currentItem?.type === 'audio' && currentItem?.uri ? (
              <View style={styles.audioViewer}>
                <Video
                  source={viewerMediaSource ?? { uri: currentItem.uri }}
                  style={styles.audioHidden}
                  paused={!viewerOpen || mediaPaused}
                  audioOnly
                  playInBackground
                  ignoreSilentSwitch="ignore"
                  onLoad={e => {
                    mediaDurationRef.current = e.duration ?? 0;
                  }}
                  onProgress={e => {
                    const dur =
                      mediaDurationRef.current ||
                      e.seekableDuration ||
                      e.playableDuration ||
                      0;
                    if (dur > 0)
                      setViewerProgress(Math.min(1, e.currentTime / dur));
                    lastMediaProgressRef.current = Date.now();
                  }}
                  onEnd={handleNext}
                />
                <KISIcon name="mic" size={28} color={palette.text} />
                <Text
                  style={{ color: palette.text, fontSize: 16, marginTop: 8 }}
                >
                  Audio status
                </Text>
                <Pressable
                  onPress={() => setMediaPaused(prev => !prev)}
                  style={[
                    styles.audioButton,
                    {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.inputBorder,
                    },
                  ]}
                >
                  <KISIcon
                    name={mediaPaused ? 'play' : 'pause'}
                    size={18}
                    color={palette.text}
                  />
                  <Text style={{ color: palette.text }}>
                    {mediaPaused ? 'Play' : 'Pause'}
                  </Text>
                </Pressable>
              </View>
            ) : currentItem?.type === 'video' || currentItem?.type === 'image' ? null : (
              <View
                style={[
                  styles.viewerTextCard,
                  { backgroundColor: palette.card },
                ]}
              >
                <Text style={{ color: palette.subtext }}>No preview</Text>
              </View>
            )}
          </View>

          {/* Seekable video progress bar — only shown for video items */}
          {currentItem?.type === 'video' && seekPanResponder && (
            <View
              style={styles.videoSeekRow}
              onLayout={e => { seekBarWidthRef.current = e.nativeEvent.layout.width; }}
              {...seekPanResponder.panHandlers}
            >
              <View style={[styles.videoSeekTrack, { backgroundColor: palette.divider }]}>
                <View
                  style={[
                    styles.videoSeekFill,
                    { width: `${Math.round(Math.max(0, Math.min(1, viewerProgress)) * 100)}%`, backgroundColor: palette.ivory },
                  ]}
                />
                <View
                  style={[
                    styles.videoSeekThumb,
                    { left: `${Math.round(Math.max(0, Math.min(1, viewerProgress)) * 100)}%`, backgroundColor: palette.ivory },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Status reply input — shown for other users' statuses when replies are allowed */}
          {activeUser && activeUser.id !== 'me' && activeUser.userId !== currentUserId && currentItem?.replyPermission !== 'nobody' && (
            <View style={[styles.viewerReplyRow, { backgroundColor: palette.royalInk }]}>
              <TextInput
                value={viewerReplyText}
                onChangeText={setViewerReplyText}
                placeholder={`Reply to ${activeUser.name}…`}
                placeholderTextColor={palette.subtext}
                style={[styles.viewerReplyInput, { color: palette.ivory, borderColor: palette.divider }]}
                returnKeyType="send"
                onSubmitEditing={handleSendReply}
                onFocus={beginManualPause}
                onBlur={endManualPause}
              />
              <Pressable
                onPress={handleSendReply}
                disabled={sendingReply || !viewerReplyText.trim()}
                style={[styles.viewerReplySend, { backgroundColor: palette.primary }]}
              >
                <KISIcon name="send" size={16} color={palette.onPrimary} />
              </Pressable>
            </View>
          )}

          {/* Seen-by count for own statuses */}
          {activeUser && (activeUser.id === 'me' || activeUser.userId === currentUserId) && currentItem && (
            <Pressable
              style={styles.viewerSeenRow}
              onPress={async () => {
                setSeenBySheetOpen(true);
                setSeenByLoading(true);
                const res = await getRequest(ROUTES.statuses.viewers(currentItem.id), {});
                const viewers: any[] = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
                setSeenByViewers(viewers);
                setSeenByLoading(false);
              }}
            >
              <KISIcon name="eye" size={14} color={palette.ivory} />
              <Text style={{ color: palette.ivory, fontSize: 12, marginLeft: 4 }}>
                {currentItem.viewed ? 'Seen' : 'Not yet seen'}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </Modal>

      {/* Themed replacement for the native Alert.alert(...) this screen used
          for the status "More" menu and the delete-confirmation - a plain
          system dialog looked jarring popping up over a custom full-bleed
          dark viewer. */}
      <Modal visible={Boolean(actionSheet)} transparent animationType="fade" onRequestClose={() => setActionSheet(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionSheet(null)}>
          <Pressable style={[styles.sheetCard, { backgroundColor: palette.surfaceElevated }]} onPress={() => {}}>
            {actionSheet?.title ? (
              <Text style={[styles.sheetTitle, { color: palette.text }]}>{actionSheet.title}</Text>
            ) : null}
            {actionSheet?.subtitle ? (
              <Text style={[styles.sheetSubtitle, { color: palette.subtext }]}>{actionSheet.subtitle}</Text>
            ) : null}
            {(actionSheet?.options ?? []).map(option => (
              <Pressable
                key={option.key}
                onPress={option.onPress}
                style={({ pressed }) => [
                  styles.sheetOptionRow,
                  { borderColor: palette.inputBorder, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {option.icon ? (
                  <KISIcon name={option.icon} size={18} color={option.destructive ? palette.danger : palette.text} />
                ) : null}
                <Text
                  style={[
                    styles.sheetOptionLabel,
                    { color: option.destructive ? palette.danger : palette.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setActionSheet(null)}
              style={({ pressed }) => [styles.sheetCancelRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.sheetOptionLabel, { color: palette.subtext, fontWeight: '700' }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Themed replacement for the native Alert.alert(...) "Seen by" this
          screen used to just join viewer names with '\n' - a real list with
          avatars and relative view times instead. */}
      <Modal visible={seenBySheetOpen} transparent animationType="fade" onRequestClose={() => setSeenBySheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSeenBySheetOpen(false)}>
          <Pressable style={[styles.sheetCard, { backgroundColor: palette.surfaceElevated, maxHeight: '70%' }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>
              {seenByLoading ? 'Seen by…' : `Seen by ${seenByViewers.length}`}
            </Text>
            {seenByLoading ? (
              <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 20 }} />
            ) : seenByViewers.length === 0 ? (
              <Text style={[styles.sheetSubtitle, { color: palette.subtext, marginVertical: 12 }]}>
                No one has viewed this status yet.
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
                {seenByViewers.map((viewer: any, idx: number) => {
                  const name = viewer.display_name ?? viewer.viewer_name ?? viewer.viewer_id ?? 'Someone';
                  return (
                    <View key={viewer.id ?? viewer.viewer_id ?? idx} style={styles.seenByRow}>
                      <View style={[styles.seenByAvatar, { backgroundColor: palette.card }]}>
                        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 13 }}>
                          {String(name).trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: palette.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                        {name}
                      </Text>
                      {viewer.viewed_at ? (
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>{timeAgo(viewer.viewed_at)}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <Pressable
              onPress={() => setSeenBySheetOpen(false)}
              style={({ pressed }) => [styles.sheetCancelRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.sheetOptionLabel, { color: palette.subtext, fontWeight: '700' }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

export default UpdatesTab;

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  statusRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  statusCard: {},
  statusAdd: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
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
  },
  channelPreviewBackdrop: {
    flex: 1,
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
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manageStatusInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manageStatusThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  manageStatusDelete: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerWrap: { flex: 1 },
  viewerTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 10,
  },
  viewerProgressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 12,
    zIndex: 20,
  },
  viewerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingRight: 90,
    zIndex: 20,
  },
  viewerHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  viewerHeaderAvatarImg: { width: 32, height: 32 },
  viewerHeaderName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  viewerHeaderTime: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
  viewerMenuButton: {
    position: 'absolute',
    top: 42,
    right: 56,
    zIndex: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#fff',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetSubtitle: { fontSize: 13, marginTop: 4 },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  sheetOptionLabel: { fontSize: 15, fontWeight: '600' },
  sheetCancelRow: { paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  seenByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  seenByAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 8,
    right: 16,
    padding: 13,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  videoSeekRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 15,
  },
  videoSeekTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'visible',
    justifyContent: 'center',
  },
  videoSeekFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 4,
    borderRadius: 999,
  },
  videoSeekThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  viewerReplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    zIndex: 15,
  },
  viewerReplyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  viewerReplySend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerSeenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
    zIndex: 15,
  },
  viewerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  // Edge-to-edge behind the scrim/progress bar/header (all zIndex 10+) -
  // see the layer stacked right after viewerWrap opens.
  viewerMediaFill: {
    ...StyleSheet.absoluteFillObject,
  },
  viewerImageLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
