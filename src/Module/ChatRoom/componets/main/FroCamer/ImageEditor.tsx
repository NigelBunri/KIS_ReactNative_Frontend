// src/screens/chat/components/FroCamer/ImageEditor.tsx

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { KISPalette, KIS_TOKENS } from '@/theme/constants';
import { editorStyles } from './ImageEditor.styles';
import { useImageEditor } from './useImageEditor';
import { EditorCanvas } from './EditorCanvas';
import { ImageEditorProps, ImageTool } from './ImageEditor.types';

type ToolButtonProps = {
  palette: KISPalette;
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
};

const ToolButton: React.FC<ToolButtonProps> = ({
  palette,
  icon,
  label,
  active,
  onPress,
}) => (
  <Pressable
    style={[
      editorStyles.toolButton,
      {
        borderColor: active ? palette.primary : palette.border,
        backgroundColor: active ? palette.card : 'transparent',
      },
    ]}
    onPress={onPress}
  >
    <KISIcon
      name={icon}
      size={16}
      color={active ? palette.primary : palette.text}
    />
    <Text
      style={{
        marginLeft: 4,
        color: active ? palette.primary : palette.text,
        fontSize: KIS_TOKENS.typography.helper,
      }}
    >
      {label}
    </Text>
  </Pressable>
);

