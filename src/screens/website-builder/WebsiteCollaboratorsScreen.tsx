import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteCollaborators'>;

type Collaborator = { id: string; user_name: string; role: string; created_at: string };
type Invite = { id: string; code: string; role: string; max_uses: number | null; use_count: number; is_active: boolean; is_redeemable: boolean };

export default function WebsiteCollaboratorsScreen({ route }: Props) {
  const { websiteId } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [collabRes, inviteRes] = await Promise.all([
        getRequest(ROUTES.websites.collaborators(websiteId)),
        getRequest(ROUTES.websites.invites(websiteId)),
      ]);
      if (collabRes?.success === false || inviteRes?.success === false) {
        setForbidden(true);
        return;
      }
      const collabData = (collabRes as any)?.data ?? collabRes;
      const inviteData = (inviteRes as any)?.data ?? inviteRes;
      setCollaborators(Array.isArray(collabData) ? collabData : []);
      setInvites(Array.isArray(inviteData) ? inviteData : []);
    } catch {
      setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handleCreateInvite = useCallback(async (role: 'editor' | 'owner') => {
    setCreatingInvite(true);
    try {
      const res = await postRequest(ROUTES.websites.invites(websiteId), { role }, { errorMessage: 'Unable to create invite.' });
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to create invite.');
      await load();
    } catch (error: any) {
      Alert.alert('Invites', error?.message || 'Unable to create invite.');
    } finally {
      setCreatingInvite(false);
    }
  }, [websiteId, load]);

  const handleShareInvite = useCallback(async (invite: Invite) => {
    try {
      await Share.share({ message: `Join my KIS website as ${invite.role}. Use invite code: ${invite.code}` });
    } catch {
      // dismissed
    }
  }, []);

  const handleRevokeInvite = useCallback((invite: Invite) => {
    Alert.alert('Revoke invite', `Revoke invite code ${invite.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await postRequest(ROUTES.websites.inviteRevoke(websiteId, invite.id), {}, { errorMessage: 'Unable to revoke invite.' });
          await load();
        },
      },
    ]);
  }, [websiteId, load]);

  const handleRemoveCollaborator = useCallback((collaborator: Collaborator) => {
    Alert.alert('Remove collaborator', `Remove ${collaborator.user_name} from this website?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.websites.collaboratorDetail(websiteId, collaborator.id), { errorMessage: 'Unable to remove collaborator.' });
          await load();
        },
      },
    ]);
  }, [websiteId, load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accentPrimary} />
      </SafeAreaView>
    );
  }

  if (forbidden) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.md }}>
        <Text style={{ ...typography.body, color: palette.subtext, textAlign: 'center' }}>
          Only the website owner can manage collaborators and invites.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Collaborators</Text>

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Current Team</Text>
        {collaborators.length === 0 ? (
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>Just you so far.</Text>
        ) : (
          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            {collaborators.map((c) => (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider,
                  backgroundColor: palette.card, padding: spacing.sm,
                }}
              >
                <View>
                  <Text style={{ ...typography.label, color: palette.text }}>{c.user_name}</Text>
                  <Text style={{ ...typography.caption, color: palette.subtext }}>{c.role}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveCollaborator(c)}>
                  <Text style={{ ...typography.label, color: '#B42318' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Invite Codes</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <KISButton title="New Editor Invite" size="sm" onPress={() => handleCreateInvite('editor')} disabled={creatingInvite} />
          <KISButton title="New Co-Owner Invite" size="sm" variant="outline" onPress={() => handleCreateInvite('owner')} disabled={creatingInvite} />
        </View>
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          {invites.map((invite) => (
            <View
              key={invite.id}
              style={{
                borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider,
                backgroundColor: palette.card, padding: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...typography.label, color: palette.text }}>{invite.code}</Text>
                <Text style={{ ...typography.caption, color: invite.is_redeemable ? palette.accentPrimary : palette.subtext }}>
                  {invite.is_redeemable ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
                {invite.role} · used {invite.use_count}{invite.max_uses ? `/${invite.max_uses}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <TouchableOpacity onPress={() => handleShareInvite(invite)}>
                  <Text style={{ ...typography.label, color: palette.accentPrimary }}>Share</Text>
                </TouchableOpacity>
                {invite.is_active ? (
                  <TouchableOpacity onPress={() => handleRevokeInvite(invite)}>
                    <Text style={{ ...typography.label, color: '#B42318' }}>Revoke</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
