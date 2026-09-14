// src/Module/ChatRoom/componets/MessageTranslationBlock.tsx
//
// Inline UI for a message bubble's on-device translation state (idle
// "Translate" link, model-download prompt, in-progress spinners, the
// translated text itself with an "Original" toggle, and errors). Pure
// presentation - all the actual translation logic lives in
// useMessageTranslation.ts. Kept as its own file so MessageBubble.tsx
// (already large) doesn't grow further for this feature.
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { getLanguageLabel } from '@/services/translation/translationLanguages';
import type { UseMessageTranslationResult } from '../hooks/useMessageTranslation';

type Props = {
  translation: UseMessageTranslationResult;
  isMe: boolean;
  palette: any;
  /** Only render the idle "🌐 Translate" trigger link when true - the
   *  message action sheet is always an available trigger regardless. */
  showInlineTrigger: boolean;
};

export const MessageTranslationBlock: React.FC<Props> = ({
  translation,
  isMe,
  palette,
  showInlineTrigger,
}) => {
  const {
    phase,
    visible,
    translatedText,
    sourceLanguageCode,
    errorMessage,
    neededModelLabel,
    translate,
    confirmDownload,
    toggleOriginal,
  } = translation;

  const subtleColor = isMe ? 'rgba(255,255,255,0.75)' : palette.subtext;
  const textColor = isMe ? '#fff' : palette.text;

  if (visible && translatedText) {
    return (
      <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' }}>
        <Text style={{ fontSize: 10, color: subtleColor, marginBottom: 2 }}>
          🌐 {sourceLanguageCode ? `Translated from ${getLanguageLabel(sourceLanguageCode)}` : 'Translated'}
        </Text>
        <Text style={{ color: textColor, fontSize: 14 }}>{translatedText}</Text>
        <Pressable onPress={toggleOriginal} hitSlop={6}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: subtleColor, marginTop: 4 }}>Original</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'checking' || phase === 'translating') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <ActivityIndicator size="small" color={subtleColor} />
        <Text style={{ fontSize: 11, color: subtleColor }}>
          {phase === 'checking' ? 'Checking translation…' : 'Translating…'}
        </Text>
      </View>
    );
  }

  if (phase === 'needs_download') {
    return (
      <Pressable onPress={() => void confirmDownload()} style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: palette.primary, fontWeight: '600' }}>
          {'⬇️ Download '}
          {neededModelLabel ?? 'language pack'}
          {' to translate'}
        </Text>
      </Pressable>
    );
  }

  if (phase === 'downloading') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <ActivityIndicator size="small" color={subtleColor} />
        <Text style={{ fontSize: 11, color: subtleColor }}>Downloading language pack…</Text>
      </View>
    );
  }

  if (phase === 'error' && errorMessage) {
    return (
      <Pressable onPress={() => void translate()} style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: palette.danger ?? '#DC2626' }}>⚠️ {errorMessage} (tap to retry)</Text>
      </Pressable>
    );
  }

  if (!showInlineTrigger) return null;

  return (
    <Pressable onPress={() => void translate()} style={{ marginTop: 4 }}>
      <Text style={{ color: subtleColor, fontSize: 11 }}>🌐 Translate</Text>
    </Pressable>
  );
};

export default MessageTranslationBlock;
