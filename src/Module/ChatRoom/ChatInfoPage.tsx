import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '../../theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import type { Chat, ParticipantWire, UserWire } from './messagesUtils';
import { directConversationAvatar } from './messagesUtils';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import apiService from '@/services/apiService';
import { uploadFileToBackend } from './uploadFileToBackend';
import Skeleton from '@/components/common/Skeleton';
import { getAccessToken } from '@/security/authStorage';

type ChatInfoPageProps = {
  chat: Chat;
  currentUserId: string | null;
  onBack: () => void;
  onChatUpdated?: (chat: Chat) => void;
};

const resolveUserId = (user?: UserWire | number | string | null) => {
  if (!user) return null;
  if (typeof user === 'string' || typeof user === 'number') {
    return String(user);
  }
  return user.id ? String(user.id) : null;
};

const resolveUserName = (user?: UserWire | number | string | null) => {
  if (!user) return '';
  if (typeof user === 'string' || typeof user === 'number') {
    return String(user);
  }
  return (
    user.display_name ||
    user.username ||
    user.phone ||
    user.id ||
    ''
  );
};

const resolveUserPhone = (user?: UserWire | number | string | null) => {
  if (!user || typeof user === 'string' || typeof user === 'number') return '';
  return user.phone || '';
};

export const ChatInfoPage: React.FC<ChatInfoPageProps> = ({
  chat,
  currentUserId,
  onBack,
  onChatUpdated,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    chat.avatarUrl ||
      directConversationAvatar(chat.participants ?? [], currentUserId ?? undefined) ||
      undefined,
  );
  const [saving, setSaving] = useState(false);
  const [memberList, setMemberList] = useState<ParticipantWire[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [publicProfile, setPublicProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [statusHas, setStatusHas] = useState(false);
  const [statusHasUnseen, setStatusHasUnseen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ uri: string } | null>(null);
  const [avatarPreviewFull, setAvatarPreviewFull] = useState(false);
  const avatarAnim = useMemo(() => new Animated.Value(0), []);

  const isGroup =
    chat.isGroupChat || chat.isGroup || chat.kind === 'group';

  console.log('ChatInfoPage rendered for chat:', chat);

  const participants = useMemo(() => {
    if (!Array.isArray(chat.participants)) return [];
    return chat.participants as ParticipantWire[];
  }, [chat.participants]);

  const groupId = chat.groupId ? String(chat.groupId) : null;
  const directContact = useMemo(() => {
    if (isGroup) return null;
    const meId = currentUserId ? String(currentUserId) : null;
    const other = participants.find((p) => {
      const userId = resolveUserId(p.user);
      return !meId || (userId && userId !== meId);
    });
    return other ?? null;
  }, [participants, isGroup, currentUserId]);

  const contactUserId = useMemo(() => {
    if (!directContact?.user) return null;
    return resolveUserId(directContact.user);
  }, [directContact]);

  useEffect(() => {
    const nextAvatar = chat.avatarUrl ? String(chat.avatarUrl) : '';
    if (nextAvatar.trim()) {
      setAvatarUrl(nextAvatar);
    }
  }, [chat.avatarUrl]);

  useEffect(() => {
    if (isGroup || !contactUserId) return;
    let active = true;
    const loadStatusSummary = async () => {
      try {
        const res = await getRequest(`${ROUTES.statuses.list}?userIds=${contactUserId}`);
        const list = Array.isArray(res?.data?.results) ? res.data.results : [];
        const entry = list.find((item: any) => String(item?.user?.id ?? '') === String(contactUserId));
        if (!active) return;
        const items = Array.isArray(entry?.items) ? entry.items : [];
        const hasStatus = items.length > 0;
        const hasUnseen =
          typeof entry?.has_unseen === 'boolean'
            ? entry.has_unseen
            : items.some((item: any) => !item.viewed);
        setStatusHas(hasStatus);
        setStatusHasUnseen(hasStatus ? hasUnseen : false);
      } catch {
        if (!active) return;
        setStatusHas(false);
        setStatusHasUnseen(false);
      }
    };
    loadStatusSummary();
    return () => {
      active = false;
    };
  }, [isGroup, contactUserId]);

  useEffect(() => {
    if (!avatarPreview) return;
    avatarAnim.setValue(0);
    Animated.timing(avatarAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [avatarPreview, avatarAnim]);

  useEffect(() => {
    if (isGroup) return;
    if (avatarUrl && String(avatarUrl).trim()) return;
    const nextAvatar =
      (directContact?.user as any)?.profile?.avatar_url ??
      (directContact?.user as any)?.profile?.avatarUrl ??
      (directContact?.user as any)?.avatar_url ??
      (directContact?.user as any)?.avatarUrl ??
      directConversationAvatar(chat.participants ?? [], currentUserId ?? undefined);
    if (nextAvatar) {
      setAvatarUrl(String(nextAvatar));
    }
  }, [isGroup, directContact, avatarUrl, chat.participants, currentUserId]);

  useEffect(() => {
    let active = true;
    const loadMembers = async () => {
      if (!isGroup || !groupId) return;
      setMembersLoading(true);
      try {
        const res = await getRequest(ROUTES.groups.members(groupId), {
          errorMessage: 'Failed to load group members',
        });
        const list =
          res?.data?.results ??
          res?.results ??
          res?.data ??
          res ??
          [];
        if (active) {
          setMemberList(Array.isArray(list) ? list : []);
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [isGroup, groupId]);

  const me = useMemo(() => {
    const meId = currentUserId ? String(currentUserId) : null;
    if (!meId) return null;
    return participants.find((p) => {
      const userId = resolveUserId(p.user);
      return userId && userId === meId;
    }) ?? null;
  }, [participants, currentUserId]);

  const role = String(me?.base_role ?? '').toLowerCase();
  const isAdmin =
    role === 'owner' || role === 'admin' || role === 'moderator';

  const handleChangeAvatar = async () => {
    if (!isGroup || !isAdmin) return;
    if (saving) return;
    const groupId = chat.groupId ? String(chat.groupId) : null;
    if (!groupId) {
      Alert.alert('Missing group', 'This group is missing an id.');
      return;
    }

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
      name: asset.fileName ?? 'group-avatar.jpg',
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
        ROUTES.groups.detail(groupId),
        { avatar_url: uploaded.url },
        headers
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.detail || data?.message || 'Unable to update group photo.'
        );
      }

      const nextAvatar = data?.avatar_url ?? uploaded.url;
      setAvatarUrl(nextAvatar);
      onChatUpdated?.({ ...chat, avatarUrl: nextAvatar });
    } catch (err: any) {
      Alert.alert(
        'Update failed',
        err?.message || 'Unable to update the group photo.'
      );
    } finally {
      setSaving(false);
    }
  };

  const groupMembers = memberList.length ? memberList : participants;
  const memberCount = groupMembers.length || 0;
  const infoTitle = isGroup ? 'Group info' : 'Contact info';

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (isGroup || !contactUserId) return;
      setProfileLoading(true);
      try {
        const res = await getRequest(ROUTES.profiles.view(contactUserId), {
          errorMessage: 'Failed to load profile',
        });
        if (active) {
          const payload = res?.data ?? null;
          setPublicProfile(payload);
          const nextAvatar = payload?.profile?.avatar_url;
          if (nextAvatar && (!chat.avatarUrl || !String(chat.avatarUrl).trim())) {
            setAvatarUrl(nextAvatar);
            onChatUpdated?.({ ...chat, avatarUrl: nextAvatar });
          }
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [isGroup, contactUserId, chat, onChatUpdated]);

  const contactUser = publicProfile?.user ?? null;
  const fallbackContactName =
    directContact?.display_name ||
    resolveUserName(directContact?.user) ||
    chat.name;
  const contactName = contactUser?.display_name || fallbackContactName;
  const hasPublicContact = Boolean(publicProfile?.user);
  const contactPhoneValue = hasPublicContact
    ? contactUser?.phone ?? 'Hidden by privacy'
    : resolveUserPhone(directContact?.user) || '—';
  const contactEmailValue = hasPublicContact
    ? contactUser?.email ?? 'Hidden by privacy'
    : (directContact?.user as any)?.email || '—';


  const profileSections = publicProfile?.sections ?? {};
  const experienceItems = profileSections.experiences ?? [];
  const educationItems = profileSections.educations ?? [];
  const projectItems = profileSections.projects ?? [];
  const skillItems = profileSections.skills ?? [];
  const recommendationItems = profileSections.recommendations ?? [];
  const articleItems = profileSections.articles ?? [];
  const activityItems = profileSections.activity ?? [];
  const serviceItems = publicProfile?.preferences?.services ?? [];
  const highlightItems = publicProfile?.preferences?.highlights ?? [];
  const showcaseSections = profileSections.showcases ?? {};
  const portfolioItems = showcaseSections.portfolio ?? [];
  const caseStudyItems = showcaseSections.case_study ?? [];
  const testimonialItems = showcaseSections.testimonial ?? [];
  const certificationItems = showcaseSections.certification ?? [];
  const introVideoItems = showcaseSections.intro_video ?? [];

  const getShowcaseLink = (item: any) => item?.payload?.url || item?.file_url;
  const openShowcaseLink = (item: any) => {
    const url = getShowcaseLink(item);
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const renderSummaryList = (
    title: string,
    items: any[],
    getPrimary: (item: any) => string,
    getSecondary?: (item: any) => string | null,
  ) => {
    if (!items?.length) return null;
    const limited = items.slice(0, 3);
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          {limited.map((item, index) => (
            <View
              key={`${title}-${item.id ?? index}`}
              style={[
                styles.summaryRow,
                index < limited.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: palette.divider,
                },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: palette.text }]} numberOfLines={1}>
                {getPrimary(item) || '—'}
              </Text>
              {getSecondary ? (
                <Text style={[styles.summaryDesc, { color: palette.subtext }]} numberOfLines={2}>
                  {getSecondary(item)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderShowcaseList = (
    title: string,
    items: any[],
    options?: { renderAction?: (item: any) => React.ReactNode },
  ) => {
    if (!items?.length) return null;
    const limited = items.slice(0, 3);
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          {limited.map((item, index) => {
            const description = item.summary || item.payload?.summary || '';
            return (
              <View
                key={`${title}-${item.id ?? index}`}
                style={[
                  styles.showcaseRow,
                  index < limited.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.divider,
                  },
                ]}
              >
                {item.file_url ? (
                  <Image source={{ uri: item.file_url }} style={styles.showcaseThumb} />
                ) : (
                  <View
                    style={[
                      styles.showcaseThumb,
                      { backgroundColor: palette.surfaceSoft ?? palette.surface },
                    ]}
                  />
                )}
                <View style={styles.showcaseDetails}>
                  <Text style={[styles.summaryTitle, { color: palette.text }]} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                  {description ? (
                    <Text style={[styles.summaryDesc, { color: palette.subtext }]} numberOfLines={2}>
                      {description}
                    </Text>
                  ) : null}
                </View>
            {options?.renderAction?.(item) ?? null}
          </View>
        );
      })}
    </View>
  </View>
);
  };

  const renderIntroVideoAction = (item: any) => {
    const url = getShowcaseLink(item);
    if (!url) return null;
    return (
      <Pressable
        onPress={() => openShowcaseLink(item)}
        style={[
          styles.showcaseAction,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <KISIcon name="play" size={14} color={palette.primary} />
        <Text style={[styles.showcaseActionText, { color: palette.primary }]}>Watch</Text>
      </Pressable>
    );
  };

  const formatActivitySecondary = (item: any) => {
    if (item?.meta?.detail) return item.meta.detail;
    if (item?.created_at) {
      try {
        return new Date(item.created_at).toLocaleDateString();
      } catch {
        return item.created_at;
      }
    }
    return '';
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {infoTitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Pressable
            onPress={() => {
              if (!avatarUrl) return;
              if (!isGroup && statusHas && contactUserId) {
                DeviceEventEmitter.emit('status.open', { userId: contactUserId });
                onBack?.();
                return;
              }
              setAvatarPreview({ uri: avatarUrl });
              setAvatarPreviewFull(false);
            }}
            disabled={!avatarUrl}
          >
            <View
              style={{
                borderWidth: statusHas ? 2 : 0,
                borderColor: statusHas
                  ? statusHasUnseen
                    ? palette.primaryStrong ?? palette.primary
                    : palette.subtext ?? palette.divider
                  : 'transparent',
                padding: statusHas ? 2 : 0,
                borderRadius: 46,
              }}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <ImagePlaceholder size={88} radius={44} style={styles.avatar} />
              )}
            </View>
          </Pressable>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
            {isGroup ? `${memberCount} members` : 'Direct chat'}
          </Text>

          {isGroup && isAdmin && (
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
                {saving ? 'Updating...' : 'Change group photo'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Details
          </Text>
          <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
            <Text style={[styles.detailLabel, { color: palette.subtext }]}>
              Type
            </Text>
            <Text style={[styles.detailValue, { color: palette.text }]}>
              {isGroup ? 'Group conversation' : 'Direct conversation'}
            </Text>
          </View>
        </View>

        {!isGroup && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Contact
            </Text>
            <View
              style={[
                styles.sectionCard,
                { borderColor: palette.divider, backgroundColor: palette.card },
              ]}
            >
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: palette.subtext }]}>Name</Text>
                <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>
                  {contactName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: palette.subtext }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>
                  {contactPhoneValue}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: palette.subtext }]}>Email</Text>
                <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>
                  {contactEmailValue}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!isGroup && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Public profile
            </Text>
            {profileLoading ? (
              <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                <Skeleton height={16} width={140} />
                <Skeleton height={12} width={220} style={{ marginTop: 8 }} />
                <Skeleton height={12} width={180} style={{ marginTop: 6 }} />
              </View>
            ) : publicProfile ? (
              <View style={[styles.profileCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                {publicProfile?.profile?.cover_url ? (
                  <Image source={{ uri: publicProfile.profile.cover_url }} style={styles.profileCover} />
                ) : null}
                <View style={styles.profileHeader}>
                  {publicProfile?.profile?.avatar_url ? (
                    <Image source={{ uri: publicProfile.profile.avatar_url }} style={styles.profileAvatar} />
                  ) : (
                    <ImagePlaceholder size={56} radius={18} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileName, { color: palette.text }]} numberOfLines={1}>
                      {publicProfile?.user?.display_name || 'Profile'}
                    </Text>
                    {publicProfile?.profile?.headline ? (
                      <Text style={[styles.profileHeadline, { color: palette.subtext }]} numberOfLines={2}>
                        {publicProfile.profile.headline}
                      </Text>
                    ) : null}
                    {publicProfile?.profile?.industry ? (
                      <Text style={[styles.profileMeta, { color: palette.subtext }]} numberOfLines={1}>
                        {publicProfile.profile.industry}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {publicProfile?.profile?.bio ? (
                  <Text style={[styles.profileBio, { color: palette.text }]} numberOfLines={4}>
                    {publicProfile.profile.bio}
                  </Text>
                ) : null}

                {serviceItems.length > 0 && (
                  <>
                    <Text style={[styles.profileSubTitle, { color: palette.text }]}>Services</Text>
                    {serviceItems.slice(0, 3).map((svc: any, idx: number) => (
                      <View key={`${svc?.title ?? 'service'}-${idx}`} style={styles.profileLine}>
                        <Text style={[styles.profileLineTitle, { color: palette.text }]} numberOfLines={1}>
                          {svc.title || 'Service'}
                        </Text>
                        <Text style={[styles.profileLineMeta, { color: palette.subtext }]}>
                          {svc.price || 'Request quote'}
                        </Text>
                      </View>
                    ))}
                  </>
                )}

                {highlightItems.length > 0 && (
                  <>
                    <Text style={[styles.profileSubTitle, { color: palette.text }]}>Highlights</Text>
                    <View style={styles.chipRow}>
                      {highlightItems.map((item: string, idx: number) => (
                        <View
                          key={`${item}_${idx}`}
                          style={[styles.chip, { backgroundColor: palette.primarySoft }]}
                        >
                          <Text style={{ color: palette.primaryStrong }}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {portfolioItems.length > 0 && (
                  <>
                    <Text style={[styles.profileSubTitle, { color: palette.text }]}>Portfolio gallery</Text>
                    <View style={styles.portfolioRow}>
                      {portfolioItems.slice(0, 4).map((item: any, idx: number) => (
                        <View
                          key={`${item.id ?? idx}`}
                          style={[styles.portfolioThumb, { backgroundColor: palette.surface }]}
                        >
                          {item.file_url ? (
                            <Image source={{ uri: item.file_url }} style={styles.portfolioThumbImg} />
                          ) : (
                            <ImagePlaceholder size={42} radius={12} />
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No public profile available.
              </Text>
            )}
          </View>
        )}

        {!isGroup && (
          <>
            {renderSummaryList(
              'Experience',
              experienceItems,
              (item) => item.title || 'Experience',
              (item) => item.description || item.company || '',
            )}
            {renderSummaryList(
              'Education',
              educationItems,
              (item) => item.school || 'Education',
              (item) => item.description || '',
            )}
            {renderSummaryList(
              'Projects',
              projectItems,
              (item) => item.name || 'Project',
              (item) => item.description || item.project_url || '',
            )}
            {skillItems.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Skills</Text>
                <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                  <View style={styles.chipRow}>
                    {skillItems.slice(0, 8).map((skill: any, idx: number) => (
                      <View
                        key={`${skill.id ?? skill.skill_id ?? idx}`}
                        style={[styles.chip, { backgroundColor: palette.primarySoft }]}
                      >
                        <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>
                          {skill.description || skill.skill_id || 'Skill'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
            {renderSummaryList(
              'Recommendations',
              recommendationItems,
              (item) => item.content || 'Recommendation',
              (item) => item.recommender_user?.display_name || '',
            )}
            {renderSummaryList(
              'Articles',
              articleItems,
              (item) => item.title || 'Article',
              (item) => item.summary || '',
            )}
            {renderSummaryList(
              'Recent activity',
              activityItems,
              (item) => item.action || 'Activity',
              (item) => formatActivitySecondary(item),
            )}
            {renderShowcaseList('Case studies', caseStudyItems)}
            {renderShowcaseList('Testimonials', testimonialItems)}
            {renderShowcaseList('Certifications', certificationItems)}
            {renderShowcaseList(
              'Intro videos',
              introVideoItems,
              { renderAction: renderIntroVideoAction },
            )}
          </>
        )}

        {isGroup && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Members
            </Text>
            {membersLoading ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                Loading members...
              </Text>
            ) : groupMembers.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No member details available.
              </Text>
            ) : (
              groupMembers.map((p, index) => {
                const label =
                  p.display_name ||
                  resolveUserName(p.user) ||
                  'Member';
                const roleLabel = p.base_role ? String(p.base_role) : '';
                const phone = resolveUserPhone(p.user);
                return (
                  <View
                    key={`${resolveUserId(p.user) ?? index}`}
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
        )}
      </ScrollView>

      <Modal
        visible={!!avatarPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreview(null)}
      >
        <Pressable
          style={[
            styles.previewBackdrop,
            { backgroundColor: avatarPreviewFull ? '#000' : 'rgba(0,0,0,0)' },
          ]}
          onPress={() => setAvatarPreview(null)}
        />
        {avatarPreview ? (
          <Animated.View
            style={[
              styles.previewStage,
              {
                transform: [
                  {
                    scale: avatarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={() => setAvatarPreviewFull((prev) => !prev)}
              style={[
                styles.previewCard,
                avatarPreviewFull && styles.previewCardFull,
                { backgroundColor: palette.card },
              ]}
            >
              <Image
                source={{ uri: avatarPreview.uri }}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
              <Pressable
                onPress={() => setAvatarPreview(null)}
                style={styles.previewBackBtn}
              >
                <KISIcon name="arrow-left" size={18} color="#fff" />
              </Pressable>
            </Pressable>
            {!avatarPreviewFull ? (
              <View
                style={[
                  styles.previewActions,
                  { backgroundColor: palette.card, borderColor: palette.divider },
                ]}
              >
                <Pressable
                  onPress={() => {
                    setAvatarPreview(null);
                    onBack?.();
                  }}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="chat" size={20} color={palette.primary} />
                </Pressable>
                <Pressable
                  onPress={() => Alert.alert('Coming up', 'Voice calls are coming soon.')}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="phone" size={20} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => Alert.alert('Coming up', 'Video calls are coming soon.')}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="video" size={20} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => setAvatarPreview(null)}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="info" size={20} color={palette.text} />
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </Modal>
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
  subtitle: { marginTop: 4, fontSize: 13 },
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
  sectionCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 10 },
  card: { borderWidth: 2, borderRadius: 12, padding: 12 },
  infoRow: { paddingVertical: 6 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 13 },
  profileCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 12 },
  profileCover: { width: '100%', height: 110, borderRadius: 12, marginBottom: 8 },
  profileHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  profileAvatar: { width: 56, height: 56, borderRadius: 18 },
  profileName: { fontSize: 16, fontWeight: '700' },
  profileHeadline: { fontSize: 13, marginTop: 2 },
  profileMeta: { fontSize: 12, marginTop: 4 },
  profileBio: { fontSize: 13, lineHeight: 18 },
  profileSubTitle: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  profileLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  profileLineTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  profileLineMeta: { fontSize: 12 },
  portfolioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portfolioThumb: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  portfolioThumbImg: { width: 52, height: 52, borderRadius: 12 },
  summaryRow: { paddingVertical: 10 },
  summaryTitle: { fontSize: 14, fontWeight: '600' },
  summaryDesc: { fontSize: 12, marginTop: 4 },
  showcaseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  showcaseThumb: { width: 56, height: 56, borderRadius: 12 },
  showcaseDetails: { flex: 1 },
  showcaseAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
  },
  showcaseActionText: { fontSize: 11, fontWeight: '700' },
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
  previewBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
  },
  previewStage: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    width: 280,
    height: 280,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardFull: {
    width: '100%',
    height: '80%',
    borderRadius: 0,
  },
  previewActions: {
    marginTop: 12,
    width: 280,
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewActionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewBackBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatInfoPage;
