// src/screens/calls/components/AddParticipantSheet.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Animated,
  ActivityIndicator,
} from 'react-native';

import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type InvitableChat = {
  chat: Chat;
  userId: string;
};

type Props = {
  visible: boolean;
  palette: any;
  loading: boolean;
  /** Direct (1:1) chats whose other participant isn't already on the call. */
  invitable: InvitableChat[];
  inviting: boolean;
  onClose: () => void;
  onInvite: (userIds: string[]) => void;
};

/**
 * Bottom sheet for inviting people into an already-active call — tapping
 * "Add" in CallControls (or the '+' in ParticipantsSheet) opens this instead
 * of the old username/user-ID text prompt. Deliberately only covers ~40% of
 * the screen (not ParticipantsSheet's 65%, not ForwardChatSheet's full
 * slide-from-right) so the call itself — video, who's talking — stays
 * visible and the sheet reads as a quick, lightweight action, not a
 * full-screen context switch away from the call in progress.
 */
export default function AddParticipantSheet({
  visible,
  palette,
  loading,
  invitable,
  inviting,
  onClose,
  onInvite,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    if (!visible) {
      setQuery('');
      setSelectedUserIds([]);
    }
  }, [visible, slideAnim]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invitable;
    return invitable.filter(({ chat }) => (chat.name ?? '').toLowerCase().includes(q));
  }, [query, invitable]);

  const toggle = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  if (!mounted) return null;

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
        minHeight: 320,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderTopColor: `${palette.gold}33`,
        backgroundColor: palette.royalInk,
        zIndex: 60,
        transform: [{ translateY }],
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
          borderBottomColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Text style={{ color: palette.ivory, fontSize: 16, fontWeight: '700' }}>
          Add to call{selectedUserIds.length > 0 ? ` (${selectedUserIds.length})` : ''}
        </Text>
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
            borderColor: 'rgba(255,255,255,0.15)',
            color: palette.ivory,
            backgroundColor: 'rgba(255,255,255,0.05)',
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
                No chats to invite — everyone you message is already on this call.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = selectedUserIds.includes(item.userId);
            return (
              <Pressable
                onPress={() => toggle(item.userId)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: selected ? `${palette.gold}1F` : 'transparent',
                }}
              >
                <ImagePlaceholder size={34} radius={17} style={{ marginRight: 10 }} />
                <Text style={{ flex: 1, color: palette.ivory, fontSize: 14 }} numberOfLines={1}>
                  {item.chat.name ?? 'Chat'}
                </Text>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: selected ? palette.gold : 'rgba(255,255,255,0.3)',
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
          borderTopColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Pressable
          onPress={() => onInvite(selectedUserIds)}
          disabled={selectedUserIds.length === 0 || inviting}
          accessibilityRole="button"
          accessibilityLabel="Invite selected to call"
          style={{
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: 'center',
            backgroundColor: selectedUserIds.length === 0 || inviting ? 'rgba(255,255,255,0.1)' : palette.goldDeep,
          }}
        >
          {inviting ? (
            <ActivityIndicator color={palette.ivory} />
          ) : (
            <Text style={{ color: palette.ivory, fontWeight: '700' }}>
              {selectedUserIds.length > 0 ? `Invite (${selectedUserIds.length})` : 'Invite'}
            </Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}
