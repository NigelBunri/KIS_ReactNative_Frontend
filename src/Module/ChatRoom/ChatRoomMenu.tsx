import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Chat } from './messagesUtils';
import * as Handlers from './ChatRoomHandlers';

type Props = {
  palette: any;
  chat: Chat | null;
  menuVisible: boolean;
  onCloseMenu: () => void;
  dmRole: string | null;
  requestStateEffective: string;
  isLocked: boolean;
  isMuted: boolean;
  conversationId: string | null;
  onAcceptRequest: () => Promise<void>;
  onBlockChat: () => Promise<void>;
  onToggleMute: () => Promise<void>;
  onOpenSearch: () => void;
  onOpenAddMember: () => void;
  onOpenRemoveMember: () => void;
  onOpenSetRole: () => void;
};

export default function ChatRoomMenu({
  palette,
  chat,
  menuVisible,
  onCloseMenu,
  dmRole,
  requestStateEffective,
  isLocked,
  isMuted,
  conversationId,
  onAcceptRequest,
  onBlockChat,
  onToggleMute,
  onOpenSearch,
  onOpenAddMember,
  onOpenRemoveMember,
  onOpenSetRole,
}: Props) {
  return (
    <View pointerEvents={menuVisible ? 'auto' : 'none'} style={localStyles.menuRoot}>
      {menuVisible && (
        <>
          <Pressable onPress={onCloseMenu} style={localStyles.menuOverlay} />
          <View
            style={[
              localStyles.menuBox,
              {
                borderColor: palette.inputBorder ?? palette.divider,
                backgroundColor: palette.card ?? palette.surface,
              },
            ]}
          >
            {dmRole === 'recipient' && requestStateEffective === 'pending' && (
              <Pressable
                onPress={async () => {
                  onCloseMenu();
                  await onAcceptRequest();
                }}
                style={({ pressed }) => [
                  localStyles.menuItem,
                  { backgroundColor: pressed ? palette.surface : 'transparent' },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 14 }}>
                  Accept request
                </Text>
              </Pressable>
            )}

            {!isLocked && (
              <Pressable
                onPress={async () => {
                  onCloseMenu();
                  await onBlockChat();
                }}
                style={({ pressed }) => [
                  localStyles.menuItem,
                  { backgroundColor: pressed ? palette.surface : 'transparent' },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 14 }}>
                  Block chat
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={async () => {
                onCloseMenu();
                await onToggleMute();
              }}
              style={({ pressed }) => [
                localStyles.menuItem,
                { backgroundColor: pressed ? palette.surface : 'transparent' },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: 14 }}>
                {isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </Text>
            </Pressable>

            {(chat as any)?.isGroup && (
              <Pressable
                onPress={() => {
                  onCloseMenu();
                  onOpenAddMember();
                }}
                style={({ pressed }) => [
                  localStyles.menuItem,
                  { backgroundColor: pressed ? palette.surface : 'transparent' },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 14 }}>
                  Add member
                </Text>
              </Pressable>
            )}

            {(chat as any)?.isGroup && (
              <Pressable
                onPress={() => {
                  onCloseMenu();
                  onOpenRemoveMember();
                }}
                style={({ pressed }) => [
                  localStyles.menuItem,
                  { backgroundColor: pressed ? palette.surface : 'transparent' },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 14 }}>
                  Remove member
                </Text>
              </Pressable>
            )}

            {(chat as any)?.isGroup && (
              <Pressable
                onPress={() => {
                  onCloseMenu();
                  onOpenSetRole();
                }}
                style={({ pressed }) => [
                  localStyles.menuItem,
                  { backgroundColor: pressed ? palette.surface : 'transparent' },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 14 }}>
                  Set member role
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                onCloseMenu();
                const convId = String(conversationId ?? chat?.id ?? '');
                Handlers.handleArchiveRequest(convId, !(chat as any)?.isArchived);
              }}
              style={({ pressed }) => [
                localStyles.menuItem,
                { backgroundColor: pressed ? palette.surface : 'transparent' },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: 14 }}>
                {(chat as any)?.isArchived ? 'Unarchive chat' : 'Archive chat'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onCloseMenu();
                onOpenSearch();
              }}
              style={({ pressed }) => [
                localStyles.menuItem,
                { backgroundColor: pressed ? palette.surface : 'transparent' },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: 14 }}>
                Search messages
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  menuRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuBox: {
    position: 'absolute',
    right: 12,
    top: 60,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 6,
    width: 220,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
