import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type {
  BibleBook,
  BibleReaderPayload,
  BibleTranslation,
  BibleVerse,
} from '@/screens/tabs/bible/useBibleData';
import {
  BIBLE_OFFLINE_DOWNLOADS_UPDATED_EVENT,
  BibleOfflineManifest,
  BibleOfflineDownloadJob,
  enqueueBibleOfflineDownload,
  pauseBibleOfflineDownload,
  readBibleOfflineManifest,
  readBibleOfflineDownloadJobs,
  resumeBibleOfflineDownload,
  resumePausedBibleDownloadsWhenOnline,
  runBibleOfflineDownloadQueue,
} from '@/services/bibleOfflineCache';
import {
  BIBLE_PREFERENCES_UPDATED_EVENT,
  mergeAndWriteLocalBiblePreference,
  readLocalBiblePreference,
  writeLocalBiblePreference,
} from '@/services/biblePreferenceStore';
import {
  buildLocalBibleEvent,
  buildLocalLibraryItem,
  mergeBibleLibraryWithLocal,
  upsertLocalBibleEvent,
  upsertLocalBibleBookmark,
  upsertLocalBibleHighlight,
  upsertLocalBibleNote,
} from '@/services/bibleUserPersistence';
import { scheduleBibleReadingEventReminders } from '@/services/inAppNotificationService';

const HIGHLIGHT_COLORS = [
  '#FDE68A',
  '#BBF7D0',
  '#BFDBFE',
  '#FBCFE8',
  '#DDD6FE',
  '#FED7AA',
];

type Props = {
  translations: BibleTranslation[];
  books: BibleBook[];
  reader: BibleReaderPayload | null;
  loading: boolean;
  onRegisterFilterOpener?: (open: () => void) => void;
  onLoad: (
    translation?: string,
    book?: string,
    chapter?: number,
    reference?: string,
    startVerse?: number,
    endVerse?: number,
  ) => void;
};

type LibraryItem = {
  id: string;
  verse?: string;
  verse_ref?: string;
  verse_text?: string;
  translation?: string;
  color?: string;
  text?: string;
  created_at?: string;
  updated_at?: string;
  sync_status?: 'synced' | 'local_pending';
};

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const numericText = (value: string) => value.replace(/[^\d]/g, '');

const localDateTimeForTomorrow = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
};

