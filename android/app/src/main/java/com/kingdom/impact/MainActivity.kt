package com.kingdom.impact

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.util.Rational
import androidx.activity.enableEdgeToEdge
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "KIS"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Draw behind the status/navigation bars on every supported Android
    // version, not only OS releases that enforce edge-to-edge automatically
    // (API 35+). A raw WindowCompat.setDecorFitsSystemWindows(window, false)
    // call was tried here first but left react-native-safe-area-context
    // reporting a near-zero top inset (~1px) on a physical Galaxy S21 instead
    // of the real status bar height - it doesn't fully wire up WindowInsets
    // dispatch on all API levels. androidx.activity's enableEdgeToEdge()
    // does the complete, version-aware setup (status/nav bar transparency,
    // insets dispatch, icon contrast) that safe-area-context actually needs.
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  /**
   * Forward new Intents to the React Native bridge so the JS Linking module
   * and react-native-callkeep receive "answer call" / deep-link actions from
   * system notifications when the app is already running in the background.
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // React Native's own intent handling (via the bridge) picks up the intent
    // automatically when super.onNewIntent is called. No additional native
    // callkeep forwarding is needed - the JS module listens via the RN bridge.
  }

  // ─── Video-call Picture-in-Picture ─────────────────────────────────────
  //
  // Set by CallPiPModule.setCallActive() whenever JS has an active *video*
  // call session (voice-only calls never set this - PiP only makes sense
  // for something with a picture in it). Read here rather than passed as a
  // one-shot call because onUserLeaveHint fires at the exact moment the
  // user presses Home / switches apps, entirely outside JS's control - the
  // Activity needs to already know whether to react when that happens.
  companion object {
    @Volatile
    var pipEligible: Boolean = false
  }

  /**
   * Called by the OS right before the app is backgrounded by a user gesture
   * (Home button, recents, switching apps) - NOT called for other paths to
   * background like a system dialog or an incoming phone call, but those
   * aren't the "user deliberately left" moment PiP is for anyway. This is
   * the standard Android hook for "auto-enter PiP on background" (the same
   * one YouTube/every other PiP-supporting app uses), as opposed to trying
   * to infer backgrounding from onPause (which also fires for transient,
   * non-backgrounding cases like a permission prompt).
   */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (pipEligible) enterCallPiP()
  }

  /**
   * Builds PictureInPictureParams and requests PiP mode. Safe to call even
   * when not eligible/supported - callers (CallPiPModule, onUserLeaveHint)
   * only reach this when pipEligible is true, but the SDK-version and
   * isInPictureInPictureMode guards below make this a true no-op otherwise
   * rather than relying solely on call-site discipline.
   *
   * @return whether PiP mode was actually entered.
   */
  fun enterCallPiP(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    if (isInPictureInPictureMode) return true
    return try {
      // 9:16 matches this app's call UI (portrait-locked, full-screen
      // video) far better than PiP's own 16:9 default - a landscape PiP
      // window showing a portrait video call would letterbox badly.
      val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(9, 16))
        .build()
      enterPictureInPictureMode(params)
    } catch (e: Exception) {
      // IllegalStateException is the documented failure mode (e.g. the
      // activity is not resumed, or the device policy disallows PiP) -
      // catching broadly here since a failed PiP attempt must never crash
      // an otherwise-healthy call.
      false
    }
  }

  /**
   * Fires on every PiP enter/exit (both user- and system-initiated - e.g.
   * the user tapping the PiP window to return to full screen, which is the
   * "tap to come back to full screen" requirement). Forwarded to JS so
   * ActiveCallScreen can hide/show its own controls to match - PiP's tiny
   * window has no room for KIS's normal call control bar, and leaving it
   * rendered would just overlay illegibly on top of the video.
   */
  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration,
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    // reactHost.currentReactContext (not the legacy ReactInstanceManager
    // path) - this app runs bridgeless (see MainApplication's ReactHost),
    // where emitDeviceEvent is the supported way to reach JS listeners
    // regardless of bridge/bridgeless mode.
    val reactContext = (application as? ReactApplication)?.reactHost?.currentReactContext ?: return
    val params = Arguments.createMap().apply {
      putBoolean("isInPictureInPictureMode", isInPictureInPictureMode)
    }
    reactContext.emitDeviceEvent("KISCallPiPModeChanged", params)
  }
}
