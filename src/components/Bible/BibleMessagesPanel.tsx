import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Topic = {
  id: number;
  name: string;
  slug: string;
  description: string;
  cover_image: string | null;
  message_count: number;
};

type Minister = {
  id: number;
  name: string;
  title: string;
  bio: string;
  photo: string | null;
  message_count: number;
  topic_ids: number[];
};

type Message = {
  id: number;
  title: string;
  description: string;
  video_type: 'youtube' | 'direct';
  youtube_video_id: string;
  youtube_url: string;
  video_url: string;
  thumbnail_url_resolved: string | null;
  duration_seconds: number | null;
  scripture_reference: string;
  view_count: number;
  minister_name: string | null;
  topic_name: string | null;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function TopicCard({ topic, onPress }: { topic: Topic; onPress: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const cardWidth = responsive.isWatch || responsive.isCompactPhone ? '100%' : responsive.isTablet ? '31%' : '47%';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.topicCard, { width: cardWidth, backgroundColor: palette.surface, borderColor: palette.divider }]}
    >
      <View style={[styles.topicImage, { backgroundColor: palette.card }]}>
        {topic.cover_image ? (
          <Image source={{ uri: topic.cover_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <KISIcon name="folder" size={28} color={palette.subtext} />
        )}
        <View style={styles.topicImageScrim} />
        <Text style={styles.topicImageName} numberOfLines={2}>{topic.name}</Text>
      </View>
      <View style={{ padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>
          {topic.message_count ?? 0} {(topic.message_count ?? 0) === 1 ? 'message' : 'messages'}
        </Text>
        <KISIcon name="chevron-forward" size={14} color={palette.subtext} />
      </View>
    </Pressable>
  );
}

function MinisterCard({ minister, onPress }: { minister: Minister; onPress: () => void }) {
  const { palette } = useKISTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.ministerCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}
    >
      <View style={[styles.ministerPhoto, { backgroundColor: palette.card }]}>
        {minister.photo ? (
          <Image source={{ uri: minister.photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <KISIcon name="person-circle" size={36} color={palette.subtext} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 14 }} numberOfLines={1}>
          {minister.name}
        </Text>
        {!!minister.title && (
          <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '600' }}>{minister.title}</Text>
        )}
        <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>
          {minister.message_count ?? 0} {(minister.message_count ?? 0) === 1 ? 'message' : 'messages'}
        </Text>
      </View>
      <KISIcon name="chevron-forward" size={16} color={palette.subtext} />
    </Pressable>
  );
}

function MessageCard({ message, onPlay }: { message: Message; onPlay: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  return (
    <Pressable
      onPress={onPlay}
      style={[styles.messageCard, compact && styles.messageCardCompact, { backgroundColor: palette.surface, borderColor: palette.divider }]}
    >
      <View style={[styles.messageThumbnail, compact && styles.messageThumbnailCompact, { backgroundColor: palette.card }]}>
        {message.thumbnail_url_resolved ? (
          <Image source={{ uri: message.thumbnail_url_resolved }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <KISIcon name="play-circle" size={32} color={palette.subtext} />
        )}
        <View style={styles.playOverlay}>
          <KISIcon name="play" size={18} color="#fff" />
        </View>
        {message.duration_seconds != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(message.duration_seconds)}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, padding: 10, gap: 3 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 13 }} numberOfLines={2}>
          {message.title}
        </Text>
        {!!message.minister_name && (
          <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 11 }}>{message.minister_name}</Text>
        )}
        {!!message.scripture_reference && (
          <View style={[styles.scriptureTag, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
            <Text style={{ color: palette.primaryStrong, fontSize: 10, fontWeight: '800' }}>
              {message.scripture_reference}
            </Text>
          </View>
        )}
        <Text style={{ color: palette.subtext, fontSize: 10 }}>{message.view_count} views</Text>
      </View>
    </Pressable>
  );
}

function VideoPlayer({ message, onClose }: { message: Message; onClose: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  useEffect(() => {
    postRequest(ROUTES.bible.kcanMessageView(message.id), {}).catch(() => undefined);
  }, [message.id]);

  const videoUrl = message.video_type === 'youtube' && message.youtube_video_id
    ? `https://www.youtube.com/watch?v=${message.youtube_video_id}`
    : message.video_url;

  const handlePlay = () => {
    if (videoUrl) Linking.openURL(videoUrl).catch(() => undefined);
  };

  return (
    <View style={[styles.playerWrap, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <View style={[styles.playerHeader, { backgroundColor: palette.surface, borderBottomColor: palette.divider }]}>
        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
          <KISIcon name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text
          style={{ flex: 1, color: palette.text, fontWeight: '900', fontSize: 14, marginLeft: 10 }}
          numberOfLines={1}
        >
          {message.title}
        </Text>
      </View>

      {/* Thumbnail with play button — opens in YouTube/browser */}
      <Pressable onPress={handlePlay} style={styles.playerThumbnail}>
        {message.thumbnail_url_resolved ? (
          <Image source={{ uri: message.thumbnail_url_resolved }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111' }]} />
        )}
        <View style={styles.bigPlayOverlay}>
          <KISIcon name="play" size={36} color="#fff" />
        </View>
        {message.video_type === 'youtube' && (
          <View style={styles.youtubeBadge}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>YouTube</Text>
          </View>
        )}
      </Pressable>

      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{message.title}</Text>
        {!!message.minister_name && (
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>{message.minister_name}</Text>
        )}
        {!!message.scripture_reference && (
          <View style={[styles.scriptureTag, { backgroundColor: palette.primarySoft, borderColor: palette.primary, alignSelf: 'flex-start' }]}>
            <KISIcon name="book" size={11} color={palette.primaryStrong} />
            <Text style={{ color: palette.primaryStrong, fontSize: 11, fontWeight: '800' }}>
              {message.scripture_reference}
            </Text>
          </View>
        )}
        {!!message.description && (
          <Text style={{ color: palette.subtext, fontSize: 14, lineHeight: 22 }}>{message.description}</Text>
        )}
        {videoUrl && (
          <TouchableOpacity
            onPress={handlePlay}
            style={[styles.watchBtn, { backgroundColor: palette.primary }]}
          >
            <KISIcon name="play-circle" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
              {message.video_type === 'youtube' ? 'Watch on YouTube' : 'Watch Video'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

type ViewMode = 'topics' | 'ministers' | 'messages';

export default function BibleMessagesPanel() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [viewMode, setViewMode] = useState<ViewMode>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedMinister, setSelectedMinister] = useState<Minister | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.bible.kcanMessageTopics, {});
      const data = res.payload?.results ?? res.payload ?? [];
      setTopics(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMinisters = useCallback(async (topicId: number) => {
    setLoading(true);
    try {
      const res = await getRequest(`${ROUTES.bible.kcanMinisters}?topic=${topicId}`, {});
      const data = res.payload?.results ?? res.payload ?? [];
      setMinisters(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (topicId?: number, ministerId?: number, q?: string) => {
    setLoading(true);
    try {
      const params: string[] = [];
      if (topicId) params.push(`topic=${topicId}`);
      if (ministerId) params.push(`minister=${ministerId}`);
      if (q?.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
      const url = `${ROUTES.bible.kcanMessages}${params.length ? '?' + params.join('&') : ''}`;
      const res = await getRequest(url, {});
      const data = res.payload?.results ?? res.payload ?? [];
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const handleSelectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setViewMode('ministers');
    loadMinisters(topic.id);
  };

  const handleSelectMinister = (minister: Minister) => {
    setSelectedMinister(minister);
    setViewMode('messages');
    loadMessages(selectedTopic?.id, minister.id);
  };

  const handleSearchMessages = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadMessages(selectedTopic?.id, selectedMinister?.id, text), 400);
  };

  const handleBack = () => {
    if (viewMode === 'messages') {
      setViewMode('ministers');
      setSelectedMinister(null);
      setQuery('');
    } else if (viewMode === 'ministers') {
      setViewMode('topics');
      setSelectedTopic(null);
    }
  };

  const Breadcrumb = () => (
    <View style={[styles.breadcrumb, { borderBottomColor: palette.divider }]}>
      <TouchableOpacity
        onPress={() => {
          setViewMode('topics');
          setSelectedTopic(null);
          setSelectedMinister(null);
          setQuery('');
        }}
        style={styles.breadcrumbItem}
      >
        <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>Topics</Text>
      </TouchableOpacity>
      {selectedTopic && (
        <>
          <KISIcon name="chevron-forward" size={12} color={palette.subtext} />
          <TouchableOpacity
            onPress={() => {
              setViewMode('ministers');
              setSelectedMinister(null);
              setQuery('');
              loadMinisters(selectedTopic.id);
            }}
            style={styles.breadcrumbItem}
          >
            <Text
              style={{ color: viewMode === 'ministers' ? palette.text : palette.primary, fontWeight: '800', fontSize: 13 }}
              numberOfLines={1}
            >
              {selectedTopic.name}
            </Text>
          </TouchableOpacity>
        </>
      )}
      {selectedMinister && (
        <>
          <KISIcon name="chevron-forward" size={12} color={palette.subtext} />
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
            {selectedMinister.name}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Header breadcrumb when drilled in */}
      {viewMode !== 'topics' && <Breadcrumb />}

      {/* Title row */}
      <View style={[styles.sectionHeader, { borderBottomColor: palette.divider }]}>
        {viewMode !== 'topics' && (
          <TouchableOpacity onPress={handleBack} style={{ marginRight: 8 }}>
            <KISIcon name="arrow-back" size={20} color={palette.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>
            {viewMode === 'topics'
              ? 'Message Topics'
              : viewMode === 'ministers'
              ? `Ministers — ${selectedTopic?.name}`
              : selectedMinister?.name ?? 'Messages'}
          </Text>
          {viewMode === 'topics' && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Choose a topic to explore
            </Text>
          )}
          {viewMode === 'ministers' && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Choose a minister to watch their messages
            </Text>
          )}
        </View>
      </View>

      {/* Search bar for messages view */}
      {viewMode === 'messages' && (
        <View style={[styles.searchRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <KISIcon name="search" size={16} color={palette.subtext} />
          <TextInput
            value={query}
            onChangeText={handleSearchMessages}
            placeholder="Search messages..."
            placeholderTextColor={palette.subtext}
            style={[styles.searchInput, { color: palette.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); loadMessages(selectedTopic?.id, selectedMinister?.id); }}>
              <KISIcon name="close-circle" size={16} color={palette.subtext} />
            </Pressable>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
          <Text style={{ color: palette.subtext, marginTop: 8 }}>Loading…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {viewMode === 'topics' && (
            <>
              {topics.length === 0 ? (
                <View style={styles.centered}>
                  <KISIcon name="folder-open" size={40} color={palette.subtext} />
                  <Text style={{ color: palette.text, fontWeight: '900', marginTop: 10 }}>No topics yet</Text>
                  <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                    KCAN will publish message topics here.
                  </Text>
                </View>
              ) : (
                <View style={[styles.topicGrid, { gap: responsive.cardGap }]}>
                  {topics.map((t) => (
                    <TopicCard key={t.id} topic={t} onPress={() => handleSelectTopic(t)} />
                  ))}
                </View>
              )}
            </>
          )}

          {viewMode === 'ministers' && (
            <>
              {ministers.length === 0 ? (
                <View style={styles.centered}>
                  <KISIcon name="people" size={40} color={palette.subtext} />
                  <Text style={{ color: palette.text, fontWeight: '900', marginTop: 10 }}>No ministers yet</Text>
                </View>
              ) : (
                <View style={{ gap: 10, paddingTop: 8 }}>
                  {ministers.map((m) => (
                    <MinisterCard key={m.id} minister={m} onPress={() => handleSelectMinister(m)} />
                  ))}
                </View>
              )}
            </>
          )}

          {viewMode === 'messages' && (
            <>
              {messages.length === 0 ? (
                <View style={styles.centered}>
                  <KISIcon name="videocam" size={40} color={palette.subtext} />
                  <Text style={{ color: palette.text, fontWeight: '900', marginTop: 10 }}>No messages yet</Text>
                  <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                    No published messages from this minister.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12, paddingTop: 8 }}>
                  {messages.map((m) => (
                    <MessageCard key={m.id} message={m} onPlay={() => setSelectedMessage(m)} />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Video Player Modal */}
      <Modal visible={!!selectedMessage} animationType="slide" presentationStyle="fullScreen">
        {selectedMessage && (
          <VideoPlayer message={selectedMessage} onClose={() => setSelectedMessage(null)} />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    paddingHorizontal: 2,
    maxWidth: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  topicCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  topicImage: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topicImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topicImageName: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ministerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 16,
  },
  ministerPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageCard: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageCardCompact: { flexDirection: 'column' },
  messageThumbnail: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  messageThumbnailCompact: { width: '100%', aspectRatio: 16 / 9 },
  playOverlay: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  scriptureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 6,
    paddingHorizontal: 24,
  },
  playerWrap: {
    flex: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  playerThumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bigPlayOverlay: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#FF0000',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
});
