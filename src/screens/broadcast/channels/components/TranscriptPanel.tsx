// src/screens/broadcast/channels/components/TranscriptPanel.tsx
//
// Video transcript panel. Fetches transcript, shows generation states,
// supports copying full text and language selection.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type TranscriptStatus =
  | 'idle'
  | 'loading'
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed';

type LanguageOption = {
  code: string;
  label: string;
};

type TranscriptData = {
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'none';
  text_plain?: string;
  language_code?: string;
  languages?: LanguageOption[];
};

type Props = {
  contentId: string;
  visible: boolean;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TranscriptPanel({ contentId, visible, onClose }: Props) {
  const { palette } = useKISTheme();

  const [status, setStatus]               = useState<TranscriptStatus>('idle');
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [languages, setLanguages]         = useState<LanguageOption[]>([]);
  const [selectedLang, setSelectedLang]   = useState<string>('');
  const [generating, setGenerating]       = useState(false);

  // ── Fetch transcript ─────────────────────────────────────────────────────────

  const fetchTranscript = useCallback(async (lang?: string) => {
    if (!contentId) return;
    setStatus('loading');
    try {
      const url = lang
        ? `${ROUTES.broadcasts.contentTranscript(contentId)}?lang=${lang}`
        : ROUTES.broadcasts.contentTranscript(contentId);
      const res = await getRequest(url, { errorMessage: '' });
      if (res?.success && res?.data) {
        const data: TranscriptData = res.data;
        if (data.status === 'ready') {
          setStatus('ready');
          setTranscriptText(data.text_plain ?? '');
        } else if (data.status === 'processing' || data.status === 'pending') {
          setStatus(data.status);
        } else if (data.status === 'failed') {
          setStatus('failed');
        } else {
          // no transcript exists yet
          setStatus('idle');
        }
        if (data.languages && data.languages.length > 0) {
          setLanguages(data.languages);
          if (!selectedLang && data.language_code) {
            setSelectedLang(data.language_code);
          }
        }
      } else {
        // 404 / no transcript yet for this language
        setStatus('idle');
      }
    } catch {
      setStatus('failed');
    }
  }, [contentId, selectedLang]);

  useEffect(() => {
    if (visible) {
      fetchTranscript(selectedLang || undefined);
    }
  }, [visible]);

  // ── Generate transcript ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.contentTranscript(contentId),
        { source: 'auto', language_code: selectedLang || 'en' },
        { errorMessage: 'Failed to start transcript generation' },
      );
      if (res?.success || res?.data) {
        setStatus('processing');
      } else {
        Alert.alert('Generation failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Generation failed', e?.message || 'Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [generating, contentId]);

  // ── Copy ─────────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (transcriptText) {
      Clipboard.setString(transcriptText);
      Alert.alert('Copied', 'Transcript copied to clipboard.');
    }
  }, [transcriptText]);

  // ── Language change ──────────────────────────────────────────────────────────

  const handleLangChange = useCallback((code: string) => {
    setSelectedLang(code);
    fetchTranscript(code);
  }, [fetchTranscript]);

  // ── Body content ─────────────────────────────────────────────────────────────

  const renderBody = () => {
    switch (status) {
      case 'loading':
        return (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.gold} size="large" />
            <Text style={[styles.statusText, { color: palette.subtext }]}>
              Loading transcript...
            </Text>
          </View>
        );

      case 'idle':
        return (
          <View style={styles.centered}>
            <Text style={[styles.statusText, { color: palette.subtext }]}>
              No transcript available.
            </Text>
            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={[styles.actionBtn, { backgroundColor: palette.gold }]}
            >
              {generating ? (
                <ActivityIndicator size="small" color={palette.ivory} />
              ) : (
                <Text style={[styles.actionBtnText, { color: palette.onPrimary }]}>Generate Transcript</Text>
              )}
            </Pressable>
          </View>
        );

      case 'pending':
      case 'processing':
        return (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.gold} size="large" />
            <Text style={[styles.statusText, { color: palette.subtext }]}>
              Generating transcript... This may take a few minutes.
            </Text>
          </View>
        );

      case 'ready':
        return (
          <ScrollView
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
          >
            <Text style={[styles.transcriptText, { color: palette.text }]}>
              {transcriptText}
            </Text>
          </ScrollView>
        );

      case 'failed':
        return (
          <View style={styles.centered}>
            <Text style={[styles.statusText, { color: palette.subtext }]}>
              Transcript failed to generate.
            </Text>
            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={[styles.actionBtn, { backgroundColor: palette.gold }]}
            >
              {generating ? (
                <ActivityIndicator size="small" color={palette.ivory} />
              ) : (
                <Text style={[styles.actionBtnText, { color: palette.onPrimary }]}>Try Again</Text>
              )}
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={[styles.backdrop, { backgroundColor: palette.royalInk, opacity: 0.55 }]} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: palette.text }]}>Transcript</Text>
            <View style={styles.headerActions}>
              {status === 'ready' && (
                <Pressable onPress={handleCopy} style={styles.copyBtn}>
                  <Text style={[styles.copyText, { color: palette.gold }]}>Copy</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose}>
                <Text style={[styles.closeTxt, { color: palette.subtext }]}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Language selector */}
          {languages.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.langRow}
            >
              {languages.map(lang => (
                <Pressable
                  key={lang.code}
                  onPress={() => handleLangChange(lang.code)}
                  style={[
                    styles.langPill,
                    {
                      backgroundColor:
                        selectedLang === lang.code
                          ? palette.gold
                          : palette.surfaceElevated,
                      borderColor:
                        selectedLang === lang.code ? palette.gold : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      { color: selectedLang === lang.code ? palette.onPrimary : palette.text },
                    ]}
                  >
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Body */}
          <View style={styles.body}>{renderBody()}</View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 30,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  panelTitle: { fontSize: 17, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copyBtn: { padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  copyText: { fontSize: 14, fontWeight: '700' },
  closeTxt: { fontSize: 18, padding: 4, minWidth: 44, minHeight: 44, textAlign: 'center', lineHeight: 44 },
  langRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
  },
  langPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  langPillText: { fontSize: 12, fontWeight: '600' },
  body: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: {
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  actionBtnText: { fontWeight: '700', fontSize: 14 },
  transcriptScroll: { flex: 1 },
  transcriptContent: {
    padding: 16,
    paddingBottom: 24,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
