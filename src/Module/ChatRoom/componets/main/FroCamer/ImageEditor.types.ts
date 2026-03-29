// src/screens/chat/components/FroCamer/ImageEditor.types.ts

import { LayoutChangeEvent, ViewStyle } from 'react-native';
import { Asset as ImagePickerAsset } from 'react-native-image-picker';
import ViewShot from 'react-native-view-shot';
import { KISPalette } from '@/theme/constants';

export type ImageEditorProps = {
  visible: boolean;
  asset: ImagePickerAsset;
  index: number;
  total: number;
  palette: KISPalette;

  onClose: () => void;

  /** Called when internal editor wants to update one item */
  onSaveAsset: (index: number, asset: ImagePickerAsset) => void;

  onGoPrev: () => void;
  onGoNext: () => void;

  /**
   * ⬅️ UPDATED
   * Called when user taps "Save & Next" (now equivalent to save & return).
   * ImageEditor must return the edited asset + index so MediaEditModal
   * can merge edits and return the updated array back to CameraCaptureModal.
   */
  onDoneAll: (index: number, updated: ImagePickerAsset) => void;
};

export type BrushStroke = {
  id: string;
  color: string;
  width: number;
  d: string;
};

export type MosaicBlock = {
  id: string;
  x: number;
  y: number;
  size: number;
};

export type TextTag = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageTool =
  | 'brush'
  | 'mosaic'
  | 'rotate'
  | 'flipH'
  | 'flipV'
  | 'zoom'
  | 'filter'
  | 'text'
  | 'crop';

export type CropDragMode =
  | 'move'
  | 'resizeTL'
  | 'resizeTR'
  | 'resizeBL'
  | 'resizeBR'
  | 'resizeL'
  | 'resizeR'
  | 'resizeT'
  | 'resizeB';

export type FilterMode =
  | 'none'
  | 'bw'
  | 'sepia'
  | 'cool'
  | 'warm'
  | 'vivid'
  | 'faded'
  | 'contrast'
  | 'invert'
  | 'night'
  | 'soft'
  | 'vintage';

export type UseImageEditorArgs = {
  asset: ImagePickerAsset;
};

export type UseImageEditorReturn = {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  scale: number;

  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;

  activeTool: ImageTool;
  setActiveTool: (tool: ImageTool) => void;

  brushSize: 'small' | 'medium' | 'large';
  setBrushSize: (size: 'small' | 'medium' | 'large') => void;
  brushWidth: number;
  brushStrokes: BrushStroke[];

  mosaicBlocks: MosaicBlock[];

  textTags: TextTag[];
  activeTextId: string | null;
  updateActiveTextTag: (patch: Partial<TextTag>) => void;

  cropRect: CropRect | null;
  isCapturing: boolean;
  viewShotRef: React.MutableRefObject<ViewShot | null>;
  filterOverlayStyle: ViewStyle | null;
  panHandlers: any;
  onOverlayLayout: (e: LayoutChangeEvent) => void;

  handleRotateLeft: () => void;
  handleRotateRight: () => void;
  handleFlipHorizontal: () => void;
  handleFlipVertical: () => void;
  handleZoomIn: () => void;
  handleAddMosaicBlock: () => void;
  handleClearBrush: () => void;
  handleAddTextTag: () => void;
  handleReset: () => void;

  buildEditedAsset: () => Promise<ImagePickerAsset>;
  initCropRect: () => void;
};
