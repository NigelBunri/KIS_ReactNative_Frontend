// src/screens/chat/hooks/useDraftState.ts
import { useCallback, useEffect, useState } from 'react';

export function useDraftState(
  conversationId: string | null,
  chatId: string | number | undefined,
) {
  const makeDraftKey = useCallback(() => {
    if (conversationId) return `conv:${conversationId}`;
    if (chatId) return `chat:${chatId}`;
    return 'local-room';
  }, [conversationId, chatId]);

  const [draftKey, setDraftKey] = useState<string>(makeDraftKey);
  const [draftsByKey, setDraftsByKey] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const nextKey = makeDraftKey();
    setDraftKey(nextKey);
    setDraft((_prev) => {
      const existing = draftsByKey[nextKey];
      return existing ?? '';
    });
  }, [makeDraftKey, draftsByKey]);

  const handleChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      setDraftsByKey((prev) => ({
        ...prev,
        [draftKey]: text,
      }));
    },
    [draftKey],
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
