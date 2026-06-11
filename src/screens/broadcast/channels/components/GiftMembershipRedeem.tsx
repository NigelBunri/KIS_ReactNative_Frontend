// src/screens/broadcast/channels/components/GiftMembershipRedeem.tsx
//
// Redeem a gifted membership using a token.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type RedeemResult = {
  tier_title?: string;
  channel_name?: string;
  expires_at?: string;
};

type Props = {
  token?: string;
  onSuccess: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GiftMembershipRedeem({ token: initialToken, onSuccess }: Props) {
  const { palette } = useKISTheme();
  const [token, setToken] = useState(initialToken ?? '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-redeem if token is pre-filled
  useEffect(() => {
    if (initialToken?.trim()) {
      void handleRedeem(initialToken.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  const handleRedeem = async (t?: string) => {
    const tok = (t ?? token).trim();
    if (!tok) {
      setErrorMsg('Please enter a gift token.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.membershipGiftRedeem(tok),
        {},
        { errorMessage: '' },
      );
      if (res?.data || res?.success || res?.tier_title) {
        setResult(res?.data ?? res ?? {});
        setSuccess(true);
        onSuccess();
      } else {
        const msg: string = res?.message ?? res?.detail ?? '';
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('expire')) {
          setErrorMsg('This gift has expired.');
        } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('not found')) {
          setErrorMsg('Invalid code. Please check and try again.');
        } else {
          setErrorMsg(msg || 'Could not redeem this gift. Please try again.');
        }
      }
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (msg.toLowerCase().includes('expired')) {
        setErrorMsg('This gift has expired.');
      } else {
        setErrorMsg('Invalid code. Please check and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success && result) {
    return (
      <View style={[styles.container, { backgroundColor: palette.surface }]}>
        <View style={[styles.successCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={[styles.successTitle, { color: palette.text }]}>
            Membership activated!
          </Text>
          {result.tier_title ? (
            <Text style={[styles.successDetail, { color: palette.subtext }]}>
              Plan: {result.tier_title}
            </Text>
          ) : null}
          {result.channel_name ? (
            <Text style={[styles.successDetail, { color: palette.subtext }]}>
              Channel: {result.channel_name}
            </Text>
          ) : null}
          {result.expires_at ? (
            <Text style={[styles.successDetail, { color: palette.subtext }]}>
              Expires: {new Date(result.expires_at).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Redeem Gift Membership</Text>
        <Text style={[styles.cardSubtext, { color: palette.subtext }]}>
          Enter the gift token you received to activate your membership.
        </Text>

        <TextInput
          value={token}
          onChangeText={text => {
            setToken(text);
            setErrorMsg(null);
          }}
          placeholder="Enter gift token"
          placeholderTextColor={palette.subtext}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: palette.text, borderColor: errorMsg ? '#EF4444' : palette.border }]}
        />

        {errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : null}

        <Pressable
          onPress={() => handleRedeem()}
          disabled={loading || !token.trim()}
          style={[
            styles.redeemBtn,
            {
              backgroundColor:
                token.trim() && !loading ? palette.primaryStrong : (palette.surfaceElevated ?? palette.border),
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.redeemBtnText}>Redeem Gift</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  cardSubtext: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  redeemBtn: {
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  redeemBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  successCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  successEmoji: { fontSize: 56 },
  successTitle: { fontSize: 20, fontWeight: '900' },
  successDetail: { fontSize: 13, fontWeight: '600' },
});
