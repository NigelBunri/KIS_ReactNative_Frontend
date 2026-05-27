import React from 'react';
import { ForwardChatSheet } from './componets/main/ForwardChatSheet';
import { PinnedMessagesSheet } from './componets/main/PinnedMessagesSheet';
import { SubRoomsSheet } from './componets/main/SubRoomsSheet';
import { StarredMessagesSheet } from './componets/main/StarredMessagesSheet';
import { ReadReceiptsSheet } from './componets/main/ReadReceiptsSheet';
import { DisappearingTimerSheet, type DisappearDuration } from './componets/main/DisappearingTimerSheet';
import { WallpaperPickerSheet } from './componets/main/WallpaperPickerSheet';
import type { ChatMessage, SubRoom, ReadByEntry } from './chatTypes';

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
  onOpenSubRoom: (subRoom: SubRoom) => void;

  // Starred
  starredSheetVisible: boolean;
  onCloseStarred: () => void;

  // Read receipts
  readReceiptsSheetVisible: boolean;
  onCloseReadReceipts: () => void;
  readReceiptsData: ReadByEntry[];

  // Disappearing timer
  disappearingSheetVisible: boolean;
  onCloseDisappearing: () => void;
  disappearingCurrentValue: DisappearDuration;
  onSetDisappearing: (value: DisappearDuration) => void;

  // Wallpaper
  wallpaperSheetVisible: boolean;
  onCloseWallpaper: () => void;
  wallpaperCurrentId: string;
  onSelectWallpaper: (id: string) => void;
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
  onOpenSubRoom,
  starredSheetVisible,
  onCloseStarred,
  readReceiptsSheetVisible,
  onCloseReadReceipts,
  readReceiptsData,
  disappearingSheetVisible,
  onCloseDisappearing,
  disappearingCurrentValue,
  onSetDisappearing,
  wallpaperSheetVisible,
  onCloseWallpaper,
  wallpaperCurrentId,
  onSelectWallpaper,
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
        onOpenSubRoom={onOpenSubRoom}
      />

      <ForwardChatSheet
        visible={forwardSheetVisible}
        onClose={onCloseForward}
        onConfirm={onConfirmForward}
        chats={forwardTargets}
        palette={palette}
      />

      <StarredMessagesSheet
        visible={starredSheetVisible}
        onClose={onCloseStarred}
        onJumpToMessage={onJumpToMessage}
        palette={palette}
      />

      <ReadReceiptsSheet
        visible={readReceiptsSheetVisible}
        onClose={onCloseReadReceipts}
        readBy={readReceiptsData}
        palette={palette}
      />

      <DisappearingTimerSheet
        visible={disappearingSheetVisible}
        onClose={onCloseDisappearing}
        currentValue={disappearingCurrentValue}
        onSelect={onSetDisappearing}
        palette={palette}
      />

      <WallpaperPickerSheet
        visible={wallpaperSheetVisible}
        onClose={onCloseWallpaper}
        currentId={wallpaperCurrentId}
        onSelect={onSelectWallpaper}
        palette={palette}
      />
    </>
  );
}
