package com.kingdom.impact

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Google Play Install Referrer — the authoritative, tamper-resistant
 * counterpart to the clipboard-based referral-attribution fallback
 * (src/utils/referralAttribution.ts). When a visitor reaches the Play
 * Store listing via a URL carrying `&referrer=ref_code%3D<CODE>`
 * (appended by the website's OpenInApp component — see its own comment),
 * Google Play remembers that string across the install and hands it back
 * here, once, shortly after first launch. Unlike the clipboard value,
 * this cannot be forged by the installing user — it comes from Google
 * Play's own install record, not anything readable/writable on-device
 * before the app existed.
 *
 * `client.installReferrer` is a BLOCKING IPC call into the Play Store
 * process, made from inside onInstallReferrerSetupFinished — which fires
 * on the calling thread, not a background one. Calling it synchronously
 * there was exactly the shape of a real production crash fixed in
 * bluesky-social/social-app PR #12037: if the Play Store process dies or
 * refuses the call mid-IPC, the exception can race against this same
 * listener's own onInstallReferrerServiceDisconnected callback trying to
 * clean up at the same time. Their fix (and this module's, following the
 * same shape) is to make the blocking call on a background dispatcher
 * inside runCatching, then hop back to a single consistent dispatcher
 * (Main) to settle the promise and call endConnection() exactly once -
 * so a disconnect firing mid-call can never race the resolution path.
 */
class InstallReferrerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.Main)

    override fun getName() = "KISInstallReferrerModule"

    @ReactMethod
    fun getInstallReferrer(promise: Promise) {
        val client = InstallReferrerClient.newBuilder(reactContext).build()
        var resolved = false

        suspend fun resolveOnce(value: String?) {
            if (resolved) return
            resolved = true
            promise.resolve(value)
            try {
                client.endConnection()
            } catch (e: Exception) {
                // Connection already closed — nothing actionable.
            }
        }

        try {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    if (responseCode != InstallReferrerClient.InstallReferrerResponse.OK) {
                        // FEATURE_NOT_SUPPORTED (no Play Store on this
                        // device/emulator), SERVICE_UNAVAILABLE, or
                        // DEVELOPER_ERROR — all mean "no referrer
                        // available", never a crash; this is a best-effort
                        // attribution aid, not a required step.
                        scope.launch { resolveOnce(null) }
                        return
                    }
                    scope.launch {
                        val referrer = withContext(Dispatchers.IO) {
                            runCatching { client.installReferrer.installReferrer }.getOrNull()
                        }
                        resolveOnce(referrer)
                    }
                }

                override fun onInstallReferrerServiceDisconnected() {
                    scope.launch { resolveOnce(null) }
                }
            })
        } catch (e: Exception) {
            scope.launch { resolveOnce(null) }
        }
    }
}
