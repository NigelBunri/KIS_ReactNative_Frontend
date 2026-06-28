// src/services/calls/callTypes.ts

export type CallType =
  | 'voice'
  | 'video'
  | 'voice-group'
  | 'video-group'
  | 'broadcast';

export type CallState =
  | 'dialing'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'missed'
  | 'lobby'             // pre-join preview (group/broadcast)
  | 'knocking'          // waiting to be admitted
  | 'waiting-for-host'; // joined scheduled call before host arrived

export type CallRole = 'host' | 'co-host' | 'speaker' | 'audience';

export type NetworkQuality = 1 | 2 | 3 | 4;

export type CallParticipant = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  stream?: any | null; // RTCMediaStream — typed as any to avoid hard dep
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  networkQuality: NetworkQuality;
  role: CallRole;
  handRaised: boolean;
  joinedAt: string;
  /** DTLS-SRTP fingerprint extracted from remote SDP once the peer reaches connected state. */
  dtlsFingerprint?: string;
};

export type InCallMessage = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
};

export type ActiveReaction = {
  id: string;
  userId: string;
  displayName: string;
  emoji: string;
  xNorm: number; // 0‥1 horizontal position
  startedAt: number;
};

export type CallLayout = 'speaker' | 'gallery' | 'broadcast';

export type CallSession = {
  callId: string;
  conversationId: string;
  callType: CallType;
  title: string;
  state: CallState;
  participants: CallParticipant[];
  localUserId: string;
  initiatedBy: string | null;
  startedAt: string;
  endedAt?: string;
  reason?: string | null;

  // Controls
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  isFrontCamera: boolean;
  isScreenSharing: boolean;

  // UI state
  layout: CallLayout;
  pinnedUserId?: string | null;
  activeSpeakerId?: string | null;
  isControlsVisible: boolean;

  // Features
  chatMessages: InCallMessage[];
  raisedHands: string[];
  reactions: ActiveReaction[];
  networkQuality: NetworkQuality;
  unreadChatCount: number;

  // Broadcast
  viewerCount?: number;
  isRecording?: boolean;
  liveStartedAt?: string;

  /** DTLS-SRTP fingerprint for the call — populated once the first peer reaches connected state. */
  dtlsFingerprint?: string;

  // Standalone / scheduled call fields
  isStandalone?: boolean;
  scheduledFor?: string | null;
  inviteToken?: string | null;
  inviteLink?: string | null;

  // Knock / waiting room (host sees this)
  knockingUsers?: KnockingUser[];

  // Adaptive network state
  isAudioOnly?: boolean;
  isNoiseCancellationOn?: boolean;

  // Recording
  recordingState?: 'idle' | 'recording' | 'stopped';

  // Live captions
  captionsEnabled?: boolean;
  captions?: Caption[];

  // Virtual background
  virtualBgEnabled?: boolean;
  virtualBgUri?: string | null;

  // In-call polls
  polls?: InCallPoll[];

  // Q&A mode
  qaEnabled?: boolean;
  qaQueue?: QAQuestion[];

  // Breakout rooms
  breakoutRooms?: BreakoutRoom[];
  myBreakoutRoomId?: string | null;

  // RTMP streaming
  rtmpActive?: boolean;
  rtmpUrl?: string | null;

  // Whiteboard
  whiteboardEnabled?: boolean;
  whiteboardStrokes?: WhiteboardStroke[];
};

export type WhiteboardPoint = { x: number; y: number };
export type WhiteboardStroke = {
  id: string;
  userId: string;
  points: WhiteboardPoint[];
  color: string;
  width: number;
};

export type Caption = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
};

export type InCallPollOption = { text: string; votes: number };
export type InCallPoll = {
  pollId: string;
  question: string;
  options: string[];
  votes: Record<string, string>; // userId → chosen option
  createdBy: string;
  createdAt: string;
  closed: boolean;
  myVote?: string;
};

export type QAQuestion = {
  questionId: string;
  text: string;
  userId: string | null;
  displayName: string;
  submittedAt: string;
  answered: boolean;
};

export type BreakoutRoom = {
  roomId: string;
  name: string;
  userIds: string[];
};

export type KnockingUser = {
  userId: string;
  displayName: string;
  knockedAt: string;
};

export type ScheduledCallItem = {
  callId: string;
  conversationId: string;
  callType: CallType;
  title: string | null;
  scheduledFor: string | null;
  isStandalone: boolean;
  inviteToken: string | null;
  participantCount: number;
};

export type CallHistoryItem = {
  id: string;
  conversationId: string;
  callId: string;
  createdBy: string;
  status: 'ongoing' | 'completed' | 'cancelled' | 'missed' | 'active' | 'ringing' | 'pending' | 'busy' | 'declined' | 'ended';
  rawStatus?: string;
  userStatus?: string;
  title?: string | null;
  isStandalone?: boolean;
  callType?: CallType;
  media?: 'voice' | 'video';
  duration?: number;
  participantCount?: number;
  startedAt?: string;
  endedAt?: string | null;
  participants?: { userId: string; displayName?: string; status: string }[];
};

export const isGroupCall = (ct: CallType): boolean =>
  ct === 'voice-group' || ct === 'video-group' || ct === 'broadcast';

export const hasVideo = (ct: CallType): boolean =>
  ct === 'video' || ct === 'video-group';

export const callTypeLabel = (ct: CallType): string => {
  switch (ct) {
    case 'voice': return 'Voice call';
    case 'video': return 'Video call';
    case 'voice-group': return 'Group voice call';
    case 'video-group': return 'Group video call';
    case 'broadcast': return 'Broadcast';
  }
};

export const callTypeIcon = (ct: CallType): string => {
  switch (ct) {
    case 'voice': return 'phone';
    case 'video': return 'video';
    case 'voice-group': return 'people';
    case 'video-group': return 'video';
    case 'broadcast': return 'radio';
  }
};

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🙏', '🔥', '🎉'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
