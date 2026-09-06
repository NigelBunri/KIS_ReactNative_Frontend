package com.kingdom.impact

import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS-facing control surface for native video-call Picture-in-Picture.
 *
 * The actual PiP mechanics (PictureInPictureParams, onUserLeaveHint,
 * onPictureInPictureModeChanged) live on MainActivity itself, since those
 * are Activity lifecycle callbacks the OS calls directly - this module just
 * lets JS tell the Activity "a video call is active" (setCallActive) ahead
 * of that happening, and exposes a manual entry point (enterPictureInPicture)
 * for anything that wants to trigger PiP without waiting for onUserLeaveHint
 * (e.g. an in-app "minimize" button).
 *
 * KISCallPiPModeChanged is emitted directly by MainActivity, not from here -
 * this module has no lifecycle hook of its own to emit it from.
 */
class CallPiPModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KISCallPiPModule"

    @ReactMethod
    fun isSupported(promise: Promise) {
        promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
    }

    /**
     * @param active whether a call is currently connected/active (not just
     *   ringing/dialing - PiP on a call no one has answered yet is confusing).
     * @param isVideo whether that call has video - voice-only calls should
     *   never trigger PiP, they have nothing to show in the floating window.
     */
    @ReactMethod
    fun setCallActive(active: Boolean, isVideo: Boolean) {
        MainActivity.pipEligible = active && isVideo
    }

    @ReactMethod
    fun enterPictureInPictureMode(promise: Promise) {
        val activity = reactContext.currentActivity as? MainActivity
        if (activity == null) {
            promise.resolve(false)
            return
        }
        promise.resolve(activity.enterCallPiP())
    }
}
