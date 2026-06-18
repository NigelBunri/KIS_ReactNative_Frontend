// src/screens/broadcast/channels/components/ProductTagsDisplay.tsx
//
// Floating product tag overlay during video playback.
// Appears when currentTimeSeconds matches a tag's timestamp (±3 seconds).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductTag = {
  id: string;
  timestamp_seconds: number;
  product_title: string;
  product_url: string;
  thumbnail_url?: string;
  price_display?: string;
};

type Props = {
  contentId: string;
  currentTimeSeconds: number;
  onPressProduct: (productUrl: string) => void;
};

const TIME_TOLERANCE = 3; // ±3 seconds
const AUTO_HIDE_MS = 5000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductTagsDisplay({
  contentId,
  currentTimeSeconds,
  onPressProduct,
}: Props) {
  const { palette } = useKISTheme();
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [activeTag, setActiveTag] = useState<ProductTag | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch product tags once
  useEffect(() => {
    if (!contentId) return;
    getRequest(ROUTES.broadcasts.contentProducts(contentId), { errorMessage: '' })
      .then(res => {
        const raw: ProductTag[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : res?.results ?? [];
        setTags(raw);
      })
      .catch(() => {});
  }, [contentId]);

  const showTag = useCallback(
    (tag: ProductTag) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setActiveTag(tag);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(
          () => setActiveTag(null),
        );
      }, AUTO_HIDE_MS);
    },
    [opacity],
  );

  // Match current time to a tag
  useEffect(() => {
    const matched = tags.find(
      tag => Math.abs(tag.timestamp_seconds - currentTimeSeconds) <= TIME_TOLERANCE,
    );
    if (matched && matched.id !== activeTag?.id) {
      showTag(matched);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTimeSeconds, tags]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!activeTag) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Pressable
        onPress={() => onPressProduct(activeTag.product_url)}
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow ?? palette.royalInk },
        ]}
      >
        {activeTag.thumbnail_url ? (
          <Image source={{ uri: activeTag.thumbnail_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: palette.border }]} />
        )}
        <View style={styles.info}>
          <Text numberOfLines={2} style={[styles.title, { color: palette.text }]}>
            {activeTag.product_title}
          </Text>
          {activeTag.price_display ? (
            <Text style={[styles.price, { color: palette.primaryStrong }]}>
              {activeTag.price_display}
            </Text>
          ) : null}
          <Text style={[styles.cta, { color: palette.primaryStrong }]}>View Product →</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 72,
    left: 12,
    zIndex: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    maxWidth: 260,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  thumb: { width: 52, height: 52, borderRadius: 6 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontWeight: '800', lineHeight: 15 },
  price: { fontSize: 13, fontWeight: '900' },
  cta: { fontSize: 11, fontWeight: '700' },
});
