// src/screens/calls/components/participantControls.ts
//
// Shared shape for the per-participant 3-dot menu (ParticipantMenu, opened
// from ParticipantTile) and the helpers that build it from the flat
// `ParticipantControls` bundle every call layout (VideoGrid, BroadcastLayout,
// VoiceCallGrid, the 1:1 layouts) receives from ActiveCallScreen. Centralized
// here so each layout just calls buildModerationProps/buildViewerPrefs
// instead of repeating the same per-participant binding five times.
import type { CallParticipant } from '@/services/calls/callTypes';

// "For you" — purely local to this viewer's own device, never synced to
// anyone else on the call.
export type ViewerPrefs = {
  onPin?: () => void;
  isAudioFocused?: boolean;
  onToggleAudioFocus?: () => void;
  onToggleHide?: () => void;
};

// "Moderation" — visible/synced to the whole call; only rendered by
// ParticipantMenu when canModerate is true.
export type ModerationControls = {
  canModerate: boolean;
  isMuted?: boolean;
  onMute?: () => void;
  isMuteLocked?: boolean;
  onSetMuteLock?: (locked: boolean) => void;
  isVideoLocked?: boolean;
  onSetVideoLock?: (locked: boolean) => void;
  isPanelist?: boolean;
  onSetPanelist?: (isPanelist: boolean) => void;
  role?: string;
  onPromote?: (role: string) => void;
  onRemove?: () => void;
  onEndCall?: () => void;
};

// Flat bundle a call layout receives as a single prop from ActiveCallScreen
// — one object instead of ~12 scalar callback props threaded through every
// grid component.
export type ParticipantControls = {
  canModerate: boolean;
  onMuteParticipant?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  onEndParticipantCall?: (userId: string) => void;
  onSetParticipantMuteLock?: (userId: string, locked: boolean) => void;
  onSetParticipantVideoLock?: (userId: string, locked: boolean) => void;
  onSetParticipantPanelist?: (userId: string, isPanelist: boolean) => void;
  onPromoteParticipant?: (userId: string, role: string) => void;
  audioFocusUserId: string | null;
  onToggleAudioFocus: (userId: string) => void;
  onToggleHidden: (userId: string) => void;
  // Tapping any tile's body also toggles the top/bottom chrome, same as
  // tapping blank space — see ActiveCallScreen's toggleControls.
  onToggleChrome: () => void;
};

export function buildModerationProps(controls: ParticipantControls, participant: CallParticipant): ModerationControls {
  if (!controls.canModerate || participant.isLocal) return { canModerate: false };
  return {
    canModerate: true,
    isMuted: participant.isMuted,
    onMute: controls.onMuteParticipant ? () => controls.onMuteParticipant!(participant.userId) : undefined,
    isMuteLocked: participant.isMuteLocked,
    onSetMuteLock: controls.onSetParticipantMuteLock
      ? (locked: boolean) => controls.onSetParticipantMuteLock!(participant.userId, locked)
      : undefined,
    isVideoLocked: participant.isVideoLocked,
    onSetVideoLock: controls.onSetParticipantVideoLock
      ? (locked: boolean) => controls.onSetParticipantVideoLock!(participant.userId, locked)
      : undefined,
    // Only meaningful for broadcast participants — see CallParticipant.isPanelist.
    isPanelist: participant.isPanelist,
    onSetPanelist: controls.onSetParticipantPanelist && typeof participant.isPanelist === 'boolean'
      ? (v: boolean) => controls.onSetParticipantPanelist!(participant.userId, v)
      : undefined,
    role: participant.role,
    onPromote: controls.onPromoteParticipant && participant.role !== 'co-host'
      ? (role: string) => controls.onPromoteParticipant!(participant.userId, role)
      : undefined,
    onRemove: controls.onRemoveParticipant ? () => controls.onRemoveParticipant!(participant.userId) : undefined,
    onEndCall: controls.onEndParticipantCall ? () => controls.onEndParticipantCall!(participant.userId) : undefined,
  };
}

export function buildViewerPrefs(
  controls: ParticipantControls,
  participant: CallParticipant,
  opts?: { onPin?: () => void },
): ViewerPrefs {
  if (participant.isLocal) {
    // Nothing here makes sense pointed at yourself (can't hide/prioritize/
    // pin-large your own tile).
    return {};
  }
  return {
    onPin: opts?.onPin,
    isAudioFocused: controls.audioFocusUserId === participant.userId,
    onToggleAudioFocus: () => controls.onToggleAudioFocus(participant.userId),
    onToggleHide: () => controls.onToggleHidden(participant.userId),
  };
}
