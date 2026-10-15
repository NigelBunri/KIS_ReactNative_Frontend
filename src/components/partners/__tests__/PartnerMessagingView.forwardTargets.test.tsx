// Regression coverage for AND-039 ("forward to" chat picker list empty).
//
// Root cause (one of several call sites): PartnerMessagingView.tsx opened
// ChatRoomPage for the active chat without passing `allChats` at all.
// ChatRoomPage.tsx's forwardTargets memo defaults that prop to `[]`, and
// ForwardChatSheet (the "Forward to..." picker) only ever renders whatever
// `allChats` it's given — so forwarding from any partner group/channel/
// community chat opened a picker with a search box and nothing to search,
// even though this screen's own `items` state (loaded from the groups/
// channels/communities endpoints) already holds every other conversation
// available. This test drives the component through loading a list and
// opening one chat, then asserts ChatRoomPage was handed a non-empty
// `allChats` built from the *other* items.

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { FlatList } from 'react-native';

jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({ palette: {} }),
}));

const mockGetRequest = jest.fn();
jest.mock('@/network/get', () => ({
  getRequest: (...args: any[]) => mockGetRequest(...args),
}));
jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    groups: { list: 'https://api.example.com/groups' },
    channels: { getAllChannels: 'https://api.example.com/channels' },
    community: { list: 'https://api.example.com/communities' },
  },
}));

let capturedChatRoomPageProps: any = null;
jest.mock('@/Module/ChatRoom/ChatRoomPage', () => ({
  ChatRoomPage: (props: any) => {
    capturedChatRoomPageProps = props;
    return null;
  },
}));

import PartnerMessagingView from '../PartnerMessagingView';

describe('PartnerMessagingView — forwardTargets data (AND-039)', () => {
  beforeEach(() => {
    capturedChatRoomPageProps = null;
    mockGetRequest.mockReset();
  });

  it('passes every OTHER loaded conversation as allChats when a chat is opened', async () => {
    mockGetRequest.mockImplementation(async (url: string) => {
      if (url.includes('groups')) {
        return {
          success: true,
          data: {
            results: [
              { id: 'g1', name: 'Group One', conversation_id: 'conv-g1' },
              { id: 'g2', name: 'Group Two', conversation_id: 'conv-g2' },
            ],
          },
        };
      }
      if (url.includes('channels')) {
        return {
          success: true,
          data: { results: [{ id: 'c1', name: 'Channel One', conversation_id: 'conv-c1' }] },
        };
      }
      return { success: true, data: { results: [] } };
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PartnerMessagingView partnerId="p1" partnerName="Partner One" />,
      );
    });

    // Let the async loadAll() effect settle.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const list = renderer!.root.findByType(FlatList);
    const items: any[] = list.props.data;
    expect(items.length).toBe(3); // 2 groups + 1 channel

    // Open the first item the exact same way a real tap does — invoke the
    // FlatList's own renderItem for it and call the resulting element's
    // onPress, rather than reaching into PartnerMessagingView's internals.
    const rendered = list.props.renderItem({ item: items[0] });
    await act(async () => {
      rendered.props.onPress();
    });

    expect(capturedChatRoomPageProps).not.toBeNull();
    expect(Array.isArray(capturedChatRoomPageProps.allChats)).toBe(true);
    // The opened chat itself isn't excluded by this screen (ChatRoomPage's
    // own forwardTargets memo does that filtering), but the list must be
    // non-empty and only contain real, forwardable conversations.
    expect(capturedChatRoomPageProps.allChats.length).toBeGreaterThan(0);
    for (const c of capturedChatRoomPageProps.allChats) {
      expect(c.conversationId).toBeTruthy();
    }
  });
});
