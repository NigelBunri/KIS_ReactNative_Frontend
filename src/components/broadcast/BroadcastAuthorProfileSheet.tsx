import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import {
  formatKisHandle,
  formatPublicPhone,
  hasVisibleValue,
} from '@/components/broadcast/authorProfileUtils';

type Props = {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  profile: any;
  onClose: () => void;
};

const fallbackAvatar = require('@/assets/logo-light.png');

const normalizeArray = (value: any) => (Array.isArray(value) ? value : []);

const parseJsonLikeString = (value: string): unknown => {
  const text = String(value || '').trim();
  if (
    !(
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'))
    )
  ) {
    return null;
  }

  const attempts = [
    text,
    text.replace(/'/g, '"'),
    text
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"'),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // keep trying fallback parsers
    }
  }
  return null;
};

const extractHumanText = (entry: any): string => {
  if (entry === null || entry === undefined) return '';

  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return '';

    const extractedLabels = Array.from(
      trimmed.matchAll(/label\s*[:=]\s*['"]?([^,'"\]}]+)['"]?/gi),
    )
      .map((match) => String(match?.[1] || '').trim())
      .filter(Boolean);
    if (extractedLabels.length > 0) {
      return extractedLabels.join(', ');
    }

    const parsed = parseJsonLikeString(trimmed);
    if (Array.isArray(parsed)) {
      const labels = parsed.map((value) => extractHumanText(value)).filter(Boolean);
      if (labels.length) return labels.join(', ');
    } else if (parsed && typeof parsed === 'object') {
      const parsedObject = parsed as Record<string, any>;
      return extractHumanText(
        parsedObject.label ??
          parsedObject.name ??
          parsedObject.language_name ??
          parsedObject.language ??
          parsedObject.code ??
          '',
      );
    }

    const match = trimmed.match(/label\s*[:=]\s*['\"]([^'\"]+)['\"]/i);
    if (match?.[1]) return match[1].trim();

    return trimmed;
  }

  if (typeof entry === 'number') return String(entry);

  if (typeof entry === 'object') {
    return extractHumanText(
      entry.label ?? entry.name ?? entry.language_name ?? entry.language ?? entry.code ?? '',
    );
  }

  return '';
};

const normalizeLanguages = (payload: any) => {
  const rawList =
    payload?.preferences?.languages ??
    payload?.languages ??
    payload?.profile?.languages ??
    payload?.profile_languages ??
    [];
  const list = Array.isArray(rawList) ? rawList : [rawList];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of normalizeArray(list)) {
    const label = extractHumanText(entry);
    const normalized = label.trim();
    if (!normalized) continue;
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(normalized);
  }
  return out;
};

const flattenShowcases = (showcases: any) => {
  if (!showcases || typeof showcases !== 'object') return [];
  return Object.values(showcases)
    .flatMap((bucket: any) => (Array.isArray(bucket) ? bucket : []))
    .filter(Boolean);
};

const compactText = (value: any, fallback = '') => {
  const text = extractHumanText(value);
  return text || fallback;
};

const Section = ({
  title,
  titleStyle,
  children,
}: {
  title: string;
  titleStyle: any;
  children: React.ReactNode;
}) => {
  return (
    <View style={{ gap: 8 }}>
      <Text style={titleStyle}>{title}</Text>
      {children}
    </View>
  );
};

