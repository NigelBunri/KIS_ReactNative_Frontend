import React, { useRef, useState } from 'react';
import {
  Pressable,
  PanResponder,
  GestureResponderEvent,
  Animated,
  Modal,
  View,
  Text,
  Share,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';

import type { ChatMessage } from '../chatTypes';
import { MessageBubble } from './MessageBubble';

type Props = {
  message: ChatMessage;
  palette: any;
  currentUserId?: string;

  onReplyToMessage?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onForwardMessage?: (message: ChatMessage) => void;
  onDeleteMessage?: (message: ChatMessage) => void;
  onPinMessage?: (message: ChatMessage) => void;
  onReactMessage?: (message: ChatMessage, emoji: string) => void;
  onVotePoll?: (message: ChatMessage, optionId: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;

  replySource?: ChatMessage;
  onPressReplySource?: (messageId: string) => void;

  isHighlighted?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;

  selectionMode?: boolean;
  isSelected?: boolean;
  onStartSelection?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;

  onStarMessage?: (message: ChatMessage) => void;
  onShowReadReceipts?: (message: ChatMessage) => void;
  onViewOnce?: (messageId: string) => void;
  onLocalDeleteMessage?: (message: ChatMessage) => void;
  mentionMap?: Record<string, string>;
};

const SWIPE_THRESHOLD = 40;
const MAX_PULL_DISTANCE = 80;
const DOUBLE_TAP_DELAY_MS = 260;
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🙏', '🔥'];

/**
 * Animated emoji button with spring scale-up on press.
 * Shows a highlight ring when the current user has already reacted with this emoji.
 */
type QuickEmojiButtonProps = {
  emoji: string;
  isSelected: boolean;
  palette: any;
  onPress: () => void;
};

const QuickEmojiButton: React.FC<QuickEmojiButtonProps> = ({
  emoji,
  isSelected,
  palette,
  onPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.35,
        useNativeDriver: true,
        speed: 40,
        bounciness: 14,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isSelected
          ? (palette.reactionActiveBg ?? 'rgba(79,70,229,0.12)')
          : 'transparent',
        borderWidth: isSelected ? 2 : 0,
        borderColor: isSelected
          ? (palette.primary ?? '#4F46E5')
          : 'transparent',
      }}
    >
      <Animated.Text
        style={{
          fontSize: 26,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {emoji}
      </Animated.Text>
    </Pressable>
  );
};

export const InteractiveMessageRow: React.FC<Props> = ({
  message,
  palette,
  currentUserId,
  onReplyToMessage,
  onEditMessage,
  onForwardMessage,
  onDeleteMessage,
  onPinMessage,
  onReactMessage,
  onVotePoll,
  onRetryMessage,
  replySource,
  onPressReplySource,
  isHighlighted,
  isFirstInGroup,
  isLastInGroup,
  selectionMode = false,
  isSelected = false,
  onStartSelection,
  onToggleSelect,
  onStarMessage,
  onShowReadReceipts,
  onViewOnce,
  onLocalDeleteMessage,
  mentionMap,
}) => {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const lastTapRef = useRef<number | null>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const sheetSlide = useRef(new Animated.Value(0)).current;

  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const openSheet = () => {
    setActionSheetVisible(true);
    sheetSlide.setValue(0);
    Animated.spring(sheetSlide, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  };

  const closeSheet = (then?: () => void) => {
    Animated.timing(sheetSlide, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setActionSheetVisible(false);
      then?.();
    });
  };

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 10,
    }).start();
  };

  const bumpAndReset = () => {
    Animated.sequence([
      Animated.spring(translateX, {
        toValue: message.fromMe ? -20 : 20,
        useNativeDriver: true,
        bounciness: 6,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = (_e: GestureResponderEvent) => {
    // In selection mode, tap toggles selection — nothing else
    if (selectionMode) {
      onToggleSelect?.(message);
      return;
    }

    // Double-tap = quick heart reaction
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
      lastTapRef.current = null;
      onReactMessage?.(message, '❤️');
      return;
    }
    lastTapRef.current = now;
    // Single tap in normal mode: do nothing (avoid accidental selections)
  };

  const handleLongPress = () => {
    openSheet();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (selectionMode) return false;
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (selectionMode) return;
        const clamped =
          gestureState.dx > 0
            ? Math.min(gestureState.dx, MAX_PULL_DISTANCE)
            : Math.max(gestureState.dx, -MAX_PULL_DISTANCE);
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (selectionMode) { translateX.setValue(0); return; }
        if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
          onReplyToMessage?.(message);
          bumpAndReset();
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => resetPosition(),
    }),
  ).current;

  const isMe = !!message.fromMe;
  const hasText = !!(message as any).text;
  const isDeleted = !!(message as any).isDeleted;
  const hasServerId = !!(message.serverId ?? (message.id && !message.id.startsWith('client_')));
  const isPinned = !!(message as any).isPinned;

  // ── action sheet sheet translation ───────────────────────────────────────
  const sheetTranslateY = sheetSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  // ── action definitions ────────────────────────────────────────────────────
  type ActionItem =
    | { type: 'action'; key: string; icon: string; label: string; destructive?: boolean; onPress: () => void }
    | { type: 'divider'; key: string };

  const actions: ActionItem[] = [];

  if (!isDeleted) {
    if (onReplyToMessage) {
      actions.push({
        type: 'action',
        key: 'reply',
        icon: 'arrow-undo-outline',
        label: 'Reply',
        onPress: () => closeSheet(() => onReplyToMessage(message)),
      });
    }

    if (isMe && hasText && onEditMessage) {
      actions.push({
        type: 'action',
        key: 'edit',
        icon: 'pencil-outline',
        label: 'Edit',
        onPress: () => closeSheet(() => onEditMessage(message)),
      });
    }

    if (onForwardMessage) {
      actions.push({
        type: 'action',
        key: 'forward',
        icon: 'arrow-redo-outline',
        label: 'Forward',
        onPress: () => closeSheet(() => onForwardMessage(message)),
      });
    }

    if (hasText) {
      actions.push({
        type: 'action',
        key: 'copy',
        icon: 'copy-outline',
        label: 'Copy',
        onPress: () => {
          closeSheet(() => {
            try {
              Clipboard.setString((message as any).text ?? '');
            } catch {
              Share.share({ message: (message as any).text ?? '' }).catch(() => {});
            }
          });
        },
      });
    }

    if (onPinMessage && hasServerId) {
      actions.push({
        type: 'action',
        key: 'pin',
        icon: isPinned ? 'pin' : 'pin-outline',
        label: isPinned ? 'Unpin' : 'Pin',
        onPress: () => closeSheet(() => onPinMessage(message)),
      });
    }

    if (onStarMessage) {
      const alreadyStarred = !!(message as any).isStarred;
      actions.push({
        type: 'action',
        key: 'star',
        icon: alreadyStarred ? 'star' : 'star-outline',
        label: alreadyStarred ? 'Unstar' : 'Star',
        onPress: () => closeSheet(() => onStarMessage(message)),
      });
    }
  }

  // Select (enters selection mode)
  if (onStartSelection) {
    actions.push({ type: 'divider', key: 'div1' });
    actions.push({
      type: 'action',
      key: 'select',
      icon: 'checkmark-circle-outline',
      label: 'Select',
      onPress: () => closeSheet(() => onStartSelection(message)),
    });
  }

  if (!isDeleted) {
    actions.push({ type: 'divider', key: 'div2' });
    if (onLocalDeleteMessage) {
      actions.push({
        type: 'action',
        key: 'delete_me',
        icon: 'eye-off-outline',
        label: 'Delete for me',
        destructive: true,
        onPress: () => closeSheet(() => onLocalDeleteMessage(message)),
      });
    }
    if (isMe && onDeleteMessage) {
      actions.push({
        type: 'action',
        key: 'delete_all',
        icon: 'trash-outline',
        label: 'Delete for everyone',
        destructive: true,
        onPress: () => closeSheet(() => onDeleteMessage(message)),
      });
    }
  }

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        <Pressable onPress={handlePress} onLongPress={handleLongPress} delayLongPress={350}>
          <MessageBubble
            message={message}
            palette={palette}
            currentUserId={currentUserId}
            onReact={onReactMessage}
            onVotePoll={onVotePoll ? (msgId, optId) => onVotePoll(message, optId) : undefined}
            onRetry={onRetryMessage}
            replySource={replySource}
            onPressReplySource={() => {
              if (replySource && onPressReplySource) onPressReplySource(replySource.id);
            }}
            isHighlighted={isHighlighted}
            isSelected={isSelected && selectionMode}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            onStar={onStarMessage}
            onShowReadReceipts={onShowReadReceipts}
            onViewOnce={onViewOnce}
            mentionMap={mentionMap}
            senderId={(message as any).senderId}
          />
        </Pressable>
      </Animated.View>

      {/* ─── Context action sheet ─── */}
      {actionSheetVisible && (
        <Modal
          transparent
          visible={actionSheetVisible}
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => closeSheet()}
        >
          {/* Backdrop */}
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }}
            onPress={() => closeSheet()}
          >
            {/* Prevent backdrop press from propagating through to the sheet */}
            <View style={{ flex: 1 }} pointerEvents="box-none" />
          </Pressable>

          {/* Sheet — positioned absolutely at the bottom */}
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              transform: [{ translateY: sheetTranslateY }],
            }}
          >
            {/* ── Emoji quick reactions pill ── */}
            <View
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                marginHorizontal: 16,
                marginBottom: 10,
                flexDirection: 'row',
                backgroundColor: palette.surface ?? '#fff',
                borderRadius: 40,
                paddingHorizontal: 8,
                paddingVertical: 4,
                gap: 2,
                shadowColor: '#000',
                shadowOpacity: 0.16,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 8,
              }}
            >
              {QUICK_EMOJIS.map((emoji) => {
                // Determine whether the current user has already used this emoji on this message
                const reactions = (message as any).reactions as
                  | Record<string, string[]>
                  | undefined;
                const usersForEmoji = reactions?.[emoji];
                const isSelected = Array.isArray(usersForEmoji) && currentUserId
                  ? usersForEmoji.includes(currentUserId)
                  : false;

                return (
                  <QuickEmojiButton
                    key={emoji}
                    emoji={emoji}
                    isSelected={isSelected}
                    palette={palette}
                    onPress={() => closeSheet(() => onReactMessage?.(message, emoji))}
                  />
                );
              })}
            </View>

            {/* ── Actions panel ── */}
            <View
              style={{
                backgroundColor: palette.card ?? '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: -4 },
                elevation: 12,
                maxHeight: SCREEN_HEIGHT * 0.55,
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.divider ?? '#ddd' }} />
              </View>

              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
              >
                {actions.map((item) => {
                  if (item.type === 'divider') {
                    return (
                      <View
                        key={item.key}
                        style={{ height: 1, backgroundColor: palette.divider ?? '#f0f0f0', marginHorizontal: 16, marginVertical: 4 }}
                      />
                    );
                  }
                  return (
                    <Pressable
                      key={item.key}
                      onPress={item.onPress}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 15,
                        backgroundColor: pressed ? (palette.surfaceElevated ?? '#f5f5f5') : 'transparent',
                      })}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: item.destructive
                            ? 'rgba(220,38,38,0.1)'
                            : (palette.surfaceSoft ?? '#f0f0f0'),
                          marginRight: 14,
                        }}
                      >
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.destructive ? '#DC2626' : (palette.text ?? '#111')}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '500',
                          color: item.destructive ? '#DC2626' : (palette.text ?? '#111'),
                          flex: 1,
                        }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        </Modal>
      )}
    </>
  );
};
