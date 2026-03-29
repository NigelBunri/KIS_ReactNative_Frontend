// src/screens/tabs/partnersStyles.ts
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },

  appLaunchBar: {
    position: 'absolute',
    right: 24 ,
    bottom: 40,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    zIndex: 99,
  },
  appLaunchButton: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  appLaunchIcon: {
    width: 20,
    height: 20,
  },

  // LEFT RAIL
  leftRail: {
    flexDirection: 'column',
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  addPartnerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  partnerList: {
    alignItems: 'center',
  },
  partnerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CENTER
  centerPane: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  centerScrollContent: {
    paddingBottom: 24,
  },
  partnerHeader: {
    marginBottom: 12,
  },
  partnerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    marginRight: 8,
  },
  partnerTagline: {
    fontSize: 13,
    marginTop: 4,
  },

  // Admins
  adminsSection: {
    marginBottom: 12,
  },
  adminsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  adminsList: {
    paddingVertical: 2,
  },
  adminCard: {
    width: 90,
    marginRight: 10,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  // Sections
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderMeta: {
    fontSize: 12,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 2,
  },
  groupHash: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  // Communities
  communityCard: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  communityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  communityGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
    marginLeft: 4,
    borderWidth: 2,
  },

  // RIGHT MESSAGES PANE
  messagesPane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderLeftWidth: 1,
    zIndex: 20,
    elevation: 4,
  },
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  messagesTitleWrap: {
    flex: 1,
  },
  messagesTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  messagesSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  messagesBody: {
    flex: 1,
    paddingVertical: 8,
  },
  messagesPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  messagesPlaceholderText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // PARTNER SETTINGS BOTTOM SHEET
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
    elevation: 6,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  sheetSection: {
    marginBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetSectionText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // PARTNER SETTINGS SHEET
  settingsSheetHeader: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingsSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  settingsRoleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  settingsRoleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  settingsSectionCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  settingsSectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  settingsSectionMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  settingsSectionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  settingsSectionActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  // SETTINGS PANEL
  settingsPanelOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    zIndex: 40,
    elevation: 6,
  },
  settingsPanelBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  settingsPanelContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    borderLeftWidth: 1,
  },
  settingsPanelHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsPanelTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  settingsPanelDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsPanelBody: {
    padding: 16,
  },
  settingsFeatureRow: {
    borderRadius: 10,
    borderWidth: 2,
    padding: 10,
    marginBottom: 8,
  },
  settingsFeatureTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingsFeatureDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  settingsFeatureMeta: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  settingsTextInput: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    fontSize: 13,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  overviewCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 2,
    padding: 10,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  overviewLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  overviewMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  insightsBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 50,
  },
  insightsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default styles;
