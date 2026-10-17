import Foundation
import UIKit
import React

/// JS-facing control surface for the real virtual-background pipeline (see
/// VirtualBackgroundProcessor.swift). JS calls configure() to set
/// mode/blur strength/background image BEFORE calling the
/// react-native-webrtc track's own _setVideoEffect('kis-virtualbg') /
/// _setVideoEffects([]) to actually turn the effect on/off — see
/// src/services/calls/virtualBgService.ts for the client-side contract.
/// Mirrors the Android VirtualBackgroundModule.kt surface exactly.
@objc(KISVirtualBackgroundModule)
class VirtualBackgroundModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(isAvailable:rejecter:)
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 15.0, *) {
      resolve(true)
    } else {
      resolve(false)
    }
  }

  @objc(configure:blurRadius:imageUri:resolver:rejecter:)
  func configure(
    _ mode: String,
    blurRadius: NSNumber,
    imageUri: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    VirtualBackgroundConfig.mode = mode
    VirtualBackgroundConfig.blurRadius = CGFloat(max(1, min(40, blurRadius.intValue)))

    guard mode == "image", let uriString = imageUri, !uriString.isEmpty else {
      VirtualBackgroundConfig.backgroundImage = nil
      resolve(true)
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      let image = Self.decodeImage(uriString: uriString)
      VirtualBackgroundConfig.backgroundImage = image
      DispatchQueue.main.async {
        resolve(image != nil)
      }
    }
  }

  @objc(clear:rejecter:)
  func clear(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    VirtualBackgroundConfig.mode = "none"
    VirtualBackgroundConfig.backgroundImage = nil
    resolve(true)
  }

  private static func decodeImage(uriString: String) -> UIImage? {
    guard let url = URL(string: uriString) else { return nil }
    if url.isFileURL {
      guard let data = try? Data(contentsOf: url) else { return nil }
      return UIImage(data: data)
    }
    if url.scheme == "http" || url.scheme == "https" {
      guard let data = try? Data(contentsOf: url) else { return nil }
      return UIImage(data: data)
    }
    // A bare local path with no scheme (some RN image pickers return these).
    guard let data = FileManager.default.contents(atPath: uriString) else { return nil }
    return UIImage(data: data)
  }
}
