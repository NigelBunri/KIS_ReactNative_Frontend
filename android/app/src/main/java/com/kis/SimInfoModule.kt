package com.kis

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Best-effort read of the device's own SIM line number, used to recognize a
 * device as the account's primary device after reinstall without requiring
 * QR re-linking. There is no iOS equivalent — Apple does not expose an app's
 * own phone number — so this module is Android-only by design.
 *
 * TelephonyManager.line1Number is notoriously unreliable across carriers/OEMs
 * (many return null or empty regardless of permission), so callers must treat
 * a null/empty result as "unknown", never as "no SIM" or an error.
 */
class SimInfoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KISSimInfoModule"

    @ReactMethod
    fun getSimPhoneNumber(promise: Promise) {
        try {
            val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Manifest.permission.READ_PHONE_NUMBERS
            } else {
                Manifest.permission.READ_PHONE_STATE
            }
            val granted = ContextCompat.checkSelfPermission(reactContext, permission) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) {
                promise.resolve(null)
                return
            }

            val tm = reactContext.getSystemService(ReactApplicationContext.TELEPHONY_SERVICE)
                as? TelephonyManager
            @Suppress("DEPRECATION")
            val number = tm?.line1Number
            promise.resolve(if (number.isNullOrBlank()) null else number)
        } catch (e: SecurityException) {
            // Some OEMs throw despite a granted permission — treat as unknown.
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
