import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

// ─── Types ────────────────────────────────────────────────────────────────────

type BibleSection =
  | 'daily_passages'
  | 'meditations'
  | 'devotionals'
  | 'books'
  | 'reading_plans'
  | 'prayer_calendar'
  | 'courses'
  | 'ministers'
  | 'push_notifications'
  | 'community'
  | 'notes_highlights'
  | 'translations'
  | 'languages'
  | 'monetisation'
  | 'analytics';

type MeditationPost = {
  id: number;
  title: string;
  body: string;
  content_type: 'message' | 'video';
  video_url: string;
  thumbnail_url: string;
  scripture_refs: string[];
  tags: string[];
  language: string;
  status: string;
  published_at: string | null;
};

type KCANBook = {
  id: number;
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  status: string;
  sort_order: number;
  pdf_url?: string;
  cover_image?: string;
};

type PrayerRequest = {
  id: number;
  title: string;
  content: string;
  answered: boolean;
  is_public: boolean;
  created_at: string;
  user_display?: string;
};

type DailyPassage = {
  id: number;
  date: string;
  passage_reference: string;
  verse_text?: string;
  language: string;
  status: string;
  notes?: string;
};

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  onClose: () => void;
};

const BOOK_GENRES = [
  { key: 'theology', label: 'Theology' },
  { key: 'devotional', label: 'Devotional' },
  { key: 'biography', label: 'Biography' },
  { key: 'ministry', label: 'Ministry' },
  { key: 'prophecy', label: 'Prophecy' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'family', label: 'Family' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'missions', label: 'Missions' },
  { key: 'other', label: 'Other' },
];

