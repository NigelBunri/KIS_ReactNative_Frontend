import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';

export type SimpleContact = {
  id: string;
  name: string;
  phone: string;
};

type ContactsModalProps = {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;
  onSendContacts?: (contacts: SimpleContact[]) => void;
};

const CONTACTS_CACHE_KEY = 'kis.contacts.cache.v1';

export const ContactsModal: React.FC<ContactsModalProps> = ({
  visible,
  palette,
  onClose,
  onSendContacts,
}) => {
  const [contacts, setContacts] = useState<SimpleContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadContactsFromCache = async () => {
      if (!visible) return;
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
        if (!raw) {
          setContacts([]);
          setSelectedIds([]);
          return;
        }
        const parsed = JSON.parse(raw) as any[];
        const mapped: SimpleContact[] = (parsed || []).map((c) => ({
          id: c.id ?? c.phone ?? String(Math.random()),
          name: c.name ?? c.phone ?? 'Unknown',
          phone: c.phone ?? '',
        }));
        setContacts(mapped);
        setSelectedIds([]);
      } catch (e) {
        console.warn(
          '[ContactsModal] Failed to read contacts cache:',
          e,
        );
        setContacts([]);
        setSelectedIds([]);
      } finally {
        setLoading(false);
      }
    };

    loadContactsFromCache();
  }, [visible]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleShare = () => {
    const selected = contacts.filter((c) => selectedIds.includes(c.id));
    if (onSendContacts && selected.length) {
      onSendContacts(selected);
    }
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: palette.backdrop,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: palette.surfaceElevated,
            borderTopLeftRadius: kisRadius.xl,
            borderTopRightRadius: kisRadius.xl,
            padding: KIS_TOKENS.spacing.lg,
            maxHeight: '80%',
          }}
        >
          <Text
            style={{
              fontSize: KIS_TOKENS.typography.title,
              fontWeight: KIS_TOKENS.typography.weight.bold,
              color: palette.text,
              marginBottom: KIS_TOKENS.spacing.md,
            }}
          >
            Send contacts
          </Text>

          {loading ? (
            <View
              style={{
                paddingVertical: KIS_TOKENS.spacing.md,
                alignItems: 'center',
              }}
            >
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : contacts.length === 0 ? (
            <View
              style={{
                paddingVertical: KIS_TOKENS.spacing.md,
              }}
            >
              <Text
                style={{
                  color: palette.subtext,
                  fontSize: KIS_TOKENS.typography.body,
                }}
              >
                No contacts available. Open the contacts screen and refresh
                first.
              </Text>
            </View>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggleContact(item.id)}
                    style={{
                      paddingVertical: KIS_TOKENS.spacing.sm,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: palette.text,
                          fontSize: KIS_TOKENS.typography.body,
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: palette.subtext,
                          fontSize: KIS_TOKENS.typography.helper,
                        }}
                      >
                        {item.phone}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: selected
                          ? palette.primary
                          : palette.borderMuted,
                        backgroundColor: selected
                          ? palette.primary
                          : 'transparent',
                      }}
                    />
                  </Pressable>
                );
              }}
            />
          )}

          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginTop: KIS_TOKENS.spacing.lg,
              gap: KIS_TOKENS.spacing.sm,
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={{ color: palette.subtext }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              disabled={!selectedIds.length}
              style={{
                opacity: selectedIds.length ? 1 : 0.5,
              }}
            >
              <Text
                style={{ color: palette.primary, fontWeight: '700' }}
              >
                Share
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
