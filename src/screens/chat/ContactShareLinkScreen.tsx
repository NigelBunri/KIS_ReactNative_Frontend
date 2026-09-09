import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

// PART 7 of the deep-links spec: a private, shareable "message me" link
// that never exposes the owner's phone number to whoever clicks it -
// see apps.chat.contact_links on the backend. Mirrors ReferralScreen's
// own code-card/share-button shape for a consistent "here's your link"
// pattern across the app, but simpler (no history/stats to show).

type LinkState = { token: string; is_active: boolean; invite_link: string | null };

export default function ContactShareLinkScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();

  const [link, setLink] = useState<LinkState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.contactLinks.me, { errorMessage: 'Unable to load your contact link.' });
      if (res?.success) {
        setLink(res.data ?? null);
      } else {
        setError('Unable to load your contact link.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load your contact link.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLink();
  }, [fetchLink]);

  const handleShare = useCallback(() => {
    if (!link?.invite_link) return;
    Share.share({
      message: `Message me on KIS: ${link.invite_link}`,
    }).catch(() => {});
  }, [link?.invite_link]);

  const handleRegenerate = useCallback(() => {
    Alert.alert(
      'Create a new link?',
      'Anyone who still has your old contact link will no longer be able to use it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create new link',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await postRequest(ROUTES.contactLinks.me, {}, { errorMessage: 'Unable to create a new link.' });
              if (res?.success) setLink(res.data ?? null);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, []);

  const handleTogglePause = useCallback(async () => {
    if (!link) return;
    setBusy(true);
    try {
      if (link.is_active) {
        const res = await deleteRequest(ROUTES.contactLinks.me, { errorMessage: 'Unable to pause your link.' });
        if (res?.success) setLink({ ...link, is_active: false });
      } else {
        // Reactivating is the same as regenerating (the backend's POST
        // handler always issues a fresh token, is_active=True - a paused
        // link's old token is treated as burned, matching the group/
        // community invite-link convention of "regenerate to get a
        // working link again").
        const regen = await postRequest(ROUTES.contactLinks.me, {}, { errorMessage: 'Unable to reactivate your link.' });
        if (regen?.success) setLink(regen.data ?? null);
      }
    } finally {
      setBusy(false);
    }
  }, [link]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>My contact link</Text>
        <View style={s.backBtn} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => void fetchLink()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.content}>
          <Text style={[s.explainer, { color: palette.subtext }]}>
            Share this link so someone can message you on KIS without ever seeing your phone number. Their message
            arrives as a request you can accept or decline.
          </Text>

          <View style={[s.codeCard, { backgroundColor: palette.primaryStrong }]}>
            <Text style={[s.codeLabel, { color: palette.ivory }]}>
              {link?.is_active ? 'Your contact link' : 'Your link is paused'}
            </Text>
            <Text style={[s.codeValue, { color: palette.onPrimary }]} numberOfLines={2}>
              {link?.invite_link ?? '—'}
            </Text>
            <Pressable
              disabled={!link?.is_active || busy}
              onPress={handleShare}
              style={[s.shareBtn, { backgroundColor: palette.onPrimary, opacity: !link?.is_active || busy ? 0.5 : 1 }]}
            >
              <Text style={[s.shareBtnText, { color: palette.primaryStrong }]}>Share link</Text>
            </Pressable>
          </View>

          <Pressable disabled={busy} onPress={handleTogglePause} style={[s.actionRow, { borderColor: palette.divider }]}>
            <Text style={[s.actionText, { color: palette.text }]}>
              {link?.is_active ? 'Pause my contact link' : 'Reactivate my contact link'}
            </Text>
          </Pressable>
          <Pressable disabled={busy} onPress={handleRegenerate} style={[s.actionRow, { borderColor: palette.divider }]}>
            <Text style={[s.actionText, { color: palette.danger }]}>Create a new link</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  explainer: { fontSize: 13, lineHeight: 19 },
  codeCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  codeLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  shareBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 10 },
  shareBtnText: { fontSize: 14, fontWeight: '800' },
  actionRow: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  actionText: { fontSize: 14, fontWeight: '700' },
});