export default function BibleReaderPanel({
  translations,
  books,
  reader,
  loading,
  onLoad,
  onRegisterFilterOpener,
}: Props) {
  const { palette } = useKISTheme();
  const solidSheetBg = palette.bg || palette.surface || '#FFFFFF';
  const [selectedTranslation, setSelectedTranslation] = useState<
    string | undefined
  >(reader?.translation?.code);
  const [selectedBook, setSelectedBook] = useState<string | undefined>(
    reader?.book?.code,
  );
  const [chapterInput, setChapterInput] = useState(
    String(reader?.chapter?.number ?? 1),
  );
  const [startVerse, setStartVerse] = useState('');
  const [endVerse, setEndVerse] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [noteText, setNoteText] = useState('');
  const [message, setMessage] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [highlights, setHighlights] = useState<LibraryItem[]>([]);
  const [notes, setNotes] = useState<LibraryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<LibraryItem[]>([]);
  const [highlightColors, setHighlightColors] = useState<
    Array<{ color: string; count: number }>
  >([]);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [libraryView, setLibraryView] = useState<
    'all' | 'highlights' | 'comments' | 'bookmarks'
  >('all');
  const [commentQuery, setCommentQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [savingPreference, setSavingPreference] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionVerse, setActionVerse] = useState<BibleVerse | null>(null);
  const [verseActionMode, setVerseActionMode] = useState<
    'menu' | 'highlight' | 'note' | null
  >(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(
    reader?.translation?.language,
  );
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [translationDropdownOpen, setTranslationDropdownOpen] = useState(false);
  const [offlineManifest, setOfflineManifest] = useState<BibleOfflineManifest>(
    {},
  );
  const [offlineJobs, setOfflineJobs] = useState<
    Record<string, BibleOfflineDownloadJob>
  >({});
  const swipeTranslateX = useRef(new Animated.Value(0)).current;

  const verses = reader?.verses ?? [];
  const currentTranslationCode =
    selectedTranslation ?? reader?.translation?.code ?? translations[0]?.code;
  const currentBookCode = selectedBook ?? reader?.book?.code ?? books[0]?.code;
  const selectedBookObj = useMemo(
    () => books.find(book => book.code === currentBookCode) || books[0],
    [books, currentBookCode],
  );
  const currentChapter = Number(chapterInput || reader?.chapter?.number || 1);
  const currentReference =
    reader?.reference ||
    `${
      reader?.book?.name ?? selectedBookObj?.name ?? 'Bible'
    } ${currentChapter}`;
  const currentTranslation = useMemo(
    () =>
      translations.find(
        translation => translation.code === currentTranslationCode,
      ) || translations[0],
    [translations, currentTranslationCode],
  );
  const languages = useMemo(() => {
    const map = new Map<string, BibleTranslation[]>();
    translations.forEach(translation => {
      const key = translation.language || 'unknown';
      map.set(key, [...(map.get(key) ?? []), translation]);
    });
    return Array.from(map.entries()).map(([language, items]) => ({
      language,
      items,
    }));
  }, [translations]);
  const activeLanguage =
    selectedLanguage || currentTranslation?.language || languages[0]?.language;
  const translationsForLanguage = useMemo(() => {
    const scoped = translations.filter(
      translation => (translation.language || 'unknown') === activeLanguage,
    );
    return scoped.length ? scoped : translations;
  }, [translations, activeLanguage]);
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 50) setFilterOpen(false);
        },
      }),
    [],
  );
  const loadNavigation = useCallback(
    (target?: any | null) => {
      if (!target || !currentTranslationCode) return;
      const bookCode = target.book?.code || target.book_code || target.book;
      const chapterNumber = Number(target.number || 1);
      if (!bookCode) return;
      setSelectedBook(bookCode);
      setChapterInput(String(chapterNumber));
      onLoad(currentTranslationCode, bookCode, chapterNumber);
    },
    [currentTranslationCode, onLoad],
  );

  const navigationPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
        onPanResponderMove: (_, gesture) => {
          swipeTranslateX.setValue(Math.max(-80, Math.min(80, gesture.dx)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 70 && reader?.navigation?.previous) {
            loadNavigation(reader.navigation.previous);
          } else if (gesture.dx < -70 && reader?.navigation?.next) {
            loadNavigation(reader.navigation.next);
          }
          Animated.spring(swipeTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
            tension: 90,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
            tension: 90,
          }).start();
        },
      }),
    [
      loadNavigation,
      reader?.navigation?.previous,
      reader?.navigation?.next,
      swipeTranslateX,
    ],
  );
  const leftArrowOpacity = swipeTranslateX.interpolate({
    inputRange: [0, 70],
    outputRange: [0.45, 1],
    extrapolate: 'clamp',
  });
  const rightArrowOpacity = swipeTranslateX.interpolate({
    inputRange: [-70, 0],
    outputRange: [1, 0.45],
    extrapolate: 'clamp',
  });
  const highlightByVerse = useMemo(() => {
    const map = new Map<string, string>();
    highlights.forEach(item => {
      if (item.verse && item.color) map.set(String(item.verse), item.color);
    });
    return map;
  }, [highlights]);
  const displayedLibraryItems = useMemo(() => {
    if (libraryView === 'highlights') return highlights;
    if (libraryView === 'comments') return notes;
    if (libraryView === 'bookmarks') return bookmarks;
    return [...highlights, ...notes, ...bookmarks].sort((a, b) =>
      String(b.updated_at || b.created_at || '').localeCompare(
        String(a.updated_at || a.created_at || ''),
      ),
    );
  }, [bookmarks, highlights, libraryView, notes]);

  useEffect(() => {
    setSelectedTranslation(reader?.translation?.code);
    setSelectedBook(reader?.book?.code);
    setChapterInput(String(reader?.chapter?.number ?? 1));
    if (reader?.translation?.language)
      setSelectedLanguage(reader.translation.language);
    setSelectedVerses(new Set());
  }, [
    reader?.translation?.code,
    reader?.translation?.language,
    reader?.book?.code,
    reader?.chapter?.number,
  ]);

  useEffect(() => {
    onRegisterFilterOpener?.(() => setFilterOpen(true));
  }, [onRegisterFilterOpener]);

  useEffect(() => {
    if (!selectedLanguage && currentTranslation?.language)
      setSelectedLanguage(currentTranslation.language);
  }, [selectedLanguage, currentTranslation?.language]);

  useEffect(() => {
    const loadPreferences = async () => {
      const local = await readLocalBiblePreference();
      if (local?.font_size) setFontSize(Number(local.font_size || 17));
      const res = await getRequest(ROUTES.bible.preferencesCurrent, {
        errorMessage: 'Unable to load reader preferences.',
      });
      if (!res?.success || !res.data) return;
      await writeLocalBiblePreference({ ...res.data, sync_status: 'synced' });
      setFontSize(Number(res.data.font_size || 17));
    };
    loadPreferences();
    const sub = DeviceEventEmitter.addListener(
      BIBLE_PREFERENCES_UPDATED_EVENT,
      (preference: any) => {
        if (preference?.font_size) setFontSize(Number(preference.font_size));
      },
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    readBibleOfflineManifest()
      .then(setOfflineManifest)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const refreshOfflineState = async () => {
      const [manifest, jobs] = await Promise.all([
        readBibleOfflineManifest(),
        readBibleOfflineDownloadJobs(),
      ]);
      setOfflineManifest(manifest);
      setOfflineJobs(jobs);
    };
    refreshOfflineState().catch(() => undefined);
    const downloadSub = DeviceEventEmitter.addListener(
      BIBLE_OFFLINE_DOWNLOADS_UPDATED_EVENT,
      () => {
        refreshOfflineState().catch(() => undefined);
      },
    );
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        resumePausedBibleDownloadsWhenOnline(books).catch(() => undefined);
      }
    });
    const netInfoUnsub = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        resumePausedBibleDownloadsWhenOnline(books).catch(() => undefined);
      }
    });
    resumePausedBibleDownloadsWhenOnline(books).catch(() => undefined);
    return () => {
      downloadSub.remove();
      appStateSub.remove();
      netInfoUnsub();
    };
  }, [books]);

  useEffect(() => {
    const loadChapters = async () => {
      if (!selectedBookObj?.id) return;
      const res = await getRequest(
        `${ROUTES.bible.chapters}?book=${selectedBookObj.id}`,
        {
          errorMessage: 'Unable to load chapters.',
        },
      );
      setChapters(listFromResponse(res?.data));
    };
    loadChapters();
  }, [selectedBookObj?.id]);

  const loadLibraries = useCallback(
    async (color?: string | null) => {
      if (!currentTranslationCode) return;
      setLibraryLoading(true);
      const suffix = `?translation=${encodeURIComponent(
        currentTranslationCode,
      )}`;
      const colorSuffix = color
        ? `${suffix}&color=${encodeURIComponent(color)}`
        : suffix;
      const [highlightRes, noteRes, bookmarkRes, colorRes] = await Promise.all([
        getRequest(`${ROUTES.bible.highlights}${colorSuffix}`, {
          errorMessage: 'Unable to load highlights.',
        }),
        getRequest(`${ROUTES.bible.notes}${suffix}`, {
          errorMessage: 'Unable to load notes.',
        }),
        getRequest(`${ROUTES.bible.bookmarks}${suffix}`, {
          errorMessage: 'Unable to load bookmarks.',
        }),
        getRequest(ROUTES.bible.highlightColors, {
          errorMessage: 'Unable to load highlight colors.',
        }),
      ]);
      const merged = await mergeBibleLibraryWithLocal({
        highlights: listFromResponse(highlightRes?.data),
        notes: listFromResponse(noteRes?.data),
        bookmarks: listFromResponse(bookmarkRes?.data),
        translationCode: currentTranslationCode,
        color,
        noteQuery: commentQuery,
      });
      setHighlights(merged.highlights);
      setNotes(merged.notes);
      setBookmarks(merged.bookmarks);
      const apiColors = listFromResponse(colorRes?.data);
      const colorMap = new Map<string, number>();
      apiColors.forEach(item =>
        colorMap.set(item.color, Number(item.count || 0)),
      );
      merged.highlights.forEach(item => {
        if (!item.color) return;
        colorMap.set(
          item.color,
          Math.max(
            colorMap.get(item.color) || 0,
            merged.highlights.filter(h => h.color === item.color).length,
          ),
        );
      });
      setHighlightColors(
        Array.from(colorMap.entries()).map(([itemColor, count]) => ({
          color: itemColor,
          count,
        })),
      );
      setLibraryLoading(false);
    },
    [commentQuery, currentTranslationCode],
  );

  useEffect(() => {
    loadLibraries(filterColor);
  }, [filterColor, loadLibraries]);

  const callLoad = (
    chapterNum?: number,
    translationCode?: string,
    bookCode?: string,
    rangeStart?: string,
    rangeEnd?: string,
  ) => {
    const translationParam = translationCode ?? currentTranslationCode;
    const bookParam = bookCode ?? currentBookCode;
    if (!translationParam || !bookParam) return;
    onLoad(
      translationParam,
      bookParam,
      chapterNum ?? currentChapter,
      undefined,
      rangeStart ? Number(rangeStart) : undefined,
      rangeEnd ? Number(rangeEnd) : rangeStart ? Number(rangeStart) : undefined,
    );
  };

  const loadReference = () => {
    if (!currentTranslationCode || !referenceInput.trim()) return;
    onLoad(currentTranslationCode, undefined, undefined, referenceInput.trim());
    setFilterOpen(false);
  };

  const selectLanguageFromFilter = (language: string) => {
    setSelectedLanguage(language);
    setLanguageDropdownOpen(false);
    const firstTranslation = translations.find(
      translation => (translation.language || 'unknown') === language,
    );
    if (firstTranslation) {
      setSelectedTranslation(firstTranslation.code);
      callLoad(currentChapter, firstTranslation.code);
    }
    setFilterOpen(false);
  };

  const selectTranslationFromFilter = (translation: BibleTranslation) => {
    setSelectedLanguage(translation.language || 'unknown');
    setSelectedTranslation(translation.code);
    setTranslationDropdownOpen(false);
    callLoad(currentChapter, translation.code);
    setFilterOpen(false);
  };

  const downloadTranslationForOffline = async (
    translation: BibleTranslation,
  ) => {
    if (!translation?.code || !books.length) return;
    await enqueueBibleOfflineDownload(translation, books);
    await runBibleOfflineDownloadQueue(books);
    setMessage(
      `${translation.name} queued for offline download. You can pause and resume it anytime.`,
    );
  };

  const pauseOfflineDownload = async (translation: BibleTranslation) => {
    await pauseBibleOfflineDownload(translation.code);
    setMessage(`${translation.name} download paused.`);
  };

  const resumeOfflineDownload = async (translation: BibleTranslation) => {
    await resumeBibleOfflineDownload(translation, books);
    setMessage(`${translation.name} download resumed.`);
  };

  const toggleVerse = (verseId: string) => {
    setSelectedVerses(prev => {
      const next = new Set(prev);
      if (next.has(verseId)) next.delete(verseId);
      else next.add(verseId);
      return next;
    });
  };

  const selectChapter = () => {
    setSelectedVerses(new Set(verses.map(verse => String(verse.id))));
  };

  const createForVerses = async (
    verseIds: string[],
    endpoint: string,
    payloadForVerse: (verseId: string) => Record<string, any>,
    label: string,
  ) => {
    if (!verseIds.length) {
      Alert.alert('Select verses', 'Choose one or more verses first.');
      return;
    }
    const results = await Promise.all(
      verseIds.map(verseId =>
        postRequest(endpoint, payloadForVerse(String(verseId)), {
          errorMessage: `Unable to ${label}.`,
        }),
      ),
    );
    const ok = results.some(res => res?.success);
    setMessage(
      ok
        ? `${label} saved.`
        : results[0]?.message ||
            `${label} saved locally and will sync when available.`,
    );
    await loadLibraries(filterColor);
    return results;
  };

  const addHighlightForVerse = async (verse: BibleVerse, color: string) => {
    const results = await createForVerses(
      [String(verse.id)],
      ROUTES.bible.highlights,
      id => ({ verse: id, color }),
      'Highlight',
    );
    await upsertLocalBibleHighlight(
      buildLocalLibraryItem({
        serverItem: results?.find(res => res?.success)?.data,
        verse,
        reference: currentReference,
        translationCode: currentTranslationCode,
        color,
        pending: !results?.some(res => res?.success),
      }),
    );
    await loadLibraries(filterColor);
    setActionVerse(null);
    setVerseActionMode(null);
  };

  const addBookmarkForVerse = async (verse: BibleVerse) => {
    const results = await createForVerses(
      [String(verse.id)],
      ROUTES.bible.bookmarks,
      id => ({ verse: id }),
      'Bookmark',
    );
    await upsertLocalBibleBookmark(
      buildLocalLibraryItem({
        serverItem: results?.find(res => res?.success)?.data,
        verse,
        reference: currentReference,
        translationCode: currentTranslationCode,
        pending: !results?.some(res => res?.success),
      }),
    );
    await loadLibraries(filterColor);
    setActionVerse(null);
    setVerseActionMode(null);
  };

  const addNoteForVerse = async () => {
    if (!actionVerse) return;
    if (!noteText.trim()) {
      Alert.alert('Write a comment', 'Enter a comment for this verse.');
      return;
    }
    const results = await createForVerses(
      [String(actionVerse.id)],
      ROUTES.bible.notes,
      verse => ({ verse, text: noteText.trim() }),
      'Comment',
    );
    await upsertLocalBibleNote(
      buildLocalLibraryItem({
        serverItem: results?.find(res => res?.success)?.data,
        verse: actionVerse,
        reference: currentReference,
        translationCode: currentTranslationCode,
        text: noteText.trim(),
        pending: !results?.some(res => res?.success),
      }),
    );
    setNoteText('');
    await loadLibraries(filterColor);
    setActionVerse(null);
    setVerseActionMode(null);
  };

  const addVerseToPlanner = async (verse: BibleVerse) => {
    if (!currentTranslationCode) return;
    const startAt = localDateTimeForTomorrow();
    const passageRef = `${currentReference.split(':')[0]}:${verse.number}`;
    const res = await postRequest(
      ROUTES.bible.readingEventFromSelection,
      {
        translation: currentTranslationCode,
        verses: [verse.id],
        chapters: [],
        passage_ref: passageRef,
        start_at: startAt,
        recurrence: 'none',
        reminder_offsets: [15],
        reminder_channels: ['in_app'],
        source: 'reader',
      },
      { errorMessage: 'Unable to add reading to planner.' },
    );
    const localEvent = buildLocalBibleEvent({
      serverEvent: res?.success ? res.data : undefined,
      translation: currentTranslationCode,
      passageRef,
      verseRefs: [passageRef],
      chapterRefs: [],
      startAt,
      recurrence: 'none',
      reminderOffsets: [15],
      reminderChannels: ['in_app'],
      source: 'reader',
      pending: !res?.success,
    });
    await upsertLocalBibleEvent(localEvent);
    await scheduleBibleReadingEventReminders(localEvent);
    setMessage(
      res?.success
        ? 'Added verse to Reading Planner for tomorrow.'
        : res?.message || 'Reading saved locally and will sync when available.',
    );
    setActionVerse(null);
    setVerseActionMode(null);
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const res = await getRequest(ROUTES.bible.search, {
      params: { q: searchQuery.trim(), translation: currentTranslationCode },
      errorMessage: 'Unable to search verses.',
    });
    setSearchResults(listFromResponse(res?.data?.results ?? res?.data));
    setSearching(false);
  };

  const savePreference = async (updates: Record<string, any>) => {
    setSavingPreference(true);
    await mergeAndWriteLocalBiblePreference(updates, 'local_pending');
    const res = await patchRequest(ROUTES.bible.preferencesCurrent, updates, {
      errorMessage: 'Unable to save reader preference.',
    });
    setSavingPreference(false);
    if (res?.success) {
      await writeLocalBiblePreference({
        ...res.data,
        ...updates,
        sync_status: 'synced',
      });
    } else {
      setMessage(res?.message || 'Preference saved locally on this device.');
    }
  };

  const closeVerseAction = () => {
    setActionVerse(null);
    setVerseActionMode(null);
    setNoteText('');
  };

  const renderFilterSheet = () => (
    <Modal
      visible={filterOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setFilterOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilterOpen(false)}
        />
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: solidSheetBg, borderColor: palette.divider },
          ]}
          {...sheetPanResponder.panHandlers}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>
                Reader filters
              </Text>
              <Text style={{ color: palette.subtext, marginTop: 3 }}>
                Language, version, passage, chapters, search, libraries, and
                reader settings.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setFilterOpen(false)}
              style={[
                styles.iconButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.divider,
                },
              ]}
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            <View style={styles.filterGroup}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Language and Bible version
              </Text>
              {languages.length ? (
                <>
                  <View style={styles.dropdownBlock}>
                    <Text
                      style={[styles.groupLabel, { color: palette.subtext }]}
                    >
                      1. Language
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setLanguageDropdownOpen(open => !open);
                        setTranslationDropdownOpen(false);
                      }}
                      style={[
                        styles.dropdownTrigger,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.divider,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: palette.text, fontWeight: '900' }}
                        >
                          {(activeLanguage || 'Select language').toUpperCase()}
                        </Text>
                        <Text style={{ color: palette.subtext, marginTop: 2 }}>
                          {translationsForLanguage.length} public/licensed
                          translation
                          {translationsForLanguage.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <KISIcon
                        name={
                          languageDropdownOpen
                            ? 'chevron-down'
                            : 'chevron-right'
                        }
                        size={18}
                        color={palette.subtext}
                      />
                    </TouchableOpacity>
                    {languageDropdownOpen ? (
                      <View
                        style={[
                          styles.dropdownMenu,
                          {
                            backgroundColor: solidSheetBg,
                            borderColor: palette.divider,
                          },
                        ]}
                      >
                        {languages.map(group => {
                          const active = group.language === activeLanguage;
                          return (
                            <TouchableOpacity
                              key={group.language}
                              onPress={() =>
                                selectLanguageFromFilter(group.language)
                              }
                              style={[
                                styles.dropdownOption,
                                {
                                  backgroundColor: active
                                    ? palette.primarySoft
                                    : 'transparent',
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: active
                                    ? palette.primaryStrong
                                    : palette.text,
                                  fontWeight: '800',
                                }}
                              >
                                {group.language.toUpperCase()}
                              </Text>
                              <Text style={{ color: palette.subtext }}>
                                {group.items.length} version
                                {group.items.length === 1 ? '' : 's'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.dropdownBlock}>
                    <Text
                      style={[styles.groupLabel, { color: palette.subtext }]}
                    >
                      2. Translation
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setTranslationDropdownOpen(open => !open);
                        setLanguageDropdownOpen(false);
                      }}
                      style={[
                        styles.dropdownTrigger,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.divider,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: palette.text, fontWeight: '900' }}
                        >
                          {currentTranslation?.name ||
                            currentTranslationCode ||
                            'Select translation'}
                        </Text>
                        <Text style={{ color: palette.subtext, marginTop: 2 }}>
                          {currentTranslation?.code ||
                            'Public/licensed versions only'}
                        </Text>
                      </View>
                      <KISIcon
                        name={
                          translationDropdownOpen
                            ? 'chevron-down'
                            : 'chevron-right'
                        }
                        size={18}
                        color={palette.subtext}
                      />
                    </TouchableOpacity>
                    {translationDropdownOpen ? (
                      <View
                        style={[
                          styles.dropdownMenu,
                          {
                            backgroundColor: solidSheetBg,
                            borderColor: palette.divider,
                          },
                        ]}
                      >
                        {translationsForLanguage.map(translation => {
                          const active =
                            translation.code === currentTranslationCode;
                          const downloaded = Boolean(
                            offlineManifest[translation.code],
                          );
                          const job = offlineJobs[translation.code];
                          const downloading =
                            job?.status === 'downloading' ||
                            job?.status === 'queued';
                          const paused = job?.status === 'paused';
                          const progressLabel =
                            job && job.totalChapters
                              ? `${job.completedChapters}/${job.totalChapters} chapters`
                              : job?.currentLabel;
                          return (
                            <View
                              key={translation.id}
                              style={[
                                styles.dropdownOption,
                                {
                                  backgroundColor: active
                                    ? palette.primarySoft
                                    : 'transparent',
                                },
                              ]}
                            >
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() =>
                                  selectTranslationFromFilter(translation)
                                }
                                style={{ flex: 1 }}
                              >
                                <Text
                                  style={{
                                    color: active
                                      ? palette.primaryStrong
                                      : palette.text,
                                    fontWeight: '800',
                                  }}
                                >
                                  {translation.name || translation.code}
                                </Text>
                                <Text style={{ color: palette.subtext }}>
                                  {translation.code}
                                </Text>
                                {downloaded ? (
                                  <Text
                                    style={{
                                      color: palette.primaryStrong,
                                      marginTop: 2,
                                      fontWeight: '700',
                                    }}
                                  >
                                    Offline ready ·{' '}
                                    {offlineManifest[translation.code]
                                      ?.chapterCount || 0}{' '}
                                    chapters
                                  </Text>
                                ) : null}
                                {!downloaded && job ? (
                                  <Text
                                    style={{
                                      color: paused
                                        ? palette.subtext
                                        : palette.primaryStrong,
                                      marginTop: 2,
                                      fontWeight: '700',
                                    }}
                                  >
                                    {job.status} ·{' '}
                                    {progressLabel || 'Preparing'}
                                  </Text>
                                ) : null}
                              </TouchableOpacity>
                              {downloaded ? (
                                <KISButton
                                  title="Saved"
                                  size="xs"
                                  variant="secondary"
                                  disabled
                                />
                              ) : downloading ? (
                                <KISButton
                                  title="Pause"
                                  size="xs"
                                  variant="outline"
                                  onPress={() =>
                                    pauseOfflineDownload(translation)
                                  }
                                />
                              ) : paused ? (
                                <KISButton
                                  title="Resume"
                                  size="xs"
                                  onPress={() =>
                                    resumeOfflineDownload(translation)
                                  }
                                />
                              ) : (
                                <KISButton
                                  title="Download"
                                  size="xs"
                                  variant="outline"
                                  onPress={() =>
                                    downloadTranslationForOffline(translation)
                                  }
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.offlinePanel,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.divider,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: '900' }}>
                        Offline Bible
                      </Text>
                      <Text style={{ color: palette.subtext, marginTop: 2 }}>
                        Downloads are queued, resumable, and pause safely when
                        internet is unavailable. If the app is closed, progress
                        continues from the last saved chapter when the app opens
                        again.
                      </Text>
                      {currentTranslation &&
                      offlineJobs[currentTranslation.code] ? (
                        <Text
                          style={{
                            color: palette.primaryStrong,
                            marginTop: 6,
                            fontWeight: '700',
                          }}
                        >
                          {offlineJobs[currentTranslation.code].currentLabel ||
                            offlineJobs[currentTranslation.code].status}{' '}
                          ·{' '}
                          {
                            offlineJobs[currentTranslation.code]
                              .completedChapters
                          }
                          /
                          {offlineJobs[currentTranslation.code].totalChapters ||
                            '?'}{' '}
                          chapters
                        </Text>
                      ) : null}
                    </View>
                    {currentTranslation ? (
                      offlineManifest[currentTranslation.code] ? (
                        <KISButton
                          title="Saved"
                          size="xs"
                          variant="secondary"
                          disabled
                        />
                      ) : offlineJobs[currentTranslation.code]?.status ===
                          'downloading' ||
                        offlineJobs[currentTranslation.code]?.status ===
                          'queued' ? (
                        <KISButton
                          title="Pause"
                          size="xs"
                          variant="outline"
                          onPress={() =>
                            pauseOfflineDownload(currentTranslation)
                          }
                        />
                      ) : offlineJobs[currentTranslation.code]?.status ===
                        'paused' ? (
                        <KISButton
                          title="Resume"
                          size="xs"
                          onPress={() =>
                            resumeOfflineDownload(currentTranslation)
                          }
                        />
                      ) : (
                        <KISButton
                          title="Download current"
                          size="xs"
                          variant="outline"
                          onPress={() =>
                            downloadTranslationForOffline(currentTranslation)
                          }
                        />
                      )
                    ) : null}
                  </View>
                </>
              ) : (
                <Text style={{ color: palette.subtext }}>
                  No public/licensed translations are available yet.
                </Text>
              )}
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Passage
              </Text>
              <View style={styles.referenceRow}>
                <TextInput
                  value={referenceInput}
                  onChangeText={setReferenceInput}
                  placeholder="John 3:16-18"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    { borderColor: palette.divider, color: palette.text },
                  ]}
                />
                <KISButton title="Go" size="xs" onPress={loadReference} />
              </View>
              <View style={styles.rangeGrid}>
                <TextInput
                  value={chapterInput}
                  onChangeText={value => setChapterInput(numericText(value))}
                  keyboardType="number-pad"
                  placeholder="Chapter"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    styles.compactInput,
                    { borderColor: palette.divider, color: palette.text },
                  ]}
                />
                <TextInput
                  value={startVerse}
                  onChangeText={value => setStartVerse(numericText(value))}
                  keyboardType="number-pad"
                  placeholder="Start verse"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    styles.compactInput,
                    { borderColor: palette.divider, color: palette.text },
                  ]}
                />
                <TextInput
                  value={endVerse}
                  onChangeText={value => setEndVerse(numericText(value))}
                  keyboardType="number-pad"
                  placeholder="End verse"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    styles.compactInput,
                    { borderColor: palette.divider, color: palette.text },
                  ]}
                />
                <KISButton
                  title="Load"
                  size="xs"
                  onPress={() => {
                    callLoad(
                      currentChapter,
                      undefined,
                      undefined,
                      startVerse,
                      endVerse,
                    );
                    setFilterOpen(false);
                  }}
                />
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Books and chapters
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
              >
                {books.map(book => {
                  const isSelected = book.code === currentBookCode;
                  return (
                    <TouchableOpacity
                      key={book.id}
                      onPress={() => {
                        setSelectedBook(book.code);
                        setChapterInput('1');
                        callLoad(1, undefined, book.code);
                        setFilterOpen(false);
                      }}
                      style={[
                        styles.bookChip,
                        {
                          backgroundColor: isSelected
                            ? palette.primarySoft
                            : palette.surface,
                          borderColor: isSelected
                            ? palette.primaryStrong
                            : palette.divider,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isSelected
                            ? palette.primaryStrong
                            : palette.text,
                          fontWeight: '700',
                        }}
                      >
                        {book.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {chapters.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chapterRow}
                >
                  {chapters.map(chapter => {
                    const isActive = Number(chapter.number) === currentChapter;
                    return (
                      <TouchableOpacity
                        key={chapter.id}
                        onPress={() => {
                          setChapterInput(String(chapter.number));
                          callLoad(Number(chapter.number));
                          setFilterOpen(false);
                        }}
                        style={[
                          styles.chapterChip,
                          {
                            backgroundColor: isActive
                              ? palette.primarySoft
                              : palette.surface,
                            borderColor: isActive
                              ? palette.primaryStrong
                              : palette.divider,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isActive
                              ? palette.primaryStrong
                              : palette.text,
                          }}
                        >
                          {chapter.number}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
              <View style={styles.navRow}>
                <KISButton
                  title="Select chapter"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    selectChapter();
                    setFilterOpen(false);
                  }}
                />
                <Text style={{ color: palette.subtext, flex: 1 }}>
                  Selects every verse in the currently loaded chapter.
                </Text>
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Search
              </Text>
              <View style={styles.referenceRow}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search words in public translations"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    { borderColor: palette.divider, color: palette.text },
                  ]}
                />
                <KISButton
                  title={searching ? '...' : 'Search'}
                  size="xs"
                  onPress={runSearch}
                />
              </View>
              {searchResults.slice(0, 6).map(verse => (
                <View
                  key={verse.id}
                  style={[styles.libraryItem, { borderColor: palette.divider }]}
                >
                  <Text
                    style={{ color: palette.primaryStrong, fontWeight: '800' }}
                  >
                    {verse.chapter?.book?.name} {verse.chapter?.number}:
                    {verse.number}
                  </Text>
                  <Text style={{ color: palette.text, marginTop: 4 }}>
                    {verse.text}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Highlighted and commented verses
              </Text>
              <Text style={{ color: palette.subtext }}>
                Review saved highlights, comments, and bookmarks from this
                translation.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
              >
                {[
                  { key: 'all', label: 'All' },
                  { key: 'comments', label: 'Comments' },
                  { key: 'highlights', label: 'Highlights' },
                  { key: 'bookmarks', label: 'Bookmarks' },
                ].map(item => {
                  const active = libraryView === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() =>
                        setLibraryView(item.key as typeof libraryView)
                      }
                      style={[
                        styles.filterChip,
                        {
                          borderColor: palette.divider,
                          backgroundColor: active
                            ? palette.primarySoft
                            : palette.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? palette.primaryStrong : palette.text,
                          fontWeight: '800',
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {libraryView === 'all' || libraryView === 'comments' ? (
                <TextInput
                  value={commentQuery}
                  onChangeText={setCommentQuery}
                  placeholder="Filter comments"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    { borderColor: palette.divider, color: palette.text },
                  ]}
                />
              ) : null}
              <Text style={{ color: palette.subtext }}>
                Filter highlighted verses by color.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
              >
                <TouchableOpacity
                  onPress={() => setFilterColor(null)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: palette.divider,
                      backgroundColor: !filterColor
                        ? palette.primarySoft
                        : palette.surface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: !filterColor
                        ? palette.primaryStrong
                        : palette.text,
                    }}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {highlightColors.map(item => (
                  <TouchableOpacity
                    key={item.color}
                    onPress={() => setFilterColor(item.color)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: palette.divider,
                        backgroundColor:
                          filterColor === item.color
                            ? palette.primarySoft
                            : palette.surface,
                      },
                    ]}
                  >
                    <View
                      style={[styles.smallDot, { backgroundColor: item.color }]}
                    />
                    <Text
                      style={{
                        color:
                          filterColor === item.color
                            ? palette.primaryStrong
                            : palette.text,
                      }}
                    >
                      {item.count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {libraryLoading ? (
                <ActivityIndicator color={palette.primaryStrong} />
              ) : null}
              {!libraryLoading && !displayedLibraryItems.length ? (
                <View
                  style={[styles.libraryItem, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    No saved verses found
                  </Text>
                  <Text style={{ color: palette.subtext }}>
                    Long-press a verse to highlight it, add a comment, bookmark
                    it, or add it to your planner.
                  </Text>
                </View>
              ) : null}
              {displayedLibraryItems.slice(0, 40).map(item => (
                <View
                  key={`${item.id}-${item.color || item.text || 'bookmark'}`}
                  style={[styles.libraryItem, { borderColor: palette.divider }]}
                >
                  <View style={styles.headerRow}>
                    <Text
                      style={{
                        color: palette.primaryStrong,
                        fontWeight: '800',
                        flex: 1,
                      }}
                    >
                      {item.verse_ref ?? 'Saved verse'}
                    </Text>
                    {item.sync_status === 'local_pending' ? (
                      <View
                        style={[
                          styles.localBadge,
                          { backgroundColor: palette.primarySoft },
                        ]}
                      >
                        <Text
                          style={{
                            color: palette.primaryStrong,
                            fontSize: 11,
                            fontWeight: '900',
                          }}
                        >
                          LOCAL
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.color ? (
                    <View
                      style={[
                        styles.libraryColor,
                        { backgroundColor: item.color },
                      ]}
                    />
                  ) : null}
                  {item.text ? (
                    <Text style={{ color: palette.text, marginTop: 4 }}>
                      {item.text}
                    </Text>
                  ) : null}
                  {item.verse_text ? (
                    <Text style={{ color: palette.subtext, marginTop: 4 }}>
                      {item.verse_text}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Reader preferences
              </Text>
              <View style={styles.prefRow}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>
                  Font size
                </Text>
                <View style={styles.navRow}>
                  <KISButton
                    title="-"
                    size="xs"
                    variant="outline"
                    onPress={() => {
                      const next = Math.max(14, fontSize - 1);
                      setFontSize(next);
                      savePreference({ font_size: next });
                    }}
                  />
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: '800',
                      minWidth: 32,
                      textAlign: 'center',
                    }}
                  >
                    {fontSize}
                  </Text>
                  <KISButton
                    title="+"
                    size="xs"
                    variant="outline"
                    onPress={() => {
                      const next = Math.min(24, fontSize + 1);
                      setFontSize(next);
                      savePreference({ font_size: next });
                    }}
                  />
                </View>
              </View>
              {savingPreference ? (
                <Text style={{ color: palette.subtext }}>
                  Saving preference...
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderVerseActionModal = () => (
    <Modal
      visible={Boolean(actionVerse)}
      transparent
      animationType="fade"
      onRequestClose={closeVerseAction}
    >
      <View style={styles.actionOverlay}>
        <Pressable style={styles.actionBackdrop} onPress={closeVerseAction} />
        <View
          style={[
            styles.actionSheet,
            { backgroundColor: solidSheetBg, borderColor: palette.divider },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {actionVerse
              ? `${currentReference.split(':')[0]}:${actionVerse.number}`
              : 'Verse'}
          </Text>
          {actionVerse ? (
            <Text
              style={{ color: palette.subtext, marginTop: 6, lineHeight: 21 }}
            >
              {actionVerse.text}
            </Text>
          ) : null}

          {verseActionMode === 'highlight' ? (
            <View style={{ gap: 12, marginTop: 14 }}>
              <Text style={{ color: palette.text, fontWeight: '800' }}>
                Choose highlight color
              </Text>
              <View style={styles.colorRow}>
                {HIGHLIGHT_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    onPress={() =>
                      actionVerse && addHighlightForVerse(actionVerse, color)
                    }
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color, borderColor: palette.divider },
                    ]}
                  />
                ))}
              </View>
              <KISButton
                title="Back"
                size="sm"
                variant="ghost"
                onPress={() => setVerseActionMode('menu')}
              />
            </View>
          ) : verseActionMode === 'note' ? (
            <View style={{ gap: 12, marginTop: 14 }}>
              <Text style={{ color: palette.text, fontWeight: '800' }}>
                Add comment
              </Text>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Write your comment"
                placeholderTextColor={palette.subtext}
                multiline
                style={[
                  styles.noteInput,
                  { borderColor: palette.divider, color: palette.text },
                ]}
              />
              <View style={styles.navRow}>
                <KISButton
                  title="Submit comment"
                  size="sm"
                  onPress={addNoteForVerse}
                />
                <KISButton
                  title="Back"
                  size="sm"
                  variant="ghost"
                  onPress={() => setVerseActionMode('menu')}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actionList}>
              <KISButton
                title="Highlight"
                size="sm"
                onPress={() => setVerseActionMode('highlight')}
              />
              <KISButton
                title="Add comment"
                size="sm"
                variant="secondary"
                onPress={() => setVerseActionMode('note')}
              />
              <KISButton
                title="Bookmark"
                size="sm"
                variant="outline"
                onPress={() => actionVerse && addBookmarkForVerse(actionVerse)}
              />
              <KISButton
                title="Add to Planner"
                size="sm"
                variant="outline"
                onPress={() => actionVerse && addVerseToPlanner(actionVerse)}
              />
              <KISButton
                title="Close"
                size="sm"
                variant="ghost"
                onPress={closeVerseAction}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderStatus = () => {
    if (loading) {
      return (
        <View
          style={[
            styles.stateBox,
            { borderColor: palette.divider, backgroundColor: palette.surface },
          ]}
        >
          <ActivityIndicator color={palette.primaryStrong} />
          <Text style={{ color: palette.subtext }}>Loading passage...</Text>
        </View>
      );
    }
    if (!verses.length) {
      return (
        <View
          style={[
            styles.stateBox,
            { borderColor: palette.divider, backgroundColor: palette.surface },
          ]}
        >
          <KISIcon name="book" size={22} color={palette.subtext} />
          <Text style={{ color: palette.text, fontWeight: '800' }}>
            No passage loaded
          </Text>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>
            Choose a public translation, book, and chapter, or enter a reference
            like John 3:16-18.
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.readerRoot}>
      <View
        style={[styles.stickyReaderHeaderWrap, { backgroundColor: palette.bg }]}
      >
        <View
          style={[
            styles.readerHeader,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <Text
            style={[styles.translationLabel, { color: palette.subtext }]}
            numberOfLines={1}
          >
            {reader?.translation?.name ??
              translations[0]?.name ??
              'Public Bible'}
          </Text>
          <Text
            style={[styles.chapterTitle, { color: palette.text }]}
            numberOfLines={2}
          >
            {currentReference}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.readerScroll}
        contentContainerStyle={styles.readerScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>Read</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                Public/licensed translations only. Personal tools require login.
              </Text>
            </View>
            <View
              style={[
                styles.kcanBadge,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                KCAN
              </Text>
            </View>
          </View>
        </BibleSectionCard>

        <BibleSectionCard>
          <View
            style={[
              styles.swipeHint,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: reader?.navigation?.previous ? leftArrowOpacity : 0.18,
              }}
            >
              <KISIcon
                name="chevron-left"
                size={24}
                color={palette.primaryStrong}
              />
            </Animated.View>
            <Text
              style={{
                color: palette.subtext,
                flex: 1,
                textAlign: 'center',
                fontWeight: '700',
              }}
            >
              Pull right for previous · Pull left for next
            </Text>
            <Animated.View
              style={{
                opacity: reader?.navigation?.next ? rightArrowOpacity : 0.18,
              }}
            >
              <KISIcon
                name="chevron-right"
                size={24}
                color={palette.primaryStrong}
              />
            </Animated.View>
          </View>
        </BibleSectionCard>

        <BibleSectionCard>
          <Animated.View
            {...navigationPanResponder.panHandlers}
            style={{ transform: [{ translateX: swipeTranslateX }] }}
          >
            {renderStatus()}
            {verses.length ? (
              <View
                style={[
                  styles.biblePage,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                  },
                ]}
              >
                {verses.map(verse => {
                  const id = String(verse.id);
                  const selected = selectedVerses.has(id);
                  const highlightColor = highlightByVerse.get(id);
                  const text = String(verse.text || '');
                  const isChapterStart =
                    Number(verse.number) === 1 && text.length > 0;
                  const firstLetter = isChapterStart ? text.slice(0, 1) : '';
                  const remainingText = isChapterStart ? text.slice(1) : text;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => toggleVerse(id)}
                      onLongPress={() => {
                        setActionVerse(verse);
                        setVerseActionMode('menu');
                      }}
                      activeOpacity={0.75}
                      style={[
                        isChapterStart
                          ? styles.chapterStartVerse
                          : styles.bibleVerseLine,
                        {
                          backgroundColor: selected
                            ? palette.primarySoft
                            : highlightColor || 'transparent',
                          borderColor: selected
                            ? palette.primaryStrong
                            : 'transparent',
                        },
                      ]}
                    >
                      {isChapterStart ? (
                        <>
                          <Text
                            style={[styles.dropCap, { color: palette.text }]}
                          >
                            {firstLetter}
                          </Text>
                          <View style={styles.chapterStartTextWrap}>
                            <Text
                              style={[
                                styles.bibleVerseText,
                                { color: palette.text, fontSize },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.supVerseNumber,
                                  {
                                    color: selected
                                      ? palette.primaryStrong
                                      : palette.subtext,
                                  },
                                ]}
                              >
                                {verse.number}
                              </Text>
                              {remainingText}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <Text
                          style={[
                            styles.bibleVerseText,
                            { color: palette.text, fontSize },
                          ]}
                        >
                          <Text
                            style={[
                              styles.supVerseNumber,
                              {
                                color: selected
                                  ? palette.primaryStrong
                                  : palette.subtext,
                              },
                            ]}
                          >
                            {verse.number}
                          </Text>
                          {text}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </Animated.View>
        </BibleSectionCard>

        {message ? (
          <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>
            {message}
          </Text>
        ) : null}
      </ScrollView>

      {renderFilterSheet()}
      {renderVerseActionModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  readerRoot: { flex: 1, minHeight: 0 },
  readerScroll: { flex: 1 },
  readerScrollContent: { gap: 14, paddingVertical: 16, paddingBottom: 40 },
  stack: { gap: 14 },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  kcanBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  stickyReaderHeaderWrap: { zIndex: 10, paddingBottom: 8 },
  readerHeader: { borderWidth: 2, borderRadius: 12, padding: 12 },
  translationLabel: { fontSize: 12, textTransform: 'uppercase' },
  chapterTitle: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noteInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  bookRow: { gap: 8, paddingVertical: 6, alignItems: 'center' },
  bookChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  rangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  compactInput: { minWidth: 92, flex: 1 },
  chapterRow: { gap: 8, paddingVertical: 6 },
  chapterChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 38,
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  swipeHint: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stateBox: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  biblePage: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 2,
  },
  verseStack: { gap: 8 },
  verseRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
  },
  verseNumber: { width: 28, fontWeight: '900', textAlign: 'right' },
  verseText: { flex: 1, lineHeight: 25 },
  bibleVerseLine: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 2,
    marginBottom: 2,
  },
  chapterStartVerse: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 4,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chapterStartTextWrap: { flex: 1, paddingTop: 5 },
  bibleVerseText: {
    lineHeight: 28,
    fontFamily: 'serif',
  },
  supVerseNumber: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  dropCap: {
    fontFamily: 'serif',
    fontSize: 52,
    lineHeight: 54,
    fontWeight: '900',
    marginRight: 6,
    marginTop: -2,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  filterChip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallDot: { width: 12, height: 12, borderRadius: 6 },
  libraryItem: { borderWidth: 2, borderRadius: 12, padding: 10, gap: 4 },
  libraryColor: { width: 28, height: 8, borderRadius: 999, marginTop: 4 },
  localBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  bottomSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    opacity: 1,
  },
  sheetHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(120,120,120,0.45)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetContent: { gap: 16, paddingBottom: 24 },
  filterGroup: { gap: 10 },
  languageGroup: { gap: 8 },
  groupLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  largeChip: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 148,
  },
  dropdownBlock: { gap: 8 },
  dropdownTrigger: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,120,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offlinePanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  actionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  actionSheet: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  actionList: { gap: 10, marginTop: 14 },
});
