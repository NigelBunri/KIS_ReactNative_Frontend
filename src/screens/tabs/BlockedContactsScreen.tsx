// GAP 4: Blocked Contacts Management Screen
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export type BlockedContact = {
  userId: string;
  displayName: string;
  blockedAt: string; // ISO
};

const BLOCKED_KEY = 'KIS_BLOCKED_CONTACTS';

export async function blockContact(contact: BlockedContact): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BLOCKED_KEY);
    const list: BlockedContact[] = raw ? JSON.parse(raw) : [];
    if (!list.some((c) => c.userId === contact.userId)) {
      list.unshift(contact);
      await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(list));
    }
  } catch { /* silent */ }
}

export async function unblockContact(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BLOCKED_KEY);
    if (!raw) return;
    const list: BlockedContact[] = JSON.parse(raw);
    const next = list.filter((c) => c.userId !== userId);
    await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(next));
  } catch { /* silent */ }
}

export async function isContactBlocked(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(BLOCKED_KEY);
    if (!raw) return false;
    const list: BlockedContact[] = JSON.parse(raw);
    return list.some((c) => c.userId === userId);
  } catch {
    return false;
  }
}

type Props = {
  onBack?: () => void;
};

export default function BlockedContactsScreen({ onBack }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<BlockedContact[]>([]);

  const loadBlocked = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(BLOCKED_KEY);
      if (raw) setContacts(JSON.parse(raw));
      else setContacts([]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void loadBlocked();
    // Listen for block events so the list stays fresh
    const sub = DeviceEventEmitter.addListener('blocked.contacts.refresh', () => {
      void loadBlocked();
    });
    return () => sub.remove();
  }, [loadBlocked]);

  const handleUnblock = (contact: BlockedContact) => {
    Alert.alert(
      'Unblock contact',
      `Unblock ${contact.displayName || 'this contact'}? They will be able to send you messages again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            await unblockContact(contact.userId);
            await loadBlocked();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: BlockedContact }) => {
    const date = new Date(item.blockedAt);
    const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return (
      <View style={[localStyles.row, { backgroundColor: palette.card, borderColor: palette.divider ?? '#eee' }]}>
        {/* Avatar placeholder */}
        <View style={[localStyles.avatar, { backgroundColor: palette.primarySoft ?? palette.surface ?? '#f0f0f0' }]}>
          <KISIcon name="user" size={22} color={palette.primaryStrong ?? palette.primary ?? '#333'} />
        </View>

        {/* Name + date */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: palette.text ?? '#000' }} numberOfLines={1}>
            {item.displayName || 'Unknown'}
          </Text>
          <Text style={{ fontSize: 12, color: palette.subtext ?? '#888', marginTop: 2 }}>
            Blocked {dateLabel}
          </Text>
        </View>

        {/* Unblock button */}
        <Pressable
          onPress={() => handleUnblock(item)}
          hitSlop={8}
          style={({ pressed }) => [
            localStyles.unblockBtn,
            {
              backgroundColor: pressed ? '#fecaca' : '#fee2e2',
              borderColor: '#ef4444',
            },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>Unblock</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[localStyles.root, { backgroundColor: palette.bg ?? palette.surface ?? '#fff' }]}>
      {/* Header */}
      <View
        style={[
          localStyles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: palette.divider ?? '#eee',
            backgroundColor: palette.card ?? '#fff',
          },
        ]}
      >
        {onBack ? (
          <Pressable onPress={onBack} style={localStyles.backBtn} hitSlop={10}>
            <KISIcon name="arrow-left" size={22} color={palette.primary ?? '#333'} />
          </Pressable>
        ) : null}
        <Text style={[localStyles.title, { color: palette.text ?? '#000' }]}>
          Blocked contacts
        </Text>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <KISIcon name="shield" size={40} color={palette.subtext ?? '#888'} />
            <Text style={{ color: palette.subtext ?? '#888', marginTop: 12, fontSize: 15 }}>
              No blocked contacts
            </Text>
            <Text style={{ color: palette.subtext ?? '#aaa', marginTop: 4, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
              Block a contact from their profile to prevent them from messaging you.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});
