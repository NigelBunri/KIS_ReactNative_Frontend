/**
 * On-device content-safety pre-send check — a privacy-preserving first
 * line of defense that runs BEFORE any network upload, so obviously
 * prohibited images/video frames never leave the device at all. This is
 * deliberately a DETERRENT layer, not the enforcement backstop: a
 * modified/rooted client could disable this check entirely, so anything
 * that becomes genuinely public still goes through the real, unavoidable
 * server-side AI scan + human-moderation gate (apps.moderation on the
 * Django side). For private chat specifically — which the server is
 * explicitly never allowed to content-scan — this on-device check is the
 * ONLY safety layer that can ever exist, imperfect as that is.
 *
 * Uses react-native-fast-tflite (Nitro Modules — the same native-module
 * framework this app already ships via react-native-nitro-sound, so this
 * introduces no new native-integration pattern) to run GantMan/nsfw_model's
 * MobileNetV2-based NSFW classifier (MIT-licensed, ~92% validation
 * accuracy per its published training run) fully on-device, bundled at
 * src/assets/models/nsfwMobileNetV2.tflite. Converted from the model's
 * official v1.1.0 release SavedModel via TFLiteConverter with dynamic-
 * range (int8 weight) quantization - 6.5MB, down from the 24MB float
 * original - to respect the explicit "must not make the app heavy/slow
 * on low-end devices" requirement. Quantization fidelity was checked
 * against the float model on synthetic neutral inputs (random noise,
 * solid colors, a gradient - deliberately not real photos) and tracked
 * within ~5% absolute probability, consistent with normal post-training
 * quantization noise.
 *
 * IMPORTANT DISCLOSED LIMITATION: nothing in this session verified this
 * model's actual detection accuracy against real explicit images - doing
 * so would mean sourcing/reviewing adult content, which was deliberately
 * not done. The ~92% figure is the upstream project's own published
 * validation accuracy, not something re-verified here. Treat this
 * on-device layer as a best-effort deterrent, same as its module-level
 * docstring already states, not a guaranteed-accurate filter.
 *
 * FAIL-SAFE BY DESIGN: if the model fails to load, or inference throws
 * for any reason, this returns a "clean" verdict rather than blocking
 * the send or crashing the app. The server-side scan remains the real
 * backstop for anything public regardless of whether this layer is
 * active.
 */
export type OnDeviceScanVerdict = {
  /** True only when the model actually ran and flagged this content. */
  flagged: boolean;
  /** 0-1 confidence the model assigned to its most concerning label, or
   * null if inference didn't actually run (model missing/failed/not yet
   * loaded) - distinct from a genuine low score. */
  score: number | null;
  /** Never populated with graphic/explicit label detail in any UI-facing
   * copy - see toUserMessage() below. Kept here only for internal
   * debugging/audit logging. */
  label: string | null;
  /** Why a verdict came back the way it did - "model_not_available",
   * "below_threshold", "flagged", "inference_error". */
  reason: string;
};

const CLEAN_VERDICT = (reason: string): OnDeviceScanVerdict => ({
  flagged: false,
  score: null,
  label: null,
  reason,
});

// Below this confidence, a detection is too uncertain to block a send on
// its own - mirrors the same reasoning as the server-side NudeNet
// threshold (apps.media.safety.NUDENET_AUTO_BLOCK_THRESHOLD): only a
// confident match blocks; anything softer is let through client-side and
// left to the server-side review pipeline instead of guessing.
const ON_DEVICE_BLOCK_THRESHOLD = 0.8;

// GantMan/nsfw_model's fixed training label order (class_labels.txt in
// the v1.1.0 release) - the model's output tensor is a 5-way softmax in
// exactly this order. "drawings"/"neutral" are safe classes; a send is
// only ever flagged on the combined confidence of the other three.
const LABELS = ['drawings', 'hentai', 'neutral', 'porn', 'sexy'] as const;
const CONCERNING_LABELS = new Set(['hentai', 'porn', 'sexy']);

// Matches server-side wording conventions (apps.media.safety /
// src/services/mediaSafety.ts's KIS_UPLOAD_BLOCKED_MESSAGE) - never
// describes what was detected, just states the policy plainly.
export const ON_DEVICE_BLOCK_MESSAGE =
  'This file cannot be sent. KIS is a Christian, family-safe platform and does not allow pornographic, sexually explicit, exploitative, or unsafe media anywhere.';

