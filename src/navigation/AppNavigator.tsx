// src/navigation/MainTabs.tsx
// ❌ No NavigationContainer here — only navigators and screens.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  DeviceEventEmitter,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  useColorScheme,
  useWindowDimensions,      // ✅ useWindowDimensions instead of Dimensions
  Animated as RNAnimated,   // 👈 native Animated for overlay
} from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardAnimation } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';

import { useKISTheme } from '../theme/useTheme';
import { useGoldenSectionSuppression } from '@/contexts/GoldenSectionContext';
import { useResponsiveLayout } from '@/theme/responsive';
import { KIS_COMPONENT_TOKENS, withAlpha } from '@/theme/constants';
import { KISIcon, KISIconName } from '@/constants/kisIcons';
import type { MainTabsParamList } from '@/navigation/types';
import { TabletShell, TabletDialogOverlay, type SidebarNavKey } from '@/components/shell';

import MessagesScreen from '../screens/tabs/MessagesScreen';
import PartnersScreen from '../screens/tabs/PartnersScreen';
import BibleScreen from '../screens/tabs/BibleScreen';
import BroadcastScreen from '../screens/tabs/BroadcastScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import CommunityRoomPage from '@/Module/Community/CommunityRoomPage';
import ChatInfoPage from '@/Module/ChatRoom/ChatInfoPage';
import CommunityInfoPage from '@/Module/Community/CommunityInfoPage';
import { Chat } from '@/Module/ChatRoom/messagesUtils';
import { useSocket } from '../../SocketProvider';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  startInAppNotificationRuntime,
} from '@/services/inAppNotificationService';
import { startBackgroundPrefetch } from '@/services/backgroundPrefetch';
import {
  bindMainTabBadgeSourceEvents,
  emptyMainTabBadgeCounts,
  fetchMainTabBadgeCounts,
  MAIN_TAB_BADGES_REALTIME_EVENT,
  MainTabBadgeCounts,
} from '@/services/mainTabNotificationBadges';
import { translateString } from '@/languages';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type RouteKey = 'Partners' | 'Bible' | 'Messages' | 'Broadcast' | 'Profile';

const Tabs = createBottomTabNavigator<MainTabsParamList>();

const routeIconMap: Record<RouteKey, KISIconName> = {
  Partners: 'people',
  Bible: 'book',
  Messages: 'chat',
  Broadcast: 'megaphone',
  Profile: 'person',
};

// 👇 extend props to accept hidNav
type AnimatedKISTabBarProps = BottomTabBarProps & {
  hidNav: boolean;
  badgeCounts: MainTabBadgeCounts;
  // Tablet shell needs the tab navigator's own `navigation` object (to drive
  // Sidebar taps) and the currently-focused route name (to highlight the
  // right Sidebar item) from outside this navigator's own screen tree, where
  // React Navigation's useNavigationState() hook can't reach. This component
  // is always mounted as Tabs.Navigator's `tabBar` render prop regardless of
  // hidNav, so its effects always run and stay in sync even when hidden.
  onTabBarState?: (info: { navigation: BottomTabBarProps['navigation']; activeRouteName: string }) => void;
};

type KISTabBarItemProps = {
  focused: boolean;
  onPress: () => void;
  tabWidth: number;
  tabBarHeight: number;
  isTinyTabBar: boolean;
  iconCircleSize: number;
  iconSize: number;
  circleRadius: number;
  unfocusedCircleBg: string;
  selectedGoldGradient: string[];
  routeIcon: KISIconName;
  focusedIconColor: string;
  unfocusedIconColor: string;
  badgeCount: number;
  badgeBg: string;
  badgeBorder: string;
  badgeTextColor: string;
  label: string;
  focusedTextColor: string;
  unfocusedTextColor: string;
  labelFontSize: number;
  unfocusedLabelFontSize: number;
};

