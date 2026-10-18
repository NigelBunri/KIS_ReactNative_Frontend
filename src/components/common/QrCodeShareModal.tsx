// src/components/common/QrCodeShareModal.tsx
// Shared "Download QR" sheet for every invite-link surface in the app
// (calls, groups, communities, broadcast-studio guest invites, contact
// links) — generates a real PNG of the link's QR code (with the KIS logo
// centered on it, still scannable via a high error-correction level) that
// the user can save to their Photos or push through the native share sheet.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

// @react-native-camera-roll/camera-roll is a native module — this file is
// reached from InviteLinkCard.tsx -> ActiveCallScreen.tsx ->
// SocketProvider.tsx, which is mounted near the app root and imported by
// nearly every screen. A plain top-level `import` throws synchronously
// the moment the native binary hasn't been rebuilt with this (newly added)
// dependency's native code yet — turning "Download hasn't been rebuilt
// into this binary" into "the whole app won't boot" for anyone on a build
// that's one native rebuild behind the JS bundle. Guarded require, same
// pattern already used for other optional native modules in this codebase
// (see CaptionOverlay.tsx's Voice import), keeps every other part of this
// screen (viewing/sharing the QR) working even when this one is missing.
let CameraRoll: typeof import('@react-native-camera-roll/camera-roll').CameraRoll | null = null;
try {
  CameraRoll = require('@react-native-camera-roll/camera-roll').CameraRoll;
} catch {}

export type QrCodeShareModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The invite/join URL to encode. */
  link: string;
  /** Sheet title, e.g. "Call QR code" / "Group QR code". */
  title?: string;
  subtitle?: string;
};

const QR_SIZE = 240;
const LOGO_SIZE = 56;

// Fixed white/black regardless of app theme — a QR code's scan reliability
// depends on real contrast, not on matching dark/light mode.
const QR_BG = '#FFFFFF';
const QR_FG = '#000000';

async function ensureAndroidSavePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export default function QrCodeShareModal({
  visible,
  onClose,
  link,
  title = 'QR code',
  subtitle = 'Anyone who scans this can open the link.',
}: QrCodeShareModalProps) {
  const { palette } = useKISTheme();
  const viewShotRef = useRef<any>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const generate = useCallback(async () => {
    setError(false);
    setFileUri(null);
    // The QRCode SVG (and the logo Image composited inside it) needs at
    // least one real paint before captureRef has anything to actually
    // capture — calling capture() on the same frame the modal mounts
    // reliably grabbed a blank or half-drawn frame in testing.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    await new Promise((resolve) => setTimeout(resolve, 120));
    try {
      const uri: string | undefined = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('capture returned nothing');
      setFileUri(uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // Some callers open this modal before their link has finished
    // resolving (e.g. a channel's share URL needs a network fetch) —
    // `link` is in this effect's own deps so that arriving late still
    // triggers a real capture instead of the capture running once, immediately,
    // against an empty string. While visible && !link, the "not ready"
    // spinner overlay just keeps showing (fileUri stays null) rather than
    // generating a QR code for a blank value.
    if (visible && link) {
      void generate();
    } else if (!visible) {
      setFileUri(null);
      setError(false);
    }
  }, [visible, link, generate]);

  const ready = !!fileUri && !error;

  const handleDownload = async () => {
    if (!fileUri || saving) return;
    if (!CameraRoll) {
      // Native module not linked into this binary yet (see the guarded
      // require above) — Share still works, so point there instead of
      // failing silently.
      Alert.alert('Download unavailable', 'Please use Share and save the image from there for now.');
      return;
    }
    setSaving(true);
    try {
      const allowed = await ensureAndroidSavePermission();
      if (!allowed) {
        Alert.alert('Permission needed', 'Allow photo library access to save the QR code.');
        return;
      }
      await CameraRoll.saveAsset(fileUri, { type: 'photo', album: 'KIS' });
      Alert.alert('Saved', 'The QR code has been saved to your Photos.');
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!fileUri || sharing) return;
    setSharing(true);
    try {
      await Share.share({ url: fileUri, message: link });
    } catch {
      // User cancel or share-sheet error — nothing actionable to show.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.card }]}>
        <SafeAreaView edges={['bottom']}>
          <View style={[styles.handle, { backgroundColor: palette.inputBorder }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>

          {subtitle ? <Text style={[styles.subtitle, { color: palette.subtext }]}>{subtitle}</Text> : null}

          <View style={styles.qrWrap}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1 }}
              style={[styles.qrCapture, { backgroundColor: QR_BG }]}
            >
              <QRCode
                value={link || ' '}
                size={QR_SIZE}
                color={QR_FG}
                backgroundColor={QR_BG}
                ecl="H"
                logo={require('@/assets/qr-logo.png')}
                logoSize={LOGO_SIZE}
                logoBackgroundColor={QR_BG}
                logoBorderRadius={10}
                logoMargin={4}
              />
            </ViewShot>
            {!ready && (
              <View style={styles.qrOverlay}>
                {error ? (
                  <KISIcon name="close-circle" size={28} color={palette.danger} />
                ) : (
                  <ActivityIndicator color={palette.primary} />
                )}
              </View>
            )}
          </View>

          {error ? (
            <Pressable
              onPress={generate}
              style={[styles.retryBtn, { borderColor: palette.inputBorder }]}
              accessibilityRole="button"
              accessibilityLabel="Try generating the QR code again"
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>Try again</Text>
            </Pressable>
          ) : (
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleDownload}
                disabled={!ready || saving}
                accessibilityRole="button"
                accessibilityLabel="Download QR code"
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: `${palette.gold}1A`, borderColor: `${palette.gold}60`, opacity: ready ? 1 : 0.5 },
                  pressed && ready && { opacity: 0.75 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={palette.gold} />
                ) : (
                  <KISIcon name="download" size={18} color={palette.gold} />
                )}
                <Text style={[styles.actionText, { color: palette.gold }]}>
                  {saving ? 'Saving…' : 'Download'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShare}
                disabled={!ready || sharing}
                accessibilityRole="button"
                accessibilityLabel="Share QR code"
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: `${palette.primary}1A`, borderColor: `${palette.primary}60`, opacity: ready ? 1 : 0.5 },
                  pressed && ready && { opacity: 0.75 },
                ]}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <KISIcon name="share" size={18} color={palette.primary} />
                )}
                <Text style={[styles.actionText, { color: palette.primary }]}>
                  {sharing ? 'Sharing…' : 'Share'}
                </Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 13, marginBottom: 18 },
  qrWrap: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  qrCapture: {
    padding: 16,
    borderRadius: 20,
  },
  qrOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
  },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 13,
  },
  actionText: { fontSize: 14, fontWeight: '800' },
  retryBtn: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 16,
  },
});
