package com.kis

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
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
    // of the real status bar height — it doesn't fully wire up WindowInsets
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
    // callkeep forwarding is needed — the JS module listens via the RN bridge.
  }
}
