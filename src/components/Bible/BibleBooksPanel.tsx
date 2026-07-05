import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

type KCANBook = {
  id: number;
  title: string;
  author: string;
  description: string;
  genre: string;
  cover_image: string | null;
  page_count: number | null;
  language: string;
  pdf_url: string;
};

const GENRES = [
  { key: '', label: 'All' },
  { key: 'theology', label: 'Theology' },
  { key: 'devotional', label: 'Devotional' },
  { key: 'biography', label: 'Biography' },
  { key: 'ministry', label: 'Ministry' },
  { key: 'prophecy', label: 'Prophecy' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'family', label: 'Family' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'missions', label: 'Missions' },
];

function BookCard({ book, onOpen }: { book: KCANBook; onOpen: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const cardWidth = responsive.isWatch || responsive.isCompactPhone ? '100%' : responsive.isTablet ? '31%' : '47%';
  return (
    <Pressable
      onPress={onOpen}
      style={[styles.bookCard, { width: cardWidth, backgroundColor: palette.surface, borderColor: palette.divider }]}
    >
      <View style={[styles.bookCover, { height: responsive.isWatch ? 120 : responsive.isTablet ? 170 : 150, backgroundColor: palette.card }]}>
        {book.cover_image ? (
          <Image source={{ uri: book.cover_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <KISIcon name="book" size={32} color={palette.subtext} />
        )}
      </View>
      <View style={{ padding: 10, flex: 1, gap: 3 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 13 }} numberOfLines={2}>
          {book.title}
        </Text>
        {!!book.author && (
          <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
            {book.author}
          </Text>
        )}
        {book.page_count != null && (
          <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: '700' }}>
            {book.page_count} pages
          </Text>
        )}
        <View
          style={[styles.readBtn, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
        >
          <KISIcon name="book-open" size={12} color={palette.primaryStrong} />
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>Read</Text>
        </View>
      </View>
    </Pressable>
  );
}

function PDFReader({ book, onClose }: { book: KCANBook; onClose: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const source = { uri: book.pdf_url, cache: false };

  return (
    <View style={[styles.readerWrap, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <View style={[styles.readerHeader, { paddingHorizontal: responsive.pageGutter, backgroundColor: palette.surface, borderBottomColor: palette.divider }]}>
        <TouchableOpacity onPress={onClose} style={styles.readerBack}>
          <KISIcon name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 15 }} numberOfLines={1}>
            {book.title}
          </Text>
          {!!book.author && (
            <Text style={{ color: palette.subtext, fontSize: 11 }}>{book.author}</Text>
          )}
        </View>
        {totalPages > 0 && (
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700' }}>
            {page} / {totalPages}
          </Text>
        )}
      </View>
      <Pdf
        source={source}
        style={{ flex: 1, width: '100%' }}
        onLoadComplete={(count) => setTotalPages(count)}
        onPageChanged={(p) => setPage(p)}
        trustAllCerts={false}
        renderActivityIndicator={() => (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={{ color: palette.subtext }}>Loading book…</Text>
          </View>
        )}
      />
    </View>
  );
}

export default function BibleBooksPanel() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [books, setBooks] = useState<KCANBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState('');
  const [query, setQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<KCANBook | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBooks = useCallback(async (genreFilter: string, q: string) => {
    setLoading(true);
    try {
      let url = ROUTES.bible.kcanBooks;
      const params: string[] = [];
      if (genreFilter) params.push(`genre=${encodeURIComponent(genreFilter)}`);
      if (q.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
      if (params.length) url += `?${params.join('&')}`;
      const res = await getRequest(url, {});
      if (res.ok && res.payload?.results) {
        setBooks(res.payload.results);
      } else if (res.ok && Array.isArray(res.payload)) {
        setBooks(res.payload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks(genre, query);
  }, [fetchBooks, genre, query]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBooks(genre, text), 400);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <KISIcon name="search" size={16} color={palette.subtext} />
        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder="Search books or authors..."
          placeholderTextColor={palette.subtext}
          style={[styles.searchInput, { color: palette.text }]}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); fetchBooks(genre, ''); }}>
            <KISIcon name="close-circle" size={16} color={palette.subtext} />
          </Pressable>
        )}
      </View>

      {/* Genre filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreRow}
      >
        {GENRES.map((g) => {
          const active = g.key === genre;
          return (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGenre(g.key)}
              style={[
                styles.genreChip,
                {
                  backgroundColor: active ? palette.primary : palette.surface,
                  borderColor: active ? palette.primary : palette.divider,
                },
              ]}
            >
              <Text style={{ color: active ? '#fff' : palette.text, fontWeight: '800', fontSize: 12 }}>
                {g.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Book grid */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
          <Text style={{ color: palette.subtext, marginTop: 8 }}>Loading books…</Text>
        </View>
      ) : books.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="library" size={40} color={palette.subtext} />
          <Text style={{ color: palette.text, fontWeight: '900', marginTop: 10 }}>No books available</Text>
          <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            KCAN will publish books here for you to read in-app.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.grid, { gap: responsive.cardGap }]}>
          {books.map((book) => (
            <BookCard key={book.id} book={book} onOpen={() => setSelectedBook(book)} />
          ))}
        </ScrollView>
      )}

      {/* PDF Reader Modal */}
      <Modal visible={!!selectedBook} animationType="slide" presentationStyle="fullScreen">
        {selectedBook && (
          <PDFReader book={selectedBook} onClose={() => setSelectedBook(null)} />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  genreRow: {
    gap: 8,
    paddingVertical: 4,
    paddingBottom: 12,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  bookCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bookCover: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  readerWrap: {
    flex: 1,
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  readerBack: {
    padding: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
  },
});
