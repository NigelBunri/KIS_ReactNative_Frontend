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
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

const KCAN_CITY_IMAGE = require('@/assets/KCAN_city.jpg');

type Props = {
  visible: boolean;
  onClose: () => void;
};

type CardItem = {
  title: string;
  body: string;
};

type PathwayItem = {
  step: string;
  title: string;
  body: string;
};

type StatItem = {
  value: string;
  label: string;
  body: string;
};

const KCAN_PURPOSE =
  'To help people discover their God-given purpose, create the best environment for that purpose to be expressed, and raise them through transformation: from men and women of purpose, to Kingdom citizens, and then to Kingdom ambassadors sent into the world for Kingdom expansion.';

const KCAN_VISION =
  'To build a lawful, covenant-based, city-like Kingdom ecosystem where God-given purpose can be discovered, formed, expressed, multiplied, and sent into the world through Kingdom Ambassadors, a people who have come to the stature of the fullness of Christ, institutions, products, and services for Kingdom expansion.';

const pillars: CardItem[] = [
  {
    title: 'A covenant community',
    body:
      'KCAN is a Christian covenant network where people do not only attend services or use an app. They are formed into a shared life of worship, discipleship, family dignity, service, accountability, work, stewardship, and Kingdom purpose.',
  },
  {
    title: 'A city-like environment',
    body:
      'The long-term picture is a master-planned environment that functions like a city: homes, schools, clinics, farms, workshops, logistics, digital systems, businesses, worship spaces, training centers, and productive communities working together.',
  },
  {
    title: 'A productive mission economy',
    body:
      'KCAN is not imagined as a place where people only live together. It is a place where people are trained, employed, mentored, and released to produce excellent products and services that can serve Cameroon, Africa, and the wider world.',
  },
  {
    title: 'A lawful institutional structure',
    body:
      'KCAN is not a parallel state and it is not a disguised private government. It is designed as a lawful faith-based residential, productive, educational, health, agricultural, and enterprise estate operating under Cameroonian and regional law.',
  },
  {
    title: 'A digital backbone',
    body:
      'KIS is the first visible public layer of the KCAN vision: a trusted digital social, administrative, learning, commerce, member-care, and communication platform for churches, schools, ministries, families, creators, businesses, and diaspora communities.',
  },
  {
    title: 'A sending network',
    body:
      'The goal is not isolation. KCAN forms people inside a covenant culture, equips them with practical capacity, and sends them as Kingdom ambassadors into media, technology, education, business, health, governance, agriculture, and the nations.',
  },
];

const cityLayers: CardItem[] = [
  {
    title: 'Homes and family stability',
    body:
      'The city-like model gives families a stable environment where daily life is supported by community standards, safe relationships, shared values, and access to practical services that reduce pressure and disorder.',
  },
  {
    title: 'Schools and formation',
    body:
      'Education is not treated as a side project. KCAN forms children, youth, workers, and leaders through schools, training institutes, online learning, mentorship, and a culture of excellence rooted in Christ.',
  },
  {
    title: 'Workshops, farms, and enterprise',
    body:
      'The physical economy includes agriculture, food processing, furniture, light manufacturing, logistics, construction services, media, technology, retail, and other businesses that create real work and external revenue.',
  },
  {
    title: 'Health, care, and restoration',
    body:
      'The health vision combines responsible medical care, prevention, counseling, family support, and spiritual care so that people are helped in body, soul, family, and purpose.',
  },
  {
    title: 'Digital administration',
    body:
      'KIS supports identity, communication, groups, teaching, verified accounts, payments or allocations where lawful, announcements, member care, records, marketplace activity, and coordination across the ecosystem.',
  },
  {
    title: 'Governance and peace',
    body:
      'A covenant city cannot survive by emotion alone. It needs written rules, accountable leadership, conflict resolution, financial controls, lawful entities, community participation, and clear separation between ministry, business, and resident life.',
  },
];

