import React from 'react';
import { TextCardComposer, TextCardPayload } from './componets/main/TextCardComposer';
import { StickerEditor } from './componets/main/FroSticker/StickerEditor';

type Props = {
  palette: any;
  textCardBg: string | null;
  onCloseTextCard: () => void;
  onSendTextCard: (payload: TextCardPayload) => void;
  openStickerEditor: boolean;
  onCloseStickerEditor: () => void;
  onSaveSticker: () => void;
};

export default function ChatRoomEditors({
  palette,
  textCardBg,
  onCloseTextCard,
  onSendTextCard,
  openStickerEditor,
  onCloseStickerEditor,
  onSaveSticker,
}: Props) {
  return (
    <>
      {textCardBg && (
        <TextCardComposer
          palette={palette}
          backgroundColor={textCardBg}
          onClose={onCloseTextCard}
          onSend={onSendTextCard}
        />
      )}

      {openStickerEditor && (
        <StickerEditor
          palette={palette}
          onClose={onCloseStickerEditor}
          onSaveSticker={onSaveSticker}
        />
      )}
    </>
  );
}
