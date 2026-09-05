import { resolveNaturalHeight } from '../goldHeaderNaturalHeight';

describe('resolveNaturalHeight', () => {
  it('trusts a measurement fully at rest, including a shrink', () => {
    // Regression: content that genuinely gets shorter (fewer lines of
    // headline text, a badge row disappearing) must be able to shrink the
    // reserved space back down once the header is at rest — the previous
    // grow-only rule could never do this, leaving a permanent gap.
    expect(
      resolveNaturalHeight({ measured: 120, current: 200, collapseDriverValue: 0 }),
    ).toBe(120);
  });

  it('trusts a measurement fully at rest, including a grow', () => {
    expect(
      resolveNaturalHeight({ measured: 260, current: 200, collapseDriverValue: 0 }),
    ).toBe(260);
  });

  it('treats a value within restEpsilon of 0 as at rest', () => {
    expect(
      resolveNaturalHeight({ measured: 120, current: 200, collapseDriverValue: 0.4 }),
    ).toBe(120);
  });

  it('rejects a shrink while away from rest (mid-collapse) — the clipped-remeasurement guard', () => {
    // This is the exact scenario that motivated the original grow-only fix:
    // a maxHeight-constrained remeasurement reporting a smaller size that's
    // an artifact of clipping, not real content shrinkage.
    expect(
      resolveNaturalHeight({ measured: 40, current: 200, collapseDriverValue: 80 }),
    ).toBe(200);
  });

  it('still accepts a grow while away from rest — cannot be a clipping artifact', () => {
    expect(
      resolveNaturalHeight({ measured: 260, current: 200, collapseDriverValue: 80 }),
    ).toBe(260);
  });

  it('ignores a non-finite or non-positive measurement', () => {
    expect(
      resolveNaturalHeight({ measured: 0, current: 200, collapseDriverValue: 0 }),
    ).toBe(200);
    expect(
      resolveNaturalHeight({ measured: NaN, current: 200, collapseDriverValue: 0 }),
    ).toBe(200);
    expect(
      resolveNaturalHeight({ measured: -10, current: 200, collapseDriverValue: 80 }),
    ).toBe(200);
  });

  it('honors a custom restEpsilon', () => {
    expect(
      resolveNaturalHeight({
        measured: 120,
        current: 200,
        collapseDriverValue: 3,
        restEpsilon: 5,
      }),
    ).toBe(120);
    expect(
      resolveNaturalHeight({
        measured: 120,
        current: 200,
        collapseDriverValue: 3,
        restEpsilon: 1,
      }),
    ).toBe(200); // 3 is outside restEpsilon:1, shrink rejected
  });
});
