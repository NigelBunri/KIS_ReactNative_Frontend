import { getShellMode, getShellContentWidth, createResponsiveLayout } from '../responsive';

// Regression coverage for the "one source of truth for phone vs tablet
// chrome" contract: TabletShell (via ResponsiveContainer) picks Mobile-
// /Tablet-/DesktopLayout off shellMode, and AnimatedKISTabBar independently
// derives hidNav's `shellMode !== 'phone'` term off the same field. Both
// ultimately call getShellMode(width) — literally the same pure function —
// so they cannot disagree for a given width. These tests pin the breakpoints
// themselves (768 / 1024) so a future edit can't silently move one without
// the other, which is the only way that guarantee could ever break.
describe('getShellMode', () => {
  it('is phone below the tablet breakpoint', () => {
    expect(getShellMode(767)).toBe('phone');
    expect(getShellMode(320)).toBe('phone');
  });

  it('is tablet from 768 up to (not including) the desktop breakpoint', () => {
    expect(getShellMode(768)).toBe('tablet');
    expect(getShellMode(1023)).toBe('tablet');
  });

  it('is desktop from 1024 up', () => {
    expect(getShellMode(1024)).toBe('desktop');
    expect(getShellMode(2000)).toBe('desktop');
  });

  it('never reports two modes for the same width', () => {
    // Any width maps to exactly one of the three modes — sanity check that
    // the boundary conditions above don't overlap.
    for (const width of [0, 320, 767, 768, 1000, 1023, 1024, 1440]) {
      const modes = ['phone', 'tablet', 'desktop'].filter(
        (m) => getShellMode(width) === m,
      );
      expect(modes).toHaveLength(1);
    }
  });
});

describe('createResponsiveLayout — shellMode-derived fields agree with getShellMode', () => {
  it.each([320, 767, 768, 1000, 1023, 1024, 1440])('width=%d', (width) => {
    const layout = createResponsiveLayout(width, 800);
    const expected = getShellMode(width);
    expect(layout.shellMode).toBe(expected);
    expect(layout.isPhoneLayout).toBe(expected === 'phone');
    expect(layout.isTabletLayout).toBe(expected === 'tablet');
    expect(layout.isDesktopLayout).toBe(expected === 'desktop');
  });
});

describe('getShellContentWidth', () => {
  it('equals full width in phone mode', () => {
    expect(getShellContentWidth(400)).toBe(400);
  });

  it('subtracts sidebar (+ context panel when there is room) in tablet/desktop mode', () => {
    // Below MIN_CONTENT_WIDTH once both chrome widths are subtracted —
    // context panel yields back to content.
    expect(getShellContentWidth(768)).toBe(768 - 300);
    // Comfortably wide — both sidebar and context panel are reserved.
    expect(getShellContentWidth(1440)).toBe(1440 - 300 - 340);
  });
});
