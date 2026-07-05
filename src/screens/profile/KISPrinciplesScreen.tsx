import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type PrincipleCard = {
  key: string;
  title: string;
  body: string;
  icon: KISIconName;
};

type RuleGroup = {
  key: string;
  title: string;
  description: string;
  items: string[];
};

const CORE_PRINCIPLES: PrincipleCard[] = [
  {
    key: 'god',
    title: 'Honor God',
    body: 'KIS is built to encourage truth, purity, humility, gratitude, service, and responsible influence.',
    icon: 'sparkles',
  },
  {
    key: 'dignity',
    title: 'Respect every person',
    body: 'Every person has dignity. Speech, media, business, teaching, care, and leadership must treat people with respect.',
    icon: 'heart',
  },
  {
    key: 'family',
    title: 'Protect families',
    body: 'Children, youth, adults, and older people should feel safe, guided, and protected when using the platform.',
    icon: 'shield',
  },
  {
    key: 'service',
    title: 'Serve with integrity',
    body: 'Verified identity, fair trade, responsible care, honest education, and truthful content are part of the KIS standard.',
    icon: 'check',
  },
];

const RULE_GROUPS: RuleGroup[] = [
  {
    key: 'not-allowed',
    title: 'Content that is never allowed',
    description:
      'These rules apply everywhere: DMs, groups, feeds, channels, comments, partner spaces, profiles, shops, education, health, live streams, files, and embeds.',
    items: [
      'Pornographic, sexually explicit, or sexually degrading images, videos, text, audio, documents, links, or live content.',
      'Any sexualized, exploitative, predatory, grooming, or manipulative content involving children or vulnerable people.',
      'Harassment, threats, hate, abuse, intimidation, blackmail, scams, fraud, impersonation, or fake verified identity.',
      'Content that encourages self-harm, violence, exploitation, occult manipulation, spiritual abuse, financial abuse, or medical abuse.',
    ],
  },
  {
    key: 'allowed-carefully',
    title: 'Sensitive content needs care',
    description:
      'Some content may be permitted only in the right private, professional, or educational context.',
    items: [
      'Health, medical, counselling, or educational materials must be handled privately, respectfully, and only for legitimate care or learning.',
      'Leaders, providers, teachers, and partners must not use authority to pressure, shame, exploit, or manipulate users.',
      'Business, health, education, and spiritual guidance must be honest about limitations and should not replace qualified professional help where required.',
    ],
  },
  {
    key: 'reporting',
    title: 'If something feels wrong',
    description:
      'KIS should be safe enough for families. Reporting must be simple and taken seriously.',
    items: [
      'Report harmful content, unsafe messages, impersonation, scams, abuse, or sexual content immediately.',
      'Block or mute people and communities that make you unsafe.',
      'Parents, guardians, leaders, and staff should escalate child-safety concerns quickly.',
    ],
  },
];

const AGE_GROUPS = [
  {
    key: 'children',
    label: 'Children',
    copy: 'Simple words, safe spaces, no adult content, and clear reporting.',
  },
  {
    key: 'youth',
    label: 'Youth',
    copy: 'Creative freedom with guardrails, kindness, truth, and protection.',
  },
  {
    key: 'adults',
    label: 'Adults',
    copy: 'Efficient tools for work, family, service, learning, care, and business.',
  },
  {
    key: 'elders',
    label: 'Older people',
    copy: 'Readable screens, predictable actions, dignity, and patient support.',
  },
];

