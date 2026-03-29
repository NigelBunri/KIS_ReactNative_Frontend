// src/screens/chat/components/FroCamer/EditorCanvas.tsx

import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  ViewStyle,
  LayoutChangeEvent,
  ImageStyle,
} from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { Asset as ImagePickerAsset } from 'react-native-image-picker';
import { KISPalette, kisRadius } from '@/theme/constants';
import {
  BrushStroke,
  MosaicBlock,
  TextTag,
  CropRect,
  ImageTool,
  FilterMode,
} from './ImageEditor.types';
import { editorStyles } from './ImageEditor.styles';

type Props = {
  asset: ImagePickerAsset;
  palette: KISPalette;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  scale: number;
  brushStrokes: BrushStroke[];
  mosaicBlocks: MosaicBlock[];
  textTags: TextTag[];
  cropRect: CropRect | null;
  isCapturing: boolean;
  activeTool: ImageTool;
  onOverlayLayout: (e: LayoutChangeEvent) => void;
  panHandlers: any;
  viewShotRef: React.MutableRefObject<ViewShot | null>;
  filterMode: FilterMode;
};

// 🔥 FULLSCREEN IMAGE STYLE — fills entire editor area
const fullscreenImageStyle: ImageStyle = {
  width: '100%',
  height: '100%',
  resizeMode: 'cover', // <— FULLSCREEN
  borderRadius: kisRadius.lg,
};

// map filterMode to overlay color
const getFilterOverlayForMode = (mode: FilterMode): ViewStyle | null => {
  switch (mode) {
    case 'bw':
      return { backgroundColor: 'rgba(0,0,0,0.35)' };
    case 'sepia':
      return { backgroundColor: 'rgba(112,66,20,0.35)' };
    case 'cool':
      return { backgroundColor: 'rgba(0,102,204,0.30)' };
    case 'warm':
      return { backgroundColor: 'rgba(255,140,0,0.30)' };
    case 'vivid':
      return { backgroundColor: 'rgba(255,255,0,0.20)' };
    case 'faded':
      return { backgroundColor: 'rgba(255,255,255,0.30)' };
    case 'contrast':
      return { backgroundColor: 'rgba(0,0,0,0.20)' };
    case 'invert':
      return { backgroundColor: 'rgba(255,255,255,0.10)' };
    case 'night':
      return { backgroundColor: 'rgba(10,20,60,0.45)' };
    case 'soft':
      return { backgroundColor: 'rgba(255,182,193,0.30)' };
    case 'vintage':
      return { backgroundColor: 'rgba(205,133,63,0.30)' };
    default:
    case 'none':
      return null;
  }
};

export const EditorCanvas: React.FC<Props> = ({
  asset,
  rotation,
  flipH,
  flipV,
  scale,
  brushStrokes,
  mosaicBlocks,
  textTags,
  cropRect,
  isCapturing,
  activeTool,
  onOverlayLayout,
  panHandlers,
  viewShotRef,
  filterMode,
}) => {
  // transforms that apply to the image
  const transformStyle: ImageStyle = {
    transform: [
      { rotate: `${rotation}deg` },
      { scaleX: flipH ? -scale : scale },
      { scaleY: flipV ? -scale : scale },
    ],
  };

  const overlayStyle = getFilterOverlayForMode(filterMode);

  return (
    <View style={editorStyles.mediaWrapper}>
      <ViewShot
        ref={(ref) => {
          viewShotRef.current = ref;
        }}
        style={[
          editorStyles.mediaInner,
          isCapturing && cropRect
            ? {
                width: cropRect.width,
                height: cropRect.height,
                alignSelf: 'flex-start',
              }
            : null,
        ]}
      >
        <View
          style={[
            editorStyles.mediaContent,
            isCapturing && cropRect
              ? {
                  transform: [
                    { translateX: -cropRect.x },
                    { translateY: -cropRect.y },
                  ],
                }
              : null,
          ]}
        >

          {/* 🔥 BASE IMAGE — fullscreen cover */}
          <Image
            source={{ uri: asset.uri }}
            style={[fullscreenImageStyle, transformStyle]}
          />

          {/* FILTER OVERLAY */}
          {overlayStyle && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                overlayStyle,
                { borderRadius: kisRadius.lg },
              ]}
            />
          )}

          {/* DRAW + MOSAIC + TEXT */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {brushStrokes.map((stroke) => (
                <Path
                  key={stroke.id}
                  d={stroke.d}
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}

              {mosaicBlocks.map((block) => (
                <Rect
                  key={block.id}
                  x={block.x}
                  y={block.y}
                  width={block.size}
                  height={block.size}
                  fill="#000"
                  opacity={1}
                  rx={8}
                  ry={8}
                />
              ))}

              {textTags.map((tag) => (
                <SvgText
                  key={tag.id}
                  x={tag.x}
                  y={tag.y}
                  fill={tag.color}
                  fontSize={tag.fontSize}
                  fontWeight={tag.fontWeight}
                  stroke="#000"
                  strokeWidth={0.6}
                >
                  {tag.text}
                </SvgText>
              ))}
            </Svg>
          </View>
        </View>
      </ViewShot>

      {/* TOUCH OVERLAY / CROP GUIDE */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-only"
        onLayout={onOverlayLayout}
        {...panHandlers}
      >
        {activeTool === 'crop' && cropRect && !isCapturing && (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Rect
              x={cropRect.x}
              y={cropRect.y}
              width={cropRect.width}
              height={cropRect.height}
              stroke="#fff"
              strokeWidth={2}
              fill="rgba(0,0,0,0.15)"
              strokeDasharray="6 4"
              rx={8}
              ry={8}
            />
          </Svg>
        )}
      </View>
    </View>
  );
};
