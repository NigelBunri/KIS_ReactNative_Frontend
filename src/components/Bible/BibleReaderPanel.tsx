import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Video from 'react-native-video';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import TranslationPicker from './TranslationPicker';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES, {
  API_BASE_URL,
  buildMediaSource,
  useMediaHeaders,
} from '@/network';
import type { BibleBook, BibleReaderPayload, BibleTranslation } from '@/screens/tabs/bible/useBibleData';

const MAX_PREVIEW_VERSES = 30;

type Props = {
  translations: BibleTranslation[];
  books: BibleBook[];
  reader: BibleReaderPayload | null;
  loading: boolean;
  onLoad: (translation?: string, book?: string, chapter?: number) => void;
};

export default function BibleReaderPanel({
  translations,
  books,
  reader,
  loading,
  onLoad,
}: Props) {
  const { palette } = useKISTheme();
  const [selectedTranslation, setSelectedTranslation] = useState<string | undefined>(reader?.translation?.code);
  const [selectedBook, setSelectedBook] = useState<string | undefined>(reader?.book?.code);
  const [chapterInput, setChapterInput] = useState(String(reader?.chapter?.number ?? 1));
  const [chapters, setChapters] = useState<any[]>([]);
  const [activeVerse, setActiveVerse] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [audioSync, setAudioSync] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const mediaHeaders = useMediaHeaders();
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setSelectedTranslation(reader?.translation?.code);
    setSelectedBook(reader?.book?.code);
    setChapterInput(String(reader?.chapter?.number ?? 1));
  }, [reader?.translation?.code, reader?.book?.code, reader?.chapter?.number]);

  const verses = reader?.verses ?? [];

  useEffect(() => {
    if (!isPlaying) return;
    if (!reader?.audio?.segments?.length) return;
    setActiveVerse(null);
  }, [isPlaying, reader?.audio?.segments?.length]);

  const onStartPlayback = () => {
    setActiveVerse(null);
    setIsPlaying(true);
  };

  const onStopPlayback = () => {
    setIsPlaying(false);
    setActiveVerse(null);
  };

  const bookList = useMemo(() => books, [books]);
  const currentTranslationCode = selectedTranslation ?? reader?.translation?.code ?? translations[0]?.code;
  const currentBookCode = selectedBook ?? reader?.book?.code ?? books[0]?.code;
  const selectedBookObj = useMemo(
    () => books.find((book) => book.code === currentBookCode) || books[0],
    [books, currentBookCode],
  );
  const translationDisplayName = useMemo(
    () =>
      translations.find((t) => t.code === currentTranslationCode)?.name ??
      reader?.translation?.name ??
      'Holy Bible',
    [translations, currentTranslationCode, reader?.translation?.name],
  );
  const audioUrl = reader?.audio?.audio_file
    ? reader.audio.audio_file.startsWith('http')
      ? reader.audio.audio_file
      : `${API_BASE_URL}${reader.audio.audio_file}`
    : null;
  const audioSource = buildMediaSource(audioUrl, mediaHeaders);
  const displayedChapter = reader?.chapter?.number ?? Number(chapterInput || 1);
  const limitedSearchResults = searchResults.slice(0, 6);
  const callLoad = (chapterNum?: number, translationCode?: string, bookCode?: string) => {
    const translationParam = translationCode ?? currentTranslationCode;
    const bookParam = bookCode ?? currentBookCode;
    if (!translationParam || !bookParam) return;
    onLoad(translationParam, bookParam, chapterNum ?? Number(chapterInput || 1));
  };

  useEffect(() => {
    const loadPrefs = async () => {
      const res = await getRequest(ROUTES.bible.preferences, {
        errorMessage: 'Unable to load preferences.',
      });
      const payload = res?.data?.results ?? res?.data ?? [];
      const prefs = Array.isArray(payload) ? payload[0] : payload;
      if (prefs) {
        setAudioSpeed(Number(prefs.audio_speed || 1.0));
        setAudioSync(Boolean(prefs.enable_audio_sync ?? true));
      }
    };
    loadPrefs();
  }, []);

  useEffect(() => {
    const loadChapters = async () => {
      if (!selectedBookObj?.id) return;
      const res = await getRequest(`${ROUTES.bible.chapters}?book=${selectedBookObj.id}`, {
        errorMessage: 'Unable to load chapters.',
      });
      const payload = res?.data?.results ?? res?.data ?? [];
      setChapters(Array.isArray(payload) ? payload : []);
    };
    loadChapters();
  }, [selectedBookObj?.id]);

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const translationId = reader?.translation?.id;
    const params = new URLSearchParams({ q: searchQuery.trim() });
    if (translationId) params.append('translation', String(translationId));
    const res = await getRequest(`${ROUTES.bible.search}?${params.toString()}`, {
      errorMessage: 'Unable to search verses.',
    });
    const payload = res?.data?.results ?? [];
    setSearchResults(Array.isArray(payload) ? payload : []);
    setSearching(false);
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Read & listen</Text>
      <View style={[styles.readerHeader, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <Text style={[styles.translationLabel, { color: palette.subtext }]} numberOfLines={1}>
          {translationDisplayName}
        </Text>
        <Text style={[styles.chapterTitle, { color: palette.text }]} numberOfLines={1}>
          {selectedBookObj?.name ?? 'Bible'} {displayedChapter}
        </Text>
      </View>
      <TranslationPicker
        translations={translations}
        selected={selectedTranslation}
        onSelect={(code) => {
          setSelectedTranslation(code);
          callLoad(Number(chapterInput || 1), code);
        }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookRow}>
        {bookList.map((book) => {
          const isSelected = book.code === selectedBook;
          return (
            <TouchableOpacity
              key={book.id}
              onPress={() => {
                setSelectedBook(book.code);
                callLoad(Number(chapterInput || 1), undefined, book.code);
              }}
              style={[
                styles.bookChip,
                {
                  backgroundColor: isSelected ? palette.primarySoft : palette.surface,
                  borderColor: palette.divider,
                },
              ]}
            >
              <Text style={{ color: isSelected ? palette.primaryStrong : palette.text }}>{book.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.chapterRow}>
        <Text style={{ color: palette.subtext }}>Chapter</Text>
        <TextInput
          value={chapterInput}
          onChangeText={setChapterInput}
          keyboardType="number-pad"
          style={[styles.chapterInput, { borderColor: palette.divider, color: palette.text }]}
        />
        <KISButton
          title="Load"
          size="xs"
          onPress={() => callLoad(Number(chapterInput || 1))}
        />
      </View>

      {chapters.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapterRowScroll}>
          {chapters.map((chapter) => {
            const isActive = Number(chapter.number) === Number(chapterInput);
            return (
              <TouchableOpacity
                key={chapter.id}
                onPress={() => {
                  setChapterInput(String(chapter.number));
                  callLoad(Number(chapter.number));
                }}
                style={[
                  styles.chapterChip,
                  {
                    backgroundColor: isActive ? palette.primarySoft : palette.surface,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={{ color: isActive ? palette.primaryStrong : palette.text }}>{chapter.number}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.audioRow, { borderColor: palette.divider }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KISIcon name={isPlaying ? 'pause' : 'play'} size={18} color={palette.primaryStrong} />
          <Text style={{ color: palette.text, fontWeight: '600' }}>Audio reading</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isPlaying ? (
            <KISButton title="Stop" size="sm" variant="outline" onPress={onStopPlayback} />
          ) : (
            <KISButton title={audioUrl ? 'Play' : 'No audio'} size="sm" onPress={onStartPlayback} disabled={!audioUrl} />
          )}
        </View>
      </View>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Audio sync follows verse timing when audio is available.
      </Text>

      <View style={[styles.readerBox, { borderColor: palette.divider }]}>
        {loading ? (
          <Text style={{ color: palette.subtext }}>Loading passage...</Text>
        ) : (
          verses.slice(0, MAX_PREVIEW_VERSES).map((verse) => {
            const isActive = verse.number === activeVerse;
            return (
              <View
                key={verse.id}
                style={[
                  styles.verseRow,
                  {
                    backgroundColor: isActive ? palette.primarySoft : 'transparent',
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={[styles.verseNumber, { color: palette.subtext }]}>{verse.number}</Text>
                <Text style={[styles.verseText, { color: palette.text }]}>{verse.text}</Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.searchPanel}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Verse search</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for a verse or keyword"
            placeholderTextColor={palette.subtext}
            style={[styles.searchInput, { borderColor: palette.divider, color: palette.text }]}
          />
          <KISButton title={searching ? '...' : 'Search'} size="xs" onPress={runSearch} />
        </View>
        <View style={{ gap: 8 }}>
          {limitedSearchResults.map((verse, index) => {
            const previousBookName = limitedSearchResults[index - 1]?.chapter?.book?.name;
            const showBookLabel =
              !!verse.chapter?.book?.name && verse.chapter?.book?.name !== previousBookName;
            return (
              <View key={verse.id} style={[styles.searchResult, { borderColor: palette.divider }]}>
                {showBookLabel ? (
                  <Text style={[styles.searchBookLabel, { color: palette.primaryStrong }]}>
                    {verse.chapter?.book?.name}
                  </Text>
                ) : null}
                <Text style={[styles.searchReference, { color: palette.subtext }]}>
                  {verse.chapter?.number}:{verse.number}
                </Text>
                <Text style={{ color: palette.text, marginTop: 4 }}>{verse.text}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {audioUrl ? (
        <Video
          source={audioSource ?? { uri: audioUrl }}
          paused={!isPlaying}
          audioOnly
          rate={audioSpeed}
          playInBackground
          onProgress={(progress) => {
            if (!audioSync) return;
            const currentMs = Math.floor(progress.currentTime * 1000);
            const segments = reader?.audio?.segments ?? [];
            const match = segments.find(
              (segment: any) => currentMs >= segment.start_ms && currentMs <= segment.end_ms,
            );
            if (match?.verse_number && match.verse_number !== activeVerse) {
              setActiveVerse(match.verse_number);
            }
          }}
          onEnd={onStopPlayback}
          style={{ width: 0, height: 0 }}
        />
      ) : null}
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  bookRow: { gap: 8, paddingVertical: 6 },
  bookChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterInput: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minWidth: 60 },
  audioRow: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readerHeader: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
  },
  translationLabel: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  chapterTitle: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  readerBox: { borderWidth: 2, borderRadius: 12, padding: 10, gap: 6 },
  verseRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  verseNumber: { width: 28, fontWeight: '600', textAlign: 'right' },
  verseText: { flex: 1, lineHeight: 22 },
  chapterRowScroll: { gap: 8, paddingVertical: 6 },
  chapterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  searchPanel: { gap: 8, marginTop: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, borderWidth: 2, borderRadius: 10, padding: 10 },
  searchResult: { borderWidth: 2, borderRadius: 10, padding: 10 },
  searchBookLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  searchReference: { fontSize: 12 },
  suggestionBox: { borderWidth: 2, borderRadius: 10, padding: 10 },
});
