// src/screens/chat/AddContactsPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AppState,
  useWindowDimensions,
  TextInput,
  Linking,
  DeviceEventEmitter,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../../theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import { KIS_TOKENS } from '../../theme/constants';
import { useResponsiveLayout } from '../../theme/responsive';
import {
  KISContact,
  KISDeviceContact,
  ContactsPermissionStatus,
  CONTACTS_CACHE_KEY,
  markRegisteredOnBackend,
  refreshFromDeviceAndBackendWithOptions,
  getContactsPermissionStatus,
  requestContactsPermission,
  saveContactToDevice,
} from './contactsService';
import { EntryActionRow } from './components/EntryActionRow';
import { ContactRow } from './components/ContactRow';
import { AddContactForm } from './components/AddContactForm';
import { NewGroupForm } from './components/NewGroupForm';
import { NewCommunityForm } from './components/NewCommunityForm';
import { NewChannelForm } from './components/NewChannelForm';
import { addContactsStyles as styles } from './addContactsStyles';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import {
  fetchConversationsForCurrentUser,
  normalizeConversation,
} from '../ChatRoom/normalizeConversation';

export type AddContactsPageProps = {
  onClose: () => void;
  onOpenChat: (chat: Chat) => void;
  onSelectKISContact?: (contact: KISContact) => void | Promise<void>;
  initialMode?: Mode;
  initialGroupContext?: { communityId?: string | null; communityName?: string | null } | null;
};

const KIS_INVITE_LINK = 'https://kis.app';

const normalizePhone = (phone: string) => phone.replace(/[^0-9+]/g, '');

const withCacheContactIds = (list: KISContact[]): KISContact[] =>
  list.map((c) => {
    const normalized = normalizePhone(c.phone || '');
    const basePhone = normalized || c.phone || '';
    return { ...c, id: `newContact-${basePhone}` };
  });

const mergeContactsByPhone = (
  previous: KISContact[],
  next: KISContact[],
): KISContact[] => {
  const prevMap = new Map<string, KISContact>();
  previous.forEach((c) => prevMap.set(c.phone, c));
  return next.map((c) => {
    const prev = prevMap.get(c.phone);
    if (!prev) return c;
    return { ...c, isRegistered: c.isRegistered || prev.isRegistered };
  });
};

const buildInviteMessage = (contact: KISContact): string => {
  const firstName = contact.name?.split(' ')[0] ?? '';
  const greet = firstName ? `Hey ${firstName},` : 'Hey,';
  return (
    `${greet} I'm using KIS (Kingdom Impact Social), a new app for believers to connect, share prayer requests, join Bible-centered communities and chat in a distraction-free, faith-first space.\n\n` +
    `I'd love to stay in touch with you there. Download KIS and sign up with your phone number so we can chat: ${KIS_INVITE_LINK}`
  );
};

const sendSmsInvite = async (contact: KISContact) => {
  try {
    const message = buildInviteMessage(contact);
    const phone = contact.phone.replace(/[^0-9+]/g, '');
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Cannot open Messages', 'Your device could not open the SMS app.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Error', 'Could not open SMS app.');
  }
};

const sendWhatsAppInvite = async (contact: KISContact) => {
  try {
    const message = buildInviteMessage(contact);
    const phone = contact.phone.replace(/[^0-9+]/g, '');
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('WhatsApp not available', 'WhatsApp does not seem to be installed on this device.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Error', 'Could not open WhatsApp.');
  }
};

type Mode =
  | 'list'
  | 'addContact'
  | 'addGroup'
  | 'addCommunity'
  | 'addChannel'
  | 'selectGroupMembers'
  | 'selectCommunityMembers';

// Contact row height: paddingVertical 8×2 + content ~40 + marginBottom 6 = 62px
const CONTACT_ROW_HEIGHT = 62;
const SECTION_HEADER_HEIGHT = 40;

type ContactListItem =
  | { _t: 'section'; title: string }
  | { _t: 'contact'; c: KISContact; isKIS: boolean };

