import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import type { ChatMessage } from '../../chatTypes';

const GREETING_PATTERNS = /^(hi|hello|hey|howdy|greetings|good morning|good afternoon|good evening)\b/i;
const QUESTION_PATTERN = /\?(\s*)$/;
const THANKS_PATTERN = /\b(thank|thanks|thx|ty|appreciate)\b/i;
const OK_PATTERN = /^(ok|okay|sure|alright|sounds good|got it|yes|yep|yup)\b/i;
const AGREE_PATTERN = /\b(can you|could you|would you|please|pls)\b/i;

function suggestReplies(lastMessage: ChatMessage): string[] {
  const text = (lastMessage.text ?? '').toLowerCase().trim();

  if (!text) {
    if (lastMessage.location) return ['Got your location 📍', 'On my way!', 'Thanks!'];
    if (lastMessage.voice) return ['🎤 Listened', 'Got it!', 'Will reply soon'];
    if (lastMessage.poll) return ['Voted!', 'Thanks for the poll'];
    if (lastMessage.event) return ['Noted the event 📅', 'I\'ll be there!', 'Can\'t make it'];
    return [];
  }

  if (GREETING_PATTERNS.test(text)) {
    return ['👋 Hi!', 'Hello!', 'Hey there!'];
  }
  if (THANKS_PATTERN.test(text)) {
    return ['You\'re welcome!', 'Of course!', 'No problem 😊'];
  }
  if (QUESTION_PATTERN.test(text)) {
    return ['Yes', 'No', 'Let me check', 'I\'ll get back to you'];
  }
  if (OK_PATTERN.test(text)) {
    return ['👍', 'Got it!', 'Perfect'];
  }
  if (AGREE_PATTERN.test(text)) {
    return ['Sure!', 'Of course!', 'I\'ll do it'];
  }

  return ['👍', 'Got it!', 'Noted'];
}

type Props = {
  lastMessage: ChatMessage | null;
  palette: any;
  onSelect: (text: string) => void;
};

export const QuickRepliesBar: React.FC<Props> = ({
  lastMessage,
  palette,
  onSelect,
}) => {
  const suggestions = useMemo(() => {
    if (!lastMessage || lastMessage.fromMe) return [];
    return suggestReplies(lastMessage);
  }, [lastMessage]);

  // The bar's visibility/content is keyed on the last RECEIVED message, not
  // on whether a reply was already sent — so without this, the same chips
  // stay tappable after a send (nothing about lastMessage changes just
  // because *this device* replied to it), and a double-tap fires onSelect
  // twice with two fresh clientIds, creating two genuinely separate sent
  // messages. Lock the whole row the instant any chip is tapped; a new
  // incoming message (a new lastMessage identity) unlocks it again.
  const [sentForMessage, setSentForMessage] = useState<ChatMessage | null>(null);
  useEffect(() => {
    setSentForMessage(null);
  }, [lastMessage]);
  const locked = sentForMessage === lastMessage;

  if (suggestions.length === 0) return null;

  return (
    <View style={[styles.container, { borderTopColor: palette.divider }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
      >
        {suggestions.map((text, idx) => (
          <Pressable
            key={idx}
            disabled={locked}
            style={[
              styles.chip,
              {
                backgroundColor: palette.surfaceElevated ?? palette.card,
                borderColor: palette.divider,
                opacity: locked ? 0.5 : 1,
              },
            ]}
            onPress={() => {
              setSentForMessage(lastMessage);
              onSelect(text);
            }}
          >
            <Text style={[styles.chipText, { color: palette.text }]}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
});