// Extracted from AnimatedKISTabBar's route-map so each tab can own its own
// Animated.Value — hooks can't be called inside .map(). The active-tab gold
// pill used to be a plain `focused ? <LinearGradient/> : null` conditional
// mount, popping in/out instantly with zero transition, and press feedback
// was a raw opacity/scale swap tied straight to Pressable's `pressed`
// render-prop — also instant, no easing. Both read as unpolished/"janky"
// compared to the rest of the app's animated surfaces. Keeping the gradient
// always mounted and animating its opacity (plus a small scale pop) via
// Animated.spring, and easing the press feedback via onPressIn/onPressOut,
// fixes both without changing any layout or hit-testing behavior.
function KISTabBarItem({
  focused,
  onPress,
  tabWidth,
  tabBarHeight,
  isTinyTabBar,
  iconCircleSize,
  iconSize,
  circleRadius,
  unfocusedCircleBg,
  selectedGoldGradient,
  routeIcon,
  focusedIconColor,
  unfocusedIconColor,
  badgeCount,
  badgeBg,
  badgeBorder,
  badgeTextColor,
  label,
  focusedTextColor,
  unfocusedTextColor,
  labelFontSize,
  unfocusedLabelFontSize,
}: KISTabBarItemProps) {
  const focusAnim = useRef(new RNAnimated.Value(focused ? 1 : 0)).current;
  const pressAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.spring(focusAnim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [focused, focusAnim]);

  const handlePressIn = useCallback(() => {
    RNAnimated.timing(pressAnim, { toValue: 1, duration: 90, useNativeDriver: true }).start();
  }, [pressAnim]);
  const handlePressOut = useCallback(() => {
    RNAnimated.timing(pressAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start();
  }, [pressAnim]);

  const pressScale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });
  const focusScale = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const pressOpacity = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tab, { width: tabWidth, height: tabBarHeight }]}
    >
      <RNAnimated.View
        style={[
          styles.tabInner,
          {
            gap: isTinyTabBar ? 0 : 5,
            opacity: pressOpacity,
            transform: [{ scale: RNAnimated.multiply(pressScale, focusScale) }],
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              width: iconCircleSize,
              height: iconCircleSize,
              borderRadius: circleRadius,
              backgroundColor: unfocusedCircleBg,
            },
          ]}
        >
          <RNAnimated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { opacity: focusAnim, borderRadius: circleRadius }]}
          >
            <LinearGradient
              colors={selectedGoldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, styles.selectedTabGradient, { borderRadius: circleRadius }]}
            />
            <View pointerEvents="none" style={styles.goldSheen} />
          </RNAnimated.View>
          <KISIcon
            name={routeIcon}
            size={iconSize}
            color={focused ? focusedIconColor : unfocusedIconColor}
            focused={focused}
          />
          {badgeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.badgeLabel, { color: badgeTextColor }]}>
                {badgeCount > 99 ? '99+' : String(badgeCount)}
              </Text>
            </View>
          ) : null}
        </View>

        {!isTinyTabBar ? (
          <Text
            style={[
              styles.label,
              {
                color: focused ? focusedTextColor : unfocusedTextColor,
                fontSize: focused ? labelFontSize : unfocusedLabelFontSize,
                fontWeight: focused ? '800' : '600',
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
        ) : null}
      </RNAnimated.View>
    </Pressable>
  );
}

function AnimatedKISTabBar({
  state,
  descriptors,
  navigation,
  hidNav,
  badgeCounts,
  onTabBarState,
}: AnimatedKISTabBarProps) {
  // 🌓 Follow device theme
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const theme = useKISTheme();

  React.useEffect(() => {
    // @ts-ignore
    if (typeof theme.setScheme === 'function') theme.setScheme(systemScheme ?? 'light');
    // @ts-ignore
    else if (typeof theme.setMode === 'function') theme.setMode(systemScheme ?? 'light');
    // @ts-ignore
    else if (typeof theme.useSystem === 'function') theme.useSystem();
  }, [systemScheme, theme]);

  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  // Keyboard-aware offset for this bar specifically - see styles.fixedWrap's
  // transform below for why this exists at all.
  const { height: keyboardHeight } = useKeyboardAnimation();

  // ✅ Responsive width that updates on orientation / size change
  const { width } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const count = state.routes.length;
  const tabWidth = width / count;
  const isTinyTabBar = responsive.isWatch || responsive.shortestSide < 330;
  const iconCircleSize = responsive.isWatch ? 34 : responsive.isCompactPhone ? 38 : KIS_COMPONENT_TOKENS.tab.iconSize;
  const iconSize = responsive.isWatch ? 19 : responsive.isCompactPhone ? 21 : 24;
  const tabBarHeight = responsive.isWatch ? 52 : responsive.isCompactPhone ? 62 : 72;

  const { palette: p, tone, gradients } = theme;
  const isRoyalLightBar = tone === 'light';
  const focusedTextColor = isRoyalLightBar ? p.goldReadable : p.goldLight;
  const unfocusedTextColor = p.subtext;
  const barBg = isRoyalLightBar ? (p.ivory ?? p.bg) : (p.bar ?? p.surface);
  const selectedGoldGradient = [...gradients.tabSelected];
  const separatorColors = tone === 'dark'
    ? ['transparent', withAlpha(p.gold, 0.55), withAlpha(p.goldBorder, 0.75), withAlpha(p.gold, 0.55), 'transparent']
    : ['transparent', withAlpha(p.goldBorder, 0.30), withAlpha(p.goldBorder, 0.50), withAlpha(p.goldBorder, 0.30), 'transparent'];

  const activeRouteName = state.routes[state.index]?.name ?? '';
  React.useEffect(() => {
    onTabBarState?.({ navigation, activeRouteName });
  }, [navigation, activeRouteName, onTabBarState]);

  // 🔒 If hidNav is true, don't render the bar at all
  if (hidNav) {
    return null;
  }

  // Height this bar actually occupies on screen — kept in one place so the
  // spacer below and the bar's own paddingBottom never drift apart.
  const barTotalHeight = tabBarHeight + Math.max(insets.bottom, 0);

  return (
    <>
      {/* Non-visual spacer: absolute positioning below removes the real bar
          from BottomTabView's flex column, so without this, its flex:1
          screens container would expand to fill the space the bar used to
          occupy and screen content would render underneath it. This spacer
          reserves that same space in normal flow, so every screen keeps
          exactly the layout it has today. */}
      <View style={{ height: barTotalHeight }} pointerEvents="none" />
      {/* translateY: keyboardHeight — this bar is pinned via fixedWrap's
          position:absolute/bottom:0, but that's relative to this Activity's
          own (possibly keyboard-resized) window, not the physical screen. A
          software keyboard is always a separate system-level layer above
          the app, so once it opens, a plain bottom:0 view ends up sitting
          BEHIND it - fully obscured, not just shifted - on every root tab
          screen with an inline search field (Messages, Bible, Broadcast,
          Partners, Profile all have one). useKeyboardAnimation's height is
          0 with the keyboard closed and tracks its live open/close motion
          in real time when it isn't (see KeyboardAvoidingView/hooks.js:
          `-reanimated.height.value` there confirms the sign — already
          negative, already exactly what translateY needs), so the bar rides
          up to sit right above the keyboard instead of disappearing behind
          it, then eases back to its normal resting position the instant the
          keyboard closes - it never just vanishes out from under the user. */}
      <RNAnimated.View
        style={[
          styles.wrap,
          styles.fixedWrap,
          {
            backgroundColor: barBg,
            paddingBottom: Math.max(insets.bottom, 0),
            paddingHorizontal: responsive.isWatch ? 2 : 6,
            transform: [{ translateY: keyboardHeight }],
          },
        ]}
    >
      {/* Luxury gold shimmer separator line */}
      <LinearGradient
        colors={separatorColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.separator}
        pointerEvents="none"
      />
      <View
        style={[
          styles.bar,
          {
            backgroundColor: barBg,
            borderTopColor: 'transparent',
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = translateString(descriptors[route.key].options.title ?? route.name);
          const badgeCount = badgeCounts[route.name as RouteKey] ?? 0;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <KISTabBarItem
              key={route.key}
              focused={focused}
              onPress={onPress}
              tabWidth={tabWidth}
              tabBarHeight={tabBarHeight}
              isTinyTabBar={isTinyTabBar}
              iconCircleSize={iconCircleSize}
              iconSize={iconSize}
              circleRadius={responsive.isWatch ? 14 : KIS_COMPONENT_TOKENS.tab.selectedRadius}
              unfocusedCircleBg={isRoyalLightBar ? 'rgba(184,133,46,0.09)' : 'rgba(255,255,255,0.06)'}
              selectedGoldGradient={selectedGoldGradient}
              routeIcon={routeIconMap[route.name as RouteKey]}
              focusedIconColor={p.onPrimary}
              unfocusedIconColor={unfocusedTextColor}
              badgeCount={badgeCount}
              badgeBg={p.badgeBg}
              badgeBorder={barBg}
              badgeTextColor={p.ivory}
              label={label}
              focusedTextColor={focusedTextColor}
              unfocusedTextColor={unfocusedTextColor}
              labelFontSize={responsive.isCompactPhone ? 11 : 12}
              unfocusedLabelFontSize={responsive.isCompactPhone ? 10 : 11}
            />
          );
        })}
      </View>
      </RNAnimated.View>
    </>
  );
}

