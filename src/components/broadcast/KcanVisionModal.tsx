import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

const KCAN_CITY_IMAGE = require('@/assets/KCAN_city.jpg');

type Props = {
  visible: boolean;
  onClose: () => void;
};

type AchievementStep = {
  step: string;
  key: string;
  title: string;
  subtitle: string;
  body: string;
  scripture: string;
  icon: string;
};

type SimpleCard = {
  title: string;
  scripture: string;
  icon: string;
};

const KCAN_PURPOSE =
  'To help people discover their God-given purpose, create the best environment for that purpose to be expressed, and raise them through transformation: from men and women of purpose, to Kingdom citizens, and then to Kingdom ambassadors sent into the world for Kingdom expansion.';

const PURPOSE_SCRIPTURE =
  '“For we are His workmanship, created in Christ Jesus for good works...” — Ephesians 2:10';

const KCAN_VISION =
  'To build a lawful, covenant-based, city-like Kingdom ecosystem where God-given purpose can be discovered, formed, expressed, multiplied, and sent into the world through Kingdom Ambassadors, a people who have come to the stature of the fullness of Christ, through institutions, products, and services for Kingdom expansion.';

const VISION_SCRIPTURE =
  '“...unto the measure of the stature of the fullness of Christ.” — Ephesians 4:13';

const CITY_DECLARATION =
  'A virtual city through KIS. A physical city through KCAN. One Kingdom vision.';

const FINAL_DECLARATION =
  'KCAN is building a people, a platform, and a city where purpose is discovered, formed, expressed, multiplied, and sent into the world for Kingdom expansion.';

const achievementSteps: AchievementStep[] = [
  {
    step: '01',
    key: 'KIS',
    title: 'KIS — Kingdom Impact Social',
    subtitle: 'The Digital Kingdom City',
    icon: 'school',
    scripture: '“Whom shall he teach knowledge? and whom shall he make to understand doctrine? them that are weaned from the milk, and drawn from the breasts. For precept must be upon precept, precept upon precept; line upon line, line upon line; here a little, and there a little:” — Isaiah 28:9-10',
    body: 'A Kingdom-centered, verified social operating system where people, families, creators, churches, educators, health providers, shops, companies, and communities communicate, publish, learn, care, sell, serve, and grow under clear Christian principles.',
  },
  {
    step: '02',
    key: 'KIE + KIM',
    title: 'KIE & KIM',
    subtitle: 'Education and Market Restored',
    icon: 'storefront',
    scripture: '“Neither was there any among them that lacked.” — Acts 4:34',
    body:
      'Revenue from KIS and Kingdom Impact Education helps build a marketplace of fairness, excellence, covenant living, love, and stewardship instead of manipulation.',
  },
  {
    step: '03',
    key: 'KIH',
    title: 'KIH — Kingdom Impact Health',
    subtitle: 'Health With Truth, Compassion, and Power',
    icon: 'heart',
    scripture: '“The prayer of faith shall save the sick.” — James 5:15',
    body:
      'A health system where science becomes a vessel for wisdom, compassion, prayer, excellent treatment, and genuine care for the whole person.',
  },
  {
    step: '04',
    key: 'CITY',
    title: 'Kingdom Accommodations',
    subtitle: 'A Physical Covenant Community',
    icon: 'home',
    scripture: '“And all that believed were together...” — Acts 2:44',
    body:
      'A long-term physical city vision to provide stability, basic necessities, productive work, services, and Kingdom programs that help eliminate poverty from thousands of Christians.',
  },
];

const commitments: SimpleCard[] = [
  {
    title: 'We will pray for you.',
    icon: 'sparkles',
    scripture: 'James 5:16',
  },
  {
    title: 'We will protect the city from illicit and harmful materials.',
    icon: 'shield',
    scripture: '1 Peter 1:16',
  },
  {
    title: 'We will provide verified materials for structured growth.',
    icon: 'book',
    scripture: '2 Timothy 2:15',
  },
  {
    title: 'We will build a safe environment for Kingdom growth.',
    icon: 'people',
    scripture: 'Ephesians 4:13',
  },
  {
    title: 'No ads that distract from purpose.',
    icon: 'close',
    scripture: '1 Corinthians 14:40',
  },
  {
    title: 'This remains holy ground.',
    icon: 'flame',
    scripture: 'Exodus 3:5',
  },
  {
    title: 'Every action can support Kingdom advancement.',
    icon: 'star',
    scripture: 'Daniel 12:3',
  },
];

