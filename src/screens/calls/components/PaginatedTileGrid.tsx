// src/screens/calls/components/PaginatedTileGrid.tsx
//
// Reusable paginated grid for multi-participant call tiles. Replaces the
// old "infinite vertical FlatList" fallback for large groups with real
// horizontal, swipeable pages sized to the device so tiles stay legible,
// plus a page-dot indicator. Shared by VideoGrid's gallery branch and
// VoiceCallGrid.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useResponsiveLayout } from '@/theme/responsive';
import {
  getMaxTilesPerPage,
  computeGridColumns,
  computeTileCell,
  paginateParticipants,
  clampPageIndex,
} from '../callGridMath';
import { useKISTheme } from '@/theme/useTheme';

const GAP = 4;

type Props<T> = {
  items: T[];
  containerW: number;
  containerH: number;
  keyExtractor: (item: T) => string;
  renderTile: (item: T, cellW: number, cellH: number) => React.ReactNode;
};

export default function PaginatedTileGrid<T>({
  items,
  containerW,
  containerH,
  keyExtractor,
  renderTile,
}: Props<T>) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const maxPerPage = getMaxTilesPerPage(responsive.deviceClass, responsive.isLandscape);
  const pages = paginateParticipants(items, maxPerPage);
  const pageCount = pages.length;

  // Keep the viewer on a valid page when participants leave and the page
  // they were viewing no longer exists (e.g. the last page shrinks away).
  useEffect(() => {
    const clamped = clampPageIndex(page, pageCount);
    if (clamped !== page) {
      setPage(clamped);
      scrollRef.current?.scrollTo({ x: clamped * containerW, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount, containerW]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (containerW <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / containerW);
      setPage(clampPageIndex(next, pageCount));
    },
    [containerW, pageCount],
  );

  if (containerW <= 0 || containerH <= 0 || pageCount === 0) return null;

  return (
    <View style={{ width: containerW, height: containerH }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEnabled={pageCount > 1}
      >
        {pages.map((pageItems, pageIndex) => {
          const cols = computeGridColumns(pageItems.length, containerW, containerH);
          const rows = Math.ceil(pageItems.length / cols);
          const { width: cellW, height: cellH } = computeTileCell(containerW, containerH, cols, rows, GAP);
          const rowChunks: T[][] = [];
          for (let i = 0; i < pageItems.length; i += cols) rowChunks.push(pageItems.slice(i, i + cols));

          return (
            <View key={pageIndex} style={{ width: containerW, height: containerH, justifyContent: 'center' }}>
              {rowChunks.map((row, rowIndex) => (
                <View
                  key={rowIndex}
                  style={{ flexDirection: 'row', justifyContent: 'center', gap: GAP, marginBottom: rowIndex < rowChunks.length - 1 ? GAP : 0 }}
                >
                  {row.map(item => (
                    <View key={keyExtractor(item)}>{renderTile(item, cellW, cellH)}</View>
                  ))}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {pageCount > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? palette.ivory : palette.overlay },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