export function MainTabs() {
  const { currentUserId, socket } = useSocket();
  const { shellMode } = useResponsiveLayout();
  const [tabBarState, setTabBarState] = useState<
    { navigation: BottomTabBarProps['navigation']; activeRouteName: string } | null
  >(null);
  const [communityByConversationId, setCommunityByConversationId] = useState<
    Record<string, { id: string; name: string }>
  >({});
  // 🔥 Chat room overlay — stack so sub-rooms push on top of the parent room
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const chatSlide = useRef(new RNAnimated.Value(0)).current;    // main layer (first chat)
  const subRoomSlide = useRef(new RNAnimated.Value(0)).current; // sub-room layer (depth ≥ 2)

  // Derived convenience values
  const chatVisible = chatHistory.length > 0;
  const activeChat = chatHistory[0] ?? null;
  const subRoomVisible = chatHistory.length > 1;
  const activeSubRoom = subRoomVisible ? chatHistory[chatHistory.length - 1] : null;
  const [activeInfo, setActiveInfo] = useState<{ chat: Chat; currentUserId: string | null } | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const infoSlide = useRef(new RNAnimated.Value(0)).current;
  const [activeCommunity, setActiveCommunity] = useState<{ id: string; name: string } | null>(null);
  const [communityVisible, setCommunityVisible] = useState(false);
  const communitySlide = useRef(new RNAnimated.Value(0)).current;
  const [communityInfoVisible, setCommunityInfoVisible] = useState(false);
  const [activeCommunityInfo, setActiveCommunityInfo] = useState<{ id: string; name: string } | null>(null);
  const communityInfoSlide = useRef(new RNAnimated.Value(0)).current;

  // These full-screen overlays (chat room, sub-room, chat info, community
  // room/info) are position:absolute within this component's own root View,
  // which sits below the Golden Section — they can't reach up to cover it
  // themselves. Force-hide the Golden Section while any is open instead, so
  // this View's box (and the overlay inside it) expands to fill that space
  // and genuinely covers the whole screen.
  useGoldenSectionSuppression(
    chatVisible || subRoomVisible || infoVisible || communityVisible || communityInfoVisible,
  );

  // 👇 control for hiding the nav bar (managed ONLY here)
  const [hidNav, setHidNav] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<MainTabBadgeCounts>(() => emptyMainTabBadgeCounts());

  useEffect(() => {
    startBackgroundPrefetch(currentUserId);
    startInAppNotificationRuntime();
    let alive = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFetchAt = 0;
    // Coalesce bursts of events (e.g. several chat messages arriving close
    // together) into one fetch, then never fetch more than once per this
    // window even if events keep arriving — otherwise an active chat, whose
    // messages fire chat.message/chat.message_receipt on every send/receipt,
    // would re-trigger this whole badge cascade on every single message.
    const MIN_REFRESH_INTERVAL_MS = 4000;
    const DEBOUNCE_MS = 120;

    const doFetch = () => {
      lastFetchAt = Date.now();
      fetchMainTabBadgeCounts(currentUserId)
        .then((next) => {
          if (alive) setBadgeCounts(next);
        })
        .catch(() => undefined);
    };

    const refreshBadges = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        const elapsed = Date.now() - lastFetchAt;
        if (elapsed >= MIN_REFRESH_INTERVAL_MS) {
          doFetch();
          return;
        }
        if (throttleTimer) return;
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          if (alive) doFetch();
        }, MIN_REFRESH_INTERVAL_MS - elapsed);
      }, DEBOUNCE_MS);
    };

    refreshBadges();
    const unbindBadgeEvents = bindMainTabBadgeSourceEvents(refreshBadges);
    const realtimeEvents = [
      'chat.message',
      'chat.message_receipt',
      'chat.edit',
      'chat.delete',
      'conversation.created',
      'conversation.updated',
      'broadcast.created',
      'broadcast.updated',
      'channel.content.created',
      'channel.content.updated',
      'notification.created',
      'partner.message',
      MAIN_TAB_BADGES_REALTIME_EVENT,
    ];

    realtimeEvents.forEach((eventName) => {
      socket?.on(eventName, refreshBadges);
    });
    // Refresh once when the socket (re)connects, without tearing down and
    // rebuilding this whole listener set on every connect/disconnect toggle
    // (which is what happened previously — isConnected was in this effect's
    // deps array purely to catch reconnects, and every toggle re-ran the
    // entire effect body including an unconditional refreshBadges() call).
    socket?.on('connect', refreshBadges);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBadges();
    });

    return () => {
      alive = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (throttleTimer) clearTimeout(throttleTimer);
      unbindBadgeEvents();
      realtimeEvents.forEach((eventName) => {
        socket?.off(eventName, refreshBadges);
      });
      socket?.off('connect', refreshBadges);
      appStateSub.remove();
    };
  }, [currentUserId, socket]);

  useEffect(() => {
    if (!currentUserId) {
      setCommunityByConversationId({});
      return;
    }
    let active = true;

    const loadCommunities = async () => {
      try {
        const res = await getRequest(ROUTES.community.list, {
          errorMessage: 'Failed to load communities',
        });
        const list = Array.isArray(res?.data?.results)
          ? res.data.results
          : Array.isArray(res?.results)
          ? res.results
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        if (!Array.isArray(list)) {
          if (active) setCommunityByConversationId({});
          return;
        }

        const next: Record<string, { id: string; name: string }> = {};
        list.forEach((community: any) => {
          const communityId = community?.id;
          const mainId = community?.main_conversation_id ?? community?.mainConversationId;
          const postsId = community?.posts_conversation_id ?? community?.postsConversationId;
          const title = String(community?.name ?? community?.title ?? 'Community');
          const register = (key: any) => {
            if (!key) return;
            const keyStr = String(key);
            next[keyStr] = {
              id: communityId ? String(communityId) : keyStr,
              name: title,
            };
          };
          register(communityId);
          register(mainId);
          register(postsId);
        });

        if (active) {
          setCommunityByConversationId(next);
        }
      } catch {
        if (active) {
          setCommunityByConversationId({});
        }
      }
    };

    loadCommunities();
    return () => {
      active = false;
    };
  }, [currentUserId]);

  const openCommunity = useCallback((community: { id: string; name: string }) => {
    setActiveCommunity(community);
    setCommunityVisible(true);

    RNAnimated.timing(communitySlide, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [communitySlide]);

  const openChat = useCallback((chat: Chat) => {
    const conversationKey = chat?.conversationId ?? chat?.id;
    const communityEntry =
      conversationKey && communityByConversationId[String(conversationKey)]
        ? communityByConversationId[String(conversationKey)]
        : undefined;
    const communityId =
      chat?.communityId ??
      communityEntry?.id ??
      (chat?.isCommunityChat ? chat?.id : null);
    const shouldOpenCommunity =
      chat?.isCommunityChat || chat?.kind === 'community' || Boolean(communityId);
    if (shouldOpenCommunity && communityId) {
      openCommunity({
        id: String(communityId),
        name: communityEntry?.name ?? String(chat?.name ?? 'Community'),
      });
      return;
    }

    setChatHistory(prev => {
      if (prev.length === 0) {
        // First open: animate main layer in
        RNAnimated.timing(chatSlide, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
        return [chat];
      }
      // Already in a chat: push sub-room and animate the sub-room layer in
      subRoomSlide.setValue(0);
      RNAnimated.timing(subRoomSlide, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
      return [...prev, chat];
    });
  }, [chatSlide, subRoomSlide, communityByConversationId, openCommunity]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat.open', (payload: any) => {
      const convId = String(payload?.conversationId ?? payload?.id ?? '');
      if (!convId) return;
      const chat: Chat = {
        id: convId,
        conversationId: convId,
        name: payload?.name ?? 'Chat',
        kind: payload?.kind,
        communityId: payload?.kind === 'community' ? convId : undefined,
        isCommunityChat: payload?.kind === 'community',
        isGroup: payload?.kind === 'channel',
      };
      openChat(chat);
    });
    return () => {
      sub.remove();
    };
  }, [openChat]);

  const closeChat = useCallback(() => {
    setChatHistory(prev => {
      if (prev.length > 1) {
        // Pop the sub-room: animate back then remove from stack
        RNAnimated.timing(subRoomSlide, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }).start(() => {
          setChatHistory(current => current.slice(0, -1));
        });
        return prev; // state stays unchanged until animation ends
      }
      // Close the main chat
      RNAnimated.timing(chatSlide, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        setChatHistory([]);
      });
      return prev;
    });
  }, [chatSlide, subRoomSlide]);

  // Fully dismisses the chat overlay (and any sub-room layered on top of it)
  // in one shot, instead of closeChat's one-level-at-a-time pop — for
  // callers navigating the user somewhere else entirely (e.g. a Bible
  // reference link), where leaving the overlay open behind the destination
  // tab would make it look like nothing happened.
  //
  // Goes through the same RNAnimated.timing(...).start(callback) path as
  // closeChat (just with duration: 0) rather than calling chatSlide/
  // subRoomSlide.setValue() directly — these values were started with
  // useNativeDriver: true, and a bare .setValue() while the native driver
  // still owns the node isn't guaranteed to promptly reflect in the
  // rendered transform, which left the overlay visually stuck open.
  const closeAllChats = useCallback(() => {
    RNAnimated.timing(subRoomSlide, { toValue: 0, duration: 0, useNativeDriver: true }).start();
    RNAnimated.timing(chatSlide, { toValue: 0, duration: 0, useNativeDriver: true }).start(() => {
      setChatHistory([]);
    });
  }, [chatSlide, subRoomSlide]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat.close_all', closeAllChats);
    return () => sub.remove();
  }, [closeAllChats]);

  const openInfo = useCallback((payload: { chat: Chat | null; currentUserId: string | null }) => {
    if (!payload.chat) return;
    setActiveInfo({ chat: payload.chat, currentUserId: payload.currentUserId });
    setInfoVisible(true);
    RNAnimated.timing(infoSlide, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [infoSlide]);

  const closeInfo = () => {
    RNAnimated.timing(infoSlide, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setInfoVisible(false);
      setActiveInfo(null);
    });
  };

  const closeCommunity = () => {
    RNAnimated.timing(communitySlide, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setCommunityVisible(false);
      setActiveCommunity(null);
    });
  };

  const openCommunityInfo = (payload: { id: string; name: string }) => {
    setActiveCommunityInfo(payload);
    setCommunityInfoVisible(true);
    RNAnimated.timing(communityInfoSlide, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

  const closeCommunityInfo = () => {
    RNAnimated.timing(communityInfoSlide, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setCommunityInfoVisible(false);
      setActiveCommunityInfo(null);
    });
  };

  // Android hardware back button — dismiss visible overlays in reverse-open order
  const backStateRef = useRef({
    communityInfoVisible: false,
    infoVisible: false,
    subRoomVisible: false,
    chatVisible: false,
    communityVisible: false,
  });
  backStateRef.current = { communityInfoVisible, infoVisible, subRoomVisible, chatVisible, communityVisible };

  const backHandlersRef = useRef({ closeCommunityInfo, closeInfo, closeChat, closeCommunity });
  backHandlersRef.current = { closeCommunityInfo, closeInfo, closeChat, closeCommunity };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      const s = backStateRef.current;
      const h = backHandlersRef.current;
      if (s.communityInfoVisible) { h.closeCommunityInfo(); return true; }
      if (s.infoVisible) { h.closeInfo(); return true; }
      if (s.subRoomVisible) { h.closeChat(); return true; }
      if (s.chatVisible) { h.closeChat(); return true; }
      if (s.communityVisible) { h.closeCommunity(); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, []);

  // Slide-progress values (chatSlide/subRoomSlide/infoSlide/communitySlide/
  // communityInfoSlide, 0..1) are consumed directly by TabletDialogOverlay
  // below, which owns the phone-slide vs tablet-dialog interpolation itself.

  // Stable screen components — defined with useCallback so their identity only
  // changes when the callbacks they depend on change.  Inline arrow functions
  // passed as `children` to Tabs.Screen recreate on every MainTabs render
  // (e.g. badge count updates), causing React Navigation to remount the screen.
  const MessagesTabScreen = useCallback(
    () => <MessagesScreen onOpenChat={openChat} onOpenInfo={openInfo} />,
    [openChat, openInfo],
  );
  const PartnersTabScreen = useCallback(
    () => <PartnersScreen setHidNav={setHidNav} onOpenInfo={openInfo} />,
    [openInfo, setHidNav],
  );

  // Tablet-shell Sidebar drives the same `navigation` object the phone
  // bottom-tab bar already uses (captured via AnimatedKISTabBar's
  // onTabBarState above). Messages/Bible/Broadcast/Partners are direct tab
  // routes. Communities and Marketplace aren't standalone routes — they're
  // sub-tabs inside MessagesScreen's own nested tab navigator (Tab.Screen
  // name="Communities", MessagesScreen.tsx) and BroadcastScreen's local
  // `activeMainTab` state (reached via the `mainTab` route param wired in
  // BroadcastScreen.tsx) respectively — react-navigation resolves nested
  // params for the former, and for the latter a plain route param is the
  // standard way to reach into a sibling screen's local state. Events and
  // Settings intentionally stay as normal navigation (out of tablet-shell
  // scope per plan) — `navigate` bubbles up to the RootStack for route names
  // this tab navigator doesn't own. "Settings" has no unified screen in this
  // app today (confirmed during planning) — the closest real destination is
  // the "Account Security" section already living inside the Profile tab.
  const handleSidebarNavigate = useCallback((key: SidebarNavKey) => {
    const nav = tabBarState?.navigation as any;
    if (!nav) return;
    switch (key) {
      case 'Messages':
      case 'Bible':
      case 'Broadcast':
      case 'Partners':
        nav.navigate(key);
        break;
      case 'Communities':
        nav.navigate('Messages', { screen: 'Communities' });
        break;
      case 'Marketplace':
        nav.navigate('Broadcast', { mainTab: 'market' });
        break;
      case 'Events':
        nav.navigate('Events');
        break;
      case 'Settings':
        nav.navigate('Profile');
        break;
    }
  }, [tabBarState]);

  const handleOpenProfile = useCallback(() => {
    (tabBarState?.navigation as any)?.navigate('Profile');
  }, [tabBarState]);

  const activeSidebarKey: SidebarNavKey | null = (() => {
    const name = tabBarState?.activeRouteName;
    if (name === 'Messages' || name === 'Bible' || name === 'Broadcast' || name === 'Partners') {
      return name;
    }
    return null;
  })();

  return (
    <View style={{ flex: 1 }}>
      <TabletShell
        activeKey={activeSidebarKey}
        onNavigate={handleSidebarNavigate}
        onOpenProfile={handleOpenProfile}
        badgeCounts={{
          Messages: badgeCounts.Messages,
          Bible: badgeCounts.Bible,
          Broadcast: badgeCounts.Broadcast,
          Partners: badgeCounts.Partners,
        }}
      >
        <Tabs.Navigator
          initialRouteName="Messages"
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
          }}
          tabBar={(p) => (
            <AnimatedKISTabBar
              {...p}
              hidNav={hidNav || shellMode !== 'phone'}
              badgeCounts={badgeCounts}
              onTabBarState={setTabBarState}
            />
          )}
        >
          <Tabs.Screen name="Messages" options={{ title: translateString('Messages') }} component={MessagesTabScreen} />

          <Tabs.Screen
            name="Bible"
            component={BibleScreen}
            options={{ title: translateString('Bible') }}
          />

          <Tabs.Screen
            name="Broadcast"
            component={BroadcastScreen}
            options={{ title: translateString('Broadcast') }}
          />

          <Tabs.Screen name="Partners" options={{ title: translateString('Partners') }} component={PartnersTabScreen} />

          <Tabs.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: translateString('Profile') }}
          />
        </Tabs.Navigator>
      </TabletShell>

      {/* 💥 Chat Room overlay ABOVE tabs + bar — full-bleed slide on phone, floating centered dialog on tablet/desktop (TabletDialogOverlay) */}
      <TabletDialogOverlay visible={chatVisible} progress={chatSlide} zIndex={1001}>
        <ChatRoomPage
          chat={activeChat}
          onBack={closeChat}
          onOpenInfo={openInfo}
          onOpenChat={openChat}
          initialTargetMessageId={(activeChat as any)?.initialTargetMessageId ?? null}
        />
      </TabletDialogOverlay>

      {/* Sub-room layer — opens on top when user taps a sub-room from inside a chat */}
      <TabletDialogOverlay visible={subRoomVisible} progress={subRoomSlide} zIndex={1002}>
        {activeSubRoom && (
          <ChatRoomPage
            chat={activeSubRoom}
            onBack={closeChat}
            onOpenInfo={openInfo}
            onOpenChat={openChat}
            initialTargetMessageId={(activeSubRoom as any)?.initialTargetMessageId ?? null}
          />
        )}
      </TabletDialogOverlay>

      <TabletDialogOverlay visible={infoVisible} progress={infoSlide} zIndex={1002}>
        {activeInfo ? (
          <ChatInfoPage
            chat={activeInfo.chat}
            currentUserId={activeInfo.currentUserId}
            onBack={closeInfo}
            onChatUpdated={(updated) => {
              setChatHistory((prev: Chat[]) =>
                prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
              );
              setActiveInfo((prev) => {
                if (!prev) return prev;
                return { ...prev, chat: { ...prev.chat, ...updated } };
              });
            }}
          />
        ) : null}
      </TabletDialogOverlay>

      <TabletDialogOverlay visible={communityVisible} progress={communitySlide} zIndex={1000}>
        {activeCommunity ? (
          <CommunityRoomPage
            community={activeCommunity}
            onBack={closeCommunity}
            onOpenChat={openChat}
            onOpenInfo={openCommunityInfo}
          />
        ) : null}
      </TabletDialogOverlay>

      <TabletDialogOverlay visible={communityInfoVisible} progress={communityInfoSlide} zIndex={1003}>
        {activeCommunityInfo ? (
          <CommunityInfoPage
            communityId={activeCommunityInfo.id}
            communityName={activeCommunityInfo.name}
            currentUserId={currentUserId ?? null}
            onBack={closeCommunityInfo}
          />
        ) : null}
      </TabletDialogOverlay>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.07 : 0,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
  // Pins the bar to the true bottom of BottomTabView's own box, independent
  // of anything above it (including App.tsx's GoldenSection header, whose
  // height changes while a screen loads and used to shift this bar since it
  // was previously a normal flex sibling). zIndex is deliberately modest —
  // AppNavigator's chat-room / community-room TabletDialogOverlay screens
  // already render as later siblings one level up, in MainTabs' own JSX,
  // with their own much higher zIndex (1000+), so they still paint over
  // this bar exactly as before; this value only needs to clear ordinary
  // screen content directly behind it.
  fixedWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  separator: {
    height: 1.5,
    width: '100%',
  },
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tab: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  iconCircle: {
    width: KIS_COMPONENT_TOKENS.tab.iconSize,
    height: KIS_COMPONENT_TOKENS.tab.iconSize,
    borderRadius: KIS_COMPONENT_TOKENS.tab.selectedRadius,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  selectedTabGradient: {
    borderRadius: KIS_COMPONENT_TOKENS.tab.selectedRadius,
  },
  goldSheen: {
    position: 'absolute',
    top: 3,
    left: 9,
    right: 9,
    height: 1,
    backgroundColor: 'rgba(255,244,184,0.55)',
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    right: KIS_COMPONENT_TOKENS.tab.badgeOffset,
    top: KIS_COMPONENT_TOKENS.tab.badgeOffset,
    minWidth: KIS_COMPONENT_TOKENS.badge.minSize,
    height: KIS_COMPONENT_TOKENS.badge.minSize,
    borderRadius: KIS_COMPONENT_TOKENS.badge.radius,
    paddingHorizontal: 5,
    borderWidth: KIS_COMPONENT_TOKENS.badge.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

export default MainTabs;
