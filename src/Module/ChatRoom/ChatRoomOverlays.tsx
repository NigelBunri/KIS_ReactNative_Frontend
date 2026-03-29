import React from 'react';
import type { Chat } from './messagesUtils';
import ChatRoomMenu from './ChatRoomMenu';
import ChatRoomModals from './ChatRoomModals';

type SearchSnippet = {
  prefix: string;
  match: string;
  suffix: string;
};

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

export default function ChatRoomOverlays({
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
      <ChatRoomMenu
        palette={palette}
        chat={chat}
        menuVisible={menuVisible}
        onCloseMenu={onCloseMenu}
        dmRole={dmRole}
        requestStateEffective={requestStateEffective}
        isLocked={isLocked}
        isMuted={isMuted}
        conversationId={conversationId}
        onAcceptRequest={onAcceptRequest}
        onBlockChat={onBlockChat}
        onToggleMute={onToggleMute}
        onOpenSearch={onOpenSearch}
        onOpenAddMember={onOpenAddMember}
        onOpenRemoveMember={onOpenRemoveMember}
        onOpenSetRole={onOpenSetRole}
      />
      <ChatRoomModals
        palette={palette}
        groupAction={groupAction}
        groupUserIdInput={groupUserIdInput}
        groupRoleInput={groupRoleInput}
        onChangeGroupUserId={onChangeGroupUserId}
        onChangeGroupRole={onChangeGroupRole}
        onCloseGroupAction={onCloseGroupAction}
        onSubmitGroupAction={onSubmitGroupAction}
        searchVisible={searchVisible}
        searchQuery={searchQuery}
        onChangeSearchQuery={onChangeSearchQuery}
        onCloseSearch={onCloseSearch}
        onRunSearch={onRunSearch}
        searchResults={searchResults}
        searchHasMore={searchHasMore}
        searchLoading={searchLoading}
        onSelectSearchResult={onSelectSearchResult}
        buildSearchSnippet={buildSearchSnippet}
      />
    </>
  );
}
