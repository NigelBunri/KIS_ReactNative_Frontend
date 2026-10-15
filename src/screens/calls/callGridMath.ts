// src/screens/calls/callGridMath.ts
//
// Pure layout math for the paginated multi-participant call grid. Kept free
// of React/React Native so it can be unit tested directly (this codebase
// doesn't render components in tests) and shared between VideoGrid's gallery
// branch and VoiceCallGrid.
import type { KISDeviceClass } from '@/theme/responsive';

// Max tiles shown on a single page, keyed by device class + orientation.
// Chosen so a tile never drops below a legible/tappable size: a compact
// phone in portrait has ~320-359dp of width to split across columns, so it
// caps at a 2x2 grid (4) to keep each tile >=140dp; rotating to landscape
// frees up width for a 3x2 grid (6). Tablets get proportionally more.
const MAX_TILES_PER_PAGE: Record<KISDeviceClass, { portrait: number; landscape: number }> = {
  watch: { portrait: 1, landscape: 1 },
  compactPhone: { portrait: 4, landscape: 6 },
  phone: { portrait: 6, landscape: 9 },
  tablet: { portrait: 9, landscape: 12 },
  largeTablet: { portrait: 12, landscape: 16 },
};

export function getMaxTilesPerPage(deviceClass: KISDeviceClass, isLandscape: boolean): number {
  const entry = MAX_TILES_PER_PAGE[deviceClass];
  return isLandscape ? entry.landscape : entry.portrait;
}

// Column count for a given tile count within one page, biased by the
// container's aspect ratio so a wide container doesn't end up with
// needlessly narrow, tall tiles.
export function computeGridColumns(tileCount: number, containerW: number, containerH: number): number {
  if (tileCount <= 1) return 1;
  let base = tileCount <= 4 ? 2 : tileCount <= 9 ? 3 : 4;
  const aspect = containerH > 0 ? containerW / containerH : 1;
  if (aspect > 1.3) base += 1;
  return Math.max(1, Math.min(base, tileCount));
}

// Splits a flat participant list into fixed-size pages. The last page may
// have fewer items than pageSize when the count doesn't divide evenly.
export function paginateParticipants<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) return items.length ? [items] : [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

// Clamps a current page index into [0, pageCount - 1] (or 0 if there are no
// pages at all) — used when a participant leaves and the page the viewer
// was on no longer exists.
export function clampPageIndex(page: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.max(0, Math.min(page, pageCount - 1));
}

export type TileCell = {
  width: number;
  height: number;
};

// Computes a uniform tile size that fits `cols` x `rows` tiles (with `gap`
// spacing between them) inside the given container.
export function computeTileCell(
  containerW: number,
  containerH: number,
  cols: number,
  rows: number,
  gap: number,
): TileCell {
  const width = cols > 0 ? Math.floor((containerW - gap * (cols - 1)) / cols) : containerW;
  const height = rows > 0 ? Math.floor((containerH - gap * (rows - 1)) / rows) : containerH;
  return { width: Math.max(0, width), height: Math.max(0, height) };
}
