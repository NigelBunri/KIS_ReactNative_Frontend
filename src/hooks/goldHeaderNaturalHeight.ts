// src/hooks/goldHeaderNaturalHeight.ts
//
// Single source of truth for one policy decision, shared by every Golden
// Section collapsing card: useCollapsingGoldHeader.ts (Messages/Broadcast/
// Partners) and ProfileDashboardBlocks.tsx's ProfileHeroCard (Profile — kept
// its own bespoke collapseStyle/stickyBarStyle, see that file's doc comment,
// but shares this exact measurement problem and now this exact fix).
//
// Deliberately has zero react-native / reanimated imports — a plain function
// over plain numbers — so it can be unit-tested directly. (react-native-
// reanimated can't currently be imported at all under this repo's Jest setup
// — see __tests__/App.test.tsx's comment — which is exactly why this logic
// was pulled out of the two reanimated-touching files that use it, instead
// of being tested in place.)
//
// ── The problem ─────────────────────────────────────────────────────────
// Each collapsing card measures its own un-clipped content height via
// onLayout, then uses that as the "fully expanded" ceiling a maxHeight
// animation collapses from. But that same onLayout is attached to the exact
// view whose *parent* has the animated maxHeight applied — so onLayout can
// fire again once maxHeight has started constraining it, reporting a
// clipped height instead of the content's real size. Trusting every
// measurement unconditionally made the recorded ceiling ratchet down to
// whatever it last happened to be clipped to, so scrolling back up could
// never fully re-open the header again (a real, previously-shipped bug —
// the original fix was "only ever grow, never shrink"). That in turn
// created the opposite bug: content that genuinely gets *shorter* (a
// headline that wraps to fewer lines, a badge row that disappears) could
// never shrink the reserved space back down, leaving a permanent gap.
//
// ── The fix ──────────────────────────────────────────────────────────────
// A measurement is only trusted unconditionally when the collapse driver
// (the eased scroll position feeding the maxHeight interpolation) is at
// rest, i.e. at 0 — the one state in which maxHeight equals the full
// natural height and therefore cannot be constraining anything, so the
// measurement is guaranteed unclipped. Away from rest, fall back to the
// old grow-only rule: a *larger* reported size can't be an artifact of
// clipping (clipping only ever makes the reported size smaller than
// reality, never larger), so it's always safe to adopt, while a smaller
// one is exactly the ambiguous case the original bug came from and is
// rejected.
//
// Trade-off, not an oversight: content that shrinks while the header is
// scrolled away from the top won't be picked up until the user scrolls
// back to rest. Given these headers sit at rest the overwhelming majority
// of the time (idle screens, fresh tab focus), this is a safe place to
// draw the line without reintroducing the clipped-remeasurement bug.
export function resolveNaturalHeight(params: {
  /** Latest onLayout-measured height of the collapsing card's content. */
  measured: number;
  /** Currently recorded natural (fully-expanded) height. */
  current: number;
  /** The eased collapse-driver value feeding the maxHeight interpolation
   *  (0 == fully expanded / at rest == guaranteed-unclipped). */
  collapseDriverValue: number;
  /** How close to 0 counts as "at rest". Reanimated's own eased mirrors in
   *  this codebase settle via a >6 retarget threshold, so 1 comfortably
   *  distinguishes "actually at rest" from "still easing back to rest". */
  restEpsilon?: number;
}): number {
  const { measured, current, collapseDriverValue, restEpsilon = 1 } = params;
  if (!Number.isFinite(measured) || measured <= 0) return current;

  const atRest = Math.abs(collapseDriverValue) <= restEpsilon;
  if (atRest) return measured;

  return measured > current ? measured : current;
}
