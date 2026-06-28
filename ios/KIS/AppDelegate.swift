import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import PushKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // Retained so the OS keeps delivering PushKit callbacks.
  private var voipRegistry: PKPushRegistry?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "KIS",
      in: window,
      launchOptions: launchOptions
    )

    window?.rootViewController?.edgesForExtendedLayout = .all
    window?.rootViewController?.extendedLayoutIncludesOpaqueBars = true
    window?.rootViewController?.view.backgroundColor = .clear

    // Register for VoIP push via PushKit. This issues a VoIP-specific push
    // token that wakes the app even when killed to show the CallKit UI.
    setupVoIPPush()

    return true
  }

  // MARK: - PushKit (VoIP push)

  private func setupVoIPPush() {
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    voipRegistry = registry
  }

  // MARK: - Deep links (kis:// and https://kis.app)

  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return RCTLinkingManager.application(application,
                                          continue: userActivity,
                                          restorationHandler: restorationHandler)
  }

  // MARK: - APNs (regular push for messages / missed calls)

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Store the APNs device token so the JS Firebase module can use it.
    // react-native-callkeep does not need APNs directly — it uses PushKit for
    // VoIP push and reads the token from UserDefaults (set below).
    let tokenHex = deviceToken.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(tokenHex, forKey: "KIS_APNs_Token")
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("[AppDelegate] APNs registration failed: %@", error.localizedDescription)
  }
}

// MARK: - PKPushRegistryDelegate

extension AppDelegate: PKPushRegistryDelegate {

  /// Called once when PushKit issues a VoIP push token (or rotates it).
  /// Store in UserDefaults so the JS layer can read it at startup and send
  /// it to the KIS backend's POST /notifications/tokens/register endpoint.
  func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    guard type == .voIP else { return }
    let tokenData = pushCredentials.token
    let tokenHex = tokenData.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(tokenHex, forKey: "KIS_VoIP_Token")

    // Post a Darwin notification so the JS bridge can pick up the token if
    // the app is already running (supplements the UserDefaults path).
    NotificationCenter.default.post(name: NSNotification.Name("KIS_VoIP_Token_Updated"),
                                    object: tokenHex)
    NSLog("[AppDelegate] VoIP push token updated: %@…", String(tokenHex.prefix(8)))
  }

  /// Called when a VoIP push arrives — even when the app is killed.
  /// iOS 13+ rule: you MUST call reportNewIncomingCall within this method
  /// synchronously, or the OS terminates the app immediately.
  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else { completion(); return }

    let data       = payload.dictionaryPayload
    let callId     = data["callId"]     as? String ?? UUID().uuidString
    let callerName = data["callerName"] as? String
                     ?? data["title"]   as? String
                     ?? "KIS call"
    let callType   = data["callType"]   as? String ?? "voice"
    let hasVideo   = callType == "video" || callType == "video-group"

    // reportNewIncomingCall is the correct static class method on RNCallKeep.
    RNCallKeep.reportNewIncomingCall(
      callId,
      handle: callerName,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: callerName,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: data as? [String: Any],
      withCompletionHandler: completion
    )
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didInvalidatePushTokenFor type: PKPushType
  ) {
    UserDefaults.standard.removeObject(forKey: "KIS_VoIP_Token")
    NSLog("[AppDelegate] VoIP push token invalidated")
  }
}

// MARK: - ReactNativeDelegate

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? { self.bundleURL() }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
