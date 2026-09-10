import { DeviceEventEmitter } from 'react-native';
import { routeNotification } from '../notificationRouter';

// Regression coverage for two real bugs found while investigating "tapping a
// push notification doesn't open the exact chat room":
//   1. This used navigation.navigate('MainTabs', {screen:'Messages', params})
//      to reach a conversation, but ChatRoomPage isn't a navigator screen -
//      it's rendered by AppNavigator's own local state, reached only via the
//      'chat.open' DeviceEventEmitter bridge every other "open this chat"
//      call site in the app already uses.
//   2. Nest's real push payloads (notifications.service.ts) send camelCase
//      'conversationId', but this only ever destructured snake_case
//      'conversation_id' - the branch silently never fired for a real
//      message push.

describe('routeNotification: conversation / chat message', () => {
  it('opens the exact chat via chat.open when the payload uses camelCase conversationId (Nest\'s real shape)', () => {
    const emitSpy = jest.spyOn(DeviceEventEmitter, 'emit');
    const navigate = jest.fn();

    routeNotification({ conversationId: 'conv-42', title: 'Jane Doe' }, { navigate });

    expect(emitSpy).toHaveBeenCalledWith('chat.open', expect.objectContaining({
      conversationId: 'conv-42',
      name: 'Jane Doe',
    }));
    expect(navigate).not.toHaveBeenCalled();
    emitSpy.mockRestore();
  });

  it('also accepts legacy snake_case conversation_id', () => {
    const emitSpy = jest.spyOn(DeviceEventEmitter, 'emit');
    const navigate = jest.fn();

    routeNotification({ conversation_id: 'conv-99' }, { navigate });

    expect(emitSpy).toHaveBeenCalledWith('chat.open', expect.objectContaining({ conversationId: 'conv-99' }));
    emitSpy.mockRestore();
  });

  it('falls through to the next branch when no conversation id is present', () => {
    const emitSpy = jest.spyOn(DeviceEventEmitter, 'emit');
    const navigate = jest.fn();

    routeNotification({ broadcast_id: 'bcast-1' }, { navigate });

    expect(emitSpy).not.toHaveBeenCalledWith('chat.open', expect.anything());
    expect(navigate).toHaveBeenCalledWith('BroadcastDetail', { id: 'bcast-1' });
    emitSpy.mockRestore();
  });
});
