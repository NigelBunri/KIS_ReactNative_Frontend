import React, { useCallback, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type {
  MainTabsParamList,
  BroadcastProfileKey,
} from '@/navigation/types';

import BroadcastHeaderBar from '@/components/broadcast/BroadcastHeaderBar';
import BroadcastMainTabs, {
  type BroadcastMainTabId,
} from '@/components/broadcast/BroadcastMainTabs';
import BroadcastSearchRow from '@/components/broadcast/BroadcastSearchRow';
import BroadcastFeedsPage from '../broadcast/pages/BroadcastFeedsPage';
import ChannelsDiscoverPage from '../broadcast/channels/ChannelsDiscoverPage';
import BroadcastEducationPage from '../broadcast/pages/BroadcastEducationPage';
import BroadcastMarketPage from '../broadcast/pages/BroadcastMarketPage';
import BroadcastHealthcarePage from '../broadcast/pages/BroadcastHealthcarePage';
import { KISIcon } from '@/constants/kisIcons';
import {
  getShopCartState,
  refreshShopCartFromBackend,
  subscribeToShopCart,
  type ShopCartState,
} from '@/screens/market/cart/shopCartManager';

type BroadcastFilterOption = {
  key: string;
  label: string;
  description: string;
};

const FILTER_OPTIONS: Record<BroadcastMainTabId, BroadcastFilterOption[]> = {
  feeds: [
    { key: 'latest', label: 'Latest', description: 'Fresh broadcasts' },
    { key: 'trending', label: 'Trending', description: 'Most active' },
    { key: 'saved', label: 'Saved', description: 'Your keeps' },
  ],
  channels: [
    { key: 'all', label: 'All', description: 'Every channel' },
    { key: 'video', label: 'Video', description: 'Long-form uploads' },
    { key: 'shorts', label: 'Shorts', description: 'Vertical clips' },
    { key: 'live', label: 'Live', description: 'Streams and replays' },
    { key: 'education', label: 'Education', description: 'Learning channels' },
    { key: 'market', label: 'Market', description: 'Shops and services' },
    { key: 'health', label: 'Health', description: 'Care providers' },
  ],
  education: [
    { key: 'course', label: 'Courses', description: 'Structured learning' },
    { key: 'lesson', label: 'Lessons', description: 'Short sessions' },
    { key: 'workshop', label: 'Workshops', description: 'Live programs' },
  ],
  market: [
    { key: 'all', label: 'All', description: 'Products and services' },
    { key: 'trending', label: 'Trending', description: 'Rated broadcasts' },
    { key: 'drops', label: 'Drops', description: 'Limited releases' },
    {
      key: 'broadcasted',
      label: 'Broadcasted',
      description: 'Live market posts',
    },
  ],
  healthcare: [
    { key: 'upcoming', label: 'Upcoming', description: 'Next available' },
    { key: 'today', label: 'Today', description: 'Ready now' },
    { key: 'past', label: 'Past', description: 'Recent history' },
  ],
};

const SEARCH_PLACEHOLDERS: Record<BroadcastMainTabId, string> = {
  feeds: 'Search broadcast feeds',
  channels: 'Search channels',
  education: 'Search courses & lessons',
  market: 'Search marketplace drops',
  healthcare: 'Search providers & services',
};

const PROFILE_KEY_BY_TAB: Record<BroadcastMainTabId, BroadcastProfileKey> = {
  feeds: 'broadcast_feed',
  channels: 'broadcast_feed',
  education: 'education',
  market: 'market',
  healthcare: 'health',
};

const MAIN_TAB_ORDER: BroadcastMainTabId[] = [
  'feeds',
  'channels',
  'education',
  'market',
  'healthcare',
];

const TAB_SWIPE_DISTANCE = 104;
const TAB_SWIPE_MAX_VERTICAL_DRIFT = 30;
const TAB_SWIPE_DIRECTION_RATIO = 2.5;

export default function BroadcastScreen() {
  const { palette, tone } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const broadcastGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#4B2F2A', '#8A5A12', '#D9A875', '#6B4334'];

  const [activeMainTab, setActiveMainTab] =
    useState<BroadcastMainTabId>('feeds');
  const [searchTerms, setSearchTerms] = useState<
    Record<BroadcastMainTabId, string>
  >({
    feeds: '',
    channels: '',
    education: '',
    market: '',
    healthcare: '',
  });
  const [filterVisible, setFilterVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cartState, setCartState] = useState<ShopCartState>(getShopCartState());
  const [selectedFilters, setSelectedFilters] = useState<
    Record<BroadcastMainTabId, string>
  >(() =>
    (Object.keys(FILTER_OPTIONS) as BroadcastMainTabId[]).reduce((acc, key) => {
      acc[key] = FILTER_OPTIONS[key][0].key;
      return acc;
    }, {} as Record<BroadcastMainTabId, string>),
  );

  const handleFilterSelect = (optionKey: string) => {
    setSelectedFilters(prev => ({ ...prev, [activeMainTab]: optionKey }));
  };

  const switchMainTabByDirection = useCallback(
    (direction: 'next' | 'previous') => {
      const currentIndex = MAIN_TAB_ORDER.indexOf(activeMainTab);
      const nextIndex =
        direction === 'next'
          ? Math.min(MAIN_TAB_ORDER.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      const nextTab = MAIN_TAB_ORDER[nextIndex];
      if (nextTab && nextTab !== activeMainTab) {
        setFilterVisible(false);
        setActiveMainTab(nextTab);
      }
    },
    [activeMainTab],
  );

  const tabSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, gesture) => {
          const absDx = Math.abs(gesture.dx);
          const absDy = Math.abs(gesture.dy);
          return absDx < TAB_SWIPE_DISTANCE ||
            absDy > TAB_SWIPE_MAX_VERTICAL_DRIFT ||
            absDx < absDy * TAB_SWIPE_DIRECTION_RATIO
            ? false
            : true;
        },
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          const absDx = Math.abs(gesture.dx);
          const absDy = Math.abs(gesture.dy);
          return (
            absDx >= TAB_SWIPE_DISTANCE &&
            absDy <= TAB_SWIPE_MAX_VERTICAL_DRIFT &&
            absDx >= absDy * TAB_SWIPE_DIRECTION_RATIO
          );
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx <= -TAB_SWIPE_DISTANCE) {
            switchMainTabByDirection('next');
          } else if (gesture.dx >= TAB_SWIPE_DISTANCE) {
            switchMainTabByDirection('previous');
          }
        },
        onPanResponderTerminationRequest: () => true,
        onShouldBlockNativeResponder: () => false,
      }),
    [switchMainTabByDirection],
  );

  const currentFilter = selectedFilters[activeMainTab];
  const currentSearchTerm = searchTerms[activeMainTab];
  const currentFilterOption =
    FILTER_OPTIONS[activeMainTab].find(
      option => option.key === currentFilter,
    ) ?? FILTER_OPTIONS[activeMainTab][0];
  const showFilterPanel =
    filterVisible && FILTER_OPTIONS[activeMainTab]?.length > 0;
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabsParamList, 'Broadcast'>>();
  const handleCreate = useCallback(() => {
    const profileKey = PROFILE_KEY_BY_TAB[activeMainTab];
    navigation.navigate('Profile', { broadcastProfileKey: profileKey });
  }, [activeMainTab, navigation]);

  const handlePullToRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      DeviceEventEmitter.emit('broadcast.refresh');
      // Keep the indicator visible briefly while listeners re-fetch feed data.
      await new Promise(resolve =>
        setTimeout(resolve, activeMainTab === 'feeds' ? 900 : 600),
      );
    } finally {
      setRefreshing(false);
    }
  }, [activeMainTab, refreshing]);

  React.useEffect(() => {
    const unsubscribe = subscribeToShopCart(setCartState);
    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (activeMainTab !== 'market') return;
    void refreshShopCartFromBackend();
  }, [activeMainTab]);

  useFocusEffect(
    useCallback(() => {
      if (activeMainTab !== 'market') {
        return () => {};
      }
      void refreshShopCartFromBackend();
      return () => {};
    }, [activeMainTab]),
  );

  const totalCartItems = useMemo(
    () =>
      Object.values(cartState.carts).reduce(
        (sum, cart) =>
          sum +
          cart.items.reduce(
            (inner, item) => inner + Math.max(0, item.quantity),
            0,
          ),
        0,
      ),
    [cartState.carts],
  );

  const openCartList = useCallback(() => {
    navigation.navigate('CartsList' as never);
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: palette.bg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            tintColor={palette.primaryStrong}
            colors={[palette.primaryStrong]}
          />
        }
      >
        <LinearGradient
          colors={broadcastGoldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerContainer}
        >
          <View style={styles.headerHalo} />
          
          <View style={styles.headerInner}>
            <View style={styles.headerSection}>
              <BroadcastHeaderBar
                title="Broadcast"
                tierLabel="Business Pro"
                onCreate={handleCreate}
              />
            </View>
            <View style={styles.headerSection}>
              <BroadcastMainTabs
                value={activeMainTab}
                onChange={setActiveMainTab}
              />
            </View>
            <View style={styles.headerSection}>
              <BroadcastSearchRow
                searchPlaceholder={SEARCH_PLACEHOLDERS[activeMainTab]}
                searchValue={currentSearchTerm}
                onSearchChange={next =>
                  setSearchTerms(prev => ({ ...prev, [activeMainTab]: next }))
                }
                onFilterPress={() => setFilterVisible(prev => !prev)}
                filterLabel={currentFilterOption.label}
                filterActive={filterVisible}
              />
            </View>
            {showFilterPanel ? (
              <View style={[styles.headerSection, styles.filterPanel]}>
                {FILTER_OPTIONS[activeMainTab].map(option => (
                  <Pressable
                    key={option.key}
                    onPress={() => handleFilterSelect(option.key)}
                    style={[
                      styles.filterOption,
                      {
                        borderColor:
                          option.key === currentFilter
                            ? palette.primary
                            : palette.divider,
                        backgroundColor:
                          option.key === currentFilter
                            ? palette.primarySoft
                            : palette.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterOptionLabel,
                        {
                          color:
                            option.key === currentFilter
                              ? palette.primaryStrong
                              : palette.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.filterOptionDescription,
                        { color: palette.subtext },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </LinearGradient>
        <View
          style={{ paddingHorizontal: 12 }}
          {...tabSwipeResponder.panHandlers}
        >
          {activeMainTab === 'feeds' && (
            <BroadcastFeedsPage
              searchTerm={currentSearchTerm}
              searchContext={currentFilter}
              onTrendingSeeAll={() => {
                handleFilterSelect('trending');
                setFilterVisible(false);
              }}
            />
          )}
          {activeMainTab === 'channels' && (
            <ChannelsDiscoverPage
              searchTerm={currentSearchTerm}
              searchContext={currentFilter}
            />
          )}
          {activeMainTab === 'education' && (
            <BroadcastEducationPage
              searchTerm={currentSearchTerm}
              searchContext={currentFilter}
            />
          )}
          {activeMainTab === 'market' && (
            <BroadcastMarketPage
              searchTerm={currentSearchTerm}
              searchContext={currentFilter}
            />
          )}
          {activeMainTab === 'healthcare' && (
            <BroadcastHealthcarePage
              searchTerm={currentSearchTerm}
              searchContext={currentFilter}
            />
          )}
        </View>
      </ScrollView>
      {activeMainTab === 'market' ? (
        <View pointerEvents="box-none" style={styles.cartOverlay}>
          <Pressable
            onPress={openCartList}
            style={[
              styles.cartButton,
              {
                backgroundColor: palette.primarySoft,
                borderColor: palette.primary,
                shadowColor: palette.shadow ?? '#000',
              },
            ]}
          >
            <KISIcon name="cart" size={22} color={palette.primaryStrong} />
            {totalCartItems > 0 ? (
              <View
                style={[
                  styles.cartBadge,
                  { backgroundColor: palette.primaryStrong },
                ]}
              >
                <Text style={{ color: palette.surface, fontWeight: '800' }}>
                  {totalCartItems}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    headerContainer: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: '#6B4334',
      borderBottomWidth: 0,
      borderBottomColor: 'transparent',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: 'hidden',
      shadowColor: palette.shadow ?? '#000',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    headerHalo: {
      position: 'absolute',
      top: -48,
      right: -28,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: palette.gold,
      opacity: 0.16,
    },
    headerSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: 'rgba(255,244,184,0.45)',
    },
    headerInner: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 22,
    },
    headerSection: {
      marginBottom: 12,
    },
    filterPanel: {
      borderWidth: 0,
      borderRadius: 22,
      borderColor: 'transparent',
      padding: 8,
      backgroundColor: palette.surface,
      flexDirection: 'row',
      flexWrap: 'wrap',
      shadowColor: palette.shadow ?? '#000',
      shadowOpacity: 0.07,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    filterOption: {
      borderWidth: 1,
      borderRadius: 18,
      minWidth: 120,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginRight: 8,
      marginBottom: 8,
    },
    filterOptionLabel: {
      fontSize: 13,
      fontWeight: '900',
    },
    filterOptionDescription: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    cartOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      paddingRight: 16,
      paddingBottom: 24,
      zIndex: 100,
      elevation: 100,
    },
    cartButton: {
      borderWidth: 1,
      borderRadius: 999,
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
    },
    cartBadge: {
      minWidth: 24,
      position: 'absolute',
      top: -4,
      right: -4,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
