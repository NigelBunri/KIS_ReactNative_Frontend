// src/components/Bible/games/journey/journeyGeometry.ts
//
// One parametric path-layout engine shared by all 30 games' journey maps,
// rather than 30 hand-rolled coordinate lists. Each game supplies a small
// config (pattern kind + amplitude + frequency/turns + direction) in
// journeyThemes.ts; this module turns that into 10 node positions plus a
// smooth SVG path string connecting them. Variety comes from combining
// pattern kind with amplitude/frequency/direction (a winding road, a
// mountain switchback, a river meander, and a scattered constellation are
// all the same engine with different numbers), not from duplicating layout
// code per game — the visual identity a game needs (see journeyThemes.ts)
// comes from pairing this with its own accent palette, icon, and title,
// same "shared engine + per-game config" split GameShell already
// established for the play screens themselves.
//
// Coordinate space: a 0-100-wide viewBox, node 0 (Stage 1) at the bottom,
// node 9 (Stage 10) at the top — "climbing" reads naturally for every one
// of the journey metaphors the product spec asked for (road, mountain,
// river, scroll, ladder, constellation, etc.), so the geometry stays literal
// even though the label on screen is game-specific.

import { STAGES_PER_GAME } from '../../../../screens/tabs/bible/games/versePartition';

export type JourneyPoint = { x: number; y: number };

export type JourneyPatternKind = 'zigzag' | 'wave' | 'steps' | 'spiral' | 'scatter' | 'arc';

export type JourneyPathConfig = {
  kind: JourneyPatternKind;
  /** Horizontal swing, in viewBox x-units (viewBox is 0-100 wide, center 50). */
  amplitude: number;
  /** Wave/spiral cycle count over the full journey. Ignored by other kinds. */
  frequency?: number;
  /** Mirrors the pattern left/right - lets two games share a `kind` while
   * still reading as visually distinct routes. */
  direction?: 1 | -1;
};

export const JOURNEY_VIEWBOX_WIDTH = 100;
const TOP_MARGIN = 10;
const ROW_HEIGHT = 24;
export const JOURNEY_VIEWBOX_HEIGHT = TOP_MARGIN * 2 + ROW_HEIGHT * (STAGES_PER_GAME - 1);

/** Deterministic pseudo-jitter for the 'scatter' pattern - no Math.random()
 * so a journey map's layout doesn't visibly reshuffle itself on every
 * re-render/remount, only a hash of the node's own index. */
function jitterFor(index: number): number {
  const h = Math.sin(index * 12.9898) * 43758.5453;
  return h - Math.floor(h); // 0..1
}

export function buildJourneyPoints(config: JourneyPathConfig, count: number = STAGES_PER_GAME): JourneyPoint[] {
  const centerX = JOURNEY_VIEWBOX_WIDTH / 2;
  const dir = config.direction ?? 1;
  const amp = config.amplitude;
  const freq = config.frequency ?? 2;

  const points: JourneyPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const y = JOURNEY_VIEWBOX_HEIGHT - TOP_MARGIN - t * ROW_HEIGHT * (count - 1);

    let x = centerX;
    switch (config.kind) {
      case 'zigzag':
        x = centerX + dir * amp * (i % 2 === 0 ? -1 : 1);
        break;
      case 'wave':
        x = centerX + dir * amp * Math.sin(t * Math.PI * freq);
        break;
      case 'steps': {
        const groupIndex = Math.floor(i / 2);
        x = centerX + dir * amp * (groupIndex % 2 === 0 ? -1 : 1);
        break;
      }
      case 'spiral': {
        const turns = config.frequency ?? 1.5;
        x = centerX + dir * amp * Math.cos(t * Math.PI * 2 * turns);
        break;
      }
      case 'scatter': {
        const jitter = (jitterFor(i) - 0.5) * 2; // -1..1
        x = centerX + dir * amp * Math.sin(t * Math.PI * 2.4) * 0.6 + jitter * amp * 0.5;
        break;
      }
      case 'arc':
        x = centerX + dir * amp * Math.sin(t * Math.PI);
        break;
    }
    points.push({ x, y });
  }
  return points;
}

/** A smooth cubic-bezier path string through the given points (Catmull-Rom
 * style tangents) - used for the decorative connecting line under the node
 * markers. A plain polyline between 10 sharply zigzagging points reads as
 * jagged/cheap; a curved line reads as an actual path/road/river. */
export function buildSmoothPathD(points: JourneyPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
