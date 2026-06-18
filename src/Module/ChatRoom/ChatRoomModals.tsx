import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';

type SearchSnippet = {
  prefix: string;
  match: string;
  suffix: string;
};

// GAP 5: search filter chip type
type SearchFilterChip = 'All' | 'Media' | 'Links' | 'Docs' | 'Polls';

/** Returns true if `item` matches the given filter chip. */
function matchesSearchFilter(item: any, chip: SearchFilterChip): boolean {
  if (chip === 'All') return true;
  const type: string = (item?.type ?? item?.messageType ?? item?.contentType ?? '').toLowerCase();
  const text: string = (item?.text ?? item?.previewText ?? item?.styledText?.text ?? '').toLowerCase();
  if (chip === 'Media') {
    return type === 'image' || type === 'video' || type === 'audio' || type === 'voice';
  }
  if (chip === 'Links') {
    if (type === 'link' || type === 'url') return true;
    return /https?:\/\/\S+/.test(text);
  }
  if (chip === 'Docs') {
    return type === 'file' || type === 'document' || type === 'doc' || type === 'pdf';
  }
  if (chip === 'Polls') {
    return type === 'poll';
  }
  return true;
}

type Participant = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type Props = {
  palette: any;
  groupAction: 'add' | 'remove' | 'role' | null;
  groupUserIdInput: string;
  groupRoleInput: string;
  onChangeGroupUserId: (value: string) => void;
  onChangeGroupRole: (value: string) => void;
  onCloseGroupAction: () => void;
  onSubmitGroupAction: () => void;
  searchVisible: boolean;
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  onCloseSearch: () => void;
  onRunSearch: (reset: boolean) => void;
  searchResults: any[];
  searchHasMore: boolean;
  searchLoading: boolean;
  onSelectSearchResult: (id: string) => void;
  buildSearchSnippet: (text: string, query: string) => SearchSnippet;
  // GAP 4: participants for sender filter
  participants?: Participant[];
};

const SEARCH_CHIPS: SearchFilterChip[] = ['All', 'Media', 'Links', 'Docs', 'Polls'];

