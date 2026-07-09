package com.kis

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ShortcutPackage())
          add(SimInfoPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    // react-native-callkeep registration with the Android Telecom framework is
    // handled entirely by the JS layer when the app calls RNCallKeep.setup(config).
    // No native-side setup call is needed here — auto-linking wires the module in
    // automatically via PackageList above.
  }
}
