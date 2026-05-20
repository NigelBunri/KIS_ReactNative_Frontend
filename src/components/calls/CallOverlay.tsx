// src/components/calls/CallOverlay.tsx
// Kept for backwards compatibility. The active call UI is now in
// src/screens/calls/ActiveCallScreen.tsx and IncomingCallScreen.tsx,
// rendered directly from SocketProvider.

// Re-export types used by any callers.
export type CallOverlayState =
  | 'dialing'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'missed';

export type CallOverlaySession = {
  callId: string;
  conversationId: string;
  media: 'voice' | 'video';
  title: string;
  state: CallOverlayState;
  initiatedBy?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  muted?: boolean;
  speakerOn?: boolean;
  videoEnabled?: boolean;
  reason?: string | null;
};

export default function CallOverlay() {
  return null;
}