export default function KISPrinciplesScreen() {
  const { palette, tone } = useKISTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const responsive = useResponsiveLayout();
  const isDark = tone === 'dark';

  const styles = useMemo(() => createStyles(palette, isDark, responsive), [palette, isDark, responsive]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
            >
              <KISIcon name="chevron-left" size={20} color={palette.royalInk} />
            </Pressable>
            <View style={styles.heroSeal}>
              <KISIcon name="shield" size={18} color={palette.royalInk} />
            </View>
          </View>
          <Text style={styles.eyebrow}>KIS Christian standard</Text>
          <Text style={styles.heroTitle}>Community Covenant</Text>
          <Text style={styles.heroBody}>
            KIS is a Christian platform for people, families, creators,
            institutions, shops, health providers, educators, companies, and
            communities. The goal is not only connection, but connection with
            truth, purity, dignity, service, and care.
          </Text>
        </View>

        <View style={styles.warningPanel}>
          <View style={styles.warningIcon}>
            <KISIcon name="shield" size={18} color={palette.goldHighlight} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.warningTitle, { color: palette.surface }]}>Pornography is not allowed anywhere on KIS.</Text>
            <Text style={[styles.warningBody, { color: palette.surface }]}>
              This applies to uploads, DMs, channels, comments, groups, live
              streams, profile media, shop media, education, health, partner
              spaces, documents, links, and embeds.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What guides KIS</Text>
          <View style={styles.principleGrid}>
            {CORE_PRINCIPLES.map(item => (
              <View key={item.key} style={styles.principleCard}>
                <View style={styles.principleIcon}>
                  <KISIcon name={item.icon} size={18} color={palette.goldDeep} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rules everyone can understand</Text>
          {RULE_GROUPS.map(group => (
            <View key={group.key} style={styles.ruleCard}>
              <Text style={styles.ruleTitle}>{group.title}</Text>
              <Text style={styles.ruleDescription}>{group.description}</Text>
              <View style={styles.ruleList}>
                {group.items.map(item => (
                  <View key={item} style={styles.ruleItem}>
                    <View style={styles.ruleDot} />
                    <Text style={styles.ruleText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Designed for every generation</Text>
          <View style={styles.ageGrid}>
            {AGE_GROUPS.map(group => (
              <View key={group.key} style={styles.ageCard}>
                <Text style={styles.ageLabel}>{group.label}</Text>
                <Text style={styles.ageCopy}>{group.copy}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footerPanel}>
          <KISIcon name="heart" size={18} color={palette.goldDeep} />
          <Text style={styles.footerText}>
            KIS should be beautiful, useful, and safe enough to recommend to a
            family, a church, a school, a clinic, a shop, and a community.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (
  palette: ReturnType<typeof useKISTheme>['palette'],
  isDark: boolean,
  responsive: ReturnType<typeof useResponsiveLayout>,
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.bg, marginTop: 25,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: responsive.pageGutter,
      gap: responsive.cardGap,
      width: '100%',
      maxWidth: responsive.contentMaxWidth,
      alignSelf: 'center',
    },
    hero: {
      borderRadius: 28,
      padding: 22,
      gap: 12,
      backgroundColor: isDark ? palette.royalInk : palette.surface,
      borderWidth: 1,
      borderColor: palette.goldBorder,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 6,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backButton: {
      width: responsive.minTouchTarget,
      height: responsive.minTouchTarget,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.goldSoft,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    heroSeal: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.goldLight,
      borderWidth: 1,
      borderColor: palette.goldDeep,
    },
    eyebrow: {
      color: isDark ? palette.goldLight : palette.goldDeep,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    heroTitle: {
      color: palette.text,
      fontSize: Math.max(responsive.headerTitleSize, 26),
      lineHeight: Math.max(responsive.headerTitleSize, 26) * 1.18,
      fontWeight: '900',
    },
    heroBody: {
      color: palette.subtext,
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '600',
    },
    warningPanel: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      padding: 16,
      borderRadius: 22,
      backgroundColor: palette.royalInk,
      borderWidth: 1,
      borderColor: palette.goldDeep,
    },
    warningIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.goldSoft,
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: '900',
    },
    warningBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '600',
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 20,
      fontWeight: '900',
    },
    principleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    principleCard: {
      flexGrow: 1,
      flexBasis: '47%',
      minWidth: 150,
      padding: 15,
      borderRadius: 20,
      gap: 8,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.goldBorder,
    },
    principleIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.goldSoft,
    },
    cardTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '900',
    },
    cardBody: {
      color: palette.subtext,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
    ruleCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.goldBorder,
    },
    ruleTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '900',
    },
    ruleDescription: {
      color: palette.subtext,
      lineHeight: 20,
      fontWeight: '600',
    },
    ruleList: {
      gap: 10,
    },
    ruleItem: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    ruleDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
      backgroundColor: palette.goldDeep,
    },
    ruleText: {
      flex: 1,
      color: palette.text,
      lineHeight: 21,
      fontWeight: '600',
    },
    ageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    ageCard: {
      flexGrow: 1,
      flexBasis: '47%',
      minWidth: 145,
      padding: 14,
      borderRadius: 18,
      backgroundColor: palette.goldHighlight,
      borderWidth: 1,
      borderColor: palette.goldBorder,
      gap: 5,
    },
    ageLabel: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '900',
    },
    ageCopy: {
      color: palette.subtext,
      lineHeight: 19,
      fontWeight: '600',
    },
    footerPanel: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 16,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.goldBorder,
    },
    footerText: {
      flex: 1,
      color: palette.text,
      lineHeight: 21,
      fontWeight: '700',
    },
  });
