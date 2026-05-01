// src/screens/tabs/profile/ProfileStyles.ts
import { StyleSheet, Dimensions, Platform } from 'react-native';
import { FONT_WEIGHTS } from '@/theme/foundations/fonts';
import { TYPOGRAPHY_PRESETS } from '@/theme/foundations/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const profileLayout = { SCREEN_WIDTH, SCREEN_HEIGHT };

export const styles = StyleSheet.create({
  wrap: { flex: 1 },

  // Screen spacing matches mock (tighter than before)
  scroll: {gap: 14, paddingBottom: 48 },

  /** ─────────────────────────
   *  Cards (mock-like)
   *  ───────────────────────── */
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },

  sectionCard: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 3,
  },
  broadcastProfileCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  broadcastProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  broadcastProfileIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastProfileInfo: {
    flex: 1,
    gap: 4,
  },
  broadcastProfileTitle: {
    ...TYPOGRAPHY_PRESETS.title,
    fontWeight: FONT_WEIGHTS.bold,
  },
  broadcastProfileSubtitle: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontWeight: FONT_WEIGHTS.regular,
  },
  broadcastProfileMeta: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  partnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /** ─────────────────────────
   *  Hero
   *  ───────────────────────── */
  heroCard: { height: 320, borderRadius: 26, overflow: 'hidden' },

  // gradient/top bar area (HeroHeader uses these)
  heroTop: { height: 320, position: 'relative' },

  // subtle glows like the mock (orange/purple)
  heroCoverImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    },

    heroCoverScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: "-120%",
    backgroundColor: 'rgba(0,0,0,0.42)', // dark enough for white text
    },

  heroGlow: {
    position: 'absolute',
    right: -56,
    top: -46,
    width: 190,
    height: 190,
    borderRadius: 120,
    opacity: 0.55,
  },
  heroGlow2: {
    position: 'absolute',
    left: -52,
    bottom: -72,
    width: 210,
    height: 210,
    borderRadius: 140,
    opacity: 0.35,
  },

  heroBody: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    marginTop: -180,
  },

  avatarWrap: {
    width: 94,
    height: 94,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 94, height: 94, borderRadius: 30 },

  heroName: {
    ...TYPOGRAPHY_PRESETS.h1,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  heroHandle: {
    ...TYPOGRAPHY_PRESETS.helper,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  heroHeadline: {
    ...TYPOGRAPHY_PRESETS.body,
    marginTop: 6,
    lineHeight: 20,
  },

  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },

  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontWeight: FONT_WEIGHTS.semibold,
  },

  /** ─────────────────────────
   *  Stats chips (mock-like)
   *  ───────────────────────── */
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },

  statChip: {
    minWidth: 112,
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },

  statLabel: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  statValue: {
    ...TYPOGRAPHY_PRESETS.h2,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  statMeta: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontWeight: FONT_WEIGHTS.regular,
  },

  managementPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: profileLayout.SCREEN_WIDTH,
    elevation: 20,
  },
  managementPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  managementClose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  managementCloseText: {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  managementPanelTitle: {
    ...TYPOGRAPHY_PRESETS.title,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  managementPanelSubtitle: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontSize: 12,
    marginTop: 4,
  },
  managementPanelBody: {
    padding: 16,
    gap: 12,
  },
  managementStatsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  managementStat: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    padding: 10,
    borderColor: '#FF8A33',
  },
  managementStatValue: {
    ...TYPOGRAPHY_PRESETS.title,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  managementStatLabel: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontSize: 12,
    marginTop: 4,
  },
  managementItemCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  managementItemTitle: {
    fontWeight: FONT_WEIGHTS.bold,
  },
  managementItemMeta: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontSize: 12,
  },
  managementForm: {
    gap: 10,
  },
  managementAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  managementAssetInfo: {
    flex: 1,
    marginLeft: 12,
    borderWidth: 2,
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  managementFormLabel: {
    fontWeight: FONT_WEIGHTS.bold,
  },
  managementFormHint: {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.regular,
  },
  managementTypePill: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  managementFeatureList: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  managementFeatureItem: {
    fontSize: 12,
  },
  managementAttachments: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  managementAssetItem: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  managementAssetImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  managementAssetPlaceholder: {
    width: '100%',
    height: 140,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managementActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },

  /** ─────────────────────────
   *  Section headers
   *  ───────────────────────── */
  headerRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },

  title: {
    ...TYPOGRAPHY_PRESETS.title,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  link: {
    ...TYPOGRAPHY_PRESETS.title,
    fontWeight: FONT_WEIGHTS.extrabold,
  },

  /** ─────────────────────────
   *  Rows / Items
   *  ───────────────────────── */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  itemInfo: { flex: 1, gap: 4 },

  itemTitle: {
    ...TYPOGRAPHY_PRESETS.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },

  subtext: {
    ...TYPOGRAPHY_PRESETS.helper,
    fontWeight: FONT_WEIGHTS.regular,
  },

  thumb: { width: 48, height: 48, borderRadius: 14 },

  rowActions: { flexDirection: 'row', gap: 12 },

  /** ─────────────────────────
   *  Chips
   *  ───────────────────────── */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },

  /** ─────────────────────────
   *  Actions
   *  ───────────────────────── */
  actionRow: { flexDirection: 'row', gap: 12 },

  /** ─────────────────────────
   *  Edit media (Edit Profile sheet)
   *  ───────────────────────── */
  editMediaRow: { flexDirection: 'row', gap: 12 },

  mediaPickCard: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },

  mediaPickImage: {
    width: 66,
    height: 66,
    borderRadius: 22,
  },

  mediaPickImageWide: {
    width: '100%',
    height: 92,
    borderRadius: 14,
  },

  mediaPickLabel: { fontSize: 13, fontWeight: '800' },

  /** ─────────────────────────
   *  Privacy sheet
   *  ───────────────────────── */
  privacyRow: {
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  privacyLabel: { fontWeight: '800' },

  privacyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  privacyChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 2,
  },

  /** ─────────────────────────
   *  Wallet sheet
   *  ───────────────────────── */
  walletModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  walletModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 2,
  },

  /** ─────────────────────────
   *  Upgrade sheet
   *  ───────────────────────── */
  tierCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    gap: 10,
  },

  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  tierTitle: { fontSize: 16, fontWeight: '900' },
  tierTagline: { marginTop: 4, fontSize: 13 },

  tierBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tierBadgeText: { fontSize: 12, fontWeight: '900' },

  tierPrice: { fontSize: 20, fontWeight: '900' },
  tierHighlight: { fontSize: 13, fontWeight: '800' },

  tierFeatures: { gap: 6, marginTop: 2 },

  tierFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  tierFeatureText: { fontSize: 13, fontWeight: '600' },

  tierActionRow: { marginTop: 8 },

  /** ─────────────────────────
   *  Overlay slide + sheet host
   *  ───────────────────────── */
  slideContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    right: 0,
    elevation: 25,
    zIndex: 99,
  },

  sheetWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    zIndex: 120,
  },

  sheet: {
    marginTop: 80,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
  },
  sheetTitle: {
    ...TYPOGRAPHY_PRESETS.title,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
});
