// src/screens/calls/components/PanelistPickerSheet.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

export const MIN_BROADCAST_PANELISTS = 1;
export const MAX_BROADCAST_PANELISTS = 30;

type InvitableChat = {
  chat: Chat;
  userId: string;
};

type Props = {
  visible: boolean;
  palette: any;
  loading: boolean;
  invitable: InvitableChat[];
  selectedUserIds: string[];
  onChangeSelected: (userIds: string[]) => void;
  onClose: () => void;
  onDone: () => void;
};

/**
 * Required step before creating a broadcast call (ScheduleCallSheet) — a
 * broadcast needs panelists chosen up front (1-30, never 0), unlike every
 * other call type which can start with just the host and pick up people
 * later via call.invite mid-call. A separate Modal (not an absolutely-
 * positioned overlay) since it needs to stack cleanly on top of
 * ScheduleCallSheet's own Modal, the same nested-Modal shape already used
 * elsewhere in this codebase (e.g. QrCodeShareModal inside InviteLinkCard).
 */
export default function PanelistPickerSheet({
  visible,
  palette,
  loading,
  invitable,
  selectedUserIds,
  onChangeSelected,
  onClose,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invitable;
    return invitable.filter(({ chat }) => (chat.name ?? '').toLowerCase().includes(q));
  }, [query, invitable]);

  const atMax = selectedUserIds.length >= MAX_BROADCAST_PANELISTS;

  const toggle = (userId: string) => {
    const already = selectedUserIds.includes(userId);
    if (!already && atMax) return;
    onChangeSelected(
      already ? selectedUserIds.filter(id => id !== userId) : [...selectedUserIds, userId],
    );
  };

  const canConfirm = selectedUserIds.length >= MIN_BROADCAST_PANELISTS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View
        style={{
          height: '70%',
          minHeight: 420,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: palette.card,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: palette.inputBorder,
          }}
        >
          <View>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>
              Add panelists
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
              {selectedUserIds.length}/{MAX_BROADCAST_PANELISTS} selected · at least 1 required
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <KISIcon name="close" size={20} color={palette.subtext} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={palette.subtext}
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: palette.inputBorder,
              color: palette.text,
              backgroundColor: palette.surface,
            }}
          />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={palette.gold} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={({ chat }) => chat.id}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 12) }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
                <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                  No chats found to pick panelists from.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = selectedUserIds.includes(item.userId);
              const disabled = !selected && atMax;
              return (
                <Pressable
                  onPress={() => toggle(item.userId)}
                  disabled={disabled}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRadius: 14,
                    opacity: disabled ? 0.4 : 1,
                    backgroundColor: selected ? `${palette.gold}1F` : 'transparent',
                  }}
                >
                  <ImagePlaceholder size={34} radius={17} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, color: palette.text, fontSize: 14 }} numberOfLines={1}>
                    {item.chat.name ?? 'Chat'}
                  </Text>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selected ? palette.gold : palette.inputBorder,
                      backgroundColor: selected ? palette.gold : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && <KISIcon name="check" size={13} color={palette.royalInk} />}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <View
          style={{
            padding: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopWidth: 1,
            borderTopColor: palette.inputBorder,
          }}
        >
          <Pressable
            onPress={onDone}
            disabled={!canConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirm panelists"
            style={{
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: 'center',
              backgroundColor: canConfirm ? palette.gold : palette.inputBorder,
            }}
          >
            <Text style={{ color: canConfirm ? palette.royalInk : palette.subtext, fontWeight: '800' }}>
              {selectedUserIds.length > 0 ? `Done (${selectedUserIds.length})` : 'Select at least 1 panelist'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
