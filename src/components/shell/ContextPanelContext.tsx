// src/components/shell/ContextPanelContext.tsx
//
// Tablet-shell right-hand "Context Panel" registration, structurally mirrored
// after src/contexts/GoldenSectionContext.tsx (same single-slot / owner-token
// / split setter-vs-payload context shape — see that file for the full
// rationale on why the race-safety and perf-split matter). Screens call
// useContextPanelContent() with JSX built from data they already have in
// scope; nothing here fetches anything itself.
//
// Scoped locally around MainTabs (not injected into App.tsx's global
// provider stack) — only the 5 main tab screens ever register content here,
// and only the tablet/desktop shell ever reads it.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIsFocused } from '@react-navigation/native';

type Owner = string;
let ownerSeq = 0;
const createOwner = (label: string): Owner => `${label}-${++ownerSeq}`;

type ContextPanelSetters = {
  setContextPanel: (owner: Owner, content: React.ReactNode) => void;
  clearContextPanel: (owner: Owner) => void;
};

const ContextPanelSettersContext = createContext<ContextPanelSetters>({
  setContextPanel: () => {},
  clearContextPanel: () => {},
});

type ContextPanelEntry = { owner: Owner; content: React.ReactNode } | null;
const ContextPanelPayloadContext = createContext<ContextPanelEntry>(null);

export function ContextPanelProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ContextPanelEntry>(null);

  const setContextPanel = useCallback((owner: Owner, content: React.ReactNode) => {
    setState({ owner, content });
  }, []);

  const clearContextPanel = useCallback((owner: Owner) => {
    setState((prev) => (prev && prev.owner === owner ? null : prev));
  }, []);

  const setters = useMemo(
    () => ({ setContextPanel, clearContextPanel }),
    [setContextPanel, clearContextPanel],
  );

  return (
    <ContextPanelSettersContext.Provider value={setters}>
      <ContextPanelPayloadContext.Provider value={state}>
        {children}
      </ContextPanelPayloadContext.Provider>
    </ContextPanelSettersContext.Provider>
  );
}

/** Shell-facing: read whatever the currently-focused tab screen has registered. */
export function useContextPanel(): React.ReactNode {
  const entry = useContext(ContextPanelPayloadContext);
  return entry?.content ?? null;
}

/**
 * Screen-facing hook. Registers `content` as the active Context Panel while
 * this screen is focused, clears it on blur/unmount. Pass `null` (e.g. on
 * phone, where the panel never renders) to skip registration cheaply.
 */
export function useContextPanelContent(content: React.ReactNode | null) {
  const { setContextPanel, clearContextPanel } = useContext(ContextPanelSettersContext);
  const isFocused = useIsFocused();
  const ownerRef = useRef<Owner | null>(null);
  if (ownerRef.current === null) ownerRef.current = createOwner('contextPanelOwner');

  useEffect(() => {
    if (!isFocused || !content) return;
    const owner = ownerRef.current!;
    setContextPanel(owner, content);
    return () => clearContextPanel(owner);
  }, [isFocused, content, setContextPanel, clearContextPanel]);
}
