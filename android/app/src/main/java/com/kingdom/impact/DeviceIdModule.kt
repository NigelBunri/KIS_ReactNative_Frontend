package com.kingdom.impact

import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Exposes Settings.Secure.ANDROID_ID - a stable identifier assigned by the OS
 * to (app signing key, user, device), used as the seed for this device's
 * device_id instead of a randomly-generated string. Unlike the random string,
 * ANDROID_ID survives an app uninstall/reinstall (it's OS state, not app
 * storage), so the backend can still recognize this as the account's known
 * primary device afterwards instead of requiring QR re-linking - closing the
 * same gap iOS Keychain persistence already closes there.
 *
 * It does NOT survive a factory reset, and it changes if the app is ever
 * re-signed with a different key (e.g. switching build pipelines) - neither
 * of those is fixable from an app-storage or app-signing-scoped identifier,
 * so those cases still fall back to QR re-linking / account recovery, same
 * as today.
 *
 * No permission required - ANDROID_ID has always been freely readable.
 */
class DeviceIdModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KISDeviceIdModule"

    @ReactMethod
    fun getAndroidId(promise: Promise) {
        try {
            val id = Settings.Secure.getString(
                reactContext.contentResolver,
                Settings.Secure.ANDROID_ID,
            )
            promise.resolve(if (id.isNullOrBlank()) null else id)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
