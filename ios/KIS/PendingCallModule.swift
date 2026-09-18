import Foundation
import React

// Bridges the incoming-call payload captured natively in AppDelegate.swift
// (PKPushRegistryDelegate, before JS is guaranteed to be running) to JS, the
// same way VoipTokenModule bridges the VoIP push token itself.
//
// Why this exists: CallKit's native "answer"/"end" events (delivered to JS
// via react-native-callkeep) carry ONLY a bare callUUID — confirmed directly
// from react-native-callkeep's own native source
// (RNCallKeep.m: `body:@{ @"callUUID": ... }`). SocketProvider.tsx's
// onAnswerCall/onEndCall need the call's conversationId/callType/caller info
// to actually do anything, and for a call that arrived via a pure VoIP push
// (app was backgrounded/killed), the socket's own call.offer event — the
// ONLY other source of that data — may never arrive at all (Socket.IO does
// not replay missed room broadcasts to a client that connects afterward).
// AppDelegate.swift writes the push payload here, synchronously, BEFORE
// calling RNCallKeep.reportNewIncomingCall — durable in UserDefaults
// regardless of whether JS ever initializes before the user answers.
@objc(PendingCallModule)
class PendingCallModule: RCTEventEmitter {

  static let userDefaultsKey = "KIS_Pending_Call_Payload"
  static let updatedEventName = "KIS_Pending_Call_Updated"

  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return [PendingCallModule.updatedEventName]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  /// Called by AppDelegate.swift right after writing a new pending call to
  /// UserDefaults, so an already-running JS layer picks it up immediately
  /// instead of only on next explicit read.
  static func notifyUpdated(_ payload: [String: Any]) {
    NotificationCenter.default.post(
      name: NSNotification.Name("KIS_Pending_Call_Internal_Updated"),
      object: payload
    )
  }

  override init() {
    super.init()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInternalUpdate(_:)),
      name: NSNotification.Name("KIS_Pending_Call_Internal_Updated"),
      object: nil
    )
  }

  @objc private func handleInternalUpdate(_ note: Notification) {
    guard hasListeners, let payload = note.object as? [String: Any] else { return }
    sendEvent(withName: PendingCallModule.updatedEventName, body: payload)
  }

  @objc(getPendingCall:rejecter:)
  func getPendingCall(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard
      let data = UserDefaults.standard.data(forKey: PendingCallModule.userDefaultsKey),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      resolve(nil)
      return
    }
    resolve(json)
  }

  /// Called once JS has actually consumed/acted on the pending call
  /// (answered, declined, or the app determined it's stale) so a later,
  /// unrelated cold start doesn't resurrect an old call.
  @objc(clearPendingCall:rejecter:)
  func clearPendingCall(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UserDefaults.standard.removeObject(forKey: PendingCallModule.userDefaultsKey)
    resolve(nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }
}