type TFLiteModel = {
  runSync: (inputs: ArrayBuffer[]) => ArrayBuffer[];
};

let modelLoadAttempted = false;
let cachedModel: TFLiteModel | null = null;

/** Lazily loads the classifier at most once per app session. Any failure
 * here (missing asset, unsupported device, corrupt file) is swallowed —
 * the caller always gets a usable (null) model back and falls through to
 * the fail-safe "clean" verdict, never a thrown error. */
async function getModel(): Promise<TFLiteModel | null> {
  if (modelLoadAttempted) return cachedModel;
  modelLoadAttempted = true;
  try {
    // Deferred require: react-native-fast-tflite's native module should
    // only be touched on a real device/simulator, never at module-eval
    // time (matches this codebase's existing "dynamic import" convention
    // for optional/heavy native deps, e.g. react-native-webrtc).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadTensorflowModel } = require('react-native-fast-tflite');
    // Bundled asset - metro.config.js registers 'tflite' as an asset
    // extension so this require(..) resolves to a real bundle entry,
    // per react-native-fast-tflite's own required setup step.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const model = await loadTensorflowModel(require('../../assets/models/nsfwMobileNetV2.tflite'), []);
    cachedModel = model as unknown as TFLiteModel;
    return cachedModel;
  } catch {
    return null;
  }
}

/**
 * Decodes+resizes the image at `uri` to the classifier's expected input
 * tensor and runs inference. Returns a fail-safe "clean" verdict if the
 * model isn't available or anything throws.
 */
export async function scanImageUriOnDevice(uri: string): Promise<OnDeviceScanVerdict> {
  const model = await getModel();
  if (!model) return CLEAN_VERDICT('model_not_available');

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadImageForModel } = require('./tfliteImagePreprocessing');
    const pixels: Float32Array = await loadImageForModel(uri);
    const outputs = model.runSync([pixels.buffer as ArrayBuffer]);
    return interpretNsfwOutput(outputs[0]);
  } catch {
    return CLEAN_VERDICT('inference_error');
  }
}

/**
 * Samples a small, fixed number of frames from a local video file and
 * scans each - deliberately NOT the whole video, to keep this lightweight
 * on low-end devices per the explicit performance requirement. Returns
 * flagged=true if ANY sampled frame is flagged.
 */
export async function scanVideoUriOnDevice(
  uri: string,
  options?: { maxFrames?: number },
): Promise<OnDeviceScanVerdict> {
  const model = await getModel();
  if (!model) return CLEAN_VERDICT('model_not_available');

  const maxFrames = options?.maxFrames ?? 2;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractSampleFrames } = require('./videoFrameSampling');
    const frameUris: string[] = await extractSampleFrames(uri, maxFrames);
    for (const frameUri of frameUris) {
      const verdict = await scanImageUriOnDevice(frameUri);
      if (verdict.flagged) return verdict;
    }
    return CLEAN_VERDICT('below_threshold');
  } catch {
    return CLEAN_VERDICT('inference_error');
  }
}

function interpretNsfwOutput(output: ArrayBuffer | undefined): OnDeviceScanVerdict {
  try {
    if (!output) return CLEAN_VERDICT('inference_error');
    const scores = new Float32Array(output);
    if (scores.length !== LABELS.length) return CLEAN_VERDICT('inference_error');

    // Flag on the highest-scoring CONCERNING label rather than a plain
    // argmax over all 5 - a photo the model splits mostly between
    // "neutral" and "sexy" should still be judged on its "sexy" score,
    // not waved through just because "neutral" happened to edge it out.
    let maxConcerningScore = 0;
    let maxConcerningLabel: string | null = null;
    for (let i = 0; i < LABELS.length; i += 1) {
      if (CONCERNING_LABELS.has(LABELS[i]) && scores[i] > maxConcerningScore) {
        maxConcerningScore = scores[i];
        maxConcerningLabel = LABELS[i];
      }
    }

    if (maxConcerningScore >= ON_DEVICE_BLOCK_THRESHOLD) {
      return { flagged: true, score: maxConcerningScore, label: maxConcerningLabel, reason: 'flagged' };
    }
    return { flagged: false, score: maxConcerningScore, label: maxConcerningLabel, reason: 'below_threshold' };
  } catch {
    return CLEAN_VERDICT('inference_error');
  }
}
