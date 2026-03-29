// src/screens/chat/components/CameraCaptureModal.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';

import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImageLibraryOptions,
  Asset as ImagePickerAsset,
} from 'react-native-image-picker';

import { KISIcon } from '@/constants/kisIcons';
import {
  KISPalette,
  KIS_TOKENS,
  kisRadius,
} from '@/theme/constants';

import type { FilesType } from './AttachmentSheet';
import { MediaEditModal } from './FroCamer/MediaEditModal';

type CameraCaptureModalProps = {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;
  onCapture?: (payload: { caption: string; files: FilesType[] }) => void;
};

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  visible,
  palette,
  onClose,
  onCapture,
}) => {

  /** ORIGINAL ASSETS — ALWAYS UNTOUCHED */
  const [assets, setAssets] = useState<ImagePickerAsset[]>([]);

  /** EDITED RESULTS — USED ONLY FOR PREVIEW/SENDING */
  const [editedAssets, setEditedAssets] = useState<ImagePickerAsset[] | null>(null);

  const [selectedAssetIndex, setSelectedAssetIndex] = useState<number | null>(null);
  const [_galleryAssets, setGalleryAssets] = useState<ImagePickerAsset[]>([]);
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState("");

  /** RESET ONLY VIEW-STATE WHEN OPENING — KEEP ORIGINAL FILES  */
  useEffect(() => {
    if (visible) {
      setSelectedAssetIndex(null);
      setEditingIndex(null);
      setCaption("");
      setEditedAssets(null); // 🟢 Reset edited previews each time
    }
  }, [visible]);

  /** Helper to update assets after new camera/gallery selection */
  const setNewAssetsAndSelectFirst = (newAssets: ImagePickerAsset[]) => {
    setAssets(newAssets);
    setEditedAssets(null); // always reset any previous edits
    setSelectedAssetIndex(newAssets.length ? 0 : null);
  };

  const openSystemCamera = useCallback(
    async (mediaType: 'photo' | 'video') => {
      try {
        const options: CameraOptions = {
          mediaType,
          cameraType,
          saveToPhotos: true,
        };

        const result = await launchCamera(options);
        if (result.didCancel) return;
        if (result.errorCode) {
          Alert.alert("Camera error", result.errorMessage);
          return;
        }

        const newAssets = result.assets ?? [];
        if (!newAssets.length) return;

        setNewAssetsAndSelectFirst(newAssets);

      } catch {
        Alert.alert("Camera Error", "Could not open camera.");
      }
    },
    [cameraType],
  );

  const openGallery = useCallback(async () => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'mixed',
        selectionLimit: 0,
      };

      const result = await launchImageLibrary(options);
      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert("Gallery error", result.errorMessage);
        return;
      }

      const libAssets = result.assets ?? [];
      if (!libAssets.length) return;

      setGalleryAssets(libAssets);
      setNewAssetsAndSelectFirst(libAssets);

    } catch {
      Alert.alert("Gallery Error", "Could not open gallery.");
    }
  }, []);

  /** Remove original AND any edited versions */
  const removeAsset = (uri: string) => {
    setAssets(prev => prev.filter(a => a.uri !== uri));
    setEditedAssets(prev => prev ? prev.filter(a => a.uri !== uri) : null);

    setSelectedAssetIndex(prev => {
      if (prev === null) return null;
      const base = editedAssets ?? assets;
      const remaining = base.filter(a => a.uri !== uri);
      if (!remaining.length) return null;
      return Math.min(prev, remaining.length - 1);
    });
  };

  /** SEND — uses edited versions if present */
  const handleSend = () => {
    const base = editedAssets ?? assets;

    if (base.length === 0 && caption.trim() === "") {
      onClose();
      return;
    }

    const files: FilesType[] = base.map(a => ({
      uri: a.uri || '',
      name: a.fileName ?? (a.type?.startsWith("video") ? "video.mp4" : "image.jpg"),
      type: a.type ?? 'image/jpeg',
      size: a.fileSize,
      durationMs: typeof a.duration === 'number' ? Math.round(a.duration * 1000) : undefined,
    }));

    onCapture?.({ caption: caption, files });
    onClose();
  };

  /** What we show in UI — editedAssets take priority */
  const previewSource = editedAssets ?? assets;

  const previewAsset =
    selectedAssetIndex != null && previewSource[selectedAssetIndex]
      ? previewSource[selectedAssetIndex]
      : undefined;

  const isImage = previewAsset?.type?.startsWith("image/");
  const isVideo = previewAsset?.type?.startsWith("video/");

  /** Thumbnails also show edited versions */
  const stripAssets = previewSource.slice(0, 5);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: palette.bg, marginTop: 50 }]}>


        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
          <Pressable onPress={onClose} style={styles.headerIconButton}>
            <KISIcon name="close" size={22} color={palette.subtext} />
          </Pressable>

          <Text style={styles.headerTitle}>Camera</Text>

          <Pressable onPress={() => setIsFlashOn(f => !f)} style={styles.headerIconButton}>
            <KISIcon name={isFlashOn ? "flash-on" : "flash-off"} size={22} color={isFlashOn ? palette.primary : palette.subtext} />
          </Pressable>
        </View>


        {/* PREVIEW */}
        <View style={styles.content}>
          {previewAsset ? (
            <>
              {isImage ? (
                <Image source={{ uri: previewAsset.uri }} style={styles.previewImage} resizeMode="cover" />
              ) : isVideo ? (
                <View style={styles.videoPlaceholder}>
                  <KISIcon name="video" size={40} color={palette.subtext} />
                  <Text style={styles.videoLabel}>Video selected</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.emptyState, { borderColor: palette.divider }]}>
              <Image
                source={require('@/assets/demo-camera-placeholder.png')}
                style={styles.previewImage}
              />
            </View>
          )}
        </View>


        {/* THUMB STRIP */}
        <View style={[styles.galleryStrip, { borderTopColor: palette.divider, backgroundColor: palette.card }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>

            {stripAssets.map((asset, idx) => {
              const selected = previewAsset?.uri === asset.uri;
              const isThumbImage = asset.type?.startsWith("image/");

              return (
                <View
                  key={asset.uri ?? idx}
                  style={[
                    styles.galleryItem,
                    { borderColor: selected ? palette.primary : palette.border, borderWidth: selected ? 2 : 1 },
                  ]}
                >
                  {/* Select preview */}
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => {
                      const base = previewSource;
                      const indexInBase = base.findIndex(a => a.uri === asset.uri);
                      if (indexInBase >= 0) setSelectedAssetIndex(indexInBase);
                    }}
                  >
                    {isThumbImage ? (
                      <Image source={{ uri: asset.uri }} style={styles.galleryThumb} />
                    ) : (
                      <View style={styles.galleryThumbCenter}>
                        <KISIcon name="video" size={18} color={palette.subtext} />
                      </View>
                    )}
                  </Pressable>

                  {/* EDIT */}
                  <Pressable
                    style={styles.thumbEditButton}
                    onPress={() => {
                      const base = previewSource;
                      const idxInBase = base.findIndex(a => a.uri === asset.uri);
                      if (idxInBase >= 0) {
                        setSelectedAssetIndex(idxInBase);
                        setEditingIndex(idxInBase);
                      }
                    }}
                  >
                    <KISIcon name="edit" size={14} color="#fff" />
                  </Pressable>

                  {/* REMOVE */}
                  <Pressable
                    style={styles.thumbRemoveButton}
                    onPress={() => removeAsset(asset.uri!)}
                  >
                    <KISIcon name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              );
            })}

            {/* GALLERY BUTTON */}
            <Pressable onPress={openGallery} style={[styles.galleryItem, { borderColor: palette.border }]}>
              <KISIcon name="image" size={22} color={palette.text} />
              <Text style={styles.galleryLabel}>Gallery</Text>
            </Pressable>

          </ScrollView>
        </View>


        {/* CAPTION */}
        <View style={[styles.captionContainer, { borderTopColor: palette.divider }]}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a message..."
            placeholderTextColor={palette.subtext}
            style={[styles.captionInput, { color: palette.text }]}
            multiline
          />
        </View>


        {/* FOOTER */}
        <View style={[styles.footer, { borderTopColor: palette.divider }]}>
          <View style={styles.footerRowMain}>
           
            <Pressable
              style={[styles.footerButton, { backgroundColor: palette.card }]}
              onPress={() => openSystemCamera('video')}
            >
              <KISIcon name="video" size={18} color={palette.text} />
            </Pressable>

             <Pressable
              style={[styles.footerButton, { backgroundColor: palette.primary }]}
              onPress={() => openSystemCamera('photo')}
            >
              <KISIcon name="camera" size={18} color={palette.onPrimary} />
            </Pressable>


            <Pressable
              style={[styles.footerButton, { backgroundColor: palette.card }]}
              onPress={() => setCameraType(t => (t === 'back' ? 'front' : 'back'))}
            >
              <KISIcon name="refresh" size={18} color={palette.text} />
            </Pressable>
          </View>

          <Pressable
            style={[
              styles.footerSendButton,
              { backgroundColor: previewSource.length || caption.trim() ? palette.primary : palette.border },
            ]}
            onPress={handleSend}
            disabled={!previewSource.length && caption.trim() === ""}
          >
            <Text
              style={{
                color: previewSource.length || caption.trim()
                  ? palette.onPrimary
                  : palette.subtext,
                fontWeight: '600',
              }}
            >
              Send {previewSource.length ? `(${previewSource.length})` : ""}
            </Text>
          </Pressable>
        </View>


        {/* EDITOR MODAL */}
        <MediaEditModal
          visible={editingIndex !== null}
          assets={previewSource}
          initialIndex={editingIndex ?? 0}
          palette={palette}
          onClose={() => setEditingIndex(null)}
          onDoneAll={(editedList) => {
            setEditedAssets(editedList); // 🟢 Only overrides preview, NOT originals
            setEditingIndex(null);
          }}
        />

      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: KIS_TOKENS.typography.title,
    fontWeight: '700'
  },

  content: { flex: 1, padding: 12, justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%', borderRadius: kisRadius.lg },
  emptyState: {
    width: '100%',
    height: '80%',
    borderWidth: 2,
    borderRadius: kisRadius.lg,
    justifyContent: 'center',
    alignItems: 'center'
  },

  videoPlaceholder: {
    width: '100%',
    height: '80%',
    borderRadius: kisRadius.lg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  videoLabel: { marginTop: 8 },

  galleryStrip: { paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1 },
  galleryItem: {
    width: 60,
    height: 60,
    borderRadius: kisRadius.md,
    marginRight: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  galleryThumb: { width: '100%', height: '100%' },
  galleryThumbCenter: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },

  thumbEditButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  thumbRemoveButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  galleryLabel: { marginTop: 4, fontSize: 11 },

  captionContainer: {
    borderTopWidth: 1,
    padding: 8
  },
  captionInput: { minHeight: 40, maxHeight: 90, fontSize: 14 },

  footer: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  footerRowMain: { flexDirection: 'row', justifyContent: 'space-between' },
  footerButton: {
    flex: 1,
    marginHorizontal: 4,
    padding: 12,
    borderRadius: kisRadius.lg,
    alignItems: 'center'
  },
  footerSendButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: kisRadius.lg,
    alignItems: 'center'
  },
});

export default CameraCaptureModal;
