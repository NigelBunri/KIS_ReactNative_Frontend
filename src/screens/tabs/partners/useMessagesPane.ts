import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';
import { RIGHT_PEEK_WIDTH } from '@/components/partners/partnersTypes';

export const useMessagesPane = (
  width: number,
  setHidNav?: (hidden: boolean) => void,
) => {
  const minimizedOffset = width - RIGHT_PEEK_WIDTH;
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);

  const messagesOffsetAnim = useRef(
    new Animated.Value(minimizedOffset),
  ).current;
  const offsetRef = useRef(minimizedOffset);
  const dragStartOffsetRef = useRef(minimizedOffset);
  const isOpenRef = useRef(false);

  useEffect(() => {
    const id = messagesOffsetAnim.addListener(({ value }) => {
      offsetRef.current = value;
    });
    return () => {
      messagesOffsetAnim.removeListener(id);
    };
  }, [messagesOffsetAnim]);

  useEffect(() => {
    const target = isMessagesExpanded ? 0 : minimizedOffset;
    messagesOffsetAnim.setValue(target);
    offsetRef.current = target;
    isOpenRef.current = isMessagesExpanded;
  }, [width, minimizedOffset, isMessagesExpanded, messagesOffsetAnim]);

  const getMessagesPaneOpen = (value: number) => value < minimizedOffset / 2;

  const animateMessagesPane = (
    expand: boolean,
    velocity = 0,
    immediate = false,
  ) => {
    messagesOffsetAnim.stopAnimation(() => {
      isOpenRef.current = expand;
      setIsMessagesExpanded(expand);
      const animation = immediate
        ? Animated.timing(messagesOffsetAnim, {
            toValue: expand ? 0 : minimizedOffset,
            duration: 150,
            useNativeDriver: true,
          })
        : Animated.spring(messagesOffsetAnim, {
            toValue: expand ? 0 : minimizedOffset,
            velocity: Math.abs(velocity),
            tension: 82,
            friction: 11,
            useNativeDriver: true,
          });
      animation.start(() => {
        messagesOffsetAnim.setValue(expand ? 0 : minimizedOffset);
        offsetRef.current = expand ? 0 : minimizedOffset;
        isOpenRef.current = expand;
        setIsMessagesExpanded(expand);
        setHidNav?.(expand);
      });
    });
  };

  const snapMessagesPane = (expand: boolean) => {
    const target = expand ? 0 : minimizedOffset;
    messagesOffsetAnim.stopAnimation();
    messagesOffsetAnim.setValue(target);
    offsetRef.current = target;
    dragStartOffsetRef.current = target;
    isOpenRef.current = expand;
    setIsMessagesExpanded(expand);
    setHidNav?.(expand);
  };

  const toggleMessagesPane = () => {
    messagesOffsetAnim.stopAnimation((value: number) => {
      const isOpen = getMessagesPaneOpen(
        typeof value === 'number' ? value : offsetRef.current,
      );
      animateMessagesPane(!isOpen, 0);
    });
  };

  const openMessagesPane = () => {
    animateMessagesPane(true, 0);
  };

  const closeMessagesPane = () => {
    animateMessagesPane(false, 0);
  };

  const shouldHandleHorizontalSwipe = (gestureState: {
    dx: number;
    dy: number;
  }) => {
    const horizontalIntent =
      Math.abs(gestureState.dx) > 12 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35;
    if (!horizontalIntent) return false;
    return isOpenRef.current ? gestureState.dx > 0 : gestureState.dx < 0;
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      shouldHandleHorizontalSwipe(gestureState),
    onMoveShouldSetPanResponderCapture: (_, gestureState) =>
      shouldHandleHorizontalSwipe(gestureState),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      messagesOffsetAnim.stopAnimation((value: number) => {
        dragStartOffsetRef.current =
          typeof value === 'number'
            ? Math.max(0, Math.min(minimizedOffset, value))
            : offsetRef.current;
        offsetRef.current = dragStartOffsetRef.current;
      });
    },
    onPanResponderMove: (_, gestureState) => {
      const nextOffset = Math.max(
        0,
        Math.min(minimizedOffset, dragStartOffsetRef.current + gestureState.dx),
      );
      messagesOffsetAnim.setValue(nextOffset);
      offsetRef.current = nextOffset;
    },
    onPanResponderRelease: () => {
      const currentOffset = Math.max(
        0,
        Math.min(minimizedOffset, offsetRef.current),
      );
      const openProgress =
        minimizedOffset > 0
          ? (minimizedOffset - currentOffset) / minimizedOffset
          : 0;
      const closeProgress =
        minimizedOffset > 0 ? currentOffset / minimizedOffset : 0;
      const shouldOpen = isOpenRef.current
        ? closeProgress <= 0.5
        : openProgress > 0.5;
      snapMessagesPane(shouldOpen);
    },
    onPanResponderTerminate: () => {
      snapMessagesPane(isOpenRef.current);
    },
  });

  return {
    minimizedOffset,
    messagesOffsetAnim,
    isMessagesExpanded,
    toggleMessagesPane,
    openMessagesPane,
    closeMessagesPane,
    animateMessagesPane,
    panHandlers: panResponder.panHandlers,
    messagePanHandlers: panResponder.panHandlers,
  };
};
