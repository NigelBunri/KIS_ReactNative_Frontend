// src/screens/chat/hooks/useDraftState.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useDraftState(
  conversationId: string | null,
  chatId: string | number | undefined,
) {
  const computedDraftKey = useMemo(() => {
    if (conversationId) return `conv:${conversationId}`;
    if (chatId) return `chat:${chatId}`;
    return 'local-room';
  }, [conversationId, chatId]);

  const [draftKey, setDraftKey] = useState<string>(computedDraftKey);
  const [draftsByKey, setDraftsByKeyState] = useState<Record<string, string>>({});
  const draftsByKeyRef = useRef<Record<string, string>>({});
  const [draft, setDraft] = useState('');

  const setDraftsByKey = useCallback(
    (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
      setDraftsByKeyState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        draftsByKeyRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    setDraftKey((currentKey) => {
      if (currentKey === computedDraftKey) return currentKey;
      setDraft(draftsByKeyRef.current[computedDraftKey] ?? '');
      return computedDraftKey;
    });
  }, [computedDraftKey]);

  const handleChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      setDraftsByKey((prev) => {
        if (prev[draftKey] === text) return prev;
        return {
          ...prev,
          [draftKey]: text,
        };
      });
    },
    [draftKey, setDraftsByKey],
  );

  return {
    draft,
    setDraft,
    draftKey,
    draftsByKey,
    setDraftsByKey,
    handleChangeDraft,
  };
}
