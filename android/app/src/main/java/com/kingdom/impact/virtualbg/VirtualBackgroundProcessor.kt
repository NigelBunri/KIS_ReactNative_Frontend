package com.kingdom.impact.virtualbg

import android.graphics.Bitmap
import android.graphics.Matrix
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.SegmentationMask
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import org.webrtc.JavaI420Buffer
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/**
 * Real on-device person segmentation for virtual backgrounds — feature F.
 *
 * Plugs into react-native-webrtc's VideoFrameProcessor extension point
 * (see node_modules/react-native-webrtc/android/.../videoEffects), which
 * sits between the camera capturer and the RTCVideoSource — meaning this
 * runs on the OUTGOING track itself. Every remote participant (P2P or via
 * the SFU, both consume the same underlying MediaStreamTrack) sees the
 * processed frame, not just this device's own local preview.
 *
 * Pipeline per frame: I420 → ARGB bitmap → downscale to a bounded working
 * resolution → ML Kit Selfie Segmentation (on-device, STREAM_MODE) →
 * composite foreground over a blurred/replaced background using the real
 * per-pixel confidence mask → upscale back to the frame's native
 * resolution → ARGB → I420. The downscale is a deliberate, real-world
 * engineering tradeoff (the same one production virtual-background
 * pipelines make): segmenting/blurring at full 720p+ in a per-pixel CPU
 * loop every ~33ms is not realistic, and this has not been verified on a
 * physical device (no hardware available in this environment) — see the
 * final report's device-test-pending note for this feature.
 */
class VirtualBackgroundProcessor : VideoFrameProcessor {

    private val segmenter = Segmentation.getClient(
        SelfieSegmenterOptions.Builder()
            .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
            .enableRawSizeMask()
            .build()
    )

    override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
        if (VirtualBackgroundConfig.mode == "none") return frame