// 12 presets incl. original
const FILTER_PRESETS = [
  { id: 'none', label: 'Original' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Warm' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'faded', label: 'Faded' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'invert', label: 'Invert' },
  { id: 'night', label: 'Night' },
  { id: 'soft', label: 'Soft' },
  { id: 'vintage', label: 'Vintage' },
] as const;

// numeric brush limits
const MIN_BRUSH_WIDTH = 1;
const MAX_BRUSH_WIDTH = 32;
const DEFAULT_BRUSH_WIDTH = 8;

const classifyBrushSize = (
  width: number,
): 'small' | 'medium' | 'large' => {
  if (width <= 8) return 'small';
  if (width <= 20) return 'medium';
  return 'large';
};

export const ImageEditor: React.FC<ImageEditorProps> = ({
  visible,
  asset,
  index,
  total: _total,
  palette,
  onClose,
  onSaveAsset,
  onGoPrev: _onGoPrev,
  onGoNext: _onGoNext,
  onDoneAll, // (index, editedAsset) => void
}) => {
  // 🔹 Grab everything from the hook via a single "editor" object
  const editor: any = useImageEditor({ asset });

  const {
    rotation,
    flipH,
    flipV,
    scale,
    filterMode,
    setFilterMode,
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    brushWidth,
    brushStrokes,
    mosaicBlocks,
    textTags,
    activeTextId,
    updateActiveTextTag,
    cropRect,
    isCapturing,
    viewShotRef,
    panHandlers,
    onOverlayLayout,
    handleRotateLeft,
    handleRotateRight,
    handleFlipHorizontal,
    handleFlipVertical,
    handleZoomIn,
    handleAddMosaicBlock,
    handleClearBrush,
    handleAddTextTag,
    handleReset,
    buildEditedAsset,
    initCropRect,
  } = editor;

  // Optional helpers (may or may not exist in the hook)
  const setBrushWidthFn: ((w: number) => void) | undefined =
    editor.setBrushWidth;
  const handleClearTextFn: (() => void) | undefined =
    editor.handleClearText;

  const [isFilterPickerVisible, setIsFilterPickerVisible] =
    useState(false);

  useEffect(() => {
    if (visible) {
      setIsFilterPickerVisible(false);
    }
  }, [visible, index]);

  const handleTool = (tool: ImageTool, extra?: () => void) => () => {
    setActiveTool(tool);
    extra?.();
  };

  // Save current edits and notify parent with the edited asset + index.
  const handleSaveAndDone = async () => {
    const edited = await buildEditedAsset();
    onSaveAsset(index, edited);
    onDoneAll(index, edited);
  };

  const activeText = textTags.find((t: any) => t.id === activeTextId) || null;

  const handleTextChange = (value: string) => {
    if (!activeText) return;
    updateActiveTextTag({ text: value });
  };

  const handleTextSizeChange = (
    size: 'small' | 'medium' | 'large',
  ) => {
    if (!activeText) return;
    const fontSize = size === 'small' ? 14 : size === 'large' ? 24 : 18;
    updateActiveTextTag({ fontSize });
  };

  const handleToggleBold = () => {
    if (!activeText) return;
    const next =
      activeText.fontWeight === 'bold' ? 'normal' : 'bold';
    updateActiveTextTag({ fontWeight: next });
  };

  const handleTextColorChange = (color: string) => {
    if (!activeText) return;
    updateActiveTextTag({ color });
  };

  // Small overlay for preview thumbnails (not the main canvas)
  const getPreviewOverlayStyle = (
    id: (typeof FILTER_PRESETS)[number]['id'],
  ) => {
    switch (id) {
      case 'warm':
        return { backgroundColor: 'rgba(255,165,0,0.25)' };
      case 'cool':
        return { backgroundColor: 'rgba(64,160,255,0.25)' };
      case 'night':
        return { backgroundColor: 'rgba(10,20,60,0.35)' };
      case 'soft':
        return { backgroundColor: 'rgba(255,192,203,0.25)' };
      case 'vivid':
        return { backgroundColor: 'rgba(255,255,0,0.2)' };
      case 'faded':
        return { backgroundColor: 'rgba(255,255,255,0.2)' };
      default:
        return {};
    }
  };

  const handleSelectFilter = (
    id: (typeof FILTER_PRESETS)[number]['id'],
  ) => {
    setFilterMode(id as any);
  };

  // 🔹 Brush size controls
  const currentBrushWidth =
    typeof brushWidth === 'number' && !Number.isNaN(brushWidth)
      ? brushWidth
      : DEFAULT_BRUSH_WIDTH;

  const increaseBrushSize = () => {
    if (setBrushWidthFn) {
      const next = Math.min(currentBrushWidth + 1, MAX_BRUSH_WIDTH);
      setBrushWidthFn(next);
      setBrushSize(classifyBrushSize(next));
    } else {
      // Fallback: small → medium → large
      if (brushSize === 'small') setBrushSize('medium');
      else if (brushSize === 'medium') setBrushSize('large');
    }
  };

  const decreaseBrushSize = () => {
    if (setBrushWidthFn) {
      const next = Math.max(currentBrushWidth - 1, MIN_BRUSH_WIDTH);
      setBrushWidthFn(next);
      setBrushSize(classifyBrushSize(next));
    } else {
      // Fallback: large → medium → small
      if (brushSize === 'large') setBrushSize('medium');
      else if (brushSize === 'medium') setBrushSize('small');
    }
  };

  const resetBrushSize = () => {
    if (setBrushWidthFn) {
      setBrushWidthFn(DEFAULT_BRUSH_WIDTH);
      setBrushSize(classifyBrushSize(DEFAULT_BRUSH_WIDTH));
    } else {
      // Fallback default: medium
      setBrushSize('medium');
    }
  };

  const brushLabel =
    brushSize === 'small'
      ? 'Small'
      : brushSize === 'large'
      ? 'Large'
      : 'Medium';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          editorStyles.root,
          { backgroundColor: palette.bg, marginTop: 50 },
        ]}
      >
        {/* CANVAS */}
        <View style={editorStyles.content}>
          <EditorCanvas
            asset={asset}
            palette={palette}
            rotation={rotation}
            flipH={flipH}
            flipV={flipV}
            scale={scale}
            brushStrokes={brushStrokes}
            mosaicBlocks={mosaicBlocks}
            textTags={textTags}
            cropRect={cropRect}
            isCapturing={isCapturing}
            activeTool={activeTool}
            onOverlayLayout={onOverlayLayout}
            panHandlers={panHandlers}
            viewShotRef={viewShotRef}
            filterMode={filterMode}
          />
        </View>

        {/* TEXT CONTROLS */}
        {activeTool === 'text' && activeText && (
          <View
            style={[
              editorStyles.textControlsRow,
              {
                borderTopColor: palette.divider,
                backgroundColor:
                  palette.chatComposerBg ?? palette.card,
              },
            ]}
          >
            <TextInput
              value={activeText.text}
              onChangeText={handleTextChange}
              placeholder="Edit text"
              placeholderTextColor={palette.subtext}
              style={[
                editorStyles.textInput,
                {
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
            />

            {(['small', 'medium', 'large'] as const).map((size) => (
              <Pressable
                key={size}
                onPress={() => handleTextSizeChange(size)}
                style={[
                  editorStyles.textSizeButton,
                  {
                    borderColor:
                      (size === 'small' && activeText.fontSize === 14) ||
                      (size === 'medium' && activeText.fontSize === 18) ||
                      (size === 'large' && activeText.fontSize === 24)
                        ? palette.primary
                        : palette.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: palette.text,
                    fontSize:
                      size === 'small'
                        ? 10
                        : size === 'large'
                        ? 14
                        : 12,
                  }}
                >
                  {size[0].toUpperCase()}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={handleToggleBold}
              style={[
                editorStyles.textStyleButton,
                {
                  borderColor:
                    activeText.fontWeight === 'bold'
                      ? palette.primary
                      : palette.border,
                },
              ]}
            >
              <Text
                style={{
                  color: palette.text,
                  fontWeight: 'bold',
                }}
              >
                B
              </Text>
            </Pressable>

            {['#ffffff', '#ffcc00', '#ff4d4f', '#40a9ff'].map(
              (color) => (
                <Pressable
                  key={color}
                  onPress={() => handleTextColorChange(color)}
                  style={[
                    editorStyles.colorDot,
                    {
                      backgroundColor: color,
                      borderColor:
                        activeText.color === color
                          ? palette.primary
                          : palette.border,
                    },
                  ]}
                />
              ),
            )}

            {/* Clear ALL text overlays */}
            <Pressable
              onPress={() => {
                if (handleClearTextFn) {
                  handleClearTextFn(); // preferred: clear only text
                } else {
                  // Fallback: reset everything (also clears text)
                  handleReset();
                }
              }}
              style={[
                editorStyles.textStyleButton,
                {
                  borderColor: palette.border,
                  marginLeft: 4,
                },
              ]}
            >
              <Text
                style={{
                  color: palette.text,
                  fontSize: KIS_TOKENS.typography.helper,
                }}
              >
                Clear text
              </Text>
            </Pressable>
          </View>
        )}

        {/* BRUSH SIZE BAR (numeric up to 32 if hook supports it) */}
        {activeTool === 'brush' && (
          <View
            style={[
              editorStyles.brushSizeRow,
              {
                borderTopColor: palette.divider,
                backgroundColor:
                  palette.chatComposerBg ?? palette.card,
              },
            ]}
          >
            <Text
              style={{
                color: palette.subtext,
                fontSize: KIS_TOKENS.typography.helper,
                marginRight: 8,
              }}
            >
              Brush: {brushLabel} (
              {Math.round(currentBrushWidth)})
            </Text>

            {/* Decrease */}
            <Pressable
              style={[
                editorStyles.brushSizeButton,
                { borderColor: palette.border },
              ]}
              onPress={decreaseBrushSize}
            >
              <Text
                style={{
                  color: palette.text,
                  fontWeight: '600',
                }}
              >
                −
              </Text>
            </Pressable>

            {/* Increase */}
            <Pressable
              style={[
                editorStyles.brushSizeButton,
                { borderColor: palette.border },
              ]}
              onPress={increaseBrushSize}
            >
              <Text
                style={{
                  color: palette.text,
                  fontWeight: '600',
                }}
              >
                +
              </Text>
            </Pressable>

            {/* Reset */}
            <Pressable
              style={[
                editorStyles.brushSizeButton,
                { borderColor: palette.primary },
              ]}
              onPress={resetBrushSize}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: '600',
                }}
              >
                Reset
              </Text>
            </Pressable>
          </View>
        )}

        {/* TOOLBAR 1 */}
        <View
          style={[
            editorStyles.toolsRow,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          <ToolButton
            palette={palette}
            icon="edit"
            label="Brush"
            active={activeTool === 'brush'}
            onPress={handleTool('brush')}
          />
          <ToolButton
            palette={palette}
            icon="copy"
            label="Blur/Hide"
            active={activeTool === 'mosaic'}
            onPress={handleTool('mosaic', handleAddMosaicBlock)}
          />
          <ToolButton
            palette={palette}
            icon="rotate-left"
            label="Rot L"
            active={activeTool === 'rotate'}
            onPress={handleTool('rotate', handleRotateLeft)}
          />
          <ToolButton
            palette={palette}
            icon="rotate-right"
            label="Rot R"
            active={activeTool === 'rotate'}
            onPress={handleTool('rotate', handleRotateRight)}
          />
          <ToolButton
            palette={palette}
            icon="layers"
            label="Text"
            active={activeTool === 'text'}
            onPress={handleTool('text', handleAddTextTag)}
          />
        </View>

        {/* TOOLBAR 2 */}
        <View
          style={[
            editorStyles.toolsRow,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          <ToolButton
            palette={palette}
            icon="arrow-left"
            label="Flip H"
            active={activeTool === 'flipH'}
            onPress={handleTool('flipH', handleFlipHorizontal)}
          />
          <ToolButton
            palette={palette}
            icon="arrow-left"
            label="Flip V"
            active={activeTool === 'flipV'}
            onPress={handleTool('flipV', handleFlipVertical)}
          />
          <ToolButton
            palette={palette}
            icon="add"
            label="Zoom+"
            active={activeTool === 'zoom'}
            onPress={handleTool('zoom', handleZoomIn)}
          />
          <ToolButton
            palette={palette}
            icon="trash"
            label="Clear pen"
            active={false}
            onPress={handleClearBrush}
          />
          <ToolButton
            palette={palette}
            icon="filter"
            label="Filter"
            active={
              filterMode !== 'none' || isFilterPickerVisible
            }
            onPress={() =>
              setIsFilterPickerVisible((v: boolean) => !v)
            }
          />
        </View>

        {/* FILTER PREVIEW STRIP */}
        {isFilterPickerVisible && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
              paddingVertical: 8,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8 }}
            >
              {FILTER_PRESETS.map((preset) => {
                const isActive = filterMode === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() =>
                      handleSelectFilter(preset.id)
                    }
                    style={{
                      marginRight: 8,
                      alignItems: 'center',
                      width: 72,
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        overflow: 'hidden',
                        borderWidth: 2,
                        borderColor: isActive
                          ? palette.primary
                          : palette.border,
                      }}
                    >
                      <Image
                        source={{ uri: asset.uri }}
                        style={{
                          width: '100%',
                          height: '100%',
                        }}
                        resizeMode="cover"
                      />
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          ...getPreviewOverlayStyle(
                            preset.id,
                          ),
                        }}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 4,
                        fontSize:
                          KIS_TOKENS.typography.helper,
                        color: isActive
                          ? palette.primary
                          : palette.subtext,
                      }}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* TOOLBAR 3 - CROP */}
        <View
          style={[
            editorStyles.toolsRow,
            {
              borderTopColor: palette.divider,
              backgroundColor:
                palette.chatComposerBg ?? palette.card,
            },
          ]}
        >
          <ToolButton
            palette={palette}
            icon="copy"
            label="Crop"
            active={activeTool === 'crop'}
            onPress={() => {
              setActiveTool('crop');
              if (!cropRect) {
                initCropRect();
              }
            }}
          />
        </View>

        {/* FOOTER */}
        <View
          style={[
            editorStyles.footer,
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
              editorStyles.footerButton,
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

          {/* Save & Finish */}
          <Pressable
            style={[
              editorStyles.footerButton,
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
