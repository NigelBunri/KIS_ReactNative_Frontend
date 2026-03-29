// src/screens/chat/styles/chatRoomStyles.ts

import { StyleSheet } from 'react-native';

export const chatRoomStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardWrapper: {
    flex: 1,
  },

  composerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },

  banner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 14,
  },
  text: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  btnPrimary: {},
  btnSecondary: {},
  btnDanger: {},

  // used across header / composer
  iconTextButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },

  /* HEADER */

  header: {
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBackButton: {
    padding: 8,
    marginRight: 2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
  },
  headerContext: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 6,
    marginHorizontal: 2,
  },

  /* COMPOSER */

  composerContainer: {
    flexDirection: 'column',   // stack banner + preview + main row
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'center',
  },

  composerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  composerInputWrapper: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    maxHeight: 120,
    justifyContent: 'center',
  },

  composerInput: {
    fontSize: 15,
    paddingVertical: 4,
  },

  composerActionButton: {
    width: 35,
    height: 35,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  /* Recording banner */

  voiceRecordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  voiceRecordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceRecordingDot: {
    fontSize: 14,
    marginRight: 4,
  },
  voiceRecordingTime: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  voiceRecordingHint: {
    fontSize: 11,
  },

  /* Wave visualizer */

  voiceWaveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginHorizontal: 2,
    bottom: 50,
  },
  voiceWaveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.25)', // real color set via parent bg
    marginHorizontal: 1,
  },

  /* Preview row */

  voicePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  voicePreviewMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  voicePreviewTextCol: {
    marginLeft: 8,
    flex: 1,
  },
  voicePreviewTime: {
    fontSize: 13,
    marginBottom: 2,
  },
  voicePreviewProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  voicePreviewProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  voicePreviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  voicePreviewIconButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginLeft: 4,
  },

  /* Locked recording actions row */

  voiceLockedActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginHorizontal: 8,
  },
  voiceLockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  voiceLockedButtonText: {
    fontSize: 12,
    marginLeft: 4,
  },

  /* MESSAGE LIST */

  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  messageRow: {
    marginVertical: 2,
    paddingHorizontal: 4,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    // WhatsApp-style radii (more rounded on one side)
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
  },
  messageText: {
    fontSize: 15,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  messageStatus: {
    fontSize: 11,
  },

  timestampHeaderContainer: {
    alignItems: 'center',
    marginVertical: 6,
  },
  timestampHeaderText: {
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  emptyStateContainer: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  voiceRecordingText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Voice preview row */

  voicePreviewWave: {
    height: 16,
    flex: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)', // placeholder waveform
    marginRight: 8,
  },

  iconEmoji: {
    fontSize: 22,
  },
  iconPlus: {
    fontSize: 24,
  },
  composerActionIcon: {
    fontSize: 18,
    fontWeight: '600',
  },

  /* ────────────────────────────────────────
   *  BOTTOM SHEETS (Forward / Pinned / Sub-rooms)
   * ────────────────────────────────────── */

  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
});