const pathway: PathwayItem[] = [
  {
    step: '01',
    title: 'Purpose discovered',
    body:
      'KCAN begins with the belief that every person carries a God-given assignment. The system helps people discover that assignment through discipleship, teaching, mentorship, community, and practical exposure.',
  },
  {
    step: '02',
    title: 'Purpose formed',
    body:
      'Discovery must become discipline. People are formed through education, work culture, spiritual accountability, family support, leadership development, and practical service inside a structured covenant environment.',
  },
  {
    step: '03',
    title: 'Purpose expressed',
    body:
      'The city-like environment gives people places to serve and build: classrooms, farms, clinics, teams, startups, workshops, media studios, digital products, businesses, and community programs.',
  },
  {
    step: '04',
    title: 'Citizens established',
    body:
      'KCAN citizenship is not political citizenship. It describes a people who live by Kingdom identity, covenant responsibility, shared stewardship, excellence, service, and love within lawful national structures.',
  },
  {
    step: '05',
    title: 'Ambassadors sent',
    body:
      'The end of the process is sending. KCAN raises ambassadors who carry Christ, competence, character, and solutions into the world through products, services, missions, institutions, and leadership.',
  },
];

const lawfulPoints: CardItem[] = [
  {
    title: 'Not a parallel state',
    body:
      'KCAN should never be presented as a sovereign city or separate jurisdiction. Cameroon remains fully sovereign. KCAN is better described as a private, master-planned, faith-based residential and productive estate under the law.',
  },
  {
    title: 'Not one company pretending residents are workers',
    body:
      'Some residents may be employees, some may be students, children, spouses, retirees, volunteers, entrepreneurs, ministry workers, or cooperative members. The structure should respect each category instead of forcing everyone into one legal box.',
  },
  {
    title: 'Separate but united entities',
    body:
      'The stronger design separates ministry, business, and community-benefit stewardship: Shekina Global for spiritual life, KIV for enterprise and production, and a resident cooperative or benefit vehicle for shared community functions.',
  },
  {
    title: 'Accountability protects the vision',
    body:
      'Boards, councils, financial controls, audit practices, succession rules, procurement discipline, and conflict-resolution systems do not weaken the spiritual vision. They make the vision durable, financeable, and trustworthy.',
  },
];

const kisRoles: CardItem[] = [
  {
    title: 'Communication',
    body:
      'KIS gives churches, ministries, families, departments, teams, schools, and communities a trusted space for messaging, groups, announcements, media, teaching, events, and coordination.',
  },
  {
    title: 'Digital administration',
    body:
      'KIS can become the digital office for verified profiles, member records, roles, groups, permissions, learning access, community updates, giving channels, support requests, and transparent operations.',
  },
  {
    title: 'Learning and formation',
    body:
      'KIS can host lessons, devotionals, leadership courses, school content, mentorship programs, ministry training, professional training, and purpose-development pathways.',
  },
  {
    title: 'Commerce and services',
    body:
      'KIS can connect KCAN products, marketplace activity, creators, shops, services, education, health information, and trusted vendors while keeping the culture orderly and values-driven.',
  },
];

const outcomes: string[] = [
  'Purpose-driven people who discover, refine, and express their God-given assignment.',
  'Families supported by worship, work, education, health access, care, and trusted community.',
  'A lawful Christian ecosystem that demonstrates discipline, productivity, excellence, and compassion.',
  'A production-centered environment where residents and partners build products and services for the world.',
  'A Cameroon launch model that can become a disciplined template for other nations without pretending to be a separate state.',
];

const partnerStats: StatItem[] = [
  {
    value: 'KIS',
    label: 'First public layer',
    body:
      'The app introduces people to the KCAN culture before the full physical estate exists.',
  },
  {
    value: 'KIV',
    label: 'Enterprise engine',
    body:
      'The business arm produces goods, services, employment, and revenue for mission durability.',
  },
  {
    value: 'SG',
    label: 'Spiritual formation',
    body:
      'Shekina Global guards worship, discipleship, pastoral care, mission, and covenant identity.',
  },
];

