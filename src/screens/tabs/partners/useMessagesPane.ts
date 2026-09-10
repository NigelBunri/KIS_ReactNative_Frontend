import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';
import { RIGHT_PEEK_WIDTH } from '@/components/partners/partnersTypes';

export const useMessagesPane = (
  width: number,
  setHidNav?: (hidden: boolean) => void,
) => {
  const minimizedOffset = width - RIGHT_PEEK_WIDTH;
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  // isMessagesExpanded only updates at the end of a gesture (see
  // onPanResponderRelease/snapMessagesPane below) — it's the settled
  // open/closed state, not a live drag position. The pane's zIndex needs to
  // be elevated (above the Golden Section/tab bar) for the full duration of
  // an OPENING drag too, not just once it's fully open, or the pane — sitting
  // below everything while isMessagesExpanded is still false — would be
  // dragged into view invisibly and only "pop" into sight on release. This
  // tracks "a drag is currently in progress" so callers can elevate zIndex
  // for isMessagesExpanded || isDragging instead of isMessagesExpanded alone.
  const [isDragging, setIsDragging] = useState(false);
  // animateMessagesPane (button-triggered open/close, e.g. the header's
  // close button) sets isMessagesExpanded to the TARGET value immediately,
  // before the spring/timing animation actually runs — see its own comment
  // below for why (other UI, like PartnerAppLaunchBar, needs to react the
  // instant a close/open is triggered, not once the animation finishes).
  // That means a button-triggered CLOSE flips isMessagesExpanded to false
  // right away, which would drop the pane's zIndex below the Golden
  // Section/tab bar/center pane before the closing slide has even started -
  // the pane vanishes instantly instead of sliding away. This tracks "an
  // animateMessagesPane animation is currently in flight" (regardless of
  // drag) so callers can keep the pane elevated for its full duration.
  const [isAnimating, setIsAnimating] = useState(false);

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

  // Resyncs the resting position when the SCREEN itself changes size
  // (rotation, split-screen, etc.) — deliberately NOT keyed on
  // isMessagesExpanded. animateMessagesPane sets isMessagesExpanded (state)
  // well before its spring/timing animation finishes (see its own comment
  // below for why), so if this effect also re-ran on every isMessagesExpanded
  // change, it would call messagesOffsetAnim.setValue(target) WHILE that
  // native-driven animation was still actively running on the same value —
  // setValue() forcibly stops a native-driven animation on the value it's
  // attached to, so this was cutting every open/close spring short a few
  // frames in and snapping it to rest, which read as a visible shake/jitter
  // rather than a smooth slide. isOpenRef.current (kept in sync by every
  // caller that changes open/closed state) is used instead of the state
  // value so this effect's own identity doesn't depend on it.
  useEffect(() => {
    const target = isOpenRef.current ? 0 : minimizedOffset;
    messagesOffsetAnim.setValue(target);
    offsetRef.current = target;
  }, [width, minimizedOffset, messagesOffsetAnim]);

  const getMessagesPaneOpen = (value: number) => value < minimizedOffset / 2;

  const animateMessagesPane = (
    expand: boolean,
    // Unused now that both branches below are plain eased timing rather
    // than a physics spring (see the comment on the animation itself) —
    // kept in the signature since it's still part of this hook's exported
    // shape (animateMessagesPane) and every existing call site already
    // passes 0 for it; no call site actually relied on spring velocity.
    _velocity = 0,
    immediate = false,
  ) => {
    messagesOffsetAnim.stopAnimation(() => {
      isOpenRef.current = expand;
      setIsMessagesExpanded(expand);
      setIsAnimating(true);
      // Plain eased timing, not Animated.spring — a spring at this
      // tension/friction (82/11, damping ratio ~0.6) is visibly
      // underdamped: it overshoots the target and oscillates a couple of
      // times before settling, which read as the pane "shaking in place"
      // right as it finished opening/closing. Timing with an ease-out curve
      // reaches the target and stops, no bounce, by construction.
      const animation = Animated.timing(messagesOffsetAnim, {
        toValue: expand ? 0 : minimizedOffset,
        duration: immediate ? 150 : 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start(() => {
        messagesOffsetAnim.setValue(expand ? 0 : minimizedOffset);
        offsetRef.current = expand ? 0 : minimizedOffset;
        isOpenRef.current = expand;
        setIsMessagesExpanded(expand);
        setIsAnimating(false);
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
    // Deliberately bubble-phase ONLY — no onMoveShouldSetPanResponderCapture.
    // Capture runs before descendants (close buttons, ChatHeader's back
    // button, any Pressable in a feed/chat room) get a chance to claim the
    // touch themselves, so any tap with even a few px of incidental drift in
    // the closing direction (very common — mouse-driven simulator touches,
    // or a real finger not lifting perfectly still) got hijacked as a
    // micro-swipe instead of registering as a press. Because that
    // micro-drag rarely crosses the 50% open/close threshold on release, it
    // snapped right back to the state it started in — so the close button
    // visually did nothing, intermittently, depending on how much drift a
    // given tap happened to have. Bubble-phase only means: whatever a child
    // already claimed the responder for (any Pressable, on touch-start)
    // keeps it, and this handler only ever engages for drags starting on
    // genuinely non-interactive area (background, padding) — real
    // swipe-to-close/open from those areas is unaffected.
    onMoveShouldSetPanResponder: (_, gestureState) =>
      shouldHandleHorizontalSwipe(gestureState),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      setIsDragging(true);
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
      setIsDragging(false);
    },
    onPanResponderTerminate: () => {
      snapMessagesPane(isOpenRef.current);
      setIsDragging(false);
    },
  });

  return {
    minimizedOffset,
    messagesOffsetAnim,
    isMessagesExpanded,
    // See isDragging's and isAnimating's own doc comments above for why
    // both need to be included alongside isMessagesExpanded.
    isMessagesPaneOnTop: isMessagesExpanded || isDragging || isAnimating,
    toggleMessagesPane,
    openMessagesPane,
    closeMessagesPane,
    animateMessagesPane,
    // Instant, non-animated snap-closed - exposed for PartnersScreen.tsx's
    // blur handler, which needs the pane visually gone the moment focus is
    // lost, not mid-spring on a screen the user has already left.
    snapMessagesPane,
    panHandlers: panResponder.panHandlers,
    messagePanHandlers: panResponder.panHandlers,
  };
};
