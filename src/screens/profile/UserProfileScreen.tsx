import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { queueableJsonRequest } from '@/services/offlineActionQueue';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import OfflineDataBadge from '@/components/offline/OfflineDataBadge';
import WorkStatusRing from '@/components/common/WorkStatusRing';
import {
  freshOfflineMeta,
  offlineStructuredCacheKey,
  readOfflineStructuredCache,
  writeOfflineStructuredCache,
  type OfflineCacheMeta,
} from '@/storage/offlineStructuredCache';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ViewProfile'>;
type RoutePropType = RouteProp<RootStackParamList, 'ViewProfile'>;

type ConnectionStatus = 'none' | 'pending' | 'connected';

const degreeLabel = (d: number | null | undefined): string | null =>
  d === 1 ? '1st' : d === 2 ? '2nd' : d === 3 ? '3rd' : null;

export default function UserProfileScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { userId, displayName } = route.params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [profileCacheMeta, setProfileCacheMeta] = useState<OfflineCacheMeta | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connecting, setConnecting] = useState(false);
  const [endorsingSkillId, setEndorsingSkillId] = useState<string | null>(null);
  const [endorsedSkillIds, setEndorsedSkillIds] = useState<Set<string>>(new Set());
  const [skillEndorseCounts, setSkillEndorseCounts] = useState<Record<string, number>>({});

  const styles = makeStyles(palette);

  const applyProfileData = useCallback((data: any, meta: OfflineCacheMeta | null) => {
    setProfile(data);
    setProfileCacheMeta(meta);
    const connStatus = data?.connection_status ?? data?.connectionStatus;
    if (connStatus === 'accepted' || connStatus === 'connected') {
      setConnectionStatus('connected');
    } else if (connStatus === 'pending') {
      setConnectionStatus('pending');
    } else {
      setConnectionStatus('none');
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const cacheKey = offlineStructuredCacheKey('profile', userId);
    setLoading(true);
    const cached = await readOfflineStructuredCache<any>(cacheKey);
    if (cached?.data) {
      applyProfileData(cached.data, cached.meta);
      setLoading(false);
    }
    try {
      // ROUTES.profiles.view expects a Profile id, not a User id (its
      // backend action is a plain DRF get_object() keyed on Profile's own
      // pk - see apps.accounts.views.ProfileViewSet.view) - but every
      // caller of this screen (post.author.id, channel member ids,
      // @mention ids, etc.) passes a User id in `userId`, which almost
      // never matches a Profile's own id and was showing "Profile not
      // available" for basically every "view profile" tap in the app.
      // Resolve the real profile id first, same as
      // useAuthorProfilePreview.ts already does correctly for the feed's
      // own author-preview sheet.
      const userRes = await getRequest(ROUTES.user.detail(userId), {
        errorMessage: 'Unable to load profile.',
      });
      const resolvedProfileId = String(
        userRes?.data?.profile?.id ??
          userRes?.data?.profile_id ??
          userRes?.data?.profileId ??
          '',
      ).trim() || userId;

      const res = await getRequest(ROUTES.profiles.view(resolvedProfileId), {
        errorMessage: 'Unable to load profile.',
        forceNetwork: true,
      });
      // Narrower than `res?.success || res?.data` — that guard let a
      // theoretical (success:true, data:falsy) response fall through to
      // `res?.data ?? res`, writing the wrapper itself into
      // applyProfileData AND persisting it to the offline cache below;
      // unlike an in-memory-only mistake, that corruption would survive
      // and get read back as "cached profile" on a future launch.
      if (res?.success && res?.data) {
        const data = res.data;
        applyProfileData(data, freshOfflineMeta);
        await writeOfflineStructuredCache(cacheKey, data);
      }
    } catch {
      if (!cached?.data) {
        Alert.alert('Error', 'Failed to load profile.');
      } else {
        setProfileCacheMeta(cached.meta);
      }
    } finally {
      setLoading(false);
    }
  }, [applyProfileData, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleEndorseSkill = useCallback(async (skill: any) => {
    const skillId = String(skill?.id ?? '');
    if (!skillId || endorsedSkillIds.has(skillId)) return;
    const profileId = profile?.profile_id ?? profile?.id ?? userId;
    setEndorsingSkillId(skillId);
    try {
      // queueableJsonRequest resolves { success: false, message } on a
      // genuine (non-retryable) backend failure rather than throwing — see
      // shouldQueueResult/executeAction in offlineActionQueue.ts, same
      // design as postRequest/patchRequest. This previously marked the
      // skill "Endorsed" and bumped the count unconditionally, even when
      // the server rejected the endorsement.
      const res = await queueableJsonRequest({
        domain: 'Profile',
        kind: 'profile.endorse_skill',
        method: 'POST',
        url: ROUTES.profiles.endorseSkill(profileId),
        body: { skill_id: skillId },
        dedupeKey: `profile:endorse:${profileId}:${skillId}`,
      });
      if (res?.success === false) {
        throw new Error(res?.message || 'Could not endorse skill.');
      }
      setEndorsedSkillIds(prev => new Set(prev).add(skillId));
      setSkillEndorseCounts(prev => ({
        ...prev,
        [skillId]: (prev[skillId] ?? skill?.endorsement_count ?? skill?.endorsements ?? 0) + 1,
      }));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not endorse skill.');
    } finally {
      setEndorsingSkillId(null);
    }
  }, [profile, userId, endorsedSkillIds]);

  const handleConnect = async () => {
    if (connectionStatus !== 'none') return;
    setConnecting(true);
    try {
      const res = await queueableJsonRequest({
        domain: 'Profile',
        kind: 'profile.connect',
        method: 'POST',
        url: ROUTES.connections.list,
        body: { user_id: userId },
        dedupeKey: `profile:connect:${userId}`,
      });
      if (res?.success || res?.data || res?.id) {
        const status = res?.data?.status ?? res?.status;
        if (status === 'accepted' || status === 'connected') {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('pending');
        }
      } else {
        Alert.alert('Error', res?.message ?? 'Could not send connection request.');
      }
    } catch {
      Alert.alert('Error', 'Could not send connection request.');
    } finally {
      setConnecting(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  const renderConnectButton = () => {
    if (connectionStatus === 'connected') {
      return (
        <View style={[styles.actionBtn, styles.actionBtnConnected]}>
          <Text style={[styles.actionBtnText, { color: palette.primary }]}>Connected</Text>
        </View>
      );
    }
    if (connectionStatus === 'pending') {
      return (
        <View style={[styles.actionBtn, styles.actionBtnPending]}>
          <Text style={[styles.actionBtnText, { color: palette.subtext }]}>Pending</Text>
        </View>
      );
    }
    return (
      <Pressable
        style={[styles.actionBtn, styles.actionBtnPrimary]}
        onPress={handleConnect}
        disabled={connecting}
      >
        {connecting ? (
          <ActivityIndicator size="small" color={palette.bg} />
        ) : (
          <Text style={[styles.actionBtnText, { color: palette.bg }]}>Connect</Text>
        )}
      </Pressable>
    );
  };

  // apps.accounts.views._build_profile_payload (the backend of
  // ROUTES.profiles.view, the only loader for this screen's `profile`
  // state) nests these under `sections.*` and `profile.*`/`user.*`, not
  // flat on the response root the way every field below used to assume -
  // every field here (skills/experiences/educations, and the whole
  // identity block further down: avatar, name, headline, industry, bio,
  // open_to_work) was silently reading `undefined` off the real payload.
  // useAuthorProfilePreview.ts's mergeProfilePayload already reads the
  // correct nested shape for this exact endpoint - this screen just never
  // did. Keeping the old flat keys as a fallback is harmless (they're
  // simply never present on the real response) and costs nothing.
  const skills: any[] = profile?.sections?.skills ?? profile?.skills ?? [];
  const experiences: any[] = profile?.sections?.experiences ?? profile?.experiences ?? profile?.experience ?? [];
  const educations: any[] = profile?.sections?.educations ?? profile?.educations ?? profile?.education ?? [];
  const profileUser: any = profile?.user ?? {};
  const profileDetail: any = profile?.profile ?? {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {displayName ?? 'Profile'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={{ color: palette.subtext }}>Profile not available.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <OfflineDataBadge meta={profileCacheMeta} />
          {/* Cover area */}
          <View style={[styles.coverArea, { backgroundColor: palette.surface }]} />

          {/* Avatar + name block */}
          <View style={styles.identityBlock}>
            <WorkStatusRing
              size={80}
              workStatus={profileDetail?.work_status}
              onHiringPress={
                profileDetail?.hiring_job_listing_id
                  ? () => navigation.navigate('JobDetail', { jobId: profileDetail.hiring_job_listing_id })
                  : undefined
              }
            >
              {profileDetail?.avatar_url ?? profile?.avatar_url ? (
                <PermanentRemoteImage
                  uri={profileDetail?.avatar_url ?? profile.avatar_url}
                  domain="Profile"
                  stableKey={`profile_avatar_${userId}_${profileDetail?.avatar_url ?? profile.avatar_url}`}
                  containerStyle={[styles.avatarCircle, { borderColor: palette.bg }]}
                />
              ) : (
                <View style={[styles.avatarCircle, { backgroundColor: palette.primary, borderColor: palette.bg }]}>
                  <Text style={[styles.avatarInitials, { color: palette.bg }]}>
                    {getInitials(profileUser?.display_name ?? profile?.display_name ?? displayName)}
                  </Text>
                </View>
              )}
            </WorkStatusRing>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Text style={[styles.displayName, { color: palette.text }]}>
                {profileUser?.display_name ?? profile?.display_name ?? displayName ?? 'Member'}
              </Text>
              {degreeLabel(profile?.connection_degree) !== null && (
                <View style={[degreeStyles.chip, {
                  backgroundColor: profile?.connection_degree === 1 ? (palette.success) : profile?.connection_degree === 2 ? (palette.primary) : (palette.subtext),
                }]}>
                  <Text style={[degreeStyles.chipText, { color: palette.onPrimary }]}>{degreeLabel(profile?.connection_degree)}</Text>
                </View>
              )}
            </View>

            {(profile?.connection_count ?? 0) > 0 && (
              <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center' }}>
                {profile.connection_count} connection{profile.connection_count !== 1 ? 's' : ''}
              </Text>
            )}

            {!!(profileDetail?.headline ?? profile?.headline) && (
              <Text style={[styles.headline, { color: palette.subtext }]} numberOfLines={2}>
                {profileDetail?.headline ?? profile.headline}
              </Text>
            )}

            {!!(profileDetail?.industry ?? profile?.industry) && (
              <View style={[styles.industryBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.industryText, { color: palette.primary }]}>{profileDetail?.industry ?? profile.industry}</Text>
              </View>
            )}

            {(profileDetail?.open_to_work ?? profile?.open_to_work) === true && (
              <View style={[styles.openToWorkBanner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.openToWorkText, { color: palette.text }]}>🟢 Open to Work</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            {renderConnectButton()}
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: palette.border }]}
              onPress={() => {
                DeviceEventEmitter.emit('chat.open', {
                  userId: userId,
                  name: profileUser?.display_name ?? profile?.display_name ?? displayName ?? '',
                  kind: 'dm',
                });
              }}
            >
              <Text style={[styles.actionBtnText, { color: palette.text }]}>Message</Text>
            </Pressable>
          </View>

          {/* Bio */}
          {!!(profileDetail?.bio ?? profile?.bio) && (
            <>
              <View style={[styles.divider, { backgroundColor: palette.divider }]} />
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>About</Text>
                <Text style={[styles.bioText, { color: palette.subtext }]}>{profileDetail?.bio ?? profile.bio}</Text>
              </View>
            </>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: palette.divider }]} />
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Skills</Text>
                {skills.map((skill: any, idx: number) => {
                  const skillId = String(skill?.id ?? idx);
                  const alreadyEndorsed = endorsedSkillIds.has(skillId);
                  const isEndorsing = endorsingSkillId === skillId;
                  const baseCount = skill?.endorsement_count ?? skill?.endorsements ?? 0;
                  const count = skillEndorseCounts[skillId] ?? baseCount;
                  return (
                    <View key={skillId} style={[styles.listRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listItemTitle, { color: palette.text }]}>
                          {skill?.name ?? skill?.skill_name ?? String(skill)}
                        </Text>
                        <Text style={[styles.listItemMeta, { color: palette.subtext }]}>
                          {count} endorsement{count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Pressable
                        style={[
                          styles.endorseBtn,
                          {
                            backgroundColor: alreadyEndorsed ? palette.surface : palette.primary,
                            borderColor: palette.border,
                          },
                        ]}
                        onPress={() => handleEndorseSkill(skill)}
                        disabled={alreadyEndorsed || isEndorsing}
                      >
                        {isEndorsing ? (
                          <ActivityIndicator size="small" color={palette.onPrimary} />
                        ) : (
                          <Text style={{ color: alreadyEndorsed ? palette.subtext : (palette.onPrimary), fontSize: 12, fontWeight: '600' }}>
                            {alreadyEndorsed ? 'Endorsed' : 'Endorse'}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Experience */}
          {experiences.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: palette.divider }]} />
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Experience</Text>
                {experiences.map((exp: any, idx: number) => (
                  <View key={exp?.id ?? idx} style={styles.listRow}>
                    <Text style={[styles.listItemTitle, { color: palette.text }]}>
                      {exp?.title ?? exp?.role ?? exp?.position ?? ''}
                    </Text>
                    {!!exp?.description && (
                      <Text style={[styles.listItemDesc, { color: palette.subtext }]}>{exp.description}</Text>
                    )}
                    {(exp?.start_date ?? exp?.startDate) && (
                      <Text style={[styles.listItemMeta, { color: palette.subtext }]}>
                        {exp?.start_date ?? exp?.startDate}
                        {(exp?.end_date ?? exp?.endDate) ? ` – ${exp?.end_date ?? exp?.endDate}` : ' – Present'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Education */}
          {educations.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: palette.divider }]} />
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Education</Text>
                {educations.map((edu: any, idx: number) => (
                  <View key={edu?.id ?? idx} style={styles.listRow}>
                    <Text style={[styles.listItemTitle, { color: palette.text }]}>
                      {edu?.school ?? edu?.institution ?? edu?.name ?? ''}
                    </Text>
                    {!!edu?.description && (
                      <Text style={[styles.listItemDesc, { color: palette.subtext }]}>{edu.description}</Text>
                    )}
                    {(edu?.start_date ?? edu?.startDate) && (
                      <Text style={[styles.listItemMeta, { color: palette.subtext }]}>
                        {edu?.start_date ?? edu?.startDate}
                        {(edu?.end_date ?? edu?.endDate) ? ` – ${edu?.end_date ?? edu?.endDate}` : ''}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
      backgroundColor: palette.bg,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingBottom: 24,
    },
    coverArea: {
      height: 100,
      width: '100%',
    },
    identityBlock: {
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: -40,
      gap: 6,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
    },
    avatarInitials: {
      fontSize: 28,
      fontWeight: '800',
    },
    displayName: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'center',
    },
    headline: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    industryBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 4,
    },
    industryText: {
      fontSize: 12,
      fontWeight: '600',
    },
    openToWorkBanner: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 4,
    },
    openToWorkText: {
      fontSize: 13,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      marginTop: 16,
      justifyContent: 'center',
    },
    actionBtn: {
      minWidth: 120,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnPrimary: {
      backgroundColor: palette.primary,
    },
    actionBtnSecondary: {
      borderWidth: 1,
    },
    actionBtnConnected: {
      borderWidth: 1,
      borderColor: palette.primary,
    },
    actionBtnPending: {
      borderWidth: 1,
      borderColor: palette.border,
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 16,
      marginHorizontal: 0,
    },
    section: {
      paddingHorizontal: 20,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    bioText: {
      fontSize: 14,
      lineHeight: 22,
    },
    listRow: {
      gap: 3,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    listItemTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    listItemDesc: {
      fontSize: 13,
      lineHeight: 19,
    },
    listItemMeta: {
      fontSize: 12,
    },
    endorseBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
      minHeight: 44,
    },
  });
}

const degreeStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
