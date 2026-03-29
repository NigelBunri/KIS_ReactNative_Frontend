import { StyleSheet } from 'react-native';
import { profileLayout } from '@/screens/tabs/profile/profile.styles';

export const marketLayout = {
  drawerWidth: profileLayout.SCREEN_WIDTH,
};

export const marketStyles = StyleSheet.create({
  heroCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    opacity: 0.25,
  },
  heroContent: {
    gap: 12,
  },
  heroCTA: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsCard: {
    borderRadius: 18,
    padding: 16,
    flex: 1,
    minWidth: 140,
    minHeight: 96,
    borderWidth: 1,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  analyticsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 18,
  },
  toolbar: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolbarSearch: {
    flex: 1,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  shopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  shopCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  shopCardBanner: {
    height: 120,
    justifyContent: 'flex-end',
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  shopCardBannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  shopCardBannerContent: {
    position: 'relative',
    zIndex: 1,
  },
  shopCardBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  shopCardBody: {
    padding: 16,
    gap: 10,
  },
  shopMetaRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  kpiItem: {
    flex: 1,
    minWidth: 80,
  },
  kpiLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  overflowButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: marketLayout.drawerWidth,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: -4, height: 0 },
    elevation: 18,
  },
  drawerContent: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  drawerSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  drawerBody: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 180,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerSection: {
    gap: 10,
    marginTop: 20,
  },
  drawerRule: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    marginVertical: 6,
  },
  drawerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  drawerSectionHelper: {
    fontSize: 12,
  },
  drawerStepper: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  drawerStepperDot: {
    width: 30,
    height: 6,
    borderRadius: 3,
  },
  previewCard: {
    borderRadius: 18,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  drawerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  drawerFooterActions: {
    flexDirection: 'column',
    gap: 8,
    flexWrap: 'wrap',
  },
});
