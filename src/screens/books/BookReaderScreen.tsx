import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { putData } from '@/network/put';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useSocket } from '../../../SocketProvider';
import ShareToChatModal from '@/components/broadcast/ShareToChatModal';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../../App';
import { getOfflineReadiness, readOfflineBookForDisplay } from '@/services/books/offlineDownloadManager';
import { enqueuePendingAction, flushPendingBookSyncQueue } from '@/services/books/offlineSyncQueue';
import { useBookReadAloud } from './useBookReadAloud';
import { selectionToOffsets, sentenceOverlapsSpan, splitIntoSentences } from './sentenceSplit';

type Props = NativeStackScreenProps<RootStackParamList, 'BookReader'>;

type ChapterSummary = { stable_id: string; order: number; title: string; word_count: number };
type ContentBlock = { id?: string; type: string; text?: string; asset_id?: string | null; width?: number; height?: number; caption?: string; alt_text?: string; extraction_status?: string };
type Highlight = {
  id: string; block_id: string; start_offset: number; end_offset: number;
  color: string; note: string; highlighted_text: string;
};
// A sentence or consecutive run of sentences the reader has tapped but
// not yet confirmed as a highlight/comment — see startOrExtendSelection.
type SentenceSelection = { blockId: string; anchorIdx: number; focusIdx: number } | null;

// Reader settings persist for the session only here — a dedicated
// device-local settings store is future work; the point of this screen is
// a native, structured reading surface (never a PDF/webview) with its own
// typography controls, not a byte-for-byte spec implementation of every
// Part E requirement in one pass.
//
// Selection scope, honestly: this is TAP-based sentence selection (tap a
// sentence to select it, tap another sentence in the SAME block to
// extend to that consecutive run), not drag-to-select — React Native's
// plain <Text> has no reliable cross-platform Selection-object equivalent
// for a custom-rendered, per-sentence-tintable paragraph. A selection is
// confined to one block (BookHighlight.block_id is a single id, not a
// range) — the backend's start_offset/end_offset already anchor an exact
// sub-block character span, which this screen now actually sends instead
// of always the whole block's bounds.
const FONT_SIZES = [15, 17, 19, 22];
const THEMES = {
  light: { bg: '#FFFDF8', text: '#1C1A16' },
  dark: { bg: '#121212', text: '#ECECEC' },
  warm: { bg: '#F4ECD8', text: '#3B2F1E' },
} as const;
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: 'rgba(250, 204, 21, 0.35)',
  green: 'rgba(74, 222, 128, 0.35)',
  blue: 'rgba(96, 165, 250, 0.35)',
  pink: 'rgba(244, 114, 182, 0.35)',
};

