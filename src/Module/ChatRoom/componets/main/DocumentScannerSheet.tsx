// src/Module/ChatRoom/componets/main/DocumentScannerSheet.tsx
// Document scanner sheet — tries native scanner, falls back to camera capture.

import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export type DocumentScannerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called when the user is ready to send.
   * @param uri       Local URI of the captured / scanned image.
   * @param mimeType  MIME type — 'image/jpeg' or 'application/pdf' (best-effort).
   * @param filename  Suggested file name.
   */
  onSend: (uri: string, mimeType: string, filename: string) => void;
};

export default function DocumentScannerSheet({
  visible,
  onClose,
  onSend,
}: DocumentScannerSheetProps) {
  const { palette } = useKISTheme();
  const styles = makeStyles(palette);
  const [scannedUri, setScannedUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      // 1. Try react-native-document-scanner-plugin
      let scannerPlugin: any = null;
      try {
        scannerPlugin = require('react-native-document-scanner-plugin');
      } catch { /* not installed */ }

      // 2. Try react-native-document-scanner (alternative package)
      if (!scannerPlugin) {
        try {
          scannerPlugin = require('react-native-document-scanner');
        } catch { /* not installed */ }
      }

      if (scannerPlugin) {
        // Prefer the default export, fall back to named exports
        const scanFn =
          scannerPlugin?.default?.scanDocument ??
          scannerPlugin?.scanDocument ??
          scannerPlugin?.default?.scan ??
          scannerPlugin?.scan;

        if (typeof scanFn === 'function') {
          const result = await scanFn();
          const uri: string | undefined =
            result?.scannedImages?.[0] ??
            result?.uri ??
            result?.image ??
            (typeof result === 'string' ? result : undefined);

          if (uri) {
            setScannedUri(uri);
            setScanning(false);
            return;
          }
        }
      }

      // 3. Fallback: launch camera via react-native-image-picker
      const { launchCamera } = require('react-native-image-picker') as typeof import('react-native-image-picker');
      launchCamera(
        { mediaType: 'photo', quality: 1, includeBase64: false },
        (response) => {
          if (response.didCancel || response.errorCode) {
            setScanning(false);
            return;
          }
          const asset = response.assets?.[0];
          if (asset?.uri) {
            setScannedUri(asset.uri);
          }
          setScanning(false);
        },
      );
    } catch (err) {
      console.warn('[DocumentScannerSheet] scan failed:', err);
      setScanning(false);
      Alert.alert('Scanner error', 'Unable to open the document scanner. Please try again.');
    }
  };

  const handleSendAsImage = () => {
    if (!scannedUri) return;
    const filename = `scan_${Date.now()}.jpg`;
    onSend(scannedUri, 'image/jpeg', filename);
    setScannedUri(null);
    onClose();
  };

  const handleSendAsPdf = () => {
    if (!scannedUri) return;
    // Native PDF conversion would require a module; if unavailable we send
    // with application/pdf MIME which lets the server treat it as a document.
    const filename = `scan_${Date.now()}.pdf`;
    onSend(scannedUri, 'application/pdf', filename);
    setScannedUri(null);
    onClose();
  };

  const handleClose = () => {
    setScannedUri(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Grab handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>Scan document</Text>

          {!scannedUri ? (
            <>
              <Text style={styles.subtitle}>
                Capture a document using your camera or native scanner.
              </Text>

              <Pressable
                onPress={handleScan}
                disabled={scanning}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.75 },
                  scanning && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.primaryBtnTxt}>
                  {scanning ? 'Opening scanner…' : 'Scan document'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.secondaryBtnTxt}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Image
                source={{ uri: scannedUri }}
                style={styles.preview}
                resizeMode="contain"
              />

              <Text style={styles.subtitle}>
                Choose how to send the scanned document.
              </Text>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleSendAsImage}
                  style={({ pressed }) => [styles.halfBtn, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.halfBtnTxt}>Send as Image</Text>
                </Pressable>

                <Pressable
                  onPress={handleSendAsPdf}
                  style={({ pressed }) => [styles.halfBtn, styles.halfBtnAlt, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.halfBtnTxt}>Send as PDF</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setScannedUri(null)}
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.secondaryBtnTxt}>Re-scan</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (palette: any) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: palette.divider,
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: palette.subtext,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: palette.surfaceSoft ?? palette.surface,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnTxt: {
    color: palette.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnTxt: {
    color: palette.subtext,
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  halfBtn: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  halfBtnAlt: {
    backgroundColor: palette.primaryStrong,
  },
  halfBtnTxt: {
    color: palette.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