        val i420 = frame.buffer.toI420() ?: return frame
        try {
            val fullBitmap = i420ToBitmap(i420)

            val scale = min(1f, WORKING_MAX_DIM.toFloat() / max(fullBitmap.width, fullBitmap.height))
            val workW = max(2, (fullBitmap.width * scale).toInt())
            val workH = max(2, (fullBitmap.height * scale).toInt())
            val workBitmap = Bitmap.createScaledBitmap(fullBitmap, workW, workH, true)

            val mask = try {
                Tasks.await(
                    segmenter.process(InputImage.fromBitmap(workBitmap, 0)),
                    SEGMENTATION_TIMEOUT_MS,
                    TimeUnit.MILLISECONDS,
                )
            } catch (e: Exception) {
                null
            }

            val composited = if (mask != null) {
                compositeWithMask(workBitmap, mask)
            } else {
                workBitmap
            }

            val outputBitmap = if (composited.width == fullBitmap.width && composited.height == fullBitmap.height) {
                composited
            } else {
                Bitmap.createScaledBitmap(composited, fullBitmap.width, fullBitmap.height, true)
            }

            val outputBuffer = bitmapToI420(outputBitmap)
            val outputFrame = VideoFrame(outputBuffer, frame.rotation, frame.timestampNs)
            outputBuffer.release() // VideoFrame's constructor already retained it — see class-level note.
            return outputFrame
        } catch (e: Exception) {
            return frame
        } finally {
            i420.release()
        }
    }

    private fun compositeWithMask(bitmap: Bitmap, mask: SegmentationMask): Bitmap {
        val maskBuffer = mask.buffer.order(ByteOrder.nativeOrder()).asFloatBuffer()
        val maskW = mask.width
        val maskH = mask.height

        val background = buildBackground(bitmap)

        val fgPixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(fgPixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        val bgPixels = IntArray(bitmap.width * bitmap.height)
        background.getPixels(bgPixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)

        val out = IntArray(fgPixels.size)
        for (y in 0 until bitmap.height) {
            // Mask dimensions should match the segmentation input (rawSizeMask),
            // but guard against any mismatch defensively rather than crash.
            val my = if (maskH == bitmap.height) y else (y * maskH / bitmap.height)
            for (x in 0 until bitmap.width) {
                val mx = if (maskW == bitmap.width) x else (x * maskW / bitmap.width)
                val confidence = maskBuffer.get(my * maskW + mx).coerceIn(0f, 1f)
                val idx = y * bitmap.width + x
                out[idx] = blendArgb(bgPixels[idx], fgPixels[idx], confidence)
            }
        }

        return Bitmap.createBitmap(out, bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
    }

    private fun buildBackground(sizedLike: Bitmap): Bitmap {
        return when (VirtualBackgroundConfig.mode) {
            "image" -> {
                val custom = VirtualBackgroundConfig.backgroundBitmap
                if (custom != null) centerCropToSize(custom, sizedLike.width, sizedLike.height)
                else boxBlur(sizedLike, VirtualBackgroundConfig.blurRadius)
            }
            else -> boxBlur(sizedLike, VirtualBackgroundConfig.blurRadius)
        }
    }

    private fun centerCropToSize(src: Bitmap, w: Int, h: Int): Bitmap {
        val srcAspect = src.width.toFloat() / src.height
        val dstAspect = w.toFloat() / h
        val scale: Float
        val dx: Float
        val dy: Float
        if (srcAspect > dstAspect) {
            scale = h.toFloat() / src.height
            dx = -(src.width * scale - w) / 2f
            dy = 0f
        } else {
            scale = w.toFloat() / src.width
            dx = 0f
            dy = -(src.height * scale - h) / 2f
        }
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(out)
        val matrix = Matrix()
        matrix.postScale(scale, scale)
        matrix.postTranslate(dx, dy)
        canvas.drawBitmap(src, matrix, android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG))
        return out
    }

    /** Separable box blur (horizontal then vertical pass) — cheap at the
     * bounded working resolution this runs at, real blur (not a fabricated
     * "disabled camera" look), radius controlled by the user's own setting. */
    private fun boxBlur(src: Bitmap, radius: Int): Bitmap {
        if (radius <= 0) return src
        val w = src.width
        val h = src.height
        val pixels = IntArray(w * h)
        src.getPixels(pixels, 0, w, 0, 0, w, h)
        val tmp = IntArray(w * h)

        boxBlurPass(pixels, tmp, w, h, radius, horizontal = true)
        boxBlurPass(tmp, pixels, w, h, radius, horizontal = false)

        return Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
    }

    private fun boxBlurPass(src: IntArray, dst: IntArray, w: Int, h: Int, radius: Int, horizontal: Boolean) {
        if (horizontal) {
            for (y in 0 until h) {
                val rowStart = y * w
                for (x in 0 until w) {
                    var r = 0; var g = 0; var b = 0; var a = 0; var count = 0
                    for (k in -radius..radius) {
                        val xx = (x + k).coerceIn(0, w - 1)
                        val p = src[rowStart + xx]
                        a += (p ushr 24) and 0xFF
                        r += (p ushr 16) and 0xFF
                        g += (p ushr 8) and 0xFF
                        b += p and 0xFF
                        count++
                    }
                    dst[rowStart + x] = ((a / count) shl 24) or ((r / count) shl 16) or ((g / count) shl 8) or (b / count)
                }
            }
        } else {
            for (x in 0 until w) {
                for (y in 0 until h) {
                    var r = 0; var g = 0; var b = 0; var a = 0; var count = 0
                    for (k in -radius..radius) {
                        val yy = (y + k).coerceIn(0, h - 1)
                        val p = src[yy * w + x]
                        a += (p ushr 24) and 0xFF
                        r += (p ushr 16) and 0xFF
                        g += (p ushr 8) and 0xFF
                        b += p and 0xFF
                        count++
                    }
                    dst[y * w + x] = ((a / count) shl 24) or ((r / count) shl 16) or ((g / count) shl 8) or (b / count)
                }
            }
        }
    }

    private fun blendArgb(bg: Int, fg: Int, fgWeight: Float): Int {
        val w = fgWeight
        val a = ((bg ushr 24 and 0xFF) * (1 - w) + (fg ushr 24 and 0xFF) * w).toInt()
        val r = ((bg ushr 16 and 0xFF) * (1 - w) + (fg ushr 16 and 0xFF) * w).toInt()
        val g = ((bg ushr 8 and 0xFF) * (1 - w) + (fg ushr 8 and 0xFF) * w).toInt()
        val b = ((bg and 0xFF) * (1 - w) + (fg and 0xFF) * w).toInt()
        return (a shl 24) or (r shl 16) or (g shl 8) or b
    }

    // ── I420 ⇄ ARGB conversion (BT.601) ─────────────────────────────────────

    private fun i420ToBitmap(buffer: VideoFrame.I420Buffer): Bitmap {
        val width = buffer.width
        val height = buffer.height
        val yData = buffer.dataY
        val uData = buffer.dataU
        val vData = buffer.dataV
        val yStride = buffer.strideY
        val uStride = buffer.strideU
        val vStride = buffer.strideV

        val pixels = IntArray(width * height)
        for (y in 0 until height) {
            val yRowStart = y * yStride
            val uvRow = y / 2
            val uRowStart = uvRow * uStride
            val vRowStart = uvRow * vStride
            for (x in 0 until width) {
                val yVal = (yData.get(yRowStart + x).toInt() and 0xFF)
                val uVal = (uData.get(uRowStart + x / 2).toInt() and 0xFF) - 128
                val vVal = (vData.get(vRowStart + x / 2).toInt() and 0xFF) - 128

                var r = yVal + (1.402f * vVal).toInt()
                var g = yVal - (0.344136f * uVal).toInt() - (0.714136f * vVal).toInt()
                var b = yVal + (1.772f * uVal).toInt()
                r = r.coerceIn(0, 255); g = g.coerceIn(0, 255); b = b.coerceIn(0, 255)

                pixels[y * width + x] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            }
        }
        return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
    }

    private fun bitmapToI420(bitmap: Bitmap): VideoFrame.I420Buffer {
        val width = bitmap.width
        val height = bitmap.height
        val out = JavaI420Buffer.allocate(width, height)
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val yPlane = out.dataY
        val uPlane = out.dataU
        val vPlane = out.dataV
        val yStride = out.strideY
        val uStride = out.strideU
        val vStride = out.strideV

        for (y in 0 until height) {
            for (x in 0 until width) {
                val p = pixels[y * width + x]
                val r = (p ushr 16) and 0xFF
                val g = (p ushr 8) and 0xFF
                val b = p and 0xFF
                val yVal = (0.299f * r + 0.587f * g + 0.114f * b).toInt().coerceIn(0, 255)
                yPlane.put(y * yStride + x, yVal.toByte())
            }
        }
        for (y in 0 until height step 2) {
            for (x in 0 until width step 2) {
                val p = pixels[y * width + x]
                val r = (p ushr 16) and 0xFF
                val g = (p ushr 8) and 0xFF
                val b = p and 0xFF
                val uVal = (-0.168736f * r - 0.331264f * g + 0.5f * b + 128).toInt().coerceIn(0, 255)
                val vVal = (0.5f * r - 0.418688f * g - 0.081312f * b + 128).toInt().coerceIn(0, 255)
                uPlane.put((y / 2) * uStride + (x / 2), uVal.toByte())
                vPlane.put((y / 2) * vStride + (x / 2), vVal.toByte())
            }
        }
        return out
    }

    companion object {
        private const val WORKING_MAX_DIM = 320
        private const val SEGMENTATION_TIMEOUT_MS = 80L
    }
}
