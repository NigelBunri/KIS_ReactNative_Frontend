// src/screens/chat/components/CameraCaptureModal.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useRawTopInset } from '@/hooks/useSafeTopInset';

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
import { useKISTheme } from '@/theme/useTheme';

import type { FilesType } from './AttachmentSheet';
import { MediaEditModal } from './FroCamer/MediaEditModal';

const getCameraPermission = () =>
  Platform.select({
    android: PERMISSIONS.ANDROID.CAMERA,
    ios: PERMISSIONS.IOS.CAMERA,
    default: undefined,
  });

const ensureCameraPermission = async () => {
  const cameraPermission = getCameraPermission();
  if (!cameraPermission) return true;

  const currentStatus = await check(cameraPermission);
  if (currentStatus === RESULTS.GRANTED || currentStatus === RESULTS.LIMITED) {
    return true;
  }

  const nextStatus =
    currentStatus === RESULTS.DENIED ? await request(cameraPermission) : currentStatus;

  return nextStatus === RESULTS.GRANTED || nextStatus === RESULTS.LIMITED;
};

const formatDuration = (seconds?: number) => {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
};

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
  const { gradients } = useKISTheme();
  // This Modal renders in its own native layer, where
  // react-native-safe-area-context's auto-detected top inset is unreliable
  // (worse on Android 15+, see useRawTopInset's doc comment) — the generic
  // SafeAreaViewWithTopPadding wrapper doesn't carry that correction, which
  // left the close button sitting too close to the status bar/notch to
  // reliably tap. Compute the inset explicitly instead of trusting the
  // wrapper for the top edge.
  const topInset = useRawTopInset();

  /** ORIGINAL ASSETS — ALWAYS UNTOUCHED */
  const [assets, setAssets] = useState<ImagePickerAsset[]>([]);

  /** EDITED RESULTS — USED ONLY FOR PREVIEW/SENDING */
  const [editedAssets, setEditedAssets] = useState<ImagePickerAsset[] | null>(null);

  const [selectedAssetIndex, setSelectedAssetIndex] = useState<number | null>(null);
  const [_galleryAssets, setGalleryAssets] = useState<ImagePickerAsset[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  // Use a ref for the guard so it doesn't cause openSystemCamera to be recreated,
  // which would retrigger the visibility effect in an infinite loop.
  const isOpeningCameraRef = useRef(false);
  // launchCamera()'s promise can be lost entirely on Android if the hosting
  // Activity is recreated while the system camera is in the foreground (a
  // known react-native-image-picker/OS interaction, not something this
  // component can prevent) — without a bound, that leaves isOpeningCamera
  // stuck true forever, which is exactly the "keeps loading" symptom.
  // requestIdRef lets a stale attempt's finally block (or a very late real
  // resolution after the timeout already fired) recognize it's no longer
  // the active one and avoid clobbering whatever came after it.
  const requestIdRef = useRef(0);

  /** Helper to update assets after new camera/gallery selection */
  const setNewAssetsAndSelectFirst = (newAssets: ImagePickerAsset[]) => {
    setAssets(newAssets);
    setEditedAssets(null); // always reset any previous edits
    setSelectedAssetIndex(newAssets.length ? 0 : null);
  };

  const openSystemCamera = useCallback(
    async (mediaType: 'photo' | 'video') => {
      if (isOpeningCameraRef.current) return;
      isOpeningCameraRef.current = true;
      setIsOpeningCamera(true);
      const requestId = ++requestIdRef.current;
      let timedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        // Generous — this only exists to bound the "lost callback" failure
        // mode above, not to rush a real photo/video capture. Video capture
        // itself is already capped at durationLimit (60s) below.
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          reject(new Error('camera-timeout'));
        }, 120000);
      });
      try {
        const hasCameraPermission = await ensureCameraPermission();
        if (!hasCameraPermission) {
          Alert.alert(
            'Camera permission needed',
            'Allow camera access in your device settings to take photos or videos in KIS.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ],
          );
          return;
        }

        // NOTE: react-native-image-picker's native Options.java reads some of
        // these keys unconditionally (e.g. durationLimit), so a key set to
        // JS `undefined` gets dropped by the bridge and crashes the app with
        // NoSuchKeyException. Keys must be omitted entirely, not set to
        // undefined, when they don't apply to the current mediaType.
        const options: CameraOptions =
          mediaType === 'photo'
            ? {
                mediaType,
                cameraType: 'back',
                saveToPhotos: true,
                includeExtra: true,
                quality: 0.8,
                presentationStyle: 'fullScreen',
              }
            : {
                mediaType,
                cameraType: 'back',
                saveToPhotos: true,
                includeExtra: true,
                videoQuality: 'high',
                durationLimit: 60,
                presentationStyle: 'fullScreen',
              };

        const result = await Promise.race([launchCamera(options), timeoutPromise]);
        if (requestId !== requestIdRef.current) return; // superseded by a newer attempt
        if (result.didCancel) return;
        if (result.errorCode) {
          const message = result.errorMessage || 'Could not open camera.';
          if (result.errorCode === 'permission') {
            Alert.alert(
              'Camera permission needed',
              'Allow camera access in your device settings to take photos or videos in KIS.',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open settings', onPress: () => void Linking.openSettings() },
              ],
            );
          } else {
            Alert.alert('Camera error', message);
          }
          return;
        }

        const newAssets = (result.assets ?? []).filter((asset) => Boolean(asset.uri));
        if (!newAssets.length) return;

        setNewAssetsAndSelectFirst(newAssets);
      } catch {
        if (requestId !== requestIdRef.current) return; // superseded by a newer attempt
        if (timedOut) {
          Alert.alert(
            'Camera took too long',
            "The camera didn't respond in time. Please try again.",
          );
        } else {
          Alert.alert('Camera Error', 'Could not open camera.');
        }
      } finally {
        clearTimeout(timeoutHandle);
        if (requestId === requestIdRef.current) {
          isOpeningCameraRef.current = false;
          setIsOpeningCamera(false);
        }
      }
    },
    [], // isOpeningCamera intentionally excluded — guarded by ref above
  );

  const openGallery = useCallback(async () => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'mixed',
        selectionLimit: 20,
        includeExtra: true,
        quality: 0.8,
        videoQuality: 'high',
        presentationStyle: 'fullScreen',
      };

      const result = await launchImageLibrary(options);
      if (result.didCancel) return;

      if (result.errorCode) {
        const message = result.errorMessage || 'Could not open gallery.';
        if (result.errorCode === 'permission') {
          Alert.alert(
            'Photo permission needed',
            'Allow photo access in your device settings to share images or videos in KIS.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert('Gallery error', message);
        }
        return;
      }

      const libAssets = (result.assets ?? []).filter((asset) => Boolean(asset.uri));
      if (!libAssets.length) return;

      setGalleryAssets(libAssets);
      setNewAssetsAndSelectFirst(libAssets);
    } catch {
      Alert.alert('Gallery Error', 'Could not open gallery.');
    }
  }, []);

  // Keep a stable ref so the effect below can call the latest version of
  // openSystemCamera without including it in the dependency array (which would
  // cause the effect to re-fire every time isOpeningCamera changes).
  const openSystemCameraRef = useRef(openSystemCamera);
  useEffect(() => { openSystemCameraRef.current = openSystemCamera; });

  /** Reset view state and open the real system camera when the camera sheet appears. */
  useEffect(() => {
    if (!visible) return;
    setAssets([]);
    setSelectedAssetIndex(null);
    setEditingIndex(null);
    setCaption('');
    setEditedAssets(null);

    const timer = setTimeout(() => {
      void openSystemCameraRef.current('photo');
    }, 250);

    return () => clearTimeout(timer);
  }, [visible]); // only fire on visible toggle, not on every openSystemCamera recreation

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
  const previewDuration = formatDuration(previewAsset?.duration);

  /** Thumbnails show every selected asset (gallery allows up to 20; strip scrolls). */
  const stripAssets = previewSource;

  const hasContent = previewSource.length > 0 || caption.trim() !== "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['bottom']}>

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: topInset + KIS_TOKENS.spacing.sm, borderBottomColor: palette.divider, backgroundColor: palette.card }, KIS_TOKENS.elevation.card]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.headerIconButton,
              { backgroundColor: palette.surface },
              pressed && { opacity: KIS_TOKENS.opacity.pressed },
            ]}
          >
            <KISIcon name="close" size={20} color={palette.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Camera</Text>
            {previewSource.length > 0 ? (
              <Text style={[styles.headerSubtitle, { color: palette.subtext }]}>
                {previewSource.length} {previewSource.length === 1 ? 'item' : 'items'} selected
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={openGallery}
            style={({ pressed }) => [
              styles.headerIconButton,
              { backgroundColor: palette.surface },
              pressed && { opacity: KIS_TOKENS.opacity.pressed },
            ]}
          >
            <KISIcon name="image" size={20} color={palette.text} />
          </Pressable>
        </View>


        {/* PREVIEW */}
        <Pressable
          style={styles.content}
          disabled={!!previewAsset}
          onPress={previewAsset ? undefined : onClose}
        >
          {previewAsset ? (
            <View style={[styles.previewCard, { backgroundColor: palette.surfaceElevated }, KIS_TOKENS.elevation.modal]}>
              {isImage ? (
                <Image source={{ uri: previewAsset.uri }} style={styles.previewImage} resizeMode="cover" />
              ) : isVideo ? (
                <View style={[styles.videoPlaceholder, { backgroundColor: palette.surfaceElevated }]}>
                  <View style={styles.videoPlayBadge}>
                    <KISIcon name="play" size={30} color="#fff" />
                  </View>
                  <Text style={[styles.videoLabel, { color: palette.text }]}>Video ready to send</Text>
                  {previewDuration ? (
                    <Text style={[styles.videoDuration, { color: palette.subtext }]}>{previewDuration}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.emptyState, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <LinearGradient
                colors={[...gradients.tabSelected]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIcon}
              >
                <KISIcon name="camera" size={32} color="#fff" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>Take a photo or video</Text>
              <Text style={[styles.emptySubtitle, { color: palette.subtext }]}>
                Use your camera or choose from your gallery. Media is checked before it is sent.
              </Text>
              <View style={styles.emptyActions}>
                <Pressable
                  onPress={() => openSystemCamera('photo')}
                  disabled={isOpeningCamera}
                  style={({ pressed }) => [
                    styles.emptyActionButtonWrap,
                    pressed && { transform: [{ scale: 0.97 }] },
                    isOpeningCamera && { opacity: KIS_TOKENS.opacity.disabled },
                  ]}
                >
                  <LinearGradient
                    colors={[...gradients.header]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyActionButton}
                  >
                    {isOpeningCamera ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <KISIcon name="camera" size={18} color="#fff" />
                    )}
                    <Text style={styles.emptyActionTextPrimary}>Photo</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={openGallery}
                  style={({ pressed }) => [
                    styles.emptyActionButton,
                    { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1 },
                    pressed && { opacity: KIS_TOKENS.opacity.pressed },
                  ]}
                >
                  <KISIcon name="image" size={18} color={palette.text} />
                  <Text style={[styles.emptyActionText, { color: palette.text }]}>Gallery</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>


        {/* THUMB STRIP */}
        {stripAssets.length > 0 ? (
          <View style={[styles.galleryStrip, { borderTopColor: palette.divider, backgroundColor: palette.card }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryStripContent}
            >
              {stripAssets.map((asset, idx) => {
                const selected = previewAsset?.uri === asset.uri;
                const isThumbImage = asset.type?.startsWith("image/");

                return (
                  <View
                    key={asset.uri ?? idx}
                    style={[
                      styles.galleryItem,
                      {
                        borderColor: selected ? palette.primary : palette.border,
                        borderWidth: selected ? 3 : 1,
                        backgroundColor: palette.surface,
                      },
                      selected && KIS_TOKENS.elevation.popover,
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
                      {!isThumbImage ? (
                        <View style={styles.thumbPlayBadge}>
                          <KISIcon name="play" size={11} color="#fff" />
                        </View>
                      ) : null}
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
                      <KISIcon name="edit" size={13} color="#fff" />
                    </Pressable>

                    {/* REMOVE */}
                    <Pressable
                      style={styles.thumbRemoveButton}
                      onPress={() => removeAsset(asset.uri!)}
                    >
                      <KISIcon name="close" size={13} color="#fff" />
                    </Pressable>
                  </View>
                );
              })}

              {/* ADD MORE FROM GALLERY */}
              <Pressable
                onPress={openGallery}
                style={({ pressed }) => [
                  styles.addMoreItem,
                  { borderColor: palette.primary },
                  pressed && { opacity: KIS_TOKENS.opacity.pressed },
                ]}
              >
                <KISIcon name="add" size={22} color={palette.primary} />
                <Text style={[styles.galleryLabel, { color: palette.primary }]}>Add</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}


        {/* CAPTION */}
        <View style={[styles.captionContainer, { borderTopColor: palette.divider, backgroundColor: palette.bg }]}>
          <View style={[styles.captionPill, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
            <KISIcon name="chat" size={16} color={palette.subtext} />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a message..."
              placeholderTextColor={palette.subtext}
              style={[styles.captionInput, { color: palette.text }]}
              multiline
            />
          </View>
        </View>


        {/* FOOTER */}
        <View style={[styles.footer, { borderTopColor: palette.divider, backgroundColor: palette.card }, KIS_TOKENS.elevation.modal]}>
          <View style={styles.footerRowMain}>

            <Pressable
              style={({ pressed }) => [
                styles.sideButton,
                { backgroundColor: palette.surface },
                pressed && { opacity: KIS_TOKENS.opacity.pressed },
              ]}
              onPress={() => openSystemCamera('video')}
            >
              <KISIcon name="video" size={20} color={palette.text} />
              <Text style={[styles.sideButtonLabel, { color: palette.text }]}>Video</Text>
            </Pressable>

            <Pressable
              onPress={() => openSystemCamera('photo')}
              disabled={isOpeningCamera}
              style={({ pressed }) => [
                styles.shutterWrap,
                pressed && { transform: [{ scale: 0.95 }] },
                isOpeningCamera && { opacity: KIS_TOKENS.opacity.disabled },
              ]}
            >
              <LinearGradient
                colors={[...gradients.header]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shutterRing}
              >
                <View style={[styles.shutterInner, { backgroundColor: palette.bg }]}>
                  {isOpeningCamera ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <KISIcon name="camera" size={26} color={palette.primary} />
                  )}
                </View>
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.footerSendButtonWrap,
              pressed && hasContent && { transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSend}
            disabled={!hasContent}
          >
            {hasContent ? (
              <LinearGradient
                colors={[...gradients.header]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.footerSendButton}
              >
                <KISIcon name="send" size={16} color="#fff" />
                <Text style={styles.footerSendTextEnabled}>
                  Send {previewSource.length ? `(${previewSource.length})` : ""}
                </Text>
              </LinearGradient>
            ) : (
              <View style={[styles.footerSendButton, styles.footerSendButtonDisabled, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.footerSendTextDisabled, { color: palette.subtext }]}>
                  Send
                </Text>
              </View>
            )}
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

      </SafeAreaView>
    </Modal>
  );
};


const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: KIS_TOKENS.spacing.md,
    paddingVertical: KIS_TOKENS.spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: KIS_TOKENS.typography.title,
    fontWeight: KIS_TOKENS.typography.weight.bold,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: KIS_TOKENS.typography.tiny,
    fontWeight: KIS_TOKENS.typography.weight.medium,
  },

  content: { flex: 1, padding: KIS_TOKENS.spacing.md, justifyContent: 'center', alignItems: 'center' },
  previewCard: {
    width: '100%',
    height: '100%',
    borderRadius: kisRadius.xl,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },

  emptyState: {
    width: '100%',
    borderWidth: 1,
    borderRadius: kisRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    padding: KIS_TOKENS.spacing.xl,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: KIS_TOKENS.spacing.lg,
  },
  emptyTitle: {
    fontSize: KIS_TOKENS.typography.h3,
    fontWeight: KIS_TOKENS.typography.weight.extrabold,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: KIS_TOKENS.spacing.xs,
    fontSize: KIS_TOKENS.typography.helper,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: KIS_TOKENS.spacing.sm,
    marginTop: KIS_TOKENS.spacing.xl,
  },
  emptyActionButtonWrap: {
    borderRadius: kisRadius.lg,
    overflow: 'hidden',
  },
  emptyActionButton: {
    minWidth: 112,
    minHeight: 48,
    borderRadius: kisRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: KIS_TOKENS.spacing.sm,
    paddingHorizontal: KIS_TOKENS.spacing.lg,
  },
  emptyActionText: { fontWeight: KIS_TOKENS.typography.weight.extrabold },
  emptyActionTextPrimary: { fontWeight: KIS_TOKENS.typography.weight.extrabold, color: '#fff' },

  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: KIS_TOKENS.spacing.xs,
  },
  videoPlayBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: KIS_TOKENS.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  videoLabel: { fontSize: KIS_TOKENS.typography.label, fontWeight: KIS_TOKENS.typography.weight.semibold },
  videoDuration: { fontSize: KIS_TOKENS.typography.helper, marginTop: 2 },

  galleryStrip: { paddingVertical: KIS_TOKENS.spacing.sm, borderTopWidth: 1, flexShrink: 0 },
  galleryStripContent: { paddingHorizontal: KIS_TOKENS.spacing.sm, gap: KIS_TOKENS.spacing.sm },
  galleryItem: {
    width: 68,
    height: 68,
    borderRadius: kisRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryThumb: { width: '100%', height: '100%' },
  galleryThumbCenter: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlayBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  thumbEditButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addMoreItem: {
    width: 68,
    height: 68,
    borderRadius: kisRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryLabel: { marginTop: 3, fontSize: KIS_TOKENS.typography.tiny, fontWeight: KIS_TOKENS.typography.weight.semibold },

  captionContainer: {
    borderTopWidth: 1,
    paddingHorizontal: KIS_TOKENS.spacing.md,
    paddingVertical: KIS_TOKENS.spacing.sm,
    flexShrink: 0,
  },
  captionPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: KIS_TOKENS.spacing.sm,
    borderWidth: 1,
    borderRadius: KIS_TOKENS.radius.pill,
    paddingHorizontal: KIS_TOKENS.spacing.lg,
    paddingVertical: 10,
  },
  captionInput: { flex: 1, minHeight: 20, maxHeight: 90, fontSize: KIS_TOKENS.typography.input, paddingTop: 0 },

  footer: { paddingHorizontal: KIS_TOKENS.spacing.md, paddingTop: KIS_TOKENS.spacing.md, paddingBottom: KIS_TOKENS.spacing.sm, borderTopWidth: 1, flexShrink: 0 },
  footerRowMain: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: KIS_TOKENS.spacing['2xl'] },
  sideButton: {
    width: 64,
    height: 60,
    borderRadius: kisRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sideButtonLabel: {
    fontSize: KIS_TOKENS.typography.tiny,
    fontWeight: KIS_TOKENS.typography.weight.bold,
  },

  shutterWrap: { alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footerSendButtonWrap: { marginTop: KIS_TOKENS.spacing.md, borderRadius: KIS_TOKENS.radius.pill, overflow: 'hidden' },
  footerSendButton: {
    paddingVertical: 14,
    borderRadius: KIS_TOKENS.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: KIS_TOKENS.spacing.sm,
  },
  footerSendButtonDisabled: { borderWidth: 1 },
  footerSendTextEnabled: { color: '#fff', fontWeight: KIS_TOKENS.typography.weight.extrabold, fontSize: KIS_TOKENS.typography.label },
  footerSendTextDisabled: { fontWeight: KIS_TOKENS.typography.weight.extrabold, fontSize: KIS_TOKENS.typography.label },
});

export default CameraCaptureModal;
