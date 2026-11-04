// src/screens/bots/CreateBotScreen.tsx
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

const KIND_OPTIONS: { key: string; label: string; description: string }[] = [
  { key: 'rule_based', label: 'Rule-based', description: 'Welcome messages, FAQs, keyword triggers — no code or AI needed.' },
  { key: 'custom', label: 'Custom-developed', description: 'Host your own app (Python, Node.js, etc.) and connect it via API credentials.' },
  { key: 'ai_powered', label: 'AI-powered', description: 'Connect your own OpenAI, Claude, Gemini, or custom AI provider.' },
  { key: 'hybrid', label: 'Hybrid', description: 'A mix of rules, your own code, and AI.' },
];

export default function CreateBotScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('rule_based');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your bot a name.');
      return;
    }
    setSaving(true);
    const res = await postRequest(ROUTES.bots.list, {
      name: name.trim(),
      description: description.trim(),
      kind,
    });
    setSaving(false);
    if (res?.success) {
      navigation.replace('BotDetail', { botId: res.data.id, name: res.data.name });
    } else if (res?.status === 403) {
      Alert.alert('Upgrade required', res?.message || 'The Bot Platform requires a Business plan or above.');
    } else {
      Alert.alert('Could not create bot', res?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: responsive.pageGutter,
          paddingTop: 10,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="close" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }}>
          Create a bot
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Bot name</Text>
          <KISTextInput value={name} onChangeText={setName} placeholder="e.g. Sunday Service Helper" maxLength={120} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Description (optional)</Text>
          <KISTextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What does this bot help with?"
            multiline
            layout={{ multilineMinHeight: 80 }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>How will this bot work?</Text>
          {KIND_OPTIONS.map((option) => {
            const selected = kind === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setKind(option.key)}
                style={{
                  borderWidth: 2,
                  borderColor: selected ? palette.primaryStrong : palette.divider,
                  backgroundColor: selected ? palette.primarySoft : palette.card,
                  borderRadius: 14,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: palette.text }}>{option.label}</Text>
                <Text style={{ fontSize: 12, color: palette.subtext }}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>

        <KISButton title={saving ? 'Creating…' : 'Create bot'} onPress={handleCreate} disabled={saving} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
