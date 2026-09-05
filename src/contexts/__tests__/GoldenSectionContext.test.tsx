import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  GoldenSectionProvider,
  useGoldenSection,
  useGoldenSectionContent,
  useGoldenSectionSuppression,
} from '../GoldenSectionContext';

// GoldenSectionContext only consumes @react-navigation/native's
// useIsFocused. Mocking the whole module (rather than pulling in a real
// NavigationContainer/navigator, which drags in react-native-screens and
// friends) lets each simulated "screen" below control its own focus state
// independently via a test-local context, exactly the degree of freedom
// needed to reproduce out-of-order focus/blur delivery deterministically.
// Named with a `mock` prefix so babel-plugin-jest-hoist permits referencing
// it from inside the (hoisted) jest.mock factory below — see
// https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter
const mockFocusContext = React.createContext(false);
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => require('react').useContext(mockFocusContext),
}));

/** A simulated main-tab screen: registers `label` as its Golden Section
 *  content while `focused` is true, clears it otherwise — exactly the
 *  real useGoldenSectionContent contract, driven by a test-local focus
 *  value instead of a real navigator. */
function FocusScopedScreen({ focused, label }: { focused: boolean; label: string }) {
  return (
    <mockFocusContext.Provider value={focused}>
      <RegisteringLeaf label={label} />
    </mockFocusContext.Provider>
  );
}
function RegisteringLeaf({ label }: { label: string }) {
  useGoldenSectionContent({ content: label });
  return null;
}

function SuppressingScreen({ active }: { active: boolean }) {
  useGoldenSectionSuppression(active);
  return null;
}

function Reader({ onRead }: { onRead: (v: ReturnType<typeof useGoldenSection>) => void }) {
  onRead(useGoldenSection());
  return null;
}

describe('GoldenSectionContext', () => {
  it('registers a focused screen\'s content and clears it on blur', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    let latest: ReturnType<typeof useGoldenSection> | null = null;

    const Tree = ({ focused }: { focused: boolean }) => (
      <GoldenSectionProvider>
        <FocusScopedScreen focused={focused} label="A" />
        <Reader onRead={(v) => { latest = v; }} />
      </GoldenSectionProvider>
    );

    act(() => {
      renderer = ReactTestRenderer.create(<Tree focused />);
    });
    expect(latest!.payload?.content).toBe('A');
    expect(latest!.status).toBe('active');
    expect(latest!.ownerKey).not.toBeNull();

    act(() => { renderer.update(<Tree focused={false} />); });
    expect(latest!.payload).toBeNull();
    expect(latest!.status).toBe('inactive');
    expect(latest!.ownerKey).toBeNull();
  });

  it('owner-token protects a newer registration from a late/out-of-order outgoing cleanup', () => {
    // Models exactly the race the owner-token exists for (see
    // GoldenSectionContext.tsx's Owner type comment): screen B registers
    // itself as the active owner, and only *afterwards* does screen A's
    // stale blur cleanup fire. Without the owner check, A's cleanup would
    // wipe out B's just-registered content (a null flash / stuck-blank
    // Golden Section). Both act() calls below are deliberately ordered by
    // hand to force exactly this sequence, independent of React's own
    // effect-scheduling order.
    let renderer: ReactTestRenderer.ReactTestRenderer;
    let latest: ReturnType<typeof useGoldenSection> | null = null;

    const Tree = ({ aFocused, bFocused }: { aFocused: boolean; bFocused: boolean }) => (
      <GoldenSectionProvider>
        <FocusScopedScreen focused={aFocused} label="A" />
        <FocusScopedScreen focused={bFocused} label="B" />
        <Reader onRead={(v) => { latest = v; }} />
      </GoldenSectionProvider>
    );

    act(() => {
      renderer = ReactTestRenderer.create(<Tree aFocused={true} bFocused={false} />);
    });
    expect(latest!.payload?.content).toBe('A');

    // Step 1: B becomes focused (and registers) *before* A blurs.
    act(() => {
      renderer.update(<Tree aFocused={true} bFocused={true} />);
    });
    expect(latest!.payload?.content).toBe('B');

    // Step 2: A's blur cleanup fires late — must NOT clear B's content.
    act(() => {
      renderer.update(<Tree aFocused={false} bFocused={true} />);
    });
    expect(latest!.payload?.content).toBe('B');
    expect(latest!.status).toBe('active');

    // Step 3: B also blurs — slot genuinely empties now.
    act(() => {
      renderer.update(<Tree aFocused={false} bFocused={false} />);
    });
    expect(latest!.payload).toBeNull();
    expect(latest!.status).toBe('inactive');
  });

  it('suppression is ref-counted — one suppressor clearing does not un-suppress while another is still active', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    let latest: ReturnType<typeof useGoldenSection> | null = null;

    const Tree = ({ s1, s2 }: { s1: boolean; s2: boolean }) => (
      <GoldenSectionProvider>
        <FocusScopedScreen focused label="A" />
        <SuppressingScreen active={s1} />
        <SuppressingScreen active={s2} />
        <Reader onRead={(v) => { latest = v; }} />
      </GoldenSectionProvider>
    );

    act(() => {
      renderer = ReactTestRenderer.create(<Tree s1={false} s2={false} />);
    });
    expect(latest!.payload?.content).toBe('A');
    expect(latest!.status).toBe('active');

    act(() => { renderer.update(<Tree s1={true} s2={false} />); });
    expect(latest!.payload).toBeNull();
    expect(latest!.status).toBe('suppressed');

    act(() => { renderer.update(<Tree s1={true} s2={true} />); });
    expect(latest!.payload).toBeNull();
    expect(latest!.status).toBe('suppressed');

    // First suppressor clears — second is still active, must stay suppressed.
    act(() => { renderer.update(<Tree s1={false} s2={true} />); });
    expect(latest!.payload).toBeNull();
    expect(latest!.status).toBe('suppressed');

    // Second clears too — now genuinely unsuppressed, registered content reappears.
    act(() => { renderer.update(<Tree s1={false} s2={false} />); });
    expect(latest!.payload?.content).toBe('A');
    expect(latest!.status).toBe('active');
  });

  it('suppression clears on unmount, not just on active=false — no leak from a component removed outright', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    let latest: ReturnType<typeof useGoldenSection> | null = null;

    const Tree = ({ showSuppressor }: { showSuppressor: boolean }) => (
      <GoldenSectionProvider>
        <FocusScopedScreen focused label="A" />
        {showSuppressor ? <SuppressingScreen active /> : null}
        <Reader onRead={(v) => { latest = v; }} />
      </GoldenSectionProvider>
    );

    act(() => {
      renderer = ReactTestRenderer.create(<Tree showSuppressor />);
    });
    expect(latest!.status).toBe('suppressed');

    act(() => { renderer.update(<Tree showSuppressor={false} />); });
    expect(latest!.status).toBe('active');
    expect(latest!.payload?.content).toBe('A');
  });
});
