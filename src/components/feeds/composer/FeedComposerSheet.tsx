// src/components/feeds/composer/FeedComposerSheet.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';

import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISDateTimeInput from '@/constants/KISDateTimeInput';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';
import {
  createChannelPlaylist,
  fetchChannelPlaylists,
  useChannelsData,
} from '@/screens/broadcast/channels/hooks/useChannelsData';
import type { BroadcastChannelPlaylist } from '@/screens/broadcast/channels/api/channels.types';
import {
  clearComposerDraft,
  deleteComposerTemplate,
  loadComposerDraft,
  loadComposerTemplates,
  saveComposerDraft,
  saveComposerTemplate,
  type ComposerDraftFields,
  type ComposerDraftSnapshot,
  type ComposerTemplate,
} from './draftStorage';

import {
  DEFAULT_EVENT_SETTINGS,
  DEFAULT_LINK_SETTINGS,
  DEFAULT_POLL_SETTINGS,
} from './types';
import type {
  ChannelComposerContext,
  ComposerType,
  EventSettings,
  FeedComposerPayload,
  LinkSettings,
  PollSettings,
  RichComposerState,
} from './types';
import { stateToDoc } from './richTextUtils';
import { MediaComposerPage } from './pages/MediaComposerPage';
import { PollComposerPage } from './pages/PollComposerPage';
import { EventComposerPage } from './pages/EventComposerPage';
import { LinkComposerPage } from './pages/LinkComposerPage';
import { TextComposerPage } from './pages/TextComposerPage';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: FeedComposerPayload) => Promise<void> | void;
  channelContext?: ChannelComposerContext;
};

