jest.mock('react-native-fs', () => {
  const files = new Map<string, string>();
  const directories = new Set<string>(['/documents']);
  (global as any).__KIS_RNFS_FILES = files;
  (global as any).__KIS_RNFS_DIRECTORIES = directories;
  return {
    DocumentDirectoryPath: '/documents',
    CachesDirectoryPath: '/cache',
    exists: jest.fn(async (path: string) => files.has(path) || directories.has(path)),
    mkdir: jest.fn(async (path: string) => {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      parts.forEach((part) => {
        current += `/${part}`;
        directories.add(current);
      });
    }),
    writeFile: jest.fn(async (path: string, value: string) => {
      files.set(path, value);
    }),
    readFile: jest.fn(async (path: string) => {
      if (!files.has(path)) throw new Error('ENOENT');
      return files.get(path) as string;
    }),
    moveFile: jest.fn(async (from: string, to: string) => {
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from) as string);
      files.delete(from);
    }),
    unlink: jest.fn(async (path: string) => {
      files.delete(path);
    }),
    readDir: jest.fn(async (directory: string) =>
      Array.from(files.keys())
        .filter((path) => path.startsWith(`${directory}/`) && !path.slice(directory.length + 1).includes('/'))
        .map((path) => ({
          path,
          name: path.slice(path.lastIndexOf('/') + 1),
          isFile: () => true,
        })),
    ),
  };
});
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadMessages, saveMessages } from '../src/Module/ChatRoom/Storage/chatStorage';
import type { ChatMessage } from '../src/Module/ChatRoom/chatTypes';

const message = (index: number, roomId: string): ChatMessage => ({
  id: `message-${index}`,
  clientId: `client-${index}`,
  serverId: `server-${index}`,
  conversationId: roomId,
  roomId,
  senderId: index % 2 ? 'user-a' : 'user-b',
  fromMe: index % 2 === 1,
  createdAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
  kind: 'text',
  text: `Message ${index}`,
  status: 'sent',
});

describe('durable chat history persistence', () => {
  beforeEach(async () => {
    const files = (global as any).__KIS_RNFS_FILES as Map<string, string>;
    const directories = (global as any).__KIS_RNFS_DIRECTORIES as Set<string>;
    files.clear();
    directories.clear();
    directories.add('/documents');
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('keeps the complete room history while limiting the compatibility snapshot', async () => {
    const roomId = 'room-large';
    const messages = Array.from({ length: 650 }, (_, index) => message(index, roomId));

    await saveMessages(roomId, messages, 'user-a');

    const snapshot = JSON.parse(
      (await AsyncStorage.getItem(`KIS_CHAT_MESSAGES_BY_USER_ROOM_V3:user-a:${roomId}`)) ?? '[]',
    );
    expect(snapshot).toHaveLength(500);
    await AsyncStorage.removeItem(`KIS_CHAT_MESSAGES_BY_USER_ROOM_V3:user-a:${roomId}`);

    const loaded = await loadMessages(roomId, 'user-a');
    expect(loaded).toHaveLength(650);
    expect(loaded[0].serverId).toBe('server-0');
    expect(loaded[649].serverId).toBe('server-649');
  });

  it('recovers the previous complete generation when the newest file is corrupt', async () => {
    const roomId = 'room-recovery';
    await saveMessages(roomId, [message(1, roomId), message(2, roomId)], 'user-a');
    await saveMessages(
      roomId,
      [message(1, roomId), message(2, roomId), message(3, roomId)],
      'user-a',
    );
    await AsyncStorage.removeItem(`KIS_CHAT_MESSAGES_BY_USER_ROOM_V3:user-a:${roomId}`);

    const files = (global as any).__KIS_RNFS_FILES as Map<string, string>;
    const primary = Array.from(files.keys()).find(
      (path) => path.endsWith('.json') && !path.endsWith('.backup'),
    );
    expect(primary).toBeDefined();
    files.set(primary as string, '{invalid');

    const loaded = await loadMessages(roomId, 'user-a');
    expect(loaded).toHaveLength(2);
    expect(loaded.map((item) => item.serverId)).toEqual(['server-1', 'server-2']);
  });
});