const operatingPrinciples: CardItem[] = [
  {
    title: 'Faith with structure',
    body:
      'The spiritual life gives KCAN its heart, but structure gives the vision endurance. The system must be prayerful, lawful, documented, auditable, and operationally clear.',
  },
  {
    title: 'Production with compassion',
    body:
      'KCAN is not only about earning money. Work exists to serve people, develop gifts, create dignity, provide stability, and send excellent solutions into the world.',
  },
  {
    title: 'Community without confusion',
    body:
      'Covenant life should never erase legal clarity. Residents, employees, students, ministers, investors, and cooperative members need clear rights, duties, protections, and responsibilities.',
  },
  {
    title: 'Growth without losing identity',
    body:
      'As KCAN grows from digital community to physical estate and global network, its identity must remain Christ-centered, purpose-driven, accountable, and service-oriented.',
  },
];

const SectionHeader = ({
  label,
  title,
  body,
  palette,
}: {
  label: string;
  title: string;
  body?: string;
  palette: ReturnType<typeof useKISTheme>['palette'];
}) => (
  <View style={stylesStatic.headerBlock}>
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
  </View>
);

export default function KcanVisionModal({ visible, onClose }: Props) {
  const { palette, tone } = useKISTheme();
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
          contentContainerStyle={styles.scrollContent}
        >
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Open KCAN city image"
            onPress={() => setImagePreviewVisible(true)}
          >
            <ImageBackground
              source={KCAN_CITY_IMAGE}
              resizeMode="cover"
              style={styles.hero}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={['rgba(17,10,7,0.12)', 'rgba(17,10,7,0.82)']}
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
                <Text style={styles.heroSubtitle}>
                 {KCAN_PURPOSE}
                </Text>
                <View style={styles.imageHint}>
                  <KISIcon name="fullscreen" size={14} color="#FFE8A3" />
                  <Text style={styles.imageHintText}>Tap the city to view and zoom</Text>
                </View>
              </View>
            </ImageBackground>
          </Pressable>

          <View style={styles.body}>
            <LinearGradient
              colors={goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statementCard}
            >
              <View style={styles.statementInner}>
                <Text style={styles.statementEyebrow}>KCAN vision</Text>
                <Text style={styles.statementText}>{KCAN_VISION}</Text>
              </View>
            </LinearGradient>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="How the vision flows from the purpose"
                title="Because purpose needs an environment, KCAN becomes a covenant city-like ecosystem."
                body="The purpose is not only to tell people that they have a God-given assignment. KCAN must also create the kind of environment where that assignment can be discovered, trained, expressed, tested, matured, and released. That is why the vision naturally becomes city-like: families live in covenant, workers produce with excellence, schools form minds, farms and workshops supply needs, health systems care for people, and digital systems coordinate everything."
                palette={palette}
              />
            </View>

            <View style={styles.pillarGrid}>
              {pillars.map(item => (
                <View
                  key={item.title}
                  style={[
                    styles.pillarCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.goldLight,
                    },
                  ]}
                >
                  <View style={[styles.pillarIcon, { backgroundColor: palette.primarySoft }]}>
                    <KISIcon name="shield" size={18} color={palette.primaryStrong} />
                  </View>
                  <Text style={[styles.pillarTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.pillarBody, { color: palette.subtext }]}>
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="KIS in the KCAN vision"
                title="Kingdom Impact Social is the first digital city gate."
                body="KIS introduces the world to KCAN before the physical estate is fully built. It is the trusted digital layer where people communicate, learn, publish, organize, care, trade, give, and grow under clear Christian principles. KIS is not replacing KCAN; it is the first visible platform that carries the KCAN culture into homes, churches, schools, ministries, businesses, and diaspora communities."
                palette={palette}
              />
            </View>

            <View style={styles.roleGrid}>
              {kisRoles.map(item => (
                <View
                  key={item.title}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.goldLight,
                    },
                  ]}
                >
                  <Text style={[styles.roleTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.roleBody, { color: palette.subtext }]}>
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.cityCard, { backgroundColor: palette.card }]}>
              <SectionHeader
                label="How the covenant city works"
                title="A complete environment for life, work, worship, and production."
                body="The KCAN estate is envisioned as a place where the spiritual and practical parts of life are not separated. Worship forms the heart. Education forms the mind. Work forms discipline. Enterprise creates value. Health and care protect the people. Digital systems connect the whole community. Governance keeps the system lawful and accountable."
                palette={palette}
              />

              <View style={styles.cityLayerGrid}>
                {cityLayers.map(item => (
                  <View
                    key={item.title}
                    style={[
                      styles.cityLayerCard,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.goldLight,
                      },
                    ]}
                  >
                    <Text style={[styles.cityLayerTitle, { color: palette.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.cityLayerBody, { color: palette.subtext }]}>
                      {item.body}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="Purpose pathway"
                title="The purpose becomes a transformation journey."
                body={KCAN_PURPOSE}
                palette={palette}
              />
            </View>

            <View style={styles.timeline}>
              {pathway.map((item, index) => (
                <View key={item.step} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: palette.primaryStrong }]}>
                      <Text style={styles.timelineStep}>{item.step}</Text>
                    </View>
                    {index < pathway.length - 1 ? (
                      <View style={[styles.timelineLine, { backgroundColor: palette.goldLight }]} />
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.timelineCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.goldLight,
                      },
                    ]}
                  >
                    <Text style={[styles.timelineTitle, { color: palette.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.timelineBody, { color: palette.subtext }]}>
                      {item.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.lawfulCard, { backgroundColor: palette.surface }]}> 
              <SectionHeader
                label="Lawful, not confusing"
                title="The legal structure protects the city vision."
                body="The lawful section should now feel natural because the page has already explained the city-like environment. KCAN is a covenant community, but it must be organized in a way that regulators, banks, investors, residents, workers, and partners can understand. The stronger structure is not one confused entity. It is a coordinated ecosystem."
                palette={palette}
              />

              <View style={styles.lawfulGrid}>
                {lawfulPoints.map(item => (
                  <View
                    key={item.title}
                    style={[
                      styles.lawfulPoint,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.goldLight,
                      },
                    ]}
                  >
                    <Text style={[styles.lawfulTitle, { color: palette.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.lawfulBody, { color: palette.subtext }]}>
                      {item.body}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: palette.surface }]}>
              <SectionHeader
                label="Why Cameroon first"
                title="A launch ground where purpose, youth, need, and opportunity meet."
                body="Cameroon gives KCAN a meaningful first ground because the need is both spiritual and practical: youth need purpose, families need stability, communities need trustworthy institutions, and the economy needs productive systems. KCAN answers by combining covenant life, lawful structure, education, work, digital community, agriculture, health, and enterprise."
                palette={palette}
              />
            </View>

            <View style={[styles.statsCard, { backgroundColor: palette.card }]}> 
              <SectionHeader
                label="Three connected arms"
                title="One vision, clear responsibilities."
                palette={palette}
              />

              <View style={styles.statsGrid}>
                {partnerStats.map(item => (
                  <View
                    key={item.value}
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.goldLight,
                      },
                    ]}
                  >
                    <Text style={[styles.statValue, { color: palette.primaryStrong }]}>
                      {item.value}
                    </Text>
                    <Text style={[styles.statLabel, { color: palette.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.statBody, { color: palette.subtext }]}>
                      {item.body}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.principlesCard, { backgroundColor: palette.surface }]}> 
              <SectionHeader
                label="Operating principles"
                title="The culture that keeps KCAN coherent."
                body="This page should make the vision feel serious, beautiful, and understandable. KCAN is not emotional noise. It is a disciplined call to build a place, a platform, and a people who can serve Christ with excellence in every sphere of life."
                palette={palette}
              />

              <View style={styles.principleGrid}>
                {operatingPrinciples.map(item => (
                  <View
                    key={item.title}
                    style={[
                      styles.principleCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.goldLight,
                      },
                    ]}
                  >
                    <Text style={[styles.principleTitle, { color: palette.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.principleBody, { color: palette.subtext }]}>
                      {item.body}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.outcomesCard, { borderColor: palette.goldLight }]}> 
              <Text style={[styles.sectionLabel, { color: palette.primaryStrong }]}> 
                What to expect
              </Text>
              {outcomes.map((item, index) => (
                <View key={item} style={styles.outcomeRow}>
                  <View style={[styles.outcomeNumber, { backgroundColor: palette.primarySoft }]}> 
                    <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.outcomeText, { color: palette.text }]}> 
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.investorCard, { backgroundColor: palette.card }]}> 
              <Text style={[styles.sectionLabel, { color: palette.primaryStrong }]}> 
                For serious partners
              </Text>
              <Text style={[styles.sectionTitle, { color: palette.text }]}> 
                KCAN is designed for builders, not spectators.
              </Text>
              <Text style={[styles.sectionBody, { color: palette.subtext }]}> 
                The invitation is to visionary builders, churches, families,
                institutions, investors, workers, educators, health partners,
                creators, and diaspora communities who want to help prove that
                faith, lawfulness, productivity, care, excellence, and governance
                can stand together. KIS can grow as a technology venture. KIV can
                grow as an enterprise engine. Shekina Global can guard spiritual
                formation. KCAN is the broader Kingdom impact ecosystem that
                holds the mission together.
              </Text>
              <Text style={[styles.closingLine, { color: palette.text }]}> 
                We are building a covenant network where purpose becomes
                transformation, transformation becomes citizenship, and citizenship
                becomes Kingdom ambassadorship.
              </Text>
            </View>
            <EnterpriseKcanRevenuePreviewCard
              palette={palette}
              kind="kcan_vision"
              title="KCAN enterprise and investor packaging preview"
              subtitle="Annual contracts, KCAN network packaging, verified trust, implementation support, and launch evidence are visible for planning only."
            />
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.bottomCloseButton, { backgroundColor: palette.primaryStrong }]}
        >
          <KISIcon name="close" size={18} color={palette.bg} />
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
      paddingBottom: 28,
      paddingRight: 20,
    },
    statementDivider: {
      height: 1,
      backgroundColor: 'rgba(255,232,163,0.24)',
      marginVertical: 18,
    },
    statementEyebrow: {
      color: '#FFE8A3',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    statementTitle: {
      color: '#FFF8E6',
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      marginTop: 8,
      letterSpacing: 0,
    },
    statementText: {
      color: '#FFF3D2',
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '700',
      marginTop: 10,
    },
    section: {
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
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
    pillarGrid: {
      gap: 10,
    },
    pillarCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 15,
    },
    pillarIcon: {
      width: 40,
      height: 40,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    pillarTitle: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0,
    },
    pillarBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 6,
    },
    roleGrid: {
      gap: 10,
    },
    roleCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 15,
    },
    roleTitle: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
    },
    roleBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 7,
    },
    cityCard: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    cityLayerGrid: {
      gap: 10,
      marginTop: 14,
    },
    cityLayerCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    cityLayerTitle: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
    },
    cityLayerBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 7,
    },
    timeline: {
      gap: 0,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    timelineRail: {
      width: 50,
      alignItems: 'center',
    },
    timelineDot: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    timelineStep: {
      color: '#FFF8E6',
      fontSize: 11,
      fontWeight: '900',
    },
    timelineLine: {
      flex: 1,
      width: 2,
      marginVertical: 4,
      opacity: 0.9,
    },
    timelineCard: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    timelineTitle: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
    },
    timelineBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 7,
    },
    lawfulCard: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    lawfulGrid: {
      gap: 10,
      marginTop: 14,
    },
    lawfulPoint: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    lawfulTitle: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
    },
    lawfulBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 7,
    },
    statsCard: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    statsGrid: {
      gap: 10,
      marginTop: 14,
    },
    statBox: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: 0,
    },
    statLabel: {
      fontSize: 14,
      fontWeight: '900',
      marginTop: 2,
    },
    statBody: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
      marginTop: 7,
    },
    principlesCard: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    principleGrid: {
      gap: 10,
      marginTop: 14,
    },
    principleCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    principleTitle: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
    },
    principleBody: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 7,
    },
    outcomesCard: {
      borderRadius: 22,
      borderWidth: 1,
      padding: 16,
      backgroundColor: 'rgba(217,168,117,0.1)',
      gap: 12,
    },
    outcomeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    outcomeNumber: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    outcomeText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '800',
    },
    investorCard: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.goldLight,
    },
    closingLine: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '900',
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
      color: palette.bg,
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
