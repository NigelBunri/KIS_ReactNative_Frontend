import React from 'react';
import { ForwardChatSheet } from './componets/main/ForwardChatSheet';
import { PinnedMessagesSheet } from './componets/main/PinnedMessagesSheet';
import { SubRoomsSheet } from './componets/main/SubRoomsSheet';
import type { ChatMessage, SubRoom } from './chatTypes';

type Props = {
  palette: any;
  roomId: string;
  forwardSheetVisible: boolean;
  onCloseForward: () => void;
  onConfirmForward: (targetChatIds: string[]) => void;
  forwardTargets: any[];
  pinnedSheetVisible: boolean;
  onClosePinned: () => void;
  pinnedMessages: ChatMessage[];
  onJumpToMessage: (messageId: string) => void;
  subRoomsSheetVisible: boolean;
  onCloseSubRooms: () => void;
  subRooms: SubRoom[];
};

export default function ChatRoomSheets({
  palette,
  roomId,
  forwardSheetVisible,
  onCloseForward,
  onConfirmForward,
  forwardTargets,
  pinnedSheetVisible,
  onClosePinned,
  pinnedMessages,
  onJumpToMessage,
  subRoomsSheetVisible,
  onCloseSubRooms,
  subRooms,
}: Props) {
  return (
    <>
      <PinnedMessagesSheet
        visible={pinnedSheetVisible}
        onClose={onClosePinned}
        roomId={roomId}
        pinnedMessages={pinnedMessages}
        palette={palette}
        onJumpToMessage={onJumpToMessage}
      />

      <SubRoomsSheet
        visible={subRoomsSheetVisible}
        onClose={onCloseSubRooms}
        parentRoomId={roomId}
        subRooms={subRooms}
        palette={palette}
      />

      <ForwardChatSheet
        visible={forwardSheetVisible}
        onClose={onCloseForward}
        onConfirm={onConfirmForward}
        chats={forwardTargets}
        palette={palette}
      />
    </>
  );
}