const userRoles: SimpleCard[] = [
  {
    title: 'Support the vision through account tiers.',
    icon: 'card',
    scripture: 'Luke 10:7',
  },
  {
    title: 'Give only as led by the Spirit.',
    icon: 'gift',
    scripture: '2 Corinthians 9:7',
  },
  {
    title: 'Do not post corrupt or harmful materials.',
    icon: 'warning',
    scripture: 'Matthew 18:6',
  },
  {
    title: 'See yourself as a Kingdom citizen becoming an ambassador.',
    icon: 'crown',
    scripture: '2 Corinthians 5:20',
  },
  {
    title: 'Send prayer requests freely.',
    icon: 'message',
    scripture: 'Galatians 6:2',
  },
  {
    title: 'Love everyone, even when boundaries are needed.',
    icon: 'heart',
    scripture: 'John 13:35',
  },
  {
    title: 'Report security and safety issues quickly.',
    icon: 'lock',
    scripture: 'Ephesians 5:15',
  },
];

const resourceUses = [
  'Education and structured learning',
  'Healthcare and care systems',
  'Missions and Kingdom outreaches',
  'Accommodations and basic necessities',
  'Jobs, products, and services',
  'The long-term covenant city ecosystem',
];

const SectionHeader = ({
  label,
  title,
  body,
  scripture,
  palette,
  centered = false,
}: {
  label: string;
  title: string;
  body?: string;
  scripture?: string;
  palette: ReturnType<typeof useKISTheme>['palette'];
  centered?: boolean;
}) => (
  <View style={[stylesStatic.headerBlock, centered && stylesStatic.centered]}>
    <Text style={[stylesStatic.sectionLabel, { color: palette.primaryStrong }]}>
      {label}
    </Text>
    <Text style={[stylesStatic.sectionTitle, { color: palette.text }]}>
      {title}
    </Text>
    {body ? (
      <Text style={[stylesStatic.sectionBody, { color: palette.subtext }]}>
        {body}
      </Text>
    ) : null}
    {scripture ? (
      <Text style={[stylesStatic.scriptureText, { color: palette.primaryStrong }]}>
        {scripture}
      </Text>
    ) : null}
  </View>
);

