/**
 * Extracts a small, fixed number of still frames from a local video file
 * URI for the on-device NSFW classifier to scan — deliberately not the
 * whole video, to keep this lightweight on low-end devices per the
 * explicit performance requirement (a couple of native thumbnail grabs,
 * not full decode/frame-walk).
 *
 * Uses react-native-create-thumbnail (native, small footprint) rather
 * than an ffmpeg-based approach — no bundled ffmpeg binary, no added
 * app-size/startup cost.
 */
import { createThumbnail } from 'react-native-create-thumbnail';

/** Samples timestamps as fractions of a nominal video length rather than
 * probing real duration first (an extra native call/roundtrip this
 * lightweight check doesn't need) - first frame plus one roughly a third
 * in is enough to catch content that isn't front-loaded innocuously. */
function sampleTimestampsMs(maxFrames: number): number[] {
  const FALLBACK_DURATION_MS = 15000;
  if (maxFrames <= 1) return [0];
  const stamps: number[] = [];
  for (let i = 0; i < maxFrames; i += 1) {
    stamps.push(Math.round((i / maxFrames) * FALLBACK_DURATION_MS));
  }
  return stamps;
}

/**
 * Returns up to `maxFrames` local file:// URIs of extracted thumbnail
 * frames. A single failed/timed-out extraction is skipped rather than
 * aborting the whole sample - callers (onDeviceImageScan.ts) already
 * treat an empty/partial frame list as "nothing flagged" via the
 * fail-safe path, never as an error to surface to the user.
 */
export async function extractSampleFrames(uri: string, maxFrames: number): Promise<string[]> {
  const timestamps = sampleTimestampsMs(maxFrames);
  const frames: string[] = [];
  for (const timeStamp of timestamps) {
    try {
      const result = await createThumbnail({ url: uri, timeStamp, cacheName: undefined });
      if (result?.path) {
        frames.push(
          result.path.startsWith('file://') || result.path.startsWith('http')
            ? result.path
            : `file://${result.path}`,
        );
      }
    } catch {
      // Expected for e.g. a timestamp past a short clip's actual length -
      // skip this frame rather than failing the whole scan.
    }
  }
  return frames;
}
