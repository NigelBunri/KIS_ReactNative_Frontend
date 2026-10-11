// Regression coverage for the "profile tab selected style breaks after the
// first tab switch and never recovers, even on the originally-selected tab"
// defect.
//
// Root cause: getAccentGradients()'s default-theme branch used to return a
// DIRECT REFERENCE into KIS_ROYAL_GRADIENTS.goldLight/goldDark (not a copy).
// KIS_ROYAL_GRADIENTS is declared `as const`, which only makes its arrays
// readonly at the TypeScript type level — it does not Object.freeze() them,
// so at runtime they are ordinary mutable arrays. Every consumer
// (AppNavigator's main tab bar, Sidebar, KISButton, several others) passes
// .tabSelected to LinearGradient's `colors` prop via an `as unknown as
// string[]` cast, which exists specifically because LinearGradient's prop
// type is mutable — that same cast also defeats TypeScript's readonly check
// for whoever holds it. A single in-place mutation by any one consumer
// (.sort()/.reverse()/index-assignment) would have permanently corrupted
// this shared singleton for every other consumer for the rest of the app
// session — matching exactly "works on first render, breaks after one
// interaction, never recovers even for the tab that was fine before".
//
// getAccentGradients() is the single function every consumer goes through
// (directly, or via useKISTheme()'s `gradients`, which calls it fresh on
// every render) — fixing it here closes the vulnerability for all of them
// at once, rather than auditing every call site for whether it personally
// copies before use.

import { getAccentGradients, KIS_ROYAL_GRADIENTS } from '../constants';

describe('getAccentGradients — shared-reference mutation safety', () => {
  it('returns a fresh array instance on every call for the default theme (light)', () => {
    const a = getAccentGradients('light');
    const b = getAccentGradients('light');

    expect(a.tabSelected).not.toBe(b.tabSelected);
    expect(a.tabSelected).toEqual(b.tabSelected);
  });

  it('returns a fresh array instance on every call for the default theme (dark)', () => {
    const a = getAccentGradients('dark');
    const b = getAccentGradients('dark');

    expect(a.tabSelected).not.toBe(b.tabSelected);
    expect(a.tabSelected).toEqual(b.tabSelected);
  });

  it('never returns the KIS_ROYAL_GRADIENTS source arrays by reference', () => {
    const light = getAccentGradients('light');
    const dark = getAccentGradients('dark');

    expect(light.tabSelected).not.toBe(KIS_ROYAL_GRADIENTS.goldLight);
    expect(dark.tabSelected).not.toBe(KIS_ROYAL_GRADIENTS.goldDark);
    expect(light.header).not.toBe(KIS_ROYAL_GRADIENTS.goldHeader);
  });

  it('a consumer mutating its returned array in place cannot corrupt a later caller — the classic bug this closes', () => {
    const first = getAccentGradients('light').tabSelected as unknown as string[];
    const originalFirstStop = KIS_ROYAL_GRADIENTS.goldLight[0];

    // Simulate exactly the kind of careless in-place mutation the `as
    // unknown as string[]` cast at every LinearGradient call site makes
    // possible (e.g. a hypothetical RTL-aware consumer reversing stops).
    first.reverse();
    first[0] = '#000000';

    const second = getAccentGradients('light');

    expect(second.tabSelected[0]).toBe(originalFirstStop);
    expect(second.tabSelected).toEqual([...KIS_ROYAL_GRADIENTS.goldLight]);
    // The module-level singleton itself must also be untouched.
    expect(KIS_ROYAL_GRADIENTS.goldLight[0]).toBe(originalFirstStop);
  });

  it('still returns the correct gold stops for the default theme (content unchanged by the copy)', () => {
    expect(getAccentGradients('light').tabSelected).toEqual([...KIS_ROYAL_GRADIENTS.goldLight]);
    expect(getAccentGradients('dark').tabSelected).toEqual([...KIS_ROYAL_GRADIENTS.goldDark]);
    expect(getAccentGradients('light').header).toEqual([...KIS_ROYAL_GRADIENTS.goldHeader]);
  });

  it('custom accents (already-fresh arrays from `shade()`) are unaffected by this change', () => {
    // Any non-default accentId takes the other branch, which already built
    // fresh arrays via shade() calls — confirms the fix didn't touch that
    // path's behavior.
    const a = getAccentGradients('light', 'some-custom-accent-id');
    const b = getAccentGradients('light', 'some-custom-accent-id');
    expect(a.tabSelected).not.toBe(b.tabSelected);
    expect(Array.isArray(a.tabSelected)).toBe(true);
    expect(a.tabSelected).toHaveLength(4);
  });
});