export default function KcanVisionModal({ visible, onClose }: Props) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);

  const goldGradient =
    tone === 'dark'
      ? ['#2D211C', '#6F4515', '#B9852E', '#4A2C22']
      : ['#4B2F2A', '#8A5A12', '#D9A875', '#6B4334'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: compact ? 94 : 128 }]}
        >
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Open KCAN city image"
            onPress={() => setImagePreviewVisible(true)}
          >
            <ImageBackground
              source={KCAN_CITY_IMAGE}
              resizeMode="cover"
              style={[styles.hero, { minHeight: compact ? 430 : 560 }]}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={['rgba(17,10,7,0.12)', 'rgba(17,10,7,0.84)']}
                style={StyleSheet.absoluteFillObject}
              />

              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <KISIcon name="sparkles" size={15} color="#FFE8A3" />
                  <Text style={styles.heroBadgeText}>KCAN Purpose &amp; Vision</Text>
                </View>

                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={styles.closeButton}
                >
                  <KISIcon name="close" size={20} color="#FFF8E6" />
                </Pressable>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>KCAN</Text>
                <Text style={styles.kicker}>
                  Kingdom Citizens &amp; Ambassadors Network
                </Text>
                <Text style={styles.heroSubtitle}>{KCAN_PURPOSE}</Text>
                <Text style={styles.heroScripture}>{PURPOSE_SCRIPTURE}</Text>

                <View style={styles.imageHint}>
                  <KISIcon name="fullscreen" size={14} color="#FFE8A3" />
                  <Text style={styles.imageHintText}>Tap the city to view and zoom</Text>
                </View>
              </View>
            </ImageBackground>
          </Pressable>

          <View style={[styles.body, { paddingHorizontal: responsive.pageGutter }]}>
            <LinearGradient
              colors={goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statementCard, { borderRadius: compact ? 20 : 28 }]}
            >
              <View style={styles.statementInner}>
                <Text style={styles.statementEyebrow}>KCAN vision</Text>
                <Text style={styles.statementText}>{KCAN_VISION}</Text>
                <Text style={styles.statementScripture}>{VISION_SCRIPTURE}</Text>
              </View>
            </LinearGradient>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="Steps of achievement"
                title="How the vision will be built"
                body="The vision grows in clear stages: social, education, market, health, and physical community."
                palette={palette}
              />
            </View>

            <View style={[styles.achievementList, compact && { gap: 10 }]}>
              {achievementSteps.map(item => (
                <View
                  key={item.step}
                  style={[
                    styles.achievementCard,
                    {
                      padding: compact ? 14 : 18,
                      backgroundColor: palette.card,
                      borderColor: palette.goldLight,
                    },
                  ]}
                >
                  <View style={styles.achievementTop}>
                    <View
                      style={[
                        styles.stepBadge,
                        {
                          backgroundColor: palette.primaryStrong,
                          borderColor: palette.goldLight,
                        },
                      ]}
                    >
                      <Text style={styles.stepBadgeText}>{item.step}</Text>
                    </View>
                    <View style={[styles.iconBox, { backgroundColor: palette.primaryStrong }]}>
                      <KISIcon
                        name={item.icon as never}
                        size={19}
                        color={palette.onPrimary}
                      />
                    </View>
                  </View>

                  <Text style={[styles.achievementKey, { color: palette.primaryStrong }]}>
                    {item.key}
                  </Text>
                  <Text style={[styles.achievementTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.achievementSubtitle, { color: palette.text }]}>
                    {item.subtitle}
                  </Text>
                  <Text style={[styles.achievementBody, { color: palette.subtext }]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.cardScripture, { color: palette.primaryStrong }]}>
                    {item.scripture}
                  </Text>
                </View>
              ))}
            </View>

            <LinearGradient
              colors={goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cityDeclarationCard}
            >
              <Text style={styles.cityDeclarationLabel}>Virtual + physical city</Text>
              <Text style={styles.cityDeclarationText}>{CITY_DECLARATION}</Text>
              <Text style={styles.cityDeclarationScripture}>
                “Your Kingdom come. Your will be done on earth as it is in heaven.” — Matthew 6:10
              </Text>
            </LinearGradient>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="Our commitment"
                title="What KCAN promises to protect"
                body="A holy, safe, prayerful, and purpose-centered environment for growth."
                palette={palette}
              />
            </View>

            <View style={[styles.simpleGrid, compact && { gap: 9 }]}>
              {commitments.map(item => (
                <View
                  key={item.title}
                  style={[
                    styles.simpleCard,
                    {
                      minWidth: compact ? '100%' : 150,
                      backgroundColor: palette.card,
                      borderColor: palette.goldLight,
                    },
                  ]}
                >
                  <View style={[styles.simpleIcon, { backgroundColor: palette.primaryStrong }]}>
                    <KISIcon
                      name={item.icon as never}
                      size={16}
                      color={palette.onPrimary}
                    />
                  </View>
                  <Text style={[styles.simpleTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.simpleScripture, { color: palette.primaryStrong }]}>
                    {item.scripture}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="Your role"
                title="How users help keep the city holy and strong"
                body="KCAN is not only a platform to consume. It is a city-like Kingdom environment to build, protect, and serve."
                palette={palette}
              />
            </View>

            <View style={[styles.simpleGrid, compact && { gap: 9 }]}>
              {userRoles.map(item => (
                <View
                  key={item.title}
                  style={[
                    styles.simpleCard,
                    {
                      minWidth: compact ? '100%' : 150,
                      backgroundColor: palette.card,
                      borderColor: palette.goldLight,
                    },
                  ]}
                >
                  <View style={[styles.simpleIcon, { backgroundColor: palette.primaryStrong }]}>
                    <KISIcon
                      name={item.icon as never}
                      size={16}
                      color={palette.onPrimary}
                    />
                  </View>
                  <Text style={[styles.simpleTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.simpleScripture, { color: palette.primaryStrong }]}>
                    {item.scripture}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.moneyCard, { backgroundColor: palette.card }]}>
              <SectionHeader
                label="Financial transparency"
                title="How resources advance the vision"
                body="Revenue generated through subscriptions, products, services, partnerships, and business systems will be reinvested into Kingdom work and the long-term building of the covenant city ecosystem."
                scripture="“Seek first the Kingdom of God...” — Matthew 6:33  •  “It is required in stewards, that a man be found faithful.” — 1 Corinthians 4:2"
                palette={palette}
              />

              <View style={styles.resourceGrid}>
                {resourceUses.map(item => (
                  <View
                    key={item}
                    style={[
                      styles.resourcePill,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.goldLight,
                      },
                    ]}
                  >
                    <KISIcon name="check" size={14} color={palette.primaryStrong} />
                    <Text style={[styles.resourceText, { color: palette.text }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.finalCard, { borderColor: palette.goldLight }]}>
              <Text style={[styles.finalLabel, { color: palette.primaryStrong }]}>
                Final declaration
              </Text>
              <Text style={[styles.finalText, { color: palette.text }]}>
                {FINAL_DECLARATION}
              </Text>
              <Text style={[styles.finalScripture, { color: palette.primaryStrong }]}>
                “Your Kingdom come. Your will be done...” — Matthew 6:10
              </Text>
            </View>

            <EnterpriseKcanRevenuePreviewCard
              palette={palette}
              kind="kcan_vision"
              title="KCAN enterprise and investor packaging preview"
              subtitle="This preview shows how subscriptions, services, partnerships, and business systems can help fund the wider Kingdom city vision."
            />
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.bottomCloseButton, { backgroundColor: palette.primaryStrong }]}
        >
          <KISIcon name="close" size={18} color={palette.onPrimary} />
          <Text style={styles.bottomCloseText}>Close vision</Text>
        </Pressable>
      </SafeAreaView>

      <Modal
        visible={imagePreviewVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.imagePreviewRoot}>
          <View style={styles.imagePreviewTopBar}>
            <Text style={styles.imagePreviewTitle}>KCAN City Vision</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setImagePreviewVisible(false)}
              style={styles.imagePreviewClose}
            >
              <KISIcon name="close" size={20} color="#FFF8E6" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.imagePreviewScroll}
            contentContainerStyle={styles.imagePreviewContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={KCAN_CITY_IMAGE}
              resizeMode="contain"
              style={[styles.fullImage, { transform: [{ scale: imageZoom }] }]}
            />
          </ScrollView>

          <View style={styles.zoomControls}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setImageZoom(prev => Math.max(1, Number((prev - 0.25).toFixed(2))))
              }
              style={styles.zoomButton}
            >
              <Text style={styles.zoomButtonText}>-</Text>
            </Pressable>

            <Text style={styles.zoomText}>{Math.round(imageZoom * 100)}%</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setImageZoom(prev => Math.min(3, Number((prev + 0.25).toFixed(2))))
              }
              style={styles.zoomButton}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setImageZoom(1)}
              style={styles.resetZoomButton}
            >
              <Text style={styles.resetZoomText}>Reset</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const stylesStatic = StyleSheet.create({
  headerBlock: {
    gap: 0,
  },
  centered: {
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 9,
  },
  scriptureText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 96,
    },
    hero: {
      minHeight: 470,
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 28,
      overflow: 'hidden',
    },
    heroImage: {
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: 'rgba(28,18,12,0.58)',
      borderWidth: 1,
      borderColor: 'rgba(255,232,163,0.42)',
    },
    heroBadgeText: {
      color: '#FFF8E6',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0,
    },
    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(28,18,12,0.58)',
      borderWidth: 1,
      borderColor: 'rgba(255,232,163,0.34)',
    },
    heroCopy: {
      gap: 10,
    },
    kicker: {
      color: '#FFE8A3',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    heroTitle: {
      color: '#FFF8E6',
      fontSize: 42,
      lineHeight: 46,
      fontWeight: '900',
      letterSpacing: 0,
    },
    heroSubtitle: {
      color: '#FFF3D2',
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '700',
      maxWidth: 640,
    },
    heroScripture: {
      color: '#FFE8A3',
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      fontStyle: 'italic',
      maxWidth: 640,
    },
    imageHint: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 4,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7,
      backgroundColor: 'rgba(28,18,12,0.5)',
      borderWidth: 1,
      borderColor: 'rgba(255,232,163,0.32)',
    },
    imageHintText: {
      color: '#FFF8E6',
      fontSize: 11,
      fontWeight: '900',
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 18,
      gap: 14,
    },
    statementCard: {
      borderRadius: 24,
      padding: 18,
      overflow: 'hidden',
      shadowColor: palette.shadow ?? '#000',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
    statementInner: {
      flex: 1,
      paddingRight: 25,
      paddingBottom: 25,
    },
    statementEyebrow: {
      color: '#FFE8A3',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    statementText: {
      color: '#FFF3D2',
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '700',
      marginTop: 10,
    },
    statementScripture: {
      color: '#FFE8A3',
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      fontStyle: 'italic',
      marginTop: 12,
    },
    section: {
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    achievementList: {
      gap: 12,
    },
    achievementCard: {
      borderRadius: 24,
      borderWidth: 1,
      padding: 16,
    },
    achievementTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    stepBadge: {
      minWidth: 45,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeText: {
      color: palette.onPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    achievementKey: {
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    achievementTitle: {
      fontSize: 19,
      lineHeight: 24,
      fontWeight: '900',
      marginTop: 4,
    },
    achievementSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '900',
      marginTop: 2,
      opacity: 0.88,
    },
    achievementBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 8,
    },
    cardScripture: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      fontStyle: 'italic',
      marginTop: 10,
    },
    cityDeclarationCard: {
      borderRadius: 26,
      paddingRight: 25,
      paddingBottom: 20,
      alignItems: 'center',
      overflow: 'hidden',
    },
    cityDeclarationLabel: {
      color: '#FFE8A3',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    cityDeclarationText: {
      color: '#FFF8E6',
      fontSize: 18,
      lineHeight: 31,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 8,
    },
    cityDeclarationScripture: {
      color: '#FFE8A3',
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 12,
    },
    simpleGrid: {
      gap: 10,
    },
    simpleCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    simpleIcon: {
      width: 38,
      height: 38,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    simpleTitle: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '900',
    },
    simpleScripture: {
      fontSize: 11,
      fontWeight: '900',
      fontStyle: 'italic',
      maxWidth: 92,
      textAlign: 'right',
    },
    moneyCard: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    resourceGrid: {
      gap: 9,
      marginTop: 15,
    },
    resourcePill: {
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    resourceText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '900',
    },
    finalCard: {
      borderRadius: 24,
      borderWidth: 1,
      padding: 18,
      backgroundColor: 'rgba(217,168,117,0.1)',
    },
    finalLabel: {
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    finalText: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '900',
      marginTop: 8,
    },
    finalScripture: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '900',
      fontStyle: 'italic',
      marginTop: 12,
    },
    bottomCloseButton: {
      position: 'absolute',
      right: 18,
      bottom: 16,
      minHeight: 46,
      borderRadius: 999,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: palette.shadow ?? '#000',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 7 },
      elevation: 8,
    },
    bottomCloseText: {
      color: palette.onPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    imagePreviewRoot: {
      flex: 1,
      backgroundColor: 'rgba(10,6,4,0.96)',
    },
    imagePreviewTopBar: {
      paddingTop: 58,
      paddingHorizontal: 18,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    imagePreviewTitle: {
      color: '#FFF8E6',
      fontSize: 16,
      fontWeight: '900',
    },
    imagePreviewClose: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,232,163,0.3)',
    },
    imagePreviewScroll: {
      flex: 1,
    },
    imagePreviewContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    fullImage: {
      width: '100%',
      height: 520,
    },
    zoomControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 28,
    },
    zoomButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,232,163,0.3)',
    },
    zoomButtonText: {
      color: '#FFF8E6',
      fontSize: 22,
      fontWeight: '900',
    },
    zoomText: {
      minWidth: 54,
      color: '#FFE8A3',
      textAlign: 'center',
      fontWeight: '900',
    },
    resetZoomButton: {
      minHeight: 44,
      borderRadius: 22,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,232,163,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,232,163,0.36)',
    },
    resetZoomText: {
      color: '#FFF8E6',
      fontWeight: '900',
    },
  });
