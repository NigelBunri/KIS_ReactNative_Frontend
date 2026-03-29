import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';

type BibleBotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const emptyBotMessage = {
  id: 'bot-empty',
  role: 'assistant' as const,
  content: 'Ask me about Scripture, prayer, and Christian living.',
};

type Props = {
  messages: BibleBotMessage[];
  onSend: (message: string) => Promise<any>;
};

export default function BibleBotPanel({ messages, onSend }: Props) {
  const { palette } = useKISTheme();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    setBusy(true);
    await onSend(input.trim());
    setInput('');
    setBusy(false);
  };

  const list = messages.length ? messages : [emptyBotMessage];

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Bible study bot</Text>
      <Text style={{ color: palette.subtext }}>
        This bot only answers Bible study questions. Non-faith topics are blocked.
      </Text>

      <View style={[styles.chatBox, { borderColor: palette.divider }]}
      >
        {list.slice(-6).map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubble,
              {
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? palette.primarySoft : palette.surface,
              },
            ]}
          >
            <Text style={{ color: palette.text }}>{msg.content}</Text>
          </View>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a Bible question"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
        />
        <KISButton title={busy ? '...' : 'Send'} size="sm" onPress={handleSend} />
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  chatBox: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    minHeight: 120,
  },
  bubble: {
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
  },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 2, borderRadius: 10, padding: 10 },
});