export default function BookReaderScreen({ navigation, route }: Props) {
  const { id, chapterStableId: targetChapterStableId, highlightBlockId: targetBlockId, targetHighlightId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;
  const { socket } = useSocket();
  const { user } = useAuth();

  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const [readerTheme, setReaderTheme] = useState<keyof typeof THEMES>('light');
  // The in-progress tap-based sentence selection (before Highlight/
  // Comment/Cancel is chosen) — see startOrExtendSelection.
  const [selection, setSelection] = useState<SentenceSelection>(null);
  const [pendingColor, setPendingColor] = useState('yellow');
  // The confirmation/edit sheet for one exact span: either a brand-new
  // selection about to become a highlight/comment, or an existing
  // highlight the reader tapped back into to change its color, edit its
  // comment, or delete it.
  const [highlightSheet, setHighlightSheet] = useState<{
    blockId: string; startOffset: number; endOffset: number; snapshotText: string;
    mode: 'comment' | 'edit'; existing?: Highlight;
  } | null>(null);
  const [highlightNoteText, setHighlightNoteText] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [showListenSettings, setShowListenSettings] = useState(false);
  const [bookMeta, setBookMeta] = useState<{ title: string; author_name: string } | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [passageToShare, setPassageToShare] = useState<Highlight | null>(null);
  const [flashBlockId, setFlashBlockId] = useState<string | null>(targetBlockId || null);
  const [anchorStaleNotice, setAnchorStaleNotice] = useState(false);

  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredPosition = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const blockOffsets = useRef<Record<string, number>>({});
  // Lazily decrypted once per screen visit and reused for every
  // chapter/TOC fallback below, rather than re-decrypting the whole
  // package on every network hiccup.
  const offlineBookRef = useRef<Awaited<ReturnType<typeof readOfflineBookForDisplay>> | null>(null);
  const [isOfflineCopy, setIsOfflineCopy] = useState(false);

  const loadOfflineFallback = useCallback(async () => {
    if (offlineBookRef.current) return offlineBookRef.current;
    const readiness = await getOfflineReadiness(id);
    if (readiness.status !== 'downloaded' && readiness.status !== 'update_available') return null;
    try {
      const decrypted = await readOfflineBookForDisplay(id);
      offlineBookRef.current = decrypted;
      return decrypted;
    } catch {
      // Corrupted on-device package — no fallback available; the
      // network-failure error the caller already set stands, which is
      // honest (this device genuinely cannot show the book right now).
      return null;
    }
  }, [id]);

  const loadToc = useCallback(async () => {
    const res: any = await getRequest(ROUTES.books.detail(id));
    if (res?.success) {
      setIsOfflineCopy(false);
      const loadedChapters: ChapterSummary[] = res.data?.chapters || [];
      setChapters(loadedChapters);
      setBookMeta({ title: res.data?.title || '', author_name: res.data?.author_name || '' });
      if (!res.data?.has_access) {
        setError('You do not have access to this book.');
      }
      if (targetChapterStableId) {
        const idx = loadedChapters.findIndex((c) => c.stable_id === targetChapterStableId);
        if (idx >= 0) {
          // A passage share deep-link always wins over the reader's own
          // saved position — they tapped a specific shared quote, not
          // "continue reading". Marking this restored up front stops
          // restoreSavedPosition's effect from overwriting it afterwards.
          hasRestoredPosition.current = true;
          setChapterIndex(idx);
        }
      }
      return;
    }

    // Network/server failure — fall back to a previously-downloaded
    // offline copy if one exists and its locally-cached license hasn't
    // expired. This is the "disconnect and still read the book" path.
    const offlineBook = await loadOfflineFallback();
    if (!offlineBook) {
      setError('Could not load this book.');
      return;
    }
    setIsOfflineCopy(true);
    setError(null);
    const loadedChapters: ChapterSummary[] = offlineBook.chapters.map((c) => ({
      stable_id: c.stable_id, order: c.order, title: c.title, word_count: c.word_count,
    }));
    setChapters(loadedChapters);
    setBookMeta({ title: offlineBook.manifest.title, author_name: offlineBook.manifest.author_name });
    if (targetChapterStableId) {
      const idx = loadedChapters.findIndex((c) => c.stable_id === targetChapterStableId);
      if (idx >= 0) {
        hasRestoredPosition.current = true;
        setChapterIndex(idx);
      }
    }
  }, [id, targetChapterStableId, loadOfflineFallback]);

  const restoreSavedPosition = useCallback(async (loadedChapters: ChapterSummary[]) => {
    if (hasRestoredPosition.current || loadedChapters.length === 0) return;
    hasRestoredPosition.current = true;
    const res: any = await getRequest(ROUTES.books.progress(id));
    const savedChapterId = res?.success ? res.data?.chapter_stable_id : null;
    if (!savedChapterId) return;
    const idx = loadedChapters.findIndex((c) => c.stable_id === savedChapterId);
    if (idx >= 0) setChapterIndex(idx);
  }, [id]);

  const loadChapter = useCallback(async (stableId: string) => {
    setLoading(true);

    if (isOfflineCopy) {
      // Already reading the offline copy (loadToc fell back) — never
      // attempt the network for chapter content mid-session, only for
      // highlights/bookmarks (best-effort, fine to come back empty).
      const offlineBook = await loadOfflineFallback();
      const chapter = offlineBook?.chapters.find((c) => c.stable_id === stableId);
      setBlocks(chapter?.content_blocks || []);
      setError(chapter ? null : 'This chapter is not available in your offline copy.');
      const [highlightsRes, bookmarksRes]: any[] = await Promise.all([
        getRequest(ROUTES.books.chapterHighlights(id, stableId)).catch(() => null),
        getRequest(ROUTES.books.chapterBookmarksList(id)).catch(() => null),
      ]);
      setHighlights(highlightsRes?.success ? highlightsRes.data || [] : []);
      const bookmarks = bookmarksRes?.success ? bookmarksRes.data || [] : [];
      setIsBookmarked(bookmarks.some((b: any) => b.chapter === stableId));
      setLoading(false);
      return;
    }

    const [chapterRes, highlightsRes, bookmarksRes]: any[] = await Promise.all([
      getRequest(ROUTES.books.chapterRead(id, stableId)),
      getRequest(ROUTES.books.chapterHighlights(id, stableId)),
      getRequest(ROUTES.books.chapterBookmarksList(id)),
    ]);
    if (chapterRes?.success) {
      setBlocks(chapterRes.data?.content_blocks || []);
      setError(null);
    } else {
      // Online TOC load succeeded earlier, but this specific chapter
      // fetch just failed (e.g. connectivity dropped between the two) —
      // try the offline copy before reporting an access error outright.
      const offlineBook = await loadOfflineFallback();
      const chapter = offlineBook?.chapters.find((c) => c.stable_id === stableId);
      if (chapter) {
        setBlocks(chapter.content_blocks || []);
        setError(null);
      } else {
        setError(chapterRes?.message || 'You do not have access to this chapter.');
        setBlocks([]);
      }
    }
    setHighlights(highlightsRes?.success ? highlightsRes.data || [] : []);
    const bookmarks = bookmarksRes?.success ? bookmarksRes.data || [] : [];
    setIsBookmarked(bookmarks.some((b: any) => b.chapter === stableId));
    setLoading(false);
  }, [id, isOfflineCopy, loadOfflineFallback]);

  useEffect(() => {
    loadToc();
  }, [loadToc]);

  useEffect(() => {
    if (chapters.length > 0) {
      restoreSavedPosition(chapters);
    }
  }, [chapters, restoreSavedPosition]);

  useEffect(() => {
    if (chapters.length > 0) {
      loadChapter(chapters[chapterIndex]?.stable_id);
    }
  }, [chapters, chapterIndex, loadChapter]);

  // Flush any reading-progress/highlight actions that were queued while
  // offline the moment real connectivity returns — not on a timer, so
  // they sync as soon as practical rather than up to a poll interval late.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) flushPendingBookSyncQueue().catch(() => {});
    });
    flushPendingBookSyncQueue().catch(() => {}); // also try once on mount
    return unsubscribe;
  }, []);

  // Scroll to the shared passage once its block has actually laid out and
  // reported an offset (onLayout below) — polls briefly rather than a fixed
  // delay, since layout timing varies with chapter length/device speed.
  useEffect(() => {
    if (!targetBlockId || loading) return;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const y = blockOffsets.current[targetBlockId];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
        setTimeout(() => { if (!cancelled) setFlashBlockId(null); }, 2500);
        return;
      }
      attempts += 1;
      if (attempts < 15) setTimeout(tryScroll, 120);
    };
    const kickoff = setTimeout(tryScroll, 120);
    return () => { cancelled = true; clearTimeout(kickoff); };
  }, [targetBlockId, loading, blocks]);

  // Honest anchor verification for a Highlights & Comments Center
  // "jump to this passage" link: never flash/scroll to a block whose
  // live text no longer matches what was highlighted (the chapter may
  // have been edited since) — show a clear notice and leave the reader
  // at the chapter's top (already the furthest-verified location) instead.
  useEffect(() => {
    if (!targetHighlightId || loading || blocks.length === 0) return;
    const live = highlights.find((h) => h.id === targetHighlightId);
    const block = blocks.find((b) => b.id === live?.block_id);
    const blockText = block?.text || '';
    const snapshot = (live?.highlighted_text || '').replace(/…$/, '');
    const currentSlice = blockText.slice(live?.start_offset ?? 0, live?.end_offset ?? 0);
    const resolved = !!live && !!snapshot && currentSlice.startsWith(snapshot);
    if (!resolved) {
      setAnchorStaleNotice(true);
      setFlashBlockId(null);
    }
  }, [targetHighlightId, loading, blocks, highlights]);

  // Resolves each "image" block's asset to a short-lived signed URL —
  // never a permanent public link (see BookImageAssetDownloadView).
  // Online-only for now: an offline copy's image blocks render their
  // honest "missing" fallback rather than a broken network image (see
  // this screen's closing report note on offline image bundling).
  useEffect(() => {
    if (isOfflineCopy) return;
    const assetIds = Array.from(new Set(
      blocks.filter((b) => b.type === 'image' && b.asset_id).map((b) => b.asset_id as string),
    )).filter((aid) => !imageUrls[aid]);
    if (assetIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(assetIds.map(async (aid) => {
        const res: any = await getRequest(ROUTES.books.imageDownload(aid)).catch(() => null);
        return [aid, res?.success ? res.data?.url : null] as const;
      }));
      if (cancelled) return;
      setImageUrls((prev) => {
        const next = { ...prev };
        for (const [aid, url] of results) if (url) next[aid] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [blocks, isOfflineCopy, imageUrls]);

  const saveProgress = useCallback((percent: number, blockIndex = 0) => {
    if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = setTimeout(async () => {
      const chapter = chapters[chapterIndex];
      if (!chapter) return;
      const payload = {
        chapter_stable_id: chapter.stable_id,
        block_index: blockIndex,
        percent_complete: percent,
        is_completed: percent >= 0.98,
      };
      const res: any = await putData(ROUTES.books.progress(id), payload).catch(() => null);
      if (!res?.success) {
        // Offline (or a transient failure) — queue it rather than
        // silently losing this reading-position update; flushed on
        // reconnect by the NetInfo listener above.
        await enqueuePendingAction({ type: 'progress', bookId: id, payload }).catch(() => {});
      }
    }, 800);
  }, [chapters, chapterIndex, id]);

  const isLastChapter = chapterIndex >= chapters.length - 1;
  // handleListenChapterEnd needs to call readAloud.stop() on the last
  // chapter, but `readAloud` doesn't exist until after the hook call
  // below (which itself needs this callback) — a ref bridges the two
  // without a circular reference.
  const readAloudStopRef = useRef<() => void>(() => {});

  const handleListenChapterEnd = useCallback(() => {
    if (isLastChapter) {
      readAloudStopRef.current();
    } else {
      setChapterIndex((i) => Math.min(chapters.length - 1, i + 1));
    }
  }, [isLastChapter, chapters.length]);

  const handleListenPositionChange = useCallback((position: { blockIndex: number; percentComplete: number }) => {
    saveProgress(position.percentComplete, position.blockIndex);
  }, [saveProgress]);

  const readAloud = useBookReadAloud({
    blocks,
    onChapterEnd: handleListenChapterEnd,
    onPositionChange: handleListenPositionChange,
  });
  readAloudStopRef.current = readAloud.stop;

  // Stop listening cleanly if the reader is closed while still playing.
  useEffect(() => {
    return () => {
      readAloudStopRef.current();
    };
  }, []);

  const toggleBookmark = async () => {
    const chapter = chapters[chapterIndex];
    if (!chapter) return;
    const optimisticNext = !isBookmarked;
    const res: any = await postRequest(ROUTES.books.chapterBookmarkToggle(id, chapter.stable_id), {}).catch(() => null);
    if (res?.success) {
      setIsBookmarked(!!res.data?.bookmarked);
      return;
    }
    // Same network-failure-vs-real-rejection distinction as saveHighlight
    // below: postRequest only omits `status` when there was no HTTP
    // response at all (true network failure), never for a real server
    // rejection. Without this branch, tapping bookmark while offline
    // silently did nothing — no error, no local change, no queued retry
    // — the tap just appeared to not work and the bookmark was lost.
    const isNetworkFailure = !res || res.status === undefined;
    if (isNetworkFailure) {
      setIsBookmarked(optimisticNext);
      await enqueuePendingAction({ type: 'bookmark', bookId: id, chapterStableId: chapter.stable_id }).catch(() => {});
      return;
    }
    Alert.alert('Could not update bookmark', res?.message || 'Please try again.');
  };

  // Finds the (at most one, by construction — overlapping spans for the
  // same user/block would collide on the exact-span unique constraint
  // only when identical; distinct overlapping spans are simply not
  // created by this UI) highlight covering a given block/sentence.
  const highlightCoveringOffset = useCallback((blockId: string, offset: number): Highlight | undefined => {
    return highlights.find((h) => h.block_id === blockId && offset >= h.start_offset && offset < h.end_offset);
  }, [highlights]);

  // Tap-based sentence selection: tapping a sentence with nothing
  // selected starts a one-sentence selection; tapping another sentence
  // in the SAME block extends the run to include everything between
  // (inclusive) — tapping a sentence in a DIFFERENT block abandons the
  // old selection and starts a new one there (a selection never spans
  // blocks, matching the single block_id anchor). Tapping a sentence
  // that's already part of a SAVED highlight instead opens that
  // highlight's edit sheet directly, rather than starting a fresh
  // overlapping selection on top of it.
  const startOrExtendSelection = (block: ContentBlock, sentenceIdx: number, sentenceStart: number) => {
    if (!block.id) return;
    const existing = highlightCoveringOffset(block.id, sentenceStart);
    if (existing && !selection) {
      setHighlightNoteText(existing.note || '');
      setPendingColor(existing.color);
      setHighlightSheet({
        blockId: block.id, startOffset: existing.start_offset, endOffset: existing.end_offset,
        snapshotText: existing.highlighted_text, mode: 'edit', existing,
      });
      return;
    }
    setSelection((prev) => {
      if (prev && prev.blockId === block.id) {
        return { ...prev, focusIdx: sentenceIdx };
      }
      return { blockId: block.id!, anchorIdx: sentenceIdx, focusIdx: sentenceIdx };
    });
  };

  const cancelSelection = () => {
    setSelection(null);
    setPendingColor('yellow');
  };

  const selectionSpan = (blockText: string): { start: number; end: number } | null => {
    if (!selection) return null;
    return selectionToOffsets(blockText, selection.anchorIdx, selection.focusIdx);
  };

  const confirmHighlight = async () => {
    if (!selection) return;
    const block = blocks.find((b) => b.id === selection.blockId);
    const span = block ? selectionSpan(block.text || '') : null;
    if (!block || !span) return;
    await persistHighlight({ blockId: selection.blockId, startOffset: span.start, endOffset: span.end, color: pendingColor, note: '' });
    cancelSelection();
  };

  const openCommentEditor = () => {
    if (!selection) return;
    const block = blocks.find((b) => b.id === selection.blockId);
    const span = block ? selectionSpan(block.text || '') : null;
    if (!block || !span) return;
    setHighlightNoteText('');
    setHighlightSheet({ blockId: selection.blockId, startOffset: span.start, endOffset: span.end, snapshotText: (block.text || '').slice(span.start, span.end), mode: 'comment' });
    setSelection(null);
  };

  const persistHighlight = async (args: { blockId: string; startOffset: number; endOffset: number; color: string; note: string }) => {
    const chapter = chapters[chapterIndex];
    if (!chapter) return;
    const text = blocks.find((b) => b.id === args.blockId)?.text || '';
    const snapshot = text.slice(args.startOffset, args.endOffset);
    const payload = { block_id: args.blockId, start_offset: args.startOffset, end_offset: args.endOffset, color: args.color, note: args.note.trim() };
    const res: any = await postRequest(ROUTES.books.chapterHighlights(id, chapter.stable_id), payload).catch(() => null);
    if (res?.success) {
      setHighlights((prev) => [...prev.filter((h) => !(h.block_id === args.blockId && h.start_offset === args.startOffset && h.end_offset === args.endOffset)), res.data]);
      return;
    }
    const isNetworkFailure = !res || res.status === undefined;
    if (isNetworkFailure) {
      const localHighlight: Highlight = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        block_id: args.blockId, start_offset: args.startOffset, end_offset: args.endOffset,
        color: args.color, note: payload.note, highlighted_text: snapshot,
      };
      setHighlights((prev) => [...prev, localHighlight]);
      await enqueuePendingAction({ type: 'highlight', bookId: id, chapterStableId: chapter.stable_id, payload }).catch(() => {});
      return;
    }
    Alert.alert('Could not save', res?.message || 'Please try again.');
  };

  const confirmHighlightSheet = async () => {
    if (!highlightSheet) return;
    if (highlightSheet.mode === 'edit' && highlightSheet.existing) {
      await updateExistingHighlight(highlightSheet.existing, { color: pendingColor, note: highlightNoteText.trim() });
    } else {
      await persistHighlight({
        blockId: highlightSheet.blockId, startOffset: highlightSheet.startOffset,
        endOffset: highlightSheet.endOffset, color: pendingColor, note: highlightNoteText.trim(),
      });
    }
    setHighlightSheet(null);
    setHighlightNoteText('');
  };

  const updateExistingHighlight = async (existing: Highlight, changes: { color?: string; note?: string }) => {
    // Local-only (not yet synced) highlight — just mutate the still-
    // queued create payload rather than PATCHing a server id that
    // doesn't exist yet.
    if (existing.id.startsWith('local_')) {
      setHighlights((prev) => prev.map((h) => (h.id === existing.id ? { ...h, ...changes } : h)));
      return;
    }
    setHighlights((prev) => prev.map((h) => (h.id === existing.id ? { ...h, ...changes } : h))); // optimistic
    const res: any = await patchRequest(ROUTES.books.highlightDetail(existing.id), changes).catch(() => null);
    if (res?.success) return;
    const isNetworkFailure = !res || res.status === undefined;
    if (isNetworkFailure) {
      await enqueuePendingAction({ type: 'highlight_update', bookId: id, serverHighlightId: existing.id, payload: changes }).catch(() => {});
      return;
    }
    // Real rejection — revert the optimistic change.
    setHighlights((prev) => prev.map((h) => (h.id === existing.id ? existing : h)));
    Alert.alert('Could not update', res?.message || 'Please try again.');
  };

  const deleteHighlight = async () => {
    if (!highlightSheet?.existing) return;
    const highlightId = highlightSheet.existing.id;
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    setHighlightSheet(null);
    setHighlightNoteText('');
    if (!highlightId.startsWith('local_')) {
      await deleteRequest(ROUTES.books.highlightDetail(highlightId)).catch(() => {});
    }
  };

  // Controlled passage sharing: sends the reader's own already-saved
  // highlight into a chat. highlighted_text is already capped server-side
  // (apps.books.services.MAX_HIGHLIGHT_CHARS, see create_highlight) so this
  // can never carry more than a short excerpt, mirroring
  // BibleReaderPanel.handleSharePick's pattern for verses.
  const handleSharePick = (chat: Chat) => {
    setShareSheetVisible(false);
    const passage = passageToShare;
    setPassageToShare(null);
    if (!passage) return;
    if (!socket) {
      Alert.alert('Share', 'Unable to share right now — check your connection.');
      return;
    }
    const chapter = chapters[chapterIndex];
    if (!chapter) return;
    const conversationId = String((chat as any)?.conversationId ?? chat.id);
    socket.timeout(20000).emit(
      'chat.send',
      {
        conversationId,
        clientId: `client_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        kind: 'book_passage',
        bookPassage: {
          bookId: id,
          bookTitle: bookMeta?.title || 'KIS Books',
          authorName: bookMeta?.author_name,
          chapterStableId: chapter.stable_id,
          blockId: passage.block_id,
          quotedText: passage.highlighted_text,
        },
      },
      (err: any, ackResult: { ok?: boolean; error?: string } | undefined) => {
        if (err) {
          Alert.alert('Share failed', 'No response from the server — please try again.');
          return;
        }
        if (ackResult && ackResult.ok === false) {
          Alert.alert('Share failed', ackResult.error || 'The chat could not accept this message.');
          return;
        }
        Alert.alert('Shared', `Shared this passage to ${chat.name || 'chat'}.`);
      },
    );
  };

  const watermarkLabel = (() => {
    const phone = (user as any)?.phone || '';
    const tail = phone ? phone.slice(-4) : String(user?.id || '').slice(-6);
    return tail ? `KIS · ${tail}` : '';
  })();

  const theme = THEMES[readerTheme];
  const fontSize = FONT_SIZES[fontSizeIdx];
  const chapter = chapters[chapterIndex];

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: sp, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    toolbarTitle: { fontSize: 13, fontWeight: '600', color: theme.text, flex: 1, textAlign: 'center' },
    toolbarActions: { flexDirection: 'row', gap: 16 },
    scroll: { flex: 1 },
    content: { padding: sp * 1.4, maxWidth: 680, alignSelf: 'center', width: '100%' },
    chapterTitle: { fontSize: fontSize + 6, fontWeight: '800', color: theme.text, marginBottom: 16 },
    paragraph: { fontSize, lineHeight: fontSize * 1.6, color: theme.text, marginBottom: 14, borderRadius: 4 },
    heading: { fontSize: fontSize + 4, fontWeight: '700', color: theme.text, marginTop: 10, marginBottom: 10, borderRadius: 4 },
    footerNav: {
      flexDirection: 'row', justifyContent: 'space-between', padding: sp,
      borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#B23B3B', textAlign: 'center', padding: sp * 2, fontSize: 15 },
    modalSheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.card,
      borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: sp, maxHeight: '70%',
    },
    tocRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.divider },
    tocText: { fontSize: 15, color: palette.text },
    tocActive: { color: palette.primary, fontWeight: '700' },
    settingsRow: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
    pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: palette.divider },
    pillActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    pillText: { color: palette.text, fontWeight: '600' },
    pillTextActive: { color: palette.ivory },
    colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
    noteInput: {
      borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 10, color: palette.text,
      minHeight: 60, marginVertical: 12,
    },
    speakingSentence: { backgroundColor: 'rgba(96, 165, 250, 0.4)', borderRadius: 3 },
    flashHighlight: { backgroundColor: 'rgba(16, 185, 129, 0.35)', borderRadius: 4 },
    selectedSentence: { backgroundColor: 'rgba(120, 120, 120, 0.28)', borderRadius: 3 },
    watermark: { position: 'absolute', bottom: 70, right: 14 },
    watermarkText: { fontSize: 10, fontWeight: '600', color: 'rgba(128,128,128,0.35)' },
    miniPlayer: {
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: sp, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', backgroundColor: palette.card,
    },
    miniPlayerTitle: { flex: 1, fontSize: 13, color: palette.subtext },
    selectionToolbar: {
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: sp, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)', backgroundColor: palette.card, flexWrap: 'wrap',
    },
    selectionSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
    selectionSwatchActive: { borderColor: theme.text },
    selectionAction: { fontWeight: '700', color: palette.primary },
    selectionCancel: { fontWeight: '700', color: palette.subtext },
    commentRow: {
      flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 14, paddingLeft: 10,
      borderLeftWidth: 2, alignItems: 'flex-start',
    },
    commentText: { flex: 1, fontSize: fontSize - 4, lineHeight: (fontSize - 4) * 1.4, color: theme.text, opacity: 0.75, fontStyle: 'italic' },
    commentEditLink: { fontSize: 11, fontWeight: '700', color: palette.primary },
    anchorStaleBanner: {
      padding: 10, marginBottom: 8, borderRadius: 8, backgroundColor: 'rgba(230, 180, 40, 0.18)',
    },
    anchorStaleText: { fontSize: 12, color: theme.text },
    imageBlockWrap: { marginBottom: 18, alignItems: 'center' },
    imageBlockImg: { width: '100%', borderRadius: 8, backgroundColor: palette.divider },
    imageCaption: { fontSize: fontSize - 3, color: theme.text, opacity: 0.7, marginTop: 6, textAlign: 'center' },
    imageMissing: {
      width: '100%', height: 160, borderRadius: 8, borderWidth: 1, borderColor: palette.divider,
      borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6,
    },
    imageMissingText: { fontSize: 12, color: palette.subtext },
  });

  const captureBlockOffset = (blockId: string | undefined) => (e: { nativeEvent: { layout: { y: number } } }) => {
    if (blockId) blockOffsets.current[blockId] = e.nativeEvent.layout.y;
  };

  const renderImageBlock = (block: ContentBlock, idx: number) => {
    const url = block.asset_id ? imageUrls[block.asset_id] : null;
    const aspect = block.width && block.height ? block.width / block.height : 16 / 10;
    return (
      <View key={block.id || idx} style={styles.imageBlockWrap} onLayout={captureBlockOffset(block.id)}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={[styles.imageBlockImg, { aspectRatio: aspect }]}
            resizeMode="contain"
            accessible accessibilityLabel={block.alt_text || block.caption || 'Book illustration'}
          />
        ) : (
          <View style={styles.imageMissing}>
            {block.extraction_status === 'extracted' && !isOfflineCopy ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <>
                <KISIcon name="book" size={24} color={palette.subtext} />
                <Text style={styles.imageMissingText}>
                  {isOfflineCopy ? 'Image not available offline yet' : 'Image not yet provided by the author'}
                </Text>
              </>
            )}
          </View>
        )}
        {!!block.caption && <Text style={styles.imageCaption}>{block.caption}</Text>}
      </View>
    );
  };

  const renderBlock = (block: ContentBlock, idx: number) => {
    if (block.type === 'image') return renderImageBlock(block, idx);

    const text = block.text || '';
    const sentences = splitIntoSentences(text);
    const baseStyle = block.type === 'heading' ? styles.heading : styles.paragraph;
    const isFlashed = !!block.id && block.id === flashBlockId;
    const isSpeakingThisBlock = readAloud.isActive && block.id && block.id === readAloud.currentBlockId;
    const blockHighlights = block.id ? highlights.filter((h) => h.block_id === block.id) : [];
    const activeSelection = block.id && selection?.blockId === block.id ? selection : null;
    const selLo = activeSelection ? Math.min(activeSelection.anchorIdx, activeSelection.focusIdx) : -1;
    const selHi = activeSelection ? Math.max(activeSelection.anchorIdx, activeSelection.focusIdx) : -1;

    const commentsForBlock = blockHighlights.filter((h) => h.note);

    return (
      <React.Fragment key={block.id || idx}>
        <Text style={[baseStyle, isFlashed && styles.flashHighlight]} onLayout={captureBlockOffset(block.id)}>
          {sentences.map((sentence, sIdx) => {
            const covering = blockHighlights.find((h) => sentenceOverlapsSpan(sentence, h.start_offset, h.end_offset));
            const isSelected = sIdx >= selLo && sIdx <= selHi;
            const isSpeaking = isSpeakingThisBlock && sIdx === readAloud.currentSentenceIndex;
            const tint = isSpeaking
              ? styles.speakingSentence
              : isSelected
                ? styles.selectedSentence
                : covering
                  ? { backgroundColor: HIGHLIGHT_COLORS[covering.color] || HIGHLIGHT_COLORS.yellow }
                  : undefined;
            return (
              <Text
                key={sIdx}
                style={tint}
                onPress={() => startOrExtendSelection(block, sIdx, sentence.start)}
                suppressHighlighting
              >
                {sentence.text}{sIdx < sentences.length - 1 ? ' ' : ''}
              </Text>
            );
          })}
        </Text>
        {commentsForBlock.map((h) => (
          <Pressable
            key={h.id}
            style={[styles.commentRow, { borderLeftColor: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow }]}
            onPress={() => {
              setHighlightNoteText(h.note);
              setPendingColor(h.color);
              setHighlightSheet({ blockId: h.block_id, startOffset: h.start_offset, endOffset: h.end_offset, snapshotText: h.highlighted_text, mode: 'edit', existing: h });
            }}
          >
            <Text style={styles.commentText}>{h.note}</Text>
            <Text style={styles.commentEditLink}>Edit</Text>
          </Pressable>
        ))}
      </React.Fragment>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Back to book details">
          <KISIcon name="back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.toolbarTitle} numberOfLines={1}>{chapter?.title || 'Reading'}</Text>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={() => (readAloud.status === 'playing' ? readAloud.pause() : readAloud.play())}
            hitSlop={8}
            accessibilityLabel={readAloud.status === 'playing' ? 'Pause listening' : 'Listen to this chapter'}
          >
            <KISIcon name={readAloud.status === 'playing' ? 'pause' : 'play'} size={20} color={readAloud.isActive ? palette.primary : theme.text} />
          </Pressable>
          <Pressable onPress={toggleBookmark} hitSlop={8} accessibilityLabel="Bookmark this chapter">
            <KISIcon name="bookmark" focused={isBookmarked} size={20} color={isBookmarked ? palette.primary : theme.text} />
          </Pressable>
          <Pressable onPress={() => setShowToc(true)} hitSlop={8} accessibilityLabel="Table of contents">
            <KISIcon name="list" size={20} color={theme.text} />
          </Pressable>
          <Pressable onPress={() => setShowSettings(true)} hitSlop={8} accessibilityLabel="Reading settings">
            <KISIcon name="settings" size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {selection && (
        <View style={styles.selectionToolbar}>
          {Object.entries(HIGHLIGHT_COLORS).map(([name, rgba]) => (
            <Pressable
              key={name}
              style={[styles.selectionSwatch, { backgroundColor: rgba }, pendingColor === name && styles.selectionSwatchActive]}
              onPress={() => setPendingColor(name)}
              accessibilityLabel={`Use ${name}`}
            />
          ))}
          <Pressable onPress={confirmHighlight} hitSlop={6}><Text style={styles.selectionAction}>Highlight</Text></Pressable>
          <Pressable onPress={openCommentEditor} hitSlop={6}><Text style={styles.selectionAction}>Comment</Text></Pressable>
          <Pressable onPress={cancelSelection} hitSlop={6}><Text style={styles.selectionCancel}>Cancel</Text></Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : error ? (
        <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const max = Math.max(1, contentSize.height - layoutMeasurement.height);
            saveProgress(Math.min(1, contentOffset.y / max));
          }}
          scrollEventThrottle={400}
        >
          <View style={styles.content}>
            {anchorStaleNotice && (
              <View style={styles.anchorStaleBanner}>
                <Text style={styles.anchorStaleText}>
                  This passage may have changed since it was annotated — showing the chapter from the top instead.
                </Text>
              </View>
            )}
            <Text style={styles.chapterTitle}>{chapter?.title || `Chapter ${chapterIndex + 1}`}</Text>
            {blocks.map(renderBlock)}
          </View>
        </ScrollView>
      )}

      {!loading && !error && watermarkLabel && (
        // A visible, unobtrusive deterrent against casual screenshot
        // sharing — not a claim that screenshots are prevented (they
        // aren't; see this screen's docs/KIS_BOOKS_OPERATIONS.md entry
        // on content-protection limitations). pointerEvents="none" keeps
        // it from ever intercepting a real tap/scroll underneath it.
        <View pointerEvents="none" style={styles.watermark}>
          <Text style={styles.watermarkText}>{watermarkLabel}</Text>
        </View>
      )}

      {readAloud.isActive && (
        <View style={styles.miniPlayer}>
          <Pressable onPress={readAloud.previousSentence} hitSlop={8} accessibilityLabel="Previous sentence">
            <KISIcon name="chevron-left" size={20} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={() => (readAloud.status === 'playing' ? readAloud.pause() : readAloud.play())}
            hitSlop={8}
            accessibilityLabel={readAloud.status === 'playing' ? 'Pause' : 'Resume'}
          >
            <KISIcon name={readAloud.status === 'playing' ? 'pause' : 'play'} size={24} color={palette.primary} />
          </Pressable>
          <Pressable onPress={readAloud.nextSentence} hitSlop={8} accessibilityLabel="Next sentence">
            <KISIcon name="chevron-right" size={20} color={theme.text} />
          </Pressable>
          <Text style={styles.miniPlayerTitle} numberOfLines={1}>
            {readAloud.status === 'playing' ? 'Listening…' : 'Paused'} · {readAloud.speed}x
          </Text>
          <Pressable onPress={() => setShowListenSettings(true)} hitSlop={8} accessibilityLabel="Listening settings">
            <KISIcon name="settings" size={18} color={theme.text} />
          </Pressable>
          <Pressable onPress={readAloud.stop} hitSlop={8} accessibilityLabel="Stop listening">
            <KISIcon name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
      )}

      <View style={styles.footerNav}>
        <Pressable
          disabled={chapterIndex === 0}
          onPress={() => { readAloud.stop(); setChapterIndex((i) => Math.max(0, i - 1)); }}
        >
          <Text style={{ color: chapterIndex === 0 ? palette.subtext : palette.primary, fontWeight: '700' }}>← Previous</Text>
        </Pressable>
        <Pressable
          disabled={chapterIndex >= chapters.length - 1}
          onPress={() => { readAloud.stop(); setChapterIndex((i) => Math.min(chapters.length - 1, i + 1)); }}
        >
          <Text style={{ color: chapterIndex >= chapters.length - 1 ? palette.subtext : palette.primary, fontWeight: '700' }}>Next →</Text>
        </Pressable>
      </View>

      <Modal visible={showToc} transparent animationType="slide" onRequestClose={() => setShowToc(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowToc(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              {chapters.map((c, idx) => (
                <Pressable key={c.stable_id} style={styles.tocRow} onPress={() => { readAloud.stop(); setChapterIndex(idx); setShowToc(false); }}>
                  <Text style={[styles.tocText, idx === chapterIndex && styles.tocActive]}>
                    {c.order}. {c.title || `Chapter ${c.order}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowSettings(false)}>
          <View style={styles.modalSheet}>
            <Text style={{ fontWeight: '700', marginBottom: 10, color: palette.text }}>Text size</Text>
            <View style={styles.settingsRow}>
              {FONT_SIZES.map((size, idx) => (
                <Pressable key={size} style={[styles.pill, idx === fontSizeIdx && styles.pillActive]} onPress={() => setFontSizeIdx(idx)}>
                  <Text style={[styles.pillText, idx === fontSizeIdx && styles.pillTextActive]}>A{idx + 1}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontWeight: '700', marginBottom: 10, color: palette.text }}>Theme</Text>
            <View style={styles.settingsRow}>
              {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => (
                <Pressable key={t} style={[styles.pill, t === readerTheme && styles.pillActive]} onPress={() => setReaderTheme(t)}>
                  <Text style={[styles.pillText, t === readerTheme && styles.pillTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showListenSettings} transparent animationType="slide" onRequestClose={() => setShowListenSettings(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowListenSettings(false)}>
          <View style={styles.modalSheet}>
            <Text style={{ fontWeight: '700', marginBottom: 10, color: palette.text }}>Playback speed</Text>
            <View style={styles.settingsRow}>
              {[0.75, 1, 1.25, 1.5, 2].map((mult) => (
                <Pressable key={mult} style={[styles.pill, readAloud.speed === mult && styles.pillActive]} onPress={() => readAloud.setSpeed(mult)}>
                  <Text style={[styles.pillText, readAloud.speed === mult && styles.pillTextActive]}>{mult}x</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontWeight: '700', marginBottom: 10, color: palette.text }}>Sleep timer</Text>
            <View style={styles.settingsRow}>
              {[null, 10, 20, 30, 60].map((mins) => (
                <Pressable
                  key={mins ?? 'off'}
                  style={[styles.pill, readAloud.sleepTimerMinutes === mins && styles.pillActive]}
                  onPress={() => readAloud.setSleepTimerMinutes(mins)}
                >
                  <Text style={[styles.pillText, readAloud.sleepTimerMinutes === mins && styles.pillTextActive]}>
                    {mins ? `${mins}m` : 'Off'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {readAloud.voices.length > 0 && (
              <>
                <Text style={{ fontWeight: '700', marginBottom: 10, color: palette.text }}>Voice</Text>
                <ScrollView style={{ maxHeight: 160 }}>
                  {readAloud.voices.map((voice: any) => (
                    <Pressable
                      key={voice.id}
                      style={styles.tocRow}
                      onPress={() => readAloud.setVoice(voice.id)}
                    >
                      <Text style={[styles.tocText, readAloud.selectedVoiceId === voice.id && styles.tocActive]}>
                        {voice.name || voice.id} {voice.language ? `(${voice.language})` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!highlightSheet} transparent animationType="slide" onRequestClose={() => setHighlightSheet(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setHighlightSheet(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={{ fontWeight: '700', color: palette.text }}>
              {highlightSheet?.mode === 'edit' ? 'Edit this highlight' : 'Comment on this passage'}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6, fontStyle: 'italic' }} numberOfLines={2}>
              "{highlightSheet?.snapshotText}"
            </Text>
            <View style={[styles.settingsRow, { marginTop: 14 }]}>
              {Object.entries(HIGHLIGHT_COLORS).map(([name, rgba]) => (
                <Pressable
                  key={name}
                  style={[styles.colorSwatch, { backgroundColor: rgba }, pendingColor === name && { borderColor: palette.text }]}
                  onPress={() => setPendingColor(name)}
                  accessibilityLabel={`Use ${name}`}
                />
              ))}
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a comment (optional)"
              placeholderTextColor={palette.subtext}
              value={highlightNoteText}
              onChangeText={setHighlightNoteText}
              multiline
            />
            <KISButton title="Save" variant="primary" onPress={confirmHighlightSheet} />
            {highlightSheet?.existing && (
              <Pressable
                onPress={() => {
                  setPassageToShare(highlightSheet.existing!);
                  setHighlightSheet(null);
                  setShareSheetVisible(true);
                }}
                hitSlop={8}
              >
                <Text style={{ color: palette.primary, fontWeight: '700', textAlign: 'center', marginTop: 12 }}>
                  Share to chat
                </Text>
              </Pressable>
            )}
            {highlightSheet?.existing && (
              <Pressable onPress={deleteHighlight} hitSlop={8}>
                <Text style={{ color: '#B23B3B', fontWeight: '700', textAlign: 'center', marginTop: 12 }}>Remove highlight</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ShareToChatModal
        visible={shareSheetVisible}
        onClose={() => { setShareSheetVisible(false); setPassageToShare(null); }}
        onPicked={handleSharePick}
      />
    </SafeAreaView>
  );
}
