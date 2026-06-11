// src/screens/chat/hooks/useDraftState.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_PREFIX = 'KIS_DRAFT_';
const DEBOUNCE_MS = 500;

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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // On mount / draftKey change: load persisted draft from AsyncStorage
  useEffect(() => {
    const storageKey = `${DRAFT_PREFIX}${computedDraftKey}`;
    AsyncStorage.getItem(storageKey).then((persisted) => {
      if (persisted && persisted.length > 0) {
        setDraft((current) => (current.length > 0 ? current : persisted));
        setDraftsByKey((prev) => {
          if (prev[computedDraftKey] !== undefined) return prev;
          return { ...prev, [computedDraftKey]: persisted };
        });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedDraftKey]);

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

      // Debounced AsyncStorage persist
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const storageKey = `${DRAFT_PREFIX}${draftKey}`;
        if (text.length > 0) {
          AsyncStorage.setItem(storageKey, text).catch(() => {});
        } else {
          AsyncStorage.removeItem(storageKey).catch(() => {});
        }
      }, DEBOUNCE_MS);
    },
    [draftKey, setDraftsByKey],
  );

  // Override setDraft so clearing the draft (on send) also removes AsyncStorage key
  const setDraftAndClear = useCallback(
    (text: string) => {
      setDraft(text);
      if (text.length === 0) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        const storageKey = `${DRAFT_PREFIX}${draftKey}`;
        AsyncStorage.removeItem(storageKey).catch(() => {});
        setDraftsByKey((prev) => {
          const next = { ...prev };
          delete next[draftKey];
          return next;
        });
      }
    },
    [draftKey, setDraftsByKey],
  );

  return {
    draft,
    setDraft: setDraftAndClear,
    draftKey,
    draftsByKey,
    setDraftsByKey,
    handleChangeDraft,
  };
}
