package com.kingdom.impact

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions

/**
 * On-device message translation for KIS chat, backed entirely by Google ML
 * Kit's on-device Translate + Language ID APIs. Everything here runs
 * locally: ML Kit ships each language as a small, independently
 * downloadable model (not bundled into the app binary), and translation
 * itself never makes a network call once a model is downloaded. This
 * module never receives, stores, or transmits anything beyond what its
 * caller (TranslationService.ts) already holds in memory as already-
 * decrypted chat text - see that file's header comment for the full
 * no-network invariant this backs.
 *
 * ML Kit models are keyed per single language (not per translation
 * direction/pair) - a downloaded English model is reused whether
 * translating English->French or French->English, which is why
 * getModelStatus/downloadModel below take one language code, not a pair.
 */
class TranslationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KISTranslationModule"

    private val modelManager by lazy { RemoteModelManager.getInstance() }
    private val languageIdentifier by lazy { LanguageIdentification.getClient() }

    /** ML Kit's on-device Translate covers a fixed set of ~59 languages -
     *  anything TranslateLanguage.fromLanguageTag() can't map is simply not
     *  supported on this SDK, not a transient failure. */
    private fun resolveTranslateLanguage(languageCode: String): String? =
        TranslateLanguage.fromLanguageTag(languageCode)

    @ReactMethod
    fun isAvailable(promise: Promise) {
        // ML Kit's on-device Translate ships as part of Google Play services
        // on essentially every device this app supports - there is no OS
        // version gate the way there is on iOS. Always true; kept as an
        // async method (matching the iOS side's shape) so JS can call it
        // uniformly without a Platform.OS branch.
        promise.resolve(true)
    }

    @ReactMethod
    fun identifyLanguage(text: String, promise: Promise) {
        languageIdentifier.identifyLanguage(text)
            .addOnSuccessListener { languageCode ->
                if (languageCode == "und") {
                    promise.resolve(null)
                } else {
                    val result = Arguments.createMap()
                    result.putString("languageCode", languageCode)
                    // ML Kit's basic identifyLanguage() doesn't expose a
                    // confidence score (identifyPossibleLanguages() does,
                    // but returns a ranked list this module doesn't need) -
                    // 1.0 signals "detected", not a calibrated probability.
                    result.putDouble("confidence", 1.0)
                    promise.resolve(result)
                }
            }
            .addOnFailureListener {
                // Detection failure isn't a translation failure - resolve
                // null so the caller can fall back gracefully.
                promise.resolve(null)
            }
    }

    // ML Kit's models are per single language (a downloaded English model
    // is reused for any pair involving English), but the JS-facing contract
    // is pair-based to match Apple's Translation framework exactly (see
    // TranslationService.ts's header comment on this file). Each of the
    // three methods below just applies the single-language ML Kit calls to
    // both languages in the pair and combines the result.

    @ReactMethod
    fun getModelStatus(sourceLanguageCode: String, targetLanguageCode: String, promise: Promise) {
        val sourceLang = resolveTranslateLanguage(sourceLanguageCode)
        val targetLang = resolveTranslateLanguage(targetLanguageCode)
        if (sourceLang == null || targetLang == null) {
            promise.resolve("unsupported")
            return
        }
        val sourceModel = TranslateRemoteModel.Builder(sourceLang).build()
        val targetModel = TranslateRemoteModel.Builder(targetLang).build()
        modelManager.isModelDownloaded(sourceModel)
            .addOnSuccessListener { sourceDownloaded ->
                modelManager.isModelDownloaded(targetModel)
                    .addOnSuccessListener { targetDownloaded ->
                        promise.resolve(if (sourceDownloaded && targetDownloaded) "downloaded" else "not_downloaded")
                    }
                    .addOnFailureListener { promise.resolve("unknown") }
            }
            .addOnFailureListener { promise.resolve("unknown") }
    }

    @ReactMethod
    fun downloadModel(sourceLanguageCode: String, targetLanguageCode: String, promise: Promise) {
        val sourceLang = resolveTranslateLanguage(sourceLanguageCode)
        val targetLang = resolveTranslateLanguage(targetLanguageCode)
        if (sourceLang == null || targetLang == null) {
            promise.reject("UNSUPPORTED_LANGUAGE", "This language pair is not supported for on-device translation.")
            return
        }
        // Wi-Fi-required by default (ML Kit's own default), matching this
        // feature's "don't waste the user's mobile data downloading a
        // multi-MB model behind their back" requirement.
        val conditions = DownloadConditions.Builder().requireWifi().build()
        val sourceModel = TranslateRemoteModel.Builder(sourceLang).build()
        val targetModel = TranslateRemoteModel.Builder(targetLang).build()
        modelManager.download(sourceModel, conditions)
            .addOnSuccessListener {
                modelManager.download(targetModel, conditions)
                    .addOnSuccessListener { promise.resolve(true) }
                    .addOnFailureListener { error ->
                        promise.reject("DOWNLOAD_FAILED", error.message ?: "Failed to download language model.", error)
                    }
            }
            .addOnFailureListener { error ->
                promise.reject("DOWNLOAD_FAILED", error.message ?: "Failed to download language model.", error)
            }
    }

    @ReactMethod
    fun deleteModel(sourceLanguageCode: String, targetLanguageCode: String, promise: Promise) {
        val sourceLang = resolveTranslateLanguage(sourceLanguageCode)
        val targetLang = resolveTranslateLanguage(targetLanguageCode)
        if (sourceLang == null || targetLang == null) {
            promise.resolve(false)
            return
        }
        val sourceModel = TranslateRemoteModel.Builder(sourceLang).build()
        val targetModel = TranslateRemoteModel.Builder(targetLang).build()
        modelManager.deleteDownloadedModel(sourceModel)
            .addOnSuccessListener {
                modelManager.deleteDownloadedModel(targetModel)
                    .addOnSuccessListener { promise.resolve(true) }
                    .addOnFailureListener { promise.resolve(false) }
            }
            .addOnFailureListener { promise.resolve(false) }
    }

    @ReactMethod
    fun getDownloadedModels(promise: Promise) {
        modelManager.getDownloadedModels(TranslateRemoteModel::class.java)
            .addOnSuccessListener { models ->
                val result: WritableArray = Arguments.createArray()
                for (model in models) {
                    result.pushString(model.language)
                }
                promise.resolve(result)
            }
            .addOnFailureListener {
                promise.resolve(Arguments.createArray())
            }
    }

    @ReactMethod
    fun translate(text: String, sourceLanguageCode: String, targetLanguageCode: String, promise: Promise) {
        val sourceLang = resolveTranslateLanguage(sourceLanguageCode)
        val targetLang = resolveTranslateLanguage(targetLanguageCode)
        if (sourceLang == null || targetLang == null) {
            promise.reject("UNSUPPORTED_LANGUAGE", "Translation between these languages isn't supported on-device.")
            return
        }

        val options = TranslatorOptions.Builder()
            .setSourceLanguage(sourceLang)
            .setTargetLanguage(targetLang)
            .build()
        val translator = Translation.getClient(options)

        // Models must already be downloaded before this is called - the JS
        // layer (useMessageTranslation.ts) checks getModelStatus() for both
        // languages and routes the user through downloadModel() first,
        // rather than this method silently triggering a download over
        // whatever connection happens to be available.
        val conditions = DownloadConditions.Builder().requireWifi().build()
        translator.downloadModelIfNeeded(conditions)
            .addOnSuccessListener {
                translator.translate(text)
                    .addOnSuccessListener { translatedText ->
                        translator.close()
                        promise.resolve(translatedText)
                    }
                    .addOnFailureListener { error ->
                        translator.close()
                        promise.reject("TRANSLATE_FAILED", error.message ?: "Translation failed.", error)
                    }
            }
            .addOnFailureListener { error ->
                translator.close()
                promise.reject("MODEL_UNAVAILABLE", error.message ?: "Language model is not available.", error)
            }
    }
}
