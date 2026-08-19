import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteCustomDomain'>;

type DomainState = {
  custom_domain: string | null;
  status: 'none' | 'pending' | 'active' | 'failed';
  enabled: boolean;
  cname_target: string | null;
  txt_record: { name: string; value: string } | null;
};

function DnsRow({ label, value, palette, typography, spacing }: { label: string; value: string; palette: any; typography: any; spacing: any }) {
  return (
    <View style={{ marginTop: spacing.xs }}>
      <Text style={{ ...typography.caption, color: palette.subtext }}>{label}</Text>
      <Text style={{ ...typography.body, color: palette.text }} selectable>{value}</Text>
    </View>
  );
}

export default function WebsiteCustomDomainScreen({ route }: Props) {
  const { websiteId } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DomainState | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.customDomain(websiteId));
      const data = (res as any)?.data ?? res;
      setState(data && typeof data === 'object' ? data : null);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handleConnect = useCallback(async () => {
    setSaving(true);
    try {
      const res = await postRequest(
        ROUTES.websites.customDomain(websiteId),
        { custom_domain: domainInput.trim() },
        { errorMessage: 'Unable to connect this domain.' },
      );
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to connect this domain.');
      setDomainInput('');
      await load();
    } catch (error: any) {
      Alert.alert('Custom Domain', error?.message || 'Unable to connect this domain.');
    } finally {
      setSaving(false);
    }
  }, [websiteId, domainInput, load]);

  const handleDisconnect = useCallback(() => {
    Alert.alert('Disconnect domain', `Disconnect ${state?.custom_domain}? Your site will only be reachable at its kingdomimpactventures.org address.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.websites.customDomain(websiteId), { errorMessage: 'Unable to disconnect this domain.' });
          await load();
        },
      },
    ]);
  }, [websiteId, state, load]);

  if (loading || !state) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accentPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Custom Domain</Text>

        {!state.enabled ? (
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>
            Custom domains aren't available on this deployment yet.
          </Text>
        ) : !state.custom_domain ? (
          <>
            <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
              Connect your own domain (e.g. www.yourbrand.com) to this website.
            </Text>
            <KISTextInput
              label="Domain"
              placeholder="www.yourbrand.com"
              value={domainInput}
              onChangeText={setDomainInput}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ marginTop: spacing.md }}
            />
            <View style={{ marginTop: spacing.sm }}>
              <KISButton title="Connect Domain" onPress={handleConnect} disabled={saving || !domainInput.trim()} />
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                marginTop: spacing.md, borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider,
                backgroundColor: palette.card, padding: spacing.sm,
              }}
            >
              <Text style={{ ...typography.label, color: palette.text }}>{state.custom_domain}</Text>
              <Text style={{ ...typography.caption, color: state.status === 'active' ? palette.accentPrimary : palette.subtext, marginTop: 2 }}>
                {state.status === 'active' ? 'Active' : state.status === 'failed' ? 'Verification failed' : 'Pending verification'}
              </Text>
            </View>

            {state.status !== 'active' && state.cname_target && state.txt_record ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ ...typography.h3, color: palette.text }}>Add these DNS records</Text>
                <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
                  At your domain's DNS provider, add both records below. Verification can take a few minutes to a few hours.
                </Text>
                <DnsRow label="CNAME → target" value={state.cname_target} palette={palette} typography={typography} spacing={spacing} />
                <DnsRow label="TXT record name" value={state.txt_record.name} palette={palette} typography={typography} spacing={spacing} />
                <DnsRow label="TXT record value" value={state.txt_record.value} palette={palette} typography={typography} spacing={spacing} />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <KISButton title="Refresh Status" variant="outline" onPress={load} />
              <KISButton title="Disconnect" variant="outline" onPress={handleDisconnect} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
