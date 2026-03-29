import React, { useRef } from 'react';
import {
  Pressable,
  PanResponder,
  GestureResponderEvent,
  Animated,
} from 'react-native';

import type { ChatMessage } from '../chatTypes';
import { MessageBubble } from './MessageBubble';

type Props = {
  message: ChatMessage;
  palette: any;
  currentUserId?: string;
  onReplyToMessage?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onPressMessage?: (message: ChatMessage) => void;
  onLongPressMessage?: (message: ChatMessage) => void;
  onReactMessage?: (message: ChatMessage, emoji: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;

  replySource?: ChatMessage;
  onPressReplySource?: (messageId: string) => void;

  // highlight (for scroll-back)
  isHighlighted?: boolean;

  // selection
  selectionMode?: boolean;
  isSelected?: boolean;
  onStartSelection?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;
};

const DOUBLE_TAP_DELAY_MS = 260;
const SWIPE_THRESHOLD = 40;
const MAX_PULL_DISTANCE = 80;

export const InteractiveMessageRow: React.FC<Props> = ({
  message,
  palette,
  currentUserId,
  onReplyToMessage,
  onEditMessage: _onEditMessage,
  onPressMessage,
  onLongPressMessage,
  onReactMessage,
  onRetryMessage,
  replySource,
  onPressReplySource,
  isHighlighted,
  selectionMode = false,
  isSelected = false,
  onStartSelection,
  onToggleSelect,
}) => {
  const lastTapRef = useRef<number | null>(null);
  const translateX = useRef(new Animated.Value(0)).current;

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
    const now = Date.now();

    // If selection mode is on, pressing toggles selection
    if (selectionMode && onToggleSelect) {
      onToggleSelect(message);
      return;
    }

    // Double tap = reply
    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
      lastTapRef.current = null;
      if (onReplyToMessage) {
        onReplyToMessage(message);
      }
      return;
    }
    lastTapRef.current = now;

    if (onPressMessage) {
      onPressMessage(message);
    }
  };

  const handleLongPress = () => {
    // Long press sets selection mode and selects the message
    if (onStartSelection) {
      onStartSelection(message);
      return;
    }

    if (onLongPressMessage) {
      onLongPressMessage(message);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Disable pull-to-reply when in selection mode
        if (selectionMode) return false;
        return Math.abs(dx) > 10 && Math.abs(dy) < 15;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (selectionMode) return;
        const { dx } = gestureState;
        const clamped =
          dx > 0
            ? Math.min(dx, MAX_PULL_DISTANCE)
            : Math.max(dx, -MAX_PULL_DISTANCE);

        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (selectionMode) {
          translateX.setValue(0);
          return;
        }
        const { dx } = gestureState;
        if (dx > SWIPE_THRESHOLD || dx < -SWIPE_THRESHOLD) {
          // Trigger reply
          if (onReplyToMessage) {
            onReplyToMessage(message);
          }
          bumpAndReset();
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        resetPosition();
      },
    }),
  ).current;

  const handlePressReplySource = () => {
    if (replySource && onPressReplySource) {
      onPressReplySource(replySource.id);
    }
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX }],
      }}
    >
      <Pressable onPress={handlePress} onLongPress={handleLongPress}>
        <MessageBubble
          message={message}
          palette={palette}
          currentUserId={currentUserId}
          onReact={onReactMessage}
          onRetry={onRetryMessage}
          replySource={replySource}
          onPressReplySource={handlePressReplySource}
          isHighlighted={isHighlighted}
          isSelected={isSelected}
        />
      </Pressable>
    </Animated.View>
  );
};
