// src/screens/chat/components/FroCamer/VideoEditor.tsx

import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Asset as ImagePickerAsset } from 'react-native-image-picker';
import Video from 'react-native-video';

import { KISIcon } from '@/constants/kisIcons';
import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';

type VideoEditorProps = {
  visible: boolean;
  asset: ImagePickerAsset;
  index: number;
  total: number;
  palette: KISPalette;
  onClose: () => void;
  onSaveAsset: (index: number, asset: ImagePickerAsset) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  /**
   * Called when user taps "Save & Next" / finish editing.
   * Same contract as ImageEditor: (index, editedAsset) => void
   */
  onDoneAll: (index: number, asset: ImagePickerAsset) => void;
};

type AspectMode = 'fit' | 'square' | 'fourThree' | 'sixteenNine';

export const VideoEditor: React.FC<VideoEditorProps> = ({
  visible,
  asset,
  index,
  total,
  palette,
  onClose,
  onSaveAsset,
  onGoPrev,
  onGoNext: _onGoNext,
  onDoneAll,
}) => {
  const playerRef = useRef<any>(null);

  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState<number | null>(null);

  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [aspectMode, setAspectMode] =
    useState<AspectMode>('fit');
  const [overlayText] = useState<string>('Sample caption');
  const [filterMode, setFilterMode] = useState<'none' | 'cinema'>(
    'none',
  );

  const handleLoad = (meta: {
    duration: number;
    naturalSize: { width: number; height: number };
  }) => {
    setDuration(meta.duration || 0);
  };

  const handleProgress = (progress: { currentTime: number }) => {
    setPosition(progress.currentTime);
  };

  const togglePlayPause = () => {
    setPaused((p) => !p);
  };

  const toggleMute = () => {
    setMuted((m) => !m);
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
  };

  const handleSetTrimIn = () => {
    setTrimIn(position);
    if (trimOut != null && position > trimOut) {
      setTrimOut(null);
    }
  };

  const handleSetTrimOut = () => {
    if (position > trimIn) {
      setTrimOut(position);
    }
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleFlipH = () => {
    setFlipH((f) => !f);
  };

  const handleAspectChange = (mode: AspectMode) => {
    setAspectMode(mode);
  };

  const handleToggleFilter = () => {
    setFilterMode((m) => (m === 'none' ? 'cinema' : 'none'));
  };

  const formatTime = (t: number) => {
    if (!t || Number.isNaN(t)) return '00:00';
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const ss = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${mm}:${ss}`;
  };

  const aspectStyle = () => {
    switch (aspectMode) {
      case 'square':
        return { aspectRatio: 1 };
      case 'fourThree':
        return { aspectRatio: 4 / 3 };
      case 'sixteenNine':
        return { aspectRatio: 16 / 9 };
      default:
        return { flex: 1 };
    }
  };

  const buildEditedAsset = (): ImagePickerAsset => {
    // TODO: really export trimmed/filtered video via ffmpeg
    // For now we just return the original asset but it flows through
    // the same pipeline as edited images.
    return asset;
  };

  // New behavior: save edits and finish, let parent propagate edited list
  const handleSaveAndDone = () => {
    const edited = buildEditedAsset();
    onSaveAsset(index, edited);       // update local list in MediaEditModal
    onDoneAll(index, edited);         // tell MediaEditModal we're done with this asset
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { backgroundColor: palette.bg },
        ]}
      >
        {/* HEADER */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: palette.divider,
              backgroundColor:
                palette.chatHeaderBg ?? palette.card,
            },
          ]}
        >
          <Pressable
            onPress={onGoPrev}
            style={styles.headerIconButton}
          >
            <KISIcon
              name="arrow-left"
              size={22}
              color={palette.subtext}
            />
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                textAlign: 'center',
                fontSize: KIS_TOKENS.typography.title,
                fontWeight: KIS_TOKENS.typography.weight.bold,
                color: palette.text,
              }}
            >
              Video editor
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: KIS_TOKENS.typography.helper,
                color: palette.subtext,
              }}
            >
              {index + 1} / {total}
            </Text>
          </View>

          <Pressable
            onPress={handleToggleFilter}
            style={styles.headerIconButton}
          >
            <KISIcon
              name="filter"
              size={20}
              color={
                filterMode === 'cinema'
                  ? palette.primary
                  : palette.subtext
              }
            />
          </Pressable>
        </View>

        {/* CONTENT */}
        <View style={styles.content}>
          <View
            style={[
              styles.videoContainer,
              aspectStyle(),
            ]}
          >
            <Video
              ref={(ref) => {
                playerRef.current = ref;
              }}
              source={{ uri: asset.uri || '' }}
              style={[
                styles.video,
                {
                  transform: [
                    { rotate: `${rotation}deg` },
                    { scaleX: flipH ? -1 : 1 },
                    { scaleY: 1 },
                  ],
                },
              ]}
              resizeMode="contain"
              paused={paused}
              muted={muted}
              rate={speed}
              onLoad={handleLoad}
              onProgress={handleProgress}
            />
            {filterMode === 'cinema' && (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  },
                ]}
              />
            )}

            {overlayText ? (
              <View style={styles.overlayTextContainer}>
                <Text style={styles.overlayText}>
                  {overlayText}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.timelineRow}>
            <Text
              style={{
                color: palette.text,
                fontSize: KIS_TOKENS.typography.helper,
              }}
            >
              {formatTime(position)} / {formatTime(duration)}
            </Text>

            <Text
              style={{
                color: palette.subtext,
                fontSize: KIS_TOKENS.typography.helper,
              }}
            >
              Trim: {formatTime(trimIn)} –{' '}
              {trimOut != null
                ? formatTime(trimOut)
                : 'end'}
            </Text>
          </View>
        </View>

        {/* TOOLBAR 1 */}
        <View
          style={[
            styles.toolsRow,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={togglePlayPause}
          >
            <KISIcon
              name={paused ? 'play' : 'pause'}
              size={18}
              color={palette.text}
            />
            <Text
              style={{
                marginLeft: 4,
                color: palette.text,
              }}
            >
              {paused ? 'Play' : 'Pause'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={toggleMute}
          >
            <KISIcon
              name={muted ? 'mute' : 'volume'}
              size={18}
              color={palette.text}
            />
            <Text
              style={{
                marginLeft: 4,
                color: palette.text,
              }}
            >
              {muted ? 'Muted' : 'Sound'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={() => changeSpeed(0.5)}
          >
            <Text
              style={{
                color: palette.text,
              }}
            >
              0.5×
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={() => changeSpeed(1)}
          >
            <Text
              style={{
                color: palette.text,
              }}
            >
              1×
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={() => changeSpeed(1.5)}
          >
            <Text
              style={{
                color: palette.text,
              }}
            >
              1.5×
            </Text>
          </Pressable>
        </View>

        {/* TOOLBAR 2 */}
        <View
          style={[
            styles.toolsRow,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={handleSetTrimIn}
          >
            <KISIcon
              name="reply"
              size={16}
              color={palette.text}
            />
            <Text
              style={{
                marginLeft: 4,
                color: palette.text,
              }}
            >
              Set in
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={handleSetTrimOut}
          >
            <KISIcon
              name="forward"
              size={16}
              color={palette.text}
            />
            <Text
              style={{
                marginLeft: 4,
                color: palette.text,
              }}
            >
              Set out
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={handleRotate}
          >
            <KISIcon
              name="rotate-right"
              size={16}
              color={palette.text}
            />
            <Text
              style={{
                marginLeft: 4,
                color: palette.text,
              }}
            >
              Rotate
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              { borderColor: palette.border },
            ]}
            onPress={handleFlipH}
          >
            <KISIcon
              name="arrow-left"
              size={16}
              color={palette.text}
            />
            <Text
              style={{
                marginLeft: 4,
                color: palette.text,
              }}
            >
              Flip
            </Text>
          </Pressable>
        </View>

        {/* TOOLBAR 3 */}
        <View
          style={[
            styles.toolsRow,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          <Pressable
            style={[
              styles.toolButton,
              {
                borderColor:
                  aspectMode === 'fit'
                    ? palette.primary
                    : palette.border,
              },
            ]}
            onPress={() => handleAspectChange('fit')}
          >
            <Text
              style={{
                color:
                  aspectMode === 'fit'
                    ? palette.primary
                    : palette.text,
              }}
            >
              Fit
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              {
                borderColor:
                  aspectMode === 'square'
                    ? palette.primary
                    : palette.border,
              },
            ]}
            onPress={() => handleAspectChange('square')}
          >
            <Text
              style={{
                color:
                  aspectMode === 'square'
                    ? palette.primary
                    : palette.text,
              }}
            >
              1:1
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              {
                borderColor:
                  aspectMode === 'fourThree'
                    ? palette.primary
                    : palette.border,
              },
            ]}
            onPress={() => handleAspectChange('fourThree')}
          >
            <Text
              style={{
                color:
                  aspectMode === 'fourThree'
                    ? palette.primary
                    : palette.text,
              }}
            >
              4:3
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toolButton,
              {
                borderColor:
                  aspectMode === 'sixteenNine'
                    ? palette.primary
                    : palette.border,
              },
            ]}
            onPress={() => handleAspectChange('sixteenNine')}
          >
            <Text
              style={{
                color:
                  aspectMode === 'sixteenNine'
                    ? palette.primary
                    : palette.text,
              }}
            >
              16:9
            </Text>
          </Pressable>
        </View>

        {/* FOOTER */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          {/* Cancel */}
          <Pressable
            style={[
              styles.footerButton,
              { borderColor: palette.border },
            ]}
            onPress={onClose}
          >
            <Text
              style={{
                color: palette.text,
                fontWeight: '600',
              }}
            >
              Cancel
            </Text>
          </Pressable>

          {/* Save & Finish (go back to CameraCapture) */}
          <Pressable
            style={[
              styles.footerButton,
              {
                borderColor: palette.primary,
                backgroundColor: palette.primary,
              },
            ]}
            onPress={handleSaveAndDone}
          >
            <Text
              style={{
                color: palette.onPrimary,
                fontWeight: '600',
              }}
            >
              Save & Next
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  videoContainer: {
    borderRadius: kisRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlayTextContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  overlayText: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    borderRadius: 999,
    fontSize: 13,
  },
  timelineRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  toolButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: kisRadius.lg,
    borderWidth: 2,
    marginHorizontal: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: kisRadius.lg,
    borderWidth: 2,
    marginHorizontal: 4,
  },
});
