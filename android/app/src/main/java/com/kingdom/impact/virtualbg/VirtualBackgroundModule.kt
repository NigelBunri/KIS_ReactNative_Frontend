package com.kingdom.impact.virtualbg

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.InputStream
import java.util.concurrent.Executors

/**
 * JS-facing control surface for the real virtual-background pipeline (see
 * VirtualBackgroundProcessor.kt). JS calls configure() to set mode/blur
 * strength/background image BEFORE calling the react-native-webrtc track's
 * own _setVideoEffect('kis-virtualbg') / _setVideoEffects([]) to actually
 * turn the effect on/off — see src/services/calls/virtualBgService.ts for
 * the client-side side of this contract.
 */
class VirtualBackgroundModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newSingleThreadExecutor()

    override fun getName() = "KISVirtualBackgroundModule"

    @ReactMethod
    fun isAvailable(promise: Promise) {
        // ML Kit's on-device Selfie Segmentation model has no separate
        // Play-Services-availability gate the way some other ML Kit APIs
        // do (unlike, say, Smart Reply) — it's bundled/downloaded
        // automatically on first use. True here reflects that the native
        // module and its gradle dependency are present and linked.
        promise.resolve(true)
    }

    @ReactMethod
    fun configure(mode: String, blurRadius: Double, imageUri: String?, promise: Promise) {
        VirtualBackgroundConfig.mode = mode
        VirtualBackgroundConfig.blurRadius = blurRadius.toInt().coerceIn(1, 40)

        if (mode != "image" || imageUri.isNullOrEmpty()) {
            VirtualBackgroundConfig.backgroundBitmap = null
            promise.resolve(true)
            return
        }

        executor.execute {
            try {
                val bitmap = decodeImageUri(imageUri)
                VirtualBackgroundConfig.backgroundBitmap = bitmap
                promise.resolve(bitmap != null)
            } catch (e: Exception) {
                VirtualBackgroundConfig.backgroundBitmap = null
                promise.reject("VIRTUALBG_IMAGE_DECODE_FAILED", e)
            }
        }
    }

    @ReactMethod
    fun clear(promise: Promise) {
        VirtualBackgroundConfig.mode = "none"
        VirtualBackgroundConfig.backgroundBitmap = null
        promise.resolve(true)
    }

    private fun decodeImageUri(imageUri: String): Bitmap? {
        val stream: InputStream? = if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
            java.net.URL(imageUri).openStream()
        } else {
            reactContext.contentResolver.openInputStream(Uri.parse(imageUri))
        }
        return stream?.use { BitmapFactory.decodeStream(it) }
    }
}
