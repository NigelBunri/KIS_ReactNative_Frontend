import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import FeedsDiscoverPage from '@/screens/broadcast/feeds/FeedsDiscoverPage';
import useFeedsData from '@/screens/broadcast/feeds/hooks/useFeedsData';
import { postRequest } from '@/network/post';
// Patched in place with jest.spyOn rather than replaced wholesale
// (`ReactNative.Share = {...}` etc.) — see the same fix/rationale in
// broadcast-feeds.detail-screen.test.tsx: a fresh replacement object here
// isn't guaranteed to be what the component under test still holds a
// reference to; spying on the existing singletons' methods is.
const ReactNative = require('react-native');
jest.spyOn(ReactNative.Share, 'share').mockResolvedValue({ action: 'sharedAction' });
jest.spyOn(ReactNative.Alert, 'alert').mockImplementation(() => {});
jest.spyOn(ReactNative.DeviceEventEmitter, 'emit').mockImplementation(() => {});
jest.spyOn(ReactNative.DeviceEventEmitter, 'addListener').mockReturnValue({ remove: jest.fn() });
ReactNative.RefreshControl = ReactNative.View;

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));

jest.mock('@/hooks/useResponsibleFeedLimit', () => ({
  useResponsibleFeedLimit: () => ({ status: null, refreshStatus: jest.fn() }),
}));

jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({
    palette: {
      primaryStrong: '#111',
      primarySoft: '#eee',
      primary: '#222',
      subtext: '#555',
      text: '#000',
      divider: '#ddd',
      card: '#fff',
      surface: '#f5f5f5',
      danger: '#c00',
    },
  }),
}));

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    broadcasts: {
      commentRoom: (id: string) => `/api/v1/broadcasts/${id}/comment-room/`,
    },
    moderation: {
      flags: '/api/v1/moderation/flags/',
      userBlocks: '/api/v1/moderation/blocks/',
    },
  },
}));

jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));
jest.mock('@/screens/broadcast/feeds/hooks/useFeedsData', () => jest.fn());

let mainSectionProps: any = null;

jest.mock('@/screens/broadcast/feeds/sections/FeedsMainListSection', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockFeedsMainListSection(props: any) {
    mainSectionProps = props;
    return React.createElement(
      View,
      { testID: 'feeds-main-list' },
      React.createElement(Text, null, `items:${(props.items || []).length}`),
      React.createElement(
        Text,
        null,
        `loading:${String(Boolean(props.loading))}`,
      ),
    );
  };
});

jest.mock('@/screens/broadcast/feeds/sections/TrendingClipsSection', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockTrendingClipsSection(props: any) {
    return React.createElement(
      View,
      { testID: 'trending-section' },
      React.createElement(Text, null, `trending:${(props.items || []).length}`),
    );
  };
});

const mockedUseFeedsData = useFeedsData as jest.MockedFunction<
  typeof useFeedsData
>;
const mockedPostRequest = postRequest as jest.MockedFunction<
  typeof postRequest
>;

const item = {
  id: 'broadcast-1',
  source_type: 'broadcast_profile',
  title: 'Alpha release',
  text_plain: 'Hello Alpha',
  viewer_saved: false,
  reaction_count: 2,
  comment_count: 3,
  share_count: 1,
  author: { id: 'author-1', display_name: 'Nigel' },
  source: {
    type: 'partner',
    id: 'partner-1',
    name: 'Partner One',
    allow_subscribe: true,
    is_subscribed: false,
  },
};

const createHookValue = (
  overrides: Partial<ReturnType<typeof useFeedsData>> = {},
) => ({
  items: [item],
  trending: [{ id: 'trend-1', title: 'Trend' }],
  trendingFeeds: [item],
  loading: false,
  loadingMore: false,
  refreshing: false,
  refreshAll: jest.fn(),
  loadMore: jest.fn(),
  toggleSubscribe: jest.fn(async () => ({ ok: true })),
  reactToItem: jest.fn(async () => ({ ok: true })),
  recordShare: jest.fn(async () => ({ ok: true })),
  hideItem: jest.fn(async () => ({ ok: true })),
  toggleSaved: jest.fn(async () => ({ ok: true, saved: true })),
  ...overrides,
});

