package com.kingdom.impact.virtualbg

import android.graphics.Bitmap

/**
 * Shared, mutable virtual-background configuration, written by
 * VirtualBackgroundModule.configure() (called from JS) and read every frame
 * by VirtualBackgroundProcessor.
 *
 * react-native-webrtc's video-effect extension point (_setVideoEffect(name))
 * only takes a bare processor NAME, with no room for the config the JS side
 * actually needs to pass (blur strength, which background image). Rather
 * than registering a new named processor per possible config — impossible
 * for an arbitrary user-picked image anyway — ONE processor is registered
 * under a fixed name and always reads its live config from here. Toggling
 * the effect on/off is still done via _setVideoEffect(NAME) / _setVideoEffects([]);
 * this object only carries the "how", not the "whether".
 */
object VirtualBackgroundConfig {
    const val PROCESSOR_NAME = "kis-virtualbg"

    @Volatile
    var mode: String = "none" // "none" | "blur" | "image"

    @Volatile
    var blurRadius: Int = 12

    @Volatile
    var backgroundBitmap: Bitmap? = null
}
