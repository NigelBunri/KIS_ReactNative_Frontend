import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

const HIGHLIGHT_COLORS = ['#FACC15', '#F97316', '#22C55E', '#0EA5E9', '#A855F7'];

export default function StudyToolsPanel() {
  const { palette } = useKISTheme();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<any | null>(null);
  const [noteText, setNoteText] = useState('');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [memoryVerses, setMemoryVerses] = useState<any[]>([]);
  const [crossRefs, setCrossRefs] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [parallelTranslation, setParallelTranslation] = useState<string | null>(null);
  const [parallelVerse, setParallelVerse] = useState<string | null>(null);

  const loadResources = async () => {
    const [bmRes, hlRes, noteRes, memRes, trRes] = await Promise.all([
      getRequest(ROUTES.bible.bookmarks, { errorMessage: 'Unable to load bookmarks.' }),
      getRequest(ROUTES.bible.highlights, { errorMessage: 'Unable to load highlights.' }),
      getRequest(ROUTES.bible.notes, { errorMessage: 'Unable to load notes.' }),
      getRequest(ROUTES.bible.memory, { errorMessage: 'Unable to load memory verses.' }),
      getRequest(ROUTES.bible.translations, { errorMessage: 'Unable to load translations.' }),
    ]);
    setBookmarks(bmRes?.data?.results ?? bmRes?.data ?? []);
    setHighlights(hlRes?.data?.results ?? hlRes?.data ?? []);
    setNotes(noteRes?.data?.results ?? noteRes?.data ?? []);
    setMemoryVerses(memRes?.data?.results ?? memRes?.data ?? []);
    const transPayload = trRes?.data?.results ?? trRes?.data ?? [];
    setTranslations(Array.isArray(transPayload) ? transPayload : []);
  };

  useEffect(() => {
    loadResources();
  }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    const res = await getRequest(`${ROUTES.bible.search}?q=${encodeURIComponent(query.trim())}`, {
      errorMessage: 'Unable to search verses.',
    });
    const payload = res?.data?.results ?? [];
    setSearchResults(Array.isArray(payload) ? payload : []);
  };

  const loadCrossRefs = async (verseId: string) => {
    const res = await getRequest(`${ROUTES.bible.crossReferences}?verse=${verseId}`, {
      errorMessage: 'Unable to load cross references.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setCrossRefs(Array.isArray(payload) ? payload : []);
  };

  const loadParallelVerse = async (verse: any, translationCode: string) => {
    if (!verse?.chapter?.book?.code) return;
    const res = await getRequest(
      `${ROUTES.bible.reader}?translation=${translationCode}&book=${verse.chapter.book.code}&chapter=${verse.chapter.number}`,
      { errorMessage: 'Unable to load parallel verse.' },
    );
    const list = res?.data?.verses ?? [];
    const match = list.find((item: any) => Number(item.number) === Number(verse.number));
    setParallelVerse(match?.text ?? null);
  };

  const selectVerse = (verse: any) => {
    setSelectedVerse(verse);
    setNoteText('');
    loadCrossRefs(String(verse.id));
    if (parallelTranslation) {
      loadParallelVerse(verse, parallelTranslation);
    }
  };

  const addBookmark = async () => {
    if (!selectedVerse) return;
    const res = await postRequest(
      ROUTES.bible.bookmarks,
      { verse: selectedVerse.id },
      { errorMessage: 'Unable to add bookmark.' },
    );
    if (res?.success) loadResources();
  };

  const addHighlight = async () => {
    if (!selectedVerse) return;
    const res = await postRequest(
      ROUTES.bible.highlights,
      { verse: selectedVerse.id, color: highlightColor },
      { errorMessage: 'Unable to add highlight.' },
    );
    if (res?.success) loadResources();
  };

  const addNote = async () => {
    if (!selectedVerse || !noteText.trim()) return;
    const res = await postRequest(
      ROUTES.bible.notes,
      { verse: selectedVerse.id, text: noteText.trim() },
      { errorMessage: 'Unable to add note.' },
    );
    if (res?.success) {
      setNoteText('');
      loadResources();
    }
  };

  const addMemoryVerse = async () => {
    if (!selectedVerse) return;
    const next = new Date();
    next.setDate(next.getDate() + 7);
    const res = await postRequest(
      ROUTES.bible.memory,
      { verse: selectedVerse.id, next_review_date: next.toISOString().slice(0, 10) },
      { errorMessage: 'Unable to add memory verse.' },
    );
    if (res?.success) loadResources();
  };

  const shareVerse = async () => {
    if (!selectedVerse) return;
    const reference = `${selectedVerse.chapter?.book?.name} ${selectedVerse.chapter?.number}:${selectedVerse.number}`;
    await Share.share({ message: `${reference}\n${selectedVerse.text}` });
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Study tools</Text>
      <Text style={{ color: palette.subtext }}>
        Search a passage to bookmark, highlight, add notes, or build memory verses.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a verse or keyword"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
        />
        <KISButton title="Search" size="sm" onPress={runSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultsRow}>
        {searchResults.slice(0, 8).map((verse) => (
          <Pressable
            key={verse.id}
            onPress={() => selectVerse(verse)}
            style={[
              styles.resultCard,
              {
                borderColor: palette.divider,
                backgroundColor: selectedVerse?.id === verse.id ? palette.primarySoft : palette.surface,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontWeight: '600' }} numberOfLines={1}>
              {verse.chapter?.book?.name} {verse.chapter?.number}:{verse.number}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
              {verse.text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {selectedVerse ? (
        <View style={[styles.selectedBox, { borderColor: palette.divider }]}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>
            {selectedVerse.chapter?.book?.name} {selectedVerse.chapter?.number}:{selectedVerse.number}
          </Text>
          <Text style={{ color: palette.text, marginTop: 6 }}>{selectedVerse.text}</Text>

          <View style={styles.actionRow}>
            <KISButton title="Bookmark" size="xs" variant="outline" onPress={addBookmark} />
            <KISButton title="Memory" size="xs" variant="outline" onPress={addMemoryVerse} />
            <KISButton title="Share" size="xs" variant="ghost" onPress={shareVerse} />
          </View>

          <View style={styles.colorRow}>
            {HIGHLIGHT_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setHighlightColor(color)}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: color,
                    borderColor: highlightColor === color ? palette.text : 'transparent',
                  },
                ]}
              />
            ))}
            <KISButton title="Highlight" size="xs" onPress={addHighlight} />
          </View>

          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Add a study note"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { borderColor: palette.divider, color: palette.text, minHeight: 70 }]}
            multiline
          />
          <KISButton title="Save note" size="sm" onPress={addNote} />
        </View>
      ) : null}

      {selectedVerse && translations.length > 1 ? (
        <View style={[styles.selectedBox, { borderColor: palette.divider }]}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>Parallel view</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultsRow}>
            {translations.slice(0, 6).map((translation) => (
              <Pressable
                key={translation.id}
                onPress={() => {
                  setParallelTranslation(translation.code);
                  loadParallelVerse(selectedVerse, translation.code);
                }}
                style={[
                  styles.translationChip,
                  {
                    borderColor: palette.divider,
                    backgroundColor: parallelTranslation === translation.code ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={{ color: palette.text }}>{translation.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {parallelVerse ? (
            <Text style={{ color: palette.subtext, marginTop: 6 }}>{parallelVerse}</Text>
          ) : (
            <Text style={{ color: palette.subtext, marginTop: 6 }}>Select a translation to compare.</Text>
          )}
        </View>
      ) : null}

      {selectedVerse && crossRefs.length > 0 ? (
        <View style={[styles.selectedBox, { borderColor: palette.divider }]}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>Cross references</Text>
          {crossRefs.slice(0, 4).map((ref) => (
            <Text key={ref.id} style={{ color: palette.subtext, marginTop: 4 }}>
              {ref.related_ref}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        {[
          { title: 'Bookmarks', count: bookmarks.length, icon: 'book' },
          { title: 'Highlights', count: highlights.length, icon: 'heart' },
          { title: 'Notes', count: notes.length, icon: 'comment' },
          { title: 'Memory verses', count: memoryVerses.length, icon: 'check' },
        ].map((tool) => (
          <View key={tool.title} style={[styles.toolCard, { borderColor: palette.divider }]}>
            <KISIcon name={tool.icon as any} size={18} color={palette.primaryStrong} />
            <Text style={{ color: palette.text, fontWeight: '600', marginTop: 6 }}>{tool.title}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
              {tool.count} saved
            </Text>
          </View>
        ))}
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  input: { borderWidth: 2, borderRadius: 10, padding: 10, flex: 1 },
  resultsRow: { gap: 10, paddingVertical: 10 },
  resultCard: { width: 190, borderWidth: 2, borderRadius: 12, padding: 10 },
  selectedBox: { borderWidth: 2, borderRadius: 12, padding: 12, marginTop: 12, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  translationChip: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  toolCard: { borderWidth: 2, borderRadius: 12, padding: 12, width: '47%' },
});
