// src/screens/calls/components/InCallWhiteboardSheet.tsx
// Collaborative in-call whiteboard.
// Strokes are drawn with react-native-gesture-handler and rendered as SVG paths.
// Each stroke is relayed to all participants via call.wb.stroke socket events.

import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, { Path, Circle } from 'react-native-svg';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { WhiteboardStroke, WhiteboardPoint } from '@/services/calls/callTypes';

type RemoteCursor = { userId: string; x: number; y: number; color: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  strokes: WhiteboardStroke[];
  localUserId: string;
  isHost: boolean;
  onStroke: (stroke: WhiteboardStroke) => void;
  onUndo: (strokeId: string) => void;
  onClear: () => void;
  onCursor?: (x: number, y: number) => void;
  remoteCursors?: RemoteCursor[];
};

const COLORS = ['#ffffff', '#FFD700', '#FF4444', '#44FF88', '#4488FF', '#FF88FF', '#FF8C44', '#000000'];
const WIDTHS = [2, 4, 8, 14];
const USER_PALETTE = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFB347'];

function userColor(userId: string): string {
  const h = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return USER_PALETTE[h % USER_PALETTE.length];
}

function pointsToSvgD(points: WhiteboardPoint[]): string {
  if (points.length < 2) return '';
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    // Smooth quadratic bezier through midpoints
    const px = (points[i - 1].x + points[i].x) / 2;
    const py = (points[i - 1].y + points[i].y) / 2;
    d.push(`Q ${points[i - 1].x} ${points[i - 1].y} ${px} ${py}`);
  }
  d.push(`L ${points[points.length - 1].x} ${points[points.length - 1].y}`);
  return d.join(' ');
}

let _strokeCounter = 0;
function makeStrokeId(userId: string): string {
  return `wb_${userId}_${Date.now()}_${++_strokeCounter}`;
}