export default function ChatRoomModals({
  palette,
  groupAction,
  groupUserIdInput,
  groupRoleInput,
  onChangeGroupUserId,
  onChangeGroupRole,
  onCloseGroupAction,
  onSubmitGroupAction,
  searchVisible,
  searchQuery,
  onChangeSearchQuery,
  onCloseSearch,
  onRunSearch,
  searchResults,
  searchHasMore,
  searchLoading,
  onSelectSearchResult,
  buildSearchSnippet,
  participants = [],
}: Props) {
  // GAP 5: active filter chip state
  const [searchFilterChip, setSearchFilterChip] = useState<SearchFilterChip>('All');
  // GAP 4: sender filter state
  const [searchSenderFilter, setSearchSenderFilter] = useState<string | null>(null);

  // Apply both type-chip filter and sender filter
  const filteredResults = searchResults.filter((item) => {
    if (!matchesSearchFilter(item, searchFilterChip)) return false;
    if (searchSenderFilter !== null) {
      const senderId = String(item?.senderId ?? item?.sender_id ?? item?.userId ?? '');
      if (senderId !== searchSenderFilter) return false;
    }
    return true;
  });

  // Sender name for active filter chip display
  const activeSenderName = searchSenderFilter
    ? (participants.find((p) => p.id === searchSenderFilter)?.name ?? searchSenderFilter)
    : null;

  return (
    <>
      <Modal
        transparent
        animationType="fade"
        visible={groupAction != null}
        onRequestClose={onCloseGroupAction}
      >
        <Pressable
          style={[localStyles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          onPress={onCloseGroupAction}
        >
          <View
            style={[
              localStyles.modalCard,
              { backgroundColor: palette.card ?? palette.surface },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[localStyles.modalTitle, { color: palette.text }]}>
              {groupAction === 'add'
                ? 'Add member'
                : groupAction === 'remove'
                ? 'Remove member'
                : 'Set member role'}
            </Text>

            <TextInput
              value={groupUserIdInput}
              onChangeText={onChangeGroupUserId}
              placeholder="User ID"
              placeholderTextColor={palette.subtext}
              style={[
                localStyles.modalInput,
                { color: palette.text, borderColor: palette.inputBorder },
              ]}
              autoCapitalize="none"
            />

            {groupAction !== 'remove' && (
              <TextInput
                value={groupRoleInput}
                onChangeText={onChangeGroupRole}
                placeholder="Role (member/admin/owner)"
                placeholderTextColor={palette.subtext}
                style={[
                  localStyles.modalInput,
                  { color: palette.text, borderColor: palette.inputBorder },
                ]}
                autoCapitalize="none"
              />
            )}

            <View style={localStyles.modalActions}>
              <Pressable
                onPress={onCloseGroupAction}
                style={[localStyles.modalButton, { borderColor: palette.inputBorder }]}
              >
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onSubmitGroupAction}
                style={[
                  localStyles.modalButton,
                  { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
              >
                <Text style={{ color: palette.onPrimary }}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={searchVisible}
        onRequestClose={onCloseSearch}
      >
        <Pressable
          style={[localStyles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          onPress={onCloseSearch}
        >
          <View
            style={[
              localStyles.modalCard,
              { backgroundColor: palette.card ?? palette.surface, width: '90%' },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[localStyles.modalTitle, { color: palette.text }]}>
              Search messages
            </Text>

            <TextInput
              value={searchQuery}
              onChangeText={onChangeSearchQuery}
              placeholder="Type keywords..."
              placeholderTextColor={palette.subtext}
              style={[
                localStyles.modalInput,
                { color: palette.text, borderColor: palette.inputBorder },
              ]}
              autoCapitalize="none"
            />

            {/* GAP 5: filter chip row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {SEARCH_CHIPS.map((chip) => {
                  const active = searchFilterChip === chip;
                  return (
                    <Pressable
                      key={chip}
                      onPress={() => setSearchFilterChip(chip)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: active ? (palette.primary) : (palette.inputBg ?? '#f0f0f0'),
                        borderWidth: active ? 0 : 1,
                        borderColor: palette.inputBorder,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? (palette.onPrimary) : (palette.text) }}>
                        {chip}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* GAP 4: From: sender filter row */}
            {participants.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  From:
                </Text>
                {/* Active sender chip */}
                {activeSenderName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 16,
                        backgroundColor: palette.primary,
                        gap: 6,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: palette.onPrimary }}>
                        From: {activeSenderName}
                      </Text>
                      <Pressable
                        onPress={() => setSearchSenderFilter(null)}
                        hitSlop={6}
                      >
                        <Text style={{ fontSize: 14, color: palette.onPrimary, fontWeight: '700' }}>
                          ×
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {participants.map((p) => {
                      const isSelected = searchSenderFilter === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSearchSenderFilter(isSelected ? null : p.id)}
                          style={{
                            alignItems: 'center',
                            gap: 4,
                            opacity: searchSenderFilter && !isSelected ? 0.5 : 1,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              borderWidth: isSelected ? 2.5 : 0,
                              borderColor: palette.primary,
                              overflow: 'hidden',
                              backgroundColor: palette.surfaceSoft ?? '#e0e0e0',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {p.avatarUrl ? (
                              <Image
                                source={{ uri: p.avatarUrl }}
                                style={{ width: 36, height: 36, borderRadius: 18 }}
                              />
                            ) : (
                              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>
                                {(p.name ?? '?').charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <Text
                            style={{
                              fontSize: 10,
                              color: isSelected ? (palette.primary) : (palette.subtext),
                              fontWeight: isSelected ? '700' : '400',
                              maxWidth: 44,
                            }}
                            numberOfLines={1}
                          >
                            {(p.name ?? '').split(' ')[0]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            <Pressable
              onPress={() => onRunSearch(true)}
              style={[
                localStyles.modalButton,
                { backgroundColor: palette.primary, borderColor: palette.primary, alignSelf: 'flex-end' },
              ]}
            >
              <Text style={{ color: palette.onPrimary }}>Search</Text>
            </Pressable>

            <ScrollView style={{ marginTop: 12, maxHeight: 260 }}>
              {filteredResults.map((item) => {
                const id = item?.id ?? item?._id;
                const text = item?.text ?? item?.previewText ?? '';
                const snippet = buildSearchSnippet(text, searchQuery);
                const at = item?.createdAt ?? '';
                const senderName = item?.senderName ?? item?.sender_name ?? '';
                return (
                  <Pressable
                    key={String(id)}
                    onPress={() => {
                      onCloseSearch();
                      if (id) onSelectSearchResult(String(id));
                    }}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: palette.inputBorder,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    {senderName ? (
                      <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                        {senderName}
                      </Text>
                    ) : null}
                    <Text numberOfLines={2} style={{ color: palette.text }}>
                      {snippet.prefix}
                      {snippet.match ? (
                        <Text style={{ color: palette.primary, fontWeight: '700' }}>
                          {snippet.match}
                        </Text>
                      ) : null}
                      {snippet.suffix || (!snippet.match ? (text || '[no text]') : '')}
                    </Text>
                    {at ? (
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>
                        {new Date(at).toLocaleString()}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {!filteredResults.length && searchQuery.trim().length > 0 && (
                <Text style={{ color: palette.subtext, marginTop: 8 }}>
                  {searchResults.length > 0 ? `No ${searchFilterChip.toLowerCase()} results.` : 'No results yet.'}
                </Text>
              )}
            </ScrollView>

            {searchHasMore && filteredResults.length > 0 && (
              <Pressable
                onPress={() => onRunSearch(false)}
                style={[
                  localStyles.modalButton,
                  { borderColor: palette.inputBorder, alignSelf: 'center' },
                ]}
              >
                <Text style={{ color: palette.text }}>
                  {searchLoading ? 'Loading...' : 'Load more'}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
