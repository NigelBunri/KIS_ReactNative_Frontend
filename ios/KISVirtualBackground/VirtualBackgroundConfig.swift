import Foundation
import CoreGraphics
import UIKit

/// Shared, mutable virtual-background configuration, written by
/// VirtualBackgroundModule.configure() (called from JS) and read every
/// frame by VirtualBackgroundProcessor. See the matching Android
/// VirtualBackgroundConfig.kt for the identical cross-platform contract:
/// react-native-webrtc's `_setVideoEffect(name)` only takes a bare
/// processor name, with no room for the mode/blur/background-image config
/// JS actually needs — this object carries the "how"; `_setVideoEffect`
/// still controls the "whether" (on/off).
@objc(KISVirtualBackgroundConfig)
public class VirtualBackgroundConfig: NSObject {
    @objc public static let processorName = "kis-virtualbg"

    @objc public static var mode: String = "none" // "none" | "blur" | "image"
    @objc public static var blurRadius: CGFloat = 12
    @objc public static var backgroundImage: UIImage?
}
