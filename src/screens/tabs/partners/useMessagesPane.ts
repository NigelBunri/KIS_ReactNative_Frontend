import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
} from 'react-native';
import { RIGHT_PEEK_WIDTH } from '@/components/partners/partnersTypes';

export const useMessagesPane = (
  width: number,
  setHidNav?: (hidden: boolean) => void,
) => {
  const minimizedOffset = width - RIGHT_PEEK_WIDTH;
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);

  const messagesOffsetAnim = useRef(new Animated.Value(minimizedOffset)).current;
  const offsetRef = useRef(minimizedOffset);
  const messagesAnimatingRef = useRef(false);

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
  }, [width, minimizedOffset, isMessagesExpanded, messagesOffsetAnim]);

  const getMessagesPaneOpen = (value: number) => value < minimizedOffset / 2;

  const animateMessagesPane = (expand: boolean, velocity = 0) => {
    messagesOffsetAnim.stopAnimation(() => {
      setIsMessagesExpanded(expand);
      messagesAnimatingRef.current = true;
      Animated.timing(messagesOffsetAnim, {
        toValue: expand ? 0 : minimizedOffset,
        duration: Math.max(180, 280 - Math.min(120, Math.abs(velocity) / 8)),
        easing: (t) => t,
        useNativeDriver: true,
      }).start(() => {
        messagesOffsetAnim.setValue(expand ? 0 : minimizedOffset);
        offsetRef.current = expand ? 0 : minimizedOffset;
        setIsMessagesExpanded(expand);
        setHidNav?.(expand);
        messagesAnimatingRef.current = false;
      });
    });
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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {},
      onPanResponderMove: () => {},
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    }),
  ).current;

  return {
    minimizedOffset,
    messagesOffsetAnim,
    isMessagesExpanded,
    toggleMessagesPane,
    openMessagesPane,
    closeMessagesPane,
    animateMessagesPane,
    panHandlers: panResponder.panHandlers,
  };
};
