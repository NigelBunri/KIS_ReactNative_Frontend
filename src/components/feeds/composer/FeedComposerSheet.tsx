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
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import usePullDownToClose from '@/hooks/usePullDownToClose';

import type {
  ComposerType,
  FeedComposerPayload,
  RichComposerState,
} from './types';
import { stateToDoc } from './richTextUtils';
import { MediaComposerPage } from './pages/MediaComposerPage';
import { PollComposerPage } from './pages/PollComposerPage';
import { EventComposerPage } from './pages/EventComposerPage';
import { LinkComposerPage } from './pages/LinkComposerPage';
import { TextComposerPage } from './pages/TextComposerPage';

type ChannelComposerContext = {
  channelId?: string;
  channelHandle?: string;
  channelName?: string;
  contentType?: FeedComposerPayload['contentType'];
  visibility?: string;
  scheduledAt?: string | null;
  playlistIds?: string[];
  thumbnail?: string | null;
  captions?: any;
  embedAllowed?: boolean;
};

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
  const [attachments, setAttachments] = useState<any[]>([]);
  const [videoThumbUri, setVideoThumbUri] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const sheetY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (!visible) return;
    setStep('picker');
    setType('text');
    Animated.timing(sheetY, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetY]);

  const resetAll = useCallback(() => {
    setRich({
      text: '',
      spans: [],
      blocks: {},
      defaultAlign: 'left',
      styledBg: undefined,
    });
    setLink('');
    setAttachments([]);
    setVideoThumbUri(null);
    setPollQuestion('');
    setPollOptions(['', '']);
    setEventTitle('');
    setEventStartsAt('');
    setEventLocation('');
  }, []);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 600,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      resetAll();
      onClose();
    });
  }, [sheetY, onClose, resetAll]);
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose: closeSheet,
  });

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

  const submit = useCallback(async () => {
    if (submitting) return;

    const payload: FeedComposerPayload = {};
    const trimmed = rich.text.trim();

    if (type === 'text') {
      if (!trimmed) return;
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
      if (!attachments.length && !trimmed) return;

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
      if (!pollQuestion.trim() || opts.length < 2) return;
      payload.poll = {
        question: pollQuestion.trim(),
        options: opts.map((opt, idx) => ({ id: `opt_${idx + 1}`, text: opt })),
      };
    }

    if (type === 'event') {
      if (!eventTitle.trim() || !eventStartsAt.trim()) return;
      payload.event = {
        title: eventTitle.trim(),
        startsAt: eventStartsAt.trim(),
        location: eventLocation.trim() || undefined,
      };
    }

    if (type === 'link') {
      if (!link.trim()) return;
      payload.link = link.trim();
      if (trimmed) {
        payload.textPlain = trimmed;
        payload.textPreview = trimmed.slice(0, 200);
        payload.text = stateToDoc(rich);
      }
    }

    payload.composerType = type;
    if (channelContext?.channelId) {
      payload.channelId = channelContext.channelId;
      payload.channel_id = channelContext.channelId;
    }
    payload.contentType = channelContext?.contentType || type;
    payload.content_type = channelContext?.contentType || type;
    payload.visibility = channelContext?.visibility || 'private';
    payload.scheduledAt = channelContext?.scheduledAt || null;
    payload.scheduled_at = channelContext?.scheduledAt || null;
    payload.playlistIds = channelContext?.playlistIds || [];
    payload.playlist_ids = channelContext?.playlistIds || [];
    payload.thumbnail = channelContext?.thumbnail || videoThumbUri || null;
    payload.thumbnail_url = channelContext?.thumbnail || videoThumbUri || null;
    payload.captions = channelContext?.captions || undefined;
    payload.embedAllowed = Boolean(channelContext?.embedAllowed);
    payload.embed_allowed = Boolean(channelContext?.embedAllowed);

    setUploadingVideo(type === 'video' || type === 'short_video');
    setSubmitting(true);
    try {
      await onSubmit(payload);
      closeSheet();
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
    eventTitle,
    eventStartsAt,
    eventLocation,
    link,
    channelContext,
    onSubmit,
    closeSheet,
  ]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={closeSheet}
    >
      <Pressable style={styles.backdrop} onPress={closeSheet} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.card,
            transform: [{ translateY: Animated.add(sheetY, dragY) }],
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
              <View style={styles.sheetHeader} {...panHandlers}>
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
                <Pressable onPress={closeSheet}>
                  <KISIcon name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

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
              <View style={styles.sheetHeader} {...panHandlers}>
                <Pressable
                  onPress={() => setStep('picker')}
                  style={{ padding: 6 }}
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

                <Pressable onPress={closeSheet}>
                  <KISIcon name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.formBody}>{renderFormBody()}</View>

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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
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

  submitButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },

  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    bottom: 0,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000099',
  },
  uploadText: { marginTop: 12, fontWeight: '800' },
});