describe('broadcast feeds discover page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mainSectionProps = null;
  });

  test('renders active feed list, passes loading state, and filters saved/search results', async () => {
    mockedUseFeedsData.mockReturnValue(
      createHookValue({
        items: [
          item,
          {
            ...item,
            id: 'broadcast-2',
            title: 'Beta release',
            text_plain: 'Hello Beta',
            viewer_saved: true,
          },
        ],
        loading: true,
      }) as any,
    );

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <FeedsDiscoverPage searchTerm="beta" searchContext="Saved" />,
      );
    });

    const textNodes = renderer!.root.findAllByType('Text');
    expect(textNodes.some(node => node.props.children === 'items:1')).toBe(
      true,
    );
    expect(textNodes.some(node => node.props.children === 'loading:true')).toBe(
      true,
    );
    expect(mainSectionProps.items[0].id).toBe('broadcast-2');
  });

  test('opens detail, starts comments flow, and shares from active feed actions', async () => {
    const hookValue = createHookValue();
    mockedUseFeedsData.mockReturnValue(hookValue as any);
    mockedPostRequest.mockResolvedValue({
      success: true,
      data: { conversation_id: 'conversation-1' },
    } as any);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<FeedsDiscoverPage />);
    });

    await ReactTestRenderer.act(async () => {
      mainSectionProps.onOpenItem(item);
    });
    // handleOpenItem also passes the active feed list + the tapped item's
    // position in it now (see FeedsDiscoverPage.tsx), so BroadcastDetail
    // can page between items without a round trip back through this
    // screen — not just the single tapped item.
    expect(mockNavigate).toHaveBeenCalledWith('BroadcastDetail', {
      id: 'broadcast-1',
      item,
      items: hookValue.items,
      index: 0,
    });

    await ReactTestRenderer.act(async () => {
      await mainSectionProps.onComment(item);
    });
    expect(mockedPostRequest).toHaveBeenCalledWith(
      '/api/v1/broadcasts/broadcast-1/comment-room/',
      {},
      expect.objectContaining({ errorMessage: 'Unable to load comments.' }),
    );
    const { DeviceEventEmitter, Share } = require('react-native');
    expect(DeviceEventEmitter.emit).toHaveBeenCalledWith(
      'chat.open',
      expect.objectContaining({ conversationId: 'conversation-1' }),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('Messages');

    await ReactTestRenderer.act(async () => {
      await mainSectionProps.onShare(item);
    });
    expect(hookValue.recordShare).toHaveBeenCalledWith('broadcast-1');
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Alpha release' }),
    );
  });

  test('supports save, hide, subscribe, unsubscribe, and load more interactions', async () => {
    const hookValue = createHookValue();
    mockedUseFeedsData.mockReturnValue(hookValue as any);
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<FeedsDiscoverPage />);
    });

    await ReactTestRenderer.act(async () => {
      await mainSectionProps.onSave(item);
    });
    expect(hookValue.toggleSaved).toHaveBeenCalledWith('broadcast-1', false);

    const { Alert } = require('react-native');

    await ReactTestRenderer.act(async () => {
      mainSectionProps.onMenu(item);
    });
    const menuButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] ?? [];
    const saveButton = menuButtons.find(
      (entry: any) => entry.text === 'Save post',
    );
    const hideButton = menuButtons.find((entry: any) => entry.text === 'Hide');

    await ReactTestRenderer.act(async () => {
      await saveButton.onPress();
      await hideButton.onPress();
    });
    expect(hookValue.toggleSaved).toHaveBeenCalledWith('broadcast-1', false);
    // "Hide" from the menu opens its own confirmation alert ("You will
    // never see this post again.") rather than hiding right away — hideItem
    // only fires once that second alert's destructive button is pressed.
    const hideConfirmButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] ?? [];
    const confirmHideButton = hideConfirmButtons.find(
      (entry: any) => entry.text === 'Yes, hide',
    );
    await ReactTestRenderer.act(async () => {
      await confirmHideButton.onPress();
    });
    expect(hookValue.hideItem).toHaveBeenCalledWith('broadcast-1');

    await ReactTestRenderer.act(async () => {
      await mainSectionProps.onSubscribe(item.source, false);
    });
    expect(hookValue.toggleSubscribe).toHaveBeenCalledWith(item.source, false);

    const subscribedSource = {
      ...item.source,
      is_subscribed: true,
      name: 'Partner One',
    };
    await ReactTestRenderer.act(async () => {
      await mainSectionProps.onSubscribe(subscribedSource, true);
    });
    const unsubscribeButtons =
      (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] ?? [];
    const unsubscribeButton = unsubscribeButtons.find(
      (entry: any) => entry.text === 'Unsubscribe',
    );
    await ReactTestRenderer.act(async () => {
      await unsubscribeButton.onPress();
    });
    expect(hookValue.toggleSubscribe).toHaveBeenCalledWith(
      subscribedSource,
      true,
    );

    // findByType('ScrollView') (a string) never matches: like Pressable
    // (see broadcast-feeds.detail-screen.test.tsx), ScrollView is a
    // composite component, not a host primitive — its test-instance type
    // is never the literal string "ScrollView". There are two ScrollViews
    // in this tree (an inner horizontal category-chip row plus the outer
    // page scroller); only the outer one takes onScroll.
    // The RN jest preset's own ScrollView mock has test-instance type
    // name "ScrollViewMock" (found by first collecting every node with an
    // onScroll prop, which also picks up its inner "Component"/
    // "RCTScrollView" wrapper layers) — not the string "ScrollView" (a
    // composite component, not a host primitive; see the Pressable/
    // findAllByType comment in broadcast-feeds.detail-screen.test.tsx).
    const scrollView = renderer!.root.findAll(
      (node) => (node.type as any)?.name === 'ScrollViewMock',
    )[0];
    await ReactTestRenderer.act(async () => {
      scrollView.props.onScroll({
        nativeEvent: {
          layoutMeasurement: { height: 400 },
          contentOffset: { y: 900 },
          contentSize: { height: 1000 },
        },
      });
    });
    expect(hookValue.loadMore).toHaveBeenCalled();
  });

  test('shows alerts on failed like/share/subscribe actions', async () => {
    const hookValue = createHookValue({
      reactToItem: jest.fn(async () => ({ ok: false })),
      recordShare: jest.fn(async () => ({ ok: false })),
      toggleSubscribe: jest.fn(async () => ({ ok: false })),
    });
    mockedUseFeedsData.mockReturnValue(hookValue as any);
    mockedPostRequest.mockResolvedValue({
      success: true,
      data: { conversation_id: 'conversation-1' },
    } as any);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<FeedsDiscoverPage />);
    });

    const { Alert } = require('react-native');

    await ReactTestRenderer.act(async () => {
      await mainSectionProps.onLike(item);
      await mainSectionProps.onShare(item);
      await mainSectionProps.onSubscribe(item.source, false);
    });

    const alertTitles = (Alert.alert as jest.Mock).mock.calls.map(
      (call: any[]) => call[0],
    );
    expect(alertTitles).toContain('Reaction');
    expect(alertTitles).toContain('Share');
    expect(alertTitles).toContain('Subscribe');
  });
});
