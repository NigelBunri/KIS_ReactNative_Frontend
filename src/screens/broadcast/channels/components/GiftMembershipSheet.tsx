// src/screens/broadcast/channels/components/GiftMembershipSheet.tsx
//
// Bottom sheet to gift a channel membership to another user.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tier = {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  perks?: string[];
};

type Props = {
  channelId: string;
  tiers: Tier[];
  visible: boolean;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GiftMembershipSheet({ channelId, tiers, visible, onClose }: Props) {
  const { palette } = useKISTheme();
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    tiers[0]?.id ?? null,
  );
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedTier = tiers.find(t => t.id === selectedTierId);

  const formatPrice = (cents: number, currency: string) => {
    if (cents === 0) return 'Free';
    return `${currency} ${(cents / 100).toFixed(2)}/mo`;
  };

  const handleGift = async () => {
    if (!selectedTierId) {
      Alert.alert('Select a tier', 'Please select a membership tier to gift.');
      return;
    }
    const recipientValue = recipient.trim();
    if (!recipientValue) {
      Alert.alert('Recipient required', 'Please enter the recipient’s email address.');
      return;
    }
    const isEmail = /\S+@\S+\.\S+/.test(recipientValue);
    if (!isEmail) {
      Alert.alert('Invalid email', 'Please enter a valid email address for the recipient.');
      return;
    }
    setLoading(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.membershipGift,
        {
          channel_id: channelId,
          tier_id: selectedTierId,
          recipient_email: recipientValue,
          message: message.trim() || undefined,
        },
        { errorMessage: 'Could not send gift.' },
      );
      if (res?.data || res?.id || res?.success) {
        setSuccess(true);
      } else {
        Alert.alert('Error', res?.message ?? 'Could not send gift. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not send gift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setRecipient('');
    setMessage('');
    setSelectedTierId(tiers[0]?.id ?? null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: palette.royalInk, opacity: 0.5 }]} onPress={handleClose} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: palette.card }]}>
        {/* Handle bar */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sheetTitle, { color: palette.text }]}>Gift Membership</Text>

          {success ? (
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>🎁</Text>
              <Text style={[styles.successTitle, { color: palette.text }]}>
                Membership gifted!
              </Text>
              <Text style={[styles.successSubtext, { color: palette.subtext }]}>
                Your gift has been sent to {recipient}.
              </Text>
              <Pressable
                onPress={handleClose}
                style={[styles.doneBtn, { backgroundColor: palette.primaryStrong }]}
              >
                <Text style={[styles.doneBtnText, { color: palette.onPrimary }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Tier selector */}
              <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
                Select a tier
              </Text>
              {tiers.map(tier => {
                const active = tier.id === selectedTierId;
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => setSelectedTierId(tier.id)}
                    style={[
                      styles.tierCard,
                      {
                        backgroundColor: active
                          ? palette.primarySoft ?? palette.surface
                          : palette.surface,
                        borderColor: active ? palette.primaryStrong : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.tierHeader}>
                      <Text style={[styles.tierTitle, { color: palette.text }]}>
                        {tier.title}
                      </Text>
                      <Text style={[styles.tierPrice, { color: palette.primaryStrong }]}>
                        {formatPrice(tier.price_cents, tier.currency)}
                      </Text>
                    </View>
                    {tier.perks && tier.perks.length > 0 && (
                      <View style={styles.perksList}>
                        {tier.perks.slice(0, 3).map((perk, idx) => (
                          <Text
                            key={idx}
                            style={[styles.perkItem, { color: palette.subtext }]}
                          >
                            • {perk}
                          </Text>
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Recipient */}
              <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
                Recipient email
              </Text>
              <TextInput
                value={recipient}
                onChangeText={setRecipient}
                placeholder="recipient@example.com"
                placeholderTextColor={palette.subtext}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: palette.text, borderColor: palette.border }]}
              />

              {/* Message */}
              <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
                Message (optional, max 300 chars)
              </Text>
              <TextInput
                value={message}
                onChangeText={text => setMessage(text.slice(0, 300))}
                placeholder="Add a personal message..."
                placeholderTextColor={palette.subtext}
                multiline
                style={[
                  styles.input,
                  styles.messageInput,
                  { color: palette.text, borderColor: palette.border },
                ]}
              />
              <Text style={[styles.charCount, { color: palette.subtext }]}>
                {message.length}/300
              </Text>

              {/* Gift button */}
              <Pressable
                onPress={handleGift}
                disabled={loading}
                style={[styles.giftBtn, { backgroundColor: palette.primaryStrong }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={palette.ivory} />
                ) : (
                  <Text style={[styles.giftBtnText, { color: palette.onPrimary }]}>Gift Membership</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  handleRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  sheetTitle: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tierCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierTitle: { fontSize: 14, fontWeight: '800' },
  tierPrice: { fontSize: 13, fontWeight: '700' },
  perksList: { gap: 2 },
  perkItem: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  messageInput: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: -6 },
  giftBtn: {
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  giftBtnText: { fontWeight: '900', fontSize: 15 },
  successContainer: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  successEmoji: { fontSize: 56 },
  successTitle: { fontSize: 20, fontWeight: '900' },
  successSubtext: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  doneBtn: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 8,
  },
  doneBtnText: { fontWeight: '800', fontSize: 14 },
});
