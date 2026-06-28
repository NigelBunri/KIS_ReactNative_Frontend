package com.kis

import android.content.Intent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "KIS"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

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
