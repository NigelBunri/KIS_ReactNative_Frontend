import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import KISTextInput from '@/constants/KISTextInput';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';

type Props = { channel?: BroadcastChannelSummary | null };

export default function ChannelBrandingEditor({ channel }: Props) {
  const { palette } = useKISTheme();
  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
      <Text style={[styles.title, { color: palette.text }]}>Branding</Text>
      <Text style={[styles.subtitle, { color: palette.subtext }]}>Channel name, handle, visuals, links, and public identity.</Text>
      <KISTextInput label="Display name" value={channel?.display_name || ''} editable={false} />
      <KISTextInput label="Handle" value={channel?.handle ? `@${channel.handle}` : ''} editable={false} />
      <KISTextInput label="Description" value={channel?.description || ''} editable={false} multiline style={{ minHeight: 70 }} />
      <Text style={[styles.note, { color: palette.subtext }]}>Editing will be connected to the channel PATCH endpoint after product approves branding rules and media picker behavior.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 3, marginBottom: 10, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  note: { marginTop: 6, fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
