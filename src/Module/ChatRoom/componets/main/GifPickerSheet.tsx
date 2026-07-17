import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';

// Tenor GIF API — set TENOR_API_KEY in your .env file.
// In development, if no key is configured, GIF search will return an empty result.
const TENOR_API_KEY: string = (process.env as any).TENOR_API_KEY ?? (__DEV__ ? 'LIVDSRZULELA' : '');
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

export type TenorGif = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

export async function searchTenor(query: string, limit = 24): Promise<TenorGif[]> {
  if (!TENOR_API_KEY) return [];
  const endpoint = query.trim()
    ? `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=${limit}&media_filter=gif`
    : `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=${limit}&media_filter=gif`;

  const res = await fetch(endpoint);
  const json = await res.json();
  const results = json?.results ?? [];
  return results.map((item: any) => {
    const gif = item?.media_formats?.gif ?? item?.media?.[0]?.gif ?? {};
    const nano = item?.media_formats?.nanogif ?? item?.media_formats?.tinygif ?? gif;
    return {
      id: item.id,
      title: item.title ?? '',
      url: gif.url ?? '',
      previewUrl: nano.url ?? gif.url ?? '',
      width: gif.dims?.[0] ?? 200,
      height: gif.dims?.[1] ?? 200,
    };
  }).filter((g: TenorGif) => !!g.url);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectGif: (gif: { url: string; previewUrl: string; width: number; height: number }) => void;
  palette: any;
};

export const GifPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  onSelectGif,
  palette,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (visible && gifs.length === 0) {
      fetchGifs('');
    }
  }, [visible]);

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const results = await searchTenor(q);
      setGifs(results);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchGifs(text), 400);
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.bg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.divider }]} />

        {/* Search bar */}
        <View style={[styles.searchRow, { backgroundColor: palette.inputBg ?? palette.card }]}>
          <KISIcon name="search" size={18} color={palette.subtext} />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search GIFs…"
            placeholderTextColor={palette.subtext}
            style={[styles.searchInput, { color: palette.text }]}
            returnKeyType="search"
            onSubmitEditing={() => fetchGifs(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); fetchGifs(''); }} hitSlop={8}>
              <KISIcon name="close" size={16} color={palette.subtext} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={(g) => g.id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const aspectRatio = item.width > 0 && item.height > 0
                ? item.width / item.height
                : 1;
              return (
                <Pressable
                  style={[styles.gifCell, { aspectRatio }]}
                  onPress={() => {
                    onSelectGif({
                      url: item.url,
                      previewUrl: item.previewUrl,
                      width: item.width,
                      height: item.height,
                    });
                    onClose();
                  }}
                >
                  <Image
                    source={{ uri: item.previewUrl }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ color: palette.subtext, fontSize: 14 }}>No GIFs found</Text>
              </View>
            }
          />
        )}

        <Text style={[styles.attribution, { color: palette.subtext, paddingBottom: Math.max(insets.bottom, 12) }]}>
          Powered by Tenor
        </Text>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  grid: { paddingHorizontal: 8, gap: 4 },
  gifCell: {
    flex: 1,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#222',
    minHeight: 80,
  },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 40 },
  attribution: {
    textAlign: 'center',
    fontSize: 11,
    paddingBottom: 12,
  },
});