const SECTIONS: { key: BibleSection; label: string; icon: string; description: string }[] = [
  { key: 'daily_passages', label: 'Daily Passages', icon: '📖', description: 'Verse of the day, devotional passages, scheduling' },
  { key: 'meditations', label: 'Meditations', icon: '🧘', description: 'Audio and text meditation sessions' },
  { key: 'devotionals', label: 'Devotionals', icon: '✝️', description: 'Short-form spiritual reading series and authors' },
  { key: 'books', label: 'Books & Categories', icon: '📚', description: 'PDF books grouped by category (genre tabs)' },
  { key: 'reading_plans', label: 'Reading Plans', icon: '🗺', description: 'Curated plans: chronological, topical, yearly' },
  { key: 'prayer_calendar', label: 'Prayer Calendar', icon: '🗓', description: 'Monthly prayer schedules and intercession topics' },
  { key: 'courses', label: 'Bible Courses', icon: '🎓', description: 'Structured learning paths, lessons, and quizzes' },
  { key: 'ministers', label: 'Ministers & Authors', icon: '👤', description: 'Verified minister and author profiles' },
  { key: 'push_notifications', label: 'Push Notifications', icon: '🔔', description: 'Daily verse push, scheduled campaigns, stats' },
  { key: 'community', label: 'Prayer Requests', icon: '🙏', description: 'Public prayer requests — view and mark as prayed' },
  { key: 'notes_highlights', label: 'Notes & Highlights', icon: '🖊', description: 'User notes, highlights, and bookmarks management' },
  { key: 'translations', label: 'Bible Translations', icon: '🌍', description: 'Translation registry — KJV, NIV, NLT, local' },
  { key: 'languages', label: 'Languages & L10n', icon: '🗣', description: 'UI localisation, audio tracks, subtitle settings' },
  { key: 'monetisation', label: 'Monetisation', icon: '💰', description: 'Paid content, premium tiers, revenue, payouts' },
  { key: 'analytics', label: 'Analytics', icon: '📊', description: 'Reading stats, engagement, retention, completion' },
];

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AdminBiblePanel({ isOpen, panelWidth, panelTranslateX, onClose }: Props) {
  const { palette } = useKISTheme();
  const [activeSection, setActiveSection] = useState<BibleSection | null>(null);

  if (!isOpen) return null;

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={activeSection ? () => setActiveSection(null) : onClose}
            style={styles.backBtn}
          >
            <Text style={{ color: palette.primary, fontSize: 28, lineHeight: 32, fontWeight: '300' }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>📖 Bible App Admin</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {activeSection
                ? (SECTIONS.find(s => s.key === activeSection)?.label ?? '')
                : '15 management areas · content, plans, push, community'}
            </Text>
          </View>
        </View>

        {!activeSection ? (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {SECTIONS.map(section => (
                <Pressable
                  key={section.key}
                  onPress={() => setActiveSection(section.key)}
                  style={({ pressed }) => [
                    styles.sectionCard,
                    { backgroundColor: palette.surface, borderColor: palette.divider, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{section.icon}</Text>
                  <Text style={[styles.sectionLabel, { color: palette.text }]}>{section.label}</Text>
                  <Text style={[styles.sectionDesc, { color: palette.subtext }]}>{section.description}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <SectionView section={activeSection} palette={palette} />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Section Router ────────────────────────────────────────────────────────────

function SectionView({ section, palette }: { section: BibleSection; palette: any }) {
  switch (section) {
    case 'meditations':   return <MeditationsSection palette={palette} />;
    case 'books':         return <BooksSection palette={palette} />;
    case 'community':     return <PrayerRequestsSection palette={palette} />;
    case 'daily_passages':return <DailyPassagesSection palette={palette} />;
    case 'push_notifications': return <PushNotificationsSection palette={palette} />;
    case 'prayer_calendar':    return <PrayerCalendarSection palette={palette} />;
    case 'courses':            return <CoursesSection palette={palette} />;
    case 'reading_plans':      return <ReadingPlansSection palette={palette} />;
    case 'analytics':          return <AnalyticsSection palette={palette} />;
    default:                   return <GenericSection section={section} palette={palette} />;
  }
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function SectionShell({ children, palette }: { children: React.ReactNode; palette: any }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

function FieldInput({
  label, value, onChange, placeholder, multiline, palette, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; palette: any; keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.fieldLabel, { color: palette.subtext }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.subtext}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: palette.text,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            height: multiline ? 70 : 40,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

function Chips({
  options, selected, onSelect, palette,
}: {
  options: { key: string; label: string }[]; selected: string; onSelect: (v: string) => void; palette: any;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {options.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key)}
          style={[
            styles.chip,
            {
              backgroundColor: selected === opt.key ? palette.primary + '22' : 'transparent',
              borderColor: selected === opt.key ? palette.primary : palette.divider,
            },
          ]}
        >
          <Text style={{ color: selected === opt.key ? palette.primary : palette.subtext, fontSize: 11, fontWeight: '700' }}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function StatusBadge({ status, palette }: { status: string; palette: any }) {
  const color = status === 'published' ? (palette.success ?? '#27AE60')
    : status === 'draft' ? palette.subtext
    : palette.primary;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={{ color, fontSize: 9, fontWeight: '800' }}>{status}</Text>
    </View>
  );
}

function EmptyState({ icon, text, palette }: { icon: string; text: string; palette: any }) {
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={[styles.bodyText, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>{text}</Text>
    </View>
  );
}

function SectionError({ message, onRetry, palette }: { message: string; onRetry: () => void; palette: any }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.bodyText, { color: palette.danger }]}>{message}</Text>
      <Pressable onPress={onRetry} style={[styles.retryBtn, { backgroundColor: palette.primary }]}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ─── Meditations Section ───────────────────────────────────────────────────────

function MeditationsSection({ palette }: { palette: any }) {
  const [items, setItems] = useState<MeditationPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [contentType, setContentType] = useState('message');
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [scriptureRefs, setScriptureRefs] = useState('');
  const [language, setLanguage] = useState('en');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.meditationPosts);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load meditations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(), body: body.trim(),
        content_type: contentType, language,
        scripture_refs: scriptureRefs.split(',').map(s => s.trim()).filter(Boolean),
        status: 'draft',
      };
      if (contentType === 'video' && videoUrl.trim()) payload.video_url = videoUrl.trim();
      if (audioUrl.trim()) payload.audio_url = audioUrl.trim();
      const res: any = await postRequest((ROUTES as any).bible.meditationPosts, payload);
      if (res?.id || res?.data?.id) {
        const created = res?.data ?? res;
        setItems(prev => [created, ...prev]);
        setTitle(''); setBody(''); setVideoUrl(''); setAudioUrl(''); setScriptureRefs('');
        setShowForm(false);
      } else {
        Alert.alert('Error', res?.message || 'Could not create meditation.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (item: MeditationPost) => {
    try {
      const newStatus = item.status === 'published' ? 'draft' : 'published';
      const url = `${(ROUTES as any).bible.meditationPosts}${item.id}/`;
      await patchRequest(url, { status: newStatus });
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, status: newStatus } : m));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update status.');
    }
  };

  const handleDelete = (item: MeditationPost) => {
    Alert.alert('Delete meditation', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(`${(ROUTES as any).bible.meditationPosts}${item.id}/`);
            setItems(prev => prev.filter(m => m.id !== item.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete.');
          }
        },
      },
    ]);
  };

  const filtered = filter === 'all' ? items : items.filter(m => m.status === filter);

  return (
    <SectionShell palette={palette}>
      <View style={[styles.filterRow, { borderBottomColor: palette.divider }]}>
        <Chips
          options={[{ key: 'all', label: 'All' }, { key: 'published', label: 'Published' }, { key: 'draft', label: 'Draft' }]}
          selected={filter}
          onSelect={setFilter}
          palette={palette}
        />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="🧘" text="No meditations yet. Create one below." palette={palette} />}
          ListFooterComponent={
            <View style={{ marginTop: 8 }}>
              <Pressable
                onPress={() => setShowForm(s => !s)}
                style={[styles.addBtn, { borderColor: palette.primary }]}
              >
                <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>
                  {showForm ? '↑ Cancel' : '+ New meditation'}
                </Text>
              </Pressable>
              {showForm && (
                <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  <Text style={[styles.formTitle, { color: palette.text }]}>New Meditation Post</Text>
                  <FieldInput label="Title *" value={title} onChange={setTitle} placeholder="e.g. Finding Peace in Psalms" palette={palette} />
                  <FieldInput label="Body text" value={body} onChange={setBody} placeholder="Your meditation content..." multiline palette={palette} />
                  <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 4 }]}>Content type</Text>
                  <Chips
                    options={[{ key: 'message', label: 'Text / Message' }, { key: 'video', label: 'Video' }]}
                    selected={contentType}
                    onSelect={setContentType}
                    palette={palette}
                  />
                  {contentType === 'video' && (
                    <FieldInput label="Video URL" value={videoUrl} onChange={setVideoUrl} placeholder="https://youtube.com/..." palette={palette} />
                  )}
                  <FieldInput label="Audio URL" value={audioUrl} onChange={setAudioUrl} placeholder="https://..." palette={palette} />
                  <FieldInput label="Scripture refs (comma-separated)" value={scriptureRefs} onChange={setScriptureRefs} placeholder="John 14:6, Ps 23:1" palette={palette} />
                  <Chips
                    options={[{ key: 'en', label: 'English' }, { key: 'fr', label: 'French' }, { key: 'pt', label: 'Portuguese' }, { key: 'sw', label: 'Swahili' }]}
                    selected={language}
                    onSelect={setLanguage}
                    palette={palette}
                  />
                  <Pressable
                    onPress={handleCreate}
                    disabled={saving}
                    style={[styles.saveBtn, { backgroundColor: palette.primary }]}
                  >
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Create meditation</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 14 }}>{item.content_type === 'video' ? '🎥' : '✝️'}</Text>
                  <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                  <StatusBadge status={item.status} palette={palette} />
                </View>
                {item.body ? (
                  <Text style={[styles.cardBody, { color: palette.subtext }]} numberOfLines={2}>{item.body}</Text>
                ) : null}
                {item.scripture_refs?.length ? (
                  <Text style={[styles.cardMeta, { color: palette.primary }]}>{item.scripture_refs.join(', ')}</Text>
                ) : null}
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>{item.language?.toUpperCase()} · {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Not scheduled'}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => handlePublish(item)}
                  style={[styles.actionBtn, { borderColor: item.status === 'published' ? (palette.success ?? '#27AE60') : palette.primary }]}
                >
                  <Text style={{ color: item.status === 'published' ? (palette.success ?? '#27AE60') : palette.primary, fontSize: 10, fontWeight: '800' }}>
                    {item.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} style={{ padding: 4 }}>
                  <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '800', fontSize: 16 }}>×</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Books & Categories Section ────────────────────────────────────────────────

function BooksSection({ palette }: { palette: any }) {
  const [items, setItems] = useState<KCANBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeGenre, setActiveGenre] = useState('all');
  // Form
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('theology');
  const [pdfUrl, setPdfUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [language, setLanguage] = useState('en');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.kcanBooks);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) { setError(e?.message || 'Failed to load books.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    setSaving(true);
    try {
      const payload: any = { title: title.trim(), author: author.trim(), description: description.trim(), genre, language, status: 'draft' };
      if (pdfUrl.trim()) payload.pdf_url = pdfUrl.trim();
      if (coverUrl.trim()) payload.cover_image = coverUrl.trim();
      const res: any = await postRequest((ROUTES as any).bible.kcanBooks, payload);
      if (res?.id || res?.data?.id) {
        setItems(prev => [res?.data ?? res, ...prev]);
        setTitle(''); setAuthor(''); setDescription(''); setPdfUrl(''); setCoverUrl('');
        setShowForm(false);
      } else {
        Alert.alert('Error', res?.message || 'Could not create book.');
      }
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handlePublish = async (item: KCANBook) => {
    try {
      const newStatus = item.status === 'published' ? 'draft' : 'published';
      await patchRequest(`${(ROUTES as any).bible.kcanBooks}${item.id}/`, { status: newStatus });
      setItems(prev => prev.map(b => b.id === item.id ? { ...b, status: newStatus } : b));
    } catch (e: any) { Alert.alert('Error', e?.message || 'Could not update.'); }
  };

  const handleDelete = (item: KCANBook) => {
    Alert.alert('Delete book', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(`${(ROUTES as any).bible.kcanBooks}${item.id}/`);
            setItems(prev => prev.filter(b => b.id !== item.id));
          } catch (e: any) { Alert.alert('Error', e?.message || 'Could not delete.'); }
        },
      },
    ]);
  };

  const filtered = activeGenre === 'all' ? items : items.filter(b => b.genre === activeGenre);
  const genreOptions = [{ key: 'all', label: `All (${items.length})` }, ...BOOK_GENRES.map(g => ({ key: g.key, label: `${g.label} (${items.filter(b => b.genre === g.key).length})` }))];

  return (
    <SectionShell palette={palette}>
      <View style={[styles.filterRow, { borderBottomColor: palette.divider }]}>
        <Chips options={genreOptions} selected={activeGenre} onSelect={setActiveGenre} palette={palette} />
      </View>
      <View style={[styles.categoryInfo, { backgroundColor: palette.primary + '0D', borderBottomColor: palette.divider }]}>
        <Text style={[styles.cardMeta, { color: palette.primary }]}>
          Categories = genres. Each genre appears as a tab in the Books section of the app.
        </Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="📚" text={`No ${activeGenre === 'all' ? '' : activeGenre + ' '}books yet.`} palette={palette} />}
          ListFooterComponent={
            <View style={{ marginTop: 8 }}>
              <Pressable onPress={() => setShowForm(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
                <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>{showForm ? '↑ Cancel' : '+ Add book'}</Text>
              </Pressable>
              {showForm && (
                <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  <Text style={[styles.formTitle, { color: palette.text }]}>Add Book</Text>
                  <FieldInput label="Title *" value={title} onChange={setTitle} placeholder="Book title" palette={palette} />
                  <FieldInput label="Author" value={author} onChange={setAuthor} placeholder="Author name" palette={palette} />
                  <FieldInput label="Description" value={description} onChange={setDescription} placeholder="Short description..." multiline palette={palette} />
                  <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 4 }]}>Category (Genre)</Text>
                  <Chips options={BOOK_GENRES} selected={genre} onSelect={setGenre} palette={palette} />
                  <FieldInput label="PDF URL" value={pdfUrl} onChange={setPdfUrl} placeholder="https://example.com/book.pdf" palette={palette} />
                  <FieldInput label="Cover image URL" value={coverUrl} onChange={setCoverUrl} placeholder="https://example.com/cover.jpg" palette={palette} />
                  <Chips
                    options={[{ key: 'en', label: 'EN' }, { key: 'fr', label: 'FR' }, { key: 'pt', label: 'PT' }, { key: 'sw', label: 'SW' }]}
                    selected={language}
                    onSelect={setLanguage}
                    palette={palette}
                  />
                  <Pressable onPress={handleCreate} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Add book</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 18 }}>📚</Text>
                  <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                  <StatusBadge status={item.status} palette={palette} />
                </View>
                {item.author ? <Text style={[styles.cardMeta, { color: palette.subtext }]}>by {item.author}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                  <View style={[styles.badge, { backgroundColor: palette.primary + '22', borderColor: palette.primary + '44' }]}>
                    <Text style={{ color: palette.primary, fontSize: 9, fontWeight: '800' }}>{item.genre}</Text>
                  </View>
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>{item.language?.toUpperCase()}</Text>
                  {item.pdf_url ? <Text style={[styles.cardMeta, { color: palette.primary }]}>PDF</Text> : null}
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => handlePublish(item)}
                  style={[styles.actionBtn, { borderColor: item.status === 'published' ? (palette.success ?? '#27AE60') : palette.primary }]}
                >
                  <Text style={{ color: item.status === 'published' ? (palette.success ?? '#27AE60') : palette.primary, fontSize: 10, fontWeight: '800' }}>
                    {item.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} style={{ padding: 4 }}>
                  <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '800', fontSize: 16 }}>×</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Prayer Requests Section ───────────────────────────────────────────────────

function PrayerRequestsSection({ palette }: { palette: any }) {
  const [items, setItems] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [prayingId, setPrayingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.prayersAdminList);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load prayer requests.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkPrayed = async (item: PrayerRequest) => {
    setPrayingId(item.id);
    try {
      const res: any = await postRequest((ROUTES as any).bible.prayerMarkPrayed(item.id), {});
      const updated = res?.data ?? res;
      if (updated?.id) {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, answered: updated.answered } : p));
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update.');
    } finally {
      setPrayingId(null);
    }
  };

  const filtered =
    filter === 'unanswered' ? items.filter(p => !p.answered) :
    filter === 'answered' ? items.filter(p => p.answered) :
    items;

  return (
    <SectionShell palette={palette}>
      <View style={[styles.filterRow, { borderBottomColor: palette.divider }]}>
        <Chips
          options={[
            { key: 'all', label: `All (${items.length})` },
            { key: 'unanswered', label: `Awaiting prayer (${items.filter(p => !p.answered).length})` },
            { key: 'answered', label: `Prayed for (${items.filter(p => p.answered).length})` },
          ]}
          selected={filter}
          onSelect={setFilter}
          palette={palette}
        />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="🙏" text="No public prayer requests yet." palette={palette} />}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                {
                  borderColor: item.answered ? (palette.success ?? '#27AE60') + '66' : palette.divider,
                  backgroundColor: item.answered ? (palette.success ?? '#27AE60') + '0A' : palette.surface,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 16 }}>{item.answered ? '✅' : '🙏'}</Text>
                  <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={[styles.cardBody, { color: palette.subtext }]} numberOfLines={3}>{item.content}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {item.user_display ? (
                    <Text style={[styles.cardMeta, { color: palette.subtext }]}>👤 {item.user_display}</Text>
                  ) : null}
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleMarkPrayed(item)}
                disabled={prayingId === item.id}
                style={[
                  styles.prayBtn,
                  {
                    backgroundColor: item.answered ? (palette.success ?? '#27AE60') + '22' : palette.primary + '22',
                    borderColor: item.answered ? (palette.success ?? '#27AE60') : palette.primary,
                  },
                ]}
              >
                {prayingId === item.id ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Text style={{ color: item.answered ? (palette.success ?? '#27AE60') : palette.primary, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>
                    {item.answered ? 'Prayed\nfor ✓' : 'Mark as\nPrayed'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Daily Passages Section ────────────────────────────────────────────────────

function DailyPassagesSection({ palette }: { palette: any }) {
  const [items, setItems] = useState<DailyPassage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passageRef, setPassageRef] = useState('');
  const [verseText, setVerseText] = useState('');
  const [date, setDate] = useState('');
  const [language, setLanguage] = useState('en');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.dailyPassages);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) { setError(e?.message || 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!passageRef.trim() || !date.trim()) { Alert.alert('Passage reference and date required.'); return; }
    setSaving(true);
    try {
      const payload: any = { passage_reference: passageRef.trim(), date: date.trim(), language, status: 'published' };
      if (verseText.trim()) payload.verse_text = verseText.trim();
      const res: any = await postRequest((ROUTES as any).bible.dailyPassages, payload);
      if (res?.id || res?.data?.id) {
        setItems(prev => [res?.data ?? res, ...prev]);
        setPassageRef(''); setVerseText(''); setDate('');
        setShowForm(false);
      } else {
        Alert.alert('Error', res?.message || 'Could not schedule passage.');
      }
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (item: DailyPassage) => {
    Alert.alert('Remove passage', `Remove passage for ${item.date}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(`${(ROUTES as any).bible.dailyPassages}${item.id}/`);
            setItems(prev => prev.filter(p => p.id !== item.id));
          } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
        },
      },
    ]);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <SectionShell palette={palette}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="📅" text="No daily passages scheduled yet." palette={palette} />}
          ListFooterComponent={
            <View style={{ marginTop: 8 }}>
              <Pressable onPress={() => setShowForm(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
                <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>{showForm ? '↑ Cancel' : '+ Schedule passage'}</Text>
              </Pressable>
              {showForm && (
                <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  <Text style={[styles.formTitle, { color: palette.text }]}>Schedule Daily Passage</Text>
                  <FieldInput label="Passage reference *" value={passageRef} onChange={setPassageRef} placeholder="e.g. John 3:16 or Psalm 23:1-6" palette={palette} />
                  <FieldInput label="Date * (YYYY-MM-DD)" value={date} onChange={setDate} placeholder={today} palette={palette} />
                  <FieldInput label="Verse text (optional)" value={verseText} onChange={setVerseText} placeholder="Paste the verse text here..." multiline palette={palette} />
                  <Chips
                    options={[{ key: 'en', label: 'EN' }, { key: 'fr', label: 'FR' }, { key: 'pt', label: 'PT' }, { key: 'sw', label: 'SW' }]}
                    selected={language}
                    onSelect={setLanguage}
                    palette={palette}
                  />
                  <Pressable onPress={handleCreate} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Schedule</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const isToday = item.date === today;
            return (
              <View
                style={[
                  styles.card,
                  {
                    borderColor: isToday ? palette.primary : palette.divider,
                    backgroundColor: isToday ? palette.primary + '0D' : palette.surface,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>{item.passage_reference || item.date}</Text>
                    {isToday && (
                      <View style={[styles.badge, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>TODAY</Text>
                      </View>
                    )}
                    <StatusBadge status={item.status} palette={palette} />
                  </View>
                  <Text style={[styles.cardMeta, { color: palette.subtext, marginTop: 2 }]}>
                    {item.date} · {item.language?.toUpperCase()}
                  </Text>
                  {item.verse_text ? (
                    <Text style={[styles.cardBody, { color: palette.subtext, fontStyle: 'italic' }]} numberOfLines={2}>
                      "{item.verse_text}"
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => handleDelete(item)} style={{ padding: 4 }}>
                  <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '800', fontSize: 16 }}>×</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </SectionShell>
  );
}

// ─── Push Notifications Section ───────────────────────────────────────────────

function PushNotificationsSection({ palette }: { palette: any }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [target, setTarget] = useState('all_members');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getRequest('/api/v1/bible/admin/push-campaigns/');
      const d = res?.data ?? res;
      setCampaigns(Array.isArray(d) ? d : d?.results ?? []);
    } catch { /* endpoint may not exist yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { Alert.alert('Title and message required.'); return; }
    setSaving(true);
    try {
      const payload = { title: title.trim(), message: message.trim(), target, schedule_at: scheduleAt.trim() || null };
      const res: any = await postRequest('/api/v1/bible/admin/push-campaigns/', payload);
      if (res?.id || res?.data?.id) {
        setCampaigns(prev => [res?.data ?? res, ...prev]);
        setTitle(''); setMessage(''); setScheduleAt('');
        setShowForm(false);
        Alert.alert('Sent!', scheduleAt ? 'Campaign scheduled.' : 'Push notification sent.');
      } else {
        Alert.alert('Error', res?.message || 'Could not send.');
      }
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <SectionShell palette={palette}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}>
        <Pressable onPress={() => setShowForm(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
          <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>{showForm ? '↑ Cancel' : '+ Compose push notification'}</Text>
        </Pressable>
        {showForm && (
          <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={[styles.formTitle, { color: palette.text }]}>Compose Push Notification</Text>
            <FieldInput label="Title *" value={title} onChange={setTitle} placeholder="e.g. Today's Verse" palette={palette} />
            <FieldInput label="Message *" value={message} onChange={setMessage} placeholder="Your notification message..." multiline palette={palette} />
            <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 4 }]}>Target audience</Text>
            <Chips
              options={[
                { key: 'all_members', label: 'All members' },
                { key: 'subscribers', label: 'Subscribers' },
                { key: 'active_readers', label: 'Active readers' },
              ]}
              selected={target}
              onSelect={setTarget}
              palette={palette}
            />
            <FieldInput label="Schedule (YYYY-MM-DD HH:MM) — leave blank to send now" value={scheduleAt} onChange={setScheduleAt} placeholder="2025-06-01 08:00" palette={palette} />
            <Pressable onPress={handleSend} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{scheduleAt ? 'Schedule' : 'Send now'}</Text>
              )}
            </Pressable>
          </View>
        )}

        <Text style={[styles.formTitle, { color: palette.text, marginTop: 16 }]}>Campaign history</Text>
        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
        ) : campaigns.length === 0 ? (
          <EmptyState icon="🔔" text="No campaigns sent yet." palette={palette} />
        ) : (
          campaigns.map(c => (
            <View key={c.id} style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{c.title}</Text>
                <Text style={[styles.cardBody, { color: palette.subtext }]} numberOfLines={2}>{c.message}</Text>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {c.target} · {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : 'Scheduled'} · {c.sent_count ?? 0} sent
                </Text>
              </View>
              <StatusBadge status={c.status ?? 'sent'} palette={palette} />
            </View>
          ))
        )}
      </ScrollView>
    </SectionShell>
  );
}

// ─── Prayer Calendar Section ───────────────────────────────────────────────────

function PrayerCalendarSection({ palette }: { palette: any }) {
  const [months, setMonths] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.prayerMonths);
      const d = res?.data ?? res;
      setMonths(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) { setError(e?.message || 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !year || !month) { Alert.alert('Year, month and title required.'); return; }
    setSaving(true);
    try {
      const res: any = await postRequest((ROUTES as any).bible.prayerMonths, {
        year: parseInt(year), month: parseInt(month), title: title.trim(), theme: theme.trim(), status: 'published',
      });
      if (res?.id || res?.data?.id) {
        setMonths(prev => [res?.data ?? res, ...prev]);
        setTitle(''); setTheme('');
        setShowForm(false);
      } else {
        Alert.alert('Error', res?.message || 'Could not create.');
      }
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <SectionShell palette={palette}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={months}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="🗓" text="No prayer calendar months yet." palette={palette} />}
          ListFooterComponent={
            <View style={{ marginTop: 8 }}>
              <Pressable onPress={() => setShowForm(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
                <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>{showForm ? '↑ Cancel' : '+ Add prayer month'}</Text>
              </Pressable>
              {showForm && (
                <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  <Text style={[styles.formTitle, { color: palette.text }]}>New Prayer Month</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <FieldInput label="Year *" value={year} onChange={setYear} placeholder="2025" palette={palette} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldInput label="Month * (1-12)" value={month} onChange={setMonth} placeholder="6" palette={palette} keyboardType="numeric" />
                    </View>
                  </View>
                  <FieldInput label="Title *" value={title} onChange={setTitle} placeholder="e.g. Month of Breakthrough" palette={palette} />
                  <FieldInput label="Theme" value={theme} onChange={setTheme} placeholder="e.g. Intercession for the Nations" palette={palette} />
                  <Pressable onPress={handleCreate} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Create month</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 20 }}>🗓</Text>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>{item.title}</Text>
                    <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                      {MONTH_NAMES[(item.month ?? 1) - 1]} {item.year} {item.theme ? `· ${item.theme}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
              <StatusBadge status={item.status ?? 'draft'} palette={palette} />
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Courses Section ───────────────────────────────────────────────────────────

function CoursesSection({ palette }: { palette: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.courses);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) { setError(e?.message || 'Failed.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell palette={palette}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="🎓" text="No courses created yet." palette={palette} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.lessons_count ?? item.module_count ?? 0} lessons · {item.enrollment_count ?? 0} enrolled
                </Text>
                {item.description ? (
                  <Text style={[styles.cardBody, { color: palette.subtext }]} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              <StatusBadge status={item.status ?? 'draft'} palette={palette} />
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Reading Plans Section ─────────────────────────────────────────────────────

function ReadingPlansSection({ palette }: { palette: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest((ROUTES as any).bible.plans);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) { setError(e?.message || 'Failed.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell palette={palette}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="🗺" text="No reading plans yet." palette={palette} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.duration_days ?? item.item_count ?? 0} days · {item.enrollment_count ?? 0} enrolled
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Analytics Section ─────────────────────────────────────────────────────────

function AnalyticsSection({ palette }: { palette: any }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest('/api/v1/bible/admin/analytics/');
      setData(res?.data ?? res ?? {});
    } catch (e: any) {
      try {
        const fallback: any = await getRequest((ROUTES as any).bible.stats);
        setData(fallback?.data ?? fallback ?? {});
      } catch {
        setError(e?.message || 'Failed to load analytics.');
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell palette={palette}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <SectionError message={error} onRetry={load} palette={palette} />
      ) : !data || Object.keys(data).length === 0 ? (
        <EmptyState icon="📊" text="No analytics data available yet." palette={palette} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {Object.entries(data).map(([k, v]) => (
            <View key={k} style={[styles.kpiRow, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.kpiKey, { color: palette.subtext }]}>{k.replace(/_/g, ' ')}</Text>
              <Text style={[styles.kpiVal, { color: palette.text }]}>{String(v)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SectionShell>
  );
}

// ─── Generic Section ───────────────────────────────────────────────────────────

const GENERIC_URLS: Partial<Record<BibleSection, string>> = {
  devotionals:    '/api/v1/bible/admin/devotionals/',
  ministers:      '/api/v1/bible/kcan-ministers/',
  notes_highlights: '/api/v1/bible/notes/',
  translations:   '/api/v1/bible/translation-registry/',
  languages:      '/api/v1/bible/admin/languages/',
  monetisation:   '/api/v1/bible/admin/monetisation/',
};

function GenericSection({ section, palette }: { section: BibleSection; palette: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = GENERIC_URLS[section] ?? `/api/v1/bible/admin/${section.replace('_', '-')}/`;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await getRequest(url);
      const d = res?.data ?? res;
      setItems(Array.isArray(d) ? d : d?.results ?? []);
    } catch (e: any) { setError(e?.message || 'Failed to load.'); }
    finally { setLoading(false); }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell palette={palette}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <View style={[styles.center, { gap: 12 }]}>
          <Text style={{ fontSize: 32 }}>🔒</Text>
          <Text style={[styles.bodyText, { color: palette.subtext, textAlign: 'center' }]}>
            This section is managed via the web dashboard or is not yet available in the mobile admin panel.
          </Text>
          <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }]}>
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="📋" text="No items yet." palette={palette} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => String(item?.id ?? i)}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {item?.title || item?.name || item?.label || item?.code || String(item?.id)}
                </Text>
                {(item?.status || item?.language) ? (
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                    {[item?.status, item?.language?.toUpperCase()].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {item?.status ? <StatusBadge status={item.status} palette={palette} /> : null}
            </View>
          )}
        />
      )}
    </SectionShell>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    borderLeftWidth: 1, zIndex: 200, elevation: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  backBtn: { paddingVertical: 8, paddingRight: 10, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  grid: { padding: 12 },
  sectionCard: { width: '47.5%', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 11, lineHeight: 15 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  categoryInfo: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  card: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardBody: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  cardMeta: { fontSize: 11, marginTop: 2 },
  cardActions: { alignItems: 'flex-end', gap: 6 },
  actionBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  prayBtn: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 72,
  },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  addBtn: { borderWidth: 1.5, borderRadius: 10, borderStyle: 'dashed', paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  form: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  formTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  saveBtn: { marginTop: 12, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  kpiKey: { fontSize: 13, textTransform: 'capitalize' },
  kpiVal: { fontSize: 13, fontWeight: '700' },
  bodyText: { fontSize: 13, lineHeight: 20 },
});