export default function BroadcastAuthorProfileSheet({
  visible,
  loading = false,
  error = null,
  profile,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const user = profile?.user ?? {};
  const profileData = profile?.profile ?? {};
  const sections = profile?.sections ?? {};

  const displayName =
    compactText(user?.display_name) ||
    compactText(user?.visible_name) ||
    compactText(user?.username) ||
    compactText(user?.name) ||
    'KIS user';

  const headline = compactText(profileData?.headline ?? profile?.headline);
  const bio = compactText(profileData?.bio ?? profile?.bio);
  const phone = formatPublicPhone(user);
  const email = compactText(user?.email);
  const location = [compactText(profileData?.city), compactText(profileData?.country)]
    .filter(hasVisibleValue)
    .join(', ');
  const website = compactText(profileData?.website ?? profile?.website);
  const languages = normalizeLanguages(profile);

  const experiences = normalizeArray(sections?.experiences);
  const educations = normalizeArray(sections?.educations);
  const projects = normalizeArray(sections?.projects);
  const skills = normalizeArray(sections?.skills);
  const showcases = flattenShowcases(sections?.showcases);

  const coverUri = resolveBackendAssetUrl(profileData?.cover_url ?? null);
  const avatarUri = resolveBackendAssetUrl(
    profileData?.avatar_url ?? user?.avatar_url ?? user?.avatar,
  );

  const statCards = [
    { key: 'experience', label: 'Experience', value: experiences.length },
    { key: 'education', label: 'Education', value: educations.length },
    { key: 'projects', label: 'Projects', value: projects.length },
    { key: 'skills', label: 'Skills', value: skills.length },
  ].filter((item) => item.value > 0);

  const detailChips = [
    { key: 'phone', label: 'Phone', value: phone },
    { key: 'email', label: 'Email', value: email },
    { key: 'location', label: 'Location', value: location },
    { key: 'website', label: 'Website', value: website },
  ].filter((entry) => hasVisibleValue(entry.value));

  const hasContent =
    hasVisibleValue(bio) ||
    hasVisibleValue(headline) ||
    detailChips.length > 0 ||
    languages.length > 0 ||
    experiences.length > 0 ||
    educations.length > 0 ||
    projects.length > 0 ||
    skills.length > 0 ||
    showcases.length > 0;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile preview</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={palette.primaryStrong} />
              <Text style={styles.loadingLabel}>Loading public profile...</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroWrap}>
                <View style={styles.coverWrap}>
                  {coverUri ? (
                    <Image source={{ uri: coverUri }} style={styles.coverImage} />
                  ) : (
                    <View style={[styles.coverImage, styles.coverFallback]} />
                  )}
                  <View style={styles.coverTint} />
                </View>

                <View style={styles.identityCard}>
                  <Image source={avatarUri ? { uri: avatarUri } : fallbackAvatar} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.handleText} numberOfLines={1}>
                      {formatKisHandle(displayName)}
                    </Text>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {hasVisibleValue(headline) ? (
                      <Text style={styles.headlineText} numberOfLines={2}>
                        {headline}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {statCards.length ? (
                <View style={styles.statRow}>
                  {statCards.map((item) => (
                    <View key={item.key} style={styles.statCard}>
                      <Text style={styles.statValue}>{item.value}</Text>
                      <Text style={styles.statLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {hasVisibleValue(bio) ? (
                <View style={styles.cardBlock}>
                  <Section title="About" titleStyle={styles.sectionTitle}>
                    <Text style={styles.bioText}>{bio}</Text>
                  </Section>
                </View>
              ) : null}

              {detailChips.length || languages.length ? (
                <View style={styles.cardBlock}>
                  <Section title="Public info" titleStyle={styles.sectionTitle}>
                    {languages.length ? (
                      <View style={{ gap: 6 }}>
                        <Text style={styles.groupLabel}>Languages</Text>
                        <View style={styles.skillWrap}>
                          {languages.map((language) => (
                            <View key={language} style={styles.skillChip}>
                              <Text style={styles.skillChipText}>{language}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {detailChips.length ? (
                      <View style={styles.detailGrid}>
                        {detailChips.map((entry) => (
                          <View key={entry.key} style={styles.detailTile}>
                            <Text style={styles.detailLabel}>{entry.label}</Text>
                            <Text style={styles.detailValue} numberOfLines={2}>
                              {String(entry.value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Section>
                </View>
              ) : null}

              {experiences.length ? (
                <View style={styles.cardBlock}>
                  <Section title="Experience" titleStyle={styles.sectionTitle}>
                    <View style={styles.stackList}>
                      {experiences.map((item: any, idx: number) => (
                        <View key={String(item?.id ?? idx)} style={styles.rowItem}>
                          <Text style={styles.rowTitle}>{compactText(item?.title, 'Role')}</Text>
                          <Text style={styles.rowSubtitle}>
                            {compactText(item?.company || item?.organization)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Section>
                </View>
              ) : null}

              {educations.length ? (
                <View style={styles.cardBlock}>
                  <Section title="Education" titleStyle={styles.sectionTitle}>
                    <View style={styles.stackList}>
                      {educations.map((item: any, idx: number) => (
                        <View key={String(item?.id ?? idx)} style={styles.rowItem}>
                          <Text style={styles.rowTitle}>{compactText(item?.school || item?.institution, 'School')}</Text>
                          <Text style={styles.rowSubtitle}>{compactText(item?.degree || item?.field_of_study)}</Text>
                        </View>
                      ))}
                    </View>
                  </Section>
                </View>
              ) : null}

              {projects.length ? (
                <View style={styles.cardBlock}>
                  <Section title="Projects" titleStyle={styles.sectionTitle}>
                    <View style={styles.stackList}>
                      {projects.map((item: any, idx: number) => (
                        <View key={String(item?.id ?? idx)} style={styles.rowItem}>
                          <Text style={styles.rowTitle}>{compactText(item?.name, 'Project')}</Text>
                          <Text style={styles.rowSubtitle}>{compactText(item?.description)}</Text>
                        </View>
                      ))}
                    </View>
                  </Section>
                </View>
              ) : null}

              {skills.length ? (
                <View style={styles.cardBlock}>
                  <Section title="Skills" titleStyle={styles.sectionTitle}>
                    <View style={styles.skillWrap}>
                      {skills.map((item: any, idx: number) => {
                        const label = compactText(item?.name || item?.title || item);
                        if (!label) return null;
                        return (
                          <View key={String(item?.id ?? `${label}-${idx}`)} style={styles.skillChip}>
                            <Text style={styles.skillChipText}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Section>
                </View>
              ) : null}

              {showcases.length ? (
                <View style={styles.cardBlock}>
                  <Section title="Portfolio & Case Studies" titleStyle={styles.sectionTitle}>
                    <View style={styles.stackList}>
                      {showcases.map((item: any, idx: number) => (
                        <View key={String(item?.id ?? idx)} style={styles.rowItem}>
                          <Text style={styles.rowTitle}>{compactText(item?.title || item?.type, 'Showcase item')}</Text>
                          <Text style={styles.rowSubtitle}>{compactText(item?.summary || item?.description)}</Text>
                        </View>
                      ))}
                    </View>
                  </Section>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!hasContent && !error ? (
                <Text style={styles.emptyText}>This user has no public profile details yet.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(8,14,28,0.45)',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      height: '88%',
      maxHeight: '90%',
      minHeight: 320,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: palette.divider,
      backgroundColor: palette.card,
    },
    grab: {
      alignSelf: 'center',
      width: 52,
      height: 5,
      borderRadius: 999,
      backgroundColor: palette.divider,
      marginTop: 10,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    headerTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
    },
    loadingWrap: {
      paddingVertical: 30,
      alignItems: 'center',
      gap: 8,
    },
    loadingLabel: {
      color: palette.subtext,
      fontSize: 13,
      fontWeight: '700',
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 12,
    },
    heroWrap: {
      gap: 0,
      marginBottom: 2,
    },
    coverWrap: {
      height: 170,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    coverImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    coverFallback: {
      backgroundColor: palette.primarySoft,
    },
    coverTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8,14,28,0.24)',
    },
    identityCard: {
      marginHorizontal: 12,
      marginTop: -28,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 16,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 24,
      backgroundColor: palette.surface,
      borderWidth: 2,
      borderColor: palette.card,
    },
    handleText: {
      color: palette.primaryStrong,
      fontSize: 15,
      fontWeight: '900',
    },
    nameText: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 2,
    },
    headlineText: {
      color: palette.subtext,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
      lineHeight: 17,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statCard: {
      flexGrow: 1,
      minWidth: 70,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: 'center',
      backgroundColor: palette.surface,
    },
    statValue: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '900',
    },
    statLabel: {
      color: palette.subtext,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    cardBlock: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 14,
      padding: 12,
      backgroundColor: palette.surface,
      gap: 10,
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '900',
    },
    bioText: {
      color: palette.text,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '500',
    },
    groupLabel: {
      color: palette.subtext,
      fontSize: 12,
      fontWeight: '700',
    },
    detailGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    detailTile: {
      minWidth: 120,
      flex: 1,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: palette.card,
      gap: 3,
    },
    detailLabel: {
      color: palette.subtext,
      fontSize: 11,
      fontWeight: '700',
    },
    detailValue: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
    },
    stackList: {
      gap: 8,
    },
    rowItem: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: palette.card,
      gap: 4,
    },
    rowTitle: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
    },
    rowSubtitle: {
      color: palette.subtext,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
    },
    skillWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    skillChip: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: palette.card,
    },
    skillChipText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
    },
    errorText: {
      color: palette.danger,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    },
    emptyText: {
      color: palette.subtext,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },
  });
