// src/screens/chat/components/FroCamer/MediaEditModal.tsx

import React, { useEffect, useState } from 'react';
import { Asset as ImagePickerAsset } from 'react-native-image-picker';
import { KISPalette } from '@/theme/constants';
import { VideoEditor } from './VideoEditor';
import { ImageEditor } from './ImageEditor';

export type MediaEditModalProps = {
  visible: boolean;
  /** All media (images + videos) to be edited in this batch */
  assets: ImagePickerAsset[];
  /** Index of the item to open first when visible */
  initialIndex?: number;
  palette: KISPalette;
  onClose: () => void;
  /**
   * Called when the user finishes editing and returns to camera capture.
   * Receives the full list of edited assets.
   */
  onDoneAll: (assets: ImagePickerAsset[]) => void;
};

export const MediaEditModal: React.FC<MediaEditModalProps> = ({
  visible,
  assets,
  initialIndex = 0,
  palette,
  onClose,
  onDoneAll,
}) => {
  const [editedAssets, setEditedAssets] = useState<ImagePickerAsset[]>([]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (!visible) return;

    const safeAssets = assets ?? [];
    setEditedAssets(safeAssets);

    const maxIndex = safeAssets.length - 1;
    const safeIndex =
      maxIndex < 0 ? 0 : Math.min(Math.max(initialIndex, 0), maxIndex);

    setCurrentIndex(safeIndex);
  }, [visible, assets, initialIndex]);

  // ❗ no hooks below this line

  if (!visible || !editedAssets.length) {
    return null;
  }

  const current = editedAssets[currentIndex];
  if (!current) {
    return null;
  }

  const isImage = !!current.type?.startsWith('image/');
  const isVideo = !!current.type?.startsWith('video/');

  const handleSaveAsset = (index: number, updated: ImagePickerAsset) => {
    setEditedAssets((prev) =>
      prev.map((a, i) => (i === index ? updated : a)),
    );
  };

  const handleGoPrev = () => {
    setCurrentIndex((prev) =>
      editedAssets.length <= 1
        ? 0
        : (prev - 1 + editedAssets.length) % editedAssets.length,
    );
  };

  const handleGoNext = () => {
    setCurrentIndex((prev) =>
      editedAssets.length <= 1
        ? 0
        : (prev + 1) % editedAssets.length,
    );
  };

  /**
   * Called by ImageEditor / VideoEditor when user taps "Save & Next".
   * Important: we must NOT call onDoneAll inside the setState updater,
   * otherwise React complains about updating a parent while rendering a child.
   */
  const handleDoneSingle = (index: number, updated: ImagePickerAsset) => {
    // Build the final edited assets array from the current snapshot
    const next = editedAssets.map((a, i) =>
      i === index ? updated : a,
    );

    // Update local state (not strictly necessary since we close,
    // but keeps things consistent if we change the UX later)
    setEditedAssets(next);

    // Now safely notify parent (CameraCaptureModal) and close
    onDoneAll(next);
    onClose();
  };

  if (isImage) {
    return (
      <ImageEditor
        visible={visible}
        asset={current}
        index={currentIndex}
        total={editedAssets.length}
        palette={palette}
        onClose={onClose}
        onSaveAsset={handleSaveAsset}
        onGoPrev={handleGoPrev}
        onGoNext={handleGoNext}
        // ImageEditor.onDoneAll: (index, updated) => void
        onDoneAll={handleDoneSingle}
      />
    );
  }

  if (isVideo) {
    return (
      <VideoEditor
        visible={visible}
        asset={current}
        index={currentIndex}
        total={editedAssets.length}
        palette={palette}
        onClose={onClose}
        onSaveAsset={handleSaveAsset}
        onGoPrev={handleGoPrev}
        onGoNext={handleGoNext}
        // VideoEditor.onDoneAll: (index, updated) => void
        onDoneAll={handleDoneSingle}
      />
    );
  }

  // Fallback: unsupported type
  return null;
};
