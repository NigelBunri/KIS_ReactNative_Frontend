// src/screens/calls/components/InviteLinkCard.tsx
// Shows an invite link for a standalone call with copy + native share actions.

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

// Deep-link base — callers pass the full link so this component stays pure
export type InviteLinkCardProps = {
  visible: boolean;
  inviteLink: string;
  callTitle: string;
  onClose: () => void;
};

export default function InviteLinkCard({
  visible,
  inviteLink,
  callTitle,
  onClose,
}: InviteLinkCardProps) {
  const { palette } = useKISTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Join "${callTitle}"`,
        message: `Join my call "${callTitle}":\n${inviteLink}`,
        url: inviteLink,
      });
    } catch {}
  };

  const truncated =
    inviteLink.length > 48 ? `${inviteLink.slice(0, 24)}…${inviteLink.slice(-20)}` : inviteLink;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.card }]}>
        <SafeAreaView edges={['bottom']}>

          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: palette.inputBorder }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Invite link</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Anyone with this link can join the call.
          </Text>

          {/* Link box */}
          <View style={[styles.linkBox, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
            <KISIcon name="link" size={16} color={palette.subtext} />
            <Text style={[styles.linkText, { color: palette.text }]} selectable numberOfLines={1}>
              {truncated}
            </Text>
          </View>

          {/* Action row */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: copied ? `${palette.success}26` : `${palette.gold}1A`,
                  borderColor: copied ? `${palette.success}60` : `${palette.gold}60`,
                },
                pressed && { opacity: 0.75 },
              ]}
            >
              <KISIcon
                name={copied ? 'check' : 'copy'}
                size={18}
                color={copied ? palette.success : palette.gold}
              />
              <Text style={[styles.actionText, { color: copied ? palette.success : palette.gold }]}>
                {copied ? 'Copied!' : 'Copy link'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: `${palette.primary}1A`, borderColor: `${palette.primary}60` },
                pressed && { opacity: 0.75 },
              ]}
            >
              <KISIcon name="share" size={18} color={palette.primary} />
              <Text style={[styles.actionText, { color: palette.primary }]}>Share</Text>
            </Pressable>
          </View>

          {/* Note */}
          <Text style={[styles.note, { color: palette.subtext }]}>
            Link expires when the call ends.
          </Text>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 13, marginBottom: 18 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  linkText: { flex: 1, fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 13,
  },
  actionText: { fontSize: 14, fontWeight: '800' },
  note: { fontSize: 11, textAlign: 'center', marginBottom: 8 },
});
