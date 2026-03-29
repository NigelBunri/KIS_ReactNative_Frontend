// src/screens/chat/components/StickerBackgroundRemovalScreen.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import RNFS from 'react-native-fs';
import { KISIcon } from '@/constants/kisIcons';
import { BG_REMOVAL_START_URL, BG_REMOVAL_STATUS_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type StickerBackgroundRemovalScreenProps = {
  palette: any;
  /** original image URI (file://, content://, etc.) */
  originalUri: string;
  /** optional base64 of the original image (kept for compatibility, not used here) */
  originalBase64?: string | null;
  /** Called when the user confirms the chosen image */
  onDone: (newUri: string, meta: { bgRemoved: boolean }) => void;
  /** Called when user cancels / closes this screen */
  onCancel: () => void;
};

// Folder where we store sticker PNG files (same as StickerEditor)
const STICKER_DIR = `${RNFS.DocumentDirectoryPath}/stickers`;

type JobStatus = 'IDLE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

// how often to poll the backend (ms)
const POLL_INTERVAL_MS = 15000;

export const StickerBackgroundRemovalScreen: React.FC<
  StickerBackgroundRemovalScreenProps
> = ({ palette, originalUri, originalBase64: _originalBase64, onDone, onCancel }) => {
  const [workingUri, setWorkingUri] = useState<string>(originalUri);
  const [isProcessing, setIsProcessing] = useState(false);
  const [_jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  /* ------------------------------------------------------------- */
  /*                         RESET JOB STATE                       */
  /* ------------------------------------------------------------- */

  const resetJobState = useCallback(() => {
    console.log('[BGRemoval] resetJobState()');
    setJobId(null);
    setJobStatus('IDLE');
    setErrorMessage(null);
    setHasResult(false);
    setIsProcessing(false);
  }, []);

  /* ------------------------------------------------------------- */
  /*                     LIFECYCLE CLEAN-UP                        */
  /* ------------------------------------------------------------- */

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[BGRemoval] stopPolling() – clearing interval');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  /* ------------------------------------------------------------- */
  /*                      HELPER: ENSURE DIR                       */
  /* ------------------------------------------------------------- */

  const ensureStickerDir = useCallback(async () => {
    try {
      const exists = await RNFS.exists(STICKER_DIR);
      if (!exists) {
        await RNFS.mkdir(STICKER_DIR);
      }
    } catch (err) {
      console.warn('[BGRemoval] Failed to ensure sticker directory', err);
    }
  }, []);

  /* ------------------------------------------------------------- */
  /*               SINGLE POLL JOB STATUS (getRequest)            */
  /* ------------------------------------------------------------- */

  const pollJobStatusOnce = useCallback(
    async (id: string) => {
      if (!isMountedRef.current) return;

      const statusUrl = BG_REMOVAL_STATUS_URL(id);
      console.log('[BGRemoval] Polling job status for id:', id);
      console.log('[BGRemoval] Polling job status at:', statusUrl);

      const result = await getRequest(statusUrl);

      if (!isMountedRef.current) return;

      console.log('[BGRemoval] status GET result for id:', id, result);

      if (!result.success) {
        console.warn(
          '[BGRemoval] Job status non-OK:',
          result.status,
          result.data,
        );
        setIsProcessing(false);
        setJobStatus('FAILED');
        setErrorMessage(result.message || 'Failed to check job status.');
        stopPolling();
        Alert.alert(
          'Background removal failed',
          result.message || 'Failed to check job status.',
        );
        return;
      }

      const data = result.data || {};
      const statusFromServer = (data.status as JobStatus) || 'PENDING';

      console.log('[BGRemoval] Job status result:', data);
      setJobStatus(statusFromServer);

      if (statusFromServer === 'DONE') {
        const processedUrl: string | undefined = data.processed_file_url;
        if (!processedUrl) {
          console.warn(
            '[BGRemoval] Job DONE but no processed_file_url',
            data,
          );
          setIsProcessing(false);
          setHasResult(false);
          stopPolling();
          Alert.alert(
            'Background removal failed',
            'Processing completed but no image was returned.',
          );
          return;
        }

        // Download result to local stickers folder
        await ensureStickerDir();
        const outPath = `${STICKER_DIR}/bgremoved-${Date.now()}.png`;

        try {
          const dlRes = await RNFS.downloadFile({
            fromUrl: processedUrl,
            toFile: outPath,
          }).promise;

          if (dlRes.statusCode && dlRes.statusCode >= 400) {
            console.warn(
              '[BGRemoval] Download failed with status',
              dlRes.statusCode,
            );
            setIsProcessing(false);
            setHasResult(false);
            stopPolling();
            Alert.alert(
              'Background removal failed',
              'Could not download the processed image.',
            );
            return;
          }

          const fileUri = `file://${outPath}`;
          setWorkingUri(fileUri);
          setHasResult(true);
          setIsProcessing(false);
          stopPolling();
          return;
        } catch (downloadErr) {
          console.warn(
            '[BGRemoval] Error downloading processed image',
            downloadErr,
          );
          setIsProcessing(false);
          setHasResult(false);
          stopPolling();
          Alert.alert(
            'Background removal failed',
            'An error occurred while downloading the processed image.',
          );
          return;
        }
      }

      if (statusFromServer === 'FAILED') {
        setIsProcessing(false);
        setHasResult(false);
        setErrorMessage(data.error_message || 'Processing failed.');
        stopPolling();
        Alert.alert(
          'Background removal failed',
          data.error_message || 'The server could not process this image.',
        );
        return;
      }

      // If PENDING/PROCESSING: do nothing now.
      // The next poll will run automatically from setInterval.
    },
    [ensureStickerDir, stopPolling],
  );

  /* ------------------------------------------------------------- */
  /*              START POLLING LOOP (every 15 seconds)            */
  /* ------------------------------------------------------------- */

  const startPollingLoop = useCallback(
    (id: string) => {
      console.log('[BGRemoval] startPollingLoop() for id:', id);

      // clear any existing polling
      stopPolling();

      // run once immediately so user doesn't always wait full 15s for first update
      pollJobStatusOnce(id).catch(err => {
        console.warn('[BGRemoval] Error on initial poll:', err);
      });

      // schedule interval polls
      pollingIntervalRef.current = setInterval(() => {
        pollJobStatusOnce(id).catch(err => {
          console.warn('[BGRemoval] Error on interval poll:', err);
        });
      }, POLL_INTERVAL_MS);
    },
    [pollJobStatusOnce, stopPolling],
  );

  /* ------------------------------------------------------------- */
  /*                 HELPER: START BG REMOVAL JOB                  */
  /* ------------------------------------------------------------- */

  const startBackgroundRemovalJob = useCallback(async () => {
    if (!BG_REMOVAL_START_URL || !BG_REMOVAL_STATUS_URL('test-id')) {
      Alert.alert(
        'Background removal not available',
        'This feature is not configured yet. Please set BG_REMOVAL_* URLs in the app.',
      );
      return;
    }

    if (!originalUri.startsWith('file://')) {
      console.warn(
        '[BGRemoval] Expected file:// URI. You may need to copy to a temp file first.',
      );
    }

    // 🔥 Reset any previous job before starting a new one
    console.log('[BGRemoval] startBackgroundRemovalJob() – new run');
    stopPolling();
    resetJobState();

    try {
      setIsProcessing(true);
      setJobStatus('PENDING');

      // Build multipart/form-data for the image upload.
      const formData = new FormData();
      formData.append('image', {
        uri: originalUri,
        name: 'sticker.png', // or derive from originalUri
        type: 'image/png',   // or 'image/jpeg'
      } as any);

      // Use postRequest – it supports FormData now.
      const result = await postRequest(BG_REMOVAL_START_URL, formData, {
        errorMessage: 'Background removal failed to start.',
      });

      console.log('[BGRemoval] start job result:', result);

      if (!result.success) {
        console.warn(
          '[BGRemoval] Start job API non-OK:',
          result.status,
          result.data,
        );
        setIsProcessing(false);
        setJobStatus('FAILED');
        Alert.alert(
          'Background removal failed to start',
          result.message || 'The server could not start processing this image.',
        );
        return;
      }

      const json = result.data || {};
      const returnedJobId: string | undefined = json.job_id;

      console.log('[BGRemoval] Got job_id from backend:', returnedJobId);

      if (!returnedJobId) {
        console.warn('[BGRemoval] Start job API did not return job_id', json);
        setIsProcessing(false);
        setJobStatus('FAILED');
        Alert.alert(
          'Background removal failed',
          'The server did not return a job ID.',
        );
        return;
      }

      // 🔥 Save only this new id
      setJobId(returnedJobId);
      const backendStatus = (json.status as JobStatus) || 'PENDING';
      setJobStatus(backendStatus);

      // Begin polling job status every 15 seconds with THIS id
      startPollingLoop(returnedJobId);
    } catch (err: any) {
      console.warn('[BGRemoval] Error starting background removal job', err);
      setIsProcessing(false);
      setJobStatus('FAILED');
      stopPolling();
      Alert.alert(
        'Background removal failed',
        err?.message ||
          'An unexpected error occurred while starting the job.',
      );
    }
  }, [originalUri, resetJobState, startPollingLoop, stopPolling]);

  /* ------------------------------------------------------------- */
  /*                             UI                                */
  /* ------------------------------------------------------------- */

  const handleConfirm = () => {
    onDone(workingUri, { bgRemoved: hasResult });
  };

  const handleUseOriginal = () => {
    onDone(originalUri, { bgRemoved: false });
  };

  const handleCancel = () => {
    // Make sure we stop polling and clear state when user closes
    console.log('[BGRemoval] handleCancel()');
    stopPolling();
    resetJobState();
    onCancel();
  };

  let statusText: string;
  if (jobStatus === 'DONE' && hasResult) {
    statusText =
      'Preview shown with background removed. If you like it, tap “Use this image”.';
  } else if (jobStatus === 'FAILED') {
    statusText =
      errorMessage ||
      'Background removal failed. You can retry or use the original image.';
  } else if (jobStatus === 'PENDING' || jobStatus === 'PROCESSING') {
    statusText = 'Processing image on the server… please wait.';
  } else {
    // IDLE
    statusText =
      'Tap “Remove background” to send this image to the server, then preview the result.';
  }

  return (
    <Modal
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: palette.chatBg ?? '#000',
        }}
      >
        {/* HEADER */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: palette.card,
            marginTop: 50,
          }}
        >
          <Pressable onPress={handleCancel} style={{ padding: 8, marginRight: 8 }}>
            <KISIcon name="back" size={22} color={palette.primary} />
          </Pressable>

          <Text
            style={{
              color: palette.primary,
              fontSize: 16,
              fontWeight: '600',
              flex: 1,
            }}
          >
            Remove Background
          </Text>
        </View>

        {/* CONTENT */}
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            alignItems: 'center',
          }}
        >
          {/* Preview */}
          <View
            style={{
              width: 260,
              height: 260,
              borderRadius: 24,
              backgroundColor: '#00000055',
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Image
              source={{ uri: workingUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
            {isProcessing && (
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                }}
              >
                <ActivityIndicator size="large" color={palette.primary} />
                <Text
                  style={{
                    color: '#fff',
                    marginTop: 8,
                    fontSize: 13,
                  }}
                >
                  Removing background…
                </Text>
              </View>
            )}
          </View>

          {/* Status text */}
          <Text
            style={{
              color: palette.subtext,
              fontSize: 13,
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {statusText}
          </Text>

          {/* ACTION BUTTONS */}
          <View
            style={{
              width: '100%',
              gap: 12,
            }}
          >
            {/* Remove BG */}
            <Pressable
              onPress={startBackgroundRemovalJob}
              disabled={isProcessing}
              style={{
                paddingVertical: 10,
                borderRadius: 22,
                backgroundColor: isProcessing
                  ? 'rgba(255,255,255,0.2)'
                  : palette.card,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              {isProcessing && (
                <ActivityIndicator
                  size="small"
                  color={palette.text}
                  style={{ marginRight: 8 }}
                />
              )}
              <Text
                style={{
                  color: palette.text,
                  fontWeight: '600',
                }}
              >
                {isProcessing ? 'Processing…' : 'Remove background'}
              </Text>
            </Pressable>

            {/* Use This Image (result or original) */}
            <Pressable
              onPress={handleConfirm}
              disabled={isProcessing}
              style={{
                paddingVertical: 10,
                borderRadius: 22,
                backgroundColor: palette.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: palette.onPrimary ?? '#fff',
                  fontWeight: '600',
                }}
              >
                Use this image
              </Text>
            </Pressable>

            {/* Use Original (no BG removal) */}
            <Pressable
              onPress={handleUseOriginal}
              disabled={isProcessing}
              style={{
                paddingVertical: 10,
                borderRadius: 22,
                borderWidth: 2,
                borderColor: palette.subtext,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: palette.subtext,
                  fontWeight: '500',
                }}
              >
                Use original image
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