export default function InCallWhiteboardSheet({
  visible, onClose, strokes, localUserId, isHost,
  onStroke, onUndo, onClear, onCursor, remoteCursors = [],
}: Props) {
  const { palette } = useKISTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [color, setColor] = useState('#ffffff');
  const [width, setWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  // Current in-progress stroke (local only, not yet committed)
  const activePoints = useRef<WhiteboardPoint[]>([]);
  const [activePath, setActivePath] = useState('');

  // Throttle remote cursor updates
  const lastCursorSend = useRef(0);

  // Remote cursors — updated via DeviceEventEmitter from SocketProvider
  const [liveCursors, setLiveCursors] = useState<RemoteCursor[]>(remoteCursors);

  useEffect(() => {
    if (!visible) return;
    const sub = DeviceEventEmitter.addListener('call.wb.cursor', (data: { userId: string; x: number; y: number }) => {
      setLiveCursors(prev => {
        const existing = prev.find(c => c.userId === data.userId);
        const entry: RemoteCursor = { userId: data.userId, x: data.x, y: data.y, color: userColor(data.userId) };
        if (existing) return prev.map(c => c.userId === data.userId ? entry : c);
        return [...prev, entry];
      });
    });
    return () => sub.remove();
  }, [visible]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin(e => {
      activePoints.current = [{ x: e.x, y: e.y }];
      setActivePath(`M ${e.x} ${e.y}`);
    })
    .onUpdate(e => {
      activePoints.current.push({ x: e.x, y: e.y });
      setActivePath(pointsToSvgD(activePoints.current));
      // Throttled cursor position relay (~20 fps)
      const now = Date.now();
      if (onCursor && now - lastCursorSend.current > 50) {
        lastCursorSend.current = now;
        onCursor(e.x, e.y);
      }
    })
    .onEnd(() => {
      const pts = activePoints.current;
      if (pts.length < 2) { activePoints.current = []; setActivePath(''); return; }
      const stroke: WhiteboardStroke = {
        id: makeStrokeId(localUserId),
        userId: localUserId,
        points: [...pts],
        color: isEraser ? palette.royalInk : color,
        width: isEraser ? 28 : width,
      };
      onStroke(stroke);
      activePoints.current = [];
      setActivePath('');
    });

  const canvasH = screenH * 0.85 - 120; // toolbar + safe area
  const canvasW = screenW;

  const localStrokes = strokes.filter(s => s.userId === localUserId);
  const lastLocalStroke = localStrokes[localStrokes.length - 1] ?? null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: '#1A1A2E' }]}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: `${palette.gold}30` }]}>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close whiteboard">
              <KISIcon name="chevron-down" size={22} color={palette.ivory} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: palette.ivory }]}>Whiteboard</Text>
            <View style={styles.headerRight}>
              {lastLocalStroke && (
                <Pressable
                  onPress={() => onUndo(lastLocalStroke.id)}
                  style={[styles.toolBtn, { borderColor: `${palette.gold}40` }]}
                  hitSlop={8}
                >
                  <KISIcon name="corner-up-left" size={16} color={palette.ivory} />
                </Pressable>
              )}
              {isHost && (
                <Pressable
                  onPress={onClear}
                  style={[styles.toolBtn, { borderColor: `${palette.danger}60` }]}
                  hitSlop={8}
                >
                  <KISIcon name="trash" size={16} color={palette.danger} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Canvas */}
          <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={pan}>
              <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
                <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFill}>
                  {/* Committed strokes */}
                  {strokes.map(s => (
                    <Path
                      key={s.id}
                      d={pointsToSvgD(s.points)}
                      stroke={s.color}
                      strokeWidth={s.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}

                  {/* Active local stroke (in-progress) */}
                  {activePath ? (
                    <Path
                      d={activePath}
                      stroke={isEraser ? '#1A1A2E' : color}
                      strokeWidth={isEraser ? 28 : width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={0.85}
                    />
                  ) : null}

                  {/* Remote cursors — sourced from live DeviceEventEmitter updates */}
                  {liveCursors.map(c => (
                    <Circle
                      key={c.userId}
                      cx={c.x}
                      cy={c.y}
                      r={6}
                      fill={c.color}
                      opacity={0.7}
                    />
                  ))}
                </Svg>

                {/* Grid dots for reference */}
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Svg width={canvasW} height={canvasH}>
                    {Array.from({ length: Math.ceil(canvasH / 40) }).map((_, ri) =>
                      Array.from({ length: Math.ceil(canvasW / 40) }).map((_, ci) => (
                        <Circle
                          key={`${ri}-${ci}`}
                          cx={ci * 40 + 20}
                          cy={ri * 40 + 20}
                          r={1}
                          fill="rgba(255,255,255,0.06)"
                        />
                      ))
                    )}
                  </Svg>
                </View>
              </View>
            </GestureDetector>
          </GestureHandlerRootView>

          {/* Toolbar */}
          <View style={[styles.toolbar, { backgroundColor: `${palette.royalInk}F0`, borderTopColor: `${palette.gold}30` }]}>

            {/* Color picker */}
            <View style={styles.toolRow}>
              {COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => { setColor(c); setIsEraser(false); }}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c, borderColor: color === c && !isEraser ? palette.gold : 'rgba(255,255,255,0.2)' },
                  ]}
                />
              ))}

              {/* Eraser */}
              <Pressable
                onPress={() => setIsEraser(v => !v)}
                style={[
                  styles.toolBtn,
                  { borderColor: isEraser ? palette.gold : 'rgba(255,255,255,0.2)', marginLeft: 8 },
                ]}
              >
                <KISIcon name="eraser" size={16} color={isEraser ? palette.gold : palette.ivory} />
              </Pressable>
            </View>

            {/* Stroke width picker */}
            <View style={styles.toolRow}>
              {WIDTHS.map(w => (
                <Pressable
                  key={w}
                  onPress={() => { setWidth(w); setIsEraser(false); }}
                  style={[
                    styles.widthBtn,
                    { borderColor: width === w && !isEraser ? palette.gold : 'transparent' },
                  ]}
                >
                  <View style={[styles.widthLine, {
                    height: w * 1.5,
                    backgroundColor: width === w && !isEraser ? palette.gold : palette.ivory,
                    opacity: width === w ? 1 : 0.4,
                  }]} />
                </Pressable>
              ))}
            </View>
          </View>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  headerRight: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  canvas: { backgroundColor: '#1A1A2E' },
  toolbar: {
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
  },
  widthBtn: {
    width: 44, height: 36, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  widthLine: { width: '100%', borderRadius: 4 },
});
