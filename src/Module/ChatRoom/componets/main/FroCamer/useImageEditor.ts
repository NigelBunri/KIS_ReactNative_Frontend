// src/screens/chat/components/FroCamer/useImageEditor.ts

import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder } from 'react-native';
import ViewShot from 'react-native-view-shot';
import {
  CropRect,
  UseImageEditorArgs,
  UseImageEditorReturn,
  BrushStroke,
  MosaicBlock,
  TextTag,
  ImageTool,
} from './ImageEditor.types';

const BRUSH_COLOR = '#ffcc00';

// 12 filter options including "none"
export type FilterMode =
  | 'none'
  | 'bw'        // black & white
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

export const useImageEditor = ({
  asset,
}: UseImageEditorArgs): UseImageEditorReturn => {
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [scale, setScale] = useState(1);
  const [filterMode, setFilterMode] = useState<FilterMode>('none');
  const [activeTool, setActiveTool] = useState<ImageTool>('brush');

  // BRUSH
  const [brushSize, setBrushSize] = useState<'small' | 'medium' | 'large'>(
    'medium',
  );
  const brushWidth = brushSize === 'small' ? 2 : brushSize === 'large' ? 8 : 4;
  const [brushStrokes, setBrushStrokes] = useState<BrushStroke[]>([]);

  // MOSAIC (blur)
  const [mosaicBlocks, setMosaicBlocks] = useState<MosaicBlock[]>([]);
  const mosaicDragStart = useRef<
    { id: string; x: number; y: number; size: number } | null
  >(null);

  // TEXT
  const [textTags, setTextTags] = useState<TextTag[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const textDragStart = useRef<{ id: string; x: number; y: number } | null>(
    null,
  );

  // CROP
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const cropLastTouch = useRef<{ x: number; y: number } | null>(null);

  // CAPTURE + GEOMETRY
  const [isCapturing, setIsCapturing] = useState(false);
  const svgSize = useRef({ width: 0, height: 0 });
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const viewShotRef = useRef<ViewShot | null>(null);

  const onOverlayLayout = (e: LayoutChangeEvent) => {
    svgSize.current = {
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    };
  };

  // ---- CROP HELPERS ----
  const createInitialCropRect = (): CropRect | null => {
    const { width, height } = svgSize.current;
    if (!width || !height) return null;
    const w = width * 0.7;
    const h = height * 0.7;
    return {
      x: (width - w) / 2,
      y: (height - h) / 2,
      width: w,
      height: h,
    };
  };

  const initCropRect = () => {
    const rect = createInitialCropRect();
    if (rect) setCropRect(rect);
  };

  const clampCropRectToBounds = (rect: CropRect): CropRect => {
    const { width: vw, height: vh } = svgSize.current;
    let { x, y, width, height } = rect;

    if (vw && width > vw) width = vw;
    if (vh && height > vh) height = vh;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (vw && x + width > vw) x = vw - width;
    if (vh && y + height > vh) y = vh - height;

    return { x, y, width, height };
  };

  const clampMosaicToBounds = (block: MosaicBlock): MosaicBlock => {
    const { width, height } = svgSize.current;
    let { x, y, size } = block;

    if (width) {
      if (x < 0) x = 0;
      if (x + size > width) x = width - size;
    }
    if (height) {
      if (y < 0) y = 0;
      if (y + size > height) y = height - size;
    }

    return { ...block, x, y };
  };

  // ---- IMAGE TRANSFORMS ----
  const handleRotateLeft = () => {
    setRotation((r) => (r - 90 + 360) % 360);
  };

  const handleRotateRight = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleFlipHorizontal = () => setFlipH((f) => !f);
  const handleFlipVertical = () => setFlipV((f) => !f);
  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.25));

  // ---- MOSAIC ----
  const handleAddMosaicBlock = () => {
    const { width, height } = svgSize.current;
    const size = Math.min(width || 0, height || 0) / 6 || 40;
    setMosaicBlocks((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        x: (width - size) / 2,
        y: (height - size) / 2,
        size,
      },
    ]);
  };

  // ---- BRUSH ----
  const handleClearBrush = () => setBrushStrokes([]);

  // ---- TEXT ----
  const handleAddTextTag = () => {
    const { width, height } = svgSize.current;
    const centerX = width ? width / 2 : 100;
    const centerY = height ? height / 2 : 100;

    const id = `${Date.now()}`;
    const newTag: TextTag = {
      id,
      text: 'Edit text',
      x: centerX - 40,
      y: centerY,
      color: '#ffffff',
      fontSize: 18,
      fontWeight: 'bold',
    };

    setTextTags((prev) => [...prev, newTag]);
    setActiveTextId(id);
  };

  const updateActiveTextTag: UseImageEditorReturn['updateActiveTextTag'] = (
    patch,
  ) => {
    if (!activeTextId) return;
    setTextTags((prev) =>
      prev.map((tag) =>
        tag.id === activeTextId ? { ...tag, ...patch } : tag,
      ),
    );
  };

  // ---- RESET ----
  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setScale(1);
    setFilterMode('none');
    setBrushStrokes([]);
    setMosaicBlocks([]);
    setTextTags([]);
    setActiveTextId(null);
    setCropRect(null);
  };

  // ---- PAN RESPONDER ----
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          activeTool === 'brush' ||
          activeTool === 'mosaic' ||
          activeTool === 'crop' ||
          activeTool === 'text',
        onMoveShouldSetPanResponder: () =>
          activeTool === 'brush' ||
          activeTool === 'mosaic' ||
          activeTool === 'crop' ||
          activeTool === 'text',

        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;

          if (activeTool === 'brush') {
            const newPath = `M ${locationX} ${locationY}`;
            setCurrentPath(newPath);
            setBrushStrokes((prev) => [
              ...prev,
              {
                id: `${Date.now()}`,
                color: BRUSH_COLOR,
                width: brushWidth,
                d: newPath,
              },
            ]);
          } else if (activeTool === 'mosaic') {
            setMosaicBlocks((prev) => {
              if (!prev.length) return prev;
              const last = prev[prev.length - 1];
              mosaicDragStart.current = {
                id: last.id,
                x: last.x,
                y: last.y,
                size: last.size,
              };
              return prev;
            });
          } else if (activeTool === 'crop') {
            if (!cropRect) {
              const initial = createInitialCropRect();
              if (!initial) return;
              setCropRect(initial);
            }
            cropLastTouch.current = { x: locationX, y: locationY };
          } else if (activeTool === 'text') {
            const id =
              activeTextId ||
              (textTags.length ? textTags[textTags.length - 1].id : null);
            if (!id) return;
            const tag = textTags.find((t) => t.id === id);
            if (!tag) return;
            textDragStart.current = { id: tag.id, x: tag.x, y: tag.y };
            setActiveTextId(tag.id);
          }
        },

        onPanResponderMove: (evt, gestureState) => {
          const { locationX, locationY } = evt.nativeEvent;
          const { dx, dy } = gestureState;

          if (activeTool === 'brush') {
            if (currentPath == null) return;
            const updated = `${currentPath} L ${locationX} ${locationY}`;
            setCurrentPath(updated);
            setBrushStrokes((prev) => {
              if (!prev.length) return prev;
              const last = prev[prev.length - 1];
              const others = prev.slice(0, -1);
              return [...others, { ...last, d: updated }];
            });
            return;
          }

          if (activeTool === 'mosaic') {
            if (!mosaicDragStart.current) return;
            const start = mosaicDragStart.current;

            setMosaicBlocks((prev) =>
              prev.map((block) => {
                if (block.id !== start.id) return block;
                const moved: MosaicBlock = {
                  ...block,
                  x: start.x + dx,
                  y: start.y + dy,
                };
                return clampMosaicToBounds(moved);
              }),
            );
            return;
          }

          if (activeTool === 'crop') {
            if (!cropRect) return;

            if (!cropLastTouch.current) {
              cropLastTouch.current = { x: locationX, y: locationY };
              return;
            }

            const { x: lastX, y: lastY } = cropLastTouch.current;
            const deltaX = locationX - lastX;
            const deltaY = locationY - lastY;

            if (!deltaX && !deltaY) return;

            setCropRect((prev) => {
              if (!prev) return prev;
              const moved: CropRect = {
                ...prev,
                x: prev.x + deltaX,
                y: prev.y + deltaY,
              };
              return clampCropRectToBounds(moved);
            });

            cropLastTouch.current = { x: locationX, y: locationY };
            return;
          }

          if (activeTool === 'text') {
            if (!textDragStart.current) return;
            const start = textDragStart.current;

            setTextTags((prev) =>
              prev.map((tag) =>
                tag.id === start.id
                  ? {
                      ...tag,
                      x: tag.x + dx,
                      y: tag.y + dy,
                    }
                  : tag,
              ),
            );
          }
        },

        onPanResponderRelease: () => {
          setCurrentPath(null);
          mosaicDragStart.current = null;
          cropLastTouch.current = null;
          textDragStart.current = null;
        },
      }),
    [
      activeTool,
      brushWidth,
      cropRect,
      currentPath,
      textTags,
      activeTextId,
    ],
  );

  // ---- FILTER OVERLAY STYLE (optional, used for previews only) ----
  const filterOverlayStyle = useMemo(() => {
    switch (filterMode) {
      case 'warm':
        return { backgroundColor: 'rgba(255,165,0,0.2)' };
      case 'cool':
        return { backgroundColor: 'rgba(64,160,255,0.2)' };
      case 'night':
        return { backgroundColor: 'rgba(10,20,60,0.25)' };
      case 'soft':
        return { backgroundColor: 'rgba(255,192,203,0.2)' };
      default:
        return null; // real filters are applied in EditorCanvas
    }
  }, [filterMode]);

  // ---- CAPTURE EDITED IMAGE ----
  const buildEditedAsset = async () => {
    const capture = (viewShotRef.current as any)?.capture;
    if (typeof capture !== 'function') {
      return asset;
    }

    const { width, height } = svgSize.current;
    try {
      let uri: string | undefined;

      if (cropRect) {
        setIsCapturing(true);
        await new Promise((resolve) => setTimeout(resolve, 50));
        uri = await capture({
          format: 'jpg',
          quality: 0.9,
          width: cropRect.width,
          height: cropRect.height,
        });
        setIsCapturing(false);
      } else {
        uri = await capture({
          format: 'jpg',
          quality: 0.9,
          width: width || undefined,
          height: height || undefined,
        });
      }

      if (!uri) return asset;

      return {
        ...asset,
        uri,
        fileName: `edited-${asset.fileName || 'image'}.jpg`,
        type: 'image/jpeg',
      };
    } catch (e) {
      console.warn('[ImageEditor] Failed to capture edited image', e);
      setIsCapturing(false);
      return asset;
    }
  };

  return {
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
    filterOverlayStyle,
    panHandlers: panResponder.panHandlers,
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
  };
};
