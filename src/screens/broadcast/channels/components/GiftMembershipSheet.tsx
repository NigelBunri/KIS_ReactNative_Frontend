// src/screens/broadcast/channels/components/GiftMembershipSheet.tsx
//
// Bottom sheet to gift a channel membership to another user.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type PaymentProvider = 'flutterwave' | 'stripe';

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
  const [paymentModal, setPaymentModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const selectedTier = tiers.find(t => t.id === selectedTierId);

  const formatPrice = (cents: number, currency: string) => {
    if (cents === 0) return 'Free';
    return `${currency} ${(cents / 100).toFixed(2)}/mo`;
  };

  const validate = (): string | null => {
    if (!selectedTierId) return 'select-tier';
    const recipientValue = recipient.trim();
    if (!recipientValue) return 'no-recipient';
    if (!/\S+@\S+\.\S+/.test(recipientValue)) return 'bad-email';
    return null;
  };

  const handleGift = () => {
    const problem = validate();
    if (problem === 'select-tier') {
      Alert.alert('Select a tier', 'Please select a membership tier to gift.');
      return;
    }
    if (problem === 'no-recipient') {
      Alert.alert('Recipient required', 'Please enter the recipient’s email address.');
      return;
    }
    if (problem === 'bad-email') {
      Alert.alert('Invalid email', 'Please enter a valid email address for the recipient.');
      return;
    }
    // Free tier: nothing to pay, so skip straight to the same request a
    // paid tier makes with 'flutterwave' as a harmless default - the
    // backend never reads payment_provider for a free tier.
    if (!selectedTier || selectedTier.price_cents === 0) {
      void confirmGift('flutterwave');
      return;
    }
    setPaymentModal(true);
  };

  const confirmGift = async (provider: PaymentProvider) => {
    setPaymentModal(false);
    if (!selectedTierId) return;
    const recipientValue = recipient.trim();
    setLoading(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.membershipGift,
        {
          channel_id: channelId,
          tier_id: selectedTierId,
          recipient_email: recipientValue,
          message: message.trim() || undefined,
          payment_provider: provider,
        },
        { errorMessage: 'Could not send gift.' },
      );
      if (!res?.success) {
        Alert.alert('Error', res?.message ?? 'Could not send gift. Please try again.');
      } else if (res.data?.payment_required) {
        const url = res.data.payment_url || res.data.checkout_url;
        if (url) {
          const canOpen = await Linking.canOpenURL(url).catch(() => false);
          if (canOpen) {
            await Linking.openURL(url);
            Alert.alert(
              'Complete payment',
              'Finish payment in the browser to send the gift. If the recipient is a KIS member, they\'ll be notified in-app once payment is confirmed. Otherwise, you\'ll get a shareable gift link via notification to pass along.',
              [{ text: 'OK', onPress: handleClose }],
            );
          } else {
            Alert.alert('Payment required', `Please visit: ${url}`);
          }
        } else {
          Alert.alert('Error', 'Payment link unavailable. Please try again.');
        }
      } else {
        setShareLink(res.data?.share_link ?? null);
        setSuccess(true);
      }
    } catch {
      Alert.alert('Error', 'Could not send gift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setPaymentModal(false);
    setRecipient('');
    setMessage('');
    setShareLink(null);
    setSelectedTierId(tiers[0]?.id ?? null);
    onClose();
  };

  return (
    <>
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
              {shareLink ? (
                <>
                  <Text style={[styles.successSubtext, { color: palette.subtext }]}>
                    {recipient} isn't on KIS yet. Share this link with them to redeem the gift —
                    it's single-use and expires soon.
                  </Text>
                  <View style={[styles.linkBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <Text style={[styles.linkText, { color: palette.text }]} numberOfLines={1}>
                      {shareLink}
                    </Text>
                  </View>
                  <View style={styles.linkActionsRow}>
                    <Pressable
                      onPress={() => {
                        Clipboard.setString(shareLink);
                        Alert.alert('Copied', 'Gift link copied to clipboard.');
                      }}
                      style={[styles.linkActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
                    >
                      <Text style={[styles.linkActionText, { color: palette.text }]}>Copy Link</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Share.share({ message: shareLink }).catch(() => {});
                      }}
                      style={[styles.linkActionBtn, { backgroundColor: palette.primaryStrong }]}
                    >
                      <Text style={[styles.linkActionText, { color: palette.onPrimary }]}>Share</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.successSubtext, { color: palette.subtext }]}>
                  {recipient} has been notified in-app.
                </Text>
              )}
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
              {selectedTier && selectedTier.price_cents > 0 && (
                <View style={styles.paymentNote}>
                  <KISIcon name="lock" size={11} color={palette.subtext} />
                  <Text style={[styles.paymentNoteText, { color: palette.subtext }]}>
                    Pay via Flutterwave (Africa) or Stripe (card)
                  </Text>
                </View>
              )}

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

    {/* Payment provider picker for paid tiers - same pattern as
        MembershipScreen's own "Join" flow, so gifting a paid tier feels
        identical to joining one. A sibling Modal, not nested inside the
        one above, matching MembershipScreen's own two-sibling-Modals
        shape rather than one Modal inside another. */}
    <Modal
        visible={paymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModal(false)}
      >
        <Pressable style={styles.providerOverlay} onPress={() => setPaymentModal(false)}>
          <Pressable style={[styles.providerSheet, { backgroundColor: palette.card }]} onPress={() => {}}>
            <View style={[styles.providerHandle, { backgroundColor: palette.border }]} />
            <Text style={[styles.providerModalTitle, { color: palette.text }]}>Choose payment method</Text>
            {selectedTier && (
              <Text style={[styles.providerModalSub, { color: palette.subtext }]}>
                {selectedTier.title} — {formatPrice(selectedTier.price_cents, selectedTier.currency)}
              </Text>
            )}

            <Pressable
              style={[styles.providerBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
              onPress={() => confirmGift('flutterwave')}
            >
              <View style={styles.providerRow}>
                <View style={[styles.providerIcon, { backgroundColor: palette.gold }]}>
                  <Text style={[styles.providerIconText, { color: palette.royalInk }]}>FW</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: palette.text }]}>Flutterwave</Text>
                  <Text style={[styles.providerDesc, { color: palette.subtext }]}>
                    Mobile money, bank transfer, cards (Africa & more)
                  </Text>
                </View>
                <KISIcon name="arrow-left" size={16} color={palette.subtext} style={{ transform: [{ rotate: '180deg' }] }} />
              </View>
            </Pressable>

            <Pressable
              style={[styles.providerBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
              onPress={() => confirmGift('stripe')}
            >
              <View style={styles.providerRow}>
                <View style={[styles.providerIcon, { backgroundColor: palette.primaryStrong }]}>
                  <Text style={[styles.providerIconText, { color: palette.onPrimary }]}>S</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: palette.text }]}>Stripe</Text>
                  <Text style={[styles.providerDesc, { color: palette.subtext }]}>
                    International credit / debit card
                  </Text>
                </View>
                <KISIcon name="arrow-left" size={16} color={palette.subtext} style={{ transform: [{ rotate: '180deg' }] }} />
              </View>
            </Pressable>

            <Pressable onPress={() => setPaymentModal(false)} style={styles.providerCancelBtn}>
              <Text style={[styles.providerCancelText, { color: palette.subtext }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  linkBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: { fontSize: 12, fontWeight: '600' },
  linkActionsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  linkActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkActionText: { fontWeight: '800', fontSize: 13 },
  paymentNote: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4 },
  paymentNoteText: { fontSize: 11, fontWeight: '600' },
  providerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  providerSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36, gap: 12,
  },
  providerHandle: {
    width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4,
  },
  providerModalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  providerModalSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  providerBtn: {
    borderRadius: 14, borderWidth: 1.5, padding: 14,
  },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  providerIconText: { fontWeight: '900', fontSize: 13 },
  providerName: { fontSize: 15, fontWeight: '800' },
  providerDesc: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  providerCancelBtn: { alignItems: 'center', paddingVertical: 12 },
  providerCancelText: { fontSize: 15, fontWeight: '700' },
});
