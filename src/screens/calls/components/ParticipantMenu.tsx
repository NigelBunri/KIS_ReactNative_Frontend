// src/screens/calls/components/ParticipantMenu.tsx
//
// The 3-dot menu opened from a participant's tile (ParticipantTile) or, for
// the 1:1 layouts, from their bespoke avatar card. Two sections:
//  - "For you" — local-only viewer preferences (view large, prioritize
//    their audio, hide for me). Never touches the shared call session.
//  - "Moderation" — host/caller-only actions that affect the whole call,
//    only rendered when `moderation.canModerate` is true.
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { ModerationControls, ViewerPrefs } from './participantControls';

type Props = {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  isPinned?: boolean;
  // Gates the "View large" row — only offered when the participant
  // actually has a live video feed right now.
  canViewLarge?: boolean;
  viewerPrefs?: ViewerPrefs;
  moderation?: ModerationControls;
};

export default function ParticipantMenu({
  visible,
  onClose,
  displayName,
  isPinned,
  canViewLarge,
  viewerPrefs,
  moderation,
}: Props) {
  const { palette } = useKISTheme();

  const close = (action?: () => void) => {
    onClose();
    action?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: palette.card }]} onPress={() => {}}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {displayName}
          </Text>

          {viewerPrefs?.onPin && canViewLarge && (
            <MenuRow
              icon="pin"
              label={isPinned ? 'Stop viewing large' : 'View large'}
              palette={palette}
              onPress={() => close(viewerPrefs.onPin)}
            />
          )}
          {viewerPrefs?.onToggleAudioFocus && (
            <MenuRow
              icon="volume"
              label={viewerPrefs.isAudioFocused ? 'Stop prioritizing their audio' : 'Prioritize their audio'}
              palette={palette}
              onPress={() => close(viewerPrefs.onToggleAudioFocus)}
            />
          )}
          {viewerPrefs?.onToggleHide && (
            <MenuRow
              icon="eye-closed"
              label="Hide for me"
              palette={palette}
              onPress={() => close(viewerPrefs.onToggleHide)}
            />
          )}

          {moderation?.canModerate && (
            <>
              <View style={[styles.divider, { backgroundColor: palette.inputBorder }]} />

              {moderation.onMute && (
                <MenuRow
                  icon={moderation.isMuted ? 'mic' : 'mic-off'}
                  label={moderation.isMuted ? 'Unmute' : 'Mute (they can unmute)'}
                  palette={palette}
                  onPress={() => close(moderation.onMute)}
                />
              )}
              {moderation.onSetMuteLock && (
                <MenuRow
                  icon="lock"
                  label={moderation.isMuteLocked ? 'Unlock their mic' : 'Mute permanently (locked)'}
                  palette={palette}
                  onPress={() => close(() => moderation.onSetMuteLock!(!moderation.isMuteLocked))}
                />
              )}
              {moderation.onSetVideoLock && (
                <MenuRow
                  icon="video-off"
                  label={moderation.isVideoLocked ? 'Allow their video again' : 'Turn off their video for everyone'}
                  palette={palette}
                  onPress={() => close(() => moderation.onSetVideoLock!(!moderation.isVideoLocked))}
                />
              )}
              {moderation.onSetPanelist && (
                <MenuRow
                  icon={moderation.isPanelist ? 'arrow-down-left' : 'arrow-up-right'}
                  label={moderation.isPanelist ? 'Move to participants' : 'Move to panel'}
                  palette={palette}
                  onPress={() => close(() => moderation.onSetPanelist!(!moderation.isPanelist))}
                />
              )}
              {moderation.onPromote && (
                <MenuRow
                  icon="star"
                  label="Make co-host"
                  palette={palette}
                  onPress={() => close(() => moderation.onPromote!('co-host'))}
                />
              )}
              {moderation.onEndCall && (
                <MenuRow
                  icon="phone-off"
                  label="End their call"
                  palette={palette}
                  danger
                  onPress={() => close(moderation.onEndCall)}
                />
              )}
              {moderation.onRemove && (
                <MenuRow
                  icon="user-minus"
                  label="Remove from call"
                  palette={palette}
                  danger
                  onPress={() => close(moderation.onRemove)}
                />
              )}
            </>
          )}

          <MenuRow icon="close" label="Cancel" palette={palette} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({ icon, label, palette, onPress, danger }: {
  icon: string;
  label: string;
  palette: any;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <KISIcon name={icon} size={18} color={danger ? palette.danger : palette.text} />
      <Text style={[styles.rowLabel, { color: danger ? palette.danger : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6, opacity: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
});
