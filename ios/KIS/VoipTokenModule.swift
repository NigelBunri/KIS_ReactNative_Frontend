import Foundation
import React

// Bridges the PushKit VoIP token captured natively in AppDelegate.swift to
// JS. AppDelegate stores the token in UserDefaults ("KIS_VoIP_Token") and
// posts a NotificationCenter event ("KIS_VoIP_Token_Updated") on rotation —
// this module exposes both so JS can register/re-register the token with the
// KIS NestJS backend's POST /notifications/tokens/register endpoint.
@objc(VoipTokenModule)
class VoipTokenModule: RCTEventEmitter {

  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["KIS_VoIP_Token_Updated"]
  }

  override func startObserving() {
    hasListeners = true
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleTokenUpdated(_:)),
      name: NSNotification.Name("KIS_VoIP_Token_Updated"),
      object: nil
    )
  }

  override func stopObserving() {
    hasListeners = false
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func handleTokenUpdated(_ note: Notification) {
    guard hasListeners, let token = note.object as? String else { return }
    sendEvent(withName: "KIS_VoIP_Token_Updated", body: token)
  }

  @objc(getVoipToken:rejecter:)
  func getVoipToken(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(UserDefaults.standard.string(forKey: "KIS_VoIP_Token"))
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }
}