export default function FeedComposerSheet({
  visible,
  onClose,
  onSubmit,
  channelContext,
}: Props) {
  const { palette } = useKISTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const channelLabel = channelContext?.channelHandle
    ? `@${String(channelContext.channelHandle).replace(/^@/, '')}`
    : channelContext?.channelName || '';

  const [step, setStep] = useState<'picker' | 'form'>('picker');
  const [type, setType] = useState<ComposerType>('text');

  const [rich, setRich] = useState<RichComposerState>({
    text: '',
    spans: [],
    blocks: {},
    defaultAlign: 'left',
    styledBg: undefined,
  });

  const [link, setLink] = useState('');
  const [linkSettings, setLinkSettings] = useState<LinkSettings>(DEFAULT_LINK_SETTINGS);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [videoThumbUri, setVideoThumbUri] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollSettings, setPollSettings] = useState<PollSettings>(DEFAULT_POLL_SETTINGS);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventSettings, setEventSettings] = useState<EventSettings>(DEFAULT_EVENT_SETTINGS);

  const [submitting, setSubmitting] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Post settings — distribution controls. All four of these already round
  // -trip through appendBroadcastFeedExtras in useProfileController.ts
  // (visibility/scheduled_at/thumbnail_url/embed_allowed form fields); they
  // just never had UI controls before, and silently took whatever (if
  // anything) channelContext happened to pass in.
  const [visibility, setVisibility] = useState<
    'public' | 'unlisted' | 'private' | 'members_only'
  >((channelContext?.visibility as any) || 'public');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(
    channelContext?.scheduledAt ?? null,
  );
  const [thumbnail, setThumbnail] = useState<string | null>(
    channelContext?.thumbnail ?? null,
  );
  const [embedAllowed, setEmbedAllowed] = useState<boolean>(
    Boolean(channelContext?.embedAllowed),
  );

  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<BroadcastChannelPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // "Also post to" — lets the composer fan a single draft out to several
  // channels at once instead of forcing one open-compose-submit cycle per
  // channel. Each instance of FeedComposerSheet owns this independently
  // (see the FeedComposerSheet prop-drilling removal elsewhere), so this
  // fetches "my channels" locally rather than depending on a parent.
  const [crossPostChannelIds, setCrossPostChannelIds] = useState<string[]>([]);
  const { channels: myChannels } = useChannelsData({ mine: true });
  const otherChannels = useMemo(
    () => myChannels.filter(ch => ch.id !== channelContext?.channelId),
    [myChannels, channelContext?.channelId],
  );

  useEffect(() => {
    if (!visible || !channelContext?.channelId) {
      setPlaylists([]);
      return;
    }
    let cancelled = false;
    setLoadingPlaylists(true);
    fetchChannelPlaylists(channelContext.channelId)
      .then(rows => {
        if (!cancelled) setPlaylists(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlaylists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, channelContext?.channelId]);

  const togglePlaylist = useCallback((playlistId: string) => {
    setPlaylistIds(prev =>
      prev.includes(playlistId)
        ? prev.filter(id => id !== playlistId)
        : [...prev, playlistId],
    );
  }, []);

  const toggleCrossPostChannel = useCallback((channelId: string) => {
    setCrossPostChannelIds(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId],
    );
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    if (!channelContext?.channelId || !newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      const created = await createChannelPlaylist(channelContext.channelId, {
        title: newPlaylistName.trim(),
      });
      setPlaylists(prev => [...prev, created]);
      setPlaylistIds(prev => [...prev, created.id]);
      setNewPlaylistName('');
    } catch (error: any) {
      Alert.alert('Playlist', error?.message || 'Unable to create playlist.');
    } finally {
      setCreatingPlaylist(false);
    }
  }, [channelContext?.channelId, newPlaylistName]);

  const [formError, setFormError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [pendingDraft, setPendingDraft] = useState<ComposerDraftSnapshot | null>(null);
  const [templates, setTemplates] = useState<ComposerTemplate[]>([]);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const currentDraftFields = useCallback(
    (): ComposerDraftFields => ({
      type,
      rich,
      link,
      linkSettings,
      pollQuestion,
      pollOptions,
      pollSettings,
      eventTitle,
      eventStartsAt,
      eventLocation,
      eventSettings,
      visibility,
      scheduleEnabled,
      scheduledAt,
      thumbnail,
      embedAllowed,
      playlistIds,
    }),
    [
      type,
      rich,
      link,
      linkSettings,
      pollQuestion,
      pollOptions,
      pollSettings,
      eventTitle,
      eventStartsAt,
      eventLocation,
      eventSettings,
      visibility,
      scheduleEnabled,
      scheduledAt,
      thumbnail,
      embedAllowed,
      playlistIds,
    ],
  );

  const applyDraft = useCallback((fields: ComposerDraftFields) => {
    setType(fields.type);
    setRich(fields.rich);
    setLink(fields.link);
    setLinkSettings(fields.linkSettings ?? DEFAULT_LINK_SETTINGS);
    setPollQuestion(fields.pollQuestion);
    setPollOptions(fields.pollOptions);
    setPollSettings(fields.pollSettings ?? DEFAULT_POLL_SETTINGS);
    setEventTitle(fields.eventTitle);
    setEventStartsAt(fields.eventStartsAt);
    setEventLocation(fields.eventLocation);
    setEventSettings(fields.eventSettings ?? DEFAULT_EVENT_SETTINGS);
    setVisibility(fields.visibility);
    setScheduleEnabled(fields.scheduleEnabled);
    setScheduledAt(fields.scheduledAt);
    setThumbnail(fields.thumbnail);
    setEmbedAllowed(fields.embedAllowed);
    setPlaylistIds(fields.playlistIds);
    setStep('form');
  }, []);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    applyDraft(pendingDraft);
    setPendingDraft(null);
  }, [pendingDraft, applyDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearComposerDraft(channelContext?.channelId ?? null);
    setPendingDraft(null);
  }, [channelContext?.channelId]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateNameInput.trim()) return;
    setSavingTemplate(true);
    try {
      const next = await saveComposerTemplate(templateNameInput.trim(), currentDraftFields());
      setTemplates(next);
      setTemplateNameInput('');
    } finally {
      setSavingTemplate(false);
    }
  }, [templateNameInput, currentDraftFields]);

  const handleLoadTemplate = useCallback(
    (template: ComposerTemplate) => {
      applyDraft(template);
    },
    [applyDraft],
  );

  const handleDeleteTemplate = useCallback(async (id: string) => {
    const next = await deleteComposerTemplate(id);
    setTemplates(next);
  }, []);

  const slideX = useRef(new Animated.Value(screenWidth)).current;

  // channelContext is rebuilt fresh on every render by callers (it's an
  // inline toChannelComposerContext(...) call, not memoized), so it can't
  // go in the effect below's deps without re-syncing — and stomping the
  // user's own picks — on every keystroke while the sheet is open. A ref
  // gives the open-sync effect a stable read of "whatever channelContext
  // currently is" without taking on that dependency.
  const channelContextRef = useRef(channelContext);
  channelContextRef.current = channelContext;

  useEffect(() => {
    if (!visible) return;
    setStep('picker');
    setType('text');
    const ctx = channelContextRef.current;
    setVisibility((ctx?.visibility as any) || 'public');
    setScheduledAt(ctx?.scheduledAt ?? null);
    setScheduleEnabled(Boolean(ctx?.scheduledAt));
    setThumbnail(ctx?.thumbnail ?? null);
    setEmbedAllowed(Boolean(ctx?.embedAllowed));
    loadComposerDraft(ctx?.channelId ?? null).then(setPendingDraft);
    loadComposerTemplates().then(setTemplates);
    slideX.setValue(screenWidth);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, slideX, screenWidth]);

  const resetAll = useCallback(() => {
    setRich({
      text: '',
      spans: [],
      blocks: {},
      defaultAlign: 'left',
      styledBg: undefined,
    });
    setLink('');
    setLinkSettings(DEFAULT_LINK_SETTINGS);
    setAttachments([]);
    setVideoThumbUri(null);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollSettings(DEFAULT_POLL_SETTINGS);
    setEventTitle('');
    setEventStartsAt('');
    setEventLocation('');
    setEventSettings(DEFAULT_EVENT_SETTINGS);
    setVisibility('public');
    setScheduleEnabled(false);
    setScheduledAt(null);
    setThumbnail(null);
    setEmbedAllowed(false);
    setPlaylistIds([]);
    setNewPlaylistName('');
    setCrossPostChannelIds([]);
    setFormError(null);
    setPreviewMode(false);
  }, []);

  const closeSheet = useCallback(() => {
    Animated.timing(slideX, {
      toValue: screenWidth,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      resetAll();
      onClose();
    });
  }, [slideX, screenWidth, onClose, resetAll]);
  const hasDraftContent = useCallback(() => {
    if (step !== 'form') return false;
    if (rich.text.trim().length) return true;
    if (attachments.length) return true;
    if (link.trim().length) return true;
    if (pollQuestion.trim().length) return true;
    if (eventTitle.trim().length) return true;
    return false;
  }, [step, rich.text, attachments, link, pollQuestion, eventTitle]);

  // Debounced autosave — attachments are deliberately excluded (see
  // draftStorage.ts), so this only ever restores text/poll/event/link
  // fields plus the distribution settings above.
  useEffect(() => {
    if (!visible || !hasDraftContent()) return;
    const handle = setTimeout(() => {
      saveComposerDraft(channelContext?.channelId ?? null, currentDraftFields());
    }, 900);
    return () => clearTimeout(handle);
  }, [visible, hasDraftContent, currentDraftFields, channelContext?.channelId]);

  // Closing used to discard whatever the user had drafted immediately and
  // silently — no confirm, no undo. Now only a page with actual drafted
  // content asks before discarding; empty/picker-step dismissal still
  // closes instantly.
  const requestClose = useCallback(() => {
    if (!hasDraftContent()) {
      closeSheet();
      return;
    }
    Alert.alert(
      'Discard post?',
      "You'll lose what you've written if you leave now.",
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: closeSheet },
      ],
    );
  }, [hasDraftContent, closeSheet]);

  const requestBackToPicker = useCallback(() => {
    if (!hasDraftContent()) {
      setStep('picker');
      return;
    }
    Alert.alert(
      'Discard this post?',
      "Going back loses what you've written.",
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setStep('picker') },
      ],
    );
  }, [hasDraftContent]);

  const handleStartOver = useCallback(() => {
    if (!hasDraftContent()) {
      resetAll();
      return;
    }
    Alert.alert(
      'Start over?',
      "This clears everything you've entered for this post.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start over', style: 'destructive', onPress: resetAll },
      ],
    );
  }, [hasDraftContent, resetAll]);

  const options = useMemo(
    () => [
      { key: 'text', label: 'Text', icon: 'edit' },
      { key: 'image', label: 'Image', icon: 'image' },
      { key: 'video', label: 'Video', icon: 'video' },
      { key: 'short_video', label: 'Short video', icon: 'video' },
      { key: 'document', label: 'PDF / Word', icon: 'file-pdf' },
      { key: 'audio', label: 'Audio', icon: 'audio' },
      { key: 'poll', label: 'Poll', icon: 'poll' },
      { key: 'event', label: 'Event', icon: 'calendar' },
      { key: 'link', label: 'Link', icon: 'copy' },
    ],
    [],
  );

  const renderFormBody = () => {
    if (type === 'text') {
      return <TextComposerPage rich={rich} setRich={setRich} />;
    }

    if (type === 'poll') {
      return (
        <PollComposerPage
          pollQuestion={pollQuestion}
          setPollQuestion={setPollQuestion}
          pollOptions={pollOptions}
          setPollOptions={setPollOptions}
          pollSettings={pollSettings}
          setPollSettings={setPollSettings}
        />
      );
    }

    if (type === 'event') {
      return (
        <EventComposerPage
          eventTitle={eventTitle}
          setEventTitle={setEventTitle}
          eventStartsAt={eventStartsAt}
          setEventStartsAt={setEventStartsAt}
          eventLocation={eventLocation}
          setEventLocation={setEventLocation}
          eventSettings={eventSettings}
          setEventSettings={setEventSettings}
        />
      );
    }

    if (type === 'link') {
      return (
        <LinkComposerPage
          link={link}
          setLink={setLink}
          caption={rich.text}
          setCaption={t => setRich(p => ({ ...p, text: t }))}
          linkSettings={linkSettings}
          setLinkSettings={setLinkSettings}
        />
      );
    }

    // image/video/short_video/document/audio
    return (
      <MediaComposerPage
        type={type}
        rich={rich}
        setRich={setRich}
        attachments={attachments}
        setAttachments={setAttachments}
        videoThumbUri={videoThumbUri}
        setVideoThumbUri={setVideoThumbUri}
      />
    );
  };

  const pickThumbnail = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const uri = result.assets[0]?.uri;
    if (uri) setThumbnail(uri);
  }, []);

  const submit = useCallback(async () => {
    if (submitting) return;
    setFormError(null);

    const payload: FeedComposerPayload = {};
    const trimmed = rich.text.trim();

    if (type === 'text') {
      if (!trimmed) {
        setFormError('Write something before posting.');
        return;
      }
      payload.text = stateToDoc(rich);
      payload.textPlain = trimmed;
      payload.textPreview = trimmed.slice(0, 200);
    }

    const normalizeAttachmentKind = (attachment: any) => {
      if (type === 'short_video') return { ...attachment, kind: 'short_video' };
      if (type === 'video') return { ...attachment, kind: 'video' };
      return attachment;
    };

    if (['image', 'video', 'short_video', 'document', 'audio'].includes(type)) {
      if (!attachments.length && !trimmed) {
        setFormError('Add a file or write a caption.');
        return;
      }

      if (
        (type === 'video' || type === 'short_video') &&
        attachments.length &&
        videoThumbUri
      ) {
        payload.attachments = [
          {
            ...normalizeAttachmentKind(attachments[0]),
            thumbUrl: videoThumbUri,
          },
        ];
      } else {
        payload.attachments = attachments.map(normalizeAttachmentKind);
      }

      payload.textPlain = trimmed || undefined;
      payload.textPreview = trimmed ? trimmed.slice(0, 200) : undefined;
      payload.text = trimmed ? stateToDoc(rich) : undefined;
    }

    if (type === 'poll') {
      const opts = pollOptions.map(o => o.trim()).filter(Boolean);
      if (!pollQuestion.trim()) {
        setFormError('Add a poll question.');
        return;
      }
      if (opts.length < 2) {
        setFormError('Add at least 2 poll options.');
        return;
      }
      payload.poll = {
        question: pollQuestion.trim(),
        options: opts.map((opt, idx) => ({ id: `opt_${idx + 1}`, text: opt })),
        allowMultiple: pollSettings.allowMultiple,
        duration: pollSettings.duration,
        randomizeOrder: pollSettings.randomizeOrder,
        showResultsBeforeVoting: pollSettings.showResultsBeforeVoting,
        anonymous: pollSettings.anonymous,
      };
    }

    if (type === 'event') {
      if (!eventTitle.trim()) {
        setFormError('Add an event title.');
        return;
      }
      if (!eventStartsAt.trim()) {
        setFormError('Pick a start date and time.');
        return;
      }
      if (
        eventSettings.endsAt &&
        new Date(eventSettings.endsAt).getTime() < new Date(eventStartsAt).getTime()
      ) {
        setFormError('Event end time must be after the start time.');
        return;
      }
      payload.event = {
        title: eventTitle.trim(),
        startsAt: eventStartsAt.trim(),
        location: eventSettings.isOnline
          ? eventSettings.onlineUrl.trim() || undefined
          : eventLocation.trim() || undefined,
        endsAt: eventSettings.endsAt || undefined,
        allDay: eventSettings.allDay,
        isOnline: eventSettings.isOnline,
        rsvpCapacity: eventSettings.rsvpCapacity
          ? Number(eventSettings.rsvpCapacity) || undefined
          : undefined,
        reminder: eventSettings.reminder,
        description: eventSettings.description.trim() || undefined,
        coverImage: eventSettings.coverImage || undefined,
        repeats: eventSettings.repeats,
        addToCalendar: eventSettings.addToCalendar,
        category: eventSettings.category.trim() || undefined,
      };
    }

    if (type === 'link') {
      const trimmedLink = link.trim();
      if (!trimmedLink) {
        setFormError('Paste a link first.');
        return;
      }
      if (!/^https?:\/\//i.test(trimmedLink)) {
        setFormError('Link must start with http:// or https://');
        return;
      }
      payload.link = trimmedLink;
      payload.linkPreviewTitle = linkSettings.previewTitle.trim() || undefined;
      payload.linkPreviewDescription = linkSettings.previewDescription.trim() || undefined;
      payload.linkPreviewImage = linkSettings.previewImage || undefined;
      payload.linkOpenExternally = linkSettings.openExternally;
      if (trimmed) {
        payload.textPlain = trimmed;
        payload.textPreview = trimmed.slice(0, 200);
        payload.text = stateToDoc(rich);
      }
    }

    payload.composerType = type;
    payload.contentType = channelContext?.contentType || type;
    payload.content_type = channelContext?.contentType || type;
    payload.visibility = visibility;
    const effectiveScheduledAt = scheduleEnabled ? scheduledAt || undefined : null;
    payload.scheduledAt = effectiveScheduledAt;
    payload.scheduled_at = effectiveScheduledAt;
    payload.playlistIds = playlistIds;
    payload.playlist_ids = playlistIds;
    const effectiveThumbnail = thumbnail || videoThumbUri || null;
    payload.thumbnail = effectiveThumbnail;
    payload.thumbnail_url = effectiveThumbnail;
    payload.captions = channelContext?.captions || undefined;
    payload.embedAllowed = embedAllowed;
    payload.embed_allowed = embedAllowed;

    // "Also post to" fans this one draft out to every selected channel plus
    // the channel the composer was opened in (if any) — one onSubmit call
    // per channel, each carrying its own channel_id. A channel-less post
    // (no context, nothing cross-posted) is a single call with no channel.
    const targetChannelIds = channelContext?.channelId
      ? Array.from(new Set([channelContext.channelId, ...crossPostChannelIds]))
      : crossPostChannelIds.length
      ? Array.from(new Set(crossPostChannelIds))
      : [undefined];

    setUploadingVideo(type === 'video' || type === 'short_video');
    setSubmitting(true);
    try {
      for (const targetChannelId of targetChannelIds) {
        const channelPayload: FeedComposerPayload = { ...payload };
        if (targetChannelId) {
          channelPayload.channelId = targetChannelId;
          channelPayload.channel_id = targetChannelId;
        }
        // Only reached once every onSubmit call resolves without throwing —
        // every current onSubmit implementation (FeedScreen/ProfileScreen's
        // handleCreate-family callbacks) already shows its own Alert and
        // throws on failure (a server success:false response as well as a
        // thrown network error), so reaching past this loop means every
        // cross-posted copy genuinely succeeded.
        await onSubmit(channelPayload);
      }
      clearComposerDraft(channelContext?.channelId ?? null);
      Vibration.vibrate(15);
      closeSheet();
    } catch {
      // Deliberately not closing here (unlike the try branch above) — the
      // previous code called closeSheet() unconditionally after `await
      // onSubmit(payload)`, treating "the promise didn't throw" as "it
      // succeeded". Every onSubmit implementation actually resolves
      // normally on lots of *failure* paths too (a success:false server
      // response isn't a rejected promise), so a failed post silently
      // closed this sheet and discarded everything the user had typed,
      // with their own already-shown failure Alert being the only
      // (confusing, easy to miss) sign anything went wrong. Not showing a
      // second alert here — onSubmit's own catch already told the user
      // what happened; this only needs to keep their draft open to retry.
      Vibration.vibrate([0, 40, 40, 40]);
    } finally {
      setSubmitting(false);
      setUploadingVideo(false);
    }
  }, [
    submitting,
    type,
    rich,
    attachments,
    videoThumbUri,
    pollQuestion,
    pollOptions,
    pollSettings,
    eventTitle,
    eventStartsAt,
    eventLocation,
    eventSettings,
    link,
    linkSettings,
    channelContext,
    visibility,
    scheduleEnabled,
    scheduledAt,
    thumbnail,
    embedAllowed,
    playlistIds,
    crossPostChannelIds,
    onSubmit,
    closeSheet,
  ]);

  if (!visible) return null;

  return (
    <Modal
      transparent={false}
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={[styles.sheet, { backgroundColor: palette.card, padding: 0 }]}>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.card,
            paddingTop: insets.top + 16,
            transform: [{ translateX: slideX }],
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
        >
          {step === 'picker' ? (
            <>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBlock}>
                  <Text style={[styles.sheetTitle, { color: palette.text }]}>
                    {channelLabel ? `Create in ${channelLabel}` : 'Create post'}
                  </Text>
                  {channelLabel ? (
                    <Text style={[styles.sheetSubtitle, { color: palette.subtext }]}>
                      This feed will be saved inside the selected channel.
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={requestClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                  <KISIcon name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              {pendingDraft ? (
                <View style={[styles.draftBanner, { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.draftBannerTitle, { color: palette.primaryStrong }]}>
                      You have a saved draft
                    </Text>
                    <Text style={[styles.draftBannerSub, { color: palette.text }]}>
                      Saved {new Date(pendingDraft.savedAt).toLocaleString()}
                    </Text>
                  </View>
                  <Pressable onPress={handleRestoreDraft} accessibilityRole="button" accessibilityLabel="Restore draft">
                    <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 12 }}>Restore</Text>
                  </Pressable>
                  <Pressable onPress={handleDiscardDraft} accessibilityRole="button" accessibilityLabel="Discard draft" style={{ marginLeft: 12 }}>
                    <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 12 }}>Discard</Text>
                  </Pressable>
                </View>
              ) : null}

              {templates.length ? (
                <View style={styles.templatesSection}>
                  <Text style={[styles.settingsLabel, { color: palette.subtext }]}>Templates</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesRow}>
                    {templates.map(tpl => (
                      <Pressable
                        key={tpl.id}
                        onPress={() => handleLoadTemplate(tpl)}
                        style={[styles.templateChip, { borderColor: palette.divider }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Load template ${tpl.name}`}
                      >
                        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 12 }}>{tpl.name}</Text>
                        <Pressable
                          onPress={() => handleDeleteTemplate(tpl.id)}
                          hitSlop={8}
                          style={{ marginLeft: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete template ${tpl.name}`}
                        >
                          <KISIcon name="close" size={12} color={palette.subtext} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.optionGrid}>
                {options.map(opt => (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      setType(opt.key as ComposerType);
                      setStep('form');
                    }}
                    style={[
                      styles.optionCard,
                      { borderColor: palette.divider },
                    ]}
                  >
                    <KISIcon
                      name={opt.icon as any}
                      size={20}
                      color={palette.primary}
                    />
                    <Text
                      style={{
                        color: palette.text,
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: '900',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.sheetHeader}>
                <Pressable
                  onPress={requestBackToPicker}
                  style={{ padding: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Back to post type picker"
                >
                  <KISIcon name="arrow-left" size={18} color={palette.text} />
                </Pressable>

                <View style={styles.sheetTitleBlock}>
                  <Text style={[styles.sheetTitle, { color: palette.text }]}>
                    {options.find(o => o.key === type)?.label ?? 'Create post'}
                  </Text>
                  {channelLabel ? (
                    <Text style={[styles.sheetSubtitle, { color: palette.subtext }]}>
                      Create in {channelLabel}
                    </Text>
                  ) : null}
                </View>

                <Pressable onPress={requestClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                  <KISIcon name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.formActionsRow}>
                <Pressable
                  onPress={() => setPreviewMode(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={previewMode ? 'Back to editing' : 'Preview post'}
                  style={[styles.formActionChip, { borderColor: palette.divider }]}
                >
                  <KISIcon name={previewMode ? 'edit' : 'eye'} size={13} color={palette.text} />
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: 11, marginLeft: 5 }}>
                    {previewMode ? 'Edit' : 'Preview'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleStartOver}
                  accessibilityRole="button"
                  accessibilityLabel="Start over"
                  style={[styles.formActionChip, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 11 }}>Start over</Text>
                </Pressable>
              </View>

              {previewMode ? (
                <View style={[styles.previewCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  {rich.text.trim() ? (
                    <RichTextRenderer doc={stateToDoc(rich)} fallback={rich.text} />
                  ) : null}
                  {attachments.length ? (
                    <Text style={[styles.previewMeta, { color: palette.subtext }]}>
                      {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                    </Text>
                  ) : null}
                  {type === 'poll' ? (
                    <View>
                      <Text style={[styles.previewTitle, { color: palette.text }]}>{pollQuestion || 'Poll question'}</Text>
                      {pollOptions.filter(Boolean).map((opt, idx) => (
                        <Text key={idx} style={[styles.previewMeta, { color: palette.subtext }]}>• {opt}</Text>
                      ))}
                    </View>
                  ) : null}
                  {type === 'event' ? (
                    <View>
                      <Text style={[styles.previewTitle, { color: palette.text }]}>{eventTitle || 'Event title'}</Text>
                      {eventStartsAt ? (
                        <Text style={[styles.previewMeta, { color: palette.subtext }]}>{new Date(eventStartsAt).toLocaleString()}</Text>
                      ) : null}
                      {eventLocation ? (
                        <Text style={[styles.previewMeta, { color: palette.subtext }]}>{eventLocation}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {type === 'link' && link ? (
                    <Text style={[styles.previewMeta, { color: palette.primaryStrong }]}>{link}</Text>
                  ) : null}
                  <View style={styles.previewChipsRow}>
                    <Text style={[styles.previewChip, { borderColor: palette.divider, color: palette.subtext }]}>
                      {VISIBILITY_OPTIONS.find(o => o.value === visibility)?.label ?? visibility}
                    </Text>
                    {scheduleEnabled && scheduledAt ? (
                      <Text style={[styles.previewChip, { borderColor: palette.divider, color: palette.subtext }]}>
                        Scheduled: {new Date(scheduledAt).toLocaleString()}
                      </Text>
                    ) : null}
                    {thumbnail ? (
                      <Text style={[styles.previewChip, { borderColor: palette.divider, color: palette.subtext }]}>Has cover</Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.formBody}>{renderFormBody()}</View>
              )}

              {CAPTION_LIMITS[type] ? (
                <Text
                  style={[
                    styles.charCounter,
                    { color: rich.text.length > (CAPTION_LIMITS[type] ?? 0) ? palette.danger : palette.subtext },
                  ]}
                >
                  {rich.text.length}/{CAPTION_LIMITS[type]}
                </Text>
              ) : null}

              {formError ? (
                <Text style={[styles.formErrorText, { color: palette.danger }]}>{formError}</Text>
              ) : null}

              <View style={[styles.settingsCard, { borderColor: palette.divider }]}>
                <Text style={[styles.settingsTitle, { color: palette.text }]}>Post settings</Text>

                <Text style={[styles.settingsLabel, { color: palette.subtext }]}>Who can see this</Text>
                <View style={styles.visibilityRow}>
                  {VISIBILITY_OPTIONS.filter(
                    opt => opt.value !== 'members_only' || channelContext?.channelId,
                  ).map(opt => {
                    const active = visibility === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setVisibility(opt.value)}
                        style={[
                          styles.visibilityChip,
                          {
                            borderColor: active ? palette.primary : palette.divider,
                            backgroundColor: active ? palette.primarySoft : 'transparent',
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={opt.label}
                      >
                        <Text
                          style={{
                            color: active ? palette.primaryStrong : palette.text,
                            fontWeight: '800',
                            fontSize: 12,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.settingsRow}>
                  <Text style={[styles.settingsLabel, { color: palette.text }]}>Schedule for later</Text>
                  <Switch
                    value={scheduleEnabled}
                    onValueChange={v => {
                      setScheduleEnabled(v);
                      if (!v) setScheduledAt(null);
                    }}
                    trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                    thumbColor={palette.onPrimary}
                  />
                </View>
                {scheduleEnabled ? (
                  <KISDateTimeInput
                    mode="datetime"
                    value={scheduledAt}
                    onChange={setScheduledAt}
                    placeholder="Select date and time"
                    minimumDate={new Date()}
                  />
                ) : null}

                <View style={styles.settingsRow}>
                  <Text style={[styles.settingsLabel, { color: palette.text }]}>Cover thumbnail</Text>
                  <Pressable
                    onPress={pickThumbnail}
                    accessibilityRole="button"
                    accessibilityLabel={thumbnail ? 'Change cover thumbnail' : 'Add cover thumbnail'}
                  >
                    <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>
                      {thumbnail ? 'Change' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
                {thumbnail ? (
                  <View style={styles.thumbnailPreviewRow}>
                    <Image source={{ uri: thumbnail }} style={styles.thumbnailPreviewImage} />
                    <Pressable
                      onPress={() => setThumbnail(null)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove cover thumbnail"
                    >
                      <KISIcon name="close" size={16} color={palette.subtext} />
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.settingsRow}>
                  <Text style={[styles.settingsLabel, { color: palette.text }]}>Allow embedding elsewhere</Text>
                  <Switch
                    value={embedAllowed}
                    onValueChange={setEmbedAllowed}
                    trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                    thumbColor={palette.onPrimary}
                  />
                </View>

                {channelContext?.channelId ? (
                  <>
                    <Text style={[styles.settingsLabel, { color: palette.subtext }]}>Add to playlist</Text>
                    {loadingPlaylists ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : playlists.length ? (
                      <View style={styles.visibilityRow}>
                        {playlists.map(pl => {
                          const active = playlistIds.includes(pl.id);
                          return (
                            <Pressable
                              key={pl.id}
                              onPress={() => togglePlaylist(pl.id)}
                              style={[
                                styles.visibilityChip,
                                {
                                  borderColor: active ? palette.primary : palette.divider,
                                  backgroundColor: active ? palette.primarySoft : 'transparent',
                                },
                              ]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              accessibilityLabel={pl.title}
                            >
                              <Text
                                style={{
                                  color: active ? palette.primaryStrong : palette.text,
                                  fontWeight: '800',
                                  fontSize: 12,
                                }}
                              >
                                {pl.title}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <View style={styles.settingsRow}>
                      <TextInput
                        placeholder="New playlist name"
                        placeholderTextColor={palette.subtext}
                        value={newPlaylistName}
                        onChangeText={setNewPlaylistName}
                        style={[styles.inlineInput, { color: palette.text, borderColor: palette.divider }]}
                      />
                      <Pressable
                        onPress={handleCreatePlaylist}
                        disabled={creatingPlaylist || !newPlaylistName.trim()}
                        accessibilityRole="button"
                        accessibilityLabel="Create playlist"
                      >
                        {creatingPlaylist ? (
                          <ActivityIndicator size="small" color={palette.primary} />
                        ) : (
                          <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>
                            Create
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {otherChannels.length ? (
                  <>
                    <Text style={[styles.settingsLabel, { color: palette.subtext }]}>Also post to</Text>
                    <View style={styles.visibilityRow}>
                      {otherChannels.map(ch => {
                        const active = crossPostChannelIds.includes(ch.id);
                        return (
                          <Pressable
                            key={ch.id}
                            onPress={() => toggleCrossPostChannel(ch.id)}
                            style={[
                              styles.visibilityChip,
                              {
                                borderColor: active ? palette.primary : palette.divider,
                                backgroundColor: active ? palette.primarySoft : 'transparent',
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`@${ch.handle}`}
                          >
                            <Text
                              style={{
                                color: active ? palette.primaryStrong : palette.text,
                                fontWeight: '800',
                                fontSize: 12,
                              }}
                            >
                              @{ch.handle}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.settingsRow}>
                <TextInput
                  placeholder="Save this as a template…"
                  placeholderTextColor={palette.subtext}
                  value={templateNameInput}
                  onChangeText={setTemplateNameInput}
                  style={[styles.inlineInput, { color: palette.text, borderColor: palette.divider }]}
                />
                <Pressable
                  onPress={handleSaveTemplate}
                  disabled={savingTemplate || !templateNameInput.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Save as template"
                >
                  {savingTemplate ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>Save</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={submit}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: palette.primary,
                    opacity: submitting ? 0.7 : 1,
                  },
                ]}
                disabled={submitting}
              >
                <Text
                  style={{
                    color: palette.onPrimary,
                    fontWeight: '900',
                  }}
                >
                  {submitting ? 'Posting...' : channelLabel ? `Post to ${channelLabel}` : 'Post'}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>

        {uploadingVideo && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[styles.uploadText, { color: palette.text }]}>
              Uploading video…
            </Text>
          </View>
        )}
      </Animated.View>
      </View>
    </Modal>
  );
}

const CAPTION_LIMITS: Partial<Record<ComposerType, number>> = {
  image: 2200,
  video: 2200,
  short_video: 300,
  document: 2200,
  audio: 2200,
  link: 500,
};

const VISIBILITY_OPTIONS: { value: 'public' | 'unlisted' | 'private' | 'members_only'; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' },
  { value: 'members_only', label: 'Members only' },
];

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    padding: 16,
  },
  sheetScroll: { paddingBottom: 140 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitleBlock: { flex: 1, paddingHorizontal: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '900' },
  sheetSubtitle: { marginTop: 3, fontSize: 11, lineHeight: 15, fontWeight: '700' },

  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  optionCard: {
    width: '30%',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  formBody: { gap: 12 },

  settingsCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  settingsTitle: { fontSize: 13, fontWeight: '900' },
  settingsLabel: { fontSize: 12, fontWeight: '800' },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visibilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  visibilityChip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  thumbnailPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnailPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  formActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  previewTitle: { fontSize: 14, fontWeight: '900' },
  previewMeta: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  previewChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  previewChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
  },
  charCounter: {
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 6,
  },
  formErrorText: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  draftBannerTitle: { fontSize: 12, fontWeight: '900' },
  draftBannerSub: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  templatesSection: { marginBottom: 12, gap: 6 },
  templatesRow: { flexDirection: 'row', gap: 8 },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    marginRight: 10,
  },

  submitButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },

  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000099',
  },
  uploadText: { marginTop: 12, fontWeight: '800' },
});
