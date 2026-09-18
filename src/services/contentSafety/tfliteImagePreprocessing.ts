/**
 * Decodes+resizes a local image file URI into the exact input tensor the
 * bundled NSFW classifier expects: a 224x224x3 RGB float32 buffer, values
 * scaled to [0, 1] - matching GantMan/nsfw_model's own inference
 * preprocessing exactly (nsfw_detector/predict.py: `keras.preprocessing
 * .image.load_img(path, target_size=(224,224))`, `img_to_array(image)`,
 * `image /= 255`), since getting this wrong silently produces a
 * classifier that runs but never matches its trained distribution.
 *
 * Pipeline, chosen to keep this cheap on low-end devices:
 * 1. react-native-image-resizer (already a dependency, native, fast)
 *    downsamples the source image - which may be several MB at full
 *    camera resolution - to exactly 224x224 BEFORE any JS-side decode
 *    touches it.
 * 2. jpeg-js (pure JS, no native code) decodes that already-tiny 224x224
 *    JPEG into raw RGBA bytes. Decoding happens only after native
 *    downsampling, so this never runs against a full-resolution photo.
 * 3. Alpha is dropped and each RGB byte is divided by 255 into a
 *    Float32Array, matching the model's training-time normalization.
 */
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { decode as decodeJpeg } from 'jpeg-js';
import { toByteArray as base64ToBytes } from 'base64-js';

const MODEL_INPUT_SIZE = 224;

export async function loadImageForModel(uri: string): Promise<Float32Array> {
  const resized = await ImageResizer.createResizedImage(
    uri,
    MODEL_INPUT_SIZE,
    MODEL_INPUT_SIZE,
    'JPEG',
    90,
    0,
    undefined,
    false,
    { mode: 'cover', onlyScaleDown: false },
  );

  const base64 = await RNFS.readFile(resized.uri, 'base64');
  const jpegBytes = base64ToBytes(base64);
  const decoded = decodeJpeg(jpegBytes, { useTArray: true });

  // 'cover' + explicit target dims means this is normally already exactly
  // MODEL_INPUT_SIZE square, but a handful of resizer/codec edge cases
  // (odd source aspect ratios, EXIF-rotated sources) can land a pixel or
  // two off - clamp defensively rather than feeding the model a
  // mismatched tensor shape it will silently misinterpret.
  const width = Math.min(decoded.width, MODEL_INPUT_SIZE);
  const height = Math.min(decoded.height, MODEL_INPUT_SIZE);

  const rgb = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  const srcChannels = 4; // jpeg-js with useTArray:true always returns RGBA
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = (y * decoded.width + x) * srcChannels;
      const dstIdx = (y * MODEL_INPUT_SIZE + x) * 3;
      rgb[dstIdx] = decoded.data[srcIdx] / 255;
      rgb[dstIdx + 1] = decoded.data[srcIdx + 1] / 255;
      rgb[dstIdx + 2] = decoded.data[srcIdx + 2] / 255;
    }
  }
  return rgb;
}
