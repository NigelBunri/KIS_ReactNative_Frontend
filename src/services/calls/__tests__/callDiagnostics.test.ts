jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logCallDiagnostic, getCallDiagnostics, clearCallDiagnostics } from '../callDiagnostics';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>;

describe('callDiagnostics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends an event and persists it under the diagnostics key', async () => {
    mockedGetItem.mockResolvedValue(null);
    await logCallDiagnostic({ stage: 'PUSH_RECEIVED' });
    expect(mockedSetItem).toHaveBeenCalledWith(
      'KIS_CALL_DIAGNOSTICS_LOG_V1',
      expect.stringContaining('"stage":"PUSH_RECEIVED"'),
    );
  });

  it('never throws even if AsyncStorage fails (diagnostics must not break the real call flow)', async () => {
    mockedGetItem.mockRejectedValue(new Error('storage down'));
    await expect(logCallDiagnostic({ stage: 'CALLKEEP_DISPLAYED_FAILED', callId: 'c1' })).resolves.toBeUndefined();
  });

  it('caps stored events at 50, dropping the oldest', async () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({ stage: 'PUSH_RECEIVED', at: `t${i}` }));
    mockedGetItem.mockResolvedValue(JSON.stringify(existing));
    await logCallDiagnostic({ stage: 'USER_ANSWERED', callId: 'new-one' });
    const written = JSON.parse(mockedSetItem.mock.calls[0][1] as string);
    expect(written).toHaveLength(50);
    expect(written[49].callId).toBe('new-one');
    expect(written[0].at).toBe('t1'); // oldest (t0) dropped
  });

  it('getCallDiagnostics returns events newest-first', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify([
      { stage: 'PUSH_RECEIVED', at: '2026-01-01T00:00:00.000Z' },
      { stage: 'CALLKEEP_DISPLAYED_OK', at: '2026-01-01T00:00:01.000Z' },
    ]));
    const events = await getCallDiagnostics();
    expect(events[0].stage).toBe('CALLKEEP_DISPLAYED_OK');
    expect(events[1].stage).toBe('PUSH_RECEIVED');
  });

  it('getCallDiagnostics returns an empty array on storage error', async () => {
    mockedGetItem.mockRejectedValue(new Error('storage down'));
    await expect(getCallDiagnostics()).resolves.toEqual([]);
  });

  it('clearCallDiagnostics removes the key', async () => {
    await clearCallDiagnostics();
    expect(mockedRemoveItem).toHaveBeenCalledWith('KIS_CALL_DIAGNOSTICS_LOG_V1');
  });
});
