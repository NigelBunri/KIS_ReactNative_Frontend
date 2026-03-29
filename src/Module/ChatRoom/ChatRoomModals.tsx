import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SearchSnippet = {
  prefix: string;
  match: string;
  suffix: string;
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
};

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
}: Props) {
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
                <Text style={{ color: palette.onPrimary ?? '#fff' }}>Confirm</Text>
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

            <Pressable
              onPress={() => onRunSearch(true)}
              style={[
                localStyles.modalButton,
                { backgroundColor: palette.primary, borderColor: palette.primary, alignSelf: 'flex-end' },
              ]}
            >
              <Text style={{ color: palette.onPrimary ?? '#fff' }}>Search</Text>
            </Pressable>

            <ScrollView style={{ marginTop: 12, maxHeight: 260 }}>
              {searchResults.map((item) => {
                const id = item?.id ?? item?._id;
                const text = item?.text ?? item?.previewText ?? '';
                const snippet = buildSearchSnippet(text, searchQuery);
                const at = item?.createdAt ?? '';
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
              {!searchResults.length && searchQuery.trim().length > 0 && (
                <Text style={{ color: palette.subtext, marginTop: 8 }}>
                  No results yet.
                </Text>
              )}
            </ScrollView>

            {searchHasMore && searchResults.length > 0 && (
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