const findExistingDirectConversationForContact = async (
  contact: KISContact,
): Promise<any | null> => {
  try {
    const existingRaw = await fetchConversationsForCurrentUser([], undefined, true);
    if (!Array.isArray(existingRaw)) return null;

    const contactPhoneNorm = normalizePhone(contact.phone || '');
    if (!contactPhoneNorm) return null;

    return existingRaw.find((conv: any) => {
      const isDirect =
        conv?.kind === 'direct' || conv?.type === 'direct' || conv?.type === 'dm';
      if (!isDirect || !Array.isArray(conv.participants)) return false;
      return conv.participants.some((p: any) => {
        const raw = p?.user?.phone ?? p?.user_phone ?? p?.phone ?? (typeof p === 'string' ? p : undefined);
        if (!raw) return false;
        return normalizePhone(String(raw)) === contactPhoneNorm;
      });
    }) ?? null;
  } catch {
    return null;
  }
};

export const AddContactsPage: React.FC<AddContactsPageProps> = ({
  onClose,
  onOpenChat,
  onSelectKISContact,
  initialMode,
  initialGroupContext,
}) => {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const pagePadding = responsive.pageGutter;

  const [contacts, setContacts] = useState<KISContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<ContactsPermissionStatus | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<Set<string>>(new Set());
  const [selectedCommunityMemberIds, setSelectedCommunityMemberIds] = useState<Set<string>>(new Set());
  const [preferredChannelId, setPreferredChannelId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState({
    name: '',
    slug: '',
    description: '',
    channelId: null as string | null,
  });
  const [communityDraft, setCommunityDraft] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [groupContext, setGroupContext] = useState<{ communityId?: string | null; communityName?: string | null } | null>(
    initialGroupContext ?? null,
  );

  const [mode, setMode] = useState<Mode>('list');
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!initialMode) return;
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!initialGroupContext) return;
    setGroupContext(initialGroupContext);
  }, [initialGroupContext]);

  useEffect(() => {
    if (!preferredChannelId) return;
    setGroupDraft((prev) => ({ ...prev, channelId: preferredChannelId }));
  }, [preferredChannelId]);

  useEffect(() => {
    Animated.timing(slideX, {
      toValue: mode === 'list' ? 0 : -SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [mode, SCREEN_WIDTH, slideX]);

  const checkPermission = useCallback(async () => {
    const status = await getContactsPermissionStatus();
    setPermissionStatus(status);
    return status;
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  const loadContactsRef = useRef<() => Promise<void>>(async () => {});

  const handleRequestPermission = useCallback(async () => {
    const status = await requestContactsPermission();
    setPermissionStatus(status);
    if (status === 'granted') {
      loadContactsRef.current();
    } else if (status === 'never_ask_again' || (Platform.OS === 'ios' && status === 'denied')) {
      Linking.openSettings();
    }
  }, []);

  // ─── Two-phase load: show cache immediately, refresh silently in background ──

  const loadContacts = useCallback(async () => {
    setError(null);

    // Phase 1 — serve cached contacts immediately so the screen renders at once
    let hasCached = false;
    try {
      const raw = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
      if (raw) {
        const parsed = withCacheContactIds(JSON.parse(raw) as KISContact[]);
        setContacts(parsed);
        setLoading(false);
        hasCached = true;
      }
    } catch {}

    if (!hasCached) setLoading(true);

    // Phase 2 — refresh from device + bulk backend check in background
    // Uses cache if still fresh (< 10 min), single bulk POST otherwise
    try {
      const fresh = await refreshFromDeviceAndBackendWithOptions({ force: false });
      setContacts(withCacheContactIds(fresh));
    } catch (e) {
      if (!hasCached) {
        setError('Could not load contacts. Pull down to retry.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContactsRef.current = loadContacts;
  }, [loadContacts]);

  const onRefresh = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const fresh = await refreshFromDeviceAndBackendWithOptions({ force: true });
      setContacts(withCacheContactIds(fresh));
    } catch {
      setError('Could not refresh contacts.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (permissionStatus === 'granted') {
      loadContacts();
    } else if (permissionStatus !== null) {
      setLoading(false);
    }
  }, [permissionStatus, loadContacts]);

  const onOpenAddContact = () => setMode('addContact');
  const onOpenAddGroup = () => setMode('addGroup');
  const onOpenAddCommunity = () => setMode('addCommunity');
  const onOpenAddChannel = () => setMode('addChannel');
  const onOpenSelectGroupMembers = () => setMode('selectGroupMembers');
  const onOpenSelectCommunityMembers = () => setMode('selectCommunityMembers');

  const onCloseDetailPage = () => {
    if (mode === 'selectGroupMembers') { setMode('addGroup'); return; }
    if (mode === 'selectCommunityMembers') { setMode('addCommunity'); return; }
    setMode('list');
  };

  const handleContactAddedFromApp = async (payload: {
    name: string;
    phone: string;
    countryCode: string;
  }) => {
    try {
      // Save to native device contacts — non-fatal if permission denied or device API fails.
      try {
        await saveContactToDevice(payload);
      } catch (e) {
        console.warn('[AddContacts] Could not save to device contacts:', e);
      }

      const newDeviceContact: KISDeviceContact = {
        id: Date.now().toString(),
        name: payload.name.trim(),
        phone: payload.phone,
      };
      const [marked] = await markRegisteredOnBackend([newDeviceContact]);
      const finalList = [marked, ...contacts];
      const phonesSeen = new Set<string>();
      const deduped: KISContact[] = [];
      for (const c of finalList) {
        if (phonesSeen.has(c.phone)) continue;
        phonesSeen.add(c.phone);
        deduped.push(c);
      }
      const normalized = withCacheContactIds(deduped);
      setContacts(normalized);
      await AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(normalized));
      setMode('list');
    } catch {
      Alert.alert('Error', 'Could not save the contact. Please try again.');
    }
  };

  const handleGroupCreated = async (group: any) => {
    try {
      const conversationId =
        group?.conversation_id ?? group?.conversationId ?? group?.conversation?.id ?? group?.conversation;
      if (!conversationId) {
        throw new Error('Django did not return a backing chat conversation.');
      }
      const baseChat = normalizeConversation(group?.conversation ?? group);
      const chat: Chat = {
        ...baseChat,
        id: String(conversationId),
        conversationId: String(conversationId),
        isGroup: true,
        isGroupChat: true,
        kind: baseChat.kind ?? 'group',
        groupId: group?.id ?? baseChat.groupId,
      } as Chat;
      setSelectedGroupMemberIds(new Set());
      setGroupDraft({ name: '', slug: '', description: '', channelId: null });
      onClose();
      DeviceEventEmitter.emit('conversation.refresh');
      if (group?.partner) DeviceEventEmitter.emit('partner.data.refresh');
      setTimeout(() => onOpenChat(chat), 150);
    } catch (caughtError: any) {
      Alert.alert(
        'Group chat unavailable',
        caughtError?.message || 'Group was created, but Django did not create its chat conversation.',
      );
    }
  };

  const handleCommunityCreated = async (community: any) => {
    try {
      const conversationId =
        community?.main_conversation_id ?? community?.mainConversationId ??
        community?.conversation_id ?? community?.conversationId ??
        community?.conversation?.id ?? community?.conversation;
      if (!conversationId) {
        throw new Error('Django did not return a backing community conversation.');
      }
      const baseChat = normalizeConversation(community?.conversation ?? community);
      const chat: Chat = {
        ...baseChat,
        id: String(conversationId),
        conversationId: String(conversationId),
        isGroup: false,
        isGroupChat: false,
        isCommunityChat: true,
        kind: baseChat.kind ?? 'community',
        communityId: community?.id ?? baseChat.communityId,
      } as Chat;
      setSelectedCommunityMemberIds(new Set());
      setCommunityDraft({ name: '', slug: '', description: '' });
      onClose();
      DeviceEventEmitter.emit('conversation.refresh');
      DeviceEventEmitter.emit('community.refresh');
      if (community?.partner) DeviceEventEmitter.emit('partner.data.refresh');
      setTimeout(() => onOpenChat(chat), 150);
    } catch (caughtError: any) {
      Alert.alert(
        'Community chat unavailable',
        caughtError?.message || 'Community was created without its chat conversation.',
      );
    }
  };

  const handleChannelCreated = (channel: any) => {
    const channelId = channel?.id ? String(channel.id) : null;
    if (channelId) setPreferredChannelId(channelId);
    DeviceEventEmitter.emit('conversation.refresh');
    if (channel?.partner) DeviceEventEmitter.emit('partner.data.refresh');
    setMode('addGroup');
  };

  const kisContactsForSelection = useMemo(
    () => contacts.filter((c) => c.isRegistered && c.userId),
    [contacts],
  );

  const toggleGroupMember = (contact: KISContact) => {
    if (!contact.userId) return;
    const id = String(contact.userId);
    setSelectedGroupMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCommunityMember = (contact: KISContact) => {
    if (!contact.userId) return;
    const id = String(contact.userId);
    setSelectedCommunityMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearchTerm(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(text), 150);
  }, []);

  const filteredContacts = useMemo(() => {
    if (!debouncedSearch.trim()) return contacts;
    const q = debouncedSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      const name = c.name?.toLowerCase() ?? '';
      const phone = c.phone?.toLowerCase() ?? '';
      return name.includes(q) || phone.includes(q);
    });
  }, [contacts, debouncedSearch]);

  const kisContacts = useMemo(() => filteredContacts.filter((c) => c.isRegistered), [filteredContacts]);
  const inviteContacts = useMemo(() => filteredContacts.filter((c) => !c.isRegistered), [filteredContacts]);

  const hasSearch = searchTerm.trim().length > 0;
  const noSearchResults = hasSearch && kisContacts.length === 0 && inviteContacts.length === 0;

  // Build virtualized list data: section headers + contacts interleaved
  const listData = useMemo<ContactListItem[]>(() => {
    const items: ContactListItem[] = [];
    if (kisContacts.length > 0) {
      items.push({ _t: 'section', title: 'On KIS' });
      for (const c of kisContacts) items.push({ _t: 'contact', c, isKIS: true });
    }
    if (inviteContacts.length > 0) {
      items.push({ _t: 'section', title: 'Invite to KIS' });
      for (const c of inviteContacts) items.push({ _t: 'contact', c, isKIS: false });
    }
    return items;
  }, [kisContacts, inviteContacts]);

  const handleKISContactPress = useCallback(
    async (c: KISContact) => {
      if (onSelectKISContact) {
        await onSelectKISContact(c);
        onClose();
        return;
      }
      try {
        const existingConv = await findExistingDirectConversationForContact(c);
        let finalChat: Chat;
        if (existingConv) {
          const baseChat = normalizeConversation(existingConv);
          finalChat = {
            ...baseChat,
            name: c.name || baseChat.name,
            title: c.name || (baseChat as any).title || baseChat.name || 'Direct chat',
            contactPhone: c.phone,
            isDirect: true,
            isContactChat: true,
            isGroup: false,
            isGroupChat: false,
            isCommunityChat: false,
          } as Chat;
        } else {
          const normalizedPhone = normalizePhone(c.phone);
          finalChat = {
            id: `newContact-${normalizedPhone}`,
            title: c.name,
            name: c.name,
            contactPhone: c.phone,
            // Pass the peer's KIS user ID whenever we have it — the backend
            // then uses an exact UUID lookup instead of a phone-format lookup,
            // and presence tracking works correctly in the chat room.
            contactUserId: c.userId ?? null,
            peerUserId: c.userId ?? null,
            participants: c.userId ? [c.userId] : [c.phone],
            kind: 'direct',
            isDirect: true,
            isContactChat: true,
            isGroup: false,
            isGroupChat: false,
            isCommunityChat: false,
            requestState: 'none',
          } as Chat;
        }
        onClose();
        setTimeout(() => onOpenChat(finalChat), 150);
      } catch {
        Alert.alert('Error', 'Could not open chat with this contact. Please try again.');
      }
    },
    [onClose, onOpenChat, onSelectKISContact],
  );

  const handleInviteContactPress = (c: KISContact) => {
    Alert.alert(
      'Invite to KIS',
      `${c.name} is not yet on KIS. How would you like to invite them?`,
      [
        { text: 'SMS invite', onPress: () => sendSmsInvite(c) },
        { text: 'WhatsApp invite', onPress: () => sendWhatsAppInvite(c) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  // ─── FlatList renderer ────────────────────────────────────────────────────────

  const renderListItem = useCallback(
    ({ item }: { item: ContactListItem }) => {
      if (item._t === 'section') {
        return (
          <Text style={[styles.sectionTitle, { color: palette.subtext, marginTop: 24 }]}>
            {item.title}
          </Text>
        );
      }
      return (
        <ContactRow
          contact={item.c}
          palette={palette}
          onPress={() =>
            item.isKIS ? handleKISContactPress(item.c) : handleInviteContactPress(item.c)
          }
          showInvite={!item.isKIS}
        />
      );
    },
    [palette, handleKISContactPress],
  );

  // Precompute cumulative offsets once when listData changes — O(n) instead of O(n²)
  const itemOffsets = useMemo(() => {
    const offsets = new Array<number>(listData.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < listData.length; i++) {
      const h = listData[i]._t === 'section' ? SECTION_HEADER_HEIGHT : CONTACT_ROW_HEIGHT;
      offsets[i + 1] = (offsets[i] ?? 0) + h;
    }
    return offsets;
  }, [listData]);

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const item = listData[index];
      const length = item?._t === 'section' ? SECTION_HEADER_HEIGHT : CONTACT_ROW_HEIGHT;
      return { length, offset: itemOffsets[index] ?? 0, index };
    },
    [listData, itemOffsets],
  );

  const keyExtractor = useCallback((item: ContactListItem) => {
    if (item._t === 'section') return `section-${item.title}`;
    return item.c.id;
  }, []);

  // ─── List header: quick actions + search + states ─────────────────────────────

  const ListHeaderComponent = useMemo(
    () => (
      <View style={{ paddingHorizontal: pagePadding, paddingTop: responsive.isWatch ? 10 : 16 }}>
        <EntryActionRow
          icon="people"
          title="New group"
          subtitle="Create a group with your contacts"
          palette={palette}
          onPress={onOpenAddGroup}
        />
        <EntryActionRow
          icon="megaphone"
          title="New community"
          subtitle="Start a community for your audience"
          palette={palette}
          onPress={onOpenAddCommunity}
        />
        <EntryActionRow
          icon="add"
          title="New contact"
          subtitle="Add a new contact to your phone"
          palette={palette}
          onPress={onOpenAddContact}
        />

        {/* Search bar */}
        <View
          style={{
            marginTop: responsive.isWatch ? 10 : 16,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <KISIcon name="search" size={16} color={palette.subtext} />
          <TextInput
            value={searchTerm}
            onChangeText={handleSearchChange}
            placeholder="Search contacts by name or number"
            placeholderTextColor={palette.subtext}
            style={{
              flex: 1,
              marginLeft: 6,
              paddingVertical: 4,
              color: palette.text,
              fontSize: responsive.bodyFontSize,
            }}
          />
          {hasSearch && (
            <Pressable
              onPress={() => setSearchTerm('')}
              style={({ pressed }) => ({ padding: 4, opacity: pressed ? KIS_TOKENS.opacity.pressed : 1 })}
            >
              <KISIcon name="close" size={14} color={palette.subtext} />
            </Pressable>
          )}
        </View>

        {/* Permission prompt */}
        {permissionStatus !== null && permissionStatus !== 'granted' && (
          <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 16 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: (palette.primary) + '18',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KISIcon name="contacts" size={36} color={palette.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text, textAlign: 'center' }}>
              Allow access to contacts
            </Text>
            <Text style={{ fontSize: 14, color: palette.subtext, textAlign: 'center', lineHeight: 20 }}>
              KIS needs access to your contacts so you can see which of your friends are already on
              the app and start chatting with them.
            </Text>
            <Pressable
              onPress={handleRequestPermission}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingHorizontal: 28,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: pressed
                  ? palette.primaryStrong
                  : (palette.primary),
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {permissionStatus === 'never_ask_again' ||
                (Platform.OS === 'ios' && permissionStatus === 'denied')
                  ? 'Open Settings'
                  : 'Allow Access'}
              </Text>
            </Pressable>
            {(permissionStatus === 'never_ask_again' ||
              (Platform.OS === 'ios' && permissionStatus === 'denied')) && (
              <Text style={{ fontSize: 12, color: palette.subtext, textAlign: 'center' }}>
                Enable Contacts in Settings, then come back here.
              </Text>
            )}
          </View>
        )}

        {/* Error */}
        {permissionStatus === 'granted' && error && (
          <Text style={[styles.errorText, { color: palette.danger, marginTop: 8 }]}>
            {error}
          </Text>
        )}

        {/* Loading skeletons — only when we have no cached data yet */}
        {permissionStatus === 'granted' && loading && contacts.length === 0 && (
          <View style={{ marginTop: 12, gap: 10 }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <View
                key={`contact-skel-${idx}`}
                style={[styles.contactRow, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
              >
                <Skeleton width={44} height={44} radius={22} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="55%" height={12} radius={6} />
                  <Skeleton width="35%" height={10} radius={6} style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No search results */}
        {permissionStatus === 'granted' && noSearchResults && !loading && !error && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: palette.subtext, fontSize: 13 }}>
              No contacts match "{searchTerm.trim()}".
            </Text>
          </View>
        )}

        {/* No contacts at all */}
        {permissionStatus === 'granted' &&
          !loading &&
          contacts.length === 0 &&
          !error &&
          !hasSearch && (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                No contacts yet. Pull down to refresh or add a new contact.
              </Text>
            </View>
          )}
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pagePadding, responsive, palette, searchTerm, hasSearch, permissionStatus,
      error, loading, contacts.length, noSearchResults, handleRequestPermission,
    ],
  );

  const headerTitle =
    mode === 'list' ? 'Select contact'
    : mode === 'addContact' ? 'New contact'
    : mode === 'addGroup' ? 'New group'
    : mode === 'addCommunity' ? 'New community'
    : mode === 'addChannel' ? 'New channel'
    : 'Select members';

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
        <Pressable
          onPress={mode === 'list' ? onClose : onCloseDetailPage}
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1 }]}
        >
          <KISIcon name={mode === 'list' ? 'close' : 'arrow-left'} size={20} color={palette.text} />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: palette.text, fontSize: responsive.isWatch ? 15 : 18 }]}
          numberOfLines={1}
        >
          {headerTitle}
        </Text>
      </View>

      {/* Pages container (slide animation) */}
      <Animated.View
        style={{
          flex: 1,
          flexDirection: 'row',
          width: SCREEN_WIDTH * 2,
          transform: [{ translateX: slideX }],
        }}
      >
        {/* Page 1: contact list */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderListItem}
            getItemLayout={getItemLayout}
            ListHeaderComponent={ListHeaderComponent}
            contentContainerStyle={{ paddingBottom: responsive.isWatch ? 20 : 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={palette.primary}
              />
            }
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={30}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Page 2: forms (add contact / group / community / channel / member select) */}
        <View style={{ width: SCREEN_WIDTH, flex: 1, backgroundColor: palette.bg, }}>
          {/* Member selection: full FlatList to virtualize potentially large contact lists */}
          {(mode === 'selectGroupMembers' || mode === 'selectCommunityMembers') ? (
            <MemberSelectionList
              contacts={kisContactsForSelection}
              selectedIds={mode === 'selectGroupMembers' ? selectedGroupMemberIds : selectedCommunityMemberIds}
              onToggle={mode === 'selectGroupMembers' ? toggleGroupMember : toggleCommunityMember}
              onDone={() => setMode(mode === 'selectGroupMembers' ? 'addGroup' : 'addCommunity')}
              palette={palette}
              pagePadding={pagePadding}
            />
          ) : (
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: palette.bg, }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              style={[styles.body, { paddingHorizontal: pagePadding, paddingTop: responsive.isWatch ? 10 : 16, backgroundColor: palette.bg, }]}
              contentContainerStyle={{ paddingBottom: responsive.isWatch ? 20 : 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {mode === 'addGroup' ? (
                <NewGroupForm
                  palette={palette}
                  onSuccess={handleGroupCreated}
                  selectedMemberIds={Array.from(selectedGroupMemberIds)}
                  onSelectMembers={onOpenSelectGroupMembers}
                  communityId={groupContext?.communityId ?? null}
                  communityName={groupContext?.communityName ?? null}
                  initialChannelId={preferredChannelId}
                  onCreateChannel={onOpenAddChannel}
                  name={groupDraft.name}
                  slug={groupDraft.slug}
                  description={groupDraft.description}
                  selectedChannelId={groupDraft.channelId}
                  onChangeName={(value) => setGroupDraft((prev) => ({ ...prev, name: value }))}
                  onChangeSlug={(value) => setGroupDraft((prev) => ({ ...prev, slug: value }))}
                  onChangeDescription={(value) => setGroupDraft((prev) => ({ ...prev, description: value }))}
                  onChangeChannelId={(value) => setGroupDraft((prev) => ({ ...prev, channelId: value }))}
                />
              ) : mode === 'addCommunity' ? (
                <NewCommunityForm
                  palette={palette}
                  onSuccess={handleCommunityCreated}
                  selectedMemberIds={Array.from(selectedCommunityMemberIds)}
                  onSelectMembers={onOpenSelectCommunityMembers}
                  name={communityDraft.name}
                  slug={communityDraft.slug}
                  description={communityDraft.description}
                  onChangeName={(value) => setCommunityDraft((prev) => ({ ...prev, name: value }))}
                  onChangeSlug={(value) => setCommunityDraft((prev) => ({ ...prev, slug: value }))}
                  onChangeDescription={(value) => setCommunityDraft((prev) => ({ ...prev, description: value }))}
                />
              ) : mode === 'addChannel' ? (
                <NewChannelForm palette={palette} onSuccess={handleChannelCreated} />
              ) : (
                <AddContactForm palette={palette} onSubmit={handleContactAddedFromApp} />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Virtualized member selection ────────────────────────────────────────────

type MemberSelectionListProps = {
  contacts: KISContact[];
  selectedIds: Set<string>;
  onToggle: (c: KISContact) => void;
  onDone: () => void;
  palette: any;
  pagePadding: number;
};

const MEMBER_ROW_HEIGHT = 68;

function MemberSelectionList({
  contacts,
  selectedIds,
  onToggle,
  onDone,
  palette,
  pagePadding,
}: MemberSelectionListProps) {
  const renderMember = useCallback(
    ({ item: c }: { item: KISContact }) => {
      const userId = c.userId ? String(c.userId) : '';
      const selected = !!(userId && selectedIds.has(userId));
      return (
        <Pressable
          onPress={() => onToggle(c)}
          style={({ pressed }) => [
            styles.contactRow,
            {
              marginHorizontal: pagePadding,
              backgroundColor: selected ? palette.surface : palette.card,
              borderColor: palette.inputBorder,
              opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
            },
          ]}
        >
          <ImagePlaceholder size={44} radius={22} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 15 }}>{c.name}</Text>
            <Text style={{ color: palette.subtext, fontSize: 13 }} numberOfLines={1}>
              {c.phone}
            </Text>
          </View>
          {selected && <KISIcon name="check" size={16} color={palette.primary} />}
        </Pressable>
      );
    },
    [selectedIds, onToggle, palette, pagePadding],
  );

  const keyExtractor = useCallback((c: KISContact) => c.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: MEMBER_ROW_HEIGHT, offset: MEMBER_ROW_HEIGHT * index, index }),
    [],
  );

  const ListHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: pagePadding, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: '600' }}>
          Choose members from KIS contacts
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
          Only contacts registered on KIS are shown here.
        </Text>
        {contacts.length === 0 && (
          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 16 }}>
            No KIS contacts found yet.
          </Text>
        )}
      </View>
    ),
    [palette, pagePadding, contacts.length],
  );

  const ListFooter = useMemo(
    () => (
      <Pressable
        onPress={onDone}
        style={({ pressed }) => [
          styles.saveButton,
          { marginHorizontal: pagePadding, backgroundColor: palette.primary, opacity: pressed ? KIS_TOKENS.opacity.pressed : 1 },
        ]}
      >
        <Text style={[styles.saveButtonText, { color: palette.bg }]}>
          Done{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </Text>
      </Pressable>
    ),
    [onDone, palette, pagePadding, selectedIds.size],
  );

  return (
    <FlatList
      data={contacts}
      keyExtractor={keyExtractor}
      renderItem={renderMember}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      getItemLayout={getItemLayout}
      initialNumToRender={20}
      maxToRenderPerBatch={30}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    />
  );
}

export default AddContactsPage;
