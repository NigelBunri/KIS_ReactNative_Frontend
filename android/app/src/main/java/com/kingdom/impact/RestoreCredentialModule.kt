package com.kingdom.impact

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CreateRestoreCredentialRequest
import androidx.credentials.CreateRestoreCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetRestoreCredentialOption
import androidx.credentials.RestoreCredential
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.GetCredentialException
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Native wrapper for Android's Restore Credentials feature
 * (androidx.credentials.CredentialManager), backing Google Play's
 * "Zero-Tap Sign-In" quality requirement — silently re-authenticating a
 * user after they migrate their apps/data to a new Android device, with no
 * login form shown at all.
 *
 * This module is deliberately thin: it only shuttles WebAuthn JSON payloads
 * between the JS layer (which talks to apps/accounts/webauthn_restore.py on
 * the Django backend for the actual challenge generation/verification) and
 * CredentialManager. All cryptography and the account-lookup/JWT-issuing
 * logic live server-side; this module never sees a private key, only the
 * request/response JSON blobs CredentialManager produces and consumes.
 *
 * Save happens right after a normal login on the user's CURRENT device.
 * Restore happens on a brand-new device, before any session exists — see
 * src/services/auth/restoreCredentials.ts for how the JS side sequences
 * both around the existing phone+password login flow.
 */
class RestoreCredentialModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KISRestoreCredentialModule"

    private val credentialManager by lazy { CredentialManager.create(reactContext) }
    // Own scope (not tied to a single Activity) since a save/restore call can
    // legitimately outlive the Activity that started it (e.g. screen rotation
    // mid-flow) — CredentialManager itself still requires a live Activity
    // Context, fetched fresh from reactContext.currentActivity at call time
    // rather than captured once, for the same reason.
    private val moduleScope = CoroutineScope(Dispatchers.Main)

    /**
     * @param requestJson WebAuthn PublicKeyCredentialCreationOptionsJSON,
     *   exactly as returned by Django's registration-options endpoint.
     * Resolves with the registrationResponseJson string to send back to
     * Django's register endpoint for verification + storage.
     */
    @ReactMethod
    fun saveRestoreCredential(requestJson: String, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No foreground Activity to host the Credential Manager UI.")
            return
        }
        moduleScope.launch {
            try {
                val request = CreateRestoreCredentialRequest(requestJson)
                val response = credentialManager.createCredential(activity, request)
                val restoreResponse = response as? CreateRestoreCredentialResponse
                val registrationResponseJson = restoreResponse?.responseJson
                if (registrationResponseJson.isNullOrEmpty()) {
                    promise.reject("empty_response", "CredentialManager returned no registration response.")
                } else {
                    promise.resolve(registrationResponseJson)
                }
            } catch (e: CreateCredentialException) {
                // Covers E2eeUnavailableException (no screen lock / device
                // backup configured) and CreateCredentialDomException (bad
                // requestJson) alike — the JS side treats "couldn't save a
                // restore credential" as non-fatal either way (password
                // login still works completely normally), so a single
                // reject code is enough; e.message carries the detail for
                // logging.
                promise.reject("create_failed", e.message, e)
            } catch (e: Exception) {
                promise.reject("create_failed", e.message, e)
            }
        }
    }

    /**
     * @param authenticationJson WebAuthn PublicKeyCredentialRequestOptionsJSON,
     *   exactly as returned by Django's authentication-options endpoint.
     * Resolves with the authenticationResponseJson string to send back to
     * Django's authenticate endpoint, or null if no restore credential is
     * available on this device (a normal, expected outcome — e.g. first
     * install ever, not a migration — not an error).
     */
    @ReactMethod
    fun getRestoreCredential(authenticationJson: String, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No foreground Activity to host the Credential Manager UI.")
            return
        }
        moduleScope.launch {
            try {
                val option = GetRestoreCredentialOption(authenticationJson)
                val request = GetCredentialRequest(listOf(option))
                val response = credentialManager.getCredential(activity, request)
                val credential = response.credential
                if (credential is RestoreCredential) {
                    promise.resolve(credential.authenticationResponseJson)
                } else {
                    promise.resolve(null)
                }
            } catch (e: GetCredentialException) {
                // No matching restore credential is the expected, common
                // case (most launches are not a device migration) — resolve
                // null rather than reject, so the JS caller doesn't need to
                // special-case "not found" vs "real error" in a catch block.
                promise.resolve(null)
            } catch (e: Exception) {
                promise.resolve(null)
            }
        }
    }

    /** Called on explicit sign-out, so a stale restore credential doesn't silently re-authenticate the next user of a shared/reset device. */
    @ReactMethod
    fun clearRestoreCredential(promise: Promise) {
        moduleScope.launch {
            try {
                credentialManager.clearCredentialState(
                    ClearCredentialStateRequest(ClearCredentialStateRequest.TYPE_CLEAR_RESTORE_CREDENTIAL),
                )
                promise.resolve(true)
            } catch (e: ClearCredentialException) {
                promise.resolve(false)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }
}
