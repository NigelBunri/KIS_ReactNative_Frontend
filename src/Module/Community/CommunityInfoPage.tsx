import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import apiService from '@/services/apiService';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';

type MemberUser = {
  id?: string;
  display_name?: string | null;
  username?: string | null;
  phone?: string | null;
};

type CommunityMember = {
  id?: number | string;
  user?: MemberUser | number | string | null;
  base_role?: string;
  display_name?: string;
};

type CommunityInfoPageProps = {
  communityId: string;
  communityName: string;
  currentUserId: string | null;
  onBack: () => void;
};

const resolveUserName = (user?: MemberUser | number | string | null) => {
  if (!user) return '';
  if (typeof user === 'string' || typeof user === 'number') return String(user);
  return (
    user.display_name ||
    user.username ||
    user.phone ||
    user.id ||
    ''
  );
};

const resolveUserPhone = (user?: MemberUser | number | string | null) => {
  if (!user || typeof user === 'string' || typeof user === 'number') return '';
  return user.phone || '';
};

export const CommunityInfoPage: React.FC<CommunityInfoPageProps> = ({
  communityId,
  communityName,
  currentUserId,
  onBack,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadCommunity = async () => {
      setLoading(true);
      try {
        const detail = await getRequest(ROUTES.community.detail(communityId), {
          errorMessage: 'Failed to load community',
        });
        const detailData = detail?.data ?? detail ?? {};
        if (mounted) {
          setAvatarUrl(detailData.avatar_url ?? detailData.avatarUrl ?? undefined);
          setDescription(detailData.description ?? '');
        }

        const membersRes = await getRequest(ROUTES.community.members(communityId), {
          errorMessage: 'Failed to load members',
        });
        const list =
          membersRes?.data?.results ??
          membersRes?.results ??
          membersRes?.data ??
          membersRes ??
          [];
        if (mounted) {
          setMembers(Array.isArray(list) ? list : []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadCommunity();
    return () => {
      mounted = false;
    };
  }, [communityId]);

  const me = useMemo(() => {
    if (!currentUserId) return null;
    return members.find((m) => {
      const u = m.user;
      if (typeof u === 'object' && u && u.id) return String(u.id) === String(currentUserId);
      return false;
    }) ?? null;
  }, [members, currentUserId]);

  const role = String(me?.base_role ?? '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin' || role === 'moderator';

  const handleChangeAvatar = async () => {
    if (!isAdmin || saving) return;
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (picked.didCancel) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('No image selected', 'Please pick a valid image.');
      return;
    }

    const token = await getAccessToken();
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!token) {
      Alert.alert('Not signed in', 'Please log in again.');
      return;
    }

    const file = {
      uri: asset.uri,
      name: asset.fileName ?? 'community-avatar.jpg',
      type: asset.type ?? 'image/jpeg',
      size: asset.fileSize ?? undefined,
    };

    try {
      setSaving(true);
      const uploaded = await uploadFileToBackend({
        file,
        authToken: token,
        baseUrl: CHAT_BASE_URL,
      });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (deviceId) headers['X-Device-Id'] = deviceId;

      const res = await apiService.patch(
        ROUTES.community.detail(communityId),
        { avatar_url: uploaded.url },
        headers
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.detail || data?.message || 'Unable to update community photo.'
        );
      }

      const nextAvatar = data?.avatar_url ?? uploaded.url;
      setAvatarUrl(nextAvatar);
    } catch (err: any) {
      Alert.alert(
        'Update failed',
        err?.message || 'Unable to update the community photo.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          Community info
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <ImagePlaceholder size={88} radius={44} style={styles.avatar} />
          )}
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {communityName}
          </Text>
          {description ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          {isAdmin && (
            <Pressable
              onPress={handleChangeAvatar}
              style={({ pressed }) => [
                styles.editButton,
                {
                  backgroundColor: palette.primary ?? '#2E7D32',
                  opacity: pressed || saving ? 0.7 : 1,
                },
              ]}
            >
              <KISIcon name="camera" size={16} color={palette.onPrimary ?? '#fff'} />
              <Text style={[styles.editButtonText, { color: palette.onPrimary ?? '#fff' }]}>
                {saving ? 'Updating...' : 'Change community photo'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Members
          </Text>
          {loading ? (
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              Loading members...
            </Text>
          ) : members.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No members found.
            </Text>
          ) : (
            members.map((m, index) => {
              const label = m.display_name || resolveUserName(m.user) || 'Member';
              const phone = resolveUserPhone(m.user);
              const roleLabel = m.base_role ? String(m.base_role) : '';
              return (
                <View
                  key={`${typeof m.user === 'object' && m.user ? m.user.id : index}`}
                  style={[styles.memberRow, { borderBottomColor: palette.divider }]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: palette.surfaceSoft ?? palette.surface }]} />
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={[styles.memberRole, { color: palette.subtext }]} numberOfLines={1}>
                      {phone || 'No phone'}{roleLabel ? ` • ${roleLabel}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 10, fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  editButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButtonText: { fontSize: 12, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18 },
  memberInfo: { marginLeft: 10, flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberRole: { fontSize: 12 },
});

export default CommunityInfoPage;
