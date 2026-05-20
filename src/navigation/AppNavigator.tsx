// src/navigation/MainTabs.tsx
// ❌ No NavigationContainer here — only navigators and screens.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
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
import LinearGradient from 'react-native-linear-gradient';

import { useKISTheme } from '../theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KIS_COMPONENT_TOKENS, KIS_ROYAL_GRADIENTS } from '@/theme/constants';
import { KISIcon, KISIconName } from '@/constants/kisIcons';
import type { MainTabsParamList } from '@/navigation/types';

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
import {
  bindMainTabBadgeSourceEvents,
  emptyMainTabBadgeCounts,
  fetchMainTabBadgeCounts,
  MAIN_TAB_BADGES_REALTIME_EVENT,
  MainTabBadgeCounts,
} from '@/services/mainTabNotificationBadges';

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
};

function AnimatedKISTabBar({
  state,
  descriptors,
  navigation,
  hidNav,
  badgeCounts,
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

  // ✅ Responsive width that updates on orientation / size change
  const { width } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const count = state.routes.length;
  const tabWidth = width / count;
  const isTinyTabBar = responsive.isWatch || responsive.shortestSide < 330;
  const iconCircleSize = responsive.isWatch ? 34 : responsive.isCompactPhone ? 38 : KIS_COMPONENT_TOKENS.tab.iconSize;
  const iconSize = responsive.isWatch ? 19 : responsive.isCompactPhone ? 21 : 24;
  const tabBarHeight = responsive.isWatch ? 52 : responsive.isCompactPhone ? 62 : 72;

  const { palette: p, tone } = theme;
  const isRoyalLightBar = tone === 'light';
  const focusedTextColor = isRoyalLightBar ? p.goldReadable : p.goldLight;
  const unfocusedTextColor = p.subtext;
  const barBg = isRoyalLightBar ? '#FFFFFF' : (p.bar ?? p.surface);
  const selectedGoldGradient = tone === 'dark'
    ? [...KIS_ROYAL_GRADIENTS.goldDark]
    : [...KIS_ROYAL_GRADIENTS.goldLight];
  const separatorColors = tone === 'dark'
    ? ['transparent', 'rgba(201,162,74,0.55)', 'rgba(185,133,46,0.75)', 'rgba(201,162,74,0.55)', 'transparent']
    : ['transparent', 'rgba(185,133,46,0.30)', 'rgba(185,133,46,0.50)', 'rgba(185,133,46,0.30)', 'transparent'];

  // 🔒 If hidNav is true, don't render the bar at all
  if (hidNav) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: barBg,
          paddingBottom: Math.max(insets.bottom, 0),
          paddingHorizontal: responsive.isWatch ? 2 : 6,
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
          const label = descriptors[route.key].options.title ?? route.name;
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
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                {
                  width: tabWidth,
                  height: tabBarHeight,
                  opacity: pressed ? 0.78 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <View style={[styles.tabInner, { gap: isTinyTabBar ? 0 : 5 }]}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      width: iconCircleSize,
                      height: iconCircleSize,
                      borderRadius: responsive.isWatch ? 14 : KIS_COMPONENT_TOKENS.tab.selectedRadius,
                      backgroundColor: focused
                        ? p.goldDeep
                        : isRoyalLightBar
                          ? 'rgba(184,133,46,0.09)'
                          : 'rgba(255,255,255,0.06)',
                    },
                  ]}
                >
                  {focused ? (
                    <LinearGradient
                      colors={selectedGoldGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        StyleSheet.absoluteFillObject,
                        styles.selectedTabGradient,
                        { borderRadius: responsive.isWatch ? 14 : KIS_COMPONENT_TOKENS.tab.selectedRadius },
                      ]}
                    />
                  ) : null}
                  {focused ? <View pointerEvents="none" style={styles.goldSheen} /> : null}
                  <KISIcon
                    name={routeIconMap[route.name as RouteKey]}
                    size={iconSize}
                    color={focused ? p.onPrimary : unfocusedTextColor}
                    focused={focused}
                  />
                  {badgeCount > 0 ? (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: p.badgeBg,
                          borderColor: barBg,
                        },
                      ]}
                    >
                      <Text style={styles.badgeLabel}>
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
                        fontSize: focused
                          ? (responsive.isCompactPhone ? 11 : 12)
                          : (responsive.isCompactPhone ? 10 : 11),
                        fontWeight: focused ? '800' : '600',
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MainTabs() {
  const { palette } = useKISTheme();
  const { currentUserId, socket, isConnected } = useSocket();
  const [communityByConversationId, setCommunityByConversationId] = useState<
    Record<string, { id: string; name: string }>
  >({});
  // ✅ Responsive width for overlay slide
  const { width } = useWindowDimensions();

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

  // 👇 control for hiding the nav bar (managed ONLY here)
  const [hidNav, setHidNav] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<MainTabBadgeCounts>(() => emptyMainTabBadgeCounts());

  useEffect(() => {
    startInAppNotificationRuntime();
    let alive = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshBadges = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        fetchMainTabBadgeCounts(currentUserId)
          .then((next) => {
            if (alive) setBadgeCounts(next);
          })
          .catch(() => undefined);
      }, 120);
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

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBadges();
    });

    return () => {
      alive = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      unbindBadgeEvents();
      realtimeEvents.forEach((eventName) => {
        socket?.off(eventName, refreshBadges);
      });
      appStateSub.remove();
    };
  }, [currentUserId, socket, isConnected]);

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

  const openInfo = (payload: { chat: Chat | null; currentUserId: string | null }) => {
    if (!payload.chat) return;
    setActiveInfo({ chat: payload.chat, currentUserId: payload.currentUserId });
    setInfoVisible(true);
    RNAnimated.timing(infoSlide, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

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

  const chatTranslateX = chatSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  const subRoomTranslateX = subRoomSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  const communityTranslateX = communitySlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  const infoTranslateX = infoSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  const communityInfoTranslateX = communityInfoSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  return (
    <View style={{ flex: 1 }}>
      <Tabs.Navigator
        initialRouteName="Messages"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
        tabBar={(p) => <AnimatedKISTabBar {...p} hidNav={hidNav} badgeCounts={badgeCounts} />}
      >
        <Tabs.Screen name="Messages" options={{ title: 'Messages' }}>
          {() => <MessagesScreen onOpenChat={openChat} onOpenInfo={openInfo} />}
        </Tabs.Screen>

        <Tabs.Screen
          name="Bible"
          component={BibleScreen}
          options={{ title: 'Bible' }}
        />

        <Tabs.Screen
          name="Broadcast"
          component={BroadcastScreen}
          options={{ title: 'Broadcast' }}
        />

        <Tabs.Screen
          name="Partners"
          options={{ title: 'Partners' }}
        >
          {() => <PartnersScreen setHidNav={setHidNav} onOpenInfo={openInfo} />}
        </Tabs.Screen>

        <Tabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
      </Tabs.Navigator>

      {/* 💥 Full-screen Chat Room overlay ABOVE tabs + bar */}
      <RNAnimated.View
        pointerEvents={chatVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: chatTranslateX }],
          zIndex: 1001,
          backgroundColor: palette.bg,
        }}
      >
        <ChatRoomPage
          chat={activeChat}
          onBack={closeChat}
          onOpenInfo={openInfo}
          onOpenChat={openChat}
          initialTargetMessageId={(activeChat as any)?.initialTargetMessageId ?? null}
        />
      </RNAnimated.View>

      {/* Sub-room layer — slides in on top when user taps a sub-room from inside a chat */}
      <RNAnimated.View
        pointerEvents={subRoomVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: subRoomTranslateX }],
          zIndex: 1002,
          backgroundColor: palette.bg,
        }}
      >
        {activeSubRoom && (
          <ChatRoomPage
            chat={activeSubRoom}
            onBack={closeChat}
            onOpenInfo={openInfo}
            onOpenChat={openChat}
            initialTargetMessageId={(activeSubRoom as any)?.initialTargetMessageId ?? null}
          />
        )}
      </RNAnimated.View>

      <RNAnimated.View
        pointerEvents={infoVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: infoTranslateX }],
          zIndex: 1002,
          backgroundColor: palette.bg,
        }}
      >
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
      </RNAnimated.View>

      <RNAnimated.View
        pointerEvents={communityVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: communityTranslateX }],
          zIndex: 1000,
          backgroundColor: palette.bg,
        }}
      >
        {activeCommunity ? (
          <CommunityRoomPage
            community={activeCommunity}
            onBack={closeCommunity}
            onOpenChat={openChat}
            onOpenInfo={openCommunityInfo}
          />
        ) : null}
      </RNAnimated.View>

      <RNAnimated.View
        pointerEvents={communityInfoVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: communityInfoTranslateX }],
          zIndex: 1003,
          backgroundColor: palette.bg,
        }}
      >
        {activeCommunityInfo ? (
          <CommunityInfoPage
            communityId={activeCommunityInfo.id}
            communityName={activeCommunityInfo.name}
            currentUserId={currentUserId ?? null}
            onBack={closeCommunityInfo}
          />
        ) : null}
      </RNAnimated.View>
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
    color: '#FFFFFF',
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
