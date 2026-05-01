import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

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

type Props = {
  session: CallOverlaySession | null;
  visible: boolean;
  onAnswer: () => void;
  onReject: () => void;
  onEnd: () => void;
  onDismissEnded: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
};

const stateLabel = (session: CallOverlaySession | null) => {
  if (!session) return '';
  switch (session.state) {
    case 'dialing':
      return 'Calling…';
    case 'incoming':
      return 'Incoming call';
    case 'connecting':
      return 'Connecting…';
    case 'active':
      return session.media === 'video' ? 'Video call active' : 'Voice call active';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'missed':
      return 'Missed call';
    case 'ended':
      return session.reason ? `Call ended • ${session.reason}` : 'Call ended';
    default:
      return '';
  }
};

export default function CallOverlay({
  session,
  visible,
  onAnswer,
  onReject,
  onEnd,
  onDismissEnded,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
}: Props) {
  const { palette } = useKISTheme();

  if (!session) return null;

  const isIncoming = session.state === 'incoming';
  const isEnded = session.state === 'ended' || session.state === 'missed';
  const isLive =
    session.state === 'dialing' ||
    session.state === 'connecting' ||
    session.state === 'active' ||
    session.state === 'reconnecting';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.inputBorder,
            },
          ]}
        >
          <View
            style={[
              styles.hero,
              {
                backgroundColor: session.media === 'video'
                  ? (palette.primarySoft ?? palette.surface)
                  : (palette.surface ?? palette.card),
              },
            ]}
          >
            <KISIcon
              name={session.media === 'video' ? 'video' : 'phone'}
              size={42}
              color={palette.primary}
            />
          </View>

          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {session.title || 'Call'}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {stateLabel(session)}
          </Text>

          {session.media === 'video' ? (
            <View
              style={[
                styles.videoPlaceholder,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.inputBorder,
                },
              ]}
            >
              <Text style={[styles.videoPlaceholderText, { color: palette.subtext }]}>
                Camera surface ready
              </Text>
            </View>
          ) : null}

          {isIncoming ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={onReject}
                style={[styles.roundAction, { backgroundColor: '#D64545' }]}
              >
                <KISIcon name="phone" size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={onAnswer}
                style={[styles.roundAction, { backgroundColor: '#1E9E5A' }]}
              >
                <KISIcon name={session.media === 'video' ? 'video' : 'phone'} size={20} color="#fff" />
              </Pressable>
            </View>
          ) : isEnded ? (
            <Pressable
              onPress={onDismissEnded}
              style={[
                styles.dismissButton,
                { backgroundColor: palette.primary },
              ]}
            >
              <Text style={[styles.dismissLabel, { color: palette.onPrimary ?? '#fff' }]}>
                Close
              </Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.controlRow}>
                <Pressable
                  onPress={onToggleMute}
                  style={[
                    styles.controlButton,
                    {
                      backgroundColor: session.muted ? (palette.primarySoft ?? palette.surface) : palette.surface,
                      borderColor: palette.inputBorder,
                    },
                  ]}
                >
                  <KISIcon name="mic" size={18} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={onToggleSpeaker}
                  style={[
                    styles.controlButton,
                    {
                      backgroundColor: session.speakerOn ? (palette.primarySoft ?? palette.surface) : palette.surface,
                      borderColor: palette.inputBorder,
                    },
                  ]}
                >
                  <KISIcon name="megaphone" size={18} color={palette.text} />
                </Pressable>
                {session.media === 'video' ? (
                  <Pressable
                    onPress={onToggleVideo}
                    style={[
                      styles.controlButton,
                      {
                        backgroundColor: session.videoEnabled ? (palette.primarySoft ?? palette.surface) : palette.surface,
                        borderColor: palette.inputBorder,
                      },
                    ]}
                  >
                    <KISIcon name="video" size={18} color={palette.text} />
                  </Pressable>
                ) : null}
              </View>

              {isLive ? (
                <Pressable
                  onPress={onEnd}
                  style={[styles.endButton, { backgroundColor: '#D64545' }]}
                >
                  <KISIcon name="phone" size={18} color="#fff" />
                  <Text style={styles.endLabel}>End call</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 18, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  hero: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
  },
  videoPlaceholder: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 28,
  },
  roundAction: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButton: {
    marginTop: 26,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  endLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissButton: {
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  dismissLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
