import Foundation
import UIKit
import SwiftUI
import NaturalLanguage
import React

#if canImport(Translation)
import Translation
#endif

/// On-device message translation for KIS chat.
///
/// Language detection uses Apple's NaturalLanguage framework
/// (`NLLanguageRecognizer`), which has been stable since iOS 12 and needs
/// no availability gating. Translation itself uses Apple's Translation
/// framework, introduced in iOS 17.4 - this app's deployment target is
/// 15.1, well below that, so every Translation-framework call here is
/// gated behind `@available(iOS 18.0, *)` and gracefully reports
/// "unavailable" on older devices (isAvailable() resolves false; JS hides
/// the Translate action entirely rather than letting a call fail
/// confusingly). iOS 18.0 specifically, not 17.4, because
/// `TranslationSession.prepareTranslation()` - the explicit "download this
/// model without translating yet" call this module needs to satisfy the
/// "download language models only when needed" requirement - was only
/// added in iOS 18.
///
/// Everything below runs entirely on-device: no text this module receives
/// or returns is ever sent anywhere. See
/// src/services/translation/TranslationService.ts's header comment for the
/// full no-network invariant this backs.
@objc(TranslationModule)
class TranslationModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Language detection (NaturalLanguage, no availability gate)

  @objc(identifyLanguage:resolver:rejecter:)
  func identifyLanguage(
    _ text: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let recognizer = NLLanguageRecognizer()
    recognizer.processString(text)
    guard let dominant = recognizer.dominantLanguage else {
      resolve(nil)
      return
    }
    let hypotheses = recognizer.languageHypotheses(withMaximum: 1)
    let confidence = hypotheses[dominant] ?? 1.0
    resolve([
      "languageCode": dominant.rawValue,
      "confidence": confidence,
    ])
  }

  // MARK: - Availability

  @objc(isAvailable:rejecter:)
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(Translation)
    if #available(iOS 18.0, *) {
      resolve(true)
      return
    }
    #endif
    resolve(false)
  }

  // MARK: - Model status / download / delete

  @objc(getModelStatus:targetLanguageCode:resolver:rejecter:)
  func getModelStatus(
    _ sourceLanguageCode: String,
    targetLanguageCode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(Translation)
    if #available(iOS 18.0, *) {
      Task {
        let availability = LanguageAvailability()
        let status = await availability.status(
          from: Locale.Language(identifier: sourceLanguageCode),
          to: Locale.Language(identifier: targetLanguageCode)
        )
        switch status {
        case .installed:
          resolve("downloaded")
        case .supported:
          resolve("not_downloaded")
        case .unsupported:
          resolve("unsupported")
        @unknown default:
          resolve("unknown")
        }
      }
      return
    }
    #endif
    resolve("unsupported")
  }

  @objc(downloadModel:targetLanguageCode:resolver:rejecter:)
  func downloadModel(
    _ sourceLanguageCode: String,
    targetLanguageCode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(Translation)
    if #available(iOS 18.0, *) {
      Task {
        do {
          try await TranslationModule.withTranslationSession(
            source: sourceLanguageCode,
            target: targetLanguageCode
          ) { session in
            try await session.prepareTranslation()
          }
          resolve(true)
        } catch {
          reject("DOWNLOAD_FAILED", error.localizedDescription, error)
        }
      }
      return
    }
    #endif
    reject("UNSUPPORTED", "On-device translation requires iOS 18 or later.", nil)
  }

  // Apple's Translation framework does not expose a programmatic delete for
  // downloaded languages as of iOS 18 - a user can only remove them via
  // Settings > General > Translation Languages. Resolving `false` (not
  // rejecting) is deliberate: this is a normal, expected platform
  // limitation the JS layer already treats as "nothing to do here", not an
  // error condition.
  @objc(deleteModel:targetLanguageCode:resolver:rejecter:)
  func deleteModel(
    _ sourceLanguageCode: String,
    targetLanguageCode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(false)
  }

  // Apple exposes no API to enumerate installed Translation languages.
  // Always empty - see TranslationService.ts's getDownloadedModels() doc
  // comment for how callers are expected to treat this on iOS.
  @objc(getDownloadedModels:rejecter:)
  func getDownloadedModels(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve([])
  }

  // MARK: - Translate

  @objc(translate:sourceLanguageCode:targetLanguageCode:resolver:rejecter:)
  func translate(
    _ text: String,
    sourceLanguageCode: String,
    targetLanguageCode: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(Translation)
    if #available(iOS 18.0, *) {
      Task {
        do {
          let translatedText = try await TranslationModule.withTranslationSession(
            source: sourceLanguageCode,
            target: targetLanguageCode
          ) { session -> String in
            let response = try await session.translate(text)
            return response.targetText
          }
          resolve(translatedText)
        } catch {
          reject("TRANSLATE_FAILED", error.localizedDescription, error)
        }
      }
      return
    }
    #endif
    reject("UNSUPPORTED", "On-device translation requires iOS 18 or later.", nil)
  }

  // MARK: - TranslationSession acquisition

  #if canImport(Translation)
  /// Apple's Translation framework only hands out a `TranslationSession`
  /// through the SwiftUI `.translationTask(_:action:)` view modifier -
  /// there is no public API to construct one directly, headless, outside a
  /// view hierarchy. This drives that modifier from an off-screen,
  /// zero-size `UIHostingController` attached briefly to the key window
  /// (attaching to a real window is necessary for SwiftUI to actually run
  /// the task; it's invisible since the view is 1x1 and clear), runs
  /// `perform` with the resulting session, then tears the hosting
  /// controller down. This is the standard workaround third-party apps use
  /// to call Apple's Translation framework imperatively rather than
  /// declaratively; Apple has not shipped a non-SwiftUI equivalent as of
  /// iOS 18.
  @available(iOS 18.0, *)
  private static func withTranslationSession<T>(
    source: String,
    target: String,
    perform: @escaping (TranslationSession) async throws -> T
  ) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
      group.addTask {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<T, Error>) in
          DispatchQueue.main.async {
            var hostingController: UIHostingController<AnyView>?
            var didResume = false

            let configuration = TranslationSession.Configuration(
              source: Locale.Language(identifier: source),
              target: Locale.Language(identifier: target)
            )

            let hostedView = AnyView(
              Color.clear
                .frame(width: 1, height: 1)
                .translationTask(configuration) { session in
                  guard !didResume else { return }
                  didResume = true
                  do {
                    let result = try await perform(session)
                    continuation.resume(returning: result)
                  } catch {
                    continuation.resume(throwing: error)
                  }
                  hostingController?.view.removeFromSuperview()
                  hostingController = nil
                }
            )

            let controller = UIHostingController(rootView: hostedView)
            controller.view.backgroundColor = .clear
            controller.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
            hostingController = controller

            let window = UIApplication.shared.connectedScenes
              .compactMap { ($0 as? UIWindowScene)?.keyWindow }
              .first
            window?.addSubview(controller.view)
          }
        }
      }
      // Guards against `.translationTask` never firing for some reason
      // (e.g. the view never actually entering the window's hierarchy on a
      // given OS build) - without this, a stuck native call would hang the
      // JS promise indefinitely instead of surfacing a clear error.
      group.addTask {
        try await Task.sleep(nanoseconds: 30_000_000_000)
        throw NSError(
          domain: "KISTranslationModule",
          code: 408,
          userInfo: [NSLocalizedDescriptionKey: "Translation timed out."]
        )
      }
      let result = try await group.next()!
      group.cancelAll()
      return result
    }
  }
  #endif
}
